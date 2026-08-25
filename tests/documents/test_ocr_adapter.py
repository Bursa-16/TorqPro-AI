"""Stage 2 / Slice 6 test matrix for backend.documents.ocr_adapter.

Two layers, mirroring this project's established convention (Slice
1/2's own content_validation/markitdown_adapter split):

  1. Deterministic unit tests against ``_is_meaningful_ocr_text`` and
     the threshold constants -- no real Tesseract/PyMuPDF needed.
  2. Real integration tests against the actual installed Tesseract
     engine + PyMuPDF, using the real scanned-PDF fixtures from
     ``tests.documents.fixtures`` -- skipped (not failed) if the real
     engine genuinely is not available in the environment running the
     suite (Step 18's "unit tests with fake OCR engine, integration
     test opt-in" split; here the integration tests opt out
     automatically via a real availability check rather than a fake
     engine, since the real Tesseract binary is either present or
     not, deterministically, for a given environment).
"""

from __future__ import annotations

import pytest

from backend.documents import ocr_adapter
from backend.documents.exceptions import (
    OCREmptyExtractionError,
    OCRPageLimitExceededError,
)
from tests.documents import fixtures

OCR_REALLY_AVAILABLE = ocr_adapter.is_available()
FONT_AVAILABLE = fixtures.dejavu_font_available()

requires_real_ocr = pytest.mark.skipif(
    not OCR_REALLY_AVAILABLE,
    reason="Tesseract engine not available in this environment",
)
requires_fixture_font = pytest.mark.skipif(
    not FONT_AVAILABLE,
    reason="DejaVu Sans font not available to render scanned-PDF fixtures",
)


# ---------------------------------------------------------------------
# Deterministic unit tests: meaningful-text threshold (Step 5)
# ---------------------------------------------------------------------


class TestMeaningfulTextThreshold:
    def test_none_is_not_meaningful(self):
        assert ocr_adapter._is_meaningful_ocr_text(None) is False

    def test_empty_string_is_not_meaningful(self):
        assert ocr_adapter._is_meaningful_ocr_text("") is False

    def test_whitespace_only_is_not_meaningful(self):
        assert ocr_adapter._is_meaningful_ocr_text("   \n\t  ") is False

    def test_below_minimum_char_count_is_not_meaningful(self):
        short = "x" * (ocr_adapter.MIN_MEANINGFUL_OCR_CHARS - 1)
        assert ocr_adapter._is_meaningful_ocr_text(short) is False

    def test_exactly_minimum_char_count_is_meaningful(self):
        exact = "a" * ocr_adapter.MIN_MEANINGFUL_OCR_CHARS
        assert ocr_adapter._is_meaningful_ocr_text(exact) is True

    def test_genuine_sentence_is_meaningful(self):
        text = "TorqPro Engineering Document bolted joint torque specification"
        assert ocr_adapter._is_meaningful_ocr_text(text) is True

    def test_mostly_control_character_noise_is_not_meaningful(self):
        # Enough raw character count to pass the length bar alone, but
        # dominated by non-printable noise -- must fail the printable-
        # ratio check.
        noisy = "\x00\x01\x02\x03\x04" * 10  # 50 non-printable chars
        assert ocr_adapter._is_meaningful_ocr_text(noisy) is False

    def test_turkish_characters_count_as_meaningful(self):
        text = "Türkçe karakter testi İĞÜŞÖÇ ığüşöç ölçüm şartname"
        assert ocr_adapter._is_meaningful_ocr_text(text) is True


# ---------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------


class TestAvailability:
    def test_is_available_returns_a_bool(self):
        assert isinstance(ocr_adapter.is_available(), bool)

    def test_is_available_never_raises(self, monkeypatch):
        # Simulate a broken/missing engine -- is_available() must
        # swallow the failure and return False, never propagate.
        import backend.documents.ocr_adapter as mod

        def _boom():
            raise RuntimeError("simulated missing tesseract binary")

        # Patch at the point of use inside is_available()'s try block
        # by making pytesseract.get_tesseract_version explode.
        import pytesseract

        monkeypatch.setattr(pytesseract, "get_tesseract_version", lambda: _boom())
        assert mod.is_available() is False


# ---------------------------------------------------------------------
# Locked constants sanity (Steps 2, 6, 7, 8)
# ---------------------------------------------------------------------


