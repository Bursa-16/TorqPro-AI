"""Stage 2 / Slice 3 test matrix for backend.documents.repository.

Uses ``backend.app.conn`` for the underlying SQLite connection --
safe and isolated, exactly like every other repository test in this
suite (``tests/production_validation/test_repository.py`` follows
the identical convention): ``tests/conftest.py`` already points
``TORQPRO_DB_PATH`` at a fresh temp file before ``backend.app`` is
even imported, so this never touches the real ``torqpro.db`` (Step
23's own requirement). ``repository.migrate(c)`` is called explicitly
in a fixture here because Slice 3 is deliberately NOT registered in
``backend.app``'s own central ``migrate()`` yet (deferred to Slice 4)
-- calling it per-test is itself part of proving it is idempotent
(Step 23).

This file tests ``backend.documents.repository`` in isolation, using
hand-built field values -- not real MarkItDown/Magika output (that
integration is ``test_ingestion_service.py``'s job).
"""

from __future__ import annotations

import json

import pytest

from backend.app import conn
from backend.documents import repository
from backend.documents.exceptions import (
    DocumentRecordNotFoundError,
    InvalidDocumentStateTransitionError,
)


@pytest.fixture()
def db():
    with conn() as c:
        repository.migrate(c)
        yield c


def _create_processing(c, **overrides):
    fields = dict(
        request_id="req-001",
        original_filename="report.pdf",
        extension=".pdf",
        file_size_bytes=1234,
        content_sha256="a" * 64,
        markitdown_version="0.1.7",
        created_by=1,
        created_at="2026-08-22T10:00:00+00:00",
    )
    fields.update(overrides)
    return repository.create_processing_record(c, **fields)


# ---------------------------------------------------------------------
# Step 23: migration idempotency
# ---------------------------------------------------------------------


class TestMigrationIdempotency:
    def test_migrate_twice_does_not_raise(self, db):
        repository.migrate(db)  # second call, on top of the fixture's own first call
        repository.migrate(db)  # third, for good measure

    def test_migrate_twice_preserves_existing_rows(self, db):
        document_id = _create_processing(db)
        repository.migrate(db)
        record = repository.get_owned(db, document_id, created_by=1)
        assert record is not None
        assert record.id == document_id


# ---------------------------------------------------------------------
# Step 19: nullability -- processing state
# ---------------------------------------------------------------------


class TestProcessingStateNullability:
    def test_processing_record_has_null_result_fields(self, db):
        document_id = _create_processing(db)
        record = repository.get_owned(db, document_id, created_by=1)
        assert record.status == "processing"
        assert record.detected_media_type is None
        assert record.markdown_text is None
        assert record.markdown_sha256 is None
        assert record.character_count is None
        assert record.error_summary is None

    def test_processing_record_has_empty_warnings_list_not_null(self, db):
        document_id = _create_processing(db)
        record = repository.get_owned(db, document_id, created_by=1)
        assert record.warnings == []

    def test_processing_record_original_retained_is_false(self, db):
        document_id = _create_processing(db)
        record = repository.get_owned(db, document_id, created_by=1)
        assert record.original_retained is False

    def test_processing_record_known_provenance_fields_populated(self, db):
        document_id = _create_processing(
            db,
            request_id="req-xyz",
            original_filename="spec.docx",
            extension=".docx",
            file_size_bytes=999,
            content_sha256="b" * 64,
            markitdown_version="0.1.7",
            created_by=7,
            created_at="2026-08-22T11:30:00+00:00",
        )
        record = repository.get_owned(db, document_id, created_by=7)
        assert record.request_id == "req-xyz"
        assert record.original_filename == "spec.docx"
        assert record.extension == ".docx"
        assert record.file_size_bytes == 999
        assert record.content_sha256 == "b" * 64
        assert record.extraction_method == "markitdown"
        assert record.markitdown_version == "0.1.7"
        assert record.created_by == 7
        assert record.created_at == "2026-08-22T11:30:00+00:00"


# ---------------------------------------------------------------------
# Step 9: immutable provenance across lifecycle transitions
# ---------------------------------------------------------------------


