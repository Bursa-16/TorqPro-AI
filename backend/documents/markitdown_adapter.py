"""TorqPro Document Ingestion - MarkItDown conversion adapter.

Stage 2 / Slice 2 (MarkItDown Adapter + Magika Content Detection).

This is the ONLY production module under ``backend.documents`` that
imports ``markitdown`` -- enforced structurally by
``tests/documents/test_dependency_boundaries.py``, not merely by
convention (mirrors how exactly one file,
``backend/api/routes/ai_gateway.py``, is the sole sanctioned importer
of ``backend.ai_gateway`` elsewhere in this repository).

Framework-independent (no ``fastapi``), database-independent (no
persistence import), AI-independent (no ``backend.ai_gateway``
import), calculation-independent (no ``backend.calculation_engine``/
``backend.engineering_core``/``backend.vdi2230_core``/
``backend.torque_recommendation`` import). This slice's terminal
artifact is :class:`~backend.documents.models.ExtractionResult` --
nothing exists downstream of it yet (no persistence, no HTTP route,
no AI-gateway hand-off; see Stage 1 design, Step 19: "This slice ends
at ExtractionResult. Nothing beyond it.").

Locked call order (Stage 2, Step 6) -- MarkItDown must never see
bytes that have not already passed TorqPro's own validation:

    raw bytes
      -> content_validation.validate_extension
      -> content_validation.validate_size
      -> content_validation.validate_content_type (real Magika detector)
      -> content_validation.validate_ooxml_structure
      -> content_validation.validate_archive_safety
      -> MarkItDown().convert_stream(...)
      -> ExtractionResult

The four validation/structure/archive steps above are exactly
:func:`backend.documents.content_validation.validate_document`,
called first and unconditionally by :func:`extract_document` below --
this module never bypasses or duplicates that logic, it only adds the
conversion step after it succeeds. See
``tests/documents/test_markitdown_adapter.py::TestCallOrder`` for the
test proving a validation failure prevents the converter from ever
being invoked.

Why this order matters (restated from Stage 1's central finding,
reconfirmed with the real installed package in this slice): MarkItDown
0.1.7 does not reliably raise its own exceptions for corrupt,
mislabeled, or structurally invalid input -- a plain-text file renamed
``.pdf`` and a generic (non-OOXML) ZIP renamed ``.docx`` both convert
"successfully" via a silent, permissive plain-text fallback path in
real testing, and even a raw ``.exe`` binary converts to the four
literal characters ``"None"`` rather than raising. TorqPro's own
validation, not MarkItDown's own behavior, is the actual security
boundary -- this module exists specifically so that boundary is
enforced before any MarkItDown call, every time, with no code path
that skips it.
"""

from __future__ import annotations

import hashlib
import io
from importlib import metadata as importlib_metadata
from typing import List, Optional, Protocol, runtime_checkable

from markitdown import (
    FileConversionException,
    MarkItDown,
    MissingDependencyException,
    StreamInfo,
    UnsupportedFormatException,
)

from backend.documents import content_validation
from backend.documents.exceptions import (
    DocumentIngestionError,
    EmptyExtractionError,
    ExtractionFailedError,
    MissingDocumentDependencyError,
)
from backend.documents.models import ExtractionResult

#: Fixed, locked value for ExtractionResult.extraction_method (Stage 1
#: design, Stage 2 spec Step 7). Never anything else in this MVP.
EXTRACTION_METHOD: str = "markitdown"

#: Fixed, locked value for ExtractionResult.original_retained (Stage 1
#: design: the raw uploaded binary is never persisted). This module
#: never writes the original bytes to disk or to any persistence
#: layer -- there is nothing to retain in the first place, and this
#: constant simply makes that guarantee an explicit, checkable field
#: on every result rather than an implicit fact about what this
#: module happens not to do.
ORIGINAL_RETAINED: bool = False

#: MarkItDown 0.1.7 was observed (Stage 1, reconfirmed in this slice)
#: to render genuinely unparseable/unsupported content as the four
#: literal characters "None" (a Python str, not the None object, and
#: not empty/whitespace) rather than raising. Any output that is
#: empty, whitespace-only, or exactly this sentinel is treated as
#: EmptyExtractionError -- see Step 9 and _is_meaningless_markdown().
_MARKITDOWN_NONE_SENTINEL = "None"


def _is_meaningless_markdown(text: Optional[str]) -> bool:
    """True if ``text`` should be treated as "no meaningful content
    extracted", per Step 9's explicit instruction not to treat the
    literal string ``"None"`` as valid content merely because it is
    non-empty characters."""
    if text is None:
        return True
    stripped = text.strip()
    if stripped == "":
        return True
    if stripped == _MARKITDOWN_NONE_SENTINEL:
        return True
    return False


# ---------------------------------------------------------------------
# Converter abstraction (mirrors content_validation.ContentTypeDetector's
# own pattern: a narrow Protocol + a real, MarkItDown-backed
# implementation), so tests can inject a fake converter that records
# whether it was called without needing a live MarkItDown/Magika stack
# -- see Step 6's own instruction: "Avoid implementation coupling in
# tests where possible."
# ---------------------------------------------------------------------


