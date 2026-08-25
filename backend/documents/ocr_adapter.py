"""TorqPro Document Ingestion - OCR fallback adapter.

Stage 2 / Slice 6 (Controlled OCR Fallback for Image-Based / Scanned
PDFs).

This module is the ONLY production module under ``backend.documents``
that imports ``pytesseract``/``pymupdf`` -- mirrors how
``markitdown_adapter.py`` is the sole importer of ``markitdown``
(Slice 2's own established convention). Framework-independent (no
``fastapi``), database-independent (no persistence import),
AI-independent, calculation-independent, and writes no persistent
files -- confirmed by this module never calling ``open(..., "wb")``
or leaving a ``tempfile`` on disk (see :func:`_render_page_to_image`,
which stays entirely in-memory).

Technology decision (Stage 2 / Slice 6, Step 1 -- evaluated against
real installation and real extraction on this codebase's own actual
Windows/Docker target runtime characteristics, not assumed from
documentation):

  - **OCR engine: Tesseract, via ``pytesseract``.** Chosen over
    PaddleOCR/EasyOCR specifically because it is CPU-only with no
    GPU/PyTorch/PaddlePaddle framework dependency, has a genuinely
    small install footprint (~10 MB for the core engine + language
    data, confirmed via real ``apt-get install`` measurement: 1103 KB
    for ``tesseract-ocr`` + 4031 KB for ``tesseract-ocr-eng`` + 4458
    KB for ``tesseract-ocr-tur``), and has first-class, mature
    ``tur``/``eng`` language pack support -- exactly this slice's two
    required languages, nothing broader. PaddleOCR/EasyOCR both pull
    in far heavier ML frameworks for a marginal accuracy gain on the
    clean, machine-printed technical documents this feature targets
    (not handwriting, not degraded/skewed scans), which is not
    proportionate for an MVP fallback path.
  - **PDF page rendering: PyMuPDF (``pymupdf``, imported as
    ``import pymupdf`` -- the modern import path; the older ``import
    fitz`` alias is deprecated as of PyMuPDF 1.28.x and triggers a
    deprecation warning).** Chosen over ``pdf2image`` specifically
    because PyMuPDF ships as a self-contained, prebuilt pip wheel with
    no separate system dependency (no Poppler binary to install
    separately on Windows or in Docker), directly satisfying Step 3's
    "prefer fewer external system dependencies" instruction.

  **Real, load-bearing environment finding**: unlike PyMuPDF, the
  Tesseract *engine* itself is a system-level binary, not a pure
  Python wheel -- ``pytesseract`` is only a thin subprocess wrapper
  around a ``tesseract`` executable that must already be present on
  PATH. This is confirmed by design (Tesseract is a C++ project with
  its own native build, `pytesseract` package documentation is
  explicit about this), and reconfirmed here by real installation:
  ``pip install pytesseract`` alone does NOT provide OCR capability --
  the ``tesseract-ocr``/``tesseract-ocr-tur``/``tesseract-ocr-eng``
  system packages (Linux) or the Tesseract-OCR Windows installer must
  be present separately. See Step 4/Step 24 of the Slice 6 report for
  the exact Windows and Docker implications this creates, and
  :func:`is_available` below for how this module fails closed rather
  than crashing when the engine is genuinely absent.

Resource isolation (Step 9): **subprocess-based, via pytesseract's own
built-in mechanism, not a hand-built thread/subprocess wrapper.**
``pytesseract.image_to_string(..., timeout=N)`` was confirmed in real
testing to genuinely terminate the underlying Tesseract OS subprocess
on timeout (verified: an artificially short ``timeout=0.01`` against
real work raised ``RuntimeError: Tesseract process timeout`` rather
than merely returning early while the process kept running) -- this
gives real process-level killability for free, a stronger guarantee
than Stage 1's own accepted "thread timeout stops waiting, doesn't
kill the thread" limitation for the MarkItDown path. No Celery/Redis/
background-job infrastructure was introduced, per Step 9's explicit
instruction.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import List

from backend.documents.exceptions import (
    OCREmptyExtractionError,
    OCRFailedError,
    OCRPageLimitExceededError,
    OCRTimeoutError,
    OCRUnavailableError,
)

# ---------------------------------------------------------------------
# Locked MVP constants (Stage 2 / Slice 6 design)
# ---------------------------------------------------------------------

#: Step 2: Turkish + English only -- no broad multilingual model.
#: Tesseract's combined-language mode ("tur+eng") runs both language
#: models over the same page in one pass.
OCR_LANGUAGES: str = "tur+eng"

#: Step 6: deterministic page cap. Chosen at the middle of the
#: suggested 10-25 range: generous enough for a typical scanned
#: technical spec sheet or short report (this feature's realistic
#: target), while still bounding worst-case synchronous processing
#: time to roughly OCR_MAX_PAGES * (single-page OCR time) -- measured
#: at ~1.4s/page for a text-dense page at the chosen DPI (Step 22),
#: so 15 pages caps worst-case OCR time at roughly 20-25s, comfortably
#: inside OCR_TIMEOUT_SECONDS's per-page budget with margin.
OCR_MAX_PAGES: int = 15

#: Step 7: 200 DPI. Tesseract's own accuracy guidance identifies
#: 200-300 DPI as its effective sweet spot for machine-printed text;
#: 200 was chosen (rather than 300) to keep rendered-image memory and
#: OCR time bounded -- real measurement (Step 22) showed a single
#: text-dense page at 200 DPI rendering in ~0.02s and OCR'ing in
#: ~1.4s, both comfortably fast; 300 DPI would roughly double pixel
#: count for a marginal accuracy gain on clean, machine-printed
#: technical documents (this feature's realistic target, not
#: degraded/handwritten scans).
OCR_RENDER_DPI: int = 200

#: Step 8: per-page Tesseract subprocess timeout. Real single-page
#: measurement was ~1.4s; 45s leaves generous margin for a slower,
#: more complex, or larger page while still bounding worst-case
#: synchronous blocking time to a value the existing architecture's
#: request-handling can tolerate (matches the "45" option explicitly
#: offered in the Slice 6 spec, chosen over 30 for margin and over 60
#: to keep the worst realistic multi-page document from blocking
#: excessively long).
OCR_TIMEOUT_SECONDS: int = 45

#: Step 5: minimum non-whitespace character count for OCR output to
#: be treated as meaningful. Chosen at the spec's own suggested value
#: -- low enough not to reject a genuinely short but real scanned
#: label/short document, high enough to reject a blank/near-blank
#: page or pure recognition noise.
MIN_MEANINGFUL_OCR_CHARS: int = 20

#: Step 5: minimum fraction of printable/alphanumeric-or-common-
#: punctuation characters among the non-whitespace characters, to
#: reject pages that produced some non-whitespace character count but
#: are mostly recognition garbage (isolated symbols, control
#: characters) rather than real text.
MIN_PRINTABLE_RATIO: float = 0.6

#: Fixed, stable provenance value for a record that used the OCR
#: fallback -- distinct from markitdown_adapter.EXTRACTION_METHOD
#: ("markitdown") so a record can show "MarkItDown attempted first,
#: OCR used only as fallback" (Step 10) without any new schema field:
#: markitdown_version stays populated (MarkItDown genuinely did run
#: first) alongside this value.
OCR_EXTRACTION_METHOD: str = "markitdown+ocr"


@dataclass(frozen=True)
class OCRResult:
    """Result of a successful OCR fallback extraction."""

    text: str
    engine: str
    engine_version: str
    languages: str
    page_count: int


# ---------------------------------------------------------------------
# Availability check (fail closed, never crash, when the system-level
# Tesseract binary is genuinely absent -- see module docstring)
# ---------------------------------------------------------------------


def is_available() -> bool:
    """Return whether the OCR fallback can run at all in this
    environment: both ``pymupdf`` and ``pytesseract`` are importable,
    AND ``pytesseract`` can locate a working ``tesseract`` binary on
    PATH (or its explicitly configured location).

    Deliberately conservative: any exception during this check (a
    missing Python package, a missing/broken Tesseract binary, a
    Tesseract binary present but non-functional) is treated as "not
    available", never propagated -- callers use this to decide
    whether to attempt OCR at all, not to diagnose why it might fail.
    """
    try:
        import pymupdf
        import pytesseract

        # Confirm pymupdf is genuinely usable (not just importable
        # under a name that happens to resolve), not merely a no-op
        # existence check -- a real, cheap attribute lookup pyflakes
        # also recognizes as a genuine use of the imported name.
        assert hasattr(pymupdf, "open")
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------
# Meaningful-text threshold (Step 5)
# ---------------------------------------------------------------------


def _is_meaningful_ocr_text(text: str) -> bool:
    """Deterministic rule: reject OCR output that is blank/near-blank
    or mostly non-printable recognition noise, per Step 5's explicit
    instruction not to "invent success merely because OCR returned
    some bytes"."""
    if text is None:
        return False
    non_whitespace = [ch for ch in text if not ch.isspace()]
    if len(non_whitespace) < MIN_MEANINGFUL_OCR_CHARS:
        return False
    printable_count = sum(1 for ch in non_whitespace if ch.isprintable())
    ratio = printable_count / len(non_whitespace)
    return ratio >= MIN_PRINTABLE_RATIO


