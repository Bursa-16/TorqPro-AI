"""TorqPro Document Ingestion - content validation.

Stage 2 / Slice 1 (Content Validation Security Foundation).

This module is the independent validation layer that MUST run on
uploaded document bytes *before* they are ever handed to MarkItDown.
It exists because Stage 1's real-package testing (MarkItDown 0.1.7,
narrow extras ``[pdf,docx,xlsx,pptx]``) found that MarkItDown does
NOT reliably reject malformed, mislabeled, or structurally invalid
input on its own -- a plain-text file renamed ``.pdf``, a generic
(non-OOXML) ZIP renamed ``.docx``, and even a raw ``.exe`` binary all
converted "successfully" via a silent, permissive plain-text fallback
path in real testing, rather than raising one of MarkItDown's own
exception types. TorqPro's own fail-closed validation, implemented
here, is therefore the load-bearing security control for this
feature -- not a thin wrapper around MarkItDown's behavior.

Design constraints (locked for this slice):

  - **Framework-independent.** No ``fastapi`` import. Operates on
    raw ``bytes`` and a filename ``str`` -- never a FastAPI
    ``UploadFile``. A route layer (a later slice) is responsible for
    reading the multipart body into bytes before calling here.
  - **No MarkItDown import.** This slice validates; it never
    converts. ``markitdown`` is not imported anywhere in this
    module, directly or indirectly.
  - **The filename is metadata only, never a path.** No function in
    this module calls ``open()``, ``pathlib.Path(...).open()``, or
    any equivalent on the supplied filename. Extension is derived
    with plain string operations only (see :func:`_extract_extension`).
    Nothing here writes to disk or reads from disk -- all archive
    inspection happens on an in-memory ``io.BytesIO`` wrapping the
    already-in-memory ``content`` bytes.
  - **No extraction.** OOXML structural and archive-safety checks
    read only ``zipfile.ZipFile`` central-directory metadata
    (``namelist()`` / ``infolist()``); no archive member is ever
    decompressed via ``.extract()``/``.extractall()``/``.read()``.
  - **Fail closed.** Every check either passes silently or raises a
    :mod:`backend.documents.exceptions` subclass. There is no
    "unknown, allow it" outcome anywhere in this module -- including
    when a pluggable content-type detector itself fails (see
    :class:`ContentTypeDetector` and :func:`validate_content_type`).
  - **Locked MVP limits** (Stage 1 design, restated here as the
    single source of truth for this slice):
      * Supported extensions: ``.pdf``, ``.docx``, ``.xlsx``,
        ``.pptx`` (case-insensitive).
      * ``MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024`` (15 MiB,
        binary, not decimal MB).
      * ``MAX_UNCOMPRESSED_TOTAL_BYTES = 100 * 1024 * 1024``
        (100 MiB).
      * ``MAX_COMPRESSION_RATIO = 100.0``.
      * ``MAX_ARCHIVE_ENTRIES = 2000``.
"""

from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from typing import Optional, Protocol, runtime_checkable

from backend.documents.exceptions import (
    ContentTypeMismatchError,
    DocumentTooLargeError,
    EmptyDocumentError,
    MalformedOOXMLError,
    SuspiciousArchiveError,
    UnsupportedExtensionError,
)

# ---------------------------------------------------------------------
# Locked MVP constants (Stage 1 design). Binary units throughout --
# 15 MiB is 15 * 1024 * 1024, never a decimal-MB approximation.
# ---------------------------------------------------------------------

SUPPORTED_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".docx", ".xlsx", ".pptx"})

#: 15 MiB, expressed as the exact binary computation (not a decimal
#: MB approximation) per the locked Stage 2 spec.
MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024

#: 100 MiB, same binary-unit convention as MAX_UPLOAD_SIZE_BYTES.
MAX_UNCOMPRESSED_TOTAL_BYTES: int = 100 * 1024 * 1024

MAX_COMPRESSION_RATIO: float = 100.0

MAX_ARCHIVE_ENTRIES: int = 2000

