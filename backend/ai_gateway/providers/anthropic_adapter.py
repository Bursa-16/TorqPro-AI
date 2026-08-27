"""TorqPro AI Gateway - Anthropic Messages API adapter.

AI-P1: production-capable ``AIModelClient`` implementation that calls the
Anthropic Messages REST API via ``httpx`` (already a project dependency --
no new package is required).

Design constraints (all enforced here):

1. **No SDK dependency.**  All HTTP is done with a plain ``httpx.Client``
   constructed by the caller and injected via ``__init__``.  This keeps the
   adapter independently testable with ``httpx.MockTransport``.

2. **No hard-coded API key.**  The key comes exclusively from
   ``AnthropicProviderConfig.api_key``, which is read from the
   ``TORQPRO_ANTHROPIC_API_KEY`` environment variable by ``load_from_env``
   in ``backend.ai_gateway.providers.config``.  It is never stored anywhere
   except in the in-memory config object.

3. **Timeout → ModelTimeoutError.**  ``httpx.TimeoutException`` (and all
   its subclasses: ``ConnectTimeout``, ``ReadTimeout``, ``WriteTimeout``,
   ``PoolTimeout``) is caught and re-raised as
   ``backend.ai_gateway.exceptions.ModelTimeoutError``.  This satisfies
   AI-B4's ``timeout_seconds`` contract.

4. **All other failures → ModelUnavailableError.**  Any ``httpx.HTTPError``
   or unexpected exception that is not a timeout is normalized to
   ``ModelUnavailableError``.  Raw HTTP response bodies and exception
   messages are NEVER forwarded to the caller or logged (no accidental
   credential/data leakage).

5. **No numeric literals.**  Default timeout and max_tokens values live
   in the route module (``backend.api.routes.ai_gateway``) and are passed
   through ``AnthropicProviderConfig``; this module contains no float or
   non-structural integer literal (AST guard:
   ``tests/ai/test_safety_and_validation.py``).

6. **Provider-independent abstraction.**  The public surface is exactly
   ``AIModelClient``; no Anthropic-specific type ever leaks outside this
   module.

7. **Privacy.**  The API key header value is never passed to
   ``audit.AIInteractionRecord``, never written to ``ai_audit_records``,
   never included in any exception message forwarded to the HTTP caller.
"""

from __future__ import annotations

import json
from typing import Optional

import httpx

from backend.ai_gateway.exceptions import ModelTimeoutError, ModelUnavailableError
from backend.ai_gateway.llm_client import AIModelClient, ModelResponse, PromptContext
from backend.ai_gateway.providers.config import (
    ANTHROPIC_API_URL,
    ANTHROPIC_API_VERSION,
    AnthropicProviderConfig,
)


def _build_system_prompt(language: str) -> str:
    """Fixed, non-user-derived system prompt for the Anthropic adapter.

    Fully static -- never derived from ``PromptContext.query_text``,
    evidence content, or any other user-supplied field.  This is the
    "system policy" boundary: evidence and user query live in the
    user-turn message, not here.
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
    """Assemble the user-turn message from ``PromptContext``.

    Keeps the three-way separation (system policy / user query / evidence)
    that ``backend.ai_gateway.context_builder.build_context`` already
    establishes structurally in ``PromptContext``:

    - ``PromptContext.query_text`` → the user's actual question / task
    - ``PromptContext.evidence`` → approved QB records, treated as data
    - ``PromptContext.calculation_result`` → deterministic engine output
      (forwarded verbatim, never recomputed)

    Both ``query_text`` and evidence content are **untrusted data** in this
    context: they are placed in the user turn of the Anthropic API request,
    never in the system prompt.  The system prompt is always the fixed
    policy string from :func:`_build_system_prompt`.
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
        # Forward the deterministic result summary without recomputing anything.
        cr = prompt_context.calculation_result
        parts.append(
            f"Deterministic calculation result (authoritative, do not alter): "
            f"provider={cr.provider_version}"
        )

    return "\n\n".join(parts)


