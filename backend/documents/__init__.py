"""TorqPro Document Ingestion.

Stage 2 / Slice 1 (Content Validation Security Foundation). This
package will eventually provide MarkItDown-based document-to-Markdown
extraction (Stage 1 design), but this slice implements *only* the
independent, pre-MarkItDown content-validation layer
(:mod:`backend.documents.content_validation`) and its exception
vocabulary (:mod:`backend.documents.exceptions`). No conversion, no
persistence, no HTTP route, and no MarkItDown import exist in this
package yet.

Authoritative three-layer boundary (unchanged from Stage 1 design,
restated here since it governs every module added to this package
across every future slice):

  1. **Document extraction** -- deterministic conversion, MarkItDown-
     based. Not yet implemented (planned: Slice 2,
     ``markitdown_adapter.py``).
  2. **Document interpretation** -- future AI-assisted capability,
     advisory/non-authoritative. Explicitly out of scope for the
     MVP; when it exists, it is reachable only through the existing
     sanctioned ``backend.ai_gateway`` entry point
     (``backend/api/routes/ai_gateway.py``), never a new bypass.
  3. **Engineering calculation** -- the existing deterministic
     TorqPro engines (``backend.calculation_engine``,
     ``backend.engineering_core``, ``backend.vdi2230_core``,
     ``backend.torque_recommendation``). Authoritative, and
     completely isolated from uploaded document content: no module
     under ``backend.documents`` may import any of them, in this
     slice or any future one. See
     ``tests/documents/test_dependency_boundaries.py``, which
     enforces this structurally (mirrors
     ``tests/ai/test_dependency_direction.py``'s own technique).

Content validation exists specifically because Stage 1's real-package
testing (MarkItDown 0.1.7) found that MarkItDown itself does *not*
reliably fail closed on corrupt, mislabeled, or structurally invalid
input -- it falls back to a permissive plain-text conversion path
instead of raising in several tested cases. Every document this
package will ever hand to MarkItDown (starting in a later slice) must
first pass unchanged through
:func:`backend.documents.content_validation.validate_document`.
"""

from __future__ import annotations

__all__: list[str] = []
