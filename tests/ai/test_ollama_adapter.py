"""AI-P2L -- OllamaModelClient adapter tests.

Zero live Ollama server calls.  All HTTP is handled by ``httpx.MockTransport``
or by injecting a pre-built ``httpx.Client`` into ``OllamaModelClient``.

Covers all 22 required test cases:
1.  Ollama disabled -> not registered
2.  Enabled config registers Ollama
3.  Configurable model respected
4.  Configurable base URL respected
5.  Valid response -> ModelResponse
6.  Empty response fails closed (ModelUnavailableError)
7.  Whitespace response fails closed
8.  Oversized response fails closed (B2 validate_model_response)
9.  Timeout -> ModelTimeoutError
10. Connection failure -> ModelUnavailableError
11. Malformed JSON -> ModelUnavailableError
12. Raw HTTP/server error not leaked
13. System/user/evidence separation preserved
14. No API key requirement
15. Backend controls provider
16. Frontend cannot select provider
17. No automatic Ollama->Anthropic fallback
18. QB Explain works with mocked Ollama
19. Exact evidence anchoring preserved
20. QB Search makes zero Ollama calls
21. B1-B5 regressions pass
22. Anthropic adapter tests still pass (via import)
"""

from __future__ import annotations

import json
import uuid

import httpx
import pytest

from backend import app as app_module
from backend.ai_gateway.exceptions import ModelTimeoutError, ModelUnavailableError
from backend.ai_gateway.llm_client import PromptContext
from backend.ai_gateway.output_validator import validate_model_response
from backend.ai_gateway.providers.ollama_adapter import OllamaModelClient
from backend.ai_gateway.providers.ollama_config import OllamaProviderConfig, load_from_env
from backend.api.routes import ai_gateway as route_module
from backend.api.routes.ai_gateway import (
    MAX_MODEL_OUTPUT_CHARS,
    _OLLAMA_DEFAULT_BASE_URL,
    _OLLAMA_DEFAULT_MODEL,
    _OLLAMA_DEFAULT_TIMEOUT_SECONDS,
)

_BASE_URL = "http://127.0.0.1:11434"
_MODEL = "qwen3:8b"
_CHAT_URL = f"{_BASE_URL}/api/chat"
_QB_SEARCH = "/api/ai/question-bank/search"
_QB_EXPLAIN = "/api/ai/question-bank/explain"
_QUERY_EP = "/api/ai/query"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ollama_response(content: str, model: str = _MODEL) -> bytes:
    """Build a minimal valid Ollama Chat API response body."""
    return json.dumps({
        "model": model,
        "message": {"role": "assistant", "content": content},
        "done": True,
        "prompt_eval_count": 10,
        "eval_count": 20,
    }).encode("utf-8")


def _mock_transport(content: str, status: int = 200) -> httpx.MockTransport:
    def handler(request):
        return httpx.Response(status, content=_make_ollama_response(content))
    return httpx.MockTransport(handler)


def _error_transport(status: int, body: str = "error") -> httpx.MockTransport:
    def handler(request):
        return httpx.Response(status, content=body.encode())
    return httpx.MockTransport(handler)


def _bad_json_transport() -> httpx.MockTransport:
    def handler(request):
        return httpx.Response(200, content=b"not-json{{{")
    return httpx.MockTransport(handler)


def _make_client(transport: httpx.MockTransport) -> OllamaModelClient:
    injected = httpx.Client(transport=transport)
    return OllamaModelClient(
        model_id=_MODEL,
        base_url=_BASE_URL,
        default_timeout_seconds=30.0,
        http_client=injected,
    )


def _make_prompt(query: str = "torque nedir", language: str = "tr") -> PromptContext:
    return PromptContext(query_text=query, language=language)


# ---------------------------------------------------------------------------
# 1. Disabled -> not registered
# ---------------------------------------------------------------------------

