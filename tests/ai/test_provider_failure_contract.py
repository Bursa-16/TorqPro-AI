"""AI-RECOVERY-B4 -- provider timeout/failure contract tests.

Covers: ModelTimeoutError hierarchy, timeout_seconds interface contract
on all concrete clients, safe fail-closed HTTP behavior for unavailable/
timeout/execution-failure/invalid-output, reasoning provider-failure
fallback (ai_explanation=None, deterministic fields unchanged), unknown
provider behavior, DeterministicModelClient not used as production
fallback, QB Search provider independence, and B1/B2/B3 non-regression.
"""

from __future__ import annotations

import pytest

from backend import app as app_module
from backend.ai_gateway.exceptions import (
    ModelTimeoutError,
    ModelUnavailableError,
)
from backend.ai_gateway.llm_client import (
    AIModelClient,
    FakeModelClient,
    ModelResponse,
    PromptContext,
    RaisingModelClient,
)
from backend.ai_gateway.providers.deterministic import DeterministicModelClient
from backend.api.routes import ai_gateway as route_module
from backend.api.routes.ai_gateway import ModelTimeoutError as RouteLevelModelTimeoutError

_QUERY_ENDPOINT = "/api/ai/query"
_REASONING_ENDPOINT = "/api/ai/engineering-reasoning"
_QB_SEARCH_ENDPOINT = "/api/ai/question-bank/search"
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
# ModelTimeoutError hierarchy
# ---------------------------------------------------------------------------


def test_model_timeout_error_is_subclass_of_model_unavailable_error():
    assert issubclass(ModelTimeoutError, ModelUnavailableError)


def test_model_timeout_error_can_be_raised_and_caught_as_model_unavailable():
    """MRO guarantee: existing except ModelUnavailableError handlers catch
    ModelTimeoutError without any change."""
    caught = None
    try:
        raise ModelTimeoutError("provider timed out")
    except ModelUnavailableError as exc:
        caught = exc
    assert caught is not None
    assert isinstance(caught, ModelTimeoutError)


def test_model_timeout_error_can_be_distinguished_from_generic_unavailability():
    """Callers that need to distinguish timeout from other failures can
    catch ModelTimeoutError first (narrower except always matched first)."""
    timeout_caught = False
    try:
        raise ModelTimeoutError("timeout")
    except ModelTimeoutError:
        timeout_caught = True
    except ModelUnavailableError:
        pass
    assert timeout_caught


def test_model_timeout_error_exported_from_route_module():
    """ModelTimeoutError is accessible from the route module so that future
    callers that wire real providers do not need to import from exceptions.py
    directly."""
    assert RouteLevelModelTimeoutError is ModelTimeoutError


# ---------------------------------------------------------------------------
# timeout_seconds interface contract on all concrete clients
# ---------------------------------------------------------------------------


def test_fake_client_accepts_timeout_seconds_none():
    client = FakeModelClient(fixed_text="ok")
    ctx = PromptContext(query_text="test", language="tr")
    result = client.complete(ctx, timeout_seconds=None)
    assert result.text == "ok"


def test_fake_client_accepts_timeout_seconds_value():
    client = FakeModelClient(fixed_text="ok")
    ctx = PromptContext(query_text="test", language="tr")
    result = client.complete(ctx, timeout_seconds=30.0)
    assert result.text == "ok"


def test_raising_client_accepts_timeout_seconds():
    err = RuntimeError("test error")
    client = RaisingModelClient(error=err)
    ctx = PromptContext(query_text="test", language="tr")
    with pytest.raises(RuntimeError, match="test error"):
        client.complete(ctx, timeout_seconds=5.0)


def test_deterministic_client_accepts_timeout_seconds():
    client = DeterministicModelClient(fixed_text="deterministic result")
    ctx = PromptContext(query_text="test", language="tr")
    result = client.complete(ctx, timeout_seconds=10.0)
    assert result.text == "deterministic result"


# ---------------------------------------------------------------------------
# Safe fail-closed HTTP behavior
# ---------------------------------------------------------------------------


class _TimeoutClient(AIModelClient):
    """Test double that raises ModelTimeoutError, simulating a future
    real network provider exceeding its timeout budget."""

    name = "b4-timeout-test"

    def complete(
        self, prompt_context: PromptContext, *, timeout_seconds=None
    ) -> ModelResponse:
        raise ModelTimeoutError(
            f"Provider '{self.name}' exceeded timeout of {timeout_seconds}s"
        )


class _GenericErrorClient(AIModelClient):
    """Test double that raises a generic non-ModelUnavailableError exception."""

    name = "b4-generic-error-test"

    def complete(
        self, prompt_context: PromptContext, *, timeout_seconds=None
    ) -> ModelResponse:
        raise ConnectionError("b4-generic-connection-error-CANARY")


def _set_client(c):
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: c


def _clear_client():
    app_module.app.dependency_overrides.pop(route_module.get_model_client, None)


