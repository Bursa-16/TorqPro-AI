"""AI-B5 -- POST /api/ai/question-bank/explain endpoint tests.

Covers all 34 required test cases from the AI-B5 task spec:
auth, exact-record, schema_version, evidence anchoring, approved answer
distinct from AI explanation, lifecycle exclusions, unknown/non-publishable
safe failure, clarification acceptance/rejection, extra-field rejection,
provider output validation (B2), provider failure/timeout/unavailable,
raw exception non-leakage, no QB write, no lifecycle mutation, audit,
prompt/evidence separation, DeterministicModelClient not used as fallback,
QB Search preservation, B1–B4 regression.
"""

from __future__ import annotations

import uuid

import pytest

from backend import app as app_module
from backend.ai_gateway.exceptions import ModelTimeoutError, ModelUnavailableError
from backend.ai_gateway.llm_client import (
    AIModelClient,
    FakeModelClient,
    ModelResponse,
    PromptContext,
    RaisingModelClient,
)
from backend.api.routes import ai_gateway as route_module
from backend.api.routes.ai_gateway import MAX_MODEL_OUTPUT_CHARS
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

_EXPLAIN_ENDPOINT = "/api/ai/question-bank/explain"
_SEARCH_ENDPOINT = "/api/ai/question-bank/search"
_QUERY_ENDPOINT = "/api/ai/query"

_FAKE_EXPLANATION = "Bu deterministik cıvata sıkma torku hesabının açıklamasıdır."


def _allow_all(role: str, action: str) -> bool:
    return True


def _make_record(**overrides) -> QuestionRecord:
    uid = uuid.uuid4().hex[:8].upper()
    base = dict(
        question_id=f"QB-B5-{uid}",
        content_version=1,
        category=Category.TIGHTENING_TORQUE,
        subcategory=None,
        difficulty=Difficulty.BEGINNER,
        question_type=QuestionType.SINGLE_CHOICE,
        question_tr=f"B5-{uid} cıvata sıkma torku sorusu.",
        question_en=f"B5-{uid} bolt tightening torque question.",
        options_tr=["A", "B", "C"],
        options_en=["A", "B", "C"],
        correct_answer=0,
        technical_explanation_tr="B5 test açıklama metni en az yirmi karakter.",
        technical_explanation_en="B5 test explanation text at least twenty characters.",
        standard_reference=None,
        source_reference=SourceReference(
            source_type=SourceType.INTERNAL_ENGINE, description="b5-test"
        ),
        source_locator=None,
        traceability_level=TraceabilityLevel.PROVISIONAL,
        tags=["b5-test"],
        learning_objective="B5 test öğrenme hedefi.",
        engineering_risk_level=EngineeringRiskLevel.LOW,
        is_active=True,
    )
    base.update(overrides)
    return QuestionRecord(**base)


@pytest.fixture()
def qb_store_path(tmp_path, monkeypatch):
    path = tmp_path / f"qb_b5_{uuid.uuid4().hex}.json"
    monkeypatch.setattr(store, "DATA_PATH", path)
    return path


def _register_and_validate(record, qb_store_path):
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
    store.save_question_content(record, path=qb_store_path)
    with conn() as c:
        service.register_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
        )
    return record


def _register_and_submit(record, qb_store_path):
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
            actor_role="admin", reason="b5-test", authorize=_allow_all,
        )
    return record


def _register_validate_deprecate(record, qb_store_path):
    _register_and_validate(record, qb_store_path)
    with conn() as c:
        service.deprecate_question(
            c, question_id=record.question_id,
            content_version=record.content_version, actor="t",
            actor_role="admin", authorize=_allow_all,
        )
    return record


def _with_fake(client_instance):
    app_module.app.dependency_overrides[route_module.get_model_client] = (
        lambda: client_instance
    )


def _clear_client():
    app_module.app.dependency_overrides.pop(route_module.get_model_client, None)


# ---------------------------------------------------------------------------
# 1. Auth required
# ---------------------------------------------------------------------------

def test_auth_required(client):
    response = client.post(_EXPLAIN_ENDPOINT, json={"question_id": "QB-B5-FAKE"})
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 2. Exact approved question_id succeeds with fake provider
# ---------------------------------------------------------------------------

