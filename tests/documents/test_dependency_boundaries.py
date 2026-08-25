"""Stage 2, Step 10 (Slice 1) / Step 18 (Slice 2) -- static
dependency-boundary guard.

Mirrors ``tests/ai/test_dependency_direction.py``'s own technique
(pure ``ast`` source inspection -- no package under test is actually
imported, so this cannot be fooled by import-time side effects and
cannot itself introduce a reverse dependency): every ``.py`` file
under ``backend/documents/`` is parsed and every ``Import``/
``ImportFrom`` module name collected, then checked against a fixed,
forbidden list.

This is ``backend.documents``'s own boundary, distinct from (and
narrower than) ``test_dependency_direction.py``'s ADR-0017 guard:
this test proves ``backend.documents`` imports none of the
deterministic engineering packages, none of ``backend.ai_gateway``,
none of the governance/production-validation packages, and never
``fastapi`` (still true as of Slice 2 -- no HTTP route exists yet
anywhere in this package).

``markitdown`` itself is a separate case as of Slice 2 (Step 18): it
is now a legitimate import, but *only* inside
``backend/documents/markitdown_adapter.py`` -- every other module
under ``backend/documents`` must still never import it. This is
enforced by a second, dedicated test below
(``test_exactly_one_module_imports_markitdown``), mirroring how
``test_dependency_direction.py`` itself carves out exactly one
sanctioned exception (``backend/api/routes/ai_gateway.py``) for
``backend.ai_gateway`` rather than loosening its general rule.

Uses a dotted-prefix match (``backend.ai_gateway`` or
``backend.ai_gateway.<anything>``), not a substring match, for the
same reason ``test_dependency_direction.py``'s own docstring
explains: a substring check would false-positive on any future
module whose name merely contains one of these tokens.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import List

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
GUARDED_DIR = "backend/documents"

#: Forbidden for EVERY module under backend/documents, no exceptions
#: -- "markitdown" is deliberately NOT in this list as of Slice 2; it
#: has its own, narrower, single-sanctioned-importer test below
#: instead (mirrors how test_dependency_direction.py itself carves
#: out one sanctioned exception rather than adding it to the
#: general-purpose forbidden set).
FORBIDDEN_IMPORT_PREFIXES = (
    "backend.ai_gateway",
    "backend.calculation_engine",
    "backend.engineering_core",
    "backend.vdi2230_core",
    "backend.torque_recommendation",
    "backend.governance",
    "backend.production_validation",
    "fastapi",
)

#: Slice 2, Step 18: the exactly-one sanctioned importer of
#: ``markitdown`` under backend/documents.
MARKITDOWN_SANCTIONED_IMPORTER = "backend/documents/markitdown_adapter.py"


def _is_forbidden(module_name: str) -> bool:
    return any(
        module_name == prefix or module_name.startswith(prefix + ".")
        for prefix in FORBIDDEN_IMPORT_PREFIXES
    )


def _collect_imported_module_names(source: str) -> List[str]:
    tree = ast.parse(source)
    names: List[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                names.append(node.module)
    return names


def _collect_offenders() -> List[str]:
    guarded_path = REPO_ROOT / GUARDED_DIR
    offenders: List[str] = []
    for py_file in sorted(guarded_path.rglob("*.py")):
        source = py_file.read_text(encoding="utf-8")
        for module_name in _collect_imported_module_names(source):
            if _is_forbidden(module_name):
                rel = py_file.relative_to(REPO_ROOT).as_posix()
                offenders.append(f"{rel} imports forbidden module {module_name!r}")
    return offenders


def test_backend_documents_has_no_forbidden_imports():
    offenders = _collect_offenders()
    assert not offenders, (
        "backend.documents must not import any deterministic engineering "
        "package, backend.ai_gateway, governance/production_validation "
        "packages, fastapi, or markitdown (Slice 1 is validation-only). "
        "Offending imports found:\n" + "\n".join(offenders)
    )


def test_guarded_directory_actually_exists_and_has_files():
    # Guards against this test silently passing "vacuously" if the
    # directory path or glob pattern is ever wrong.
    guarded_path = REPO_ROOT / GUARDED_DIR
    py_files = list(guarded_path.rglob("*.py"))
    assert guarded_path.is_dir()
    assert len(py_files) >= 7  # __init__, exceptions, content_validation,
    # markitdown_adapter, models (Slice 2), repository, ingestion_service
    # (Slice 3)


def test_exactly_one_module_imports_markitdown():
    """Step 18: 'exactly one production module under backend/documents
    imports markitdown, and it must be
    backend/documents/markitdown_adapter.py'."""
    guarded_path = REPO_ROOT / GUARDED_DIR
    importers = []
    for py_file in sorted(guarded_path.rglob("*.py")):
        source = py_file.read_text(encoding="utf-8")
        for module_name in _collect_imported_module_names(source):
            if module_name == "markitdown" or module_name.startswith("markitdown."):
                rel = py_file.relative_to(REPO_ROOT).as_posix()
                importers.append(rel)
                break  # one match per file is enough to record it

    assert importers == [MARKITDOWN_SANCTIONED_IMPORTER], (
        "Exactly one file may import markitdown "
        f"({MARKITDOWN_SANCTIONED_IMPORTER}); found importers: {importers}"
    )


# ---------------------------------------------------------------------
# Stage 2 / Slice 4, Step 25: the HTTP route module may import
# backend.documents (that is its entire purpose) and fastapi (it is a
# route file), but must still never import any deterministic
# engineering package, governance/production_validation, or -- unlike
# backend/documents itself -- backend.ai_gateway either: no route in
# this module may invoke the AI Gateway, and no extracted Markdown may
# reach it (Step 25's explicit requirement, restated here as a
# structural test rather than only a docstring claim).
# ---------------------------------------------------------------------

DOCUMENTS_ROUTE_FILE = REPO_ROOT / "backend/api/routes/documents.py"

#: Same engineering/governance packages as FORBIDDEN_IMPORT_PREFIXES,
#: minus "fastapi" (a route file legitimately imports it) -- this is
#: a deliberately separate constant, not a reuse of
#: FORBIDDEN_IMPORT_PREFIXES, so that widening one list can never
#: accidentally widen the other without an explicit, visible edit
#: here too.
ROUTE_FORBIDDEN_IMPORT_PREFIXES = (
    "backend.ai_gateway",
    "backend.calculation_engine",
    "backend.engineering_core",
    "backend.vdi2230_core",
    "backend.torque_recommendation",
    "backend.governance",
    "backend.production_validation",
)


def test_documents_route_module_has_no_forbidden_imports():
    assert DOCUMENTS_ROUTE_FILE.is_file()  # non-vacuity guard
    source = DOCUMENTS_ROUTE_FILE.read_text(encoding="utf-8")
    offenders = [
        module_name
        for module_name in _collect_imported_module_names(source)
        if any(
            module_name == prefix or module_name.startswith(prefix + ".")
            for prefix in ROUTE_FORBIDDEN_IMPORT_PREFIXES
        )
    ]
    assert not offenders, (
        "backend/api/routes/documents.py must not import backend.ai_gateway "
        "or any deterministic engineering/governance/production_validation "
        f"package. Offending imports found: {offenders}"
    )
