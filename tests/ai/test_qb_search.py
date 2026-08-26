"""AI-RECOVERY-B3 -- POST /api/ai/question-bank/search endpoint tests.

Covers: auth, publishable-only enforcement (draft/technical_review/
rejected/deprecated excluded), request validation (empty/whitespace/
over-limit), TR/EN keyword search, category/difficulty hint semantics
(including invalid hints), deterministic ordering, zero provider
invocation, zero QB mutation, no fabricated AI fields, schema_version,
and B1/B2 non-regression.

Uses the same shared ``client``/``auth_headers`` fixtures and the same
DB/store fixture pattern already established by
``tests/ai/test_http_route.py``.
"""

from __future__ import annotations

import uuid

import pytest

from backend import app as app_module
from backend.ai_gateway.llm_client import FakeModelClient
from backend.api.routes import ai_gateway as route_module
from backend.app import conn
from backend.question_bank import service, store
from backend.question_bank.schema import (
    Category,
    Difficulty,
    EngineeringRiskLevel,
    QuestionRecord,
    QuestionType,
    SourceReference,
    SourceType,
    TraceabilityLevel,
)

_ENDPOINT = "/api/ai/question-bank/search"


def _allow_all(role: str, action: str) -> bool:
    return True


def _make_record(**overrides) -> QuestionRecord:
    uid = uuid.uuid4().hex[:8].upper()
    base = dict(
        question_id=f"QB-B3-{uid}",
        content_version=1,
        category=Category.TIGHTENING_TORQUE,
        subcategory=None,
        difficulty=Difficulty.BEGINNER,
        question_type=QuestionType.SINGLE_CHOICE,
        question_tr=f"B3-test-{uid} cıvata sıkma torku ile ilgili soru metni.",
        question_en=f"B3-test-{uid} question about bolt tightening torque.",
        options_tr=["A", "B", "C"],
        options_en=["A", "B", "C"],
        correct_answer=0,
        technical_explanation_tr="Bu açıklama en az yirmi karakter uzunluğunda olmalıdır.",
        technical_explanation_en="This explanation must be at least twenty characters long.",
        standard_reference=None,
        source_reference=SourceReference(
            source_type=SourceType.INTERNAL_ENGINE,
            description="b3-test",
        ),
        source_locator=None,
        traceability_level=TraceabilityLevel.PROVISIONAL,
        tags=["b3-test"],
        learning_objective="B3 test öğrenme hedefi.",
        engineering_risk_level=EngineeringRiskLevel.LOW,
        is_active=True,
    )
    base.update(overrides)
    return QuestionRecord(**base)


@pytest.fixture()
def qb_store_path(tmp_path, monkeypatch):
    path = tmp_path / f"qb_b3_{uuid.uuid4().hex}.json"
    monkeypatch.setattr(store, "DATA_PATH", path)
    return path


def _register_and_validate(record, qb_store_path):
    """Register + submit + validate one record (publishable)."""
    store.save_question_content(record, path=qb_store_path)
    with conn() as c:
        service.register_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
        )
        service.submit_for_technical_review(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
        )
        service.validate_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
            actor_role="admin", reviewed_by="t", review_date="2026-08-01",
            authorize=_allow_all,
        )
    return record


def _register_only(record, qb_store_path):
    """Register only (draft)."""
    store.save_question_content(record, path=qb_store_path)
    with conn() as c:
        service.register_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
        )
    return record


def _register_and_submit(record, qb_store_path):
    """Register + submit (technical_review)."""
    store.save_question_content(record, path=qb_store_path)
    with conn() as c:
        service.register_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
        )
        service.submit_for_technical_review(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
        )
    return record


def _register_and_reject(record, qb_store_path):
    """Register + submit + reject."""
    store.save_question_content(record, path=qb_store_path)
    with conn() as c:
        service.register_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
        )
        service.submit_for_technical_review(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
        )
        service.reject_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
            actor_role="admin", reason="b3-test rejection",
            authorize=_allow_all,
        )
    return record


def _register_validate_deprecate(record, qb_store_path):
    """Register + submit + validate + deprecate."""
    _register_and_validate(record, qb_store_path)
    with conn() as c:
        service.deprecate_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
            actor_role="admin", authorize=_allow_all,
        )
    return record


# ---------------------------------------------------------------------------
# 1. Auth required
# ---------------------------------------------------------------------------

def test_auth_required(client):
    response = client.post(_ENDPOINT, json={"query_text": "torque"})
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 2. Valid approved query succeeds + 3. schema_version
# ---------------------------------------------------------------------------

