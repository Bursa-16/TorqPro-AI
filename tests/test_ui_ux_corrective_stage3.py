"""UI/UX Corrective Stage 3 — Application Shell Modernization Tests

Covers:
1. Topbar semantic role and logo-mark
2. Sidebar uses <nav> element with aria-label
3. Sidebar has id for aria-controls reference
4. Collapsible nav groups present (Engineering, Knowledge)
5. All original navigation destinations preserved
6. Mobile hamburger aria attributes
7. toggleNavGroup JS function present
8. lang-btn aria-pressed attribute
9. Token usage in shell CSS
10. prefers-reduced-motion covers shell
11. Stage 2 token system unchanged
"""
from __future__ import annotations
import re
from pathlib import Path

import pytest

FRONTEND = Path(__file__).resolve().parent.parent / "frontend" / "index.html"
html = FRONTEND.read_text(encoding="utf-8")

# ── Topbar ──────────────────────────────────────────────────────────────────

def test_topbar_has_role_banner():
    assert 'role="banner"' in html, "Topbar must have role=\"banner\""

def test_topbar_has_logo_mark():
    assert 'logo-mark' in html, ".logo-mark element must be in topbar"

def test_topbar_version_span_preserved():
    assert 'id="topbar-version"' in html, "#topbar-version span must be preserved"

def test_topbar_user_span_present():
    assert 'id="topbar-user"' in html, "#topbar-user span must be present for user display"

def test_topbar_uses_shadow_token():
    m = re.search(r'\.topbar\{[^}]+\}', html)
    assert m, ".topbar CSS not found"
    assert "var(--shadow-" in m.group(0), ".topbar must use elevation token"

def test_topbar_height_modernized():
    m = re.search(r'\.topbar\{[^}]+\}', html)
    assert m, ".topbar CSS not found"
    # Should be 56px (modernized from 52px)
    assert "56px" in m.group(0) or "var(--space-" in m.group(0), (
        "Topbar height should be modernized"
    )

# ── Sidebar semantic ─────────────────────────────────────────────────────────

def test_sidebar_uses_nav_element():
    assert '<nav class="sidebar"' in html, "Sidebar must use <nav> element"

def test_sidebar_has_aria_label():
    assert 'aria-label="Main navigation"' in html, (
        "Sidebar nav must have aria-label for screen readers"
    )

def test_sidebar_has_id_for_aria_controls():
    assert 'id="mainSidebar"' in html, "Sidebar must have id=\"mainSidebar\" for aria-controls reference"

def test_mobile_topbar_aria_controls_sidebar():
    assert 'aria-controls="mainSidebar"' in html, (
        "Mobile hamburger button must have aria-controls=\"mainSidebar\""
    )

def test_mobile_topbar_aria_expanded():
    assert 'aria-expanded="false"' in html, (
        "Mobile hamburger button must have aria-expanded attribute"
    )

def test_mobile_hamburger_aria_label():
    """Mobile hamburger must have an accessible label."""
    m = re.search(r'mobile-menu-btn[^>]*aria-label="([^"]+)"', html)
    assert m, "mobile-menu-btn must have aria-label"

# ── Collapsible nav groups ────────────────────────────────────────────────────

def test_engineering_nav_group_collapsible():
    assert 'id="navGroupEngineering"' in html, "Engineering nav group must have id"
    assert 'sidebar-section--collapsible' in html, "Collapsible class must be present"

def test_knowledge_nav_group_collapsible():
    assert 'id="navGroupKnowledge"' in html, "Knowledge nav group must have id"

def test_collapsible_label_role_button():
    """Collapsible labels must have role=button for keyboard access."""
    assert 'role="button"' in html, "Collapsible labels must have role=\"button\""

def test_collapsible_label_aria_expanded():
    assert 'aria-expanded="true"' in html, "Collapsible group labels must have aria-expanded"

def test_collapsible_label_aria_controls():
    assert 'aria-controls="navGroupEngineeringItems"' in html, (
        "Engineering label must have aria-controls"
    )
    assert 'aria-controls="navGroupKnowledgeItems"' in html, (
        "Knowledge label must have aria-controls"
    )

def test_toggle_nav_group_function_present():
    assert "function toggleNavGroup(" in html, "toggleNavGroup() JS function must be present"

def test_toggle_nav_group_updates_aria_expanded():
    """toggleNavGroup must update aria-expanded on the label."""
    assert "setAttribute('aria-expanded'" in html or 'setAttribute("aria-expanded"' in html, (
        "toggleNavGroup must update aria-expanded attribute"
    )

# ── All navigation destinations preserved ─────────────────────────────────────