class TestLockedConstants:
    def test_languages_is_turkish_and_english_only(self):
        assert ocr_adapter.OCR_LANGUAGES == "tur+eng"

    def test_page_cap_is_positive_and_bounded(self):
        assert 1 <= ocr_adapter.OCR_MAX_PAGES <= 25

    def test_dpi_is_within_evaluated_range(self):
        assert ocr_adapter.OCR_RENDER_DPI in (150, 200, 300)

    def test_timeout_is_within_evaluated_range(self):
        assert ocr_adapter.OCR_TIMEOUT_SECONDS in (30, 45, 60)

    def test_extraction_method_is_stable_and_distinct_from_markitdown_only(self):
        from backend.documents import markitdown_adapter

        assert ocr_adapter.OCR_EXTRACTION_METHOD != markitdown_adapter.EXTRACTION_METHOD
        assert ocr_adapter.OCR_EXTRACTION_METHOD == "markitdown+ocr"


# ---------------------------------------------------------------------
# Real integration tests (require actual Tesseract + real fixture font)
# ---------------------------------------------------------------------


@requires_real_ocr
@requires_fixture_font
class TestRealOcrExtraction:
    def test_scanned_english_and_turkish_pdf_produces_meaningful_text(self):
        pdf_bytes = fixtures.build_scanned_pdf(page_count=1)
        result = ocr_adapter.ocr_pdf(pdf_bytes)
        # Real Tesseract recognition is not perfect (this is expected
        # -- see Slice 6's own report for measured accuracy notes,
        # e.g. a consistently observed "q"->"g" confusion turning
        # "TorqPro" into "TorgPro" with this specific rendered font).
        # Assert against substrings confirmed to recognize reliably
        # rather than the single most q/g-sensitive word.
        assert "Engineering Document" in result.text
        assert "specification report" in result.text
        assert result.page_count == 1
        assert result.engine == "tesseract"
        assert result.languages == "tur+eng"

    def test_turkish_characters_recognized(self):
        pdf_bytes = fixtures.build_scanned_pdf(page_count=1)
        result = ocr_adapter.ocr_pdf(pdf_bytes)
        # At least a majority of the Turkish-specific characters
        # should round-trip through real OCR recognition -- not
        # asserting 100% (OCR is not perfect; Stage 2/Slice 6's own
        # report documents this honestly), but a meaningful fraction.
        turkish_chars = "ışğüöçİĞÜŞÖÇ"
        found = sum(1 for ch in turkish_chars if ch in result.text)
        assert found >= len(turkish_chars) // 2

    def test_multi_page_scanned_pdf_produces_page_count(self):
        pdf_bytes = fixtures.build_scanned_pdf(page_count=2)
        result = ocr_adapter.ocr_pdf(pdf_bytes)
        assert result.page_count == 2

    def test_blank_scanned_pdf_raises_empty_extraction(self):
        pdf_bytes = fixtures.build_blank_scanned_pdf(page_count=1)
        with pytest.raises(OCREmptyExtractionError):
            ocr_adapter.ocr_pdf(pdf_bytes)

    def test_page_count_exceeding_cap_raises_before_ocr_runs(self):
        pdf_bytes = fixtures.build_scanned_pdf(page_count=ocr_adapter.OCR_MAX_PAGES + 1)
        with pytest.raises(OCRPageLimitExceededError):
            ocr_adapter.ocr_pdf(pdf_bytes)

    def test_engine_version_is_recorded(self):
        pdf_bytes = fixtures.build_scanned_pdf(page_count=1)
        result = ocr_adapter.ocr_pdf(pdf_bytes)
        assert result.engine_version  # non-empty
        assert result.engine_version != "unknown"

    def test_result_hash_deterministic_across_two_runs(self):
        import hashlib

        pdf_bytes = fixtures.build_scanned_pdf(page_count=1)
        r1 = ocr_adapter.ocr_pdf(pdf_bytes)
        r2 = ocr_adapter.ocr_pdf(pdf_bytes)
        # Real OCR of the identical rendered image should produce
        # identical recognized text (deterministic engine, no
        # randomness in Tesseract's recognition for a fixed input).
        h1 = hashlib.sha256(r1.text.encode("utf-8")).hexdigest()
        h2 = hashlib.sha256(r2.text.encode("utf-8")).hexdigest()
        assert h1 == h2