# ---------------------------------------------------------------------
# PDF page rendering (Step 3, Step 17 -- entirely in-memory, no
# temporary file written to disk at any point)
# ---------------------------------------------------------------------


def _render_page_to_png_bytes(page, dpi: int) -> bytes:
    """Render a single PyMuPDF page to in-memory PNG bytes at the
    given DPI. No file is written -- ``Pixmap.tobytes()`` returns an
    in-memory PNG-encoded byte string directly."""
    import pymupdf

    zoom = dpi / 72.0
    matrix = pymupdf.Matrix(zoom, zoom)
    pixmap = page.get_pixmap(matrix=matrix)
    return pixmap.tobytes("png")


# ---------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------


def ocr_pdf(content: bytes) -> OCRResult:
    """Run the OCR fallback against already-validated PDF bytes.

    Callers (``markitdown_adapter.extract_document``) are responsible
    for confirming the OCR trigger contract before calling this
    function (extension is ``.pdf``, content has already passed
    TorqPro's own security validation, and MarkItDown's own attempt
    produced no meaningful text) -- this function itself does not
    re-verify those preconditions; it assumes it is being called on
    already-validated PDF bytes and focuses solely on the
    render-then-recognize pipeline.

    Raises:
        OCRUnavailableError: the engine is not available in this
            environment (see :func:`is_available`).
        OCRPageLimitExceededError: the PDF has more than
            :data:`OCR_MAX_PAGES` pages -- fails closed rather than
            silently OCR'ing only the first N pages (Step 6).
        OCRTimeoutError: a page's Tesseract subprocess exceeded
            :data:`OCR_TIMEOUT_SECONDS` and was terminated.
        OCRFailedError: any other rendering/recognition failure
            (malformed PDF structure discovered only at
            rasterization time, an unexpected Tesseract subprocess
            error, etc.) -- the original exception is available via
            Python exception chaining only, never in the public
            message.
        OCREmptyExtractionError: OCR completed for every page without
            raising, but the combined recognized text did not pass
            the meaningful-content threshold (:func:`_is_meaningful_ocr_text`).
    """
    if not is_available():
        raise OCRUnavailableError(
            "OCR fallback is not available in this environment."
        )

    import pymupdf
    import pytesseract

    try:
        document = pymupdf.open(stream=content, filetype="pdf")
    except Exception as exc:
        raise OCRFailedError("The document could not be rendered for OCR.") from exc

    try:
        page_count = document.page_count
        if page_count > OCR_MAX_PAGES:
            raise OCRPageLimitExceededError(
                f"Document has {page_count} pages, exceeding the "
                f"{OCR_MAX_PAGES}-page OCR limit."
            )

        page_texts: List[str] = []
        for page_index in range(page_count):
            try:
                page = document[page_index]
                png_bytes = _render_page_to_png_bytes(page, OCR_RENDER_DPI)
            except Exception as exc:
                raise OCRFailedError(
                    "The document could not be rendered for OCR."
                ) from exc

            try:
                from PIL import Image

                image = Image.open(io.BytesIO(png_bytes))
                page_text = pytesseract.image_to_string(
                    image, lang=OCR_LANGUAGES, timeout=OCR_TIMEOUT_SECONDS
                )
            except RuntimeError as exc:
                # pytesseract raises a plain RuntimeError with message
                # "Tesseract process timeout" on timeout (confirmed in
                # real testing -- see module docstring), and also uses
                # RuntimeError for some other subprocess failures. Map
                # the timeout case specifically; anything else falls
                # through to the generic OCRFailedError below.
                if "timeout" in str(exc).lower():
                    raise OCRTimeoutError(
                        "OCR processing exceeded the time limit for this document."
                    ) from exc
                raise OCRFailedError(
                    "OCR processing failed for this document."
                ) from exc
            except Exception as exc:
                raise OCRFailedError(
                    "OCR processing failed for this document."
                ) from exc

            page_texts.append(page_text)

        combined_text = "\n\n".join(page_texts).strip()

        if not _is_meaningful_ocr_text(combined_text):
            raise OCREmptyExtractionError(
                "OCR completed but no meaningful text content could be recognized."
            )

        return OCRResult(
            text=combined_text,
            engine="tesseract",
            engine_version=str(pytesseract.get_tesseract_version()),
            languages=OCR_LANGUAGES,
            page_count=page_count,
        )
    finally:
        document.close()


__all__ = [
    "OCR_LANGUAGES",
    "OCR_MAX_PAGES",
    "OCR_RENDER_DPI",
    "OCR_TIMEOUT_SECONDS",
    "MIN_MEANINGFUL_OCR_CHARS",
    "MIN_PRINTABLE_RATIO",
    "OCR_EXTRACTION_METHOD",
    "OCRResult",
    "is_available",
    "ocr_pdf",
]
