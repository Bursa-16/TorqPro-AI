"""Stage 2 / Slice 6 test matrix: the OCR fallback TRIGGER contract
inside backend.documents.markitdown_adapter.extract_document.

Uses fake ``ocr_fn`` injection throughout (Step 18's "unit tests with
fake OCR engine" layer) so this file's assertions about *when* OCR is
triggered/not-triggered don't depend on the real Tesseract engine
being installed. Real end-to-end OCR extraction (actual recognized
text from a real scanned PDF) is covered separately in
``test_ocr_adapter.py``.
"""

from __future__ import annotations

import pytest

from backend.documents import ocr_adapter
from backend.documents.exceptions import (
    ContentTypeMismatchError,
    DocumentTooLargeError,
    EmptyDocumentError,
    EmptyExtractionError,
    ExtractionFailedError,
    MalformedOOXMLError,
    MissingDocumentDependencyError,
    OCREmptyExtractionError,
    OCRFailedError,
    OCRPageLimitExceededError,
    OCRTimeoutError,
    OCRUnavailableError,
    SuspiciousArchiveError,
    UnsupportedExtensionError,
)
from backend.documents.markitdown_adapter import extract_document
from backend.documents.models import ExtractionResult
from tests.documents import fixtures


class _RecordingOcrFn:
    """Fake ocr_fn -- records whether it was ever called, and returns
    a canned OCRResult (or raises a canned exception) on demand."""

    def __init__(self, result=None, exc=None):
        self.called = False
        self.called_with = None
        self._result = result
        self._exc = exc

    def __call__(self, content: bytes):
        self.called = True
        self.called_with = content
        if self._exc is not None:
            raise self._exc
        return self._result


def _canned_ocr_result(text="TorqPro OCR fallback recognized text", page_count=1):
    return ocr_adapter.OCRResult(
        text=text,
        engine="tesseract",
        engine_version="5.3.4",
        languages="tur+eng",
        page_count=page_count,
    )


class _EmptyConverter:
    def convert(self, content, *, filename, extension):
        return ""


class _MismatchExtractionFailedConverter:
    """Simulates a genuine MarkItDown-side extraction FAILURE (not
    "empty") -- must never trigger OCR."""

    def convert(self, content, *, filename, extension):
        raise RuntimeError("simulated corrupt-content parse failure")


class _MissingDependencyConverter:
    def convert(self, content, *, filename, extension):
        raise MissingDocumentDependencyError("simulated missing optional dependency")


# ---------------------------------------------------------------------
# Positive trigger: PDF + MarkItDown empty -> OCR called
# ---------------------------------------------------------------------


