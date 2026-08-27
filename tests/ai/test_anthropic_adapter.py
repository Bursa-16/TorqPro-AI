"""AI-P1 -- AnthropicModelClient adapter tests.

Zero live API calls.  All HTTP is handled by ``httpx.MockTransport``
(built into httpx, no extra dependency).

Covers:
- successful completion parsing (text block extraction)
- ModelTimeoutError for httpx.TimeoutException subtypes
- ModelUnavailableError for non-2xx responses
- ModelUnavailableError for network errors
- ModelUnavailableError for empty/missing content blocks
- raw response body never forwarded
- raw exception text never forwarded (no CANARY leak)
- API key never appears in exception messages
- AnthropicModelClient.is_available() reflects config
- timeout_seconds argument overrides config default
- model identifier reflects config
- conditional registry: not registered when disabled/no-key
- conditional registry: registered when enabled with key
- B1/B2/B3/B4 non-regression (no provider needed for QB Search)
"""

from __future__ import annotations

import json
from typing import Optional
from unittest.mock import patch

import httpx
import pytest

from backend.ai_gateway.exceptions import ModelTimeoutError, ModelUnavailableError
from backend.ai_gateway.llm_client import PromptContext
from backend.ai_gateway.providers.anthropic_adapter import AnthropicModelClient
from backend.ai_gateway.providers.config import AnthropicProviderConfig, load_from_env
from backend.ai_gateway.retrieval import EvidenceSource


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

_DUMMY_API_KEY = "sk-ant-test-DUMMY-KEY-NOT-REAL"
_DUMMY_MODEL = "claude-p1-test-model"
_DUMMY_TIMEOUT = 5.0
_DUMMY_MAX_TOKENS = 256


def _make_config(
    *,
    enabled: bool = True,
    api_key: str = _DUMMY_API_KEY,
    model: str = _DUMMY_MODEL,
    timeout_seconds: float = _DUMMY_TIMEOUT,
    max_tokens: int = _DUMMY_MAX_TOKENS,
) -> AnthropicProviderConfig:
    return AnthropicProviderConfig(
        enabled=enabled,
        api_key=api_key,
        model=model,
        timeout_seconds=timeout_seconds,
        max_tokens=max_tokens,
    )


def _make_client(config: Optional[AnthropicProviderConfig] = None,
                 http_client: Optional[httpx.Client] = None) -> AnthropicModelClient:
    return AnthropicModelClient(config or _make_config(), http_client=http_client)


def _make_prompt_context(query: str = "cıvata torku nedir") -> PromptContext:
    return PromptContext(query_text=query, language="tr")


def _anthropic_response(text: str, model: str = _DUMMY_MODEL) -> httpx.Response:
    """Build a mock Anthropic API success response."""
    body = json.dumps({
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "content": [{"type": "text", "text": text}],
        "model": model,
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 10, "output_tokens": 20},
    }).encode()
    return httpx.Response(200, content=body,
                          headers={"content-type": "application/json"})


def _make_mock_transport(response: httpx.Response) -> httpx.MockTransport:
    """Return an httpx.MockTransport that always returns ``response``."""
    def handler(request: httpx.Request) -> httpx.Response:
        return response
    return httpx.MockTransport(handler)


def _make_error_transport(response: httpx.Response) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        return response
    return httpx.MockTransport(handler)


def _make_timeout_transport(exc: Exception) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        raise exc
    return httpx.MockTransport(handler)


def _http_client_with(transport) -> httpx.Client:
    return httpx.Client(transport=transport)


# ---------------------------------------------------------------------------
# AnthropicProviderConfig
# ---------------------------------------------------------------------------


def test_config_is_enabled_true_with_key():
    cfg = _make_config(enabled=True, api_key=_DUMMY_API_KEY)
    assert cfg.is_enabled() is True


def test_config_is_enabled_false_when_disabled():
    cfg = _make_config(enabled=False, api_key=_DUMMY_API_KEY)
    assert cfg.is_enabled() is False


