"""TorqPro Document Ingestion - exception hierarchy.

Stage 2 / Slice 1 (Content Validation Security Foundation). This
module defines only the exception types raised by
``backend.documents.content_validation`` -- the independent,
pre-MarkItDown validation layer whose necessity was established in
Stage 1 (see ADR-to-be, Stage 1 report section 7): MarkItDown 0.1.7
was measured to *not* reliably raise its own exceptions for corrupt,
mislabeled, or structurally invalid input (a plain-text file renamed
``.pdf``, a non-OOXML ZIP renamed ``.docx``, and even a ``.exe`` all
converted "successfully" via a silent plain-text fallback path
instead of raising). TorqPro's own validation must therefore fail
closed *before* any document reaches MarkItDown, using its own
exception vocabulary -- not MarkItDown's.

Deliberately framework-agnostic: this module never imports
``fastapi`` (mirrors ``backend.ai_gateway.exceptions``' own
docstring rationale -- HTTP status mapping is a route-layer concern,
introduced in a later slice, not here).

Deliberately does not import or subclass anything from
``backend.ai_gateway.exceptions`` or
``backend.calculation_engine.exceptions``: a document-ingestion
validation failure is not an AI-gateway failure and not a
deterministic-engine failure. It is its own, unrelated hierarchy
(mirrors how ``backend.ai_gateway.exceptions`` itself is deliberately
unrelated to ``backend.calculation_engine.exceptions`` -- see that
module's own docstring).

Every exception message in this module is:
  - deterministic (same invalid input -> same message text, no
    randomness, no timestamps embedded in the message itself);
  - written to be safe to return directly in a future API error body
    (Slice 4) without further sanitization;
  - never includes a filesystem path (this package never opens the
    uploaded content as a path in the first place -- see
    ``content_validation`` module docstring);
  - never includes parser-internal detail or a third-party
    library's own exception message/repr (a future adapter, Slice 2,
    is responsible for catching and re-mapping any MarkItDown/
    underlying-library exception into this module's own vocabulary --
    out of scope for this slice, which never imports ``markitdown``
    at all);
  - never includes a stack trace (callers must not do
    ``str(exc.__traceback__)`` or similar -- nothing in this module
    encourages that).
"""

from __future__ import annotations


class DocumentIngestionError(Exception):
    """Base class for all backend.documents validation/ingestion
    errors. Never raised directly -- always one of the subclasses
    below.
    """


class UnsupportedExtensionError(DocumentIngestionError):
    """The supplied filename's extension is not one of the locked
    MVP-supported extensions (``.pdf``, ``.docx``, ``.xlsx``,
    ``.pptx``), is missing entirely, or is otherwise malformed (e.g.
    a double extension such as ``.pdf.exe``, or trailing whitespace).

    The message intentionally states which extension was rejected
    (safe -- an extension string is not sensitive) but never the
    full filename or any path.
    """


class EmptyDocumentError(DocumentIngestionError):
    """The supplied content is zero bytes."""


class DocumentTooLargeError(DocumentIngestionError):
    """The supplied content exceeds the locked MVP maximum upload
    size (``content_validation.MAX_UPLOAD_SIZE_BYTES``, 15 MiB).

    The message reports the configured limit (safe, static, already
    public via this module) but never the client-declared or
    actually-read byte count beyond what is needed to state that the
    limit was exceeded -- avoiding any incentive to embed a raw,
    attacker-influenced number verbatim into a message that might
    later be logged or displayed unsanitized.
    """


class ContentTypeMismatchError(DocumentIngestionError):
    """The claimed/validated extension does not match the content
    actually detected by the (pluggable, Slice-2-backed) content
    detector -- e.g. a file named ``.pdf`` whose real content is
    plain text, or a file named ``.docx`` whose real content is a
    generic (non-OOXML) ZIP archive.

    Per Stage 1's finding that MarkItDown's own fallback behavior is
    permissive rather than fail-closed, this is the single most
    important rejection path in this module. Any mismatch -- however
    the detector determined it -- must fail closed here, before
    MarkItDown ever sees the bytes.
    """


class MalformedOOXMLError(DocumentIngestionError):
    """The claimed ``.docx``/``.xlsx``/``.pptx`` content failed
    structural OOXML validation: it is not a valid ZIP archive at
    all, or it is a valid ZIP archive that is missing
    ``[Content_Types].xml`` or its required format-specific part
    (``word/document.xml`` / ``xl/workbook.xml`` /
    ``ppt/presentation.xml``).

    Deliberately distinct from :class:`ContentTypeMismatchError`:
    this is a *structural* OOXML validation failure (checked via
    ``zipfile`` central-directory inspection only -- see
    ``content_validation`` module docstring), independent of whatever
    a pluggable content detector reports.
    """


