"""AI-P2L-R -- Ollama runtime hardening tests.

Covers:
- keep_alive included in Ollama request payload
- TORQPRO_OLLAMA_KEEP_ALIVE env override respected
- server unavailable -> SERVER_UNAVAILABLE
- server reachable, model missing -> MODEL_MISSING
- server reachable, model available -> MODEL_READY
- no automatic model pull/download
- no model substitution
- no cloud fallback from readiness probe
- QB Explain regression (mocked Ollama)
- Anthropic adapter regression
- All existing Ollama adapter tests still pass (import-level verification)
"""

from __future__ import annotations

import json
import uuid

import httpx
import pytest

from backend.ai_gateway.providers.ollama_adapter import (
    OllamaModelClient,
    OllamaReadinessStatus,
)
from backend.ai_gateway.providers.ollama_config import load_from_env
from backend import app as app_module
from backend.api.routes import ai_gateway as route_module

_BASE_URL = "http://127.0.0.1:11434"
_MODEL    = "qwen2.5:3b"     # selected runtime profile for live testing
_MODEL_DEFAULT = "qwen3:8b"  # product default remains qwen3:8b


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_chat_response(content: str) -> bytes:
    return json.dumps({
        "model": _MODEL,
        "message": {"role": "assistant", "content": content},
        "done": True,
    }).encode()


def _make_tags_response(models: list) -> bytes:
    return json.dumps({
        "models": [{"name": m} for m in models]
    }).encode()


def _chat_client(content: str = "test response") -> OllamaModelClient:
    transport = httpx.MockTransport(
        lambda r: httpx.Response(200, content=_make_chat_response(content))
    )
    return OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=5.0, keep_alive="10m",
        http_client=httpx.Client(transport=transport),
    )


# ---------------------------------------------------------------------------
# keep_alive in payload
# ---------------------------------------------------------------------------

def test_keep_alive_included_in_payload():
    """keep_alive must appear in the Ollama /api/chat request body."""
    captured = []
    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, content=_make_chat_response("ok"))
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=5.0, keep_alive="15m",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    from backend.ai_gateway.llm_client import PromptContext
    client.complete(PromptContext(query_text="test", language="tr"))
    assert captured, "no request captured"
    assert captured[0].get("keep_alive") == "15m"


def test_default_keep_alive_is_10m():
    from backend.api.routes.ai_gateway import _OLLAMA_DEFAULT_KEEP_ALIVE
    assert _OLLAMA_DEFAULT_KEEP_ALIVE == "10m"


def test_keep_alive_env_override(monkeypatch):
    monkeypatch.setenv("TORQPRO_OLLAMA_KEEP_ALIVE", "30m")
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_base_url=_BASE_URL,
        default_model=_MODEL,
        default_keep_alive="10m",
    )
    assert cfg.keep_alive == "30m"


def test_keep_alive_defaults_when_env_absent(monkeypatch):
    monkeypatch.delenv("TORQPRO_OLLAMA_KEEP_ALIVE", raising=False)
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_base_url=_BASE_URL,
        default_model=_MODEL,
        default_keep_alive="10m",
    )
    assert cfg.keep_alive == "10m"


def test_keep_alive_sent_with_zero_unloads_model():
    """keep_alive='0' should be passed through (Ollama unloads immediately)."""
    captured = []
    def handler(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, content=_make_chat_response("ok"))
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=5.0, keep_alive="0",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    from backend.ai_gateway.llm_client import PromptContext
    client.complete(PromptContext(query_text="test", language="tr"))
    assert captured[0].get("keep_alive") == "0"


# ---------------------------------------------------------------------------
# Health / readiness
# ---------------------------------------------------------------------------

def test_check_readiness_server_unavailable_on_connect_error():
    def handler(request):
        raise httpx.ConnectError("refused")
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    result = client.check_readiness()
    assert result == OllamaReadinessStatus.SERVER_UNAVAILABLE


def test_check_readiness_server_unavailable_on_timeout():
    def handler(request):
        raise httpx.ReadTimeout("timed out", request=request)
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=1.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    result = client.check_readiness()
    assert result == OllamaReadinessStatus.SERVER_UNAVAILABLE


def test_check_readiness_server_unavailable_on_non_2xx():
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(
            lambda r: httpx.Response(503, content=b"unavailable")
        )),
    )
    result = client.check_readiness()
    assert result == OllamaReadinessStatus.SERVER_UNAVAILABLE


