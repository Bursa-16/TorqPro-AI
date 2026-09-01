"""Stage 2 / Slice 4 HTTP API test matrix for
backend.api.routes.documents.

Uses the shared, session-scoped ``client``/``auth_headers`` fixtures
already defined in ``tests/conftest.py`` (the established convention
for every other route-level test file in this repository) rather than
building a new TestClient -- this is the same isolated temp-file DB
every other test in the suite already runs against (see
``tests/conftest.py``'s own ``TORQPRO_DB_PATH`` setup), never the
real ``torqpro.db``.
"""

from __future__ import annotations

import pytest

from backend.app import conn
from tests.documents import fixtures


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------


def _upload(client, auth_headers, content: bytes, filename: str, request_id: str = None):
    headers = dict(auth_headers)
    if request_id is not None:
        headers["X-Request-ID"] = request_id
    return client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": (filename, content, "application/octet-stream")},
    )


def _second_user_headers(client):
    """Mirrors tests/production_validation/conftest.py's
    make_second_reviewer() pattern, with a distinct username to avoid
    collision with other test files creating their own second users
    in the same shared session DB."""
    admin_client_login = client.post(
        "/api/login", json={"username": "demo", "password": "A1234"}
    )
    admin_token = admin_client_login.json()["token"]
    admin_headers = {"Authorization": "Bearer " + admin_token}
    client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "username": "documents_second_user",
            "display_name": "Documents Second User",
            "password": "seconduserpass1",
            "role": "engineer",
        },
    )
    login = client.post(
        "/api/login",
        json={"username": "documents_second_user", "password": "seconduserpass1"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": "Bearer " + login.json()["token"]}


@pytest.fixture()
def second_user_headers(client):
    return _second_user_headers(client)


def _row_by_request_id(request_id: str):
    with conn() as c:
        return c.execute(
            "SELECT * FROM document_extractions WHERE request_id=?",
            (request_id,),
        ).fetchone()


def _audit_rows_by_request_id(request_id: str):
    with conn() as c:
        return c.execute(
            "SELECT * FROM audit_log WHERE request_id=? ORDER BY id",
            (request_id,),
        ).fetchall()


# ---------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------


class TestAuthentication:
    def test_unauthenticated_upload_rejected(self, client):
        content = fixtures.build_minimal_pdf()
        r = client.post(
            "/api/documents/upload",
            files={"file": ("spec.pdf", content, "application/pdf")},
        )
        assert r.status_code == 401

    def test_authenticated_upload_succeeds(self, client, auth_headers):
        content = fixtures.build_minimal_pdf()
        r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-auth-ok")
        assert r.status_code == 201, r.text

    def test_unauthenticated_get_rejected(self, client):
        r = client.get("/api/documents/1")
        assert r.status_code == 401

    def test_unauthenticated_list_rejected(self, client):
        r = client.get("/api/documents")
        assert r.status_code == 401


# ---------------------------------------------------------------------
# Ownership: created_by is server-derived only
# ---------------------------------------------------------------------


class TestOwnerInjectionRejected:
    def test_upload_endpoint_has_no_owner_field_to_inject(self, client, auth_headers):
        # There is no multipart field, query param, or JSON body this
        # endpoint accepts other than `file` itself -- attempting to
        # smuggle created_by/user_id/owner_id as extra multipart data
        # is simply ignored by FastAPI's UploadFile-only parameter
        # binding (there is nothing in the route signature that would
        # ever read it). This test proves the *positive* case: the
        # record's owner is provably the authenticated caller, never
        # whatever else was in the request.
        content = fixtures.build_minimal_pdf()
        r = client.post(
            "/api/documents/upload",
            headers=auth_headers,
            files={"file": ("spec.pdf", content, "application/pdf")},
            data={"created_by": "999999", "user_id": "999999", "owner_id": "999999"},
        )
        assert r.status_code == 201, r.text
        document_id = r.json()["id"]
        # Fetch as the actual authenticated admin user -- must succeed,
        # proving ownership was assigned to the real caller, not 999999.
        get_r = client.get(f"/api/documents/{document_id}", headers=auth_headers)
        assert get_r.status_code == 200


# ---------------------------------------------------------------------
# Format tests: PDF / DOCX / XLSX / PPTX
# ---------------------------------------------------------------------


class TestFormatUploads:
    def test_pdf_upload_succeeds_with_correct_metadata(self, client, auth_headers):
        content = fixtures.build_minimal_pdf("TorqPro API test document")
        r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-fmt-pdf")
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["status"] == "extracted"
        assert body["extension"] == ".pdf"
        assert body["detected_media_type"] == "pdf"
        assert body["extraction_method"] == "markitdown"
        assert body["markitdown_version"] == "0.1.7"
        assert body["original_retained"] is False
        assert len(body["content_sha256"]) == 64
        assert len(body["markdown_sha256"]) == 64
        assert "TorqPro API test document" in body["markdown_text"]
        assert body["warnings"] == []
        assert body["request_id"] == "req-fmt-pdf"

    def test_docx_upload_succeeds(self, client, auth_headers):
        content = fixtures.build_minimal_docx()
        r = _upload(client, auth_headers, content, "report.docx", request_id="req-fmt-docx")
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["status"] == "extracted"
        assert body["detected_media_type"] == "docx"
        assert "TorqPro Test Belgesi" in body["markdown_text"]

    def test_xlsx_upload_succeeds(self, client, auth_headers):
        content = fixtures.build_minimal_xlsx()
        r = _upload(client, auth_headers, content, "data.xlsx", request_id="req-fmt-xlsx")
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["status"] == "extracted"
        assert body["detected_media_type"] == "xlsx"

    def test_pptx_upload_succeeds(self, client, auth_headers):
        content = fixtures.build_minimal_pptx()
        r = _upload(client, auth_headers, content, "deck.pptx", request_id="req-fmt-pptx")
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["status"] == "extracted"
        assert body["detected_media_type"] == "pptx"


# ---------------------------------------------------------------------
# Size tests (Step 19)
# ---------------------------------------------------------------------


class TestSizeLimits:
    def test_exactly_15_mib_accepted_by_size_layer(self, client, auth_headers):
        # Content is NOT a valid PDF at this size (just padding) --
        # the point is proving the SIZE check specifically passes at
        # exactly the boundary (no 413), even though content-type
        # verification will still reject it afterward (415/422, not
        # 413 -- confirms the two checks are independent).
        content = b"%PDF-1.4\n" + b"x" * (15 * 1024 * 1024 - 9)
        assert len(content) == 15 * 1024 * 1024
        r = _upload(client, auth_headers, content, "big.pdf", request_id="req-size-exact")
        assert r.status_code != 413, r.text

    def test_15_mib_plus_one_byte_rejected_with_413(self, client, auth_headers):
        content = b"x" * (15 * 1024 * 1024 + 1)
        r = _upload(client, auth_headers, content, "toobig.pdf", request_id="req-size-over")
        assert r.status_code == 413, r.text
        assert r.json()["detail"]["error"] == "document_too_large"

    def test_bounded_reader_stops_after_limit_not_unbounded(self):
        # Direct unit test of the bounded-reader helper itself (Step
        # 19's own suggested approach: "use a fake/instrumented
        # upload stream... to prove bounded behavior without creating
        # huge repeated test objects"). Proves the function performs
        # a small, bounded number of read() calls before rejecting,
        # not one call per byte or an unbounded loop.
        import asyncio

        from backend.api.routes.documents import _READ_CHUNK_SIZE, _read_bounded
        from backend.documents.exceptions import DocumentTooLargeError

        max_bytes = 10  # tiny limit so the test itself stays tiny
        call_count = 0

        class _FakeUploadFile:
            async def read(self, n):
                nonlocal call_count
                call_count += 1
                # Always return a full chunk of 'x' bytes, as if an
                # arbitrarily large (even infinite) stream were behind
                # this file -- if _read_bounded ever failed to stop,
                # this fixture would happily keep supplying data
                # forever.
                return b"x" * min(n, _READ_CHUNK_SIZE)

        with pytest.raises(DocumentTooLargeError):
            asyncio.run(_read_bounded(_FakeUploadFile(), max_bytes))

        # With a 1 MiB chunk size and a 10-byte limit, exactly one
        # read() call is enough to exceed the limit and stop -- a
        # small, bounded number, never proportional to some huge
        # hypothetical stream length.
        assert call_count <= 2


# ---------------------------------------------------------------------
# Malicious content tests (Step 20)
# ---------------------------------------------------------------------


class TestMaliciousContent:
    def test_text_renamed_pdf_rejected(self, client, auth_headers):
        content = b"This is plain text content with no PDF structure whatsoever."
        r = _upload(client, auth_headers, content, "fake.pdf", request_id="req-mal-textpdf")
        assert r.status_code == 415, r.text
        assert r.json()["detail"]["error"] == "content_type_mismatch"

    def test_generic_zip_renamed_docx_rejected(self, client, auth_headers):
        content = fixtures.build_generic_zip()
        r = _upload(client, auth_headers, content, "fake.docx", request_id="req-mal-zipdocx")
        assert r.status_code in (415, 422), r.text
        assert r.json()["detail"]["error"] in ("content_type_mismatch", "malformed_ooxml")

    def test_generic_zip_renamed_xlsx_rejected(self, client, auth_headers):
        content = fixtures.build_generic_zip()
        r = _upload(client, auth_headers, content, "fake.xlsx", request_id="req-mal-zipxlsx")
        assert r.status_code in (415, 422), r.text

    def test_malformed_ooxml_missing_required_part_rejected(self, client, auth_headers):
        # Structurally-valid ZIP, has [Content_Types].xml, but is
        # missing the required format-specific part -- exercises the
        # OOXML structural check specifically (distinct from a
        # generic non-OOXML zip, which is caught earlier by Magika).
        import io
        import zipfile

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("[Content_Types].xml", "<Types/>")
        content = buf.getvalue()
        r = _upload(client, auth_headers, content, "broken.docx", request_id="req-mal-missing")
        assert r.status_code in (415, 422), r.text

    def test_unsupported_extension_rejected(self, client, auth_headers):
        r = _upload(client, auth_headers, b"anything", "malware.exe", request_id="req-mal-ext")
        assert r.status_code == 415, r.text
        assert r.json()["detail"]["error"] == "unsupported_document_format"

    def test_empty_file_rejected(self, client, auth_headers):
        r = _upload(client, auth_headers, b"", "empty.pdf", request_id="req-mal-empty")
        assert r.status_code == 422, r.text
        assert r.json()["detail"]["error"] == "empty_document"

    def test_no_third_party_traceback_leaked(self, client, auth_headers):
        content = b"plain text renamed to pdf"
        r = _upload(client, auth_headers, content, "fake.pdf", request_id="req-mal-noleak")
        body_text = r.text
        assert "Traceback" not in body_text
        assert "site-packages" not in body_text
        assert "/home/" not in body_text


# ---------------------------------------------------------------------
# Failure-persistence test (Step 21, mandatory)
# ---------------------------------------------------------------------


class TestFailurePersistence:
    def test_failed_upload_persists_stable_failed_record(self, client, auth_headers):
        content = b"plain text renamed to pdf, not real content"
        r = _upload(
            client, auth_headers, content, "fake.pdf", request_id="req-persist-fail-001"
        )
        assert r.status_code == 415

        row = _row_by_request_id("req-persist-fail-001")
        assert row is not None
        assert row["status"] == "failed"
        assert row["error_summary"] == "content_type_mismatch"
        assert row["markdown_text"] is None
        assert row["original_retained"] == 0
        assert row["request_id"] == "req-persist-fail-001"

    def test_failed_row_not_deleted_or_rolled_back(self, client, auth_headers):
        r = _upload(
            client, auth_headers, b"", "empty.pdf", request_id="req-persist-fail-002"
        )
        assert r.status_code == 422
        row = _row_by_request_id("req-persist-fail-002")
        assert row is not None
        assert row["status"] == "failed"


# ---------------------------------------------------------------------
# Request-ID propagation (Step 7)
# ---------------------------------------------------------------------


class TestRequestIdPropagation:
    def test_request_id_flows_to_response_db_and_audit(self, client, auth_headers):
        content = fixtures.build_minimal_pdf()
        r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-propagate-001")
        assert r.status_code == 201
        assert r.json()["request_id"] == "req-propagate-001"

        row = _row_by_request_id("req-propagate-001")
        assert row is not None
        assert row["request_id"] == "req-propagate-001"

        audit_rows = _audit_rows_by_request_id("req-propagate-001")
        assert len(audit_rows) >= 1
        assert all(a["request_id"] == "req-propagate-001" for a in audit_rows)

    def test_missing_request_id_header_does_not_error(self, client, auth_headers):
        # No X-Request-ID supplied -- must not crash; stored as ""
        # exactly like every other existing authenticated endpoint's
        # own Header(default="", alias="X-Request-ID") convention
        # (e.g. torque_recommendation.py).
        content = fixtures.build_minimal_pdf()
        r = _upload(client, auth_headers, content, "spec.pdf")  # no request_id kwarg
        assert r.status_code == 201, r.text
        assert r.json()["request_id"] == ""


# ---------------------------------------------------------------------
# Ownership tests: GET single record (Step 22)
# ---------------------------------------------------------------------


class TestGetOwnership:
    def test_owner_gets_200(self, client, auth_headers):
        content = fixtures.build_minimal_pdf()
        upload_r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-own-1")
        document_id = upload_r.json()["id"]
        r = client.get(f"/api/documents/{document_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == document_id

    def test_different_user_gets_404_not_403(self, client, auth_headers, second_user_headers):
        content = fixtures.build_minimal_pdf()
        upload_r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-own-2")
        document_id = upload_r.json()["id"]
        r = client.get(f"/api/documents/{document_id}", headers=second_user_headers)
        assert r.status_code == 404

    def test_nonexistent_id_gets_404(self, client, auth_headers):
        r = client.get("/api/documents/999999999", headers=auth_headers)
        assert r.status_code == 404

    def test_wrong_owner_and_nonexistent_return_identical_body_shape(
        self, client, auth_headers, second_user_headers
    ):
        content = fixtures.build_minimal_pdf()
        upload_r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-own-3")
        document_id = upload_r.json()["id"]
        wrong_owner_r = client.get(f"/api/documents/{document_id}", headers=second_user_headers)
        missing_r = client.get("/api/documents/999999998", headers=auth_headers)
        assert wrong_owner_r.status_code == missing_r.status_code == 404
        assert set(wrong_owner_r.json().keys()) == set(missing_r.json().keys())


# ---------------------------------------------------------------------
# List endpoint tests (Step 22)
# ---------------------------------------------------------------------


class TestListDocuments:
    def test_list_returns_only_own_records(self, client, auth_headers, second_user_headers):
        content = fixtures.build_minimal_pdf()
        _upload(client, second_user_headers, content, "other_user_doc.pdf", request_id="req-list-other")

        list_r = client.get("/api/documents", headers=second_user_headers)
        assert list_r.status_code == 200
        filenames = [d["original_filename"] for d in list_r.json()["documents"]]
        assert "other_user_doc.pdf" in filenames

        # The admin's own list must not include the second user's doc.
        admin_list_r = client.get("/api/documents", headers=auth_headers)
        admin_filenames = [d["original_filename"] for d in admin_list_r.json()["documents"]]
        assert "other_user_doc.pdf" not in admin_filenames

    def test_list_deterministic_order(self, client, second_user_headers):
        content = fixtures.build_minimal_pdf()
        _upload(client, second_user_headers, content, "order_a.pdf", request_id="req-order-a")
        _upload(client, second_user_headers, content, "order_b.pdf", request_id="req-order-b")
        list_r = client.get("/api/documents", headers=second_user_headers, params={"limit": 100})
        docs = list_r.json()["documents"]
        ids = [d["id"] for d in docs]
        assert ids == sorted(ids, reverse=True)  # id DESC among identical/near-identical created_at

    def test_list_pagination_bounds(self, client, second_user_headers):
        r = client.get("/api/documents", headers=second_user_headers, params={"limit": 1})
        assert r.status_code == 200
        assert len(r.json()["documents"]) <= 1


# ---------------------------------------------------------------------
# Migration test (Step 23)
# ---------------------------------------------------------------------


class TestMigration:
    def test_application_migrate_twice_is_idempotent_and_table_exists(self):
        from backend.app import migrate as app_migrate

        app_migrate()  # second call beyond conftest.py's own initial call
        app_migrate()  # third, for good measure
        with conn() as c:
            row = c.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='document_extractions'"
            ).fetchone()
        assert row is not None

    def test_existing_unrelated_table_not_damaged_by_repeated_migration(self):
        from backend.app import migrate as app_migrate

        with conn() as c:
            before = c.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
        app_migrate()
        with conn() as c:
            after = c.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
        assert before == after


# ---------------------------------------------------------------------
# Audit tests (Step 24)
# ---------------------------------------------------------------------


class TestAudit:
    def test_successful_upload_produces_audit_events(self, client, auth_headers):
        content = fixtures.build_minimal_pdf()
        r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-audit-success")
        assert r.status_code == 201
        rows = _audit_rows_by_request_id("req-audit-success")
        actions = [row["action"] for row in rows]
        assert "document_upload_started" in actions
        assert "document_extraction_succeeded" in actions

    def test_failed_upload_produces_failure_audit_event(self, client, auth_headers):
        content = b"plain text renamed to pdf"
        r = _upload(client, auth_headers, content, "fake.pdf", request_id="req-audit-fail")
        assert r.status_code == 415
        rows = _audit_rows_by_request_id("req-audit-fail")
        actions = [row["action"] for row in rows]
        assert "document_extraction_failed" in actions

    def test_audit_metadata_contains_no_markdown_or_binary_or_traceback(self, client, auth_headers):
        content = fixtures.build_minimal_pdf("SECRET_MARKDOWN_MARKER_TEXT")
        r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-audit-safe")
        assert r.status_code == 201
        rows = _audit_rows_by_request_id("req-audit-safe")
        for row in rows:
            detail = row["detail"] or ""
            assert "SECRET_MARKDOWN_MARKER_TEXT" not in detail
            assert "Traceback" not in detail
            assert content not in detail.encode("utf-8", errors="ignore")

    def test_get_produces_document_retrieved_audit_event(self, client, auth_headers):
        content = fixtures.build_minimal_pdf()
        upload_r = _upload(client, auth_headers, content, "spec.pdf", request_id="req-audit-get")
        document_id = upload_r.json()["id"]
        get_r = client.get(
            f"/api/documents/{document_id}",
            headers={**auth_headers, "X-Request-ID": "req-audit-get-retrieve"},
        )
        assert get_r.status_code == 200
        rows = _audit_rows_by_request_id("req-audit-get-retrieve")
        actions = [row["action"] for row in rows]
        assert "document_retrieved" in actions
