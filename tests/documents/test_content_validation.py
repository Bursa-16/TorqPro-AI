"""Stage 2 / Slice 1 test matrix for backend.documents.content_validation.

Mirrors the Stage 1 report's Test Matrix section and the Stage 2
spec's Step 11 requirements exactly. Uses only stdlib (`zipfile`,
`io`) for fixture construction -- no `python-docx`/`openpyxl`/
`python-pptx` dependency is introduced for this slice, matching the
"do not allocate unnecessarily large repeated fixtures if a
smaller/mockable approach can test the boundary safely" instruction:
ZIP-bomb boundary tests use lightweight fake ZipFile-like objects
exposing only the `infolist()` surface `validate_archive_safety()`
actually reads, rather than constructing real multi-hundred-MB
archives.
"""

from __future__ import annotations

import io
import zipfile

import pytest

from backend.documents import content_validation as cv
from backend.documents.exceptions import (
    ContentTypeMismatchError,
    DocumentTooLargeError,
    EmptyDocumentError,
    MalformedOOXMLError,
    SuspiciousArchiveError,
    UnsupportedExtensionError,
)


# ---------------------------------------------------------------------
# Fixture helpers (stdlib zipfile only)
# ---------------------------------------------------------------------


def _build_ooxml_bytes(
    required_part: str,
    *,
    include_content_types: bool = True,
    include_required_part: bool = True,
) -> bytes:
    """Build minimal, structurally-valid-or-invalid OOXML-shaped ZIP
    bytes for a given required part, entirely in memory."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        if include_content_types:
            z.writestr(cv.OOXML_CONTENT_TYPES_PART, "<Types/>")
        if include_required_part:
            z.writestr(required_part, "<root/>")
        z.writestr("_rels/.rels", "<Relationships/>")
    return buf.getvalue()


def _build_generic_zip_bytes() -> bytes:
    """A legitimate ZIP archive that is not an OOXML package at all
    (no [Content_Types].xml, no format-specific part) -- the "renamed
    generic ZIP" attack case validated for real in Stage 1."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("hello.txt", "hello")
    return buf.getvalue()


class _FakeZipInfo:
    def __init__(self, file_size: int, compress_size: int) -> None:
        self.file_size = file_size
        self.compress_size = compress_size


class _FakeZipFile:
    """Minimal stand-in exposing only the `infolist()` surface that
    validate_archive_safety() reads -- avoids constructing real
    multi-hundred-MB archives purely to exercise the numeric
    boundary logic."""

    def __init__(self, infos: list[_FakeZipInfo]) -> None:
        self._infos = infos

    def infolist(self) -> list[_FakeZipInfo]:
        return self._infos


class _StubDetector:
    def __init__(self, label):
        self._label = label

    def detect(self, content: bytes):
        return self._label


class _FailingDetector:
    def detect(self, content: bytes):
        raise RuntimeError("simulated detector internal failure")


# ---------------------------------------------------------------------
# Extension validation
# ---------------------------------------------------------------------


class TestExtensionValidation:
    @pytest.mark.parametrize(
        "filename,expected_ext",
        [
            ("spec_sheet.pdf", ".pdf"),
            ("report.docx", ".docx"),
            ("data.xlsx", ".xlsx"),
            ("deck.pptx", ".pptx"),
            ("REPORT.PDF", ".pdf"),
            ("Report.DoCx", ".docx"),
        ],
    )
    def test_supported_extension_accepted(self, filename, expected_ext):
        assert cv.validate_extension(filename) == expected_ext

    @pytest.mark.parametrize(
        "filename",
        [
            "malware.exe",
            "archive.zip",
            "notes.txt",
            "report.pdf.exe",
            "archive.docx.zip",
            "report.pdf ",  # trailing space in extension
            "no-extension",
            "",
            "just_a_dot.",
        ],
    )
    def test_unsupported_or_malformed_extension_rejected(self, filename):
        with pytest.raises(UnsupportedExtensionError):
            cv.validate_extension(filename)

    def test_rejection_message_never_contains_full_filename(self):
        filename = "C:\\Windows\\System32\\definitely_not_included.exe"
        with pytest.raises(UnsupportedExtensionError) as exc_info:
            cv.validate_extension(filename)
        assert "System32" not in str(exc_info.value)
        assert "Windows" not in str(exc_info.value)


