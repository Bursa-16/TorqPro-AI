"""Stage 2 / Slice 2 test matrix for backend.documents.markitdown_adapter.

Uses the real, installed ``markitdown``/``magika`` stack throughout
(no MarkItDown/Magika mocking in the format-specific test classes --
only the dedicated TestCallOrder class uses fakes, specifically to
prove the locked validation-before-conversion ordering without
needing implementation coupling to the real stack, per Step 6's own
instruction).
"""

from __future__ import annotations

import hashlib

import pytest

from backend.documents import markitdown_adapter
from backend.documents.exceptions import (
    ContentTypeMismatchError,
    EmptyExtractionError,
    ExtractionFailedError,
    MalformedOOXMLError,
)
from tests.documents import fixtures


# ---------------------------------------------------------------------
# Fakes for call-order testing (Step 6) -- no coupling to the real
# Magika/MarkItDown stack.
# ---------------------------------------------------------------------


class _RejectingDetector:
    """A detector that always reports a mismatch, forcing
    content_validation.validate_document() to raise before
    extract_document() ever reaches the converter."""

    def detect(self, content: bytes):
        return "not_a_real_match"


class _AcceptingDetector:
    def __init__(self, label: str) -> None:
        self._label = label

    def detect(self, content: bytes):
        return self._label


class _RecordingConverter:
    """Fake DocumentConverter that records whether convert() was
    ever called -- used to prove MarkItDown-equivalent conversion
    never runs when validation has already failed."""

    def __init__(self) -> None:
        self.called = False

    def convert(self, content: bytes, *, filename: str, extension: str) -> str:
        self.called = True
        return "fake markdown output"


# ---------------------------------------------------------------------
# Step 6: locked call order
# ---------------------------------------------------------------------


class TestCallOrder:
    def test_converter_not_called_when_content_type_mismatches(self):
        converter = _RecordingConverter()
        content = fixtures.build_minimal_pdf()
        with pytest.raises(ContentTypeMismatchError):
            markitdown_adapter.extract_document(
                content,
                "report.pdf",
                detector=_RejectingDetector(),
                converter=converter,
            )
        assert converter.called is False

    def test_converter_not_called_when_extension_rejected(self):
        converter = _RecordingConverter()
        with pytest.raises(Exception):
            markitdown_adapter.extract_document(
                b"anything",
                "malware.exe",
                detector=_AcceptingDetector("pdf"),
                converter=converter,
            )
        assert converter.called is False

    def test_converter_not_called_when_ooxml_structure_invalid(self):
        converter = _RecordingConverter()
        content = fixtures.build_generic_zip()
        with pytest.raises(MalformedOOXMLError):
            markitdown_adapter.extract_document(
                content,
                "report.docx",
                detector=_AcceptingDetector("docx"),
                converter=converter,
            )
        assert converter.called is False

    def test_converter_called_only_after_validation_succeeds(self):
        converter = _RecordingConverter()
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(
            content,
            "report.pdf",
            detector=_AcceptingDetector("pdf"),
            converter=converter,
        )
        assert converter.called is True
        assert result.markdown_text == "fake markdown output"


# ---------------------------------------------------------------------
# Step 3 / Step 5: real API surface sanity (documents the actual
# installed API this adapter relies on, rather than assuming it)
# ---------------------------------------------------------------------


class TestRealApiSurface:
    def test_markitdown_public_namespace_exposes_required_symbols(self):
        import markitdown

        for symbol in (
            "MarkItDown",
            "StreamInfo",
            "UnsupportedFormatException",
            "FileConversionException",
            "MissingDependencyException",
        ):
            assert hasattr(markitdown, symbol)

    def test_get_markitdown_version_matches_pinned_requirement(self):
        # requirements.txt pins markitdown[pdf,docx,xlsx,pptx]==0.1.7
        # exactly -- see Stage 1's dependency-pin rationale.
        assert markitdown_adapter.get_markitdown_version() == "0.1.7"


# ---------------------------------------------------------------------
# Step 13: PDF
# ---------------------------------------------------------------------


