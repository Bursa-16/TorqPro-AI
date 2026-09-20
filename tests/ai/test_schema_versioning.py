"""AI-RECOVERY-B1 -- ``schema_version`` on successful AI gateway
responses only.

Covers ``POST /api/ai/query`` and ``POST /api/ai/engineering-reasoning``
(``backend/api/routes/ai_gateway.py``). Deliberately narrow: this file
only proves the new top-level ``schema_version`` field appears on
success, that it does not appear on error responses, and that no
existing field/nesting was disturbed -- it does not re-test the full
happy-path bodies already covered by ``tests/ai/test_http_route.py``
and ``tests/ai/reasoning/test_http_route_reasoning.py``.

Uses the same shared ``client``/``auth_headers``/``login_as`` fixtures
and ``dependency_overrides`` pattern already established by those two
files.
"""

from __future__ import annotations

import uuid

from backend import app as app_module
from backend.ai_gateway.llm_client import FakeModelClient
from backend.api.routes import ai_gateway as route_module

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


def test_ai_schema_version_constant_is_one_point_zero():
    assert route_module.AI_SCHEMA_VERSION == "1.0"


def test_query_success_response_includes_schema_version(client, auth_headers):
    fake = FakeModelClient(fixed_text="AI-RECOVERY-B1 test response.")
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: fake
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata sıkma torku nedir"},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]

    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    # Existing fields/nesting are untouched by this recovery phase.
    for field in (
        "text",
        "insufficient_evidence",
        "result_label",
        "validation_required",
        "model_name",
        "citations",
        "evidence",
        "calculation_result",
    ):
        assert field in body


def test_query_error_response_does_not_gain_schema_version(
    client, auth_headers, monkeypatch
):
    # v3.2.0: the production default falls back to the deterministic
    # provider, so the 503 error path requires a registry with no
    # query-capable provider at all (explicit fail-closed path).  Error
    # responses must still never gain a schema_version field.
    from backend.ai_gateway.providers.registry import ProviderRegistry

    monkeypatch.setattr(route_module, "_PROVIDER_REGISTRY", ProviderRegistry())
    response = client.post(
        _QUERY_ENDPOINT,
        json={"query_text": "cıvata sıkma torku nedir"},
        headers=auth_headers,
    )
    assert response.status_code == 503
    assert "schema_version" not in response.json()


def test_query_validation_error_response_does_not_gain_schema_version(client, auth_headers):
    response = client.post(_QUERY_ENDPOINT, json={"query_text": "   "}, headers=auth_headers)
    assert response.status_code == 400
    assert "schema_version" not in response.json()


def test_reasoning_success_response_includes_schema_version(client, auth_headers):
    trace_response = client.post(_TORQUE_ENDPOINT, json=_SUPPORTED_PAYLOAD, headers=auth_headers)
    assert trace_response.status_code == 200, trace_response.text
    trace_id = int(trace_response.json()["trace_id"])

    response = client.post(
        _REASONING_ENDPOINT,
        json={"trace_id": trace_id},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    # Existing fields are untouched by this recovery phase.
    for field in (
        "trace_id",
        "reasoning_state",
        "engineering_conclusion",
        "reasoning_steps",
        "applied_rules",
        "assumptions",
        "warnings",
        "limitations",
        "evidence_status",
        "result_label",
        "ai_explanation",
        "ai_explanation_provider",
        "reasoning_trace_id",
    ):
        assert field in body


def test_reasoning_unknown_trace_id_error_does_not_gain_schema_version(client, auth_headers):
    unknown_trace_id = 2_147_000_000 + uuid.uuid4().int % 1000
    response = client.post(
        _REASONING_ENDPOINT,
        json={"trace_id": unknown_trace_id},
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert "schema_version" not in response.json()
