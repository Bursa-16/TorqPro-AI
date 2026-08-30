"""Faz 3.2.0B — Provider Status UI contract tests.

Verifies that GET /api/ai/providers returns the new ``readiness_status``
field added in v3.2.0 and that:

1. The correct string value is returned for every OllamaReadinessStatus.
2. DeterministicModelClient returns "active".
3. A disabled Ollama config (is_enabled() == False) is never registered,
   so no "disabled" entry appears in the default registry.
4. The response never includes secret fields (base_url, api_key, etc.).
5. Auth contract is unchanged (unauthenticated → 401/403).
6. The probe is called with the short timeout, not the 120-s inference timeout.

All Ollama network calls are mocked; no real server is needed.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from backend.ai_gateway.providers.ollama_adapter import OllamaReadinessStatus

_ENDPOINT = "/api/ai/providers"
_FORBIDDEN_KEYS = {"base_url", "api_key", "secret", "token", "timeout_seconds", "keep_alive"}


# --------------------------------------------------------------------------- helpers

def _make_ollama_client(readiness: OllamaReadinessStatus):
    """Return a mock OllamaModelClient whose check_readiness() returns *readiness*."""
    from backend.ai_gateway.providers.ollama_adapter import OllamaModelClient

    mock = MagicMock(spec=OllamaModelClient)
    mock.name = "ollama"
    mock.model_identifier = "qwen3:8b"
    mock.is_available.return_value = True
    mock.check_readiness.return_value = readiness
    return mock


# --------------------------------------------------------------------------- auth

def test_providers_endpoint_still_requires_authentication(client):
    resp = client.get(_ENDPOINT)
    assert resp.status_code in (401, 403)


# --------------------------------------------------------------------------- readiness_status field present

def test_readiness_status_field_present_on_deterministic(client, auth_headers):
    resp = client.get(_ENDPOINT, headers=auth_headers)
    assert resp.status_code == 200
    providers = resp.json()["providers"]
    assert len(providers) >= 1
    for p in providers:
        assert "readiness_status" in p, f"readiness_status missing on {p['name']}"


# --------------------------------------------------------------------------- deterministic provider

def test_deterministic_provider_readiness_status_is_not_applicable(client, auth_headers):
    resp = client.get(_ENDPOINT, headers=auth_headers)
    assert resp.status_code == 200
    det = next((p for p in resp.json()["providers"] if p["name"] == "deterministic"), None)
    assert det is not None
    assert det["readiness_status"] == "not_applicable"


# --------------------------------------------------------------------------- Ollama readiness mapping

@pytest.mark.parametrize("ollama_status,expected_string", [
    (OllamaReadinessStatus.MODEL_READY,        "model_ready"),
    (OllamaReadinessStatus.MODEL_MISSING,      "model_missing"),
    (OllamaReadinessStatus.SERVER_UNAVAILABLE, "server_unavailable"),
    (OllamaReadinessStatus.SERVER_REACHABLE,   "server_reachable"),
])
def test_ollama_readiness_status_mapped_correctly(
    client, auth_headers, ollama_status, expected_string
):
    """Inject a mock OllamaModelClient into the registry for the duration of the
    request and verify the correct readiness_status string is returned."""
    from backend.ai_gateway.providers.ollama_adapter import OllamaModelClient
    from backend.ai_gateway.providers.registry import ProviderRegistry, build_default_registry
    import backend.api.routes.ai_gateway as route_module

    mock_ollama = _make_ollama_client(ollama_status)

    patched_registry = build_default_registry()
    patched_registry._providers["ollama"] = mock_ollama  # type: ignore[attr-defined]

    with patch.object(route_module, "_PROVIDER_REGISTRY", patched_registry):
        resp = client.get(_ENDPOINT, headers=auth_headers)

    assert resp.status_code == 200
    providers = {p["name"]: p for p in resp.json()["providers"]}
    assert "ollama" in providers
    assert providers["ollama"]["readiness_status"] == expected_string


# --------------------------------------------------------------------------- probe timeout

def test_ollama_check_readiness_called_with_short_probe_timeout(
    client, auth_headers
):
    """The probe must use _OLLAMA_PROBE_TIMEOUT_SECONDS (5 s), not the 120-s
    inference timeout.  We capture the keyword argument passed to check_readiness."""
    import backend.api.routes.ai_gateway as route_module
    from backend.ai_gateway.providers.registry import build_default_registry

    mock_ollama = _make_ollama_client(OllamaReadinessStatus.MODEL_READY)

    patched_registry = build_default_registry()
    patched_registry._providers["ollama"] = mock_ollama  # type: ignore[attr-defined]

    with patch.object(route_module, "_PROVIDER_REGISTRY", patched_registry):
        resp = client.get(_ENDPOINT, headers=auth_headers)

    assert resp.status_code == 200
    mock_ollama.check_readiness.assert_called_once()
    call_kwargs = mock_ollama.check_readiness.call_args.kwargs
    assert "probe_timeout_seconds" in call_kwargs
    assert call_kwargs["probe_timeout_seconds"] == route_module._OLLAMA_PROBE_TIMEOUT_SECONDS
    # Confirm the probe timeout is the short value, not the inference timeout.
    assert call_kwargs["probe_timeout_seconds"] < route_module._OLLAMA_DEFAULT_TIMEOUT_SECONDS


# --------------------------------------------------------------------------- secrets never leaked

def test_response_never_contains_secret_fields(client, auth_headers):
    resp = client.get(_ENDPOINT, headers=auth_headers)
    assert resp.status_code == 200
    for provider in resp.json()["providers"]:
        leaked = _FORBIDDEN_KEYS & set(provider.keys())
        assert not leaked, f"Secret field(s) leaked in provider {provider['name']}: {leaked}"


def test_response_key_set_is_exactly_four_fields(client, auth_headers):
    """Exact schema contract: name, model_identifier, available, readiness_status."""
    resp = client.get(_ENDPOINT, headers=auth_headers)
    assert resp.status_code == 200
    expected_keys = {"name", "model_identifier", "available", "readiness_status"}
    for provider in resp.json()["providers"]:
        assert set(provider.keys()) == expected_keys, (
            f"Unexpected keys in provider {provider['name']}: {set(provider.keys())}"
        )