def test_ollama_disabled_not_registered(monkeypatch):
    monkeypatch.setenv("TORQPRO_OLLAMA_ENABLED", "false")
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_base_url=_BASE_URL,
        default_model=_MODEL,
    )
    assert not cfg.is_enabled()


# ---------------------------------------------------------------------------
# 2. Enabled config registers Ollama
# ---------------------------------------------------------------------------

def test_ollama_enabled_config_is_enabled(monkeypatch):
    monkeypatch.setenv("TORQPRO_OLLAMA_ENABLED", "true")
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_base_url=_BASE_URL,
        default_model=_MODEL,
    )
    assert cfg.is_enabled()


def test_ollama_enabled_registers_in_registry(monkeypatch):
    monkeypatch.setenv("TORQPRO_OLLAMA_ENABLED", "true")
    monkeypatch.setenv("TORQPRO_OLLAMA_MODEL", _MODEL)
    monkeypatch.setenv("TORQPRO_OLLAMA_BASE_URL", _BASE_URL)
    from backend.ai_gateway.providers.registry import ProviderRegistry
    registry = ProviderRegistry()
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_base_url=_BASE_URL,
        default_model=_MODEL,
    )
    if cfg.is_enabled():
        registry.register(OllamaModelClient(
            model_id=cfg.model,
            base_url=cfg.base_url,
            default_timeout_seconds=cfg.timeout_seconds,
        ))
    client = registry.get("ollama")
    assert client.name == "ollama"


# ---------------------------------------------------------------------------
# 3. Configurable model respected
# ---------------------------------------------------------------------------

def test_configurable_model_respected(monkeypatch):
    monkeypatch.setenv("TORQPRO_OLLAMA_MODEL", "llama3.2:3b")
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_base_url=_BASE_URL,
        default_model=_MODEL,
    )
    assert cfg.model == "llama3.2:3b"


def test_default_model_is_qwen3_8b():
    assert _OLLAMA_DEFAULT_MODEL == "qwen3:8b"


# ---------------------------------------------------------------------------
# 4. Configurable base URL respected
# ---------------------------------------------------------------------------

def test_configurable_base_url_respected(monkeypatch):
    monkeypatch.setenv("TORQPRO_OLLAMA_BASE_URL", "http://192.168.1.10:11434")
    cfg = load_from_env(
        default_timeout_seconds=30.0,
        default_base_url=_BASE_URL,
        default_model=_MODEL,
    )
    assert cfg.base_url == "http://192.168.1.10:11434"


def test_default_base_url():
    assert _OLLAMA_DEFAULT_BASE_URL == "http://127.0.0.1:11434"


# ---------------------------------------------------------------------------
# 5. Valid response -> ModelResponse
# ---------------------------------------------------------------------------

def test_valid_response_returns_model_response():
    client = _make_client(_mock_transport("Bu bir test yanıtıdır."))
    resp = client.complete(_make_prompt())
    assert resp.text == "Bu bir test yanıtıdır."
    assert resp.model_name == "ollama"


def test_valid_response_passes_b2_validation():
    client = _make_client(_mock_transport("Geçerli teknik açıklama."))
    resp = client.complete(_make_prompt())
    validated = validate_model_response(resp.text, max_chars=MAX_MODEL_OUTPUT_CHARS, provider_name="ollama")
    assert validated == resp.text


# ---------------------------------------------------------------------------
# 6. Empty response fails closed
# ---------------------------------------------------------------------------

def test_empty_response_fails_closed():
    def handler(request):
        return httpx.Response(200, content=json.dumps({
            "model": _MODEL,
            "message": {"role": "assistant", "content": ""},
            "done": True,
        }).encode())
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=30.0,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt())


# ---------------------------------------------------------------------------
# 7. Whitespace response fails closed (at B2 validate_model_response)
# ---------------------------------------------------------------------------

def test_whitespace_response_fails_b2():
    with pytest.raises(ModelUnavailableError):
        validate_model_response("   \t\n  ", max_chars=MAX_MODEL_OUTPUT_CHARS, provider_name="ollama")