@runtime_checkable
class DocumentConverter(Protocol):
    """Narrow, injectable conversion boundary. Implementations
    receive already-validated bytes (Slice 1 validation has already
    passed by the time anything implementing this Protocol is
    called) and must return extracted Markdown text, or raise a
    :mod:`backend.documents.exceptions` subclass on failure. This
    Protocol never receives or returns anything MarkItDown-specific
    (no ``DocumentConverterResult``, no ``StreamInfo``) -- those
    types are confined entirely to :class:`MarkItDownConverter`.
    """

    def convert(self, content: bytes, *, filename: str, extension: str) -> Optional[str]:
        ...


class MarkItDownConverter:
    """Real, MarkItDown-backed implementation of
    :class:`DocumentConverter`.

    Verified against the actually-installed ``markitdown`` 0.1.7
    public API (Stage 1's Step 6 validation, reconfirmed in this
    slice): ``MarkItDown().convert_stream(stream, *, stream_info=...)
    -> DocumentConverterResult``, with the extracted text on
    ``result.text_content``. ``StreamInfo``/``MarkItDown``/the three
    exception types below are all confirmed to be exposed on
    ``markitdown``'s own public top-level namespace (``from
    markitdown import ...`` -- no private ``markitdown._stream_info``
    or similar import anywhere in this module), satisfying Step 3's
    "use the smallest stable public API" instruction.

    ``convert_stream()`` was chosen (over ``convert_local()``/
    ``convert()`` with a path) specifically because it accepts an
    ``io.BytesIO`` directly -- no temporary file is ever written to
    disk by this class, matching Stage 1's persistence design
    (original binary is never retained, see ``ORIGINAL_RETAINED``).

    Every exception this class can encounter is caught here and
    re-raised as one of this package's own exception types (never a
    raw MarkItDown/underlying-library exception, never a filesystem
    path, never a Python traceback) -- see :meth:`convert`'s
    docstring for the exact mapping.
    """

    def __init__(self) -> None:
        self._markitdown: Optional[MarkItDown] = None

    def _get_markitdown(self) -> MarkItDown:
        if self._markitdown is None:
            self._markitdown = MarkItDown()
        return self._markitdown

    def convert(self, content: bytes, *, filename: str, extension: str) -> Optional[str]:
        """Convert already-validated ``content`` to Markdown text.

        Passes ``filename``/``extension`` through to MarkItDown as
        hints only (via ``StreamInfo``) -- MarkItDown's own internal
        format dispatch, not TorqPro's already-completed validation,
        decides how to interpret them; this call happens only after
        :func:`extract_document` has already independently confirmed
        (via ``content_validation.validate_document``) that ``content``
        genuinely matches ``extension``. No client-supplied MIME type
        is ever passed here -- only the internally-validated
        extension, per Step 5's explicit instruction not to pass
        unvalidated client MIME blindly.

        Raises:
            MissingDocumentDependencyError: MarkItDown reports a
                missing optional dependency for this format
                (``MissingDependencyException``) -- a deployment/
                packaging issue, not a bad-input issue.
            ExtractionFailedError: any other conversion failure,
                whether one of MarkItDown's own documented exception
                types (``UnsupportedFormatException``,
                ``FileConversionException``) or any other exception
                raised during conversion (deliberately broad --
                Stage 1 found real corruption can surface as a
                downstream library exception, e.g. from
                ``pdfminer``/``openpyxl``, rather than one of
                MarkItDown's own types). The original exception is
                never included in the raised message text; Python
                exception chaining (``from exc``) is used so it
                remains inspectable via ``__cause__`` for internal
                debugging, without ever being part of the public,
                stable message string itself.
        Note: this method does not itself check for "meaningless"
        output (the literal string ``"None"``, empty, or whitespace-
        only) -- that check is centralized in
        :func:`extract_document` instead (applies uniformly to
        *any* :class:`DocumentConverter` implementation's output, not
        just this one), so it is described here only in outline; see
        :func:`_is_meaningless_markdown` and :func:`extract_document`
        for the actual enforcement point.
        """
        stream_info = StreamInfo(extension=extension, filename=filename)
        markitdown = self._get_markitdown()
        try:
            result = markitdown.convert_stream(
                io.BytesIO(content), stream_info=stream_info
            )
        except MissingDependencyException as exc:
            raise MissingDocumentDependencyError(
                "A required optional dependency for this document format "
                "is not available."
            ) from exc
        except (UnsupportedFormatException, FileConversionException) as exc:
            raise ExtractionFailedError(
                "The document could not be converted to Markdown."
            ) from exc
        except Exception as exc:  # noqa: BLE001 - deliberately broad, see docstring
            raise ExtractionFailedError(
                "The document could not be converted to Markdown."
            ) from exc

        return getattr(result, "text_content", None)


# ---------------------------------------------------------------------
# Version capture
# ---------------------------------------------------------------------


