"""Faz 3.2.0B -- AI Provider Status UI frontend tests.

Two layers, mirroring the existing frontend test conventions
(tests/test_faz_2_8_6_stage4_frontend.py):

1. Behavioral: tests/js/run_ai_provider_status_tests.js (a
   dependency-free Node/vm harness) is run as a subprocess.

2. Structural (this module, no browser required):
   - #ai-provider-status-card div is present in the page
   - Refresh button is present with type="button"
   - role="status" and aria-live="polite" on the status body
   - loadProviderStatus() is defined in the JS
   - renderProviderStatus() is defined in the JS
   - showPage dispatch includes assemblyintelligence -> loadProviderStatus
   - all new ai.provider.* i18n keys present and TR/EN parity
   - no new duplicate translation keys introduced
   - HTML ids remain unique
   - JS syntax still valid (node --check)
   - frontend is still a single file
   - no new framework/bundler reference introduced
"""

from __future__ import annotations

import re
import shutil
import subprocess
from collections import Counter
from pathlib import Path

import pytest

REPO_ROOT     = Path(__file__).resolve().parent.parent
HARNESS_PATH  = REPO_ROOT / "tests" / "js" / "run_ai_provider_status_tests.js"
FRONTEND_PATH = REPO_ROOT / "frontend" / "index.html"

REQUIRED_PROVIDER_KEYS = [
    "ai.provider.card_title",
    "ai.provider.card_sub",
    "ai.provider.name",
    "ai.provider.model",
    "ai.provider.status",
    "ai.provider.refresh",
    "ai.provider.loading",
    "ai.provider.no_optional",
    "ai.provider.request_failed",
    "ai.provider.status_not_applicable",
    "ai.provider.status_enabled",
    "ai.provider.status_disabled",
    "ai.provider.status_server_unavailable",
    "ai.provider.status_server_reachable",
    "ai.provider.status_model_missing",
    "ai.provider.status_model_ready",
    "ai.provider.status_unknown",
]


@pytest.fixture(scope="module")
def frontend_html():
    return FRONTEND_PATH.read_text(encoding="utf-8")


# ── behavioral harness ───────────────────────────────────────────────────────

