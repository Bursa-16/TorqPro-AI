#!/usr/bin/env node
'use strict';
/*
 * Faz 3.2.0B -- AI Provider Status UI frontend regression harness.
 *
 * Zero external dependencies. Uses Node's built-in `vm` module to
 * extract and run the actual provider status declarations from
 * frontend/index.html, following the exact same technique as
 * tests/js/run_assembly_intelligence_tests.js (Faz 2.8.6).
 *
 * Exports used from harness_common.js:
 *   extractScript, extractConstDecl, extractFunctionDecl,
 *   toVarDecl, makeElement, makeLocalStorage, buildDom, createChecker
 *
 * NOT used: extractI18nBlocks, makeDocument (not exported by
 *   harness_common.js). I18n keys are read directly from the raw HTML.
 *
 * Exit 0 = all assertions pass. Non-zero = at least one failure.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const {
  extractScript,
  extractConstDecl,
  extractFunctionDecl,
  toVarDecl,
  makeElement,
  makeLocalStorage,
  buildDom,
  createChecker,
} = require('./harness_common.js');

const REPO_ROOT     = path.resolve(__dirname, '..', '..');
const FRONTEND_PATH = path.join(REPO_ROOT, 'frontend', 'index.html');

const rawHtml = fs.readFileSync(FRONTEND_PATH, 'utf-8');
const script  = extractScript(rawHtml);

const { check, checkIncludes, checkNotIncludes, summary } = createChecker();

// ── i18n key extraction ───────────────────────────────────────────────────────
// Read both language tables directly from the raw HTML using the same
// ── i18n key extraction ───────────────────────────────────────────────────────
// Separate EN/TR blocks by unique anchor phrases.
const _EN_ANCHOR = "'sidebar.assemblyintelligence': 'Assembly Intelligence'";
const _TR_ANCHOR = "'sidebar.assemblyintelligence': 'Montaj Zek\u00e2s\u0131'";
const _enStart = rawHtml.indexOf(_EN_ANCHOR);
const _trStart = rawHtml.indexOf(_TR_ANCHOR);
if (_enStart === -1 || _trStart === -1) throw new Error('i18n anchors not found');

function extractProviderKeys(block) {
  const result = {};
  const re = /'(ai\.provider\.[\w.]+)':\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(block))) result[m[1]] = m[2];
  return result;
}

const enKeys = extractProviderKeys(rawHtml.slice(_enStart, _trStart));
const trKeys = extractProviderKeys(rawHtml.slice(_trStart));

// ── constants and functions extracted from frontend/index.html ─────────────────
const CONST_NAMES = ['I18N', 'CURRENT_LANG', 'AI_REQUEST_IN_FLIGHT'];
const FUNCTION_NAMES = [
  't', 'aiEsc',
  'loadProviderStatus', 'renderProviderStatus', '_providerStatusLabel',
];

function buildExtractedSource() {
  const parts = [];
  for (const n of CONST_NAMES) {
    let decl = extractConstDecl(script, n);
    if (n === 'AI_REQUEST_IN_FLIGHT') decl = toVarDecl(decl, n);
    parts.push(decl);
    if (n === 'CURRENT_LANG') {
      // include the fallback guard that immediately follows
      const fallback = /if\s*\(!I18N\[CURRENT_LANG\]\)\s*CURRENT_LANG\s*=\s*'tr';/;
      const m = fallback.exec(script);
      if (m) parts.push(m[0]);
    }
  }
  // _AI_PROVIDER_PILL is a const, not a function
  parts.push(extractConstDecl(script, '_AI_PROVIDER_PILL'));
  for (const n of FUNCTION_NAMES) parts.push(extractFunctionDecl(script, n));
  return parts.join('\n\n');
}

const EXTRACTED = buildExtractedSource();

// ── sandbox factory ───────────────────────────────────────────────────────────
function newContext(apiRequestImpl, byIdSeed) {
  const byId = Object.assign({
    'ai-provider-status-body': makeElement('ai-provider-status-body'),
    'ai-provider-refresh-btn': makeElement('ai-provider-refresh-btn'),
  }, byIdSeed || {});

  const documentStub = buildDom(rawHtml, byId);

  let capturedApiPath = null;
  let apiCallCount    = 0;
  const wrappedApiRequest = function(p, opts) {
    capturedApiPath = p;
    apiCallCount++;
    return (apiRequestImpl || (() => { throw new Error('unexpected apiRequest'); }))(p, opts);
  };

  const sandbox = {
    document: documentStub,
    localStorage:   makeLocalStorage({}),
    sessionStorage: makeLocalStorage({}),
    console:        console,
    apiRequest:     wrappedApiRequest,
    AUTH_TOKEN:     'test-token',
    // expose captured state for assertions
    __getApiPath()  { return capturedApiPath; },
    __getApiCount() { return apiCallCount; },
  };

  vm.createContext(sandbox);
  vm.runInContext(EXTRACTED, sandbox, { filename: 'provider_status_extracted.js' });
  return sandbox;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fakeProviders(overrides) {
  return [Object.assign({
    name: 'deterministic', model_identifier: '\u2014',
    available: true, readiness_status: 'not_applicable',
  }, overrides)];
}

function bodyHtml(ctx) {
  return ctx.document.getElementById('ai-provider-status-body').innerHTML;
}

// ── TEST 1: loadProviderStatus calls apiRequest('/api/ai/providers') ──────────
(async function testUsesApiRequest() {
  const ctx = newContext(async () => ({ providers: fakeProviders() }));
  await ctx.loadProviderStatus();
  check('loadProviderStatus calls apiRequest', ctx.__getApiPath() === '/api/ai/providers');
  check('apiRequest called exactly once on load', ctx.__getApiCount() === 1);
})().catch(e => { check('TEST 1 threw: ' + e.message, false); });

// ── TEST 2: model_ready → pill-ok ─────────────────────────────────────────────
(async function testModelReadyPillOk() {
  const ctx = newContext(async () => ({
    providers: fakeProviders({ name: 'ollama', readiness_status: 'model_ready' }),
  }));
  await ctx.loadProviderStatus();
  checkIncludes('model_ready renders pill-ok', bodyHtml(ctx), 'pill-ok');
  checkNotIncludes('model_ready does NOT render pill-nok', bodyHtml(ctx), 'pill-nok');
})().catch(e => { check('TEST 2 threw: ' + e.message, false); });

// ── TEST 3: model_missing → pill-warn ─────────────────────────────────────────
(async function testModelMissingPillWarn() {
  const ctx = newContext(async () => ({
    providers: fakeProviders({ name: 'ollama', readiness_status: 'model_missing' }),
  }));
  await ctx.loadProviderStatus();
  checkIncludes('model_missing renders pill-warn', bodyHtml(ctx), 'pill-warn');
})().catch(e => { check('TEST 3 threw: ' + e.message, false); });

// ── TEST 4: server_reachable → pill-warn ──────────────────────────────────────
(async function testServerReachablePillWarn() {
  const ctx = newContext(async () => ({
    providers: fakeProviders({ name: 'ollama', readiness_status: 'server_reachable' }),
  }));
  await ctx.loadProviderStatus();
  checkIncludes('server_reachable renders pill-warn', bodyHtml(ctx), 'pill-warn');
})().catch(e => { check('TEST 4 threw: ' + e.message, false); });

// ── TEST 5: server_unavailable → pill-nok ─────────────────────────────────────
(async function testServerUnavailablePillNok() {
  const ctx = newContext(async () => ({
    providers: fakeProviders({ name: 'ollama', readiness_status: 'server_unavailable' }),
  }));
  await ctx.loadProviderStatus();
  checkIncludes('server_unavailable renders pill-nok', bodyHtml(ctx), 'pill-nok');
})().catch(e => { check('TEST 5 threw: ' + e.message, false); });

// ── TEST 6: enabled → pill-ok ─────────────────────────────────────────────────
(async function testEnabledPillOk() {
  const ctx = newContext(async () => ({
    providers: fakeProviders({ name: 'anthropic', readiness_status: 'enabled' }),
  }));
  await ctx.loadProviderStatus();
  checkIncludes('enabled renders pill-ok', bodyHtml(ctx), 'pill-ok');
})().catch(e => { check('TEST 6 threw: ' + e.message, false); });

// ── TEST 7: disabled → pill-info ──────────────────────────────────────────────
(async function testDisabledPillInfo() {
  const ctx = newContext(async () => ({
    providers: fakeProviders({ name: 'anthropic', readiness_status: 'disabled' }),
  }));
  await ctx.loadProviderStatus();
  checkIncludes('disabled renders pill-info', bodyHtml(ctx), 'pill-info');
})().catch(e => { check('TEST 7 threw: ' + e.message, false); });

// ── TEST 8: not_applicable → pill-info ────────────────────────────────────────
(async function testNotApplicablePillInfo() {
  const ctx = newContext(async () => ({
    providers: fakeProviders({ readiness_status: 'not_applicable' }),
  }));
  await ctx.loadProviderStatus();
  checkIncludes('not_applicable renders pill-info', bodyHtml(ctx), 'pill-info');
})().catch(e => { check('TEST 8 threw: ' + e.message, false); });

// ── TEST 9: unknown/future status → pill-info ─────────────────────────────────
(async function testUnknownPillInfo() {
  const ctx = newContext(async () => ({
    providers: fakeProviders({ readiness_status: 'future_status_xyz' }),
  }));
  await ctx.loadProviderStatus();
  // Default pill class is pill-info for unmapped statuses
  checkIncludes('unknown status renders pill-info', bodyHtml(ctx), 'pill-info');
})().catch(e => { check('TEST 9 threw: ' + e.message, false); });

// ── TEST 10: only deterministic → no_optional note shown ──────────────────────
(async function testOnlyDeterministicShowsNoOptional() {
  const ctx = newContext(async () => ({
    providers: [{ name: 'deterministic', model_identifier: '\u2014',
                  available: true, readiness_status: 'not_applicable' }],
  }));
  await ctx.loadProviderStatus();
  checkIncludes('only deterministic shows no_optional note',
    bodyHtml(ctx), 'ai-provider-no-optional');
})().catch(e => { check('TEST 10 threw: ' + e.message, false); });

// ── TEST 11: mixed providers → no no_optional note ────────────────────────────
(async function testMixedProvidersNoOptionalHidden() {
  const ctx = newContext(async () => ({
    providers: [
      { name: 'deterministic', model_identifier: '\u2014', available: true, readiness_status: 'not_applicable' },
      { name: 'ollama', model_identifier: 'qwen3:8b', available: true, readiness_status: 'model_ready' },
    ],
  }));
  await ctx.loadProviderStatus();
  checkNotIncludes('mixed providers hide no_optional note',
    bodyHtml(ctx), 'ai-provider-no-optional');
})().catch(e => { check('TEST 11 threw: ' + e.message, false); });

// ── TEST 12: API failure → error isolated in card ─────────────────────────────
(async function testApiErrorIsolated() {
  const ctx = newContext(async () => { throw new Error('network error'); });
  await ctx.loadProviderStatus();
  checkIncludes('API error renders error indicator', bodyHtml(ctx), 'alert-danger');
  checkNotIncludes('API error does not expose "undefined"', bodyHtml(ctx), 'undefined');
})().catch(e => { check('TEST 12 threw: ' + e.message, false); });

// ── TEST 13: HTML injection protection ────────────────────────────────────────
(async function testHtmlInjectionProtected() {
  const malicious = '<img src=x onerror=alert(1)>';
  const ctx = newContext(async () => ({
    providers: [{
      name: malicious, model_identifier: malicious,
      available: true, readiness_status: 'model_ready',
    }],
  }));
  await ctx.loadProviderStatus();
  const html = bodyHtml(ctx);
  // aiEsc encodes < as &lt; and > as &gt;, so <img src=x onerror=alert(1)>
  // becomes &lt;img src=x onerror=alert(1)&gt; -- no executable tag is injected.
  // The correct test: no literal opening angle bracket before 'img'.
  checkNotIncludes('provider name: no literal <img tag (injection blocked)', html, '<img ');
  checkNotIncludes('provider name: no literal </table> injection', html, '</table><');
  checkNotIncludes('model: no literal <img tag (injection blocked)', html, '<img ');
})().catch(e => { check('TEST 13 threw: ' + e.message, false); });

// ── TEST 14: Refresh button does not submit as form ──────────────────────────
(function testRefreshButtonTypeIsButton() {
  const idx = rawHtml.indexOf('id="ai-provider-refresh-btn"');
  check('refresh button found in HTML', idx !== -1);
  if (idx !== -1) {
    const btnStart = rawHtml.lastIndexOf('<button', idx);
    const btnBlock = rawHtml.slice(btnStart, idx + 200);
    checkIncludes('refresh button has type="button"', btnBlock, 'type="button"');
  }
})();

// ── TEST 15: role="status" on status body ─────────────────────────────────────
(function testRoleStatus() {
  checkIncludes('ai-provider-status-body has role="status"', rawHtml, 'id="ai-provider-status-body" role="status"');
})();

// ── TEST 16: aria-live="polite" on status body ───────────────────────────────
(function testAriaLivePolite() {
  checkIncludes('ai-provider-status-body has aria-live="polite"', rawHtml, 'aria-live="polite"');
})();

// ── TEST 17: apiRequest used, fetch() not called directly ─────────────────────
(function testNoDirectFetch() {
  // Extract only our provider status block (between markers).
  const start = rawHtml.indexOf('// ---- AI Provider Status (Faz 3.2.0B)');
  const end   = rawHtml.indexOf('// ---- End AI Provider Status');
  check('provider status block markers found', start !== -1 && end !== -1);
  if (start !== -1 && end !== -1) {
    const block = rawHtml.slice(start, end);
    // Strip single-line comments to avoid false positives from 'Fetches...' in comments
    const codeOnly = block.replace(/\/\/[^\n]*/g, '');
    checkIncludes('apiRequest called in provider status block', block, 'apiRequest(');
    checkNotIncludes('fetch() NOT called directly in provider status code', codeOnly, 'fetch(');
  }
})();