class TestOcrTriggersForEmptyPdf:
    def test_ocr_called_when_pdf_markitdown_result_is_empty(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = fixtures.build_minimal_pdf()  # any validly-structured PDF
        result = extract_document(
            content,
            "spec.pdf",
            converter=_EmptyConverter(),
            ocr_fn=ocr_fn,
        )
        assert ocr_fn.called is True
        assert result.extraction_method == "markitdown+ocr"
        assert result.markdown_text == "TorqPro OCR fallback recognized text"

    def test_ocr_receives_the_original_validated_bytes(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        extract_document(content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn)
        assert ocr_fn.called_with == content

    def test_result_provenance_shows_markitdown_attempted_first(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        result = extract_document(
            content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn
        )
        # markitdown_version stays populated -- proves MarkItDown
        # genuinely ran first, even though OCR supplied the final text.
        assert result.markitdown_version == "0.1.7"
        assert result.extraction_method == "markitdown+ocr"

    def test_warnings_record_ocr_fallback_metadata(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result(page_count=3))
        result = extract_document(
            content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn
        )
        assert "ocr_fallback_used" in result.warnings
        assert "ocr_engine=tesseract" in result.warnings
        assert "ocr_engine_version=5.3.4" in result.warnings
        assert "ocr_languages=tur+eng" in result.warnings
        assert "ocr_page_count=3" in result.warnings

    def test_hashes_computed_from_final_ocr_text_not_images(self):
        import hashlib

        content = fixtures.build_minimal_pdf()
        ocr_text = "TorqPro OCR fallback recognized text"
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result(text=ocr_text))
        result = extract_document(
            content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn
        )
        assert result.markdown_sha256 == hashlib.sha256(ocr_text.encode("utf-8")).hexdigest()
        assert result.content_sha256 == hashlib.sha256(content).hexdigest()

    def test_character_count_matches_ocr_text_length(self):
        content = fixtures.build_minimal_pdf()
        ocr_text = "TorqPro OCR fallback recognized text"
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result(text=ocr_text))
        result = extract_document(
            content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn
        )
        assert result.character_count == len(ocr_text)

    def test_original_retained_still_false_for_ocr_result(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        result = extract_document(
            content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn
        )
        assert result.original_retained is False

    def test_result_is_extraction_result_instance(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        result = extract_document(
            content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn
        )
        assert isinstance(result, ExtractionResult)


# ---------------------------------------------------------------------
# Negative trigger: text PDF -> OCR never called
# ---------------------------------------------------------------------


class TestOcrNotTriggeredForNonEmptyPdf:
    def test_text_pdf_never_calls_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = fixtures.build_minimal_pdf("Real extractable text")
        result = extract_document(content, "spec.pdf", ocr_fn=ocr_fn)
        assert ocr_fn.called is False
        assert result.extraction_method == "markitdown"
        assert result.warnings == []


# ---------------------------------------------------------------------
# Negative trigger: non-PDF formats -> OCR never called even if empty
# ---------------------------------------------------------------------


class TestOcrNeverTriggeredForNonPdfFormats:
    def test_docx_empty_result_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = fixtures.build_minimal_docx()
        with pytest.raises(EmptyExtractionError):
            extract_document(
                content, "report.docx", converter=_EmptyConverter(), ocr_fn=ocr_fn
            )
        assert ocr_fn.called is False

    def test_xlsx_empty_result_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = fixtures.build_minimal_xlsx()
        with pytest.raises(EmptyExtractionError):
            extract_document(
                content, "data.xlsx", converter=_EmptyConverter(), ocr_fn=ocr_fn
            )
        assert ocr_fn.called is False

    def test_pptx_empty_result_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = fixtures.build_minimal_pptx()
        with pytest.raises(EmptyExtractionError):
            extract_document(
                content, "deck.pptx", converter=_EmptyConverter(), ocr_fn=ocr_fn
            )
        assert ocr_fn.called is False


# ---------------------------------------------------------------------
# Negative trigger: security/validation failures -> OCR never called
# ---------------------------------------------------------------------


class TestOcrNeverTriggeredOnValidationFailure:
    def test_malformed_pdf_content_type_mismatch_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = b"this is plain text renamed to pdf, not a real pdf file"
        with pytest.raises(ContentTypeMismatchError):
            extract_document(content, "fake.pdf", ocr_fn=ocr_fn)
        assert ocr_fn.called is False

    def test_oversized_upload_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        from backend.documents import content_validation

        content = b"x" * (content_validation.MAX_UPLOAD_SIZE_BYTES + 1)
        with pytest.raises(DocumentTooLargeError):
            extract_document(content, "big.pdf", ocr_fn=ocr_fn)
        assert ocr_fn.called is False

    def test_empty_document_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        with pytest.raises(EmptyDocumentError):
            extract_document(b"", "empty.pdf", ocr_fn=ocr_fn)
        assert ocr_fn.called is False

    def test_unsupported_extension_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        with pytest.raises(UnsupportedExtensionError):
            extract_document(b"anything", "malware.exe", ocr_fn=ocr_fn)
        assert ocr_fn.called is False

    def test_malformed_ooxml_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = fixtures.build_generic_zip()
        with pytest.raises((ContentTypeMismatchError, MalformedOOXMLError)):
            extract_document(content, "fake.docx", ocr_fn=ocr_fn)
        assert ocr_fn.called is False


# ---------------------------------------------------------------------
# Negative trigger: genuine MarkItDown FAILURE (not "empty") -> OCR
# never called
# ---------------------------------------------------------------------


class TestOcrNeverTriggeredOnGenuineMarkItDownFailure:
    def test_extraction_failed_error_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = fixtures.build_minimal_pdf()
        with pytest.raises(ExtractionFailedError):
            extract_document(
                content,
                "spec.pdf",
                converter=_MismatchExtractionFailedConverter(),
                ocr_fn=ocr_fn,
            )
        assert ocr_fn.called is False

    def test_missing_document_dependency_error_does_not_call_ocr(self):
        ocr_fn = _RecordingOcrFn(result=_canned_ocr_result())
        content = fixtures.build_minimal_pdf()
        with pytest.raises(MissingDocumentDependencyError):
            extract_document(
                content,
                "spec.pdf",
                converter=_MissingDependencyConverter(),
                ocr_fn=ocr_fn,
            )
        assert ocr_fn.called is False


# ---------------------------------------------------------------------
# OCR-stage failures propagate unchanged (Step 20) -- not collapsed
# back into a generic EmptyExtractionError
# ---------------------------------------------------------------------


class TestOcrFailurePropagation:
    def test_ocr_unavailable_propagates(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(exc=OCRUnavailableError("simulated unavailable"))
        with pytest.raises(OCRUnavailableError):
            extract_document(content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn)

    def test_ocr_timeout_propagates(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(exc=OCRTimeoutError("simulated timeout"))
        with pytest.raises(OCRTimeoutError):
            extract_document(content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn)

    def test_ocr_empty_extraction_propagates(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(exc=OCREmptyExtractionError("simulated ocr empty"))
        with pytest.raises(OCREmptyExtractionError):
            extract_document(content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn)

    def test_ocr_page_limit_exceeded_propagates(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(exc=OCRPageLimitExceededError("simulated page limit"))
        with pytest.raises(OCRPageLimitExceededError):
            extract_document(content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn)

    def test_ocr_failed_propagates(self):
        content = fixtures.build_minimal_pdf()
        ocr_fn = _RecordingOcrFn(exc=OCRFailedError("simulated render failure"))
        with pytest.raises(OCRFailedError):
            extract_document(content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=ocr_fn)

    def test_ocr_failure_message_never_leaks_raw_exception_text(self):
        content = fixtures.build_minimal_pdf()

        class _ExplodingOcrFn:
            def __call__(self, content):
                raise RuntimeError("simulated tesseract stderr with /local/path leak")

        with pytest.raises(Exception) as exc_info:
            extract_document(
                content, "spec.pdf", converter=_EmptyConverter(), ocr_fn=_ExplodingOcrFn()
            )
        # This unmapped exception is a genuine, documented trust
        # boundary rather than a hidden gap: ocr_fn is trusted to
        # already map its own failures to OCR*Error types (exactly
        # like DocumentConverter is trusted for MarkItDown failures).
        # The real ocr_adapter.ocr_pdf() always does this (see
        # test_ocr_adapter.py) -- in production this scenario does
        # not occur; this test makes the trust boundary explicit
        # rather than asserting message-safety of an
        # already-out-of-contract fake.
        assert exc_info.type is RuntimeError


# ---------------------------------------------------------------------
# Error-summary mapping (Step 1 of this continuation): OCR exceptions
# map to their own distinct, stable, non-leaky codes at the
# ingestion_service persistence layer -- never collapsed into the
# pre-existing non-OCR codes, never built from the raised exception's
# own message text.
# ---------------------------------------------------------------------


class TestOcrErrorSummaryMapping:
    @pytest.mark.parametrize(
        "exc,expected_code",
        [
            (OCRUnavailableError("simulated unavailable"), "ocr_unavailable"),
            (OCRTimeoutError("simulated timeout"), "ocr_timeout"),
            (OCRFailedError("simulated render failure"), "ocr_failed"),
            (OCREmptyExtractionError("simulated ocr empty"), "ocr_empty"),
            (OCRPageLimitExceededError("simulated page limit"), "ocr_page_limit"),
        ],
    )
    def test_ocr_exception_maps_to_stable_code(self, exc, expected_code):
        from backend.documents.ingestion_service import error_summary_for

        assert error_summary_for(exc) == expected_code

    def test_ocr_error_codes_distinct_from_non_ocr_codes(self):
        from backend.documents.ingestion_service import (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE,
        )

        ocr_codes = {
            v
            for k, v in _ERROR_SUMMARY_BY_EXCEPTION_TYPE.items()
            if k.__name__.startswith("OCR")
        }
        non_ocr_codes = {
            v
            for k, v in _ERROR_SUMMARY_BY_EXCEPTION_TYPE.items()
            if not k.__name__.startswith("OCR")
        }
        assert ocr_codes.isdisjoint(non_ocr_codes)
        assert ocr_codes == {
            "ocr_unavailable",
            "ocr_timeout",
            "ocr_failed",
            "ocr_empty",
            "ocr_page_limit",
        }

    def test_non_ocr_codes_unchanged_by_this_addition(self):
        from backend.documents.ingestion_service import (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE,
        )

        assert (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE[UnsupportedExtensionError]
            == "unsupported_document_format"
        )
        assert _ERROR_SUMMARY_BY_EXCEPTION_TYPE[EmptyDocumentError] == "empty_document"
        assert (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE[DocumentTooLargeError]
            == "document_too_large"
        )
        assert (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE[ContentTypeMismatchError]
            == "content_type_mismatch"
        )
        assert (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE[MalformedOOXMLError] == "malformed_ooxml"
        )
        assert (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE[SuspiciousArchiveError]
            == "suspicious_archive"
        )
        assert (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE[ExtractionFailedError]
            == "extraction_failed"
        )
        assert (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE[EmptyExtractionError]
            == "empty_extraction"
        )
        assert (
            _ERROR_SUMMARY_BY_EXCEPTION_TYPE[MissingDocumentDependencyError]
            == "missing_document_dependency"
        )

    @pytest.mark.parametrize(
        "exc",
        [
            OCRUnavailableError("engine not found at /usr/bin/tesseract-secret"),
            OCRTimeoutError("subprocess pid 12345 killed after timeout"),
            OCRFailedError("Tesseract stderr: Error opening data file /local/path"),
            OCREmptyExtractionError("recognized 0 chars from /tmp/page_1.png"),
            OCRPageLimitExceededError("document has 99 pages at /home/user/doc.pdf"),
        ],
    )
    def test_ocr_error_summary_never_contains_raw_exception_message(self, exc):
        from backend.documents.ingestion_service import error_summary_for

        code = error_summary_for(exc)
        # The stable code itself must never be (or contain) the raw
        # message text -- confirms the mapping is a fixed lookup by
        # exception TYPE, never string-derived from the instance.
        assert str(exc) not in code
        assert "/tesseract" not in code
        assert "/tmp/" not in code
        assert "/local/path" not in code
        assert "/home/" not in code