#: Extension -> the short, lowercase content-type label a content
#: detector (see ContentTypeDetector) is expected to report for
#: genuine content of that format. Deliberately a plain str label
#: ("pdf", "docx", ...), not a MIME string -- matches how magika
#: (the Slice-2-anticipated real backing, per Stage 1 findings)
#: reports its own `output.label` field.
EXTENSION_TO_EXPECTED_LABEL: dict[str, str] = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".xlsx": "xlsx",
    ".pptx": "pptx",
}

#: Extension -> the one required format-specific OOXML part that
#: distinguishes a genuine document of that format from an arbitrary
#: ZIP archive that merely happens to carry the same extension.
OOXML_REQUIRED_PART: dict[str, str] = {
    ".docx": "word/document.xml",
    ".xlsx": "xl/workbook.xml",
    ".pptx": "ppt/presentation.xml",
}

#: Required in every valid OOXML package regardless of format.
OOXML_CONTENT_TYPES_PART: str = "[Content_Types].xml"


# ---------------------------------------------------------------------
# Extension validation
# ---------------------------------------------------------------------


def _extract_extension(filename: str) -> str:
    """Return the substring from the last ``.`` onward, lowercased.

    Pure string manipulation -- never touches the filesystem, never
    imports ``os.path``/``pathlib``. Returns ``""`` if ``filename``
    is empty, contains no ``.``, or ends in a bare ``.`` with nothing
    after it (treated identically to "no extension").

    Deliberately does NOT strip whitespace: a filename ending
    ``"report.pdf "`` (trailing space) yields the extension
    ``".pdf "`` (space preserved), which will not equal ``".pdf"``
    in :data:`SUPPORTED_EXTENSIONS` and is therefore correctly
    rejected by :func:`validate_extension` -- this is intentional,
    not an oversight (see Stage 2 spec, Step 4: "trailing-space
    extension rejected").

    A filename with more than one ``.`` (e.g. ``"report.pdf.exe"`` or
    ``"archive.docx.zip"``) naturally yields only the *final*
    extension (``".exe"`` / ``".zip"``) here, which is not in
    :data:`SUPPORTED_EXTENSIONS` and is rejected by
    :func:`validate_extension` -- "double extension" rejection is a
    direct consequence of this function only ever looking at the
    last ``.``, not special-cased logic.
    """
    if not filename:
        return ""
    idx = filename.rfind(".")
    if idx == -1 or idx == len(filename) - 1:
        return ""
    return filename[idx:].lower()


def validate_extension(filename: str) -> str:
    """Validate ``filename``'s extension against the locked MVP
    allow-list and return the normalized (lowercased) extension.

    Raises :class:`UnsupportedExtensionError` for anything not
    exactly one of ``.pdf``/``.docx``/``.xlsx``/``.pptx`` -- missing
    extension, unsupported extension, double extension, or
    trailing-whitespace extension all raise this same error (see
    :func:`_extract_extension`'s docstring for why each case
    naturally falls out of the same check).

    The raised message includes only the derived extension token
    (bounded, safe) -- never the full original ``filename``, which
    is never used for anything but this extraction and later,
    unrelated display/audit metadata.
    """
    extension = _extract_extension(filename)
    if extension not in SUPPORTED_EXTENSIONS:
        raise UnsupportedExtensionError(
            f"Unsupported or missing file extension: {extension!r} "
            f"(allowed: .pdf, .docx, .xlsx, .pptx)"
        )
    return extension


# ---------------------------------------------------------------------
# Size validation
# ---------------------------------------------------------------------


def validate_size(content: bytes) -> int:
    """Validate ``content``'s length against the locked MVP bounds
    and return the size in bytes.

    Raises :class:`EmptyDocumentError` for zero-byte content and
    :class:`DocumentTooLargeError` for content exceeding
    :data:`MAX_UPLOAD_SIZE_BYTES` (15 MiB exactly is accepted; 15 MiB
    + 1 byte is rejected -- see ``tests/documents`` boundary tests).

    Operates on an already-fully-read ``bytes`` object. Enforcing a
    hard cap on how many bytes are read from the client connection in
    the first place (protecting against unlimited memory consumption
    from a spoofed/absent ``Content-Length``) is the HTTP route
    layer's responsibility in a later slice -- this function's
    contract is simply "reject if what you were given is 0 or
    >15 MiB", independent of how those bytes were obtained.
    """
    size = len(content)
    if size == 0:
        raise EmptyDocumentError("Uploaded content is empty (0 bytes).")
    if size > MAX_UPLOAD_SIZE_BYTES:
        raise DocumentTooLargeError(
            f"Uploaded content exceeds the maximum allowed size of "
            f"{MAX_UPLOAD_SIZE_BYTES} bytes (15 MiB)."
        )
    return size


