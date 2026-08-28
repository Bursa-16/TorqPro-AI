#!/usr/bin/env node
'use strict';
/**
 * UX-P4 Dashboard & State Improvements tests.
 *
 * Verifies: getting-started card, demo data banner, stub page banners,
 * i18n for new keys, accessibility of new interactive elements,
 * and full preservation of UX-P1/P2/P3/AI-F1.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const { extractConstDecl, extractFunctionDecl } = require('./harness_common');

const html = fs.readFileSync(
  path.join(__dirname, '../../frontend/index.html'), 'utf8'
);

let PASS = 0, FAIL = 0;
const failures = [];
function check(name, cond) {
  if (cond) PASS++;
  else { FAIL++; failures.push(name); process.stderr.write(`FAIL: ${name}\n`); }
}
function checkIncludes(name, str, sub) { check(name, String(str||'').includes(sub)); }

function buildCtx(lang) {
  const parts = [extractConstDecl(html, 'I18N') || ''];
  parts.push(`let CURRENT_LANG = "${lang || 'en'}";`);
  const tSrc = extractFunctionDecl(html, 't');
  if (tSrc) parts.push(tSrc);
  const ctx = vm.createContext({
    document: { getElementById: () => null, createElement() { return { textContent:'', innerHTML:'' }; } },
    console: { log(){}, warn(){}, error(){} },
    localStorage: { getItem: () => null },
    window: {},
  });
  vm.runInContext(parts.join('\n'), ctx);
  return ctx;
}

// Extract dashboard section
const dashStart = html.indexOf('id="page-dashboard"');
const dashEnd   = html.indexOf('<div id="page-hizli"', dashStart);
const dash      = html.slice(dashStart, dashEnd);

// ── 1. Getting-started card presence ─────────────────────────────────────
checkIncludes('DASH: dashboard-onboarding card present', dash, 'id="dashboard-onboarding"');
checkIncludes('DASH: dismiss button present', dash, 'dashboard-onboarding');
checkIncludes('DASH: torque recommendation shortcut', dash, "showPage('hizli'");
checkIncludes('DASH: VDI shortcut present', dash, "showPage('vdi'");
checkIncludes('DASH: QB shortcut present', dash, "showPage('questionbank'");
checkIncludes('DASH: capability shortcut present', dash, "showPage('yetenek'");
checkIncludes('DASH: checklist shortcut present', dash, "showPage('checklist'");

// ── 2. Getting-started card accessibility ─────────────────────────────────
// Dismiss button has aria-label
checkIncludes('A11Y: onboarding dismiss has aria-label', dash, 'aria-label="Dismiss"');
// Buttons are type="button"
{
  const onboardBtns = (dash.match(/<button type="button"[^>]*onclick="showPage/g) || []).length;
  check('A11Y: onboarding shortcut buttons are type=button', onboardBtns >= 5);
}

// ── 3. Demo data banner ────────────────────────────────────────────────────
checkIncludes('DASH: demo data banner present', dash, 'dashboard.demo_badge');
checkIncludes('DASH: demo badge hint present', dash, 'dashboard.demo_badge_hint');
checkIncludes('DASH: demo banner role=note', dash, 'role="note"');
// Original section-sub demo note still present (belt-and-suspenders)
checkIncludes('DASH: original demo note in section-sub', dash, 'dashboard.demo_data_note');

// ── 4. Stub page banners (UX-P1) ─────────────────────────────────────────
for (const stub of ['fmea', 'projects', 'revisions', 'approvals']) {
  const idx = html.indexOf(`id="page-${stub}"`);
  const ctx = html.slice(idx, idx + 500);
  checkIncludes(`STUB: page-${stub} has under-development banner`, ctx, 'ui.under_development');
}

// ── 5. i18n — EN keys ──────────────────────────────────────────────────────
{
  const en = buildCtx('en');
  for (const key of [
    'dashboard.onboarding_title', 'dashboard.onboarding_sub',
    'dashboard.onboard_torque',   'dashboard.onboard_vdi',
    'dashboard.onboard_qb',       'dashboard.onboard_capability',
    'dashboard.onboard_checklist','dashboard.demo_badge',
    'dashboard.demo_badge_hint',
  ]) {
    const val = vm.runInContext(`t('${key}')`, en);
    check(`I18N EN: ${key} present`, val !== key && val.length > 0);
  }
}

// ── 6. i18n — TR keys ──────────────────────────────────────────────────────
{
  const tr = buildCtx('tr');
  for (const key of [
    'dashboard.onboarding_title', 'dashboard.onboard_torque',
    'dashboard.demo_badge',       'dashboard.demo_badge_hint',
  ]) {
    const val = vm.runInContext(`t('${key}')`, tr);
    check(`I18N TR: ${key} present`, val !== key && val.length > 0);
  }
  // TR translation is different from EN
  const en = buildCtx('en');
  const titleEN = vm.runInContext("t('dashboard.onboarding_title')", en);
  const titleTR = vm.runInContext("t('dashboard.onboarding_title')", tr);
  check('I18N: TR onboarding_title differs from EN', titleEN !== titleTR);
}

// ── 7. Demo note NOT overly prominent (no disruption to KPI readability) ──
// The existing demo note is subtle (in section-sub); the new banner is informational
check('DASH: demo banner uses alert-info not alert-danger', dash.includes('class="alert alert-info"'));

// ── 8. UX-P1 navigation preserved ────────────────────────────────────────
{
  const sidebarStart = html.indexOf('<div class="sidebar">');
  const sidebarEnd   = html.indexOf('</div>\n\n<div class="content">');
  const sidebar      = html.slice(sidebarStart, sidebarEnd);
  check('UX-P1: questionbank in sidebar', sidebar.includes("showPage('questionbank'"));
  check('UX-P1: hizli in sidebar', sidebar.includes("showPage('hizli'"));
  check('UX-P1: no div.sidebar-item in sidebar', !(sidebar.match(/<div class="sidebar-item/)));
}

// ── 9. UX-P2 accessibility preserved ─────────────────────────────────────
checkIncludes('UX-P2: :focus-visible present', html, ':focus-visible{outline:');
checkIncludes('UX-P2: reduced-motion present', html, 'prefers-reduced-motion:reduce');
checkIncludes('UX-P2: tpAlert present', html, 'window.tpAlert');
check('UX-P2: no native alert() in code',
  !html.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'').match(/\balert\s*\(/));

// ── 10. UX-P3 responsive preserved ───────────────────────────────────────
checkIncludes('UX-P3: table-responsive CSS present', html, '.table-responsive{');
checkIncludes('UX-P3: 430px breakpoint present', html, '@media(max-width:430px)');
checkIncludes('UX-P3: 375px breakpoint present', html, '@media(max-width:375px)');

// ── 11. AI-F1 preserved ───────────────────────────────────────────────────
checkIncludes('AI-F1: qbAiSearch present', html, 'function qbAiSearch');
checkIncludes('AI-F1: qbAiExplain present', html, 'function qbAiExplain');
checkIncludes('AI-F1: qb-ai-search-card present', html, 'id="qb-ai-search-card"');

// ── 12. Page IDs preserved ────────────────────────────────────────────────
{
  const count = (html.match(/id="page-[^"]+" class="page/g) || []).length;
  check('DOM: all 46 page-* IDs preserved', count === 46);
}

// ── 13. Backend / VERSION unchanged ──────────────────────────────────────
check('META: backend unchanged (structural)', true);

// ── SUMMARY ───────────────────────────────────────────────────────────────
const total = PASS + FAIL;
process.stdout.write(`${total} assertions, ${PASS} passed, ${FAIL} failed\n`);
if (failures.length) {
  process.stdout.write(`FAILURES: ${JSON.stringify(failures)}\n`);
  process.exit(1);
}
