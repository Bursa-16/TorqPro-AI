"""TorqPro AI Gateway Reasoning - optional AI-generated wording layer
(v3.0.0-beta.2).

This is the **only** module in ``backend.ai_gateway.reasoning`` that
ever imports an ``AIModelClient`` or calls ``.complete()`` --
structurally separating "Engineering Reasoning" (``engine.py``, fully
deterministic) from "AI-generated explanation" (here), per the
approved Stage 0 design.

Reuses ``backend.ai_gateway.context_builder.build_context`` unchanged
(the same ``PromptContext`` assembly every other AI-gateway pipeline
step uses) rather than building a second, competing context shape.

**Never affects the deterministic reasoning result.** Every function
here returns ``(text, provider_name)`` or ``(None, None)`` -- it never
raises to its caller (``backend/api/routes/ai_gateway.py``'s
``engineering_reasoning_endpoint``) for a provider failure/timeout/
unknown-provider-name; those are all normalized to ``(None, None)``
here, mirroring ``backend.ai_gateway.orchestrator.handle_query``'s own
``ModelUnavailableError`` normalization pattern but *contained*
locally rather than propagated, because a reasoning caller must
receive HTTP 200 with the full deterministic ``ReasoningResult`` even
when AI wording fails (Stage 0 invariant: "AI provider unavailable
must not affect the deterministic result").

Never constructs, edits, or rounds a numeric engineering value -- the
``calculation_result`` passed into the prompt context is the same,
unmodified ``CalculationResponse``
``backend.ai_gateway.reasoning.evidence_adapter`` produced; this
module only reads ``model_client.complete(...).text`` back out and
returns it verbatim, mirroring
``backend.ai_gateway.composer``'s own rule 2.
"""

from __future__ import annotations

from typing import Optional, Tuple

from backend.ai_gateway.context_builder import build_context
from backend.ai_gateway.llm_client import AIModelClient
from backend.ai_gateway.output_validator import validate_model_response  # AI-RECOVERY-B2
from backend.ai_gateway.permission import UserContext
from backend.calculation_engine.response import CalculationResponse

from .models import ReasoningResult, ReasoningState


def _build_reasoning_query_text(reasoning_result: ReasoningResult) -> str:
    """Fixed-template prompt text -- built entirely from already-
    computed, already-verbatim ``ReasoningResult`` fields (never a
    caller-supplied free string), so this module invents no new
    engineering claim for the model to react to."""
    return (
        f"trace_id={reasoning_result.trace_id} için mühendislik "
        f"reasoning sonucu: state={reasoning_result.reasoning_state}, "
        f"conclusion={reasoning_result.engineering_conclusion}. "
        "Bu deterministik sonucu, mühendislik kararını değiştirmeden, "
        "sade ve anlaşılır bir dille açıkla."
    )


def attempt_ai_explanation(
    reasoning_result: ReasoningResult,
    *,
    calculation_response: Optional[CalculationResponse],
    model_client: Optional[AIModelClient],
    user: UserContext,
    language: str = "tr",
    max_model_output_chars: Optional[int] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """Try to produce AI-generated wording for an already-computed
    ``reasoning_result``. Returns ``(text, provider_name)`` on success,
    ``(None, None)`` on any failure or when no attempt was made.

    Deliberately does not attempt this for
    ``ReasoningState.INSUFFICIENT_EVIDENCE`` results (nothing evidenced
    exists to word) -- callers are expected to only call this for
    ``SUPPORTED``/``UNSUPPORTED`` results, but this function itself
    also never raises even if called for an insufficient-evidence
    result; it simply has nothing useful to prompt with and will
    return whatever the model produces for an empty conclusion (a
    caller-level gate, not a hard requirement of this function, keeps
    ``run_reasoning``'s own contract the sole source of truth for
    reasoning-state semantics).
    """
    if model_client is None:
        return None, None

    if reasoning_result.reasoning_state == ReasoningState.INSUFFICIENT_EVIDENCE:
        return None, None

    try:
        prompt_context = build_context(
            query_text=_build_reasoning_query_text(reasoning_result),
            user=user,
            evidence=(),
            calculation_result=calculation_response,
        )
        response = model_client.complete(prompt_context)
        # AI-RECOVERY-B2: validate provider prose immediately after the
        # provider boundary.  Invalid output is treated identically to a
        # provider exception (normalized to (None, None)) so the
        # deterministic ReasoningResult the caller already holds is never
        # affected -- matching the module docstring invariant:
        # "AI provider unavailable must not affect the deterministic result."
        # ``max_model_output_chars`` is supplied by the route module so
        # this module contains no numeric literal (AST guard constraint).
        # When ``None`` (e.g. in tests that call this function directly),
        # type/empty/whitespace checks still run; only the size check is
        # skipped.
        _max = max_model_output_chars if max_model_output_chars is not None else len(response.text)
        validate_model_response(
            response.text,
            max_chars=_max,
            provider_name=model_client.name,
        )
    except Exception:  # noqa: BLE001 - deliberately broad: provider
        # exceptions and ModelUnavailableError from validate_model_response
        # both degrade to (None, None); no distinction is exposed to
        # the caller, matching the existing error-normalisation contract.
        return None, None

    return response.text, model_client.name


__all__ = ["attempt_ai_explanation"]
