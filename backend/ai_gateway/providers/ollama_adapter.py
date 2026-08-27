"""TorqPro AI Gateway - Ollama local provider adapter (AI-P2L).

Implements :class:`~backend.ai_gateway.llm_client.AIModelClient` over
the Ollama Chat API (``/api/chat``) using the already-present ``httpx``
library.  No Ollama SDK or Python package is required.

**Design principles (AI-P2L):**

- **Free/local by default.** Ollama runs on the operator's own machine;
  no cloud API key is needed, no per-token cost is incurred.
- **No SDK dependency.** All I/O uses a plain ``httpx.Client`` with an
  explicit ``httpx.Timeout``, exactly mirroring
  :mod:`~backend.ai_gateway.providers.anthropic_adapter`.
- **No numeric literal inside ``backend/ai_gateway/``.**  Every
  configurable number (default timeout, port) is supplied by the caller
  so this module satisfies the AST-based
  ``test_no_engineering_numeric_literal_anywhere_in_ai_gateway`` guard.
- **Timeout contract (B4).** ``httpx.TimeoutException`` →
  :class:`~backend.ai_gateway.exceptions.ModelTimeoutError`.  Any
  other network/HTTP failure → :class:`~backend.ai_gateway.exceptions.
  ModelUnavailableError`.  Raw server payloads and ``httpx`` exception
  messages are never forwarded.
- **No API key.** Normal local Ollama requires none; the adapter never
  touches a secret store.
- **No automatic cloud fallback.**  An Ollama failure raises
  ``ModelUnavailableError`` and stops there -- it never silently
  forwards the request to the Anthropic adapter.  Local failure must
  not trigger unexpected paid cloud cost or data transfer.
- **Structural system/user/evidence separation.**  Ollama's Chat API
  supports ``role: system`` and ``role: user`` natively.  The three-way
  boundary (system policy / user query / evidence data) is preserved in
  the same way as in the Anthropic adapter:

      ``role: system`` → fixed policy string (never request-derived)
      ``role: user``   → query + evidence as labelled DATA (not instruction)

- **No GPU assumptions.**  The adapter is indifferent to whether Ollama
  runs on CPU or GPU; no CUDA or device-specific field is sent.

**Environment variables (read by the caller, NOT this module):**

    TORQPRO_OLLAMA_ENABLED         — must be "true" to activate
    TORQPRO_OLLAMA_BASE_URL        — default http://127.0.0.1:11434
    TORQPRO_OLLAMA_MODEL           — model tag, e.g. "qwen3:8b"
    TORQPRO_OLLAMA_TIMEOUT_SECONDS — per-request HTTP timeout

This module never calls ``os.getenv`` itself, keeping all config access
in the route module (``backend.api.routes.ai_gateway``).

**Ollama Chat API shape (POST /api/chat):**

    {
      "model": "<tag>",
      "stream": false,
      "messages": [
        {"role": "system", "content": "<fixed policy>"},
        {"role": "user",   "content": "<query + evidence>"}
      ]
    }

Response (non-streaming, ``stream: false``)::

    {
      "model": "...",
      "message": {"role": "assistant", "content": "..."},
      "done": true,
      "prompt_eval_count": <int>,   // input tokens (optional)
      "eval_count":        <int>    // output tokens (optional)
    }
"""

from __future__ import annotations

import json
from typing import Dict, Optional

import httpx

from backend.ai_gateway.exceptions import ModelTimeoutError, ModelUnavailableError
from backend.ai_gateway.llm_client import AIModelClient, ModelResponse, PromptContext

#: Ollama Chat API path relative to the base URL.
_CHAT_PATH = "/api/chat"


def _build_system_prompt(language: str) -> str:
    """Fixed, non-user-derived system policy string for the Ollama adapter.

    Identical in intent to the Anthropic adapter's ``_build_system_prompt``:
    purely static, never derived from evidence or request content.
    """
    if language.strip().casefold() == "en":
        return (
            "You are TorqPro AI, a non-authoritative engineering assistant. "
            "You explain and clarify technical content based solely on the "
            "approved evidence provided. You do not generate, invent, or "
            "approximate engineering values. Your output is advisory prose only."
        )
    return (
        "Sen TorqPro AI'sın, otorite-dışı bir mühendislik asistanısın. "
        "Yalnızca sağlanan onaylı kanıtlara dayanarak teknik içeriği açıklıyor "
        "ve netleştiriyorsun. Mühendislik değerleri üretmiyor, icat etmiyor veya "
        "yaklaşık değer vermiyorsun. Çıktın yalnızca açıklayıcı yorumdur."
    )


def _build_user_message(prompt_context: PromptContext) -> str:
    """Assemble the user-turn content string from ``PromptContext``.

    Evidence and calculation results are placed here as *data*, not as
    system instructions, preserving the three-way boundary:

      system policy  ≠  user query  ≠  evidence data

    All content in this string is untrusted data from the caller's
    perspective -- the Ollama model should read it as input, not as
    policy override.
    """
    parts = [f"Question / Task:\n{prompt_context.query_text}"]

    if prompt_context.evidence:
        evidence_lines = []
        for src in prompt_context.evidence:
            title = src.title_tr or src.title_en or src.source_id
            body = src.body_tr or src.body_en or ""
            evidence_lines.append(f"[{src.source_type} #{src.source_id}] {title}: {body}")
        parts.append("Approved evidence:\n" + "\n".join(evidence_lines))

    if prompt_context.calculation_result is not None:
        cr = prompt_context.calculation_result
        parts.append(
            "Deterministic calculation result (authoritative, do not alter): "
            f"provider={cr.provider_version}"
        )

    return "\n\n".join(parts)