# ---------------------------------------------------------------------
# Size validation
# ---------------------------------------------------------------------


class TestSizeValidation:
    def test_empty_rejected(self):
        with pytest.raises(EmptyDocumentError):
            cv.validate_size(b"")

    def test_one_byte_accepted(self):
        assert cv.validate_size(b"x") == 1

    def test_exactly_max_size_accepted(self):
        content = b"x" * cv.MAX_UPLOAD_SIZE_BYTES
        assert cv.validate_size(content) == cv.MAX_UPLOAD_SIZE_BYTES

    def test_max_size_plus_one_rejected(self):
        content = b"x" * (cv.MAX_UPLOAD_SIZE_BYTES + 1)
        with pytest.raises(DocumentTooLargeError):
            cv.validate_size(content)

    def test_max_upload_size_is_binary_15_mib_not_decimal(self):
        assert cv.MAX_UPLOAD_SIZE_BYTES == 15 * 1024 * 1024
        assert cv.MAX_UPLOAD_SIZE_BYTES == 15728640


# ---------------------------------------------------------------------
# Content-type detector abstraction
# ---------------------------------------------------------------------


class TestContentTypeDetection:
    def test_matching_pdf_accepted(self):
        label = cv.validate_content_type(b"...", ".pdf", _StubDetector("pdf"))
        assert label == "pdf"

    def test_pdf_detected_as_txt_rejected(self):
        with pytest.raises(ContentTypeMismatchError):
            cv.validate_content_type(b"...", ".pdf", _StubDetector("txt"))

    def test_docx_detected_as_zip_rejected(self):
        with pytest.raises(ContentTypeMismatchError):
            cv.validate_content_type(b"...", ".docx", _StubDetector("zip"))

    def test_xlsx_detected_as_generic_zip_rejected(self):
        with pytest.raises(ContentTypeMismatchError):
            cv.validate_content_type(b"...", ".xlsx", _StubDetector("zip"))

    def test_pptx_mismatch_rejected(self):
        with pytest.raises(ContentTypeMismatchError):
            cv.validate_content_type(b"...", ".pptx", _StubDetector("docx"))

    def test_detector_none_result_rejected(self):
        with pytest.raises(ContentTypeMismatchError):
            cv.validate_content_type(b"...", ".pdf", _StubDetector(None))

    def test_detector_failure_fails_closed(self):
        with pytest.raises(ContentTypeMismatchError):
            cv.validate_content_type(b"...", ".pdf", _FailingDetector())

    def test_detector_failure_does_not_leak_original_exception(self):
        with pytest.raises(ContentTypeMismatchError) as exc_info:
            cv.validate_content_type(b"...", ".pdf", _FailingDetector())
        assert "simulated detector internal failure" not in str(exc_info.value)
        assert exc_info.value.__cause__ is None  # suppressed via `from None`


# ---------------------------------------------------------------------
# OOXML structural validation
# ---------------------------------------------------------------------


class TestOoxmlStructuralValidation:
    @pytest.mark.parametrize(
        "extension,required_part",
        [
            (".docx", "word/document.xml"),
            (".xlsx", "xl/workbook.xml"),
            (".pptx", "ppt/presentation.xml"),
        ],
    )
    def test_structurally_valid_archive_accepted(self, extension, required_part):
        content = _build_ooxml_bytes(required_part)
        archive = cv.validate_ooxml_structure(content, extension)
        try:
            assert isinstance(archive, zipfile.ZipFile)
        finally:
            archive.close()

    def test_invalid_zip_rejected(self):
        with pytest.raises(MalformedOOXMLError):
            cv.validate_ooxml_structure(b"not a zip file at all", ".docx")

    def test_generic_zip_renamed_as_docx_rejected(self):
        content = _build_generic_zip_bytes()
        with pytest.raises(MalformedOOXMLError):
            cv.validate_ooxml_structure(content, ".docx")

    def test_missing_content_types_part_rejected(self):
        content = _build_ooxml_bytes(
            "word/document.xml", include_content_types=False
        )
        with pytest.raises(MalformedOOXMLError):
            cv.validate_ooxml_structure(content, ".docx")

    def test_missing_required_format_specific_part_rejected(self):
        content = _build_ooxml_bytes(
            "word/document.xml", include_required_part=False
        )
        with pytest.raises(MalformedOOXMLError):
            cv.validate_ooxml_structure(content, ".docx")

    def test_non_ooxml_extension_rejected(self):
        content = _build_ooxml_bytes("word/document.xml")
        with pytest.raises(MalformedOOXMLError):
            cv.validate_ooxml_structure(content, ".pdf")