# ---------------------------------------------------------------------
# Content-type detection: pluggable via ContentTypeDetector (Slice 1).
# Slice 2 adds MagikaContentTypeDetector, a real implementation backed
# by `magika` (now present via the Slice-2-pinned `markitdown[...]`
# dependency). The Protocol itself, and every Slice 1 stub-based test,
# are unchanged -- Slice 2 is purely additive here.
# ---------------------------------------------------------------------


@runtime_checkable
class ContentTypeDetector(Protocol):
    """Narrow, injectable content-type detection boundary.

    Stage 1 found that ``magika`` (an unconditional transitive
    dependency of ``markitdown`` itself, not a new dependency TorqPro
    would introduce) correctly distinguishes genuine PDF/DOCX/XLSX/
    PPTX content from mismatched/corrupt input in every fixture
    tested. Slice 1, however, is not authorized to add ``markitdown``
    or ``magika`` to ``requirements.txt`` -- this environment's
    ``requirements.txt`` + ``requirements-dev.txt`` install was
    confirmed in this slice to NOT include ``magika`` (see Slice 1
    report section 2). This ``Protocol`` is the seam a real
    Magika-backed implementation will satisfy in Slice 2, once the
    dependency is formally introduced alongside ``markitdown``
    itself; it is intentionally not implemented here.

    Implementations should return a short, lowercase label (e.g.
    ``"pdf"``, ``"docx"``, ``"zip"``, ``"txt"``) or ``None`` if
    detection is inconclusive. Implementations are NOT required to
    avoid raising -- :func:`validate_content_type` treats any
    exception raised by ``detect()`` as an inconclusive result and
    fails closed, exactly like an explicit ``None`` return or an
    explicit mismatched label.
    """

    def detect(self, content: bytes) -> Optional[str]:
        ...


class MagikaContentTypeDetector:
    """Real, Magika-backed implementation of :class:`ContentTypeDetector`.

    Stage 2 / Slice 2. As of this slice, ``magika`` is guaranteed
    present (it is an unconditional transitive dependency of the now
    Slice-2-pinned ``markitdown[pdf,docx,xlsx,pptx]==0.1.7``), so this
    class is safe to instantiate in production code paths. The
    ``magika`` import itself stays deferred to first use (inside
    :meth:`_get_magika`, not at module import time) so that this
    module -- and every Slice 1 test exercising the *abstraction*
    with stub detectors -- remains fully importable and runnable in
    an environment that has not (yet) installed ``markitdown``/
    ``magika`` at all; nothing in Slice 1's own contract changes.

    Verified against the actually-installed ``magika`` 0.6.3 API
    (Stage 2, Step 3 -- not assumed from documentation):
    ``Magika().identify_bytes(content: bytes) -> MagikaResult``,
    where ``MagikaResult.ok`` is ``True``/``False`` and
    ``MagikaResult.output.label`` is the short lowercase label this
    class returns (e.g. ``"pdf"``, ``"docx"``, ``"zip"``, ``"txt"``).
    ``identify_bytes`` was chosen over ``identify_path``/
    ``identify_stream`` as the narrowest call for already-in-memory
    bytes -- no filesystem path, no stream wrapper needed.

    Deliberately discards ``MagikaResult.score`` (Magika's confidence
    float) entirely -- it is read from the result object but never
    stored, returned, or exposed anywhere in this class, per Step 2's
    instruction not to expose Magika confidence internals. The public
    contract is exactly the single label string
    :class:`ContentTypeDetector` already defines, nothing richer.

    Does not itself catch exceptions from ``identify_bytes()``
    (confirmed to raise a plain ``TypeError`` for non-``bytes`` input
    in real testing, and to return -- not raise -- a dedicated
    ``label="empty"`` result for zero-byte input, which by
    :func:`validate_document`'s call order never reaches this
    detector anyway since size validation runs first). Any exception
    this method does raise is caught and fail-closed by
    :func:`validate_content_type`'s own ``try/except Exception``,
    exactly as Slice 1 already tests for a stub failing detector --
    this class relies on that existing, already-tested boundary
    rather than duplicating it.
    """

    def __init__(self) -> None:
        self._magika = None

    def _get_magika(self):
        if self._magika is None:
            from magika import Magika  # deferred import -- see class docstring

            self._magika = Magika()
        return self._magika

    def detect(self, content: bytes) -> Optional[str]:
        magika = self._get_magika()
        result = magika.identify_bytes(content)
        if not result.ok:
            return None
        return result.output.label