def get_markitdown_version() -> str:
    """Return the actually-installed ``markitdown`` package version
    via ``importlib.metadata`` -- never a hardcoded string in
    production result logic, per Step 11. (Tests may separately
    assert the exact expected value, ``"0.1.7"``, since
    ``requirements.txt`` pins it exactly -- see
    ``tests/documents/test_markitdown_adapter.py``.)
    """
    return importlib_metadata.version("markitdown")


# ---------------------------------------------------------------------
# Hash contract
# ---------------------------------------------------------------------


def _content_sha256(content: bytes) -> str:
    """SHA-256 of the original, already-validated bytes -- no
    alternate encoding, matches Step 12's locked contract exactly."""
    return hashlib.sha256(content).hexdigest()


def _markdown_sha256(markdown_text: str) -> str:
    """SHA-256 of the extracted Markdown, UTF-8 encoded -- no
    alternate encoding, matches Step 12's locked contract exactly."""
    return hashlib.sha256(markdown_text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------
# Public extraction entry point
# ---------------------------------------------------------------------


def extract_document(
    content: bytes,
    filename: str,
    *,
    detector: Optional[content_validation.ContentTypeDetector] = None,
    converter: Optional[DocumentConverter] = None,
) -> ExtractionResult:
    """Validate and convert ``content`` (already-in-memory bytes) to
    an :class:`ExtractionResult`, in the locked order documented in
    this module's own docstring.

    ``detector`` defaults to a real
    :class:`~backend.documents.content_validation.MagikaContentTypeDetector`
    and ``converter`` defaults to a real :class:`MarkItDownConverter`
    -- both are injectable purely so tests can substitute fakes (see
    ``tests/documents/test_markitdown_adapter.py::TestCallOrder``)
    without needing implementation coupling to the real Magika/
    MarkItDown stack; production callers are expected to call this
    function with no arguments beyond ``content``/``filename``.

    Validation
    (``content_validation.validate_document``, which itself runs
    extension -> size -> content-type -> OOXML structure -> archive
    safety, exactly as documented in ``content_validation.py``) is
    called first and unconditionally. If it raises, this function
    propagates that exception unchanged and ``converter.convert()`` is
    never called -- there is no code path in this function that
    reaches conversion without validation having already succeeded.

    ``warnings`` on the returned result is always an empty list in
    this slice: MarkItDown 0.1.7's public API surface (confirmed in
    Stage 1's and this slice's own inspection) does not expose any
    structured warning/diagnostic list of its own to surface here,
    and this function does not invent one (Step 7's explicit
    instruction).
    """
    if detector is None:
        detector = content_validation.MagikaContentTypeDetector()
    if converter is None:
        converter = MarkItDownConverter()

    validation = content_validation.validate_document(
        content, filename, detector=detector
    )

    try:
        markdown_text = converter.convert(
            content, filename=filename, extension=validation.extension
        )
    except DocumentIngestionError:
        # Already one of this package's own exception types (e.g.
        # raised by MarkItDownConverter itself per its documented
        # mapping, or by a well-behaved custom DocumentConverter) --
        # propagate unchanged, do not double-wrap.
        raise
    except Exception as exc:  # noqa: BLE001 - safety net for ANY
        # DocumentConverter implementation, not just MarkItDownConverter.
        # MarkItDownConverter itself already maps every MarkItDown/
        # parser-layer exception to a DocumentIngestionError subclass
        # (see its own convert() docstring) and therefore never
        # reaches this branch in production; this net exists so that
        # *no* DocumentConverter implementation -- including a future
        # one, or a test fake -- can leak a raw third-party exception
        # out of extract_document(). The original exception remains
        # inspectable via __cause__ for internal debugging only; it
        # is never part of the raised message text.
        raise ExtractionFailedError(
            "The document could not be converted to Markdown."
        ) from exc

    if _is_meaningless_markdown(markdown_text):
        # Centralized here (not inside MarkItDownConverter.convert())
        # so the guarantee "a returned ExtractionResult always has
        # meaningful markdown_text" holds for ANY DocumentConverter
        # implementation, not just the real MarkItDown-backed one --
        # see Step 9 and _is_meaningless_markdown()'s own docstring
        # for why the literal string "None" specifically must not be
        # treated as valid content.
        raise EmptyExtractionError(
            "Document validated successfully but no meaningful text "
            "content could be extracted."
        )

    warnings: List[str] = []

    return ExtractionResult(
        original_filename=filename,
        extension=validation.extension,
        detected_media_type=validation.content_type_label or "",
        file_size_bytes=validation.size_bytes,
        content_sha256=_content_sha256(content),
        extraction_method=EXTRACTION_METHOD,
        markitdown_version=get_markitdown_version(),
        markdown_text=markdown_text,
        markdown_sha256=_markdown_sha256(markdown_text),
        character_count=len(markdown_text),
        warnings=warnings,
        original_retained=ORIGINAL_RETAINED,
    )


__all__ = [
    "EXTRACTION_METHOD",
    "ORIGINAL_RETAINED",
    "DocumentConverter",
    "MarkItDownConverter",
    "get_markitdown_version",
    "extract_document",
]