# ---------------------------------------------------------------------
# ZIP-bomb / suspicious-archive guard
# ---------------------------------------------------------------------


class TestArchiveSafetyGuard:
    def test_safe_normal_ooxml_archive_accepted(self):
        content = _build_ooxml_bytes("word/document.xml")
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            cv.validate_archive_safety(archive)  # must not raise

    def test_uncompressed_total_over_limit_rejected(self):
        fake = _FakeZipFile(
            [_FakeZipInfo(file_size=cv.MAX_UNCOMPRESSED_TOTAL_BYTES + 1, compress_size=1000)]
        )
        with pytest.raises(SuspiciousArchiveError):
            cv.validate_archive_safety(fake)

    def test_uncompressed_total_exactly_at_limit_accepted(self):
        # compress_size chosen so the ratio (~52:1) stays comfortably
        # under MAX_COMPRESSION_RATIO -- this test isolates the total-
        # size boundary specifically, not the ratio boundary (see
        # test_compression_ratio_within_limit_accepted for that one).
        fake = _FakeZipFile(
            [_FakeZipInfo(file_size=cv.MAX_UNCOMPRESSED_TOTAL_BYTES, compress_size=2_000_000)]
        )
        cv.validate_archive_safety(fake)  # must not raise

    def test_compression_ratio_over_limit_rejected(self):
        # ratio = 1,000,001 / 1 = 1,000,001 : 1 >> 100:1 limit
        fake = _FakeZipFile([_FakeZipInfo(file_size=1_000_001, compress_size=1)])
        with pytest.raises(SuspiciousArchiveError):
            cv.validate_archive_safety(fake)

    def test_compression_ratio_within_limit_accepted(self):
        # ratio = 5000 / 100 = 50:1, under the 100:1 limit
        fake = _FakeZipFile([_FakeZipInfo(file_size=5000, compress_size=100)])
        cv.validate_archive_safety(fake)  # must not raise

    def test_too_many_entries_rejected(self):
        fake = _FakeZipFile(
            [_FakeZipInfo(file_size=10, compress_size=10) for _ in range(cv.MAX_ARCHIVE_ENTRIES + 1)]
        )
        with pytest.raises(SuspiciousArchiveError):
            cv.validate_archive_safety(fake)

    def test_entry_count_exactly_at_limit_accepted(self):
        fake = _FakeZipFile(
            [_FakeZipInfo(file_size=10, compress_size=10) for _ in range(cv.MAX_ARCHIVE_ENTRIES)]
        )
        cv.validate_archive_safety(fake)  # must not raise

    def test_zero_compressed_size_with_nonzero_uncompressed_rejected(self):
        fake = _FakeZipFile([_FakeZipInfo(file_size=1000, compress_size=0)])
        with pytest.raises(SuspiciousArchiveError):
            cv.validate_archive_safety(fake)

    def test_zero_compressed_and_zero_uncompressed_does_not_divide_by_zero(self):
        # An entirely empty entry (e.g. a directory marker) must not
        # crash the ratio computation.
        fake = _FakeZipFile([_FakeZipInfo(file_size=0, compress_size=0)])
        cv.validate_archive_safety(fake)  # must not raise, must not ZeroDivisionError

    def test_simulated_decompression_bomb_rejected(self):
        # Mirrors the real bomb simulated in Stage 1: ~500 KB on disk
        # claiming ~500 MB uncompressed, ratio ~1029:1.
        fake = _FakeZipFile(
            [_FakeZipInfo(file_size=524_288_008, compress_size=509_608)]
        )
        with pytest.raises(SuspiciousArchiveError):
            cv.validate_archive_safety(fake)