def test_exact_approved_question_id_succeeds(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    fake = FakeModelClient(fixed_text=_FAKE_EXPLANATION)
    _with_fake(fake)
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    body = response.json()
    assert body["question_id"] == record.question_id
    assert body["explanation"] == _FAKE_EXPLANATION


# ---------------------------------------------------------------------------
# 3. schema_version == "1.0"
# ---------------------------------------------------------------------------

def test_schema_version_is_1_0(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


# ---------------------------------------------------------------------------
# 4. Returned evidence is anchored to the requested exact record
# ---------------------------------------------------------------------------

def test_evidence_anchored_to_exact_request_record(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    body = response.json()
    assert len(body["evidence"]) == 1
    ev = body["evidence"][0]
    assert ev["source_id"] == record.question_id
    assert ev["source_type"] == "question_bank"


# ---------------------------------------------------------------------------
# 5. Approved answer remains distinct from AI explanation
# ---------------------------------------------------------------------------

def test_approved_source_and_ai_explanation_structurally_distinct(
    client, auth_headers, qb_store_path
):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    body = response.json()
    # "explanation" is the AI-generated advisory text.
    assert "explanation" in body
    # "evidence" contains the approved QB source fields (never modified).
    assert "evidence" in body
    ev = body["evidence"][0]
    # The approved source technical explanation is in body_tr/body_en.
    assert ev["body_tr"] == record.technical_explanation_tr
    assert ev["body_en"] == record.technical_explanation_en
    # AI explanation must NOT be the same field as the approved body text.
    assert body["explanation"] != ev["body_tr"]
    assert body["explanation"] != ev["body_en"]


# ---------------------------------------------------------------------------
# 6-9. Draft / technical_review / rejected / deprecated cannot be explained
# ---------------------------------------------------------------------------

def test_draft_cannot_be_explained(client, auth_headers, qb_store_path):
    record = _register_only(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 404
    assert "schema_version" not in response.json()


def test_technical_review_cannot_be_explained(client, auth_headers, qb_store_path):
    record = _register_and_submit(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 404


def test_rejected_cannot_be_explained(client, auth_headers, qb_store_path):
    record = _register_and_reject(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 404


def test_deprecated_cannot_be_explained(client, auth_headers, qb_store_path):
    record = _register_validate_deprecate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 10. Unknown ID safe failure
# ---------------------------------------------------------------------------

def test_unknown_id_safe_failure(client, auth_headers):
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": "QB-B5-DOES-NOT-EXIST-EVER"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 11. Unpublished content not leaked in error
# ---------------------------------------------------------------------------

def test_unpublished_content_not_leaked_in_404(client, auth_headers, qb_store_path):
    record = _register_only(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 404
    body_str = str(response.json())
    # The approved source text must never appear in any error response.
    assert record.technical_explanation_tr not in body_str
    assert record.question_tr not in body_str


# ---------------------------------------------------------------------------
# 12. Clarification question accepted
# ---------------------------------------------------------------------------

def test_clarification_question_accepted(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={
                "question_id": record.question_id,
                "clarification_question": "Bu değer hangi standarda göre hesaplanır?",
            },
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    assert response.json()["explanation"] == _FAKE_EXPLANATION


# ---------------------------------------------------------------------------
# 13-14. Empty / whitespace clarification rejected
# ---------------------------------------------------------------------------

def test_empty_clarification_rejected(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id, "clarification_question": ""},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 400


def test_whitespace_clarification_rejected(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={
                "question_id": record.question_id,
                "clarification_question": "   \t\n  ",
            },
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 15. Oversized clarification rejected
# ---------------------------------------------------------------------------

def test_oversized_clarification_rejected(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    long_clarification = "A" * (MAX_MODEL_OUTPUT_CHARS + 1)  # > 4000 chars (same bound)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={
                "question_id": record.question_id,
                "clarification_question": long_clarification,
            },
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 16. Extra request fields forbidden
# ---------------------------------------------------------------------------

def test_extra_request_fields_forbidden(client, auth_headers):
    response = client.post(
        _EXPLAIN_ENDPOINT,
        json={"question_id": "QB-FAKE", "publishable_only": False, "extra_field": "x"},
        headers=auth_headers,
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# 17-19. Provider output validation (B2) preserved: empty / whitespace / oversized
# ---------------------------------------------------------------------------

class _EmptyOutputClient(AIModelClient):
    name = "b5-empty-output"
    def complete(self, p: PromptContext, *, timeout_seconds=None) -> ModelResponse:
        return ModelResponse(text="", model_name=self.name)


class _WhitespaceOutputClient(AIModelClient):
    name = "b5-ws-output"
    def complete(self, p: PromptContext, *, timeout_seconds=None) -> ModelResponse:
        return ModelResponse(text="   \n  ", model_name=self.name)


class _OversizedOutputClient(AIModelClient):
    name = "b5-oversized-output"
    def complete(self, p: PromptContext, *, timeout_seconds=None) -> ModelResponse:
        return ModelResponse(text="X" * (MAX_MODEL_OUTPUT_CHARS + 1), model_name=self.name)


def test_provider_output_empty_fails_closed(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(_EmptyOutputClient())
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 503


def test_provider_output_whitespace_fails_closed(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(_WhitespaceOutputClient())
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 503


def test_provider_output_oversized_fails_closed(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(_OversizedOutputClient())
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 503


# ---------------------------------------------------------------------------
# 20. Provider unavailable => safe failure
# ---------------------------------------------------------------------------

def test_provider_unavailable_safe_failure(
    client, auth_headers, qb_store_path, monkeypatch
):
    record = _register_and_validate(_make_record(), qb_store_path)
    # v3.2.0: the production default falls back to the deterministic
    # provider, so a 503 requires a registry with no query-capable
    # provider at all (explicit fail-closed path).
    from backend.ai_gateway.providers.registry import ProviderRegistry

    monkeypatch.setattr(route_module, "_PROVIDER_REGISTRY", ProviderRegistry())
    response = client.post(
        _EXPLAIN_ENDPOINT,
        json={"question_id": record.question_id},
        headers=auth_headers,
    )
    assert response.status_code == 503


# ---------------------------------------------------------------------------
# 21. Provider timeout => safe failure
# ---------------------------------------------------------------------------

class _TimeoutClient(AIModelClient):
    name = "b5-timeout"
    def complete(self, p: PromptContext, *, timeout_seconds=None) -> ModelResponse:
        raise ModelTimeoutError("b5 provider timeout")


def test_provider_timeout_safe_failure(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(_TimeoutClient())
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 503


# ---------------------------------------------------------------------------
# 22. Generic provider error => safe failure
# ---------------------------------------------------------------------------

class _GenericErrorClient(AIModelClient):
    name = "b5-generic-error"
    def complete(self, p: PromptContext, *, timeout_seconds=None) -> ModelResponse:
        raise ConnectionError("b5-CANARY-raw-error")


def test_generic_provider_error_safe_failure(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(_GenericErrorClient())
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code in (503, 500)


# ---------------------------------------------------------------------------
# 23. Raw provider exception text not leaked
# ---------------------------------------------------------------------------

def test_raw_provider_exception_not_leaked(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(_GenericErrorClient())
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert "b5-CANARY-raw-error" not in str(response.json())


# ---------------------------------------------------------------------------
# 24. Exact evidence record is chosen by request, not model
# ---------------------------------------------------------------------------

def test_evidence_chosen_by_request_not_model(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    # Model text contains a fabricated reference to a different source.
    fabricated = (
        f"Bu hesabı [question_bank #QB-FAKE-99999 v1] göre yapınız."
    )
    _with_fake(FakeModelClient(fixed_text=fabricated))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    body = response.json()
    # Evidence must be the requested record, not the model's fabricated one.
    evidence_ids = [e["source_id"] for e in body["evidence"]]
    assert record.question_id in evidence_ids
    assert "QB-FAKE-99999" not in evidence_ids


# ---------------------------------------------------------------------------
# 25. No QB write occurs
# ---------------------------------------------------------------------------

def test_no_qb_write_occurs(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    with conn() as c:
        before = store.fetch_status_history(c, record.question_id)

    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()

    with conn() as c:
        after = store.fetch_status_history(c, record.question_id)
    assert before == after


# ---------------------------------------------------------------------------
# 26. No lifecycle mutation occurs
# ---------------------------------------------------------------------------

def test_no_lifecycle_mutation(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    with conn() as c:
        before = store.fetch_lifecycle_audit(c, record.question_id)

    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()

    with conn() as c:
        after = store.fetch_lifecycle_audit(c, record.question_id)
    assert before == after


# ---------------------------------------------------------------------------
# 27. Audit record written for successful generative interaction
# ---------------------------------------------------------------------------

def test_audit_record_written_on_success(client, auth_headers, qb_store_path):
    from backend.ai_gateway.store import list_audit_records
    record = _register_and_validate(_make_record(), qb_store_path)
    with conn() as c:
        before_count = len(list_audit_records(c, limit=500))

    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    # audit_trace_id in response confirms audit was written.
    body = response.json()
    assert "audit_trace_id" in body
    assert body["audit_trace_id"] is not None

    with conn() as c:
        after_count = len(list_audit_records(c, limit=500))
    assert after_count == before_count + 1


# ---------------------------------------------------------------------------
# 28. Failure audit recorded on provider failure
# ---------------------------------------------------------------------------

def test_audit_failure_recorded_on_provider_failure(client, auth_headers, qb_store_path):
    from backend.ai_gateway.store import list_audit_records
    record = _register_and_validate(_make_record(), qb_store_path)
    with conn() as c:
        before_count = len(list_audit_records(c, limit=500))

    _with_fake(_EmptyOutputClient())
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 503

    with conn() as c:
        after_count = len(list_audit_records(c, limit=500))
    assert after_count == before_count + 1


# ---------------------------------------------------------------------------
# 29. No raw prompt/response persistence regression
# ---------------------------------------------------------------------------

def test_no_raw_prompt_or_response_in_audit(client, auth_headers, qb_store_path):
    """Audit records contain only hashes, never raw text."""
    from backend.ai_gateway.store import list_audit_records
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()

    with conn() as c:
        records = list_audit_records(c, limit=1)

    latest = records[0] if records else None
    assert latest is not None
    # PersistedAuditRecord has no raw_prompt or raw_response field --
    # confirm the type only carries hash fields (structural check).
    assert not hasattr(latest, "raw_prompt")
    assert not hasattr(latest, "raw_response")
    # The hash fields should be populated (not None).
    assert latest.query_text_hash is not None


# ---------------------------------------------------------------------------
# 30. Deterministic fallback is explicit and self-identifying (v3.2.0)
# ---------------------------------------------------------------------------

def test_deterministic_fallback_is_explicit_and_labeled(
    client, auth_headers, qb_store_path, monkeypatch
):
    """v3.2.0: with the deterministic-only default registry the explain
    endpoint returns a safe 200 whose explanation self-identifies the
    deterministic provider -- never a silent real-AI claim."""
    from backend.ai_gateway.providers.registry import build_default_registry

    record = _register_and_validate(_make_record(), qb_store_path)
    monkeypatch.setattr(
        route_module, "_PROVIDER_REGISTRY", build_default_registry()
    )
    response = client.post(
        _EXPLAIN_ENDPOINT,
        json={"question_id": record.question_id},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert "deterministic" in str(body.get("explanation", "")).lower()


# ---------------------------------------------------------------------------
# 31. QB Search still works with no provider
# ---------------------------------------------------------------------------

def test_qb_search_still_works_with_no_provider(client, auth_headers):
    """B3 preservation: QB Search remains provider-independent."""
    response = client.post(
        _SEARCH_ENDPOINT,
        json={"query_text": "torque"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


# ---------------------------------------------------------------------------
# 32. B1–B4 regression: AI query schema_version preserved
# ---------------------------------------------------------------------------

def test_b1_b4_regression_ai_query_schema_version(client, auth_headers):
    fake = FakeModelClient(fixed_text="b5 regression test")
    _with_fake(fake)
    try:
        response = client.post(
            _QUERY_ENDPOINT,
            json={"query_text": "regression test"},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    assert response.json()["schema_version"] == "1.0"


# ---------------------------------------------------------------------------
# 33. Prompt/evidence separation: provider prose cannot alter approved source
# ---------------------------------------------------------------------------

def test_provider_prose_cannot_alter_approved_source_in_response(
    client, auth_headers, qb_store_path
):
    """The 'evidence' key in the response always reflects the exact approved
    QB record -- it must never be overwritten by anything the model returns."""
    record = _register_and_validate(_make_record(), qb_store_path)
    # Model returns text that could look like a field override attempt.
    injection_text = (
        '{"body_tr": "INJECTED", "source_id": "INJECTED_ID"}'
    )
    _with_fake(FakeModelClient(fixed_text=injection_text))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    assert response.status_code == 200
    body = response.json()
    ev = body["evidence"][0]
    # Evidence is still the real approved source, not the model's injection.
    assert ev["source_id"] == record.question_id
    assert ev["body_tr"] == record.technical_explanation_tr
    # The injection text appears only in explanation (advisory only).
    assert body["explanation"] == injection_text


# ---------------------------------------------------------------------------
# 34. Limitations field present
# ---------------------------------------------------------------------------

def test_limitations_present_in_response(client, auth_headers, qb_store_path):
    record = _register_and_validate(_make_record(), qb_store_path)
    _with_fake(FakeModelClient(fixed_text=_FAKE_EXPLANATION))
    try:
        response = client.post(
            _EXPLAIN_ENDPOINT,
            json={"question_id": record.question_id},
            headers=auth_headers,
        )
    finally:
        _clear_client()
    body = response.json()
    assert "limitations" in body
    assert isinstance(body["limitations"], list)
    assert len(body["limitations"]) > 0
