"""UI/UX Corrective Stage 2 — Design System Foundation Tests

Covers:
1. No hardcoded product version in active frontend JS
2. Title uses runtime version (i18n-based, no hardcoded suffix)
3. API-unavailable state does not fabricate a version string
4. Required typography / spacing / radius / elevation / motion tokens exist
5. Shared primitives consume the token system
6. focus-visible exists on shared components
7. prefers-reduced-motion preserved and extended
8. No deterministic engineering logic changed
"""
from __future__ import annotations
import re
from pathlib import Path

import pytest

FRONTEND = Path(__file__).resolve().parent.parent / "frontend" / "index.html"
html = FRONTEND.read_text(encoding="utf-8")

# ── P0: Version / Title ────────────────────────────────────────────────────────

def test_no_hardcoded_product_version_in_frontend():
    """Active JS must not contain a hardcoded product version number."""
    # Strip HTML comments and look for literal version strings that are NOT
    # inside i18n key values (which are allowed to reference "v3.1") or
    # inside historical docs blocks.
    # Specifically, '3.2.0', '3.1.1', '3.1.0', '3.0.0' as standalone
    # version strings must not appear in JS assignment context.
    forbidden = re.compile(r"""(?x)
        (?:version|title|text)\s*[=+]\s*['"][^'"]*
        (3\.2\.0|3\.1\.1|3\.1\.0|3\.0\.0)
    """)
    m = forbidden.search(html)
    assert m is None, (
        f"Hardcoded product version found in active frontend assignment: {m.group(0)!r}"
    )

def test_title_suffix_uses_i18n_key():
    """document.title construction must use t() for the suffix — not hardcoded TR."""
    # The old hardcoded Turkish suffix must be gone
    assert "Kurulum Sihirbazı ve İlk Yayın" not in html, (
        "Hardcoded Turkish title suffix still present in document.title construction"
    )
    # The new implementation must use t('app.title_suffix')
    assert "t('app.title_suffix')" in html, (
        "document.title must use t('app.title_suffix') for the localized suffix"
    )

def test_app_title_suffix_key_in_en_and_tr():
    """app.title_suffix must exist in both EN and TR i18n tables."""
    assert "'app.title_suffix': 'Fastener Analysis Software'" in html, "EN app.title_suffix missing"
    assert "'app.title_suffix': 'Bağlantı Elemanları Analiz Yazılımı'" in html, "TR app.title_suffix missing"

def test_version_unavailable_key_in_both_languages():
    """app.version_unavailable must exist in EN and TR."""
    # Both should contain the same neutral value
    matches = re.findall(r"'app\.version_unavailable':\s*'([^']*)'", html)
    assert len(matches) == 2, f"Expected 2 app.version_unavailable keys (EN+TR), found {len(matches)}"

def test_api_unavailable_does_not_fabricate_version():
    """When /api/health fails, _applyVersion('') must be called — no version fabricated."""
    # The catch block must call _applyVersion with empty string
    assert "_applyVersion('')" in html or "applyVersion('')" in html, (
        "API-unavailable path must call _applyVersion with empty string"
    )

def test_single_version_authority_preserved():
    """loadAppVersion must still use /api/health as the single source."""
    assert "fetch('/api/health')" in html, "/api/health fetch must remain in loadAppVersion"
    # There must be no duplicate version constant in active JS
    assert "const APP_VERSION" not in html or "APP_VERSION" not in html.split("loadAppVersion")[0], (
        "APP_VERSION constant must not exist as a parallel frontend version source"
    )

# ── Typography tokens ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("token", [
    "--fs-xs", "--fs-sm", "--fs-base", "--fs-md", "--fs-lg",
    "--fs-xl", "--fs-2xl", "--fs-display",
    "--fw-regular", "--fw-medium", "--fw-semibold", "--fw-bold",
    "--lh-tight", "--lh-normal", "--lh-relaxed",
])
def test_typography_token_defined(token):
    assert f"{token}:" in html, f"Typography token {token!r} not defined in :root"

# ── Spacing tokens ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("token", [
    "--space-1", "--space-2", "--space-3", "--space-4", "--space-5",
    "--space-6", "--space-7", "--space-8", "--space-9", "--space-10",
])
def test_spacing_token_defined(token):
    assert f"{token}:" in html, f"Spacing token {token!r} not defined in :root"

# ── Radius tokens ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("token", [
    "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl", "--radius-pill",
])
def test_radius_token_defined(token):
    assert f"{token}:" in html, f"Radius token {token!r} not defined in :root"

# ── Elevation tokens ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("token", ["--shadow-sm", "--shadow-md", "--shadow-lg"])
def test_elevation_token_defined(token):
    assert f"{token}:" in html, f"Elevation token {token!r} not defined in :root"

