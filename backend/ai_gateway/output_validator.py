"""TorqPro AI Gateway - provider model-output validation.

AI-RECOVERY-B2: single, shared validator for prose returned by any
``AIModelClient.complete()`` call across the entire AI gateway.

**Trust boundary (rationale):**

``ModelResponse.text`` is a raw string that arrives from an external
provider.  Until it has been accepted by :func:`validate_model_response`,
it is *untrusted*.  The validation step therefore belongs between the
``model_client.complete()`` call and any code that treats the text as
authoritative prose suitable for forwarding to the user or persisting in
the audit trail.

Two call sites apply this validation in the current codebase:

1. ``backend.ai_gateway.orchestrator.handle_query`` -- general AI query
   pipeline.  An invalid response is re-raised as
   ``ModelUnavailableError`` (fail-closed: the request gets a 503, no
   partially-trusted prose ever reaches ``composer.compose()``).

2. ``backend.ai_gateway.reasoning.wording.attempt_ai_explanation`` --
   optional AI wording for engineering reasoning.  An invalid response
   degrades to ``(None, None)`` (fail-closed: the fully-deterministic
   ``ReasoningResult`` is returned unchanged with ``ai_explanation=None``).

**What this module does NOT do:**

- No truncation (ADR-0017: the model's own text is never edited).
- No HTML sanitisation (no templating layer exists in this backend).
- No evidence-ID or citation parsing from prose (citations/evidence are
  structurally derived from ``evidence_check.verified_sources``, which
  is itself derived from the verified, publishable-only QB records
  supplied by the retrieval adaptor -- provider prose cannot alter that
  structural derivation).
- No regex-based content checks beyond the basic string-validity
  constraints below.
- No modification of ``ModelResponse`` dataclass itself (internal code
  constructs ``ModelResponse`` directly in ``FakeModelClient`` and test
  helpers without needing validation; the validation boundary is the
  *use* of the response in the pipeline, not its construction).
"""

from __future__ import annotations

from backend.ai_gateway.exceptions import ModelUnavailableError


def validate_model_response(
    text: object,
    *,
    max_chars: int,
    provider_name: str = "unknown",
) -> str:
    """Validate raw provider output text and return it if valid.

    Accepts any object as ``text`` so callers do not need to perform a
    type guard before calling; a non-``str`` value is rejected with the
    same ``ModelUnavailableError`` as every other invalid output, so the
    caller's error-handling path is always the same single branch.

    ``max_chars`` is the caller-supplied upper bound on accepted prose
    length.  The authoritative value is
    ``backend.api.routes.ai_gateway.MAX_MODEL_OUTPUT_CHARS``.
    It is passed explicitly (not hardcoded here) so that this module
    contains no engineering-coefficient numeric literal -- matching the
    AST-based ``test_no_engineering_numeric_literal_anywhere_in_ai_gateway``
    guard in ``tests/ai/test_safety_and_validation.py``.

    Args:
        text:           The raw ``.text`` field from a ``ModelResponse``.
        max_chars:      Upper bound on accepted prose length (characters).
        provider_name:  The ``AIModelClient.name`` value, used only as
                        a diagnostic label inside the raised exception
                        message (never forwarded to the end user).

    Returns:
        ``text`` unchanged when it is a non-empty, non-whitespace-only
        ``str`` whose length does not exceed ``max_chars``.

    Raises:
        ModelUnavailableError: for any of the following conditions --
            * ``text`` is not a ``str``
            * ``text`` is empty (``len == 0``)
            * ``text`` is whitespace-only
            * ``len(text) > max_chars``

        The exception message identifies the rejection reason generically
        (without echoing the raw provider text, to prevent accidental
        leakage of untrusted content into server logs or error responses).

    No truncation is performed.  A too-long response is always rejected,
    never silently cut to fit.
    """
    if not isinstance(text, str):
        raise ModelUnavailableError(
            f"Provider '{provider_name}' returned a non-string output "
            f"(type={type(text).__name__!r}); refusing to forward untrusted content."
        )
    if not text:
        raise ModelUnavailableError(
            f"Provider '{provider_name}' returned an empty response; "
            "refusing to forward untrusted content."
        )
    if not text.strip():
        raise ModelUnavailableError(
            f"Provider '{provider_name}' returned a whitespace-only response; "
            "refusing to forward untrusted content."
        )
    if len(text) > max_chars:
        raise ModelUnavailableError(
            f"Provider '{provider_name}' returned an oversized response "
            f"({len(text)} chars > {max_chars} limit); "
            "refusing to forward untrusted content."
        )
    return text


__all__ = ["validate_model_response"]
