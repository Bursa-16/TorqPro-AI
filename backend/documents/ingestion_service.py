"""TorqPro Document Ingestion - orchestration service.

Stage 2 / Slice 3.

Framework-independent: no ``fastapi``, no ``backend.app``, no
``backend.api`` import (mirrors ``backend.documents.repository``'s
own rationale -- importing ``backend.app`` would transitively pull in
``fastapi``). Every function here receives an already-open
``sqlite3`` connection from its caller, exactly like
``backend.ai_gateway.orchestrator.handle_query`` and
``backend.documents.repository`` already do; this module manages no
connection lifecycle, no request-id generation, and no timestamp
generation of its own -- ``request_id``/``created_at`` are supplied
by the caller (a later slice's HTTP route layer, which does have
access to ``backend.app``'s own ``X-Request-ID`` middleware and
``now_iso()``), matching ``handle_query``'s own calling convention
for exactly the same reason.

Orchestrates, does not duplicate (Step 13): every piece of actual
validation/conversion logic -- extension/size/content-type/OOXML
structure/archive-safety checks, Magika detection, MarkItDown
conversion, content and Markdown hashing -- already lives in
``backend.documents.content_validation`` (Slice 1) and
``backend.documents.markitdown_adapter`` (Slice 2), reached here
through the single public entry point
``markitdown_adapter.extract_document()``. This module's only new
logic is: (1) deriving the handful of fields genuinely known before
extraction has even run, so a ``"processing"`` row can be created
first (Step 12, transaction Option A); and (2) mapping a raised
``DocumentIngestionError`` to a stable, non-leaky
``error_summary`` code before persisting a ``"failed"`` row (Step
14).

Locked flow::

    raw bytes + filename + created_by + request_id + created_at
      -> repository.create_processing_record(...)   [committed]
      -> markitdown_adapter.extract_document(...)     [Slice 1/2, unchanged]
      -> on success: repository.mark_extracted(...)   [committed]
         on failure: repository.mark_failed(...)      [committed]
                     -> re-raise the original exception

A caller therefore always receives either a successful
``DocumentExtractionRecord`` (status ``"extracted"``) or a raised
``DocumentIngestionError`` subclass -- there is no third, silent-
failure outcome. A ``"processing"`` row is never left as the final,
observable state of a call to :func:`ingest_document`: the ``try``
block covers only the ``extract_document()`` call itself, and both
the success and failure paths always reach a terminal
``mark_extracted``/``mark_failed`` call before returning or raising.
"""

from __future__ import annotations

import hashlib
from typing import Optional