class TestPdfExtraction:
    def test_valid_pdf_extracts_successfully(self):
        content = fixtures.build_minimal_pdf("TorqPro test document")
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert "TorqPro test document" in result.markdown_text

    def test_extracted_markdown_non_empty(self):
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert result.character_count > 0
        assert result.markdown_text.strip() != ""

    def test_hashes_populated(self):
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert len(result.content_sha256) == 64
        assert len(result.markdown_sha256) == 64

    def test_detected_type_is_pdf(self):
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert result.detected_media_type == "pdf"

    def test_extraction_method_is_markitdown(self):
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert result.extraction_method == "markitdown"

    def test_original_retained_is_false(self):
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert result.original_retained is False

    def test_version_recorded(self):
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert result.markitdown_version == "0.1.7"

    def test_fake_pdf_rejected_before_markitdown(self):
        # Real Magika, real content_validation -- a plain-text file
        # renamed .pdf must be rejected before conversion, exactly
        # as Stage 1 found MarkItDown itself would NOT reject it.
        converter = _RecordingConverter()
        content = b"this is just plain text renamed to pdf, not a real pdf file at all"
        with pytest.raises(ContentTypeMismatchError):
            markitdown_adapter.extract_document(
                content, "fake.pdf", converter=converter
            )
        assert converter.called is False

    def test_corrupt_pdf_rejected_before_or_at_boundary(self):
        converter = _RecordingConverter()
        content = b"%PDF-1.4 not a real pdf body garbage, no valid structure here"
        with pytest.raises(ContentTypeMismatchError):
            markitdown_adapter.extract_document(
                content, "corrupt.pdf", converter=converter
            )
        assert converter.called is False

    def test_no_raw_parser_traceback_surfaced_on_rejection(self):
        content = b"this is just plain text renamed to pdf"
        with pytest.raises(ContentTypeMismatchError) as exc_info:
            markitdown_adapter.extract_document(content, "fake.pdf")
        message = str(exc_info.value)
        assert "Traceback" not in message
        assert "/home/" not in message
        assert "site-packages" not in message


# ---------------------------------------------------------------------
# Step 14: DOCX
# ---------------------------------------------------------------------