class OllamaModelClient(AIModelClient):
    """Production ``AIModelClient`` that calls a local Ollama server.

    No API key required.  No cloud traffic.  No per-token cost.

    Args:
        model_id:               Ollama model tag, e.g. ``"qwen3:8b"``.
        base_url:               Ollama server base URL (scheme + host + port).
                                Supplied by the caller from env/config; no
                                default is hard-coded here to avoid fixing a
                                port number inside ``backend/ai_gateway/``.
        default_timeout_seconds: Fallback timeout when ``complete()`` is called
                                without an explicit ``timeout_seconds``.
                                Supplied by the caller so this module contains
                                no float literal (AST guard constraint).
        http_client:            Optional pre-built ``httpx.Client`` for tests
                                (via ``httpx.MockTransport``).  ``None`` in
                                production.
    """

    def __init__(
        self,
        *,
        model_id: str,
        base_url: str,
        default_timeout_seconds: float,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        self._model_id = model_id
        self._base_url = base_url.rstrip("/")
        self._default_timeout = default_timeout_seconds
        self._http_client = http_client

    # ------------------------------------------------------------------
    # AIModelClient interface
    # ------------------------------------------------------------------

    @property
    def name(self) -> str:  # type: ignore[override]
        return "ollama"

    @property
    def model_identifier(self) -> str:
        return self._model_id

    def is_available(self) -> bool:
        """Returns ``True`` -- the adapter is always marked available when
        instantiated; actual server reachability is discovered at request
        time (``complete()`` raises ``ModelUnavailableError`` on connection
        failure).  This matches the Anthropic adapter's contract: the
        registry entry exists, but a real call may still fail.
        """
        return True

    def complete(
        self,
        prompt_context: PromptContext,
        *,
        timeout_seconds: Optional[float] = None,
    ) -> ModelResponse:
        """Call the Ollama Chat API and return a ``ModelResponse``.

        Raises:
            ModelTimeoutError:     Any ``httpx.TimeoutException`` subtype.
            ModelUnavailableError: Connection failure, non-2xx HTTP, JSON
                                   parse error, or unexpected response shape.
                                   Raw server payloads are never forwarded.
        """
        effective_timeout = (
            timeout_seconds if timeout_seconds is not None else self._default_timeout
        )
        payload = self._build_payload(prompt_context)
        url = f"{self._base_url}{_CHAT_PATH}"

        try:
            data = self._post(url, payload, effective_timeout)
        except (ModelTimeoutError, ModelUnavailableError):
            raise
        except Exception as exc:  # noqa: BLE001
            raise ModelUnavailableError(
                f"Ollama provider encountered an unexpected error "
                f"(category: {type(exc).__name__})"
            ) from exc

        text = self._extract_text(data)
        return ModelResponse(text=text, model_name=self.name)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_payload(self, prompt_context: PromptContext) -> Dict[str, Any]:
        """Build the Ollama Chat API request body.

        ``stream: false`` forces a single synchronous response object
        (as opposed to the default newline-delimited streaming format),
        which simplifies parsing and keeps the I/O model identical to the
        Anthropic adapter.
        """
        return {
            "model": self._model_id,
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": _build_system_prompt(prompt_context.language),
                },
                {
                    "role": "user",
                    "content": _build_user_message(prompt_context),
                },
            ],
        }

    def _post(
        self,
        url: str,
        payload: Dict[str, Any],
        timeout_seconds: float,
    ) -> Dict[str, Any]:
        """Execute the HTTP POST and return the parsed JSON body.

        Timeout exceptions → ``ModelTimeoutError``.
        All other failures → ``ModelUnavailableError``.
        Raw error detail is never forwarded.
        """
        httpx_timeout = httpx.Timeout(timeout_seconds)

        try:
            if self._http_client is not None:
                # Test-injected client (MockTransport). Timeout attribute
                # is already set on the injected client if needed.
                resp = self._http_client.post(
                    url,
                    headers={"content-type": "application/json"},
                    content=json.dumps(payload).encode("utf-8"),
                )
            else:
                with httpx.Client(timeout=httpx_timeout) as http_client:
                    resp = http_client.post(
                        url,
                        headers={"content-type": "application/json"},
                        content=json.dumps(payload).encode("utf-8"),
                    )
        except (
            httpx.ReadTimeout,
            httpx.ConnectTimeout,
            httpx.WriteTimeout,
            httpx.PoolTimeout,
        ):
            raise ModelTimeoutError(
                "Ollama provider timed out while producing a completion."
            )
        except httpx.ConnectError:
            raise ModelUnavailableError(
                "Ollama provider is not reachable "
                "(connection refused or server not running)."
            )
        except httpx.HTTPError:
            raise ModelUnavailableError(
                "Ollama provider network error (httpx.HTTPError)."
            )

        if not resp.is_success:
            raise ModelUnavailableError(
                f"Ollama provider returned HTTP {resp.status_code}."
            )

        try:
            return resp.json()
        except Exception:  # noqa: BLE001
            raise ModelUnavailableError(
                "Ollama provider returned a non-JSON response body."
            )

    @staticmethod
    def _extract_text(data: Dict[str, Any]) -> str:
        """Extract the assistant content string from an Ollama Chat response.

        Raises ``ModelUnavailableError`` on unexpected shape; never returns
        empty string (``validate_model_response`` in the orchestrator / QB
        Explain pipeline handles that, but structural absence is an adapter-
        level error).
        """
        try:
            content = data["message"]["content"]
            if isinstance(content, str) and content:
                return content
            raise ModelUnavailableError(
                "Ollama response contained no non-empty assistant content."
            )
        except (KeyError, TypeError):
            raise ModelUnavailableError(
                "Ollama response JSON did not match expected Chat API shape."
            )


__all__ = ["OllamaModelClient"]