from backend.documents import repository
from backend.documents.content_validation import ContentTypeDetector
from backend.documents.exceptions import (
    ContentTypeMismatchError,
    DocumentIngestionError,
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
from backend.documents.markitdown_adapter import (
    DocumentConverter,
    extract_document,
    get_markitdown_version,
)
from backend.documents.models import DocumentExtractionRecord

#: Stable, TorqPro-owned failure codes (Step 14) -- persisted instead
#: of raw exception text, which could otherwise embed a filesystem
#: path or third-party library detail (see each exception class's
#: own docstring in exceptions.py for what it represents). Every
#: exception type Slice 1/2's own closed vocabulary can raise from
#: extract_document() is listed explicitly; a subclass not in this
#: mapping (should not happen -- see docstring) falls back to the
#: generic "extraction_failed" code rather than raising a second,
#: unrelated exception while already handling a failure.
#:
#: Stage 2 / Slice 6: the five OCR-fallback exception types are added
#: below, mapped to their own distinct "ocr_*" codes -- never
#: collapsed into the pre-existing non-OCR codes, and never
#: constructed from the raised exception's own message text (which
#: could contain a Tesseract stderr fragment or local path -- see
#: each OCR exception's own docstring in exceptions.py for the
#: specific leak this guards against). Existing non-OCR codes are
#: unchanged.
_ERROR_SUMMARY_BY_EXCEPTION_TYPE = {
    UnsupportedExtensionError: "unsupported_document_format",
    EmptyDocumentError: "empty_document",
    DocumentTooLargeError: "document_too_large",
    ContentTypeMismatchError: "content_type_mismatch",
    MalformedOOXMLError: "malformed_ooxml",
    SuspiciousArchiveError: "suspicious_archive",
    ExtractionFailedError: "extraction_failed",
    EmptyExtractionError: "empty_extraction",
    MissingDocumentDependencyError: "missing_document_dependency",
    OCRUnavailableError: "ocr_unavailable",
    OCRTimeoutError: "ocr_timeout",
    OCRFailedError: "ocr_failed",
    OCREmptyExtractionError: "ocr_empty",
    OCRPageLimitExceededError: "ocr_page_limit",
}

_FALLBACK_ERROR_SUMMARY = "extraction_failed"


def error_summary_for(exc: DocumentIngestionError) -> str:
    """Map a raised exception to its stable, persisted error code.
    Exact-type lookup (not isinstance/MRO walk) -- deliberately
    strict, so introducing a new exception subclass in a future slice
    without adding it here is loudly visible (falls back to the
    generic code, not a silently-wrong specific one) rather than
    guessed at via inheritance.

    Public (Stage 2 / Slice 4): the HTTP route layer
    (``backend/api/routes/documents.py``) reuses this exact mapping
    for its own error response body, so the persisted
    ``error_summary`` and the API's ``error`` field are always the
    same string for the same failure -- never two independent
    mappings that could silently drift apart.
    """
    return _ERROR_SUMMARY_BY_EXCEPTION_TYPE.get(type(exc), _FALLBACK_ERROR_SUMMARY)


def _claimed_extension(filename: str) -> str:
    """Best-effort, non-raising, non-authoritative extension parse
    for record-creation purposes only -- NOT a call into
    ``content_validation.validate_extension()`` (that function
    raises for anything unsupported, which would make it impossible
    to ever create a ``"processing"`` row for an upload that turns
    out to have a bad extension, defeating this slice's own
    Step 12/Step 19 design: a processing record should exist before
    validation has even run, precisely so an early validation failure
    is still auditable as a persisted ``"failed"`` row rather than
    leaving no trace at all).

    This is a deliberate, minimal, single-line duplication of
    ``content_validation``'s own (private, unexported)
    ``_extract_extension`` string-slicing logic -- not a
    reimplementation of any actual validation/business logic (Step
    13's instruction not to reimplement refers to the substantial,
    security-relevant logic: hashing, Magika detection, OOXML
    structure/archive-safety checks, MarkItDown conversion -- none of
    which this function does or approximates). This function's
    result is never treated as authoritative: the real
    ``extension``-validity determination still happens exactly once,
    inside ``extract_document()``'s own call into
    ``content_validation.validate_document()`` -- see
    ``models.DocumentExtractionRecord``'s own docstring for the
    explicit statement that a persisted ``extension`` value never
    implies validation succeeded.

    ``content_validation.py`` is not in this slice's authorized-
    modification list, which is why this logic is not instead
    exposed there as a small public wrapper.
    """
    if not filename:
        return ""
    idx = filename.rfind(".")
    if idx == -1 or idx == len(filename) - 1:
        return ""
    return filename[idx:].lower()


def ingest_document(
    c,
    *,
    content: bytes,
    filename: str,
    created_by: int,
    request_id: str,
    created_at: str,
    detector: Optional[ContentTypeDetector] = None,
    converter: Optional[DocumentConverter] = None,
    ocr_fn=None,
) -> DocumentExtractionRecord:
    """Validate, convert, and persist one uploaded document.

    ``detector``/``converter``/``ocr_fn`` are passed through unchanged
    to :func:`markitdown_adapter.extract_document` (all three default
    to the real Magika/MarkItDown/Tesseract-backed implementations
    when omitted) -- purely so tests can inject fakes, exactly
    mirroring ``extract_document()``'s own reason for accepting them.
    ``ocr_fn`` is Stage 2 / Slice 6's addition, for the same reason.

    On success, returns the persisted, ``status="extracted"``
    :class:`~backend.documents.models.DocumentExtractionRecord`.

    On failure, a ``status="failed"`` row is persisted first (with a
    stable, non-leaky ``error_summary`` -- see
    :func:`error_summary_for`), and then the *original* exception
    raised by ``extract_document()`` is re-raised unchanged (with one
    additional ``document_id`` attribute attached, Stage 2 / Slice 4,
    for the HTTP route layer's own failure-audit correlation -- see
    the ``except`` block below) -- this module never swallows or
    re-wraps an already-typed
    :class:`~backend.documents.exceptions.DocumentIngestionError`
    subclass into a different one; persisting the failure record is
    an additional, transparent side effect of handling the error, not
    a replacement for surfacing it to the caller.
    """
    file_size_bytes = len(content)
    content_sha256 = hashlib.sha256(content).hexdigest()
    claimed_extension = _claimed_extension(filename)
    markitdown_version = get_markitdown_version()

    document_id = repository.create_processing_record(
        c,
        request_id=request_id,
        original_filename=filename,
        extension=claimed_extension,
        file_size_bytes=file_size_bytes,
        content_sha256=content_sha256,
        markitdown_version=markitdown_version,
        created_by=created_by,
        created_at=created_at,
    )

    try:
        result = extract_document(
            content, filename, detector=detector, converter=converter, ocr_fn=ocr_fn
        )
    except DocumentIngestionError as exc:
        error_summary = error_summary_for(exc)
        repository.mark_failed(c, document_id, error_summary=error_summary)
        # Stage 2 / Slice 4: attach the persisted failed record's id
        # to the exception instance so the HTTP route layer's failure
        # audit event can correlate to it without a redundant lookup
        # query -- bare `raise` below preserves the original
        # traceback unchanged; this only adds one new attribute.
        exc.document_id = document_id
        raise

    return repository.mark_extracted(
        c,
        document_id,
        detected_media_type=result.detected_media_type,
        markdown_text=result.markdown_text,
        markdown_sha256=result.markdown_sha256,
        character_count=result.character_count,
        warnings=result.warnings,
    )


__all__ = ["ingest_document", "error_summary_for"]