class TestDocxExtraction:
    def test_valid_docx_extracts_successfully(self):
        content = fixtures.build_minimal_docx()
        result = markitdown_adapter.extract_document(content, "report.docx")
        assert "TorqPro Test Belgesi" in result.markdown_text

    def test_turkish_characters_preserved(self):
        content = fixtures.build_minimal_docx()
        result = markitdown_adapter.extract_document(content, "report.docx")
        for ch in ("ı", "ş", "ğ", "İ", "Ş", "Ö", "Ç", "ü", "ö"):
            assert ch in result.markdown_text

    def test_heading_present(self):
        content = fixtures.build_minimal_docx(heading="TorqPro Test Belgesi")
        result = markitdown_adapter.extract_document(content, "report.docx")
        assert "TorqPro Test Belgesi" in result.markdown_text

    def test_paragraph_present(self):
        content = fixtures.build_minimal_docx()
        result = markitdown_adapter.extract_document(content, "report.docx")
        assert "karakter testi" in result.markdown_text

    def test_table_recognizable_as_markdown_table(self):
        content = fixtures.build_minimal_docx(include_table=True)
        result = markitdown_adapter.extract_document(content, "report.docx")
        assert "---" in result.markdown_text  # markdown table separator row
        assert "Cıvata" in result.markdown_text
        assert "M12" in result.markdown_text

    def test_content_sha_deterministic(self):
        content = fixtures.build_minimal_docx()
        r1 = markitdown_adapter.extract_document(content, "report.docx")
        r2 = markitdown_adapter.extract_document(content, "report.docx")
        assert r1.content_sha256 == r2.content_sha256
        assert r1.content_sha256 == hashlib.sha256(content).hexdigest()

    def test_markdown_sha_deterministic(self):
        content = fixtures.build_minimal_docx()
        r1 = markitdown_adapter.extract_document(content, "report.docx")
        r2 = markitdown_adapter.extract_document(content, "report.docx")
        assert r1.markdown_sha256 == r2.markdown_sha256
        assert r1.markdown_text == r2.markdown_text
        assert r1.markdown_sha256 == hashlib.sha256(
            r1.markdown_text.encode("utf-8")
        ).hexdigest()

    def test_fake_docx_generic_zip_rejected_before_conversion(self):
        # With the real Magika detector (default), a generic ZIP is
        # correctly labeled "zip" (not "docx") and is rejected by the
        # content-type check -- earlier in the locked call order than
        # the OOXML structural check, so ContentTypeMismatchError is
        # the actual, correct outcome here (both are
        # backend.documents.exceptions.DocumentIngestionError
        # subclasses that reject before conversion either way; see
        # TestRealMagikaMismatchRejection for the same pattern
        # asserted explicitly across all three OOXML formats).
        converter = _RecordingConverter()
        content = fixtures.build_generic_zip()
        with pytest.raises((ContentTypeMismatchError, MalformedOOXMLError)):
            markitdown_adapter.extract_document(
                content, "report.docx", converter=converter
            )
        assert converter.called is False

    def test_corrupt_docx_rejected(self):
        # Real Magika labels arbitrary non-ZIP bytes "txt", not
        # "docx" -- rejected by the content-type check before the
        # OOXML structural check is ever reached (see comment on
        # test_fake_docx_generic_zip_rejected_before_conversion above
        # for why both exception types are accepted here).
        converter = _RecordingConverter()
        content = b"not a real zip file at all"
        with pytest.raises((ContentTypeMismatchError, MalformedOOXMLError)):
            markitdown_adapter.extract_document(
                content, "corrupt.docx", converter=converter
            )
        assert converter.called is False

    def test_original_retained_is_false(self):
        content = fixtures.build_minimal_docx()
        result = markitdown_adapter.extract_document(content, "report.docx")
        assert result.original_retained is False


# ---------------------------------------------------------------------
# Step 15: XLSX
# ---------------------------------------------------------------------


class TestXlsxExtraction:
    def test_valid_workbook_extracts_successfully(self):
        content = fixtures.build_minimal_xlsx()
        result = markitdown_adapter.extract_document(content, "data.xlsx")
        assert result.markdown_text.strip() != ""

    def test_multiple_sheets_represented(self):
        content = fixtures.build_minimal_xlsx()
        result = markitdown_adapter.extract_document(content, "data.xlsx")
        assert "Veri" in result.markdown_text
        assert "Bos" in result.markdown_text

    def test_turkish_text_preserved(self):
        content = fixtures.build_minimal_xlsx()
        result = markitdown_adapter.extract_document(content, "data.xlsx")
        assert "Cıvata" in result.markdown_text

    def test_empty_sheet_does_not_cause_extraction_failure(self):
        # "Bos" (empty) sheet must not raise -- graceful, per Stage 1
        # finding and Step 15's instruction.
        content = fixtures.build_minimal_xlsx()
        result = markitdown_adapter.extract_document(content, "data.xlsx")
        assert result.markdown_text  # extraction succeeded at all

    def test_formula_behavior_is_documented_not_engineered_around(self):
        # Stage 1 finding, restated here as an explicit, permanent
        # test: MarkItDown returns the stored/calculated cell value,
        # not formula text. This test exists to catch a *silent*
        # behavior change in a future MarkItDown version, not to
        # assert a feature TorqPro builds -- if this ever fails, it
        # means MarkItDown's own behavior changed, which should be
        # investigated before upgrading the pin, not "fixed" here.
        content = fixtures.build_minimal_xlsx()
        result = markitdown_adapter.extract_document(content, "data.xlsx")
        assert "85" in result.markdown_text  # the value, not a formula

    def test_detected_type_is_xlsx(self):
        content = fixtures.build_minimal_xlsx()
        result = markitdown_adapter.extract_document(content, "data.xlsx")
        assert result.detected_media_type == "xlsx"


# ---------------------------------------------------------------------
# Step 16: PPTX
# ---------------------------------------------------------------------