// ── TEST 18: TR/EN 17-key parity ─────────────────────────────────────────────
(function testI18nKeyParity() {
  const required = [
    'ai.provider.card_title',
    'ai.provider.card_sub',
    'ai.provider.name',
    'ai.provider.model',
    'ai.provider.status',
    'ai.provider.refresh',
    'ai.provider.loading',
    'ai.provider.no_optional',
    'ai.provider.request_failed',
    'ai.provider.status_not_applicable',
    'ai.provider.status_enabled',
    'ai.provider.status_disabled',
    'ai.provider.status_server_unavailable',
    'ai.provider.status_server_reachable',
    'ai.provider.status_model_missing',
    'ai.provider.status_model_ready',
    'ai.provider.status_unknown',
  ];
  for (const key of required) {
    check('EN has key: ' + key, key in enKeys);
    check('TR has key: ' + key, key in trKeys);
    if ((key in enKeys) && (key in trKeys)) {
      // 'model' is intentionally identical in EN and TR ('Model').
      // Skip the EN!=TR check for universally identical technical terms.
      const identicalByDesign = ['ai.provider.model'];
      if (!identicalByDesign.includes(key)) {
        check('EN != TR for: ' + key, enKeys[key] !== trKeys[key]);
      }
    }
  }
})();

// ── summary ───────────────────────────────────────────────────────────────────
setTimeout(function() {
  const { pass, fail, failures } = summary();
  console.log('\nAI Provider Status Tests: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) {
    failures.forEach(f => console.error('  FAIL: ' + f));
    process.exit(1);
  }
  process.exit(0);
}, 400);