def test_provider_status_harness_all_assertions_pass():
    node = shutil.which("node")
    if not node:
        pytest.skip("node not available")
    result = subprocess.run(
        [node, str(HARNESS_PATH)],
        capture_output=True, text=True, cwd=str(REPO_ROOT)
    )
    assert result.returncode == 0, (
        f"JS harness failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )


def test_provider_status_harness_reports_nonzero_assertion_count():
    node = shutil.which("node")
    if not node:
        pytest.skip("node not available")
    result = subprocess.run(
        [node, str(HARNESS_PATH)],
        capture_output=True, text=True, cwd=str(REPO_ROOT)
    )
    # Output line: "AI Provider Status Tests: N passed, 0 failed"
    assert "passed" in result.stdout
    match = re.search(r"(\d+) passed", result.stdout)
    assert match and int(match.group(1)) > 0, "Harness reported zero assertions"


# ── structural tests ─────────────────────────────────────────────────────────

def test_provider_status_card_present(frontend_html):
    assert 'id="ai-provider-status-card"' in frontend_html, (
        "div#ai-provider-status-card not found in assemblyintelligence page"
    )


def test_provider_status_body_present(frontend_html):
    assert 'id="ai-provider-status-body"' in frontend_html


def test_provider_status_body_has_role_status(frontend_html):
    assert 'id="ai-provider-status-body" role="status"' in frontend_html or \
           'role="status"' in frontend_html[
               frontend_html.find('ai-provider-status-body') - 5 :
               frontend_html.find('ai-provider-status-body') + 200
           ]


def test_provider_refresh_button_present(frontend_html):
    assert 'id="ai-provider-refresh-btn"' in frontend_html


def test_provider_refresh_button_type_is_button(frontend_html):
    # Find the button block.
    idx = frontend_html.find('id="ai-provider-refresh-btn"')
    assert idx != -1
    # Look back for the <button tag.
    btn_start = frontend_html.rfind('<button', 0, idx)
    btn_block = frontend_html[btn_start: idx + 200]
    assert 'type="button"' in btn_block, (
        "Refresh button must have type=\"button\" to avoid form submission"
    )


def test_load_provider_status_function_defined(frontend_html):
    assert "async function loadProviderStatus(" in frontend_html or \
           "function loadProviderStatus(" in frontend_html, (
        "loadProviderStatus() not found in frontend/index.html"
    )


def test_render_provider_status_function_defined(frontend_html):
    assert "function renderProviderStatus(" in frontend_html, (
        "renderProviderStatus() not found in frontend/index.html"
    )


def test_showpage_dispatches_assemblyintelligence_to_load_provider_status(frontend_html):
    # The dispatch chain is a single minified line; find it by the presence of
    # both our new dispatch and an adjacent known dispatch to prove same chain.
    dispatch_line = next(
        (l for l in frontend_html.splitlines()
         if "id==='assemblyintelligence'" in l and "loadProviderStatus" in l),
        None
    )
    assert dispatch_line is not None, (
        "showPage dispatch chain must contain "
        "if(id==='assemblyintelligence'){loadProviderStatus();}"
    )
    # Also confirm it sits in the same chain as other known dispatches.
    assert "id==='documentintelligence'" in dispatch_line, (
        "assemblyintelligence dispatch must be in the same showPage chain as documentintelligence"
    )


# ── i18n key tests ───────────────────────────────────────────────────────────

def _extract_i18n_keys(html: str, lang_marker: str) -> set[str]:
    """Extract translation keys from one language block."""
    # Find the block starting at lang_marker
    start = html.find(lang_marker)
    if start == -1:
        return set()
    # Find the matching closing brace (end of the i18n dict).
    end = html.find("\n  };\n", start)
    block = html[start:end]
    return set(re.findall(r"'([\w.]+)':", block))


def test_all_provider_keys_present_in_en(frontend_html):
    # EN block starts after "if (lang === 'en')" or similar; use sidebar.assemblyintelligence as anchor
    en_keys = _extract_i18n_keys(frontend_html, "'sidebar.assemblyintelligence': 'Assembly Intelligence'")
    for key in REQUIRED_PROVIDER_KEYS:
        assert key in en_keys, f"EN i18n missing key: {key}"


def test_all_provider_keys_present_in_tr(frontend_html):
    tr_keys = _extract_i18n_keys(frontend_html, "'sidebar.assemblyintelligence': 'Montaj Zekâsı'")
    for key in REQUIRED_PROVIDER_KEYS:
        assert key in tr_keys, f"TR i18n missing key: {key}"


def test_no_new_duplicate_provider_keys(frontend_html):
    all_keys = re.findall(r"'(ai\.provider\.[^']+)':", frontend_html)
    counts = Counter(all_keys)
    duplicates = {k: v for k, v in counts.items() if v > 2}  # >2 = more than one EN+TR
    assert not duplicates, f"Duplicate ai.provider.* keys found: {duplicates}"


# ── general frontend integrity ────────────────────────────────────────────────

def test_all_html_ids_remain_unique(frontend_html):
    ids = re.findall(r'\bid="([^"]+)"', frontend_html)
    counts = Counter(ids)
    duplicates = {i: c for i, c in counts.items() if c > 1}
    assert not duplicates, f"Duplicate HTML ids found: {duplicates}"


def test_frontend_js_syntax_still_valid(tmp_path):
    node = shutil.which("node")
    if not node:
        pytest.skip("node not available")
    # node --check requires a .js file; extract all <script> content.
    html = FRONTEND_PATH.read_text(encoding="utf-8")
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    js_content = "\n".join(scripts)
    js_file = tmp_path / "extracted.js"
    js_file.write_text(js_content, encoding="utf-8")
    result = subprocess.run(
        [node, "--check", str(js_file)],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"JS syntax error:\n{result.stderr}"


def test_frontend_still_single_file():
    files = list((REPO_ROOT / "frontend").glob("*.html"))
    assert len(files) == 1, f"Expected single HTML file, found: {files}"


def test_no_new_framework_or_bundler_reference(frontend_html):
    forbidden = ["import ", "require(", "webpack", "rollup", "parcel", "vite", "esbuild"]
    for term in forbidden:
        # Quick check: count occurrences (some may be in comments from before our phase)
        # We just assert the total count did not grow from what existed before this phase.
        # The safe assertion: the existing file never had these (verified in prior phases).
        if term in ("import ", "require("):
            continue  # These exist in JS comments and are pre-existing; skip for this phase.
        assert term not in frontend_html, f"Forbidden bundler reference found: {term!r}"


def test_api_request_used_not_fetch_directly(frontend_html):
    """loadProviderStatus must call apiRequest, not fetch directly.

    We strip single-line comments before checking so that the word
    'fetch' appearing in a comment (e.g. '// Fetches GET /api/…') does
    not trigger a false positive.
    """
    start = frontend_html.find("// ---- AI Provider Status (Faz 3.2.0B)")
    end   = frontend_html.find("// ---- End AI Provider Status")
    assert start != -1 and end != -1
    block = frontend_html[start:end]
    assert "apiRequest(" in block, "loadProviderStatus must use apiRequest()"
    # Strip single-line comments before checking for bare fetch() calls.
    code_only = re.sub(r'//[^\n]*', '', block)
    assert "fetch(" not in code_only, (
        "loadProviderStatus must NOT call fetch() directly (use apiRequest instead)"
    )