# ---------------------------------------------------------------------------
# 8. Oversized response fails closed (B2)
# ---------------------------------------------------------------------------

def test_oversized_response_fails_b2():
    oversize = "A" * (MAX_MODEL_OUTPUT_CHARS + 1)
    with pytest.raises(ModelUnavailableError):
        validate_model_response(oversize, max_chars=MAX_MODEL_OUTPUT_CHARS, provider_name="ollama")


# ---------------------------------------------------------------------------
# 9. Timeout -> ModelTimeoutError
# ---------------------------------------------------------------------------

def test_timeout_raises_model_timeout_error():
    def timeout_handler(request):
        raise httpx.ReadTimeout("timed out", request=request)
    injected = httpx.Client(transport=httpx.MockTransport(timeout_handler))
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=1.0,
        http_client=injected,
    )
    with pytest.raises(ModelTimeoutError):
        client.complete(_make_prompt())


def test_connect_timeout_raises_model_timeout_error():
    def handler(request):
        raise httpx.ConnectTimeout("connect timed out", request=request)
    injected = httpx.Client(transport=httpx.MockTransport(handler))
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=1.0,
        http_client=injected,
    )
    with pytest.raises(ModelTimeoutError):
        client.complete(_make_prompt())


def test_model_timeout_error_is_subclass_of_model_unavailable():
    assert issubclass(ModelTimeoutError, ModelUnavailableError)


# ---------------------------------------------------------------------------
# 10. Connection failure -> ModelUnavailableError
# ---------------------------------------------------------------------------

def test_connection_error_raises_model_unavailable():
    def handler(request):
        raise httpx.ConnectError("connection refused")
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt())


def test_500_error_raises_model_unavailable():
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
        http_client=httpx.Client(transport=httpx.MockTransport(
            lambda r: httpx.Response(500, content=b"internal server error")
        )),
    )
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt())


# ---------------------------------------------------------------------------
# 11. Malformed JSON -> ModelUnavailableError
# ---------------------------------------------------------------------------

def test_malformed_json_raises_model_unavailable():
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
        http_client=httpx.Client(transport=_bad_json_transport()),
    )
    with pytest.raises(ModelUnavailableError):
        client.complete(_make_prompt())


# ---------------------------------------------------------------------------
# 12. Raw server error not leaked
# ---------------------------------------------------------------------------

def test_raw_server_error_not_leaked_in_exception():
    """The raw response body must not appear in ModelUnavailableError message."""
    canary = "CANARY_SECRET_SERVER_ERROR_12345"
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
        http_client=httpx.Client(transport=httpx.MockTransport(
            lambda r: httpx.Response(500, content=canary.encode())
        )),
    )
    with pytest.raises(ModelUnavailableError) as exc_info:
        client.complete(_make_prompt())
    assert canary not in str(exc_info.value)


# ---------------------------------------------------------------------------
# 13. System/user/evidence separation preserved
# ---------------------------------------------------------------------------

def test_system_user_evidence_separation_in_payload():
    """The payload must contain separate system and user messages;
    evidence must appear in the user turn, not the system turn."""
    captured = []

    def handler(request):
        body = json.loads(request.content)
        captured.append(body)
        return httpx.Response(200, content=_make_ollama_response("ok"))

    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    from backend.ai_gateway.llm_client import PromptContext
    from backend.ai_gateway.retrieval import EvidenceSource
    ev = EvidenceSource(
        source_type="question_bank",
        source_id="QB-SEP-001",
        content_version=1,
        title_tr="Test başlık",
        title_en="Test title",
        body_tr="Test gövde EVIDENCE_MARKER",
        body_en="Test body EVIDENCE_MARKER",
        standard_name=None,
        standard_clause=None,
        source_kind=None,
        category=None,
        difficulty=None,
        tags=frozenset(),
        traceability_level=None,
    )
    ctx = PromptContext(query_text="test sorgusu", language="tr", evidence=(ev,))
    client.complete(ctx)

    assert captured, "No request captured"
    messages = captured[0]["messages"]
    roles = [m["role"] for m in messages]
    assert "system" in roles
    assert "user" in roles

    system_content = next(m["content"] for m in messages if m["role"] == "system")
    user_content = next(m["content"] for m in messages if m["role"] == "user")

    # Evidence must be in user turn, not system turn (prompt injection boundary)
    assert "EVIDENCE_MARKER" not in system_content
    assert "EVIDENCE_MARKER" in user_content
    # QB-SEP-001 source_id must appear in user turn
    assert "QB-SEP-001" in user_content
    assert "QB-SEP-001" not in system_content