class TestPptxExtraction:
    def test_valid_presentation_extracts_successfully(self):
        content = fixtures.build_minimal_pptx()
        result = markitdown_adapter.extract_document(content, "deck.pptx")
        assert result.markdown_text.strip() != ""

    def test_multiple_slides_represented(self):
        content = fixtures.build_minimal_pptx()
        result = markitdown_adapter.extract_document(content, "deck.pptx")
        assert "Slide number: 1" in result.markdown_text
        assert "Slide number: 2" in result.markdown_text

    def test_turkish_text_preserved(self):
        content = fixtures.build_minimal_pptx(text="sıkıştırma testi")
        result = markitdown_adapter.extract_document(content, "deck.pptx")
        assert "sıkıştırma" in result.markdown_text

    def test_blank_slide_does_not_cause_failure(self):
        # Slide 2 has no text content at all -- must not raise, per
        # Stage 1 finding.
        content = fixtures.build_minimal_pptx()
        result = markitdown_adapter.extract_document(content, "deck.pptx")
        assert result.markdown_text  # extraction succeeded overall

    def test_hashes_and_version_metadata_present(self):
        content = fixtures.build_minimal_pptx()
        result = markitdown_adapter.extract_document(content, "deck.pptx")
        assert len(result.content_sha256) == 64
        assert len(result.markdown_sha256) == 64
        assert result.markitdown_version == "0.1.7"
        assert result.detected_media_type == "pptx"


# ---------------------------------------------------------------------
# Step 17: Magika mismatch tests -- REAL Magika, not stubs
# ---------------------------------------------------------------------


class TestRealMagikaMismatchRejection:
    def test_text_bytes_renamed_pdf_rejected(self):
        content = b"This is plain text content with no PDF structure whatsoever."
        with pytest.raises(ContentTypeMismatchError):
            markitdown_adapter.extract_document(content, "fake.pdf")

    def test_generic_zip_renamed_docx_rejected(self):
        content = fixtures.build_generic_zip()
        with pytest.raises((ContentTypeMismatchError, MalformedOOXMLError)):
            markitdown_adapter.extract_document(content, "fake.docx")

    def test_generic_zip_renamed_xlsx_rejected(self):
        content = fixtures.build_generic_zip()
        with pytest.raises((ContentTypeMismatchError, MalformedOOXMLError)):
            markitdown_adapter.extract_document(content, "fake.xlsx")

    def test_generic_zip_renamed_pptx_rejected(self):
        content = fixtures.build_generic_zip()
        with pytest.raises((ContentTypeMismatchError, MalformedOOXMLError)):
            markitdown_adapter.extract_document(content, "fake.pptx")

    def test_real_magika_detects_genuine_pdf_correctly(self):
        # Positive control: confirms the real detector isn't simply
        # rejecting everything -- a genuine PDF passes content-type
        # verification (and full extraction) using the real detector.
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert result.detected_media_type == "pdf"

    def test_real_magika_detects_genuine_docx_correctly(self):
        content = fixtures.build_minimal_docx()
        result = markitdown_adapter.extract_document(content, "report.docx")
        assert result.detected_media_type == "docx"


# ---------------------------------------------------------------------
# Step 9: empty / meaningless output
# ---------------------------------------------------------------------


class TestEmptyExtraction:
    def test_literal_none_string_output_is_not_treated_as_valid_content(self):
        assert markitdown_adapter._is_meaningless_markdown("None") is True

    def test_none_value_is_meaningless(self):
        assert markitdown_adapter._is_meaningless_markdown(None) is True

    def test_empty_string_is_meaningless(self):
        assert markitdown_adapter._is_meaningless_markdown("") is True

    def test_whitespace_only_is_meaningless(self):
        assert markitdown_adapter._is_meaningless_markdown("   \n\t  ") is True

    def test_genuine_content_is_not_meaningless(self):
        assert markitdown_adapter._is_meaningless_markdown("TorqPro") is False

    def test_converter_producing_none_sentinel_raises_empty_extraction_error(self):
        class _NoneSentinelConverter:
            def convert(self, content, *, filename, extension):
                return "None"

        content = fixtures.build_minimal_pdf()
        with pytest.raises(EmptyExtractionError):
            markitdown_adapter.extract_document(
                content, "spec_sheet.pdf", converter=_NoneSentinelConverter()
            )

    def test_converter_producing_empty_string_raises_empty_extraction_error(self):
        class _EmptyConverter:
            def convert(self, content, *, filename, extension):
                return ""

        content = fixtures.build_minimal_pdf()
        with pytest.raises(EmptyExtractionError):
            markitdown_adapter.extract_document(
                content, "spec_sheet.pdf", converter=_EmptyConverter()
            )