class TestImmutableProvenance:
    def test_mark_extracted_does_not_alter_provenance_fields(self, db):
        document_id = _create_processing(
            db,
            request_id="req-immutable",
            original_filename="untouched.pdf",
            extension=".pdf",
            file_size_bytes=42,
            content_sha256="c" * 64,
            markitdown_version="0.1.7",
            created_by=3,
            created_at="2026-08-22T12:00:00+00:00",
        )
        repository.mark_extracted(
            db,
            document_id,
            detected_media_type="pdf",
            markdown_text="Hello",
            markdown_sha256="d" * 64,
            character_count=5,
            warnings=[],
        )
        record = repository.get_owned(db, document_id, created_by=3)
        assert record.request_id == "req-immutable"
        assert record.original_filename == "untouched.pdf"
        assert record.extension == ".pdf"
        assert record.file_size_bytes == 42
        assert record.content_sha256 == "c" * 64
        assert record.extraction_method == "markitdown"
        assert record.markitdown_version == "0.1.7"
        assert record.created_by == 3
        assert record.created_at == "2026-08-22T12:00:00+00:00"
        assert record.original_retained is False

    def test_mark_failed_does_not_alter_provenance_fields(self, db):
        document_id = _create_processing(
            db,
            request_id="req-immutable-2",
            original_filename="untouched2.pdf",
            content_sha256="e" * 64,
            created_by=4,
        )
        repository.mark_failed(db, document_id, error_summary="content_type_mismatch")
        record = repository.get_owned(db, document_id, created_by=4)
        assert record.request_id == "req-immutable-2"
        assert record.original_filename == "untouched2.pdf"
        assert record.content_sha256 == "e" * 64
        assert record.created_by == 4

    def test_mark_failed_leaves_result_fields_null(self, db):
        document_id = _create_processing(db)
        record = repository.mark_failed(db, document_id, error_summary="extraction_failed")
        assert record.status == "failed"
        assert record.markdown_text is None
        assert record.markdown_sha256 is None
        assert record.character_count is None
        assert record.detected_media_type is None
        assert record.error_summary == "extraction_failed"


# ---------------------------------------------------------------------
# Step 20: state transitions
# ---------------------------------------------------------------------


class TestStateTransitions:
    def test_processing_to_extracted_allowed(self, db):
        document_id = _create_processing(db)
        record = repository.mark_extracted(
            db,
            document_id,
            detected_media_type="pdf",
            markdown_text="text",
            markdown_sha256="f" * 64,
            character_count=4,
            warnings=[],
        )
        assert record.status == "extracted"

    def test_processing_to_failed_allowed(self, db):
        document_id = _create_processing(db)
        record = repository.mark_failed(db, document_id, error_summary="extraction_failed")
        assert record.status == "failed"

    def test_extracted_to_extracted_again_rejected(self, db):
        document_id = _create_processing(db)
        repository.mark_extracted(
            db, document_id, detected_media_type="pdf", markdown_text="x",
            markdown_sha256="g" * 64, character_count=1, warnings=[],
        )
        with pytest.raises(InvalidDocumentStateTransitionError):
            repository.mark_extracted(
                db, document_id, detected_media_type="pdf", markdown_text="y",
                markdown_sha256="h" * 64, character_count=1, warnings=[],
            )

    def test_extracted_to_failed_rejected(self, db):
        document_id = _create_processing(db)
        repository.mark_extracted(
            db, document_id, detected_media_type="pdf", markdown_text="x",
            markdown_sha256="i" * 64, character_count=1, warnings=[],
        )
        with pytest.raises(InvalidDocumentStateTransitionError):
            repository.mark_failed(db, document_id, error_summary="extraction_failed")

    def test_failed_to_extracted_rejected(self, db):
        document_id = _create_processing(db)
        repository.mark_failed(db, document_id, error_summary="extraction_failed")
        with pytest.raises(InvalidDocumentStateTransitionError):
            repository.mark_extracted(
                db, document_id, detected_media_type="pdf", markdown_text="x",
                markdown_sha256="j" * 64, character_count=1, warnings=[],
            )

    def test_failed_to_failed_again_rejected(self, db):
        document_id = _create_processing(db)
        repository.mark_failed(db, document_id, error_summary="extraction_failed")
        with pytest.raises(InvalidDocumentStateTransitionError):
            repository.mark_failed(db, document_id, error_summary="content_type_mismatch")

    def test_mark_extracted_on_missing_id_raises_not_found(self, db):
        with pytest.raises(DocumentRecordNotFoundError):
            repository.mark_extracted(
                db, 999999999, detected_media_type="pdf", markdown_text="x",
                markdown_sha256="k" * 64, character_count=1, warnings=[],
            )

    def test_mark_failed_on_missing_id_raises_not_found(self, db):
        with pytest.raises(DocumentRecordNotFoundError):
            repository.mark_failed(db, 999999999, error_summary="extraction_failed")