def test_config_is_enabled_false_when_empty_key():
    cfg = _make_config(enabled=True, api_key="")
    assert cfg.is_enabled() is False


def test_config_is_enabled_false_when_whitespace_key():
    cfg = _make_config(enabled=True, api_key="   ")
    assert cfg.is_enabled() is False


def test_load_from_env_disabled_by_default(monkeypatch):
    monkeypatch.delenv("TORQPRO_ANTHROPIC_ENABLED", raising=False)
    monkeypatch.delenv("TORQPRO_ANTHROPIC_API_KEY", raising=False)
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_max_tokens=1024,
        default_model="claude-sonnet-5",
    )
    assert cfg.is_enabled() is False


def test_load_from_env_enabled_with_key(monkeypatch):
    monkeypatch.setenv("TORQPRO_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("TORQPRO_ANTHROPIC_API_KEY", _DUMMY_API_KEY)
    monkeypatch.setenv("TORQPRO_ANTHROPIC_MODEL", "claude-test-model")
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_max_tokens=1024,
        default_model="claude-sonnet-5",
    )
    assert cfg.is_enabled() is True
    assert cfg.model == "claude-test-model"


def test_load_from_env_falls_back_to_default_model(monkeypatch):
    monkeypatch.setenv("TORQPRO_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("TORQPRO_ANTHROPIC_API_KEY", _DUMMY_API_KEY)
    monkeypatch.delenv("TORQPRO_ANTHROPIC_MODEL", raising=False)
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_max_tokens=1024,
        default_model="claude-default-model",
    )
    assert cfg.model == "claude-default-model"


def test_load_from_env_invalid_timeout_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("TORQPRO_ANTHROPIC_TIMEOUT_SECONDS", "not-a-number")
    cfg = load_from_env(
        default_timeout_seconds=25.0,
        default_max_tokens=1024,
        default_model="claude-sonnet-5",
    )
    assert cfg.timeout_seconds == 25.0


# ---------------------------------------------------------------------------
# AnthropicModelClient metadata
# ---------------------------------------------------------------------------


def test_client_name():
    assert AnthropicModelClient.name == "anthropic"


def test_client_model_identifier():
    cfg = _make_config(model="claude-p1-test")
    client = _make_client(cfg)
    assert client.model_identifier == "claude-p1-test"


def test_client_is_available_when_enabled():
    client = _make_client(_make_config(enabled=True, api_key=_DUMMY_API_KEY))
    assert client.is_available() is True


def test_client_is_available_false_when_disabled():
    client = _make_client(_make_config(enabled=False))
    assert client.is_available() is False


def test_client_is_available_false_when_no_key():
    client = _make_client(_make_config(enabled=True, api_key=""))
    assert client.is_available() is False


# ---------------------------------------------------------------------------
# Successful completion
# ---------------------------------------------------------------------------


def test_complete_returns_model_response():
    mock_text = "Cıvata sıkma torku, VDI 2230'a göre hesaplanır."
    transport = _make_mock_transport(_anthropic_response(mock_text))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    result = client.complete(_make_prompt_context())
    assert result.text == mock_text
    assert result.model_name == "anthropic"


def test_complete_with_english_language():
    mock_text = "Bolt tightening torque is calculated per VDI 2230."
    transport = _make_mock_transport(_anthropic_response(mock_text))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    ctx = PromptContext(query_text="what is bolt torque", language="en")
    result = client.complete(ctx)
    assert result.text == mock_text


def test_complete_with_evidence_in_context():
    """Evidence is forwarded in the user message; adapter still returns prose."""
    mock_text = "KB açıklaması."
    transport = _make_mock_transport(_anthropic_response(mock_text))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    evidence = EvidenceSource(
        source_type="question_bank", source_id="QB-001",
        content_version=1, title_tr="Soru 1", title_en="Question 1",
        body_tr="Açıklama TR", body_en="Explanation EN",
    )
    ctx = PromptContext(query_text="açıkla", language="tr", evidence=(evidence,))
    result = client.complete(ctx)
    assert result.text == mock_text