def test_valid_approved_query_succeeds(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    # The adapter keyword-searches question_tr and question_en fields,
    # not question_id. The unique record uid embedded in both language
    # fields is the most reliable search key.
    uid_keyword = record.question_id.replace("QB-B3-", "B3-test-")
    response = client.post(
        _ENDPOINT,
        json={"query_text": uid_keyword},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    assert body["query_text"] == uid_keyword
    assert isinstance(body["count"], int)
    assert isinstance(body["results"], list)
    source_ids = [r["source_id"] for r in body["results"]]
    assert record.question_id in source_ids


def test_schema_version_is_1_0(client, auth_headers, qb_store_path):
    _register_and_validate(_make_record(), qb_store_path)
    response = client.post(
        _ENDPOINT,
        json={"query_text": "b3-test"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


# ---------------------------------------------------------------------------
# 4-7. Lifecycle exclusion
# ---------------------------------------------------------------------------

def test_draft_excluded(client, auth_headers, qb_store_path):
    record = _register_only(_make_record(), qb_store_path)
    uid_keyword = record.question_id.replace("QB-B3-", "B3-test-")
    response = client.post(
        _ENDPOINT,
        json={"query_text": uid_keyword},
        headers=auth_headers,
    )
    assert response.status_code == 200
    source_ids = [r["source_id"] for r in response.json()["results"]]
    assert record.question_id not in source_ids


def test_technical_review_excluded(client, auth_headers, qb_store_path):
    record = _register_and_submit(_make_record(), qb_store_path)
    uid_keyword = record.question_id.replace("QB-B3-", "B3-test-")
    response = client.post(
        _ENDPOINT,
        json={"query_text": uid_keyword},
        headers=auth_headers,
    )
    assert response.status_code == 200
    source_ids = [r["source_id"] for r in response.json()["results"]]
    assert record.question_id not in source_ids


def test_rejected_excluded(client, auth_headers, qb_store_path):
    record = _register_and_reject(_make_record(), qb_store_path)
    uid_keyword = record.question_id.replace("QB-B3-", "B3-test-")
    response = client.post(
        _ENDPOINT,
        json={"query_text": uid_keyword},
        headers=auth_headers,
    )
    assert response.status_code == 200
    source_ids = [r["source_id"] for r in response.json()["results"]]
    assert record.question_id not in source_ids


def test_deprecated_excluded(client, auth_headers, qb_store_path):
    record = _register_validate_deprecate(_make_record(), qb_store_path)
    uid_keyword = record.question_id.replace("QB-B3-", "B3-test-")
    response = client.post(
        _ENDPOINT,
        json={"query_text": uid_keyword},
        headers=auth_headers,
    )
    assert response.status_code == 200
    source_ids = [r["source_id"] for r in response.json()["results"]]
    assert record.question_id not in source_ids


# ---------------------------------------------------------------------------
# 8. publishable_only cannot be overridden
# ---------------------------------------------------------------------------

def test_publishable_only_not_overridable(client, auth_headers):
    response = client.post(
        _ENDPOINT,
        json={"query_text": "torque", "publishable_only": False},
        headers=auth_headers,
    )
    # extra="forbid" → 422 for unknown field
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# 9-11. Request validation
# ---------------------------------------------------------------------------

def test_empty_query_text_rejected(client, auth_headers):
    response = client.post(_ENDPOINT, json={"query_text": ""}, headers=auth_headers)
    assert response.status_code == 400


def test_whitespace_query_text_rejected(client, auth_headers):
    response = client.post(
        _ENDPOINT, json={"query_text": "   \t\n  "}, headers=auth_headers
    )
    assert response.status_code == 400


def test_over_limit_query_text_rejected(client, auth_headers):
    from backend.api.routes.ai_gateway import _MAX_QUERY_TEXT_LENGTH
    long_text = "A" * (_MAX_QUERY_TEXT_LENGTH + 1)
    response = client.post(
        _ENDPOINT, json={"query_text": long_text}, headers=auth_headers
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 12-13. TR/EN search
# ---------------------------------------------------------------------------

def test_tr_search_works(client, auth_headers, qb_store_path):
    uid = uuid.uuid4().hex[:6].upper()
    record = _make_record(
        question_tr=f"B3TRSEARCH-{uid} Türkçe arama terimi cıvata",
        question_en=f"B3TRSEARCH-{uid} English text bolt",
    )
    _register_and_validate(record, qb_store_path)
    response = client.post(
        _ENDPOINT,
        json={"query_text": f"B3TRSEARCH-{uid}"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    source_ids = [r["source_id"] for r in response.json()["results"]]
    assert record.question_id in source_ids


def test_en_search_works(client, auth_headers, qb_store_path):
    uid = uuid.uuid4().hex[:6].upper()
    record = _make_record(
        question_tr=f"B3ENSEARCH-{uid} Türkçe metin",
        question_en=f"B3ENSEARCH-{uid} English search term fastener",
    )
    _register_and_validate(record, qb_store_path)
    response = client.post(
        _ENDPOINT,
        json={"query_text": f"B3ENSEARCH-{uid}"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    source_ids = [r["source_id"] for r in response.json()["results"]]
    assert record.question_id in source_ids


# ---------------------------------------------------------------------------
# 14-17. Category / difficulty hint semantics
# ---------------------------------------------------------------------------

def test_category_hint_filters_results(client, auth_headers, qb_store_path):
    uid = uuid.uuid4().hex[:6].upper()
    record_tq = _make_record(
        question_tr=f"B3CAT-{uid} torque cat test",
        question_en=f"B3CAT-{uid} torque cat test",
        category=Category.TIGHTENING_TORQUE,
    )
    record_fr = _make_record(
        question_tr=f"B3CAT-{uid} friction cat test",
        question_en=f"B3CAT-{uid} friction cat test",
        category=Category.FRICTION_LUBRICATION,
    )
    _register_and_validate(record_tq, qb_store_path)
    _register_and_validate(record_fr, qb_store_path)
    response = client.post(
        _ENDPOINT,
        json={"query_text": f"B3CAT-{uid}", "category": Category.TIGHTENING_TORQUE.value},
        headers=auth_headers,
    )
    assert response.status_code == 200
    source_ids = [r["source_id"] for r in response.json()["results"]]
    assert record_tq.question_id in source_ids
    assert record_fr.question_id not in source_ids

def test_difficulty_hint_filters_results(client, auth_headers, qb_store_path):
    uid = uuid.uuid4().hex[:6].upper()
    record_beg = _make_record(
        question_tr=f"B3DIFF-{uid} beginner difficulty test",
        question_en=f"B3DIFF-{uid} beginner difficulty test",
        difficulty=Difficulty.BEGINNER,
    )
    record_adv = _make_record(
        question_tr=f"B3DIFF-{uid} advanced difficulty test",
        question_en=f"B3DIFF-{uid} advanced difficulty test",
        difficulty=Difficulty.ADVANCED,
    )
    _register_and_validate(record_beg, qb_store_path)
    _register_and_validate(record_adv, qb_store_path)
    response = client.post(
        _ENDPOINT,
        json={"query_text": f"B3DIFF-{uid}", "difficulty": Difficulty.BEGINNER.value},
        headers=auth_headers,
    )
    assert response.status_code == 200
    source_ids = [r["source_id"] for r in response.json()["results"]]
    assert record_beg.question_id in source_ids
    assert record_adv.question_id not in source_ids


def test_invalid_category_degrades_gracefully(client, auth_headers, qb_store_path):
    """An unrecognised category hint returns 200 with no category filter applied
    (adapter's non-raising degradation, ADR-0018 Karar 6)."""
    _register_and_validate(_make_record(), qb_store_path)
    response = client.post(
        _ENDPOINT,
        json={"query_text": "b3-test", "category": "TOTALLY_INVALID_CATEGORY"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    assert isinstance(body["results"], list)


def test_invalid_difficulty_degrades_gracefully(client, auth_headers, qb_store_path):
    """An unrecognised difficulty hint returns 200 with no difficulty filter applied."""
    _register_and_validate(_make_record(), qb_store_path)
    response = client.post(
        _ENDPOINT,
        json={"query_text": "b3-test", "difficulty": "TOTALLY_INVALID_DIFFICULTY"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["schema_version"] == "1.0"
    assert isinstance(body["results"], list)


# ---------------------------------------------------------------------------
# 18. Deterministic ordering
# ---------------------------------------------------------------------------

def test_deterministic_ordering(client, auth_headers, qb_store_path):
    """Results must be ordered deterministically by (question_id, content_version)
    -- matching list_questions' own sort contract."""
    uid = uuid.uuid4().hex[:6].upper()
    # Create records in reverse lexicographic order of question_id.
    records = [
        _make_record(question_id=f"QB-B3ORD-{uid}-C",
                     question_tr=f"B3ORDER-{uid} sıralama testi",
                     question_en=f"B3ORDER-{uid} ordering test"),
        _make_record(question_id=f"QB-B3ORD-{uid}-A",
                     question_tr=f"B3ORDER-{uid} sıralama testi",
                     question_en=f"B3ORDER-{uid} ordering test"),
        _make_record(question_id=f"QB-B3ORD-{uid}-B",
                     question_tr=f"B3ORDER-{uid} sıralama testi",
                     question_en=f"B3ORDER-{uid} ordering test"),
    ]
    for r in records:
        _register_and_validate(r, qb_store_path)

    response = client.post(
        _ENDPOINT,
        json={"query_text": f"B3ORDER-{uid}"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    returned_ids = [r["source_id"] for r in response.json()["results"]]
    # Filter to just our test records to isolate from other DB content.
    our_ids = [sid for sid in returned_ids if f"QB-B3ORD-{uid}" in sid]
    assert our_ids == sorted(our_ids)


# ---------------------------------------------------------------------------
# 19. Zero provider invocation
# ---------------------------------------------------------------------------

def test_zero_provider_invocation(client, auth_headers, qb_store_path):
    """QB Search must make no provider/model call -- proven by overriding
    the model-client dependency with a client that always raises, confirming
    the endpoint succeeds regardless."""
    from backend.ai_gateway.llm_client import RaisingModelClient
    app_module.app.dependency_overrides[route_module.get_model_client] = (
        lambda: RaisingModelClient(RuntimeError("Provider must not be called"))
    )
    _register_and_validate(_make_record(), qb_store_path)
    try:
        response = client.post(
            _ENDPOINT,
            json={"query_text": "b3-test"},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]
    # If the provider were called, RaisingModelClient would cause a 503.
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# 20. Zero QB mutation
# ---------------------------------------------------------------------------

def test_zero_qb_mutation(client, auth_headers, qb_store_path):
    """Confirm the endpoint never writes to the QB -- status before and after
    a search call are identical."""
    record = _register_and_validate(_make_record(), qb_store_path)

    with conn() as c:
        before = store.fetch_status_history(c, record.question_id)

    uid_keyword = record.question_id.replace("QB-B3-", "B3-test-")
    client.post(
        _ENDPOINT,
        json={"query_text": uid_keyword},
        headers=auth_headers,
    )

    with conn() as c:
        after = store.fetch_status_history(c, record.question_id)

    assert before == after


# ---------------------------------------------------------------------------
# 21. No fabricated AI fields
# ---------------------------------------------------------------------------

def test_no_fabricated_ai_fields(client, auth_headers, qb_store_path):
    """Response must contain only real structural fields -- no confidence,
    AI score, relevance %, explanation or generated summary."""
    _register_and_validate(_make_record(), qb_store_path)
    response = client.post(
        _ENDPOINT, json={"query_text": "b3-test"}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    forbidden = {"confidence", "score", "relevance", "ai_explanation", "generated_summary",
                 "ai_score", "relevance_percent", "explanation"}
    top_keys = set(body.keys())
    assert not (forbidden & top_keys), f"Fabricated keys in top-level response: {forbidden & top_keys}"
    for result in body["results"]:
        result_keys = set(result.keys())
        assert not (forbidden & result_keys), f"Fabricated keys in result: {forbidden & result_keys}"


# ---------------------------------------------------------------------------
# 22. B1/B2 non-regression
# ---------------------------------------------------------------------------

def test_b1_schema_version_still_on_ai_query(client, auth_headers, qb_store_path):
    """B1: /api/ai/query still returns schema_version == '1.0'."""
    from backend.ai_gateway.llm_client import FakeModelClient
    app_module.app.dependency_overrides[route_module.get_model_client] = (
        lambda: FakeModelClient(fixed_text="b3 regression check")
    )
    try:
        response = client.post(
            "/api/ai/query",
            json={"query_text": "regression check"},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


def test_b2_empty_output_still_fails_closed(client, auth_headers):
    """B2: empty provider output still causes 503 on /api/ai/query."""
    from backend.ai_gateway.llm_client import AIModelClient, ModelResponse, PromptContext

    class _EmptyClient(AIModelClient):
        name = "b3-regression-empty"
        def complete(self, prompt_context: PromptContext) -> ModelResponse:
            return ModelResponse(text="", model_name=self.name)

    app_module.app.dependency_overrides[route_module.get_model_client] = lambda: _EmptyClient()
    try:
        response = client.post(
            "/api/ai/query",
            json={"query_text": "regression check"},
            headers=auth_headers,
        )
    finally:
        del app_module.app.dependency_overrides[route_module.get_model_client]
    assert response.status_code == 503
