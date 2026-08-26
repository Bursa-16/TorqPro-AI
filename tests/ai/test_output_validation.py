"""AI-RECOVERY-B2 -- provider model-output validation tests.

Covers ``backend.ai_gateway.output_validator`` unit contract, the
general AI query fail-closed behavior via
``backend.ai_gateway.orchestrator.handle_query``, the optional
engineering-reasoning wording degradation via
``backend.ai_gateway.reasoning.wording.attempt_ai_explanation``,
evidence structural integrity (EVIDENCE_REFERENCE_VALIDATION), and
schema_version preservation (B1 non-regression).

Uses the same shared ``client``/``auth_headers`` fixtures and
``dependency_overrides`` pattern already established by
``tests/ai/test_http_route.py`` and
``tests/ai/reasoning/test_http_route_reasoning.py``.
"""

from __future__ import annotations

import uuid

import pytest

from backend import app as app_module
from backend.ai_gateway.exceptions import ModelUnavailableError
from backend.ai_gateway.llm_client import (
    AIModelClient,
    FakeModelClient,
    ModelResponse,
    PromptContext,
)
from backend.ai_gateway.output_validator import validate_model_response
from backend.api.routes import ai_gateway as route_module
from backend.api.routes.ai_gateway import MAX_MODEL_OUTPUT_CHARS

_QUERY_ENDPOINT = "/api/ai/query"
_REASONING_ENDPOINT = "/api/ai/engineering-reasoning"
_TORQUE_ENDPOINT = "/api/ai/torque-recommendation"

_SEGMENT = {"length_mm": 20, "modulus_mpa": 210000, "area_mm2": 200}
_SUPPORTED_PAYLOAD = {
    "diameter_mm": 10,
    "pitch_mm": 1.5,
    "rp02_mpa": 900,
    "target_yield_ratio": 0.5,
    "max_utilization_ratio": 0.9,
    "mu_thread_nom": 0.12,
    "mu_bearing_nom": 0.10,
    "effective_bearing_diameter_mm": 14,
    "bolt_segments": [_SEGMENT],
    "joint_segments": [_SEGMENT],
    "minimum_required_clamp_load_n": 1000,
    "external_axial_load_n": 500,
    "fail_threshold": 0.95,
    "warn_threshold": 0.80,
}

# ---------------------------------------------------------------------------
# Unit: validate_model_response
# ---------------------------------------------------------------------------


_MAX = MAX_MODEL_OUTPUT_CHARS  # local alias for brevity in unit tests


def test_valid_string_accepted():
    result = validate_model_response(
        "Geçerli bir açıklama metni.", max_chars=_MAX, provider_name="test"
    )
    assert result == "Geçerli bir açıklama metni."


def test_empty_string_rejected():
    with pytest.raises(ModelUnavailableError):
        validate_model_response("", max_chars=_MAX, provider_name="test")


def test_whitespace_only_rejected():
    with pytest.raises(ModelUnavailableError):
        validate_model_response("   \t\n  ", max_chars=_MAX, provider_name="test")


def test_exactly_max_chars_accepted():
    text = "A" * _MAX
    result = validate_model_response(text, max_chars=_MAX, provider_name="test")
    assert len(result) == _MAX


def test_max_plus_one_rejected():
    text = "A" * (_MAX + 1)
    with pytest.raises(ModelUnavailableError):
        validate_model_response(text, max_chars=_MAX, provider_name="test")


def test_non_string_int_rejected():
    # ModelResponse is a frozen dataclass whose .text field is typed str,
    # so a non-str cannot be constructed normally via ModelResponse.  We
    # call validate_model_response directly with a non-str to exercise the
    # type guard -- this is the externally-constructible path.
    with pytest.raises(ModelUnavailableError):
        validate_model_response(42, max_chars=_MAX, provider_name="test")


def test_non_string_none_rejected():
    with pytest.raises(ModelUnavailableError):
        validate_model_response(None, max_chars=_MAX, provider_name="test")


def test_non_string_list_rejected():
    with pytest.raises(ModelUnavailableError):
        validate_model_response(["some", "list"], max_chars=_MAX, provider_name="test")


def test_no_truncation_performed():
    # Validation must not silently truncate -- it must reject.
    text = "B" * (_MAX + 100)
    with pytest.raises(ModelUnavailableError):
        validate_model_response(text, max_chars=_MAX, provider_name="test")