def validate_content_type(
    content: bytes, extension: str, detector: ContentTypeDetector
) -> str:
    """Verify that ``detector`` reports content matching the format
    implied by the already-validated ``extension``.

    Raises :class:`ContentTypeMismatchError` if:
      - ``extension`` is not a recognized key of
        :data:`EXTENSION_TO_EXPECTED_LABEL` (should not happen if
        :func:`validate_extension` already ran, but this function
        does not assume that and fails closed rather than trust its
        caller);
      - ``detector.detect(content)`` raises any exception (fail
        closed -- the underlying exception is deliberately not
        propagated, matching this package's "never leak parser
        internals" contract, and is suppressed via ``from None``);
      - the detected label does not exactly equal the expected label
        for ``extension`` (covers both "detected as something else
        entirely" and ``None``/inconclusive, since ``None`` can never
        equal a non-``None`` expected label).

    This is the single most important rejection path in this module
    per Stage 1's central finding: MarkItDown's own permissive
    fallback behavior makes this independent check -- not anything
    MarkItDown does internally -- the actual security boundary
    against a mislabeled or malicious upload.

    Returns the detected label on success (useful for later
    provenance recording, e.g. ``detected_media_type`` in the Stage 1
    persistence design -- not implemented in this slice).
    """
    expected = EXTENSION_TO_EXPECTED_LABEL.get(extension)
    if expected is None:
        raise ContentTypeMismatchError(
            "Cannot verify content type for an unrecognized extension."
        )
    try:
        detected = detector.detect(content)
    except Exception:
        raise ContentTypeMismatchError(
            f"Content-type detection failed while verifying a "
            f"{expected!r} document; rejecting."
        ) from None
    if detected != expected:
        raise ContentTypeMismatchError(
            f"Declared extension implies {expected!r} content, but "
            f"detected content type is {detected!r}."
        )
    return detected


# ---------------------------------------------------------------------
# OOXML structural validation (.docx / .xlsx / .pptx only)
# ---------------------------------------------------------------------


def validate_ooxml_structure(content: bytes, extension: str) -> zipfile.ZipFile:
    """Validate that ``content`` is a structurally genuine OOXML
    package for ``extension``, using only ``zipfile`` central-
    directory metadata -- no member is ever extracted or decompressed
    here.

    Raises :class:`MalformedOOXMLError` if:
      - ``extension`` is not one of ``.docx``/``.xlsx``/``.pptx``
        (this function is never meaningful for ``.pdf``, and does
        not assume its caller already filtered that out);
      - ``content`` is not a valid ZIP archive at all
        (``zipfile.BadZipFile`` -- this *is* a reliable signal,
        unlike MarkItDown's own exception behavior per Stage 1);
      - the archive is a valid ZIP but is missing
        :data:`OOXML_CONTENT_TYPES_PART`
        (``"[Content_Types].xml"``) -- required in every genuine
        OOXML package regardless of specific format;
      - the archive is missing the required format-specific part for
        ``extension`` (:data:`OOXML_REQUIRED_PART`) -- this is what
        rejects a generic, non-OOXML ZIP that has merely been renamed
        to ``.docx``/``.xlsx``/``.pptx`` (confirmed against a real
        such fixture in Stage 1 testing: opens as a valid ZIP, but
        both required parts are absent).

    On success, returns the open ``zipfile.ZipFile`` so that
    :func:`validate_archive_safety` can reuse the same parsed
    central directory without re-parsing the archive a second time.
    Callers are responsible for closing the returned ``ZipFile``
    (see :func:`validate_document`, which does so in a ``finally``
    block).
    """
    required_part = OOXML_REQUIRED_PART.get(extension)
    if required_part is None:
        raise MalformedOOXMLError(
            "OOXML structural validation requested for a non-OOXML extension."
        )
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise MalformedOOXMLError(
            "Content is not a valid ZIP/OOXML archive."
        ) from None

    try:
        names = archive.namelist()
    except Exception:
        # A ZIP that opens but whose directory cannot be enumerated
        # cleanly is itself a structural-validity failure, not a
        # crash to propagate.
        archive.close()
        raise MalformedOOXMLError(
            "Archive central directory could not be read."
        ) from None

    if OOXML_CONTENT_TYPES_PART not in names:
        archive.close()
        raise MalformedOOXMLError(
            f"Archive is missing the required part: {OOXML_CONTENT_TYPES_PART}"
        )
    if required_part not in names:
        archive.close()
        raise MalformedOOXMLError(
            "Archive is missing the required part for its declared format."
        )
    return archive


