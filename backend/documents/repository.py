"""TorqPro Document Ingestion - SQLite persistence.

Stage 2 / Slice 3.

Mirrors the migration convention already used throughout this
repository (``backend.joints.schema``, ``backend.production_validation
.repository``, ``backend.question_bank.store``): idempotent
``CREATE TABLE IF NOT EXISTS`` DDL, a ``migrate(c)`` function taking
an already-open connection, and read/write functions that likewise
take an open connection/cursor ``c`` as their first parameter rather
than importing any connection-creation logic themselves.

Deliberately does NOT do what
``backend.production_validation.repository`` does (``from backend.app
import conn``) -- that import would transitively pull in ``fastapi``
(``backend/app.py`` imports it at module level), violating this
package's FastAPI-independence requirement (Stage 1 design; Stage 2 /
Slice 3's own "STRICTLY FORBIDDEN" list). Every function here instead
receives its connection from the caller, exactly matching
``backend.ai_gateway.orchestrator.handle_query``'s own established
pattern for a framework-agnostic module that still needs database
access ("Callers supply an already-open sqlite3.Connection... this
module manages no connection lifecycle of its own").

``migrate(c)`` is defined here but, per this slice's explicit scope
limits, is NOT invoked from ``backend/app.py`` yet -- that
registration is deferred to Slice 4, exactly like every other
existing per-domain ``migrate()`` in this repository was wired in as
part of the phase that actually needed the table live (see
``backend/app.py::migrate()``'s own call-site comments for
``migrate_joints``/``migrate_production_validation``/
``migrate_question_bank``, each added in the phase that introduced
that domain's first consumer).

No raw ``sqlite3`` exception is ever allowed to leak past this
module's own function boundaries -- see ``_wrap_sqlite_errors``.
"""

from __future__ import annotations

import json
import sqlite3
from functools import wraps
from typing import List, Optional

from backend.documents.exceptions import (
    DocumentPersistenceError,
    DocumentRecordNotFoundError,
    InvalidDocumentStateTransitionError,
)
from backend.documents.models import DocumentExtractionRecord

#: Locked Stage 2 / Slice 3 lifecycle, enforced at the database layer
#: via CHECK constraint below (not just in Python) -- exactly
#: "processing"/"extracted"/"failed", no draft/review/approved/
#: rejected (see backend.documents.models.DOCUMENT_EXTRACTION_STATUSES
#: for the single source of truth this DDL string is built from).
DDL = """
CREATE TABLE IF NOT EXISTS document_extractions(
  id INTEGER PRIMARY KEY,
  request_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  detected_media_type TEXT,
  file_size_bytes INTEGER NOT NULL,
  content_sha256 TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  markitdown_version TEXT NOT NULL,
  markdown_text TEXT,
  markdown_sha256 TEXT,
  character_count INTEGER,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN ('processing','extracted','failed')),
  error_summary TEXT,
  original_retained INTEGER NOT NULL DEFAULT 0 CHECK(original_retained=0),
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_document_extractions_created_by
  ON document_extractions(created_by);
"""
# Index rationale (Step 24): created_by is the one column Slice 3's
# own ownership-filtered read path (get_owned, below) genuinely
# filters on, and is the near-certain filter column for the "list my
# documents" endpoint Slice 4 will add next -- this mirrors the same
# ownership-scoping already present on `calculations`/`projects` in
# backend/app.py. status/created_at/content_sha256 indexes are
# deliberately NOT added here: nothing in this slice queries by any
# of them, and Step 24 explicitly instructs against adding indexes
# reflexively -- these can be added in whichever future slice first
# introduces a query that actually needs them, following the same
# discipline already visible in backend/joints/schema.py's own
# indexes (each with a stated reason).


