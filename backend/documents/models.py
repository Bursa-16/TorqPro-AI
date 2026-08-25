"""TorqPro Document Ingestion - extraction result model.

Stage 2 / Slice 2 (MarkItDown Adapter + Magika Content Detection).

Framework-independent (no ``fastapi``, no persistence import) —
matches ``backend.documents.content_validation``'s own convention.
This is the terminal artifact of this slice: nothing downstream of
:class:`ExtractionResult` exists yet (no persistence, no API route,
no AI-gateway hand-off) -- see
``backend/documents/markitdown_adapter.py``'s module docstring for
the explicit statement that this slice ends here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass(frozen=True)
class ExtractionResult:
    """The deterministic, non-authoritative result of validating and
    converting one uploaded document via MarkItDown.

    Every field here is either a direct echo of already-validated
    input (``original_filename``, ``extension``), a value computed
    deterministically from that input (``content_sha256``,
    ``markdown_sha256``, ``character_count``), or a fixed constant
    for this MVP (``extraction_method``, ``original_retained``) --
    nothing here is inferred, summarized, or interpreted (see
    ``markitdown_adapter``'s module docstring, Step 8: "the adapter
    performs extraction, not interpretation").
    """

    original_filename: str
    extension: str
    detected_media_type: str
    file_size_bytes: int
    content_sha256: str
    extraction_method: str
    markitdown_version: str
    markdown_text: str
    markdown_sha256: str
    character_count: int
    warnings: List[str]
    original_retained: bool


#: Locked Stage 2/Slice 3 lifecycle -- exactly these three values, no
#: draft/review/approved/rejected (this domain extracts documents; it
#: does not authorize engineering content -- see Stage 1 design and
#: repository.py's own CHECK constraint, which enforces this same set
#: at the database layer, not just in Python).
DOCUMENT_EXTRACTION_STATUSES = ("processing", "extracted", "failed")


@dataclass(frozen=True)
class DocumentExtractionRecord:
    """The persisted form of one document-extraction attempt.

    Stage 2 / Slice 3. Framework-independent (no ``fastapi``, no
    ``sqlite3`` import here -- this is a plain data carrier;
    ``backend.documents.repository`` is the only module that reads/
    writes actual database rows).

    Nullability reflects the real lifecycle, not a fabricated
    placeholder (Stage 2 / Slice 3 Step 19): a ``status="processing"``
    or ``status="failed"`` record legitimately does not yet know
    ``detected_media_type`` (only determined once content-type
    verification succeeds), nor ``markdown_text`` /
    ``markdown_sha256`` / ``character_count`` (only determined once
    conversion succeeds) -- these stay ``None`` rather than being
    given a fake value merely to satisfy a NOT NULL column. See
    ``repository.py``'s DDL and module docstring for the exact
    database-level nullability this mirrors.

    ``extension`` here is the extension parsed from the original
    filename at record-creation time (always determinable, never
    raises) -- it is NOT a guarantee that the extension is supported
    or that validation succeeded; a ``status="failed"`` record can
    have an ``extension`` value that later turned out to be
    unsupported. The authoritative validation outcome is entirely
    captured by ``status``/``error_summary``, never implied by the
    mere presence of an ``extension`` string.
    """

    id: int
    request_id: str
    original_filename: str
    extension: str
    detected_media_type: Optional[str]
    file_size_bytes: int
    content_sha256: str
    extraction_method: str
    markitdown_version: str
    markdown_text: Optional[str]
    markdown_sha256: Optional[str]
    character_count: Optional[int]
    warnings: List[str]
    status: str
    error_summary: Optional[str]
    original_retained: bool
    created_by: int
    created_at: str


__all__ = ["ExtractionResult", "DocumentExtractionRecord", "DOCUMENT_EXTRACTION_STATUSES"]