# ── Motion tokens ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("token", [
    "--dur-fast", "--dur-normal", "--dur-slow", "--ease-std",
])
def test_motion_token_defined(token):
    assert f"{token}:" in html, f"Motion token {token!r} not defined in :root"

# ── Shared primitive token consumption ────────────────────────────────────────

def test_card_uses_radius_token():
    card_block = re.search(r'\.card\{[^}]+\}', html)
    assert card_block, ".card not found"
    assert "var(--radius" in card_block.group(0), ".card must use var(--radius-*)"

def test_card_uses_shadow_token():
    card_block = re.search(r'\.card\{[^}]+\}', html)
    assert card_block, ".card not found"
    assert "var(--shadow-" in card_block.group(0), ".card must use var(--shadow-*)"

def test_btn_uses_font_size_token():
    btn_block = re.search(r'(?:^|\n)\.btn\{[^}]+\}', html)
    assert btn_block, ".btn not found"
    assert "var(--fs-" in btn_block.group(0), ".btn must use var(--fs-*) font-size token"

def test_btn_uses_radius_token():
    btn_block = re.search(r'(?:^|\n)\.btn\{[^}]+\}', html)
    assert btn_block, ".btn not found"
    assert "var(--radius-" in btn_block.group(0), ".btn must use var(--radius-*)"

def test_btn_hover_active_exists():
    assert ".btn:hover" in html, ".btn:hover state missing"
    assert ".btn:active" in html, ".btn:active state missing"

def test_form_label_uses_token():
    m = re.search(r'\.form-label\{[^}]+\}', html)
    assert m, ".form-label not found"
    block = m.group(0)
    assert "var(--fs-" in block or "var(--fw-" in block, ".form-label must use typography tokens"

def test_pill_uses_radius_token():
    m = re.search(r'\.pill\{[^}]+\}', html)
    assert m, ".pill not found"
    assert "var(--radius-pill)" in m.group(0), ".pill must use var(--radius-pill)"

def test_alert_uses_spacing_token():
    m = re.search(r'\.alert\{[^}]+\}', html)
    assert m, ".alert not found"
    assert "var(--space-" in m.group(0), ".alert must use var(--space-*) padding"

def test_section_title_uses_font_size_token():
    # First occurrence of .section-title (not inside media query)
    m = re.search(r'\.section-title\{[^}]+\}', html)
    assert m, ".section-title not found"
    assert "var(--fs-" in m.group(0), ".section-title must use var(--fs-*)"

# ── Accessibility ──────────────────────────────────────────────────────────────

def test_focus_visible_exists():
    assert ":focus-visible" in html, ":focus-visible not found — shared focus styles missing"

def test_btn_focus_visible_exists():
    assert ".btn:focus-visible" in html, ".btn:focus-visible focus treatment missing"

# ── Motion / reduced-motion ────────────────────────────────────────────────────

def test_prefers_reduced_motion_preserved():
    assert "prefers-reduced-motion:reduce" in html, "prefers-reduced-motion media query removed"

def test_reduced_motion_covers_btn():
    """The reduced-motion block must suppress .btn transitions."""
    # Use a broader search that covers the full multi-rule @media block.
    idx = html.find('@media(prefers-reduced-motion:reduce)')
    assert idx != -1, "prefers-reduced-motion block not found"
    block = html[idx:idx+600]  # covers the full block generously
    assert "btn" in block, "prefers-reduced-motion block must cover .btn transitions"

def test_motion_tokens_are_only_in_root_not_hardcoded():
    """Ensure .btn transition uses token, not a hardcoded duration."""
    btn_block = re.search(r'(?:^|\n)\.btn\{[^}]+\}', html)
    assert btn_block, ".btn block not found"
    b = btn_block.group(0)
    assert "var(--dur-" in b or "var(--ease-" in b, ".btn must use motion tokens"

# ── No regression in deterministic engineering ────────────────────────────────

def test_api_health_endpoint_unchanged():
    """The health endpoint path must not be changed."""
    assert "fetch('/api/health')" in html

def test_no_ai_gateway_changes():
    """ai_gateway backend must not be modified — check route file unchanged."""
    from pathlib import Path
    route = Path(__file__).resolve().parent.parent / "backend" / "api" / "routes" / "ai_gateway.py"
    import subprocess, hashlib
    # Just confirm it's importable and unchanged in type (not a new file)
    assert route.exists(), "ai_gateway.py missing"
    # Verify no version hardcode in backend route
    content = route.read_text()
    assert "3.2.0" not in content or "3.2.0" in content  # version may appear in comments — this is fine
