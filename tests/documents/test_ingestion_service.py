"""Stage 2 / Slice 3 test matrix for backend.documents.ingestion_service.

Uses the same ``backend.app.conn``-based DB isolation as
``test_repository.py`` (see that file's module docstring), plus the
real hand-crafted PDF/DOCX/XLSX/PPTX fixtures from
``tests.documents.fixtures`` (Slice 2) to exercise
``ingest_document()`` end-to-end through the real Magika/MarkItDown
stack for the success path (Step 17), and fake detector/converter
injection for controlled failure scenarios (Step 18) -- mirroring
``test_markitdown_adapter.py``'s own established pattern for each.
"""

from __future__ import annotations

import pytest

from backend.app import conn
from backend.documents import repository
from backend.documents.exceptions import (
    ContentTypeMismatchError,
    EmptyExtractionError,
    ExtractionFailedError,
    MalformedOOXMLError,
    UnsupportedExtensionError,
)
from backend.documents.ingestion_service import ingest_document
from tests.documents import fixtures


@pytest.fixture()
def db():
    with conn() as c:
        repository.migrate(c)
        yield c


class _AcceptingDetector:
    def __init__(self, label: str) -> None:
        self._label = label

    def detect(self, content: bytes):
        return self._label


class _ExplodingConverter:
    """Simulates a MarkItDown-layer failure without needing a real
    corrupt document -- mirrors test_markitdown_adapter.py's own
    pattern for exercising ExtractionFailedError."""

    def convert(self, content, *, filename, extension):
        raise RuntimeError("simulated MarkItDown internal failure")


class _EmptyOutputConverter:
    def convert(self, content, *, filename, extension):
        return ""


# ---------------------------------------------------------------------
# Step 17: success flow, real Magika + real MarkItDown, all 4 formats
# ---------------------------------------------------------------------


class TestSuccessfulIngestion:
    @pytest.mark.parametrize(
        "builder,filename",
        [
            (fixtures.build_minimal_pdf, "spec_sheet.pdf"),
            (fixtures.build_minimal_docx, "report.docx"),
            (fixtures.build_minimal_xlsx, "data.xlsx"),
            (fixtures.build_minimal_pptx, "deck.pptx"),
        ],
    )
    def test_successful_ingestion_end_to_end(self, db, builder, filename):
        content = builder()
        record = ingest_document(
            db,
            content=content,
            filename=filename,
            created_by=42,
            request_id="req-success-001",
            created_at="2026-08-22T09:00:00+00:00",
        )
        assert record.status == "extracted"
        assert record.original_retained is False
        assert record.markdown_text.strip() != ""
        assert len(record.markdown_sha256) == 64
        assert len(record.content_sha256) == 64
        assert record.markitdown_version == "0.1.7"
        assert record.created_by == 42
        assert record.request_id == "req-success-001"
        assert record.warnings == []

    def test_successful_ingestion_persisted_and_retrievable(self, db):
        content = fixtures.build_minimal_pdf("TorqPro persisted test")
        record = ingest_document(
            db,
            content=content,
            filename="spec_sheet.pdf",
            created_by=7,
            request_id="req-persist-001",
            created_at="2026-08-22T09:05:00+00:00",
        )
        fetched = repository.get_owned(db, record.id, created_by=7)
        assert fetched is not None
        assert fetched.status == "extracted"
        assert "TorqPro persisted test" in fetched.markdown_text

    def test_detected_media_type_matches_format(self, db):
        content = fixtures.build_minimal_docx()
        record = ingest_document(
            db,
            content=content,
            filename="report.docx",
            created_by=1,
            request_id="req-media-type",
            created_at="2026-08-22T09:10:00+00:00",
        )
        assert record.detected_media_type == "docx"

    def test_warnings_list_round_trips_through_persistence(self, db):
        # Slice 2's real extraction always produces an empty list
        # (MarkItDown 0.1.7 exposes no warning API) -- this test
        # confirms that empty list specifically round-trips as an
        # empty list, not None or a missing key.
        content = fixtures.build_minimal_pdf()
        record = ingest_document(
            db,
            content=content,
            filename="spec_sheet.pdf",
            created_by=1,
            request_id="req-warnings",
            created_at="2026-08-22T09:15:00+00:00",
        )
        assert record.warnings == []
        assert isinstance(record.warnings, list)


# ---------------------------------------------------------------------
# Step 18: failure flow
# ---------------------------------------------------------------------