def _wrap_sqlite_errors(func):
    """Decorator: map any sqlite3.Error raised by ``func`` to
    DocumentPersistenceError, never letting a raw sqlite3 exception
    (which can embed the database file path) escape this module."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except sqlite3.Error as exc:
            raise DocumentPersistenceError(
                "A database error occurred while accessing document "
                "extraction records."
            ) from exc

    return wrapper


@_wrap_sqlite_errors
def migrate(c) -> None:
    """Apply document_extractions DDL against an open sqlite3
    connection. Idempotent -- safe to call repeatedly (see
    ``tests/documents/test_repository.py::test_migrate_idempotent``).
    """
    c.executescript(DDL)


def _row_to_record(row) -> DocumentExtractionRecord:
    """Convert one ``sqlite3.Row`` into a
    :class:`DocumentExtractionRecord`, parsing ``warnings_json`` back
    into a list and failing closed (Step 6) if it is malformed rather
    than silently returning wrong data."""
    try:
        warnings: List[str] = json.loads(row["warnings_json"])
    except (json.JSONDecodeError, TypeError) as exc:
        raise DocumentPersistenceError(
            "Stored warnings data for this document extraction record "
            "is malformed and could not be read."
        ) from exc
    if not isinstance(warnings, list):
        raise DocumentPersistenceError(
            "Stored warnings data for this document extraction record "
            "is malformed and could not be read."
        )

    return DocumentExtractionRecord(
        id=row["id"],
        request_id=row["request_id"],
        original_filename=row["original_filename"],
        extension=row["extension"],
        detected_media_type=row["detected_media_type"],
        file_size_bytes=row["file_size_bytes"],
        content_sha256=row["content_sha256"],
        extraction_method=row["extraction_method"],
        markitdown_version=row["markitdown_version"],
        markdown_text=row["markdown_text"],
        markdown_sha256=row["markdown_sha256"],
        character_count=row["character_count"],
        warnings=warnings,
        status=row["status"],
        error_summary=row["error_summary"],
        original_retained=bool(row["original_retained"]),
        created_by=row["created_by"],
        created_at=row["created_at"],
    )


@_wrap_sqlite_errors
def create_processing_record(
    c,
    *,
    request_id: str,
    original_filename: str,
    extension: str,
    file_size_bytes: int,
    content_sha256: str,
    markitdown_version: str,
    created_by: int,
    created_at: str,
) -> int:
    """Insert a new ``status="processing"`` row and commit
    immediately (Step 12, Option A: the processing record exists,
    committed, before extraction/conversion runs -- for auditability
    and failure/timeout visibility, exactly as this slice's own
    design instructions require).

    Only fields genuinely known before extraction/conversion has run
    are accepted here (see ``models.DocumentExtractionRecord``'s own
    docstring on nullability): ``extension`` is the filename-parsed,
    not-yet-validated extension; ``file_size_bytes``/
    ``content_sha256`` are computed directly from the raw bytes
    (always available, independent of validation outcome);
    ``markitdown_version`` is static per-process package metadata
    (always available, independent of content). Every other
    provenance/result field (``detected_media_type``,
    ``markdown_text``, ``markdown_sha256``, ``character_count``)
    starts ``NULL`` and is set only by :func:`mark_extracted`;
    ``warnings_json`` starts at its schema default (``'[]'``, an
    honest "no warnings recorded yet" state, not a fabricated value);
    ``original_retained`` is always ``0`` (also enforced by a CHECK
    constraint at the schema level -- see DDL above).

    Returns the new row's id.
    """
    c.execute(
        "INSERT INTO document_extractions("
        "request_id, original_filename, extension, file_size_bytes, "
        "content_sha256, extraction_method, markitdown_version, "
        "status, created_by, created_at"
        ") VALUES(?,?,?,?,?,?,?,?,?,?)",
        (
            request_id,
            original_filename,
            extension,
            file_size_bytes,
            content_sha256,
            "markitdown",
            markitdown_version,
            "processing",
            created_by,
            created_at,
        ),
    )
    document_id = c.execute("SELECT last_insert_rowid() id").fetchone()["id"]
    c.commit()
    return document_id


def _fetch_by_id(c, document_id: int):
    """Internal, non-ownership-filtered row fetch -- used only by
    the lifecycle-transition functions below, which operate on a row
    id that the immediately preceding step in the same service flow
    just created (a trusted context, not a user-facing lookup). This
    is deliberately kept separate from, and never used as a
    substitute for, the ownership-filtered public read path
    (:func:`get_owned`) -- see
    ``tests/documents/test_repository.py::TestOwnership`` for the
    test proving the two are not interchangeable.
    """
    return c.execute(
        "SELECT * FROM document_extractions WHERE id=?", (document_id,)
    ).fetchone()


@_wrap_sqlite_errors
def mark_extracted(
    c,
    document_id: int,
    *,
    detected_media_type: str,
    markdown_text: str,
    markdown_sha256: str,
    character_count: int,
    warnings: List[str],
) -> DocumentExtractionRecord:
    """Transition a ``"processing"`` row to ``"extracted"``, setting
    only extraction-result fields that were not already set at
    creation time (Step 9: every provenance field set by
    :func:`create_processing_record` -- ``original_filename``,
    ``extension``, ``file_size_bytes``, ``content_sha256``,
    ``extraction_method``, ``markitdown_version``, ``created_by``,
    ``request_id``, ``created_at``, ``original_retained`` -- is never
    touched by this function's UPDATE statement, which names only
    the five result columns plus ``status``).

    Raises :class:`~backend.documents.exceptions.DocumentRecordNotFoundError`
    if ``document_id`` does not exist, and
    :class:`~backend.documents.exceptions.InvalidDocumentStateTransitionError`
    if the row is not currently ``"processing"`` (Step 20: only
    ``processing -> extracted``/``processing -> failed`` are
    permitted; no retry workflow is authorized in this slice).
    """
    row = _fetch_by_id(c, document_id)
    if row is None:
        raise DocumentRecordNotFoundError(
            f"No document extraction record with id={document_id}."
        )
    if row["status"] != "processing":
        raise InvalidDocumentStateTransitionError(
            f"Cannot mark record id={document_id} as extracted: "
            f"current status is {row['status']!r}, not 'processing'."
        )

    warnings_json = json.dumps(warnings, ensure_ascii=False, separators=(",", ":"))
    c.execute(
        "UPDATE document_extractions SET "
        "detected_media_type=?, markdown_text=?, markdown_sha256=?, "
        "character_count=?, warnings_json=?, status=? "
        "WHERE id=?",
        (
            detected_media_type,
            markdown_text,
            markdown_sha256,
            character_count,
            warnings_json,
            "extracted",
            document_id,
        ),
    )
    c.commit()
    return _row_to_record(_fetch_by_id(c, document_id))


@_wrap_sqlite_errors
def mark_failed(
    c,
    document_id: int,
    *,
    error_summary: str,
) -> DocumentExtractionRecord:
    """Transition a ``"processing"`` row to ``"failed"``, setting
    only ``error_summary`` and ``status`` (Step 9: every provenance
    field is left exactly as :func:`create_processing_record` set it;
    the five extraction-result columns
    (``detected_media_type``/``markdown_text``/``markdown_sha256``/
    ``character_count``) stay ``NULL`` -- a failed record never
    fabricates a result it never actually produced).

    Same not-found/invalid-transition guards as :func:`mark_extracted`
    -- see that function's docstring.
    """
    row = _fetch_by_id(c, document_id)
    if row is None:
        raise DocumentRecordNotFoundError(
            f"No document extraction record with id={document_id}."
        )
    if row["status"] != "processing":
        raise InvalidDocumentStateTransitionError(
            f"Cannot mark record id={document_id} as failed: "
            f"current status is {row['status']!r}, not 'processing'."
        )

    c.execute(
        "UPDATE document_extractions SET error_summary=?, status=? WHERE id=?",
        (error_summary, "failed", document_id),
    )
    c.commit()
    return _row_to_record(_fetch_by_id(c, document_id))


@_wrap_sqlite_errors
def get_owned(c, document_id: int, created_by: int) -> Optional[DocumentExtractionRecord]:
    """Ownership-filtered read: returns the record only if
    ``document_id`` exists AND ``created_by`` matches its owner,
    ``None`` otherwise -- a nonexistent id and a wrong-owner id are
    indistinguishable to the caller, exactly matching
    ``backend.app._get_owned_project``'s own established convention
    (a single ``WHERE id=? AND created_by/user_id=?`` query, not a
    separate existence check followed by a permission check -- this
    is what actually prevents user A from ever distinguishing
    "record doesn't exist" from "record exists but isn't mine" via
    timing or error-message differences).

    No admin override in this slice (Step 10's own instruction) --
    ``get_owned`` applies the same filter regardless of the caller's
    role; a future admin-visibility feature would need its own,
    separately-authorized read path, not a bypass of this one.
    """
    row = c.execute(
        "SELECT * FROM document_extractions WHERE id=? AND created_by=?",
        (document_id, created_by),
    ).fetchone()
    if row is None:
        return None
    return _row_to_record(row)


#: Stage 2 / Slice 4, Step 13: hard cap independent of whatever a
#: caller requests -- mirrors this DDL's own defensive posture
#: (CHECK constraints, exact-type exception mapping) of never trusting
#: a caller-supplied bound at face value.
MAX_LIST_LIMIT = 100


@_wrap_sqlite_errors
def list_owned(
    c, created_by: int, *, limit: int = 50, offset: int = 0
) -> List[DocumentExtractionRecord]:
    """Ownership-filtered list: only rows owned by ``created_by``,
    deterministically ordered ``created_at DESC, id DESC`` (Step 13's
    exact requirement -- newest first, with ``id`` as a stable
    tiebreaker for rows sharing an identical ``created_at`` value, so
    pagination never silently reorders across calls).

    ``limit`` is clamped to ``[1, MAX_LIST_LIMIT]`` and ``offset`` to
    ``>= 0`` regardless of what the caller passes -- defense in depth
    independent of whatever bound the HTTP route layer already
    enforces on its own query parameters.

    No admin override, exactly like :func:`get_owned` -- always
    filtered to the given ``created_by``, never a global listing.
    """
    limit = max(1, min(limit, MAX_LIST_LIMIT))
    offset = max(0, offset)
    rows = c.execute(
        "SELECT * FROM document_extractions WHERE created_by=? "
        "ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        (created_by, limit, offset),
    ).fetchall()
    return [_row_to_record(row) for row in rows]


__all__ = [
    "DDL",
    "MAX_LIST_LIMIT",
    "migrate",
    "create_processing_record",
    "mark_extracted",
    "mark_failed",
    "get_owned",
    "list_owned",
]
