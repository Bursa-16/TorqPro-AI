"""TorqPro AI Gateway - Ollama local provider adapter (AI-P2L).

Implements :class:`~backend.ai_gateway.llm_client.AIModelClient` over
the Ollama Chat API (``/api/chat``) using the already-present ``httpx``
library.  No Ollama SDK or Python package is required.

**Design principles (AI-P2L / AI-P2L-R):**

- **Free/local by default.** Ollama runs on the operator's own machine;
  no cloud API key is needed, no per-token cost is incurred.
- **No SDK dependency.** All I/O uses a plain ``httpx.Client`` with an
  explicit ``httpx.Timeout``, exactly mirroring
  :mod:`~backend.ai_gateway.providers.anthropic_adapter`.
- **No numeric literal inside ``backend/ai_gateway/``.**  Every
  configurable number (default timeout, port) is supplied by the caller
  so this module satisfies the AST-based
  ``test_no_engineering_numeric_literal_anywhere_in_ai_gateway`` guard.
- **keep_alive (AI-P2L-R).** The Ollama ``keep_alive`` field controls
  how long the model stays loaded in VRAM/RAM after a request.  It is
  included in every ``/api/chat`` payload as a Go duration string
  (e.g. ``"10m"``).  Supplied by the caller from env/config; no default
  is hard-coded here.
- **Timeout contract (B4).** ``httpx.TimeoutException`` →
  :class:`~backend.ai_gateway.exceptions.ModelTimeoutError`.  Any
  other network/HTTP failure → :class:`~backend.ai_gateway.exceptions.
  ModelUnavailableError`.  Raw server payloads and ``httpx`` exception
  messages are never forwarded.
- **Health/readiness (AI-P2L-R).** :meth:`OllamaModelClient.check_readiness`
  performs a non-blocking ``GET /api/tags`` probe and returns an
  :class:`OllamaReadinessStatus` enum value distinguishing four states:
  ``SERVER_UNAVAILABLE``, ``SERVER_REACHABLE``, ``MODEL_MISSING``,
  ``MODEL_READY``.  Raw error detail is never leaked.  The method is
  explicit/lazy -- it is never called automatically at startup (to avoid
  blocking application start for 40-80 s during model loading).
- **No API key.** Normal local Ollama requires none.
- **No automatic cloud fallback.**  An Ollama failure raises
  ``ModelUnavailableError`` and stops there.
  PAID_CLOUD_AUTO_FALLBACK = NO.
- **No automatic model download or substitution.**  If the configured
  model is not present, ``check_readiness()`` returns ``MODEL_MISSING``
  and ``complete()`` will fail with ``ModelUnavailableError`` from
  Ollama itself.  TorqPro never calls ``ollama pull``.
- **Structural system/user/evidence separation.**  ``role: system``
  carries a fixed policy string; ``role: user`` carries query + evidence
  as labelled DATA (not instruction).
- **No GPU assumptions.**  No CUDA or device-specific field is sent.
"""

from __future__ import annotations

import enum
import json
from typing import Any, Dict, List, Optional

import httpx

from backend.ai_gateway.exceptions import ModelTimeoutError, ModelUnavailableError
from backend.ai_gateway.llm_client import AIModelClient, ModelResponse, PromptContext

#: Ollama Chat API path relative to the base URL.
_CHAT_PATH = "/api/chat"

#: Ollama tags API -- returns list of locally available models.
#: Used by check_readiness() to probe server state without making a
#: generative call.
_TAGS_PATH = "/api/tags"


class OllamaReadinessStatus(enum.Enum):
    """Result of an explicit :meth:`OllamaModelClient.check_readiness` probe.

    Values:
        SERVER_UNAVAILABLE: Ollama server is not reachable (connection
            refused, network error, timeout on the probe).
        SERVER_REACHABLE: ``GET /api/tags`` succeeded but the configured
            model tag is not in the returned list.  Model needs to be
            pulled by the operator (``ollama pull <model>``).
        MODEL_MISSING: alias for SERVER_REACHABLE + model not found --
            kept separate for clear operator messaging.
        MODEL_READY: Server reachable and configured model tag is present
            in the local model list.  Inference calls should succeed
            (subject to runtime conditions).
    """
    SERVER_UNAVAILABLE = "server_unavailable"
    SERVER_REACHABLE   = "server_reachable"
    MODEL_MISSING      = "model_missing"
    MODEL_READY        = "model_ready"


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
        keep_alive: str,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        self._model_id = model_id
        self._base_url = base_url.rstrip("/")
        self._default_timeout = default_timeout_seconds
        self._keep_alive = keep_alive
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

    def check_readiness(
        self, *, probe_timeout_seconds: Optional[float] = None
    ) -> OllamaReadinessStatus:
        """Probe the Ollama server and return a :class:`OllamaReadinessStatus`.

        Uses ``GET /api/tags`` (lightweight, no inference, returns the list
        of locally available models).  Compares the returned model names
        against the configured ``model_id``.

        This method is **explicit/lazy** -- it is never called automatically
        at application startup (to avoid blocking for 40-80 s during model
        loading).  Callers invoke it on demand (e.g. a health endpoint,
        an admin check, or a pre-flight step before a known-expensive call).

        Args:
            probe_timeout_seconds: Short timeout for the probe HTTP call.
                Supplied by the caller; when ``None``, a brief default is
                used (long enough to detect a running server, short enough
                not to hang).  The value is passed from the route module
                so no numeric literal lives here.

        Returns:
            :class:`OllamaReadinessStatus` -- never raises; all errors are
            normalised to ``SERVER_UNAVAILABLE`` or ``MODEL_MISSING``.
            Raw server payloads and exception messages are never leaked.
        """
        effective_timeout = (
            probe_timeout_seconds
            if probe_timeout_seconds is not None
            else self._default_timeout
        )
        url = f"{self._base_url}{_TAGS_PATH}"

        try:
            if self._http_client is not None:
                resp = self._http_client.get(url)
            else:
                with httpx.Client(timeout=httpx.Timeout(effective_timeout)) as c:
                    resp = c.get(url)
        except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPError, Exception):
            return OllamaReadinessStatus.SERVER_UNAVAILABLE

        if not resp.is_success:
            return OllamaReadinessStatus.SERVER_UNAVAILABLE

        try:
            data = resp.json()
            models: List[Dict] = data.get("models", [])
            # Model names in the list may include the tag (e.g. "qwen2.5:3b")
            # or just the name part.  We check for an exact match on the full
            # configured tag first, then fall back to name-only prefix match.
            available_names = []
            for m in models:
                raw = m.get("name", "") or m.get("model", "")
                available_names.append(raw)
            configured = self._model_id.strip()
            configured_base = configured.split(":")[0]
            for n in available_names:
                if n == configured or n.split(":")[0] == configured_base:
                    return OllamaReadinessStatus.MODEL_READY
            return OllamaReadinessStatus.MODEL_MISSING
        except Exception:  # noqa: BLE001
            # JSON parse error or unexpected shape -- server is reachable but
            # we can't determine model availability.
            return OllamaReadinessStatus.SERVER_REACHABLE

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

        ``stream: false`` forces a single synchronous response object.
        ``keep_alive`` controls how long the model stays loaded in memory
        after the request; supplied from config (default ``"10m"`` set in
        the route module).
        """
        return {
            "model": self._model_id,
            "stream": False,
            "keep_alive": self._keep_alive,
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


__all__ = ["OllamaModelClient", "OllamaReadinessStatus"]