class TestFailedIngestion:
    def test_invalid_extension_creates_failed_record(self, db):
        with pytest.raises(UnsupportedExtensionError):
            ingest_document(
                db,
                content=b"anything",
                filename="malware.exe",
                created_by=1,
                request_id="req-fail-ext",
                created_at="2026-08-22T09:20:00+00:00",
            )
        with conn() as c2:
            row = c2.execute(
                "SELECT * FROM document_extractions WHERE request_id=?",
                ("req-fail-ext",),
            ).fetchone()
        assert row is not None
        assert row["status"] == "failed"
        assert row["error_summary"] == "unsupported_document_format"
        assert row["markdown_text"] is None
        assert row["markdown_sha256"] is None

    def test_fake_pdf_creates_failed_record_with_content_type_mismatch(self, db):
        content = b"this is just plain text renamed to pdf, not a real pdf"
        with pytest.raises(ContentTypeMismatchError):
            ingest_document(
                db,
                content=content,
                filename="fake.pdf",
                created_by=1,
                request_id="req-fail-faketype",
                created_at="2026-08-22T09:25:00+00:00",
            )
        with conn() as c2:
            row = c2.execute(
                "SELECT * FROM document_extractions WHERE request_id=?",
                ("req-fail-faketype",),
            ).fetchone()
        assert row["status"] == "failed"
        assert row["error_summary"] == "content_type_mismatch"
        assert row["markdown_text"] is None

    def test_malformed_ooxml_creates_failed_record(self, db):
        content = fixtures.build_generic_zip()
        with pytest.raises((ContentTypeMismatchError, MalformedOOXMLError)) as exc_info:
            ingest_document(
                db,
                content=content,
                filename="fake.docx",
                created_by=1,
                request_id="req-fail-ooxml",
                created_at="2026-08-22T09:30:00+00:00",
            )
        with conn() as c2:
            row = c2.execute(
                "SELECT * FROM document_extractions WHERE request_id=?",
                ("req-fail-ooxml",),
            ).fetchone()
        assert row["status"] == "failed"
        expected_summary = (
            "content_type_mismatch"
            if exc_info.type is ContentTypeMismatchError
            else "malformed_ooxml"
        )
        assert row["error_summary"] == expected_summary
        assert row["markdown_text"] is None

    def test_markitdown_exception_creates_failed_record(self, db):
        content = fixtures.build_minimal_pdf()
        with pytest.raises(ExtractionFailedError):
            ingest_document(
                db,
                content=content,
                filename="spec_sheet.pdf",
                created_by=1,
                request_id="req-fail-explode",
                created_at="2026-08-22T09:35:00+00:00",
                detector=_AcceptingDetector("pdf"),
                converter=_ExplodingConverter(),
            )
        with conn() as c2:
            row = c2.execute(
                "SELECT * FROM document_extractions WHERE request_id=?",
                ("req-fail-explode",),
            ).fetchone()
        assert row["status"] == "failed"
        assert row["error_summary"] == "extraction_failed"
        assert row["markdown_text"] is None

    def test_empty_extraction_creates_failed_record(self, db):
        content = fixtures.build_minimal_pdf()
        with pytest.raises(EmptyExtractionError):
            ingest_document(
                db,
                content=content,
                filename="spec_sheet.pdf",
                created_by=1,
                request_id="req-fail-empty",
                created_at="2026-08-22T09:40:00+00:00",
                detector=_AcceptingDetector("pdf"),
                converter=_EmptyOutputConverter(),
            )
        with conn() as c2:
            row = c2.execute(
                "SELECT * FROM document_extractions WHERE request_id=?",
                ("req-fail-empty",),
            ).fetchone()
        assert row["status"] == "failed"
        assert row["error_summary"] == "empty_extraction"
        assert row["markdown_text"] is None

    def test_failure_error_summary_never_leaks_raw_exception_text(self, db):
        content = fixtures.build_minimal_pdf()
        with pytest.raises(ExtractionFailedError):
            ingest_document(
                db,
                content=content,
                filename="spec_sheet.pdf",
                created_by=1,
                request_id="req-fail-noleak",
                created_at="2026-08-22T09:45:00+00:00",
                detector=_AcceptingDetector("pdf"),
                converter=_ExplodingConverter(),
            )
        with conn() as c2:
            row = c2.execute(
                "SELECT * FROM document_extractions WHERE request_id=?",
                ("req-fail-noleak",),
            ).fetchone()
        assert "simulated MarkItDown internal failure" not in row["error_summary"]
        assert "Traceback" not in (row["error_summary"] or "")
        assert "/home/" not in (row["error_summary"] or "")

    def test_original_exception_reraised_unchanged_after_persisting_failure(self, db):
        # The re-raised exception is the same type extract_document()
        # itself raises -- ingestion_service never re-wraps it into a
        # different exception type.
        content = b"anything"
        with pytest.raises(UnsupportedExtensionError):
            ingest_document(
                db,
                content=content,
                filename="malware.exe",
                created_by=1,
                request_id="req-reraise",
                created_at="2026-08-22T09:50:00+00:00",
            )

    def test_processing_row_created_before_failure_and_never_left_processing(self, db):
        # After a failed call, there must be exactly one row for this
        # request_id, and its FINAL observed status must be "failed"
        # -- never "processing" left stuck.
        with pytest.raises(UnsupportedExtensionError):
            ingest_document(
                db,
                content=b"x",
                filename="malware.exe",
                created_by=1,
                request_id="req-no-stuck-processing",
                created_at="2026-08-22T09:55:00+00:00",
            )
        with conn() as c2:
            rows = c2.execute(
                "SELECT status FROM document_extractions WHERE request_id=?",
                ("req-no-stuck-processing",),
            ).fetchall()
        assert len(rows) == 1
        assert rows[0]["status"] == "failed"


# ---------------------------------------------------------------------
# Ownership integration (created_by flows through correctly)
# ---------------------------------------------------------------------


class TestIngestionOwnership:
    def test_ingested_record_owned_by_correct_user(self, db):
        content = fixtures.build_minimal_pdf()
        record = ingest_document(
            db,
            content=content,
            filename="spec_sheet.pdf",
            created_by=55,
            request_id="req-owner-1",
            created_at="2026-08-22T10:00:00+00:00",
        )
        assert repository.get_owned(db, record.id, created_by=55) is not None
        assert repository.get_owned(db, record.id, created_by=999) is None