# ---------------------------------------------------------------------
# ZIP-bomb / suspicious-archive guard
# ---------------------------------------------------------------------


def validate_archive_safety(archive: zipfile.ZipFile) -> None:
    """Validate ``archive``'s central-directory metadata against the
    locked MVP decompression-bomb thresholds.

    Reads only ``ZipFile.infolist()`` (``file_size`` = uncompressed,
    ``compress_size`` = on-disk/compressed, both metadata fields read
    directly from the central directory) -- no member is decompressed
    to compute any of the figures below.

    Raises :class:`SuspiciousArchiveError` if:
      - the archive has more than :data:`MAX_ARCHIVE_ENTRIES` entries;
      - any single entry reports ``compress_size == 0`` alongside
        ``file_size > 0`` -- a zero-byte-on-disk entry that claims
        non-zero uncompressed content is itself an anomaly (most
        plausibly a hand-crafted/corrupted central-directory record),
        and is treated as suspicious rather than silently divided by
        zero or skipped, exactly as the Stage 2 spec requires;
      - the archive's total uncompressed size across all entries
        exceeds :data:`MAX_UNCOMPRESSED_TOTAL_BYTES`;
      - the archive's aggregate compression ratio (total uncompressed
        / total compressed) exceeds :data:`MAX_COMPRESSION_RATIO`.

    The ratio check is only computed when total compressed size is
    nonzero (guarding the division itself); if total compressed size
    is zero while total uncompressed size is nonzero in aggregate,
    that is itself flagged as suspicious (this aggregate case is
    already unreachable in practice because the per-entry zero-check
    above raises first for any single such entry -- this guard exists
    so the function's own aggregate invariant holds independently of
    that per-entry ordering, in case a future caller invokes only
    part of this logic).
    """
    infolist = archive.infolist()

    entry_count = len(infolist)
    if entry_count > MAX_ARCHIVE_ENTRIES:
        raise SuspiciousArchiveError(
            f"Archive contains too many entries ({entry_count} > "
            f"{MAX_ARCHIVE_ENTRIES})."
        )

    total_uncompressed = 0
    total_compressed = 0
    for info in infolist:
        total_uncompressed += info.file_size
        total_compressed += info.compress_size
        if info.compress_size == 0 and info.file_size > 0:
            raise SuspiciousArchiveError(
                "Archive entry reports zero compressed size alongside "
                "non-zero uncompressed content (suspicious)."
            )

    if total_uncompressed > MAX_UNCOMPRESSED_TOTAL_BYTES:
        raise SuspiciousArchiveError(
            f"Archive's total uncompressed size ({total_uncompressed} "
            f"bytes) exceeds the {MAX_UNCOMPRESSED_TOTAL_BYTES}-byte limit."
        )

    if total_compressed > 0:
        ratio = total_uncompressed / total_compressed
        if ratio > MAX_COMPRESSION_RATIO:
            raise SuspiciousArchiveError(
                f"Archive's compression ratio ({ratio:.1f}:1) exceeds "
                f"the {MAX_COMPRESSION_RATIO}:1 limit."
            )
    elif total_uncompressed > 0:
        raise SuspiciousArchiveError(
            "Archive reports zero total compressed size alongside "
            "non-zero uncompressed content (suspicious)."
        )


# ---------------------------------------------------------------------
# Filename safety (display/metadata only -- never a path)
# ---------------------------------------------------------------------


