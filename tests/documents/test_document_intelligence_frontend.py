"""Stage 2 / Slice 5 tests: Document Intelligence frontend regression.

Two layers, mirroring the Faz 2.8.22 / Torque Study frontend test
convention exactly:

1. Behavioral: tests/js/run_document_intelligence_tests.js (a
   dependency-free Node/vm harness, same technique as
   tests/js/run_i18n_tests.js) is run as a subprocess against the
   *actual* di* declarations extracted live from frontend/index.html.
2. Structural (this module, no browser required): JS syntax via
   `node --check`, and that the harness file itself stays
   dependency-free.

Scope: frontend/index.html only (Document Intelligence upload/
result/provenance/content/My Documents UI). Does not touch the
backend, the calculation engine, or any other TorqPro feature.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
HARNESS_PATH = REPO_ROOT / "tests" / "js" / "run_document_intelligence_tests.js"
FRONTEND_PATH = REPO_ROOT / "frontend" / "index.html"

NODE_AVAILABLE = shutil.which("node") is not None
pytestmark = pytest.mark.skipif(
    not NODE_AVAILABLE, reason="node is not available on PATH in this environment"
)


def _run_harness() -> subprocess.CompletedProcess:
    assert HARNESS_PATH.exists(), f"harness missing: {HARNESS_PATH}"
    return subprocess.run(
        ["node", str(HARNESS_PATH)], capture_output=True, text=True, cwd=str(REPO_ROOT),
    )


# ---------------------------------------------------------------------
# 1. Behavioral: Node/vm harness (subprocess)
# ---------------------------------------------------------------------


def test_document_intelligence_harness_all_assertions_pass():
    result = _run_harness()
    assert result.returncode == 0, (
        "Document Intelligence frontend harness reported failures:\n"
        + result.stdout
        + result.stderr
    )


def test_document_intelligence_harness_reports_a_nonzero_assertion_count():
    result = _run_harness()
    m = re.search(r"(\d+) assertions, (\d+) passed, (\d+) failed", result.stdout)
    assert m, "harness output missing expected summary line:\n" + result.stdout
    total, passed, failed = int(m.group(1)), int(m.group(2)), int(m.group(3))
    assert failed == 0
    assert passed == total
    assert total > 0


def test_harness_file_is_dependency_free():
    text = HARNESS_PATH.read_text(encoding="utf-8")
    assert "require('jsdom')" not in text
    assert "require('puppeteer')" not in text
    assert "require('playwright')" not in text
    assert "require(" not in text.replace("require('fs')", "").replace(
        "require('path')", ""
    ).replace("require('vm')", "").replace("require('./harness_common')", "")


# ---------------------------------------------------------------------
# 2. Structural: JS syntax
# ---------------------------------------------------------------------


def test_harness_js_syntax_is_valid():
    result = subprocess.run(
        ["node", "--check", str(HARNESS_PATH)], capture_output=True, text=True
    )
    assert result.returncode == 0, result.stderr


def test_frontend_js_syntax_is_valid(tmp_path):
    scripts = re.findall(
        r"<script>(.*?)</script>", FRONTEND_PATH.read_text(encoding="utf-8"), re.S
    )
    assert scripts
    js_file = tmp_path / "extracted.js"
    js_file.write_text("\n;\n".join(scripts), encoding="utf-8")
    result = subprocess.run(["node", "--check", str(js_file)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


# ---------------------------------------------------------------------
# 3. Structural: no new framework/bundler reference
# ---------------------------------------------------------------------


def test_no_new_framework_or_bundler_reference():
    lowered = FRONTEND_PATH.read_text(encoding="utf-8").lower()
    forbidden_refs = (
        "webpack", "vite.config", "cdnjs.cloudflare.com/ajax/libs/react",
        "cdnjs.cloudflare.com/ajax/libs/vue", "angular.min.js", "playwright", "puppeteer",
    )
    for forbidden in forbidden_refs:
        assert forbidden not in lowered, f"unexpected framework/bundler reference: {forbidden!r}"


def test_frontend_still_a_single_file():
    frontend_files = list((REPO_ROOT / "frontend").iterdir())
    names = {f.name for f in frontend_files}
    assert {"index.html", "manifest.webmanifest", "service-worker.js"} <= names
    assert "app" in names
    assert "legacy" in names
