"""TorqPro Document Ingestion HTTP API.

Stage 2 / Slice 4 (Migration Registration + Upload/Read API + Auth +
Audit).

Thin FastAPI routes over the existing, already-tested
``backend.documents.ingestion_service.ingest_document`` orchestration
layer (Slice 3), which itself orchestrates ``backend.documents.
markitdown_adapter.extract_document`` (Slice 1/2) and ``backend.
documents.repository`` (Slice 3). No validation rule, hashing
algorithm, Magika/OOXML check, MarkItDown conversion, or persistence
statement lives in this module -- every one of those already lives in
those three modules and is covered by their own dedicated test files;
this module only does request validation (bounded file reading,
required-auth), the service call itself, response serialization,
audit persistence, and domain-exception -> ``HTTPException`` mapping.
Follows ``backend/api/routes/torque_recommendation.py``'s /
``backend/api/routes/washer_resolution_closure.py``'s established
pattern (``APIRouter``, ``Depends(user)``, an optional
``X-Request-ID`` header stored verbatim, a single central
``_handle()``-style exception-mapping point, deferred
``from backend.app import ...`` inside function bodies) without
introducing a new convention.

**Untrusted Markdown boundary (Step 14):** every ``markdown_text``
value this module returns is raw extracted document content --
``UNTRUSTED USER-CONTROLLED CONTENT``, not TorqPro-authored or
AI-authored text. This module returns it as a plain JSON string field
and does nothing else with it: never rendered server-side as HTML,
never executed, never passed to any AI Gateway call (this module does
not and must not import ``backend.ai_gateway`` -- see
``tests/documents/test_dependency_boundaries.py``, which now also
covers this route module), never evaluated as a formula, never
interpreted as an instruction. A future frontend consuming this field
must treat it as inert display text (e.g. escaped/plain-text
rendering), not as trusted HTML/script -- this module's own
responsibility ends at "return the string unchanged, correctly
labeled as extracted source content, never authoritative engineering
data" -- see the field's response-model description below for the
exact wording exposed in the OpenAPI schema.

Deliberately does NOT introduce ``backend.documents.repository``'s own
``sqlite3.Connection`` handling into this module beyond the single
``with conn() as c:`` block per request, matching every other route
module's own transaction-boundary convention.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter(tags=["documents"])

# `router` is assigned before these imports for the same reason
# backend/api/routes/joints.py / torque_recommendation.py already
# document on their own equivalent import blocks: if backend.app ends
# up re-entering this module while it is still mid-import, the
# partially-initialized module already exposes a usable `router`
# attribute, which breaks a circular-import failure instead of
# propagating it.
from backend.api.dependencies import user  # noqa: E402
from backend.documents import content_validation, ingestion_service, repository  # noqa: E402
from backend.documents.exceptions import (  # noqa: E402
    ContentTypeMismatchError,
    DocumentIngestionError,
    DocumentPersistenceError,
    DocumentTooLargeError,
    EmptyDocumentError,
    EmptyExtractionError,
    ExtractionFailedError,
    MalformedOOXMLError,
    MissingDocumentDependencyError,
    SuspiciousArchiveError,
    UnsupportedExtensionError,
)
from backend.documents.models import DocumentExtractionRecord  # noqa: E402

import logging  # noqa: E402

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------
# Bounded upload reading (Step 4)
# ---------------------------------------------------------------------

#: Read in 1 MiB chunks -- small enough that a rejection triggers
#: after at most one chunk past the limit, large enough that a
#: legitimate ~few-MB engineering document is read in a handful of
#: iterations rather than thousands of tiny ones.
_READ_CHUNK_SIZE = 1024 * 1024


async def _read_bounded(file: UploadFile, max_bytes: int) -> bytes:
    """Read ``file`` in bounded chunks, rejecting as soon as
    accumulated bytes exceed ``max_bytes`` -- never calls
    ``await file.read()`` with no argument (Step 4's explicit
    prohibition) and never trusts ``Content-Length``/
    ``UploadFile.size``/client MIME as the actual security boundary;
    those are, at most, hints FastAPI/Starlette may or may not have
    populated from client-supplied headers, never verified against
    the real byte stream. The only thing this function trusts is the
    number of bytes it has itself actually read so far.

    Raises :class:`~backend.documents.exceptions.DocumentTooLargeError`
    (mapped to HTTP 413 by :func:`_handle`) the moment the running
    total exceeds ``max_bytes`` -- reading stops immediately at that
    point; this function never continues consuming the remaining
    request body after the limit is exceeded.
    """
    chunks: List[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise DocumentTooLargeError(
                f"Uploaded content exceeds the maximum allowed size of "
                f"{max_bytes} bytes (15 MiB)."
            )
        chunks.append(chunk)
    return b"".join(chunks)


# ---------------------------------------------------------------------
# Response models (Step 17: explicit Pydantic types, never a raw
# sqlite3.Row / dataclass returned directly)
# ---------------------------------------------------------------------


class DocumentExtractionResponse(BaseModel):
    """Stable, explicit response shape for both the upload endpoint
    and the single-record read endpoint -- deliberately the same
    model for both, so a client that just uploaded a document and one
    that later fetches it by id see an identical shape.

    ``markdown_text``: raw text extracted from the uploaded document
    by MarkItDown -- untrusted, user-controlled content, not TorqPro-
    or AI-authored, and never authoritative engineering data (see
    this module's own docstring, "Untrusted Markdown boundary"). Null
    while ``status`` is ``"processing"``/``"failed"``.

    ``created_by``/internal-only fields (``_fetch_by_id``'s raw row
    shape) are deliberately NOT exposed here -- only what a client
    legitimately needs.
    """

    id: int
    request_id: str
    original_filename: str
    extension: str
    detected_media_type: Optional[str] = None
    file_size_bytes: int
    content_sha256: str
    extraction_method: str
    markitdown_version: str
    markdown_text: Optional[str] = None
    markdown_sha256: Optional[str] = None
    character_count: Optional[int] = None
    warnings: List[str]
    status: str
    error_summary: Optional[str] = None
    original_retained: bool
    created_at: str

    @classmethod
    def from_record(cls, record: DocumentExtractionRecord) -> "DocumentExtractionResponse":
        return cls(
            id=record.id,
            request_id=record.request_id,
            original_filename=record.original_filename,
            extension=record.extension,
            detected_media_type=record.detected_media_type,
            file_size_bytes=record.file_size_bytes,
            content_sha256=record.content_sha256,
            extraction_method=record.extraction_method,
            markitdown_version=record.markitdown_version,
            markdown_text=record.markdown_text,
            markdown_sha256=record.markdown_sha256,
            character_count=record.character_count,
            warnings=record.warnings,
            status=record.status,
            error_summary=record.error_summary,
            original_retained=record.original_retained,
            created_at=record.created_at,
        )


class DocumentExtractionListResponse(BaseModel):
    documents: List[DocumentExtractionResponse]


# ---------------------------------------------------------------------
# Exception mapping (Step 10) -- exact Slice 1-3 class names, not
# assumptions. Every branch here is a stable, non-leaky HTTPException;
# nothing raised by content_validation/markitdown_adapter/repository
# is ever passed through to the client as a raw exception string
# beyond what those modules' own docstrings already guarantee is safe
# (each already promises a stable, non-leaky message -- see their own
# `exceptions.py` docstrings).
# ---------------------------------------------------------------------

_STATUS_BY_EXCEPTION_TYPE = {
    UnsupportedExtensionError: 415,
    ContentTypeMismatchError: 415,
    EmptyDocumentError: 422,
    MalformedOOXMLError: 422,
    SuspiciousArchiveError: 422,
    ExtractionFailedError: 422,
    EmptyExtractionError: 422,
    DocumentTooLargeError: 413,
    MissingDocumentDependencyError: 503,
    DocumentPersistenceError: 500,
}


def _http_exception_for(exc: DocumentIngestionError) -> HTTPException:
    """Map a raised domain exception to a stable HTTPException.
    Exact-type lookup (matches ingestion_service.error_summary_for's
    own deliberate strictness) -- a subclass not in the table falls
    back to 500 rather than being guessed at via inheritance.

    The ``detail`` body is a small, stable dict (never a raw
    exception message alone) so a client can branch on
    ``error_summary`` programmatically rather than string-matching a
    human-readable message. ``document_id`` is included when the
    exception carries one (Slice 4's own addition to
    ``ingestion_service``'s failure path, see that module) so a
    client can look up the persisted failed record afterward via
    ``GET /api/documents/{id}`` if it wants the full record -- this
    is deliberately not itself the full record, just enough to
    correlate.
    """
    status_code = _STATUS_BY_EXCEPTION_TYPE.get(type(exc), 500)
    detail = {
        "error": ingestion_service.error_summary_for(exc),
        "message": str(exc),
    }
    document_id = getattr(exc, "document_id", None)
    if document_id is not None:
        detail["document_id"] = document_id
    return HTTPException(status_code, detail)


# ---------------------------------------------------------------------
# Upload endpoint
# ---------------------------------------------------------------------


@router.post("/api/documents/upload", response_model=DocumentExtractionResponse, status_code=201)
async def upload_document_endpoint(
    file: UploadFile = File(...),
    u=Depends(user),
    x_request_id: str = Header(default="", alias="X-Request-ID"),
):
    """Single-file upload -> validate -> extract -> persist.

    ``created_by`` comes exclusively from the authenticated
    ``Depends(user)`` identity (Step 8) -- this endpoint has no
    multipart field, query parameter, or JSON body field named
    ``created_by``/``user_id``/``owner_id`` at all, so there is
    nothing for a client to supply that would ever be read as an
    owner override; ``u["id"]`` is the sole source, exactly as every
    other authenticated write endpoint in this repository already
    does.

    ``file.filename`` is used only as metadata, passed through to
    ``content_validation``'s own extension parsing (never opened as a
    path, never used as a temp-file name -- see
    ``backend.documents.content_validation``'s own module docstring,
    unchanged since Slice 1). An absent/empty filename is not
    special-cased here: it naturally fails
    ``content_validation.validate_extension()``'s existing allow-list
    check (empty string is not one of ``.pdf``/``.docx``/``.xlsx``/
    ``.pptx``) and surfaces as the same stable
    ``UnsupportedExtensionError`` -> 415 as any other bad extension --
    Step 5's "prefer rejection... rather than fabricating a name" is
    satisfied by not needing a special case at all.

    ``file.content_type`` (the client-supplied MIME hint) is never
    read anywhere in this function -- TorqPro's own Magika + OOXML
    validation (Slice 1, unchanged) remains the sole authority on
    content type, exactly per Step 6.
    """
    from backend.app import audit, conn, now_iso

    try:
        content = await _read_bounded(file, content_validation.MAX_UPLOAD_SIZE_BYTES)
    except DocumentTooLargeError as exc:
        # Rejected before ingestion even begins -- no processing/
        # failed row is expected for this specific rejection (Step
        # 21 requires a persisted failed record for an *invalid
        # extraction* that reaches the service layer; a too-large
        # upload is stopped at the transport boundary before that,
        # by design, matching Step 4's "reject without reading
        # unlimited request content into memory"). No "started"
        # audit event fires either, for the same reason.
        raise _http_exception_for(exc)

    filename = file.filename or ""

    audit(u["id"], "document_upload_started", filename, x_request_id)

    with conn() as c:
        try:
            record = ingestion_service.ingest_document(
                c,
                content=content,
                filename=filename,
                created_by=u["id"],
                request_id=x_request_id,
                created_at=now_iso(),
            )
        except DocumentIngestionError as exc:
            error_summary = ingestion_service.error_summary_for(exc)
            document_id = getattr(exc, "document_id", None)
            # Safe audit metadata only (Step 15): document_id,
            # created_by (implicit via u["id"]), request_id, the
            # stable error_summary code -- never the raw exception
            # message, never a stack trace, never document content.
            audit(
                u["id"],
                "document_extraction_failed",
                f"document_id={document_id} error={error_summary}",
                x_request_id,
            )
            raise _http_exception_for(exc)

    audit(
        u["id"],
        "document_extraction_succeeded",
        f"document_id={record.id} sha256={record.content_sha256}",
        x_request_id,
    )
    return DocumentExtractionResponse.from_record(record)


# ---------------------------------------------------------------------
# Single-record read endpoint
# ---------------------------------------------------------------------


@router.get("/api/documents/{document_id}", response_model=DocumentExtractionResponse)
def get_document_endpoint(
    document_id: int,
    u=Depends(user),
    x_request_id: str = Header(default="", alias="X-Request-ID"),
):
    """Ownership-safe single-record retrieval. Uses
    ``repository.get_owned`` exclusively (never the internal,
    unrestricted ``_fetch_by_id``) -- a nonexistent id and another
    user's id are both mapped to the same ``404``, never a ``403``,
    specifically to avoid ownership enumeration (Step 12's explicit
    requirement): a client cannot distinguish "this id doesn't exist"
    from "this id exists but isn't yours" from the response alone.
    """
    from backend.app import audit, conn

    with conn() as c:
        record = repository.get_owned(c, document_id, created_by=u["id"])
    if record is None:
        raise HTTPException(404, {"error": "not_found", "message": "Document not found."})

    audit(u["id"], "document_retrieved", f"document_id={record.id}", x_request_id)
    return DocumentExtractionResponse.from_record(record)


# ---------------------------------------------------------------------
# List endpoint (Step 13)
# ---------------------------------------------------------------------


@router.get("/api/documents", response_model=DocumentExtractionListResponse)
def list_documents_endpoint(
    u=Depends(user),
    limit: int = 50,
    offset: int = 0,
):
    """Ownership-scoped listing, deterministic ``created_at DESC, id
    DESC`` order, bounded pagination (``limit`` clamped to
    ``[1, repository.MAX_LIST_LIMIT]`` inside
    ``repository.list_owned`` itself -- defense in depth independent
    of whatever this route also enforces). No admin bypass, no global
    listing -- always scoped to ``u["id"]``.
    """
    from backend.app import conn

    with conn() as c:
        records = repository.list_owned(c, created_by=u["id"], limit=limit, offset=offset)
    return DocumentExtractionListResponse(
        documents=[DocumentExtractionResponse.from_record(r) for r in records]
    )


__all__ = ["router"]