class SuspiciousArchiveError(DocumentIngestionError):
    """The claimed ``.docx``/``.xlsx``/``.pptx`` content's ZIP
    central-directory metadata indicates a decompression-bomb-like
    condition: total uncompressed size, compression ratio, or entry
    count exceeds a locked MVP threshold (see
    ``content_validation.MAX_UNCOMPRESSED_TOTAL_BYTES``,
    ``MAX_COMPRESSION_RATIO``, ``MAX_ARCHIVE_ENTRIES``), or an
    individual entry reports a zero on-disk (compressed) size
    alongside non-zero uncompressed content -- itself treated as
    suspicious rather than divided-by-zero or silently skipped.

    Detected entirely from ZIP central-directory metadata
    (``zipfile.ZipFile.infolist()``) -- no archive member is ever
    decompressed or extracted to reach this determination.
    """


class ExtractionFailedError(DocumentIngestionError):
    """Stage 2 / Slice 2. ``backend.documents.markitdown_adapter``
    caught an exception while converting already-validated content --
    either one of MarkItDown's own documented exception types
    (``UnsupportedFormatException``, ``FileConversionException``) or
    any other exception surfaced during conversion (Stage 1 found
    real corruption can surface as a downstream library exception,
    e.g. from ``pdfminer``/``openpyxl``, rather than one of
    MarkItDown's own types -- the adapter therefore maps broadly,
    not just MarkItDown's own two documented types, to this single
    error).

    The original exception is available via Python exception chaining
    (``raise ExtractionFailedError(...) from exc``) for internal
    debugging, but this class's own message never repeats or embeds
    that exception's text, a filesystem path, or a library-internal
    detail -- the message is fixed and safe to return directly in a
    future API error body.
    """


class EmptyExtractionError(DocumentIngestionError):
    """Stage 2 / Slice 2. Conversion completed without raising, but
    produced no meaningful text: ``None``, an empty/whitespace-only
    string, or the literal four-character string ``"None"`` -- the
    latter confirmed in real testing (Stage 1, reconfirmed in Slice
    2) to be MarkItDown 0.1.7's actual output for some genuinely
    unparseable/unsupported content, as a Python ``str`` object, not
    the ``None`` value itself. Treating that string as "valid,
    non-empty content" merely because it consists of non-empty
    characters would be a real, silent failure mode -- this exception
    exists specifically to prevent that.
    """


class MissingDocumentDependencyError(DocumentIngestionError):
    """Stage 2 / Slice 2. MarkItDown reported (via its own
    ``MissingDependencyException``) that an optional dependency
    required for a specific format/feature is not installed in this
    environment.

    Deliberately distinct from :class:`ExtractionFailedError`: this
    is a deployment/packaging condition (something TorqPro's own
    dependency pinning should prevent, given the locked
    ``markitdown[pdf,docx,xlsx,pptx]==0.1.7`` extras already cover
    every MVP format), not a property of the uploaded document
    itself.
    """


class DocumentPersistenceError(DocumentIngestionError):
    """Stage 2 / Slice 3. ``backend.documents.repository`` caught a
    ``sqlite3`` exception (or equivalent low-level persistence
    failure) while reading or writing a ``document_extractions`` row.

    No raw ``sqlite3`` exception is ever allowed to leak past
    ``repository.py``'s own function boundaries -- every such
    failure is mapped to this class. The message is fixed and safe
    to return directly in a future API error body; it never repeats
    the underlying ``sqlite3`` exception's own text, which can
    contain the database file path.
    """


class DocumentRecordNotFoundError(DocumentIngestionError):
    """Stage 2 / Slice 3. A repository lifecycle operation
    (``mark_extracted``/``mark_failed``) was asked to transition a
    ``document_extractions`` row that does not exist.

    Deliberately distinct from the *ownership-filtered* read path
    (``repository.get_owned``), which returns ``None`` for "not
    found or not owned" -- exactly matching this repository's
    existing ``fetch_study``/``fetch_dataset``-style convention in
    ``backend/production_validation/repository.py`` -- rather than
    raising. This exception exists only for the internal-invariant
    case: a lifecycle transition naming a row id that the immediately
    preceding step in the same flow just created is expected to
    always succeed, so its absence signals a genuine programming
    error or concurrent-deletion race, not a normal "not found"
    outcome a caller should handle silently.
    """


class InvalidDocumentStateTransitionError(DocumentIngestionError):
    """Stage 2 / Slice 3. A repository lifecycle operation was asked
    to transition a ``document_extractions`` row out of a state that
    does not permit it -- e.g. ``mark_extracted``/``mark_failed``
    called on a row that is not currently ``"processing"``.

    The locked Stage 2 / Slice 3 lifecycle allows only
    ``processing -> extracted`` and ``processing -> failed``; no
    retry workflow (``extracted -> processing``,
    ``failed -> processing``, etc.) is authorized in this slice. This
    exception is the enforcement point for that rule.
    """


__all__ = [
    "DocumentIngestionError",
    "UnsupportedExtensionError",
    "EmptyDocumentError",
    "DocumentTooLargeError",
    "ContentTypeMismatchError",
    "MalformedOOXMLError",
    "SuspiciousArchiveError",
    "ExtractionFailedError",
    "EmptyExtractionError",
    "MissingDocumentDependencyError",
    "DocumentPersistenceError",
    "DocumentRecordNotFoundError",
    "InvalidDocumentStateTransitionError",
]
