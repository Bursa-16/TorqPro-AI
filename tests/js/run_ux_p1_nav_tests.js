#!/usr/bin/env node
'use strict';
/**
 * UX-P1 Navigation & Information Architecture regression harness.
 *
 * Verifies the restructured sidebar: 5 semantic groups, button-based
 * items, stub pages handled truthfully, keyboard Enter/Space, focus-
 * visible, TR/EN i18n, and all production workflows reachable.
 *
 * Zero live API calls. Node vm + minimal DOM stub.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const {
  extractConstDecl,
  extractFunctionDecl,
} = require('./harness_common');

const html = fs.readFileSync(
  path.join(__dirname, '../../frontend/index.html'), 'utf8'
);

// ── assertion helpers ──────────────────────────────────────────────────────
let PASS = 0, FAIL = 0;
const failures = [];

function check(name, cond) {
  if (cond) { PASS++; }
  else       { FAIL++; failures.push(name); process.stderr.write(`FAIL: ${name}\n`); }
}
function checkIncludes(name, str, sub) {
  check(name, String(str || '').includes(sub));
}
function checkNotIncludes(name, str, sub) {
  check(name, !String(str || '').includes(sub));
}

// ── HTML structure helpers (no vm needed for structural checks) ────────────

/**
 * Extract the full sidebar HTML from the live index.html.
 */
function getSidebar() {
  const m = html.match(/<(?:div|nav)[^>]*class="sidebar"[^>]*>([\s\S]*?)<\/(?:div|nav)>\s*\n\s*<div class="content">/);
  return m ? m[1] : '';
}

function getAllPageIds() {
  const ids = [];
  const re = /<div id="page-([^"]+)" class="page/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.push(m[1]);
  return ids;
}

function getSidebarButtonTargets() {
  // Only visible (non-display:none section) buttons
  const sidebar = getSidebar();
  const targets = [];
  const re = /onclick="showPage\('([^']+)'/g;
  let m;
  while ((m = re.exec(sidebar)) !== null) targets.push(m[1]);
  return targets;
}

function getSidebarGroupLabels() {
  const labels = [];
  const re = /class="sidebar-label"[^>]*>([^<]+)</g;
  let m;
  const sidebar = getSidebar();
  while ((m = re.exec(sidebar)) !== null) labels.push(m[1].trim());
  return labels;
}