def safe_display_filename(filename: str, *, max_length: int = 255) -> str:
    """Return a version of ``filename`` safe to store as metadata or
    write to a log/audit record: control characters (including NUL)
    stripped, length capped, Unicode (including Turkish characters)
    preserved.

    This is display/metadata sanitization only -- it does not make
    ``filename`` safe to use as a filesystem path, because
    ``filename`` is never used as a filesystem path anywhere in this
    package, by design (see module docstring). Deliberately minimal
    per the Stage 2 spec ("do not over-engineer sanitization in this
    slice"): no normalization, no path-traversal-specific logic (not
    needed -- traversal sequences like ``"../"`` are just ordinary
    printable characters here, inert because nothing ever resolves
    this string against the filesystem), no case changes.
    """
    if not filename:
        return ""
    cleaned = "".join(ch for ch in filename if ch.isprintable())
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned


# ---------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------


@dataclass(frozen=True)
class ValidationResult:
    """Outcome of a fully successful :func:`validate_document` call.
    Carries only what later slices are expected to need (Slice 3's
    persistence design) -- deliberately not a full provenance record
    (no hash, no timestamp, no user) since computing those is outside
    this slice's scope.
    """

    extension: str
    size_bytes: int
    content_type_checked: bool
    content_type_label: Optional[str]


def validate_document(
    content: bytes,
    filename: str,
    *,
    detector: Optional[ContentTypeDetector] = None,
) -> ValidationResult:
    """Run the full Slice 1 validation pipeline against ``content``
    (raw bytes) and ``filename`` (metadata only), in the fail-closed
    order established by Stage 1's security design:

      1. Extension allow-list (:func:`validate_extension`).
      2. Size bounds (:func:`validate_size`).
      3. Content-type verification (:func:`validate_content_type`) --
         only performed if ``detector`` is supplied. Passing
         ``detector=None`` remains a valid, explicit way to run just
         the structural/size checks standalone (e.g. in narrowly-
         scoped tests), but is NOT a safe production configuration on
         its own: production callers (``markitdown_adapter.py``'s
         ``extract_document()``, as of Slice 2) MUST supply a real
         detector -- :class:`MagikaContentTypeDetector` as of Slice 2
         -- since content-type verification is Stage 1's most
         important single control (see :func:`validate_content_type`'s
         docstring).
      4. OOXML structural validation
         (:func:`validate_ooxml_structure`) -- only for
         ``.docx``/``.xlsx``/``.pptx`` (a ``.pdf`` is not a ZIP
         container and has no OOXML structure to validate).
      5. ZIP-bomb / suspicious-archive guard
         (:func:`validate_archive_safety`) -- same extensions as
         step 4, reusing the already-open archive from that step.

    Raises the first applicable :mod:`backend.documents.exceptions`
    subclass and stops -- later steps never run once an earlier one
    has rejected the content. Returns a :class:`ValidationResult` only
    if every applicable step passed.
    """
    extension = validate_extension(filename)
    validate_size(content)

    content_type_label: Optional[str] = None
    content_type_checked = detector is not None
    if detector is not None:
        content_type_label = validate_content_type(content, extension, detector)

    if extension in OOXML_REQUIRED_PART:
        archive = validate_ooxml_structure(content, extension)
        try:
            validate_archive_safety(archive)
        finally:
            archive.close()

    return ValidationResult(
        extension=extension,
        size_bytes=len(content),
        content_type_checked=content_type_checked,
        content_type_label=content_type_label,
    )


__all__ = [
    "SUPPORTED_EXTENSIONS",
    "MAX_UPLOAD_SIZE_BYTES",
    "MAX_UNCOMPRESSED_TOTAL_BYTES",
    "MAX_COMPRESSION_RATIO",
    "MAX_ARCHIVE_ENTRIES",
    "EXTENSION_TO_EXPECTED_LABEL",
    "OOXML_REQUIRED_PART",
    "OOXML_CONTENT_TYPES_PART",
    "ContentTypeDetector",
    "MagikaContentTypeDetector",
    "ValidationResult",
    "validate_extension",
    "validate_size",
    "validate_content_type",
    "validate_ooxml_structure",
    "validate_archive_safety",
    "safe_display_filename",
    "validate_document",
]