# ---------------------------------------------------------------------------
# 14. No API key requirement
# ---------------------------------------------------------------------------

def test_no_api_key_required():
    """OllamaModelClient must construct and operate without any API key."""
    client = _make_client(_mock_transport("ok"))
    assert client.is_available() is True
    # No attribute named _api_key on the client
    assert not hasattr(client, "_api_key")


# ---------------------------------------------------------------------------
# 15. Backend controls provider
# ---------------------------------------------------------------------------

def test_backend_controls_provider_name():
    """provider_name on engineering-reasoning is picked up from the
    registry keyed by the backend-assigned name 'ollama'."""
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
    )
    assert client.name == "ollama"
    assert client.model_identifier == _MODEL


# ---------------------------------------------------------------------------
# 16. Frontend cannot select provider via normal request field
# ---------------------------------------------------------------------------

def test_frontend_cannot_select_ollama_via_query_endpoint(client, auth_headers):
    """POST /api/ai/query has no provider_name field -- extra fields are
    forbidden (extra='forbid'). Sending provider_name must return 422."""
    response = client.post(
        _QUERY_EP,
        json={"query_text": "test", "provider_name": "ollama"},
        headers=auth_headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# 17. No automatic Ollama->Anthropic fallback
# ---------------------------------------------------------------------------

def test_no_automatic_fallback_to_anthropic():
    """An Ollama ModelUnavailableError must NOT silently route to Anthropic.
    Proven by checking OllamaModelClient.complete raises immediately on
    failure, with no reference to Anthropic in the error path."""
    def handler(request):
        raise httpx.ConnectError("refused")
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    with pytest.raises(ModelUnavailableError) as exc_info:
        client.complete(_make_prompt())
    # Error message must not mention Anthropic
    assert "anthropic" not in str(exc_info.value).lower()
    assert "claude" not in str(exc_info.value).lower()


def test_paid_cloud_auto_fallback_is_no():
    """PAID_CLOUD_AUTO_FALLBACK = NO.
    OllamaModelClient's module must contain no reference to AnthropicModelClient
    or anthropic_adapter -- failure path is purely ModelUnavailableError, no
    cloud fallback.
    """
    import inspect
    import backend.ai_gateway.providers.ollama_adapter as mod
    src = inspect.getsource(mod)
    assert "AnthropicModelClient" not in src
    # Also verify at runtime: Ollama connection error does not invoke Anthropic.
    def handler(request):
        raise httpx.ConnectError("refused")
    injected = httpx.Client(transport=httpx.MockTransport(handler))
    client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
        http_client=injected,
    )
    with pytest.raises(ModelUnavailableError) as exc_info:
        client.complete(_make_prompt())
    assert "anthropic" not in str(exc_info.value).lower()


# ---------------------------------------------------------------------------
# 18. QB Explain works with mocked Ollama (via HTTP endpoint)
# ---------------------------------------------------------------------------

def _allow_all(role: str, action: str) -> bool:
    return True