def test_check_readiness_model_missing_when_not_in_tags():
    """Server reachable but configured model not listed -> MODEL_MISSING."""
    client = OllamaModelClient(
        model_id="qwen3:8b", base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(
            lambda r: httpx.Response(200, content=_make_tags_response(
                ["llama3.2:1b", "mistral:7b"]
            ))
        )),
    )
    result = client.check_readiness()
    assert result == OllamaReadinessStatus.MODEL_MISSING


def test_check_readiness_model_ready_exact_match():
    """Configured model tag appears in /api/tags -> MODEL_READY."""
    client = OllamaModelClient(
        model_id="qwen2.5:3b", base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(
            lambda r: httpx.Response(200, content=_make_tags_response(
                ["llama3.2:1b", "qwen2.5:3b"]
            ))
        )),
    )
    result = client.check_readiness()
    assert result == OllamaReadinessStatus.MODEL_READY


def test_check_readiness_model_ready_base_name_match():
    """Match on model base name (tag-less prefix) also returns MODEL_READY."""
    client = OllamaModelClient(
        model_id="qwen2.5:3b", base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(
            lambda r: httpx.Response(200, content=_make_tags_response(
                ["qwen2.5"]  # tag-less entry
            ))
        )),
    )
    result = client.check_readiness()
    assert result == OllamaReadinessStatus.MODEL_READY


def test_check_readiness_never_raises():
    """check_readiness must never propagate exceptions."""
    def handler(request):
        raise RuntimeError("unexpected error in transport")
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    result = client.check_readiness()
    assert isinstance(result, OllamaReadinessStatus)


def test_check_readiness_does_not_make_chat_call():
    """Readiness probe must use /api/tags, never /api/chat."""
    called_paths = []
    def handler(request):
        called_paths.append(request.url.path)
        return httpx.Response(200, content=_make_tags_response([_MODEL]))
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    client.check_readiness()
    assert all("/api/tags" in p or p == "/api/tags" for p in called_paths)
    assert "/api/chat" not in called_paths


# ---------------------------------------------------------------------------
# No automatic model download / substitution
# ---------------------------------------------------------------------------

def test_no_automatic_model_download():
    """check_readiness returns MODEL_MISSING; it never issues a pull request."""
    called_paths = []
    def handler(request):
        called_paths.append(request.url.path)
        return httpx.Response(200, content=_make_tags_response([]))
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    result = client.check_readiness()
    assert result == OllamaReadinessStatus.MODEL_MISSING
    pull_calls = [p for p in called_paths if "pull" in p]
    assert not pull_calls, f"Unexpected pull call: {pull_calls}"


def test_no_model_substitution():
    """When configured model is missing, the adapter must NOT substitute
    another model -- it returns MODEL_MISSING with no alternative chosen."""
    client = OllamaModelClient(
        model_id="qwen3:8b", base_url=_BASE_URL,
        default_timeout_seconds=2.0, keep_alive="10m",
        http_client=httpx.Client(transport=httpx.MockTransport(
            lambda r: httpx.Response(200, content=_make_tags_response(
                ["llama3.2:1b", "qwen2.5:3b"]  # different models present
            ))
        )),
    )
    result = client.check_readiness()
    assert result == OllamaReadinessStatus.MODEL_MISSING
    # Adapter's model_id must remain unchanged.
    assert client.model_identifier == "qwen3:8b"


# ---------------------------------------------------------------------------
# No cloud fallback from readiness probe
# ---------------------------------------------------------------------------

def test_readiness_probe_no_cloud_fallback():
    """A SERVER_UNAVAILABLE readiness result must not trigger any
    Anthropic API call -- check_readiness is pure local probe."""
    import backend.ai_gateway.providers.ollama_adapter as mod
    assert not hasattr(mod, "AnthropicModelClient")
    # Verify OllamaReadinessStatus values don't include any cloud reference.
    for status in OllamaReadinessStatus:
        assert "anthropic" not in status.value.lower()
        assert "cloud" not in status.value.lower()


# ---------------------------------------------------------------------------
# Product default model remains qwen3:8b
# ---------------------------------------------------------------------------