# ---------------------------------------------------------------------
# Step 21: ownership
# ---------------------------------------------------------------------


class TestOwnership:
    def test_owner_retrieves_own_record(self, db):
        document_id = _create_processing(db, created_by=10)
        record = repository.get_owned(db, document_id, created_by=10)
        assert record is not None
        assert record.id == document_id

    def test_wrong_user_gets_none(self, db):
        document_id = _create_processing(db, created_by=10)
        record = repository.get_owned(db, document_id, created_by=99)
        assert record is None

    def test_nonexistent_id_gets_none(self, db):
        record = repository.get_owned(db, 999999999, created_by=10)
        assert record is None

    def test_wrong_owner_and_nonexistent_are_indistinguishable(self, db):
        # Both must yield the exact same (None) result via the same
        # public path -- no separate "exists but not yours" signal.
        document_id = _create_processing(db, created_by=10)
        wrong_owner_result = repository.get_owned(db, document_id, created_by=99)
        missing_result = repository.get_owned(db, 999999999, created_by=99)
        assert wrong_owner_result is None
        assert missing_result is None

    def test_internal_fetch_by_id_is_not_a_substitute_for_ownership_check(self, db):
        # _fetch_by_id (used internally by mark_extracted/mark_failed)
        # is deliberately not ownership-filtered -- confirm the
        # public, ownership-safe path is the one actually enforcing
        # the boundary, not an accident of _fetch_by_id being unsafe
        # too.
        document_id = _create_processing(db, created_by=10)
        raw_row = repository._fetch_by_id(db, document_id)
        assert raw_row is not None  # internal helper finds it regardless of owner
        owned = repository.get_owned(db, document_id, created_by=99)
        assert owned is None  # but the public path still correctly denies


# ---------------------------------------------------------------------
# Step 22: JSON / Turkish character fidelity
# ---------------------------------------------------------------------