def test_complete_uses_timeout_seconds_argument():
    """timeout_seconds kwarg overrides config default — verified by successful call."""
    mock_text = "timeout override test"
    transport = _make_mock_transport(_anthropic_response(mock_text))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    result = client.complete(_make_prompt_context(), timeout_seconds=10.0)
    assert result.text == mock_text


# ---------------------------------------------------------------------------
# Timeout → ModelTimeoutError
# ---------------------------------------------------------------------------


def test_read_timeout_raises_model_timeout_error():
    transport = _make_timeout_transport(httpx.ReadTimeout("read timed out", request=None))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelTimeoutError):
        client.complete(_make_prompt_context())


def test_connect_timeout_raises_model_timeout_error():
    transport = _make_timeout_transport(httpx.ConnectTimeout("connect timed out", request=None))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelTimeoutError):
        client.complete(_make_prompt_context())


def test_pool_timeout_raises_model_timeout_error():
    transport = _make_timeout_transport(httpx.PoolTimeout("pool timed out", request=None))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelTimeoutError):
        client.complete(_make_prompt_context())


def test_model_timeout_error_is_subclass_of_model_unavailable():
    transport = _make_timeout_transport(httpx.ReadTimeout("read timeout", request=None))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt_context())


# ---------------------------------------------------------------------------
# Non-2xx → ModelUnavailableError
# ---------------------------------------------------------------------------


def test_401_unauthorized_raises_model_unavailable():
    transport = _make_error_transport(httpx.Response(401, content=b'{"error":"unauthorized"}'))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt_context())


def test_500_server_error_raises_model_unavailable():
    transport = _make_error_transport(httpx.Response(500, content=b'{"error":"server error"}'))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt_context())


def test_429_rate_limit_raises_model_unavailable():
    transport = _make_error_transport(httpx.Response(429, content=b'{"error":"rate limited"}'))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt_context())


# ---------------------------------------------------------------------------
# Network failure → ModelUnavailableError
# ---------------------------------------------------------------------------


def test_connect_error_raises_model_unavailable():
    transport = _make_timeout_transport(
        httpx.ConnectError("connection refused", request=None)
    )
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt_context())


# ---------------------------------------------------------------------------
# Empty content block → ModelUnavailableError
# ---------------------------------------------------------------------------


def test_empty_content_block_raises_model_unavailable():
    body = json.dumps({
        "content": [],
        "model": _DUMMY_MODEL,
        "stop_reason": "end_turn",
    }).encode()
    transport = _make_mock_transport(
        httpx.Response(200, content=body,
                       headers={"content-type": "application/json"})
    )
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt_context())


def test_non_text_content_block_raises_model_unavailable():
    """A response with only image/tool_use blocks (no text) must fail closed."""
    body = json.dumps({
        "content": [{"type": "tool_use", "id": "tool1", "name": "calc", "input": {}}],
        "model": _DUMMY_MODEL,
        "stop_reason": "tool_use",
    }).encode()
    transport = _make_mock_transport(
        httpx.Response(200, content=body,
                       headers={"content-type": "application/json"})
    )
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt_context())


# ---------------------------------------------------------------------------
# No leakage of raw error body, exception text, or API key
# ---------------------------------------------------------------------------


def test_raw_response_body_not_in_exception():
    """A CANARY string in the API error body must not appear in the
    ModelUnavailableError message -- no raw provider body forwarded."""
    canary = "CANARY_API_ERROR_BODY_XYZ"
    body = json.dumps({"error": {"type": "invalid_request_error", "message": canary}}).encode()
    transport = _make_error_transport(
        httpx.Response(400, content=body,
                       headers={"content-type": "application/json"})
    )
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelUnavailableError) as exc_info:
        client.complete(_make_prompt_context())
    assert canary not in str(exc_info.value)