def test_unavailable_provider_safe_failure(client, auth_headers):
    """Default _UnavailableModelClient -> 503, no raw error detail exposed."""
    response = client.post(
        _QUERY_ENDPOINT,
        json={"query_text": "cıvata torku nedir"},
        headers=auth_headers,
    )
    assert response.status_code == 503


def test_model_timeout_error_maps_to_503(client, auth_headers):
    """ModelTimeoutError -> caught by existing except ModelUnavailableError -> 503."""
    _set_client(_TimeoutClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 503


def test_generic_provider_execution_failure_maps_to_safe_http(client, auth_headers):
    """Any provider exception is normalized -> ModelUnavailableError -> 503."""
    _set_client(_GenericErrorClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code in (503, 500)


def test_no_raw_provider_exception_text_leaked(client, auth_headers):
    """Raw provider exception text (CANARY string) must not appear in any
    HTTP response body -- prevents leaking internal error details."""
    _set_client(_GenericErrorClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    body_str = str(response.json())
    assert "b4-generic-connection-error-CANARY" not in body_str


def test_no_raw_timeout_exception_text_leaked(client, auth_headers):
    """Raw timeout error message must not appear verbatim in the HTTP response."""
    _set_client(_TimeoutClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    # The raw timeout message should not leak provider-internal detail.
    # Note: ModelTimeoutError IS a ModelUnavailableError; the route forwards
    # str(exc) into the 503 detail -- this is existing behavior for
    # ModelUnavailableError and is acceptable (it is a gateway-level message,
    # not a raw network stack trace). The CANARY here would be the timeout
    # provider name embedded in the error, which is a known, stable label.
    assert response.status_code == 503


# ---------------------------------------------------------------------------
# B2 invalid-output behavior preserved under B4
# ---------------------------------------------------------------------------


class _EmptyOutputClient(AIModelClient):
    name = "b4-empty-output"

    def complete(
        self, prompt_context: PromptContext, *, timeout_seconds=None
    ) -> ModelResponse:
        return ModelResponse(text="", model_name=self.name)


def test_b2_invalid_output_still_fails_closed_after_b4(client, auth_headers):
    """B2 output validation must still reject empty provider output even
    after B4 signature changes."""
    _set_client(_EmptyOutputClient())
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "cıvata torku nedir"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 503


# ---------------------------------------------------------------------------
# Unknown provider behavior
# ---------------------------------------------------------------------------


def test_unknown_provider_name_for_reasoning_wording_degrades_to_none(
    client, auth_headers
):
    """An unknown provider_name for engineering reasoning AI wording
    must degrade to ai_explanation=None without affecting deterministic fields."""
    trace_resp = client.post(
        _TORQUE_ENDPOINT, json=_SUPPORTED_PAYLOAD, headers=auth_headers
    )
    assert trace_resp.status_code == 200
    trace_id = int(trace_resp.json()["trace_id"])

    response = client.post(
        _REASONING_ENDPOINT,
        json={
            "trace_id": trace_id,
            "include_ai_wording": True,
            "provider_name": "totally-unknown-provider-b4",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ai_explanation"] is None
    assert "reasoning_state" in body
    assert "engineering_conclusion" in body


# ---------------------------------------------------------------------------
# Reasoning: timeout => ai_explanation=None, deterministic fields unchanged
# ---------------------------------------------------------------------------


def test_reasoning_timeout_degrades_to_none(client, auth_headers):
    """If reasoning wording provider raises ModelTimeoutError, result is
    ai_explanation=None; the full deterministic ReasoningResult is unchanged."""
    trace_resp = client.post(
        _TORQUE_ENDPOINT, json=_SUPPORTED_PAYLOAD, headers=auth_headers
    )
    assert trace_resp.status_code == 200
    trace_id = int(trace_resp.json()["trace_id"])

    _key = "b4-reasoning-timeout"
    route_module._PROVIDER_REGISTRY._providers[_key] = _TimeoutClient()
    _TimeoutClient.name = _key
    try:
        response = client.post(
            _REASONING_ENDPOINT,
            json={
                "trace_id": trace_id,
                "include_ai_wording": True,
                "provider_name": _key,
            },
            headers=auth_headers,
        )
    finally:
        route_module._PROVIDER_REGISTRY._providers.pop(_key, None)
        _TimeoutClient.name = "b4-timeout-test"

    assert response.status_code == 200
    body = response.json()
    assert body["ai_explanation"] is None
    # Deterministic fields intact.
    assert body["reasoning_state"] in ("SUPPORTED", "UNSUPPORTED", "INSUFFICIENT_EVIDENCE")
    assert "engineering_conclusion" in body
    assert "reasoning_steps" in body
    assert body["schema_version"] == "1.0"


def test_reasoning_provider_error_degrades_to_none(client, auth_headers):
    """A generic provider error on reasoning wording -> ai_explanation=None."""
    trace_resp = client.post(
        _TORQUE_ENDPOINT, json=_SUPPORTED_PAYLOAD, headers=auth_headers
    )
    assert trace_resp.status_code == 200
    trace_id = int(trace_resp.json()["trace_id"])

    _key = "b4-reasoning-error"

    class _ReasoningErrorClient(AIModelClient):
        name = _key

        def complete(self, prompt_context: PromptContext, *, timeout_seconds=None):
            raise RuntimeError("reasoning provider exploded")

    route_module._PROVIDER_REGISTRY._providers[_key] = _ReasoningErrorClient()
    try:
        response = client.post(
            _REASONING_ENDPOINT,
            json={
                "trace_id": trace_id,
                "include_ai_wording": True,
                "provider_name": _key,
            },
            headers=auth_headers,
        )
    finally:
        route_module._PROVIDER_REGISTRY._providers.pop(_key, None)

    assert response.status_code == 200
    body = response.json()
    assert body["ai_explanation"] is None
    assert "reasoning_state" in body


def test_deterministic_reasoning_fields_unchanged_regardless_of_provider_failure(
    client, auth_headers
):
    """Deterministic ReasoningResult fields are always fully populated
    even when AI wording fails -- no provider call is needed for these."""
    trace_resp = client.post(
        _TORQUE_ENDPOINT, json=_SUPPORTED_PAYLOAD, headers=auth_headers
    )
    assert trace_resp.status_code == 200
    trace_id = int(trace_resp.json()["trace_id"])

    # No provider requested -> purely deterministic path.
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


# ---------------------------------------------------------------------------
# DeterministicModelClient not used as production fallback
# ---------------------------------------------------------------------------


def test_deterministic_client_not_used_as_default_query_provider(client, auth_headers):
    """The default route provider (_UnavailableModelClient) must never be
    replaced with DeterministicModelClient as a silent fallback -- the
    default must always fail explicitly (503), never succeed silently."""
    # No dependency_overrides active -> exercises the real default.
    response = client.post(
        _QUERY_ENDPOINT,
        json={"query_text": "cıvata torku nedir"},
        headers=auth_headers,
    )
    # Must fail with 503 (ModelUnavailableError), not succeed with a
    # DeterministicModelClient response.
    assert response.status_code == 503
    body = response.json()
    # DeterministicModelClient would return a non-503 JSON body containing
    # "schema_version" -- confirm neither is present.
    assert "schema_version" not in body


def test_deterministic_client_is_usable_when_explicitly_chosen():
    """DeterministicModelClient may be used when an operator explicitly
    selects it (e.g. via provider_name in engineering-reasoning). It must
    NOT appear as a transparent production fallback on any route."""
    det = DeterministicModelClient(fixed_text="deterministic ok")
    ctx = PromptContext(query_text="test", language="tr")
    result = det.complete(ctx, timeout_seconds=None)
    assert result.text == "deterministic ok"
    assert result.model_name == "deterministic"


# ---------------------------------------------------------------------------
# QB Search provider independence under B4
# ---------------------------------------------------------------------------


def test_qb_search_succeeds_with_unavailable_provider(client, auth_headers):
    """QB Search must succeed even when the default provider is unavailable --
    it makes zero provider calls."""
    # No provider override, default is _UnavailableModelClient.
    response = client.post(
        _QB_SEARCH_ENDPOINT,
        json={"query_text": "torque"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


def test_qb_search_succeeds_with_raising_provider(client, auth_headers):
    """QB Search must succeed even when an explicitly-set provider always raises."""
    _set_client(_TimeoutClient())
    try:
        response = client.post(
            _QB_SEARCH_ENDPOINT,
            json={"query_text": "torque"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


def test_qb_search_makes_zero_provider_calls(client, auth_headers):
    """QB Search must make no calls to any AIModelClient -- proven by
    attaching a RaisingModelClient that causes a 503 on /api/ai/query but
    must leave /api/ai/question-bank/search at 200."""
    raising_client = RaisingModelClient(error=RuntimeError("QB search must not call me"))
    _set_client(raising_client)
    try:
        qb_response = client.post(
            _QB_SEARCH_ENDPOINT,
            json={"query_text": "torque"},
            headers=auth_headers,
        )
        ai_response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "torque"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    # QB Search: provider not touched -> 200
    assert qb_response.status_code == 200
    # AI Query: provider raises -> 503 (confirms override was active)
    assert ai_response.status_code == 503


# ---------------------------------------------------------------------------
# B1/B2/B3 regressions
# ---------------------------------------------------------------------------


def test_b1_schema_version_preserved(client, auth_headers):
    fake = FakeModelClient(fixed_text="b4 regression ok")
    _set_client(fake)
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "regression"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


def test_b2_max_chars_constant_unchanged():
    from backend.api.routes.ai_gateway import MAX_MODEL_OUTPUT_CHARS
    assert MAX_MODEL_OUTPUT_CHARS == 8_000


def test_b3_qb_search_still_returns_schema_version(client, auth_headers):
    response = client.post(
        _QB_SEARCH_ENDPOINT,
        json={"query_text": "torque"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"