class TestJsonAndTurkishFidelity:
    def test_warnings_with_turkish_characters_round_trip(self, db):
        document_id = _create_processing(db)
        turkish_warnings = [
            "Türkçe uyarı",
            "ölçüm şartname belirsizliği",
            "İĞÜŞÖÇ ığüşöç",
        ]
        record = repository.mark_extracted(
            db, document_id, detected_media_type="pdf", markdown_text="x",
            markdown_sha256="l" * 64, character_count=1, warnings=turkish_warnings,
        )
        assert record.warnings == turkish_warnings

    def test_markdown_text_with_turkish_characters_round_trips(self, db):
        document_id = _create_processing(db)
        turkish_markdown = "Gövde cıvata sıkıştırma İĞÜŞÖÇ ığüşöç ölçüm şartname değer"
        record = repository.mark_extracted(
            db, document_id, detected_media_type="pdf", markdown_text=turkish_markdown,
            markdown_sha256="m" * 64, character_count=len(turkish_markdown), warnings=[],
        )
        assert record.markdown_text == turkish_markdown
        for ch in "ıİşŞğĞüÜöÖçÇ":
            assert ch in record.markdown_text

    def test_original_filename_with_turkish_characters_round_trips(self, db):
        document_id = _create_processing(
            db, original_filename="Türkçe_Ölçüm_Şartname.pdf"
        )
        record = repository.get_owned(db, document_id, created_by=1)
        assert record.original_filename == "Türkçe_Ölçüm_Şartname.pdf"

    def test_warnings_json_uses_deterministic_encoding(self, db):
        document_id = _create_processing(db)
        repository.mark_extracted(
            db, document_id, detected_media_type="pdf", markdown_text="x",
            markdown_sha256="n" * 64, character_count=1,
            warnings=["Türkçe uyarı"],
        )
        with conn() as c2:
            row = c2.execute(
                "SELECT warnings_json FROM document_extractions WHERE id=?",
                (document_id,),
            ).fetchone()
        # ensure_ascii=False -- Turkish characters stored as literal
        # UTF-8 text, not \uXXXX escapes (Step 6's exact requirement).
        assert "Türkçe uyarı" in row["warnings_json"]
        assert "\\u" not in row["warnings_json"]
        # Deterministic separators (",", ":") -- no extraneous whitespace.
        parsed = json.loads(row["warnings_json"])
        assert parsed == ["Türkçe uyarı"]

    def test_malformed_warnings_json_fails_closed_on_read(self, db):
        document_id = _create_processing(db)
        with conn() as c2:
            c2.execute(
                "UPDATE document_extractions SET warnings_json=? WHERE id=?",
                ("{not valid json", document_id),
            )
            c2.commit()
        from backend.documents.exceptions import DocumentPersistenceError

        with pytest.raises(DocumentPersistenceError):
            repository.get_owned(db, document_id, created_by=1)

    def test_non_list_warnings_json_fails_closed_on_read(self, db):
        document_id = _create_processing(db)
        with conn() as c2:
            c2.execute(
                "UPDATE document_extractions SET warnings_json=? WHERE id=?",
                (json.dumps({"not": "a list"}), document_id),
            )
            c2.commit()
        from backend.documents.exceptions import DocumentPersistenceError

        with pytest.raises(DocumentPersistenceError):
            repository.get_owned(db, document_id, created_by=1)


# ---------------------------------------------------------------------
# original_retained CHECK constraint (Step 5)
# ---------------------------------------------------------------------


class TestOriginalRetainedConstraint:
    def test_original_retained_defaults_to_zero(self, db):
        document_id = _create_processing(db)
        with conn() as c2:
            row = c2.execute(
                "SELECT original_retained FROM document_extractions WHERE id=?",
                (document_id,),
            ).fetchone()
        assert row["original_retained"] == 0

    def test_original_retained_check_constraint_rejects_true(self, db):
        import sqlite3

        with pytest.raises(sqlite3.IntegrityError):
            db.execute(
                "INSERT INTO document_extractions("
                "request_id, original_filename, extension, file_size_bytes, "
                "content_sha256, extraction_method, markitdown_version, "
                "status, created_by, created_at, original_retained"
                ") VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (
                    "req-bad", "x.pdf", ".pdf", 1, "o" * 64, "markitdown",
                    "0.1.7", "processing", 1, "2026-08-22T00:00:00+00:00", 1,
                ),
            )


# ---------------------------------------------------------------------
# status CHECK constraint
# ---------------------------------------------------------------------


class TestStatusCheckConstraint:
    def test_status_check_constraint_rejects_unlocked_values(self, db):
        import sqlite3

        for bad_status in ("draft", "review", "approved", "rejected"):
            with pytest.raises(sqlite3.IntegrityError):
                db.execute(
                    "INSERT INTO document_extractions("
                    "request_id, original_filename, extension, file_size_bytes, "
                    "content_sha256, extraction_method, markitdown_version, "
                    "status, created_by, created_at"
                    ") VALUES(?,?,?,?,?,?,?,?,?,?)",
                    (
                        "req-bad", "x.pdf", ".pdf", 1, "p" * 64, "markitdown",
                        "0.1.7", bad_status, 1, "2026-08-22T00:00:00+00:00",
                    ),
                )