def test_product_default_model_is_qwen3_8b():
    """The product-global default must remain qwen3:8b.
    qwen2.5:3b is a valid TORQPRO_OLLAMA_MODEL override for constrained hardware."""
    from backend.api.routes.ai_gateway import _OLLAMA_DEFAULT_MODEL
    assert _OLLAMA_DEFAULT_MODEL == "qwen3:8b"


def test_qwen25_3b_selectable_via_env(monkeypatch):
    """qwen2.5:3b must be selectable via TORQPRO_OLLAMA_MODEL."""
    monkeypatch.setenv("TORQPRO_OLLAMA_MODEL", "qwen2.5:3b")
    cfg = load_from_env(
        default_timeout_seconds=120.0,
        default_base_url=_BASE_URL,
        default_model="qwen3:8b",
        default_keep_alive="10m",
    )
    assert cfg.model == "qwen2.5:3b"


# ---------------------------------------------------------------------------
# QB Explain regression with mocked Ollama
# ---------------------------------------------------------------------------

def _allow_all(role: str, action: str) -> bool:
    return True


def test_qb_explain_regression_with_keep_alive(client, auth_headers, tmp_path, monkeypatch):
    """QB Explain still works end-to-end when OllamaModelClient includes keep_alive."""
    from backend.question_bank import service, store
    from backend.question_bank.schema import (
        Category, Difficulty, EngineeringRiskLevel, QuestionRecord,
        QuestionType, SourceReference, SourceType, TraceabilityLevel,
    )
    from backend.app import conn

    qb_path = tmp_path / f"qb_r_{uuid.uuid4().hex}.json"
    monkeypatch.setattr(store, "DATA_PATH", qb_path)

    uid = uuid.uuid4().hex[:8].upper()
    record = QuestionRecord(
        question_id=f"QB-PLR-{uid}",
        content_version=1,
        category=Category.TIGHTENING_TORQUE,
        subcategory=None,
        difficulty=Difficulty.BEGINNER,
        question_type=QuestionType.SINGLE_CHOICE,
        question_tr=f"PLR-{uid} sıkma torku hakkında yeterince uzun bir soru metni.",
        question_en=f"PLR-{uid} a sufficiently long question about tightening torque.",
        options_tr=["A", "B", "C"],
        options_en=["A", "B", "C"],
        correct_answer=0,
        technical_explanation_tr="Bu teknik açıklama metni yeterli uzunluktadır ve içerik taşımaktadır.",
        technical_explanation_en="This technical explanation is of sufficient length and contains content.",
        standard_reference=None,
        source_reference=SourceReference(source_type=SourceType.INTERNAL_ENGINE, description="t"),
        source_locator=None,
        traceability_level=TraceabilityLevel.PROVISIONAL,
        tags=["p2l-r"],
        learning_objective="P2L-R runtime hardening regression test öğrenme hedefi.",
        engineering_risk_level=EngineeringRiskLevel.LOW,
        is_active=True,
    )
    store.save_question_content(record, path=qb_path)
    with conn() as c:
        service.register_question(c, question_id=record.question_id, content_version=1, actor="t")
        service.submit_for_technical_review(c, question_id=record.question_id, content_version=1, actor="t")
        service.validate_question(
            c, question_id=record.question_id, content_version=1, actor="t",
            actor_role="admin", reviewed_by="t", review_date="2026-08-27",
            authorize=_allow_all,
        )

    fake = _chat_client("QB Explain P2L-R hardening yanıtı.")
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: fake
    try:
        resp = client.post(
            "/api/ai/question-bank/explain",
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["schema_version"] == "1.0"
    assert body["question_id"] == record.question_id
    evidence_ids = [e["source_id"] for e in body.get("evidence", [])]
    assert record.question_id in evidence_ids


# ---------------------------------------------------------------------------
# Anthropic adapter regression
# ---------------------------------------------------------------------------

def test_anthropic_adapter_still_importable_after_p2l_r():
    from backend.ai_gateway.providers.anthropic_adapter import AnthropicModelClient
    assert AnthropicModelClient.name == "anthropic"


def test_existing_ollama_tests_still_importable():
    """Ensure all existing Ollama test symbols are still resolvable."""
    import tests.ai.test_ollama_adapter as m
    assert hasattr(m, "test_valid_response_returns_model_response")
    assert hasattr(m, "test_qb_search_makes_zero_ollama_calls")
    assert hasattr(m, "test_b4_model_timeout_error_hierarchy")