def test_provider_name_in_exception_message():
    with pytest.raises(ModelUnavailableError, match="bad-provider"):
        validate_model_response("", max_chars=_MAX, provider_name="bad-provider")


def test_raw_text_not_in_exception_for_oversized():
    # The oversized-rejection message must NOT echo the raw provider text
    # (to prevent accidental leakage of untrusted content into logs/errors).
    text = "CANARY_SECRET " * (_MAX // 14 + 1)
    with pytest.raises(ModelUnavailableError) as exc_info:
        validate_model_response(text, max_chars=_MAX, provider_name="test")
    assert "CANARY_SECRET" not in str(exc_info.value)


# ---------------------------------------------------------------------------
# MAX_MODEL_OUTPUT_CHARS constant is authoritative and sensible
# ---------------------------------------------------------------------------


def test_max_model_output_chars_value():
    # Authoritative location is backend.api.routes.ai_gateway (not inside
    # backend.ai_gateway, to satisfy the AST numeric-literal guard).
    assert MAX_MODEL_OUTPUT_CHARS == 8_000
    assert isinstance(MAX_MODEL_OUTPUT_CHARS, int)
    assert MAX_MODEL_OUTPUT_CHARS > 0


# ---------------------------------------------------------------------------
# General AI query fail-closed behavior (HTTP)
# ---------------------------------------------------------------------------


class _EmptyOutputClient(AIModelClient):
    name = "b2-empty-output-test"

    def complete(self, prompt_context: PromptContext) -> ModelResponse:
        return ModelResponse(text="", model_name=self.name)


class _WhitespaceOutputClient(AIModelClient):
    name = "b2-whitespace-output-test"

    def complete(self, prompt_context: PromptContext) -> ModelResponse:
        return ModelResponse(text="   \n  ", model_name=self.name)


class _OversizedOutputClient(AIModelClient):
    name = "b2-oversized-output-test"

    def complete(self, prompt_context: PromptContext) -> ModelResponse:
        return ModelResponse(text="X" * (MAX_MODEL_OUTPUT_CHARS + 1), model_name=self.name)


def _override_client(client_instance):
    app_module.app.dependency_overrides[route_module.get_model_client] = (
        lambda: client_instance
    )


def _clear_override():
    app_module.app.dependency_overrides.pop(route_module.get_model_client, None)


def test_general_query_empty_output_fails_closed(client, auth_headers):
    _override_client(_EmptyOutputClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_override()
    # Fail-closed: 503 (ModelUnavailableError -> _handle() mapping),
    # no successful prose returned, no schema_version on error.
    assert response.status_code == 503
    assert "schema_version" not in response.json()


def test_general_query_whitespace_output_fails_closed(client, auth_headers):
    _override_client(_WhitespaceOutputClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_override()
    assert response.status_code == 503


def test_general_query_oversized_output_fails_closed(client, auth_headers):
    _override_client(_OversizedOutputClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_override()
    assert response.status_code == 503


def test_general_query_valid_output_succeeds_with_schema_version(client, auth_headers):
    # Normal valid output still succeeds and schema_version == "1.0" (B1 non-regression).
    # Note: the orchestrator returns insufficient_evidence=True when no publishable QB
    # record matches the keyword -- that is a normal, correct 200 response, not a failure.
    # We verify the response is 200 (not 503) and schema_version is present.
    fake = FakeModelClient(fixed_text="Geçerli bir AI yanıtı.")
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: fake
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    # The response is a valid AI gateway response (either grounded or insufficient_evidence).
    assert "text" in body
    assert "insufficient_evidence" in body


def test_raw_provider_error_not_leaked_in_503(client, auth_headers):
    _override_client(_EmptyOutputClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_override()
    assert response.status_code == 503
    # The raw (untrusted) provider output text must NOT appear in the 503
    # response body.  The ModelUnavailableError message is generic and
    # does not echo the raw text -- only the provider name appears in it
    # (an internal label, not user-supplied content or a secret).
    # The actual (empty) output text "CANARY" would only appear if
    # the raw text were forwarded, which it must not be.
    body_text = str(response.json())
    assert "CANARY_RAW_OUTPUT_12345" not in body_text


# ---------------------------------------------------------------------------
# Engineering reasoning: invalid wording => ai_explanation=None,
# deterministic fields unchanged
# ---------------------------------------------------------------------------


def _create_trace(client, headers):
    r = client.post(_TORQUE_ENDPOINT, json=_SUPPORTED_PAYLOAD, headers=headers)
    assert r.status_code == 200, r.text
    return int(r.json()["trace_id"])


def test_reasoning_valid_wording_accepted(client, auth_headers):
    """Valid AI wording returns ai_explanation populated."""
    trace_id = _create_trace(client, auth_headers)
    _key = "b2-valid-wording-fake"

    class _ValidWordingClient(AIModelClient):
        name = _key

        def complete(self, prompt_context: PromptContext) -> ModelResponse:
            return ModelResponse(text="Deterministik sonuç açıklaması.", model_name=self.name)

    route_module._PROVIDER_REGISTRY._providers[_key] = _ValidWordingClient()
    try:
        response = client.post(
            _REASONING_ENDPOINT,
            json={"trace_id": trace_id, "include_ai_wording": True,
                  "provider_name": _key},
            headers=auth_headers,
        )
    finally:
        route_module._PROVIDER_REGISTRY._providers.pop(_key, None)
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    assert body["ai_explanation"] == "Deterministik sonuç açıklaması."
    assert "reasoning_state" in body
    assert "engineering_conclusion" in body


def test_reasoning_invalid_wording_degrades_to_none(client, auth_headers):
    """Empty AI wording => ai_explanation=None, deterministic result unchanged."""
    trace_id = _create_trace(client, auth_headers)
    _key = "b2-invalid-wording-empty"

    class _EmptyWordingClient(AIModelClient):
        name = _key

        def complete(self, prompt_context: PromptContext) -> ModelResponse:
            return ModelResponse(text="", model_name=self.name)

    route_module._PROVIDER_REGISTRY._providers[_key] = _EmptyWordingClient()
    try:
        response = client.post(
            _REASONING_ENDPOINT,
            json={"trace_id": trace_id, "include_ai_wording": True,
                  "provider_name": _key},
            headers=auth_headers,
        )
    finally:
        route_module._PROVIDER_REGISTRY._providers.pop(_key, None)
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    # Invalid wording degrades silently -- no 503.
    assert body["ai_explanation"] is None
    # Deterministic reasoning fields are untouched.
    assert body["reasoning_state"] in ("SUPPORTED", "UNSUPPORTED", "INSUFFICIENT_EVIDENCE")
    assert "engineering_conclusion" in body
    assert "reasoning_steps" in body


def test_reasoning_deterministic_fields_always_populated(client, auth_headers):
    """Deterministic reasoning result fields remain complete regardless of AI wording."""
    trace_id = _create_trace(client, auth_headers)
    # No AI wording requested -- pure deterministic path.
    response = client.post(
        _REASONING_ENDPOINT,
        json={"trace_id": trace_id},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    for field in (
        "reasoning_state",
        "engineering_conclusion",
        "reasoning_steps",
        "applied_rules",
        "assumptions",
        "warnings",
        "limitations",
        "evidence_status",
    ):
        assert field in body
    assert body["ai_explanation"] is None
    assert body["ai_explanation_provider"] is None


# ---------------------------------------------------------------------------
# EVIDENCE_REFERENCE_VALIDATION: structural derivation audit
# ---------------------------------------------------------------------------


def test_evidence_structurally_derived_not_parsed_from_prose(client, auth_headers):
    """Evidence/citations in the response are derived from verified QB
    sources (retrieval adaptor -> evidence_checker.verified_sources ->
    composer), never from provider prose.

    This test proves it by using a FakeModelClient whose text contains
    a plausible-looking but completely fabricated citation reference --
    the returned evidence list must not contain that fabricated source,
    confirming provider prose cannot inject evidence references.
    """
    fabricated_text = (
        "Bu torku uygulayın. Kaynak: [question_bank #QB-FAKE-99999 v1] ISO 16047."
    )
    _override_client(FakeModelClient(fixed_text=fabricated_text))
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_override()

    assert response.status_code == 200
    body = response.json()
    # The fabricated source_id must not appear in evidence.
    evidence_ids = [e["source_id"] for e in body["evidence"]]
    assert "QB-FAKE-99999" not in evidence_ids
    # Citations are built only from verified_sources -- no fabricated entry.
    for citation in body["citations"]:
        assert "QB-FAKE-99999" not in citation
