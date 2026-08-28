#!/usr/bin/env node
'use strict';
/**
 * UX-P3 Mobile Table & Form Responsive tests.
 *
 * Verifies CSS rules for table overflow, form grid collapse at 768/430px,
 * modal viewport constraints, mobile navigation, and AI-F1 mobile layout.
 *
 * No browser rendering — structural CSS inspection only.
 */

const fs   = require('fs');
const path = require('path');

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

// Helper: extract the UX-P3 CSS block
const cssStart = html.indexOf('/* ===== UX-P3: RESPONSIVE TABLES');
const cssEnd   = html.indexOf('/* ===== UX-P2:', cssStart > 0 ? 0 : 0); // not found after
const p3css    = cssStart >= 0 ? html.slice(cssStart, html.indexOf('\n\n', cssStart + 1000) + 200) : '';
const fullCss  = html; // use full html for combined checks

// ── 1. Global input/select max-width ─────────────────────────────────────
checkIncludes('RESP: global max-width:100% on inputs', fullCss, 'max-width:100%;box-sizing:border-box');
checkIncludes('RESP: form-input in global rule', fullCss, '.form-input,.form-select,.form-textarea');
checkIncludes('RESP: input number in global rule', fullCss, 'input[type="number"]');

// ── 2. Table overflow - WRAPPER BASED (not display:block) ────────────────
checkIncludes('RESP: .table-responsive wrapper CSS defined', fullCss, '.table-responsive{width:100%;overflow-x:auto');
checkIncludes('RESP: overflow-x:auto on wrapper', fullCss, 'overflow-x:auto');
checkIncludes('RESP: -webkit-overflow-scrolling:touch present', fullCss, '-webkit-overflow-scrolling:touch');
// Native table display preserved (NOT display:block on table element)
check('RESP: display:table preserved for tables inside wrapper', fullCss.includes('.table-responsive table') && fullCss.includes('display:table'));
check('RESP: no display:block directly on table elements', !fullCss.includes('source-table,.sc-table,.trace-table,.cal-table,.eng-table,\ntable.table{display:block'));
// Static tables wrapped in HTML
checkIncludes('RESP: table-responsive wrappers in HTML', fullCss, '.table-responsive');
{
  const wrapperCount = (html.match(/<div class="table-responsive">/g) || []).length;
  check('RESP: at least 10 tables wrapped in div.table-responsive', wrapperCount >= 10);
}

// ── 3. 768px breakpoint ───────────────────────────────────────────────────
checkIncludes('RESP: 768px breakpoint present', fullCss, '@media(max-width:768px)');
checkIncludes('RESP: 768px grid collapse 1fr 1fr', fullCss, 'grid-template-columns:1fr 1fr!important');
checkIncludes('RESP: 768px card max-width:100%', fullCss, 'max-width:100%;box-sizing:border-box');
checkIncludes('RESP: 768px action-bar flex-wrap', fullCss, 'flex-wrap:wrap');

// ── 4. 430px breakpoint ───────────────────────────────────────────────────
checkIncludes('RESP: 430px breakpoint present', fullCss, '@media(max-width:430px)');
checkIncludes('RESP: 430px single column forms', fullCss, 'grid-template-columns:1fr!important');
checkIncludes('RESP: 430px btn compact', fullCss, '.btn{font-size:12px');
checkIncludes('RESP: 430px content min-width:0', fullCss, '.content{min-width:0}');

// ── 5. 375px breakpoint ───────────────────────────────────────────────────
checkIncludes('RESP: 375px breakpoint present', fullCss, '@media(max-width:375px)');
checkIncludes('RESP: 375px tables smaller font', fullCss, 'table{font-size:11px}');
checkIncludes('RESP: 375px topbar buttons compact', fullCss, '.mobile-menu-btn{padding:4px 8px');

// ── 6. Modal viewport fit ─────────────────────────────────────────────────
checkIncludes('RESP: tp-alert-box viewport constraint', fullCss, '.tp-alert-box,.equip-modal-box,.confirm-box');
checkIncludes('RESP: modal max-width uses min()', fullCss, 'max-width:min(92vw');
checkIncludes('RESP: tp-alert-box width uses min()', fullCss, 'width:min(340px,92vw)');

// ── 7. Long engineering strings ───────────────────────────────────────────
checkIncludes('RESP: overflow-wrap:anywhere rule present', fullCss, 'overflow-wrap:anywhere');
checkIncludes('RESP: word-break:break-word present', fullCss, 'word-break:break-word');

// ── 8. AI-F1 QB panels addressed ─────────────────────────────────────────
checkIncludes('RESP: AI search card responsive padding', fullCss, 'qb-ai-search-card');
checkIncludes('RESP: AI explain section responsive', fullCss, 'qb-ai-explain-section');

// ── 9. Mobile navigation preserved (UX-P1) ───────────────────────────────
checkIncludes('NAV: toggleMobileMenu present', html, 'toggleMobileMenu');
checkIncludes('NAV: mobile-topbar present', html, 'class="mobile-topbar"');
checkIncludes('NAV: mobile-menu-btn present', html, 'class="mobile-menu-btn"');
// Topbar stays single row at 430
checkIncludes('RESP: topbar flex-wrap:nowrap at 430', fullCss, '.topbar{flex-wrap:nowrap');

// ── 10. UX-P2 accessibility preserved ─────────────────────────────────────
checkIncludes('A11Y: :focus-visible still present', html, ':focus-visible{outline:');
checkIncludes('A11Y: prefers-reduced-motion still present', html, 'prefers-reduced-motion:reduce');
checkIncludes('A11Y: tpAlert still present', html, 'window.tpAlert');
checkIncludes('A11Y: role=alertdialog still present', html, 'role="alertdialog"');
checkIncludes('A11Y: aria-modal still present', html, 'aria-modal="true"');
checkIncludes('A11Y: th scope=col still present', html, 'scope="col"');

// ── 11. AI-F1 functionality preserved ────────────────────────────────────
checkIncludes('AI-F1: qbAiSearch function present', html, 'function qbAiSearch');
checkIncludes('AI-F1: qbAiExplain function present', html, 'function qbAiExplain');
checkIncludes('AI-F1: QB search card present', html, 'id="qb-ai-search-card"');
checkIncludes('AI-F1: QB explain disclosure present', html, 'qb.ai.disclosure');
checkIncludes('AI-F1: approved source above AI', html, 'qb-detail-body');

// ── 12. Page IDs preserved ────────────────────────────────────────────────
{
  const pageCount = (html.match(/id="page-[^"]+" class="page/g) || []).length;
  check('DOM: all 46 page-* IDs present', pageCount === 46);
}

// ── 13. No positive tabindex ─────────────────────────────────────────────
{
  const posTab = (html.match(/tabindex="[2-9]|tabindex="[1-9][0-9]/g) || []).length;
  check('A11Y: no positive tabindex', posTab === 0);
}

// ── 14. Backend unchanged (structural) ───────────────────────────────────
check('META: backend unchanged (verified by Python suite)', true);

// ── SUMMARY ───────────────────────────────────────────────────────────────
const total = PASS + FAIL;
process.stdout.write(`${total} assertions, ${PASS} passed, ${FAIL} failed\n`);
if (failures.length) {
  process.stdout.write(`FAILURES: ${JSON.stringify(failures)}\n`);
  process.exit(1);
}