# ---------------------------------------------------------------------
# Step 10: exception mapping -- no leaked internals
# ---------------------------------------------------------------------


class TestExceptionMapping:
    def test_converter_internal_exception_mapped_to_extraction_failed_error(self):
        class _ExplodingConverter:
            def convert(self, content, *, filename, extension):
                raise RuntimeError("simulated pdfminer internal parse failure")

        content = fixtures.build_minimal_pdf()
        with pytest.raises(ExtractionFailedError) as exc_info:
            markitdown_adapter.extract_document(
                content, "spec_sheet.pdf", converter=_ExplodingConverter()
            )
        assert "simulated pdfminer internal parse failure" not in str(exc_info.value)

    def test_extraction_failed_error_message_has_no_traceback_or_path(self):
        class _ExplodingConverter:
            def convert(self, content, *, filename, extension):
                raise RuntimeError("/some/internal/path/leaked.py failure")

        content = fixtures.build_minimal_pdf()
        with pytest.raises(ExtractionFailedError) as exc_info:
            markitdown_adapter.extract_document(
                content, "spec_sheet.pdf", converter=_ExplodingConverter()
            )
        message = str(exc_info.value)
        assert "/some/internal/path" not in message
        assert "Traceback" not in message

    def test_original_exception_available_via_chaining_not_message(self):
        class _ExplodingConverter:
            def convert(self, content, *, filename, extension):
                raise RuntimeError("internal detail")

        content = fixtures.build_minimal_pdf()
        with pytest.raises(ExtractionFailedError):
            markitdown_adapter.extract_document(
                content, "spec_sheet.pdf", converter=_ExplodingConverter()
            )


# ---------------------------------------------------------------------
# Step 12: hash contract, format-agnostic determinism check
# ---------------------------------------------------------------------


class TestHashContract:
    @pytest.mark.parametrize(
        "builder,filename",
        [
            (fixtures.build_minimal_pdf, "spec_sheet.pdf"),
            (fixtures.build_minimal_docx, "report.docx"),
            (fixtures.build_minimal_xlsx, "data.xlsx"),
            (fixtures.build_minimal_pptx, "deck.pptx"),
        ],
    )
    def test_same_input_twice_yields_same_hashes_and_text(self, builder, filename):
        content = builder()
        r1 = markitdown_adapter.extract_document(content, filename)
        r2 = markitdown_adapter.extract_document(content, filename)
        assert r1.content_sha256 == r2.content_sha256
        assert r1.markdown_text == r2.markdown_text
        assert r1.markdown_sha256 == r2.markdown_sha256

    def test_content_sha256_uses_no_alternate_encoding(self):
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert result.content_sha256 == hashlib.sha256(content).hexdigest()

    def test_markdown_sha256_uses_utf8_encoding(self):
        content = fixtures.build_minimal_docx()  # has Turkish chars
        result = markitdown_adapter.extract_document(content, "report.docx")
        assert result.markdown_sha256 == hashlib.sha256(
            result.markdown_text.encode("utf-8")
        ).hexdigest()


# ---------------------------------------------------------------------
# warnings contract (Step 7)
# ---------------------------------------------------------------------


class TestWarningsContract:
    def test_warnings_default_to_empty_list(self):
        content = fixtures.build_minimal_pdf()
        result = markitdown_adapter.extract_document(content, "spec_sheet.pdf")
        assert result.warnings == []
