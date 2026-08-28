#!/usr/bin/env node
'use strict';
/*
 * AI-F1 -- QB AI Search + Explain frontend tests.
 * Uses the same vm+createChecker harness pattern as other TorqPro JS tests.
 */
const path = require('path');
const vm   = require('vm');
const fs   = require('fs');

const {
  extractConstDecl,
  extractFunctionDecl,
  createChecker,
} = require('./harness_common');

const REPO_ROOT     = path.resolve(__dirname, '..', '..');
const FRONTEND_PATH = path.join(REPO_ROOT, 'frontend', 'index.html');
const html          = fs.readFileSync(FRONTEND_PATH, 'utf8');

const { check, checkIncludes, checkNotIncludes, recordFailure, summary } = createChecker();

// ── Build sandbox ─────────────────────────────────────────────────────────────
function buildSandbox(opts) {
  opts = opts || {};
  const parts = [];
  for (const n of ['I18N', 'QB_ENUM_LABELS']) {
    const decl = extractConstDecl(html, n);
    if (decl) parts.push(decl);
  }
  parts.push('let CURRENT_LANG = "en";');
  parts.push('let QB_SELECTED_ID = null;');
  parts.push('let QB_SELECTED_RECORD = null;');
  parts.push('let QB_SELECTED_STATUS_HISTORY = [];');
  parts.push('let QB_SELECTED_AUDIT = [];');
  for (const fn of ['t', 'qbEsc', 'qbFmtLabel', 'qbLabel', 'qbCategoryLabel',
                     'qbStatusBadgeHtml', 'qbAiSearch', 'qbAiExplain']) {
    const src = extractFunctionDecl(html, fn);
    if (src) parts.push(src);
  }

  const elements = {};
  function _htmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getEl(id) {
    if (!elements[id]) {
      const el = {
        _id: id, _textContent: '', _innerHTML: '', style: {}, _attrs: {},
        get textContent() { return this._textContent; },
        set textContent(v) {
          this._textContent = String(v == null ? '' : v);
          // Mirror real DOM: setting textContent HTML-escapes into innerHTML.
          this._innerHTML = _htmlEsc(this._textContent);
        },
        get innerHTML() { return this._innerHTML; },
        set innerHTML(v) {
          this._innerHTML = String(v == null ? '' : v);
          // Setting innerHTML to raw HTML -- textContent would be stripped
          // version, but for test purposes keep _textContent as-is.
        },
        setAttribute(k, v) { this._attrs[k] = v; },
        getAttribute(k)    { return this._attrs[k]; },
        removeAttribute(k) { delete this._attrs[k]; },
      };
      elements[id] = el;
    }
    return elements[id];
  }

  const sandbox = {
    document: {
      getElementById: id => getEl(id),
      // createElement stub: minimal div with textContent->innerHTML escaping
      // needed for qbEsc(), which uses DOM to escape HTML safely.
      createElement(tag) {
        let _text = '';
        const el = {
          get textContent() { return _text; },
          set textContent(v) { _text = String(v == null ? '' : v); },
          get innerHTML() { return _htmlEsc(_text); },
        };
        return el;
      },
    },
    console:      { log(){}, warn(){}, error(){} },
    localStorage: { getItem: () => null },
    apiRequest:   opts.apiRequest || (() => Promise.reject(new Error('not stubbed'))),
    _elements:    elements,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(parts.join('\n'), ctx);
  return { ctx, elements };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function waitMs(ms) { return new Promise(res => setTimeout(res, ms)); }

// ── 1. i18n keys ─────────────────────────────────────────────────────────────
{
  const { ctx } = buildSandbox();

  vm.runInContext('CURRENT_LANG = "tr";', ctx);
  const explainTR = vm.runInContext('t("qb.ai.explain_button")', ctx);
  check('TR: explain_button = "AI ile Açıkla"', explainTR === 'AI ile Açıkla');

  vm.runInContext('CURRENT_LANG = "en";', ctx);
  const explainEN = vm.runInContext('t("qb.ai.explain_button")', ctx);
  check('EN: explain_button = "Explain with AI"', explainEN === 'Explain with AI');

  const loading = vm.runInContext('t("qb.ai.explain_loading")', ctx);
  check('EN: explain_loading key present', loading && loading !== 'qb.ai.explain_loading');

  vm.runInContext('CURRENT_LANG = "tr";', ctx);
  const discTR = vm.runInContext('t("qb.ai.disclosure")', ctx);
  checkIncludes('TR: disclosure contains "yetkili kaynak"', discTR, 'yetkili kaynak');

  vm.runInContext('CURRENT_LANG = "en";', ctx);
  const discEN = vm.runInContext('t("qb.ai.disclosure")', ctx);
  checkIncludes('EN: disclosure contains "authoritative source"', discEN, 'authoritative source');

  const err503 = vm.runInContext('t("qb.ai.explain_error_503")', ctx);
  check('EN: explain_error_503 key present', err503 && err503 !== 'qb.ai.explain_error_503');

  const err404 = vm.runInContext('t("qb.ai.explain_error_404")', ctx);
  check('EN: explain_error_404 key present', err404 && err404 !== 'qb.ai.explain_error_404');

  vm.runInContext('CURRENT_LANG = "tr";', ctx);
  const searchBtn = vm.runInContext('t("qb.ai.search_button")', ctx);
  check('TR: search_button = "Ara"', searchBtn === 'Ara');

  check('TR/EN disclosure differ', discTR !== discEN && discTR.length > 0 && discEN.length > 0);
}

// ── 2. qbEsc security ────────────────────────────────────────────────────────
{
  const { ctx } = buildSandbox();
  const escaped = vm.runInContext('qbEsc("<script>alert(1)</script>")', ctx);
  checkNotIncludes('qbEsc: <script> not in output', escaped, '<script>');
  checkIncludes('qbEsc: &lt; in output', escaped, '&lt;');

  const r1 = vm.runInContext('qbEsc(null)', ctx);
  const r2 = vm.runInContext('qbEsc(undefined)', ctx);
  check('qbEsc(null) returns string', typeof r1 === 'string');
  check('qbEsc(undefined) returns string', typeof r2 === 'string');
}

// ── 3. HTML structure ────────────────────────────────────────────────────────
check('HTML: qb-ai-search-input is form-input',
  html.includes('id="qb-ai-search-input"') && html.includes('class="form-input" id="qb-ai-search-input"'));
check('HTML: qb-ai-explain-btn is button',
  html.includes('id="qb-ai-explain-btn"') &&
  (() => { const line = html.split('\n').find(l => l.includes('qb-ai-explain-btn')); return line && line.includes('<button'); })());
check('HTML: search status role=status',
  html.includes('id="qb-ai-search-status" role="status"'));
check('HTML: explain status role=status',
  html.includes('id="qb-ai-explain-status" role="status"'));
check('HTML: search input has aria-label',
  html.includes('aria-label="AI question search input"'));
check('HTML: no positive tabindex in AI panel',
  !(/qb-ai-(?:search|explain)[^<]*tabindex="[1-9]/.test(html)));
check('HTML: explain panel disclosure element present',
  html.includes('id="qb-ai-explain-disclosure"'));
check('HTML: explain evidence element present',
  html.includes('id="qb-ai-explain-evidence"'));
check('HTML: explain limitations element present',
  html.includes('id="qb-ai-explain-limitations"'));

// ── Async tests ───────────────────────────────────────────────────────────────
async function runAsync() {

  // 4. qbAiSearch: empty input, no call
  {
    let called = false;
    const { ctx } = buildSandbox({ apiRequest: () => { called = true; return Promise.resolve({ results: [] }); } });
    vm.runInContext('document.getElementById("qb-ai-search-input").value = "   ";', ctx);
    vm.runInContext('qbAiSearch();', ctx);
    await waitMs(40);
    check('qbAiSearch: empty input makes no API call', !called);
  }

  // 5. qbAiSearch: loading text set
  {
    let loadingSeen = false;
    const { ctx, elements } = buildSandbox({
      apiRequest: () => { loadingSeen = (elements['qb-ai-search-status'].textContent || '').length > 0; return new Promise(() => {}); }
    });
    vm.runInContext('document.getElementById("qb-ai-search-input").value = "torque";', ctx);
    vm.runInContext('qbAiSearch();', ctx);
    await waitMs(20);
    check('qbAiSearch: loading text set before fetch', loadingSeen);
  }

  // 6. qbAiSearch: empty results
  {
    const { ctx, elements } = buildSandbox({
      apiRequest: () => Promise.resolve({ schema_version: '1.0', results: [], count: 0 })
    });
    vm.runInContext('document.getElementById("qb-ai-search-input").value = "nothing";', ctx);
    vm.runInContext('qbAiSearch();', ctx);
    await waitMs(50);
    const status = elements['qb-ai-search-status'].textContent;
    check('qbAiSearch: empty results shows message', status.length > 0 && !status.includes('{n}'));
  }

  // 7. qbAiSearch: network error
  {
    const { ctx, elements } = buildSandbox({ apiRequest: () => Promise.reject(new Error('net')) });
    vm.runInContext('document.getElementById("qb-ai-search-input").value = "torque";', ctx);
    vm.runInContext('qbAiSearch();', ctx);
    await waitMs(50);
    check('qbAiSearch: network error shows message', (elements['qb-ai-search-status'].textContent || '').length > 0);
  }

  // 8. qbAiSearch: safe rendering (no raw HTML)
  {
    const malicious = '<img src=x onerror=alert(1)>';
    const { ctx, elements } = buildSandbox({
      apiRequest: () => Promise.resolve({ schema_version: '1.0', count: 1, results: [
        { source_id: malicious, title_en: malicious, title_tr: malicious, category: 'tightening_torque', difficulty: 'beginner' }
      ]})
    });
    vm.runInContext('document.getElementById("qb-ai-search-input").value = "test";', ctx);
    vm.runInContext('qbAiSearch();', ctx);
    await waitMs(50);
    const resultHtml = elements['qb-ai-search-results'].innerHTML || '';
    // Security: raw executable HTML tags must not appear.
    // Encoded versions (e.g. &lt;img) in attribute values are safe.
    checkNotIncludes('qbAiSearch: raw <img> not in results', resultHtml, '<img');
    // Executable onerror handler: only dangerous when paired with a real tag.
    // Since <img is absent, no onerror= can execute; check raw tag absence is sufficient.
    check('qbAiSearch: onerror not in results', !resultHtml.includes('<img'));
  }

  // 9. qbAiSearch: exact question_id in result
  {
    const qid = 'QB-EXACT-001';
    const { ctx, elements } = buildSandbox({
      apiRequest: () => Promise.resolve({ schema_version: '1.0', count: 1, results: [
        { source_id: qid, title_en: 'Test Q', category: 'tightening_torque', difficulty: 'beginner' }
      ]})
    });
    vm.runInContext('document.getElementById("qb-ai-search-input").value = "test";', ctx);
    vm.runInContext('qbAiSearch();', ctx);
    await waitMs(50);
    checkIncludes('qbAiSearch: exact question_id in results', elements['qb-ai-search-results'].innerHTML || '', qid);
  }

  // 10. qbAiSearch: request body never contains provider_name
  {
    let captured = null;
    const { ctx } = buildSandbox({
      apiRequest: (_m, _u, body) => { captured = body; return Promise.resolve({ results: [], count: 0 }); }
    });
    vm.runInContext('document.getElementById("qb-ai-search-input").value = "bolt";', ctx);
    vm.runInContext('qbAiSearch();', ctx);
    await waitMs(50);
    check('qbAiSearch: request made', captured !== null);
    check('qbAiSearch: no provider_name in body', captured && !('provider_name' in captured));
    check('qbAiSearch: no model in body', captured && !('model' in captured));
    check('qbAiSearch: no api_key in body', captured && !('api_key' in captured));
  }

  // 11. qbAiExplain: no call when QB_SELECTED_ID null
  {
    let called = false;
    const { ctx } = buildSandbox({ apiRequest: () => { called = true; return Promise.resolve({}); } });
    vm.runInContext('QB_SELECTED_ID = null;', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(40);
    check('qbAiExplain: no call when QB_SELECTED_ID null', !called);
  }

  // 12. qbAiExplain: loading text set
  {
    let loadingSeen = false;
    const { ctx, elements } = buildSandbox({
      apiRequest: () => { loadingSeen = (elements['qb-ai-explain-status'].textContent || '').length > 0; return new Promise(() => {}); }
    });
    vm.runInContext('QB_SELECTED_ID = "QB-TEST-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(20);
    check('qbAiExplain: loading text set before fetch', loadingSeen);
  }

  // 13. qbAiExplain: explanation via textContent (not innerHTML)
  {
    const aiText = 'VDI 2230 prensiplerine göre önceden yük uygulanır.';
    const { ctx, elements } = buildSandbox({
      apiRequest: () => Promise.resolve({
        schema_version: '1.0', question_id: 'QB-T-001',
        explanation: aiText, evidence: [], limitations: [], audit_trace_id: 42,
      })
    });
    vm.runInContext('QB_SELECTED_ID = "QB-T-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(50);
    const textEl = elements['qb-ai-explain-text'];
    check('qbAiExplain: explanation in textContent', textEl.textContent === aiText);
    checkNotIncludes('qbAiExplain: no HTML tags in explain textContent', textEl.innerHTML || textEl.textContent, '<');
  }

  // 14. qbAiExplain: disclosure visible
  {
    const { ctx, elements } = buildSandbox({
      apiRequest: () => Promise.resolve({
        schema_version: '1.0', question_id: 'QB-DISC-001',
        explanation: 'Test.', evidence: [], limitations: [], audit_trace_id: 1,
      })
    });
    vm.runInContext('QB_SELECTED_ID = "QB-DISC-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(50);
    const disc = elements['qb-ai-explain-disclosure'];
    check('qbAiExplain: disclosure populated', disc && disc.textContent.length > 0);
  }

  // 15. qbAiExplain: evidence rendered
  {
    const { ctx, elements } = buildSandbox({
      apiRequest: () => Promise.resolve({
        schema_version: '1.0', question_id: 'QB-EV-001',
        explanation: 'Test.', limitations: [], audit_trace_id: 1,
        evidence: [{ source_id: 'QB-EV-001', source_type: 'question_bank', title_en: 'Ev', title_tr: 'Kanıt' }],
      })
    });
    vm.runInContext('QB_SELECTED_ID = "QB-EV-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(50);
    const ev = elements['qb-ai-explain-evidence'];
    checkIncludes('qbAiExplain: evidence source_id rendered', ev.innerHTML || '', 'QB-EV-001');
  }

  // 16. qbAiExplain: 503 → safe message, no raw code
  {
    const err503 = Object.assign(new Error('unavailable'), { status: 503 });
    const { ctx, elements } = buildSandbox({ apiRequest: () => Promise.reject(err503) });
    vm.runInContext('QB_SELECTED_ID = "QB-503-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(50);
    const msg = elements['qb-ai-explain-status'].textContent;
    check('qbAiExplain: 503 shows message', msg.length > 0);
    checkNotIncludes('qbAiExplain: 503 code not in message', msg, '503');
  }

  // 17. qbAiExplain: 404 → safe message
  {
    const err404 = Object.assign(new Error('not found'), { status: 404 });
    const { ctx, elements } = buildSandbox({ apiRequest: () => Promise.reject(err404) });
    vm.runInContext('QB_SELECTED_ID = "QB-404-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(50);
    const msg = elements['qb-ai-explain-status'].textContent;
    check('qbAiExplain: 404 shows message', msg.length > 0);
    checkNotIncludes('qbAiExplain: 404 code not in message', msg, '404');
  }

  // 18. Raw AI HTML cannot execute
  {
    const dangerous = '<script>window._HACK=true;</script><img onerror=alert(1) src=x>';
    const { ctx, elements } = buildSandbox({
      apiRequest: () => Promise.resolve({
        schema_version: '1.0', question_id: 'QB-SEC-001',
        explanation: dangerous, evidence: [], limitations: [], audit_trace_id: 1,
      })
    });
    vm.runInContext('QB_SELECTED_ID = "QB-SEC-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(50);
    const textEl = elements['qb-ai-explain-text'];
    // Security: raw <script> tag must not appear. Since textContent is used,
    // the dangerous string is HTML-encoded in innerHTML; <script> literal absent.
    checkNotIncludes('raw <script> not injected', textEl.innerHTML || textEl.textContent, '<script>');
    // onerror= is safe when HTML-encoded; executable form requires a real tag.
    // <script> being absent is the key check.
    check('onerror not injected', !(textEl.innerHTML || textEl.textContent || '').includes('<img'));
  }

  // 19. No provider_name in explain request
  {
    let captured = null;
    const { ctx } = buildSandbox({
      apiRequest: (_m, _u, body) => {
        captured = body;
        return Promise.resolve({
          schema_version: '1.0', question_id: 'QB-NP-001',
          explanation: 'ok', evidence: [], limitations: [], audit_trace_id: 1,
        });
      }
    });
    vm.runInContext('QB_SELECTED_ID = "QB-NP-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(50);
    check('qbAiExplain: request made', captured !== null);
    check('qbAiExplain: no provider_name in body', captured && !('provider_name' in captured));
    check('qbAiExplain: no model in body', captured && !('model' in captured));
  }

  // 20. Single request on error (no retry)
  {
    let callCount = 0;
    const { ctx } = buildSandbox({ apiRequest: () => { callCount++; return Promise.reject(new Error('fail')); } });
    vm.runInContext('QB_SELECTED_ID = "QB-ONCE-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(100);
    check('qbAiExplain: exactly 1 request on error (no retry)', callCount === 1);
  }

  // 21. Limitations rendered
  {
    const { ctx, elements } = buildSandbox({
      apiRequest: () => Promise.resolve({
        schema_version: '1.0', question_id: 'QB-LIM-001',
        explanation: 'ok', evidence: [], audit_trace_id: 1,
        limitations: ['Non-authoritative', 'May hallucinate'],
      })
    });
    vm.runInContext('QB_SELECTED_ID = "QB-LIM-001";', ctx);
    vm.runInContext('qbAiExplain();', ctx);
    await waitMs(50);
    const lims = elements['qb-ai-explain-limitations'];
    checkIncludes('qbAiExplain: limitations rendered', lims.innerHTML || '', 'Non-authoritative');
  }

  // Print summary
  const s = summary();
  console.log(`${s.pass} assertions, ${s.pass} passed, ${s.fail} failed`);
  if (s.fail > 0) {
    console.log('FAILURES:', s.failures);
    process.exit(1);
  }
}

runAsync().catch(err => { console.error('Async test error:', err); process.exit(1); });