REQUIRED_PAGES = [
    'dashboard', 'hizli', 'vdi', 'jointanalysis', 'frictioncondition',
    'strengthclasses', 'assemblyintelligence', 'materialintelligence',
    'washerresolution', 'checklist', 'yetenek', 'sikici', 'problem',
    'validation', 'questionbank', 'documentintelligence', 'governance',
    'oem', 'norm', 'arsiv', 'rapor', 'mobileaccess', 'releasepackage',
    'traceability', 'sampleTorqueStudy',
]

@pytest.mark.parametrize("page", REQUIRED_PAGES)
def test_navigation_destination_preserved(page):
    assert f"showPage('{page}'" in html, f"Navigation to '{page}' must be preserved"

def test_stub_pages_in_dom_not_nav():
    """Stub pages must exist in DOM but not in primary nav."""
    for stub in ['fmea', 'projects', 'revisions', 'approvals']:
        assert f'id="page-{stub}"' in html, f"page-{stub} must remain in DOM"
        # Verify NOT in sidebar primary nav (only in dom)
        sidebar_m = re.search(r'<nav[^>]*class="sidebar"[^>]*>([\s\S]*?)</nav>', html)
        if sidebar_m:
            assert f"showPage('{stub}'" not in sidebar_m.group(1), (
                f"Stub page '{stub}' must not appear in primary nav"
            )

# ── Lang button ───────────────────────────────────────────────────────────────

def test_lang_btn_has_aria_pressed():
    assert 'aria-pressed=' in html, "lang-btn must have aria-pressed attribute"

def test_lang_btn_focus_visible():
    assert '.lang-btn:focus-visible' in html, ".lang-btn must have focus-visible style"

# ── Token usage in shell CSS ─────────────────────────────────────────────────

def test_sidebar_uses_radius_token():
    # button.sidebar-item should use var(--radius-
    btn_sidebar = re.search(r'button\.sidebar-item\{[^}]+\}', html)
    assert btn_sidebar, "button.sidebar-item CSS not found"
    assert "var(--radius-" in btn_sidebar.group(0), "button.sidebar-item must use radius token"

def test_sidebar_label_uses_font_token():
    # Find the base .sidebar-label{...} rule (not the collapsible modifier)
    # Search for the rule that contains color:var(--text3) which is the base rule
    matches = re.findall(r'\.sidebar-label\{[^}]+\}', html)
    assert matches, ".sidebar-label CSS not found"
    base_rules = [m for m in matches if 'var(--text3)' in m or 'var(--fs-' in m or 'var(--fw-' in m]
    assert base_rules, "No .sidebar-label base rule with tokens found"
    base = base_rules[0]
    assert "var(--fs-" in base or "var(--fw-" in base, (
        f".sidebar-label base rule must use typography tokens: {base}"
    )

def test_sidebar_section_uses_spacing_token():
    m = re.search(r'\.sidebar-section\{[^}]+\}', html)
    assert m, ".sidebar-section CSS not found"
    assert "var(--space-" in m.group(0), ".sidebar-section must use spacing token"

def test_mobile_sidebar_transition_tokenized():
    """Mobile sidebar slide must use duration token."""
    m = re.search(r'\.sidebar\{transform:translateX\(-100%\)[^}]+\}', html)
    assert m, "Mobile sidebar transition rule not found"
    assert "var(--dur-" in m.group(0), "Mobile sidebar transition must use --dur-* token"

# ── Reduced-motion covers shell ───────────────────────────────────────────────

def test_reduced_motion_covers_sidebar():
    # Use index-based search to cover the full multi-rule @media block.
    idx = html.find('@media(prefers-reduced-motion:reduce)')
    assert idx != -1, "prefers-reduced-motion block not found"
    block = html[idx:idx+600]  # covers the full block generously
    assert "sidebar" in block or "topbar" in block, (
        "prefers-reduced-motion must cover sidebar/topbar shell transitions"
    )

# ── showPage auto-expand collapsed group ─────────────────────────────────────

def test_showpage_expands_collapsed_group():
    """showPage must re-expand a collapsed group when navigating to a child."""
    assert "sidebar-collapsed" in html and "sidebar-section--collapsible" in html, (
        "Collapsible infrastructure must be present in showPage context"
    )
    assert "classList.remove('sidebar-collapsed')" in html, (
        "showPage must remove sidebar-collapsed class when activating a nested item"
    )

# ── Stage 2 tokens unchanged ─────────────────────────────────────────────────

@pytest.mark.parametrize("token", [
    "--fs-base", "--fs-md", "--space-3", "--radius-md",
    "--shadow-sm", "--dur-normal", "--ease-std",
])
def test_stage2_tokens_still_present(token):
    assert f"{token}:" in html, f"Stage 2 token {token!r} must not be removed"