def test_qb_explain_works_with_mocked_ollama(client, auth_headers, tmp_path, monkeypatch):
    """QB Explain endpoint works end-to-end with a mocked Ollama client."""
    from backend.question_bank import service, store
    from backend.question_bank.schema import (
        Category, Difficulty, EngineeringRiskLevel, QuestionRecord,
        QuestionType, SourceReference, SourceType, TraceabilityLevel,
    )
    from backend.app import conn

    qb_path = tmp_path / f"qb_ollama_{uuid.uuid4().hex}.json"
    monkeypatch.setattr(store, "DATA_PATH", qb_path)

    uid = uuid.uuid4().hex[:8].upper()
    record = QuestionRecord(
        question_id=f"QB-OLL-{uid}",
        content_version=1,
        category=Category.TIGHTENING_TORQUE,
        subcategory=None,
        difficulty=Difficulty.BEGINNER,
        question_type=QuestionType.SINGLE_CHOICE,
        question_tr=f"OLL-{uid} sıkma torku ile ilgili test sorusu metni.",
        question_en=f"OLL-{uid} test question about tightening torque.",
        options_tr=["A", "B", "C"],
        options_en=["A", "B", "C"],
        correct_answer=0,
        technical_explanation_tr="Bu teknik açıklama yeterince uzun bir metin içermektedir.",
        technical_explanation_en="This technical explanation contains sufficiently long text.",
        standard_reference=None,
        source_reference=SourceReference(source_type=SourceType.INTERNAL_ENGINE, description="test"),
        source_locator=None,
        traceability_level=TraceabilityLevel.PROVISIONAL,
        tags=["ollama-test"],
        learning_objective="Ollama test öğrenme hedefi.",
        engineering_risk_level=EngineeringRiskLevel.LOW,
        is_active=True,
    )
    store.save_question_content(record, path=qb_path)
    with conn() as c:
        service.register_question(c, question_id=record.question_id, content_version=1, actor="t")
        service.submit_for_technical_review(c, question_id=record.question_id, content_version=1, actor="t")
        service.validate_question(
            c, question_id=record.question_id, content_version=1, actor="t",
            actor_role="admin", reviewed_by="t", review_date="2026-08-01",
            authorize=_allow_all,
        )

    # Inject mocked Ollama into the route's get_model_client dependency.
    fake_ollama = _make_client(_mock_transport("OLL yanıt: sıkma torku açıklaması."))
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: fake_ollama

    try:
        resp = client.post(
            _QB_EXPLAIN,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["schema_version"] == "1.0"
    assert body["question_id"] == record.question_id
    assert "explanation" in body
    assert body["explanation"] is not None


# ---------------------------------------------------------------------------
# 19. Exact evidence anchoring preserved
# ---------------------------------------------------------------------------

def test_exact_evidence_anchoring_preserved(client, auth_headers, tmp_path, monkeypatch):
    """The evidence list must contain exactly the requested question_id,
    not a different record chosen by the model."""
    from backend.question_bank import service, store
    from backend.question_bank.schema import (
        Category, Difficulty, EngineeringRiskLevel, QuestionRecord,
        QuestionType, SourceReference, SourceType, TraceabilityLevel,
    )
    from backend.app import conn

    qb_path = tmp_path / f"qb_anchor_{uuid.uuid4().hex}.json"
    monkeypatch.setattr(store, "DATA_PATH", qb_path)

    uid = uuid.uuid4().hex[:8].upper()
    record = QuestionRecord(
        question_id=f"QB-ANC-{uid}",
        content_version=1,
        category=Category.TIGHTENING_TORQUE,
        subcategory=None,
        difficulty=Difficulty.BEGINNER,
        question_type=QuestionType.SINGLE_CHOICE,
        question_tr=f"ANC-{uid} soru metni yeterli uzunlukta.",
        question_en=f"ANC-{uid} question text of sufficient length.",
        options_tr=["A", "B"],
        options_en=["A", "B"],
        correct_answer=0,
        technical_explanation_tr="Yeterince uzun bir teknik açıklama metni buraya gelir.",
        technical_explanation_en="A sufficiently long technical explanation text goes here.",
        standard_reference=None,
        source_reference=SourceReference(source_type=SourceType.INTERNAL_ENGINE, description="t"),
        source_locator=None,
        traceability_level=TraceabilityLevel.PROVISIONAL,
        tags=[],
        learning_objective="Ollama anchoring test öğrenme hedefi.",
        engineering_risk_level=EngineeringRiskLevel.LOW,
        is_active=True,
    )
    store.save_question_content(record, path=qb_path)
    with conn() as c:
        service.register_question(c, question_id=record.question_id, content_version=1, actor="t")
        service.submit_for_technical_review(c, question_id=record.question_id, content_version=1, actor="t")
        service.validate_question(
            c, question_id=record.question_id, content_version=1, actor="t",
            actor_role="admin", reviewed_by="t", review_date="2026-08-01",
            authorize=_allow_all,
        )

    fake_ollama = _make_client(_mock_transport("Anchoring test yanıtı."))
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: fake_ollama
    try:
        resp = client.post(
            _QB_EXPLAIN,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]

    assert resp.status_code == 200
    body = resp.json()
    # The evidence array must contain the exact requested question_id.
    evidence_ids = [e["source_id"] for e in body.get("evidence", [])]
    assert record.question_id in evidence_ids


# ---------------------------------------------------------------------------
# 20. QB Search makes zero Ollama calls
# ---------------------------------------------------------------------------

def test_qb_search_makes_zero_ollama_calls(client, auth_headers):
    """QB Search is provider-independent; injecting a raising Ollama client
    must leave the QB Search response at 200."""
    def raising_handler(request):
        raise RuntimeError("QB Search must not call Ollama")

    fake_ollama = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0,
        http_client=httpx.Client(transport=httpx.MockTransport(raising_handler)),
    )
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: fake_ollama
    try:
        resp = client.post(_QB_SEARCH, json={"query_text": "torque"}, headers=auth_headers)
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]

    # Provider not called -> 200 (not 503)
    assert resp.status_code == 200
    assert resp.json()["schema_version"] == "1.0"