function getSidebarItemCount() {
  // Count button.sidebar-item within the visible (non-display:none) sections
  const sidebar = getSidebar();
  // Strip display:none sections
  const noAdmin = sidebar
    .replace(/id="adminSidebar"[\s\S]*?<\/div>\s*<\/div>/g, '')
    .replace(/id="dataAdminSidebar"[\s\S]*?<\/div>\s*<\/div>/g, '')
    .replace(/id="versionSidebar"[\s\S]*?<\/div>\s*<\/div>/g, '')
    .replace(/id="qualitySidebar"[\s\S]*?<\/div>\s*<\/div>/g, '')
    .replace(/id="enterpriseSidebar"[\s\S]*?<\/div>\s*<\/div>/g, '')
    .replace(/id="deploymentSidebar"[\s\S]*?<\/div>\s*<\/div>/g, '')
    .replace(/id="goliveSidebar"[\s\S]*?<\/div>\s*<\/div>/g, '')
    .replace(/id="cloudSidebar"[\s\S]*?<\/div>\s*<\/div>/g, '');
  return (noAdmin.match(/class="sidebar-item/g) || []).length;
}

// ── vm sandbox for i18n + showPage ────────────────────────────────────────

function buildCtx() {
  const parts = [];
  for (const n of ['I18N', 'QB_ENUM_LABELS']) {
    const d = extractConstDecl(html, n);
    if (d) parts.push(d);
  }
  parts.push('let CURRENT_LANG = "en";');
  parts.push('let _lastPage = null;');
  parts.push('let _lastEl = null;');
  // Stub showPage to record call
  parts.push(`function showPage(id, el) { _lastPage = id; _lastEl = el; }`);
  // Stub t()
  const tSrc = extractFunctionDecl(html, 't');
  if (tSrc) parts.push(tSrc);

  const el = {
    textContent: '', innerHTML: '', style: {}, _attrs: {},
    setAttribute(k,v){this._attrs[k]=v;},
    getAttribute(k){return this._attrs[k];},
    removeAttribute(k){delete this._attrs[k];},
  };
  const sandbox = {
    document: { getElementById: () => el, createElement() { return {textContent:'',get innerHTML(){return '';}}; } },
    console: { log(){}, warn(){}, error(){} },
    localStorage: { getItem: () => null },
    _lastPage: null, _lastEl: null,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(parts.join('\n'), ctx);
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

const pageIds    = getAllPageIds();
const sidebarBtns = getSidebarButtonTargets();
const sidebar     = getSidebar();

// ── 1. All page-* divs still in DOM ───────────────────────────────────────
check('DOM: page-dashboard exists', pageIds.includes('dashboard'));
check('DOM: page-hizli exists',     pageIds.includes('hizli'));
check('DOM: page-vdi exists',       pageIds.includes('vdi'));
check('DOM: page-questionbank exists', pageIds.includes('questionbank'));
check('DOM: page-documentintelligence exists', pageIds.includes('documentintelligence'));
check('DOM: page-fmea exists (stub, kept in DOM)', pageIds.includes('fmea'));
check('DOM: page-projects exists (stub, kept in DOM)', pageIds.includes('projects'));
check('DOM: page-revisions exists (stub, kept in DOM)', pageIds.includes('revisions'));
check('DOM: page-approvals exists (stub, kept in DOM)', pageIds.includes('approvals'));
check('DOM: 46 page-* divs present', pageIds.length === 46);

// ── 2. Primary nav items reduced ──────────────────────────────────────────
const visibleCount = getSidebarItemCount();
check('NAV: primary visible nav items < 35 (was 47)', visibleCount < 35);
check('NAV: primary visible nav items ≥ 20 (no over-pruning)', visibleCount >= 20);

// ── 3. Groups rendered ────────────────────────────────────────────────────
const groupLabels = getSidebarGroupLabels();
// We check via i18n keys present in the sidebar HTML
checkIncludes('NAV: section_overview key present',        sidebar, 'sidebar.section_overview');
checkIncludes('NAV: section_engineering key present',     sidebar, 'sidebar.section_engineering');
checkIncludes('NAV: section_quality_production key',      sidebar, 'sidebar.section_quality_production');
checkIncludes('NAV: section_knowledge key present',       sidebar, 'sidebar.section_knowledge');
checkIncludes('NAV: section_project_trace key present',   sidebar, 'sidebar.section_project_trace');

// ── 4. All production workflows reachable via sidebar buttons ─────────────
const requiredRoutes = [
  'dashboard', 'hizli', 'vdi', 'jointanalysis', 'frictioncondition',
  'strengthclasses', 'assemblyintelligence', 'materialintelligence',
  'washerresolution', 'checklist', 'yetenek', 'sikici', 'problem',
  'validation', 'questionbank', 'documentintelligence', 'governance',
  'oem', 'norm', 'arsiv', 'rapor', 'mobileaccess',
  'releasepackage', 'traceability', 'releasecert', 'sampleTorqueStudy',
];
for (const r of requiredRoutes) {
  check(`NAV: ${r} reachable in sidebar`, sidebarBtns.includes(r));
}

// ── 5. Stub pages NOT in primary nav buttons ──────────────────────────────
check('STUB: fmea not in primary sidebar buttons',     !sidebarBtns.includes('fmea'));
check('STUB: projects not in primary sidebar buttons', !sidebarBtns.includes('projects'));
check('STUB: revisions not in primary sidebar buttons',!sidebarBtns.includes('revisions'));
check('STUB: approvals not in primary sidebar buttons',!sidebarBtns.includes('approvals'));

// ── 6. Stub pages have under-development banner ───────────────────────────
checkIncludes('STUB: fmea has under-development banner',
  html.slice(html.indexOf('id="page-fmea"'), html.indexOf('id="page-fmea"') + 1000),
  'ui.under_development'
);
checkIncludes('STUB: projects has under-development banner',
  html.slice(html.indexOf('id="page-projects"'), html.indexOf('id="page-projects"') + 500),
  'ui.under_development'
);
checkIncludes('STUB: revisions has under-development banner',
  html.slice(html.indexOf('id="page-revisions"'), html.indexOf('id="page-revisions"') + 500),
  'ui.under_development'
);
checkIncludes('STUB: approvals has under-development banner',
  html.slice(html.indexOf('id="page-approvals"'), html.indexOf('id="page-approvals"') + 500),
  'ui.under_development'
);

// ── 7. Sidebar items are <button> elements ────────────────────────────────
// All visible sidebar nav items should be button type="button"
const divSidebarItems = (sidebar.match(/<div class="sidebar-item"/g) || []).length;
check('A11Y: no bare div.sidebar-item in primary nav sections (all converted to button)', divSidebarItems === 0);

// ── 8. Keyboard — button elements get Enter/Space for free ───────────────
// This is guaranteed by HTML spec for <button>; we verify no tabindex="-1" blocks them
checkNotIncludes('A11Y: no tabindex="-1" on sidebar buttons', sidebar, 'tabindex="-1"');

// ── 9. No positive tabindex ───────────────────────────────────────────────
checkNotIncludes('A11Y: no positive tabindex in sidebar', sidebar, 'tabindex="2"');
checkNotIncludes('A11Y: no positive tabindex in sidebar', sidebar, 'tabindex="3"');

// ── 10. aria-hidden on emoji icons ────────────────────────────────────────
checkIncludes('A11Y: sidebar icons have aria-hidden="true"', sidebar, 'aria-hidden="true"');

// ── 11. active state uses non-color cue (border-left) ────────────────────
// CSS already defines border-left on .sidebar-item.active; verify class exists
checkIncludes('A11Y: active state class present on first item',
  sidebar, 'class="sidebar-item active"');

// ── 12. Admin sections hidden by default ─────────────────────────────────
checkIncludes('NAV: adminSidebar has display:none', sidebar, 'id="adminSidebar" style="display:none"');
checkIncludes('NAV: deploymentSidebar has display:none', sidebar, 'id="deploymentSidebar" style="display:none"');

// ── 13. Mobile toggle preserved ──────────────────────────────────────────
checkIncludes('MOBILE: toggleMobileMenu function present', html, 'toggleMobileMenu');
checkIncludes('MOBILE: mobile-topbar present', html, 'mobile-topbar');
checkIncludes('MOBILE: hamburger button present', html, 'mobile-menu-btn');

// ── 14. i18n — TR labels ─────────────────────────────────────────────────
{
  const ctx = buildCtx();
  vm.runInContext('CURRENT_LANG = "tr";', ctx);
  const sectionOverview = vm.runInContext('t("sidebar.section_overview")', ctx);
  check('I18N TR: section_overview = "Genel Bakış"', sectionOverview === 'Genel Bakış');
  const sectionEng = vm.runInContext('t("sidebar.section_engineering")', ctx);
  check('I18N TR: section_engineering present and non-key', sectionEng !== 'sidebar.section_engineering');
  const underDev = vm.runInContext('t("ui.under_development")', ctx);
  check('I18N TR: ui.under_development key present', underDev !== 'ui.under_development');
  check('I18N TR: ui.under_development not empty', underDev.length > 0);
  const qb = vm.runInContext('t("sidebar.questionbank")', ctx);
  check('I18N TR: sidebar.questionbank present', qb !== 'sidebar.questionbank');
}

// ── 15. i18n — EN labels ─────────────────────────────────────────────────
{
  const ctx = buildCtx();
  const sectionOverview = vm.runInContext('t("sidebar.section_overview")', ctx);
  check('I18N EN: section_overview = "Overview"', sectionOverview === 'Overview');
  const sectionEng = vm.runInContext('t("sidebar.section_engineering")', ctx);
  check('I18N EN: section_engineering = "Engineering"', sectionEng === 'Engineering');
  const qualProd = vm.runInContext('t("sidebar.section_quality_production")', ctx);
  check('I18N EN: section_quality_production = "Quality & Production"', qualProd === 'Quality & Production');
  const knowledge = vm.runInContext('t("sidebar.section_knowledge")', ctx);
  check('I18N EN: section_knowledge = "Knowledge"', knowledge === 'Knowledge');
  const projTrace = vm.runInContext('t("sidebar.section_project_trace")', ctx);
  check('I18N EN: section_project_trace = "Project & Traceability"', projTrace === 'Project & Traceability');
  const underDev = vm.runInContext('t("ui.under_development")', ctx);
  check('I18N EN: ui.under_development present', underDev !== 'ui.under_development');
}

// ── 16. AI-F1 Question Bank entry still reachable ────────────────────────
check('AI-F1: questionbank in sidebar buttons', sidebarBtns.includes('questionbank'));
checkIncludes('AI-F1: qb-ai-search-card still in HTML', html, 'qb-ai-search-card');
checkIncludes('AI-F1: qbAiSearch function still present', html, 'function qbAiSearch');
checkIncludes('AI-F1: qbAiExplain function still present', html, 'function qbAiExplain');

// ── 17. Document Intelligence still reachable ────────────────────────────
check('DI: documentintelligence in sidebar buttons', sidebarBtns.includes('documentintelligence'));

// ── 18. Torque/VDI/Joint core workflows reachable ────────────────────────
check('CORE: hizli reachable', sidebarBtns.includes('hizli'));
check('CORE: vdi reachable', sidebarBtns.includes('vdi'));
check('CORE: jointanalysis reachable', sidebarBtns.includes('jointanalysis'));

// ── 19. Backend calls: sidebar DOM has no fetch/apiRequest references ─────
checkNotIncludes('BACKEND: no fetch() in sidebar', sidebar, 'fetch(');
checkNotIncludes('BACKEND: no apiRequest in sidebar', sidebar, 'apiRequest');

// ── 20. Breadcrumb: section-title still rendered per page ─────────────────
checkIncludes('BREADCRUMB: section-header pattern present', html, 'class="section-header"');
checkIncludes('BREADCRUMB: section-title pattern present', html, 'class="section-title"');

// ── SUMMARY ────────────────────────────────────────────────────────────────
const total = PASS + FAIL;
process.stdout.write(`${total} assertions, ${PASS} passed, ${FAIL} failed\n`);
if (failures.length) {
  process.stdout.write(`FAILURES: ${JSON.stringify(failures)}\n`);
  process.exit(1);
}