# ---------------------------------------------------------------------
# Filename safety
# ---------------------------------------------------------------------


class TestFilenameSafety:
    @pytest.mark.parametrize(
        "filename",
        [
            "../../evil.pdf",
            "C:\\Windows\\evil.pdf",
            "Türkçe_Ölçüm_Şartname.pdf",
            "a" * 5000 + ".pdf",
            "file\x00name.pdf",
        ],
    )
    def test_dangerous_filenames_do_not_crash_extension_validation(self, filename):
        # The point of this test is that extension validation runs to
        # completion (either accepting or rejecting the extension) --
        # it must never attempt to open/resolve the filename as a
        # path, which would be the actual danger with these inputs.
        try:
            cv.validate_extension(filename)
        except UnsupportedExtensionError:
            pass  # acceptable outcome, e.g. NUL-containing "extension"

    def test_traversal_filename_with_valid_extension_still_validates_only_extension(self):
        # "../../evil.pdf" ends in a valid extension -- validate_extension
        # only ever inspects the string after the last '.', so this
        # must be ACCEPTED at the extension layer (traversal is inert
        # here precisely because the filename is never used as a path).
        assert cv.validate_extension("../../evil.pdf") == ".pdf"

    def test_turkish_unicode_filename_with_valid_extension_accepted(self):
        assert cv.validate_extension("Türkçe_Ölçüm_Şartname.pdf") == ".pdf"

    def test_safe_display_filename_strips_control_characters(self):
        result = cv.safe_display_filename("file\x00name.pdf")
        assert "\x00" not in result

    def test_safe_display_filename_preserves_turkish_characters(self):
        result = cv.safe_display_filename("Türkçe_Ölçüm_Şartname.pdf")
        assert "Türkçe" in result
        assert "Ölçüm" in result
        assert "Şartname" in result

    def test_safe_display_filename_caps_length(self):
        long_name = "a" * 5000 + ".pdf"
        result = cv.safe_display_filename(long_name, max_length=255)
        assert len(result) == 255

    def test_safe_display_filename_handles_empty(self):
        assert cv.safe_display_filename("") == ""


# ---------------------------------------------------------------------
# Orchestration (validate_document)
# ---------------------------------------------------------------------


class TestValidateDocumentOrchestration:
    def test_valid_pdf_without_detector(self):
        result = cv.validate_document(b"%PDF-1.4 minimal", "report.pdf")
        assert result.extension == ".pdf"
        assert result.content_type_checked is False
        assert result.content_type_label is None

    def test_valid_docx_with_matching_detector(self):
        content = _build_ooxml_bytes("word/document.xml")
        result = cv.validate_document(
            content, "report.docx", detector=_StubDetector("docx")
        )
        assert result.extension == ".docx"
        assert result.content_type_checked is True
        assert result.content_type_label == "docx"

    def test_extension_rejected_before_size_check_runs(self):
        # An empty payload with a bad extension must surface the
        # extension error, not an empty-document error -- confirms
        # step ordering.
        with pytest.raises(UnsupportedExtensionError):
            cv.validate_document(b"", "malware.exe")

    def test_content_type_mismatch_rejected_before_ooxml_check_runs(self):
        # A structurally-valid OOXML docx, but the detector disagrees
        # -- must be rejected by the content-type step regardless of
        # the archive's actual structural validity.
        content = _build_ooxml_bytes("word/document.xml")
        with pytest.raises(ContentTypeMismatchError):
            cv.validate_document(content, "report.docx", detector=_StubDetector("zip"))

    def test_ooxml_structural_failure_rejected_for_renamed_generic_zip(self):
        content = _build_generic_zip_bytes()
        with pytest.raises(MalformedOOXMLError):
            cv.validate_document(content, "report.docx")

    def test_pdf_never_triggers_ooxml_checks(self):
        # A .pdf extension must not attempt zipfile parsing at all --
        # arbitrary non-ZIP bytes must pass straight through once
        # extension/size (and, if present, content-type) checks pass.
        result = cv.validate_document(b"%PDF-1.4 minimal pdf bytes", "report.pdf")
        assert result.extension == ".pdf"