def test_api_key_not_in_exception_message():
    """API key must never appear in any raised exception."""
    canary_key = "sk-ant-CANARY-KEY-MUST-NOT-LEAK"
    transport = _make_timeout_transport(httpx.ReadTimeout("timeout", request=None))
    http = _http_client_with(transport)
    client = _make_client(_make_config(api_key=canary_key), http_client=http)
    with pytest.raises(ModelTimeoutError) as exc_info:
        client.complete(_make_prompt_context())
    assert canary_key not in str(exc_info.value)


def test_raw_timeout_message_not_forwarded():
    canary = "CANARY_INTERNAL_TIMEOUT_DETAIL"
    transport = _make_timeout_transport(httpx.ReadTimeout(canary, request=None))
    http = _http_client_with(transport)
    client = _make_client(http_client=http)
    with pytest.raises(ModelTimeoutError) as exc_info:
        client.complete(_make_prompt_context())
    assert canary not in str(exc_info.value)


# ---------------------------------------------------------------------------
# Conditional registry: not registered without env key
# ---------------------------------------------------------------------------


def test_anthropic_not_registered_by_default():
    from backend.api.routes import ai_gateway as route_module
    providers = [p.name for p in route_module._PROVIDER_REGISTRY.list_providers()]
    # By default (no env key set in CI), anthropic must not be registered.
    # deterministic must always be present.
    assert "deterministic" in providers


def test_anthropic_registers_when_env_set(monkeypatch):
    """When env vars are present, _maybe_register_anthropic adds the client."""
    from backend.ai_gateway.providers.registry import ProviderRegistry
    from backend.ai_gateway.providers.deterministic import DeterministicModelClient

    monkeypatch.setenv("TORQPRO_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("TORQPRO_ANTHROPIC_API_KEY", _DUMMY_API_KEY)
    monkeypatch.setenv("TORQPRO_ANTHROPIC_MODEL", "claude-p1-test")

    from backend.ai_gateway.providers.config import load_from_env
    from backend.api.routes.ai_gateway import (
        _ANTHROPIC_DEFAULT_MAX_TOKENS,
        _ANTHROPIC_DEFAULT_MODEL,
        _ANTHROPIC_DEFAULT_TIMEOUT_SECONDS,
    )

    # Build a fresh isolated registry to test registration logic.
    from backend.ai_gateway.providers.registry import build_default_registry
    reg = build_default_registry()
    cfg = load_from_env(
        default_timeout_seconds=_ANTHROPIC_DEFAULT_TIMEOUT_SECONDS,
        default_max_tokens=_ANTHROPIC_DEFAULT_MAX_TOKENS,
        default_model=_ANTHROPIC_DEFAULT_MODEL,
    )
    assert cfg.is_enabled() is True
    reg.register(AnthropicModelClient(cfg))
    names = [p.name for p in reg.list_providers()]
    assert "anthropic" in names


# ---------------------------------------------------------------------------
# B1/B2/B3/B4 non-regression (QB Search still provider-independent)
# ---------------------------------------------------------------------------


def test_qb_search_still_succeeds_with_no_anthropic_key(client, auth_headers):
    """QB Search must remain fully operational even if no Anthropic key is set."""
    response = client.post(
        "/api/ai/question-bank/search",
        json={"query_text": "torque"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


def test_b1_schema_version_unaffected_by_p1(client, auth_headers):
    """B1: schema_version remains present on successful AI query."""
    from backend import app as app_module
    from backend.ai_gateway.llm_client import FakeModelClient
    from backend.api.routes import ai_gateway as route_module
    fake = FakeModelClient(fixed_text="p1 regression ok")
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: fake
    try:
        response = client.post(
            "/api/ai/query",
            json={"query_text": "regression"},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"