class AnthropicModelClient(AIModelClient):
    """Production ``AIModelClient`` that calls the Anthropic Messages API.

    Constructed once at startup by the route module's
    ``_maybe_register_anthropic`` function and registered in
    ``_PROVIDER_REGISTRY`` under ``self.name``.  Never constructed from
    request input.

    Attributes:
        name:   Registry key (``"anthropic"``).  Must match the ``provider_name``
                a caller would supply to opt into this client.
    """

    name = "anthropic"

    def __init__(
        self,
        config: AnthropicProviderConfig,
        *,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        """
        Args:
            config:       Server-side config (API key, model, timeout, etc.).
            http_client:  Optional pre-built ``httpx.Client`` -- supplied by
                          tests (using ``httpx.MockTransport``) to exercise
                          the full adapter logic without live network I/O.
                          When ``None``, a real ``httpx.Client`` is created
                          lazily on the first ``complete()`` call.
        """
        self._config = config
        self._http_client = http_client

    @property
    def model_identifier(self) -> str:
        return self._config.model

    def is_available(self) -> bool:
        return self._config.is_enabled()

    def _get_http_client(self, timeout_seconds: Optional[float]) -> httpx.Client:
        """Return the shared or injected ``httpx.Client``.

        If ``self._http_client`` was injected (test path), return it directly;
        the timeout supplied in ``complete()`` is applied per-request via the
        ``timeout=`` argument to ``client.post()`` rather than baked into the
        client instance, so the injected client remains reusable across calls
        with different timeouts.

        If no client was injected (production path), create a new one.
        ``httpx.Client`` is not thread-safe for concurrent use; a per-request
        client is the safe default for this phase (no connection pooling
        optimization yet).
        """
        if self._http_client is not None:
            return self._http_client
        return httpx.Client()

    def complete(
        self,
        prompt_context: PromptContext,
        *,
        timeout_seconds: Optional[float] = None,
    ) -> ModelResponse:
        """Call the Anthropic Messages API and return a ``ModelResponse``.

        The effective timeout priority:
        1. ``timeout_seconds`` argument (caller-supplied, highest priority).
        2. ``self._config.timeout_seconds`` (server-side config default).

        Raises:
            ModelTimeoutError:     ``httpx.TimeoutException`` (connect, read,
                                   write, or pool timeout).
            ModelUnavailableError: Any other ``httpx`` or parsing failure.
                                   Raw error details are NEVER forwarded.
        """
        effective_timeout = (
            timeout_seconds
            if timeout_seconds is not None
            else self._config.timeout_seconds
        )

        payload = {
            "model": self._config.model,
            "max_tokens": self._config.max_tokens,
            "system": _build_system_prompt(prompt_context.language),
            "messages": [
                {"role": "user", "content": _build_user_message(prompt_context)},
            ],
        }

        headers = {
            "x-api-key": self._config.api_key,
            "anthropic-version": ANTHROPIC_API_VERSION,
            "content-type": "application/json",
        }

        http_client = self._get_http_client(timeout_seconds)
        own_client = self._http_client is None  # did we create it ourselves?

        try:
            response = http_client.post(
                ANTHROPIC_API_URL,
                content=json.dumps(payload).encode("utf-8"),
                headers=headers,
                timeout=effective_timeout,
            )
            # Raise for non-2xx -- status detail never forwarded to caller.
            response.raise_for_status()
            data = response.json()

            # Extract the first text content block from the Anthropic response.
            content_blocks = data.get("content", [])
            text = ""
            for block in content_blocks:
                if isinstance(block, dict) and block.get("type") == "text":
                    text = block.get("text", "")
                    break

            if not text:
                raise ModelUnavailableError(
                    f"Provider '{self.name}' returned an empty content block."
                )

            return ModelResponse(text=text, model_name=self.name)

        except httpx.TimeoutException:
            # B4 contract: timeout -> ModelTimeoutError.
            # Message is generic -- never echoes request content or API key.
            raise ModelTimeoutError(
                f"Provider '{self.name}' exceeded timeout ({effective_timeout}s)."
            )
        except (httpx.HTTPStatusError, httpx.HTTPError):
            # Non-timeout HTTP failure: network error, 4xx/5xx.
            # Raw status code or body is NOT forwarded.
            raise ModelUnavailableError(
                f"Provider '{self.name}' HTTP request failed."
            )
        except ModelUnavailableError:
            raise
        except Exception:  # noqa: BLE001
            # Unexpected failure (JSON parse error, missing key, etc.)
            # Raw exception message is NOT forwarded.
            raise ModelUnavailableError(
                f"Provider '{self.name}' returned an unexpected response."
            )
        finally:
            if own_client:
                http_client.close()


__all__ = ["AnthropicModelClient"]