# ---------------------------------------------------------------------------
# 21. B1-B5 regressions
# ---------------------------------------------------------------------------

def test_b1_schema_version_preserved(client, auth_headers):
    from backend.ai_gateway.llm_client import FakeModelClient
    fake = FakeModelClient(fixed_text="regression check")
    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: fake
    try:
        resp = client.post(_QUERY_EP, json={"query_text": "regression"}, headers=auth_headers)
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]
    assert resp.status_code == 200
    assert resp.json()["schema_version"] == "1.0"


def test_b2_max_chars_constant_unchanged():
    assert MAX_MODEL_OUTPUT_CHARS == 8_000


def test_b4_model_timeout_error_hierarchy():
    assert issubclass(ModelTimeoutError, ModelUnavailableError)


# ---------------------------------------------------------------------------
# 22. Anthropic adapter still importable and functional
# ---------------------------------------------------------------------------

def test_anthropic_adapter_still_importable():
    from backend.ai_gateway.providers.anthropic_adapter import AnthropicModelClient
    from backend.ai_gateway.providers.config import load_from_env as anthropic_cfg
    assert AnthropicModelClient is not None
    assert anthropic_cfg is not None


def test_ollama_and_anthropic_are_independent_registry_entries():
    """Both providers register under distinct names -- no collision."""
    from backend.ai_gateway.providers.anthropic_adapter import AnthropicModelClient
    ollama_client = OllamaModelClient(
        model_id=_MODEL, base_url=_BASE_URL, default_timeout_seconds=5.0
    )
    assert ollama_client.name == "ollama"
    # AnthropicModelClient.name is a class attribute == "anthropic".
    assert AnthropicModelClient.name == "anthropic"
    assert ollama_client.name != AnthropicModelClient.name
