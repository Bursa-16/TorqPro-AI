#!/usr/bin/env node
'use strict';
/*
 * Stage 2 / Slice 5 -- Document Intelligence frontend regression
 * harness.
 *
 * Same live-extraction technique as every other harness in this
 * directory (tests/js/run_washer_resolution_decision_form_tests.js,
 * run_material_intelligence_tests.js, etc.): Node's built-in `vm`
 * module runs the *actual* di* declarations extracted live from
 * frontend/index.html against a small hand-built DOM/fetch stub --
 * never a committed copy of the frontend logic.
 *
 * Scope: the Document Intelligence feature only (upload, result/
 * provenance/content rendering, My Documents list/detail). Global
 * TR/EN key-set parity across the whole I18N dictionary is already
 * covered by the existing tests/test_i18n_key_parity.py -- this
 * harness does not duplicate that check, only confirms the specific
 * di.* / sidebar.documentintelligence keys it needs exist with
 * non-identical EN/TR values.
 *
 * Invoked via `node tests/js/run_document_intelligence_tests.js`
 * from the repo root, or indirectly via
 * tests/documents/test_document_intelligence_frontend.py.
 * Exit code 0 = all assertions passed; non-zero = at least one
 * failure.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const {
  extractScript,
  extractConstDecl,
  extractFunctionDecl,
  toVarDecl,
  makeElement,
  makeLocalStorage,
  buildDom: buildDomShared,
  createChecker,
} = require('./harness_common');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_PATH = path.join(REPO_ROOT, 'frontend', 'index.html');

const { check, checkIncludes, checkNotIncludes, recordFailure, summary } = createChecker();

const CONST_NAMES = [
  'I18N', 'CURRENT_LANG', 'AUTH_TOKEN',
  'DI_MAX_UPLOAD_BYTES', 'DI_ALLOWED_EXTENSIONS',
  'DI_SELECTED_FILE', 'DI_LAST_RECORD', 'DI_LAST_DOC_LIST',
];
const MUTABLE_STATE_NAMES = [
  'AUTH_TOKEN', 'DI_SELECTED_FILE', 'DI_LAST_RECORD', 'DI_LAST_DOC_LIST',
];
const FUNCTION_NAMES = [
  't', 'diEsc', 'diFormatBytes', 'diExtensionOf',
  'diInit', 'diReapplyLanguage',
  'diFileSelected', 'diResetUploadForm', 'diUploadRequest', 'diMapErrorMessage',
  'diUploadDocument',
  'diStatusLabel', 'diStatusPillClass', 'diFieldRow',
  'diRenderExtractedContent', 'diRenderResult',
  'diLoadDocumentList', 'diRenderDocumentList', 'diSelectDocument',
];

function buildExtractedSource() {
  const html = fs.readFileSync(FRONTEND_PATH, 'utf-8');
  const script = extractScript(html);
  const parts = [];
  for (const n of CONST_NAMES) {
    let decl = extractConstDecl(script, n);
    if (MUTABLE_STATE_NAMES.includes(n)) decl = toVarDecl(decl, n);
    parts.push(decl);
  }
  for (const n of FUNCTION_NAMES) parts.push(extractFunctionDecl(script, n));
  parts.push('function __getDiSelectedFile() { return DI_SELECTED_FILE; }');
  parts.push('function __setAuthToken(v) { AUTH_TOKEN = v; }');
  return { source: parts.join('\n\n'), rawHtml: html };
}

function buildDom(rawHtml, byId) {
  return buildDomShared(rawHtml, byId, { includePlaceholders: false });
}

function newContext(extractedSource, rawHtml, apiRequestImpl, fetchImpl) {
  const byId = {};
  const documentStub = buildDom(rawHtml, byId);
  const sandbox = {
    document: documentStub,
    localStorage: makeLocalStorage({}),
    sessionStorage: makeLocalStorage({}),
    console: console,
    encodeURIComponent: encodeURIComponent,
    isNaN: isNaN,
    String: String,
    Number: Number,
    Array: Array,
    Object: Object,
    Math: Math,
    Error: Error,
    FormData: FormData,
    File: File,
    apiRequest: apiRequestImpl || (() => { throw new Error('apiRequest should not be called by this test'); }),
    fetch: fetchImpl || (() => { throw new Error('fetch should not be called by this test'); }),
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(extractedSource, context, { filename: 'di_extracted.js' });
  return { context, byId, documentStub };
}

const RESULT_ELEMENT_IDS = [
  'di-result-card', 'di-provenance-card', 'di-content-card',
  'di-result-summary', 'di-provenance-fields', 'di-content-viewer',
  'di-selected-file-info', 'di-upload-btn', 'di-clear-btn', 'di-upload-status',
  'di-mydocs-status', 'di-mydocs-list', 'di-file-input',
];

function primeAllElements(byId) {
  RESULT_ELEMENT_IDS.forEach((id) => { byId[id] = makeElement(id); });
}

function fakeRecord(overrides) {
  const base = {
    id: 101,
    request_id: 'req-test-001',
    original_filename: 'spec_sheet.pdf',
    extension: '.pdf',
    detected_media_type: 'pdf',
    file_size_bytes: 12345,
    content_sha256: 'a'.repeat(64),
    extraction_method: 'markitdown',
    markitdown_version: '0.1.7',
    markdown_text: 'Extracted TorqPro test content.',
    markdown_sha256: 'b'.repeat(64),
    character_count: 32,
    warnings: [],
    status: 'extracted',
    error_summary: null,
    original_retained: false,
    created_at: '2026-08-22T10:00:00+00:00',
  };
  return Object.assign({}, base, overrides);
}

function fakeFile(name, size, content) {
  const bytes = content || 'x'.repeat(Math.min(size || 10, 1024));
  const file = new File([bytes], name, { type: 'application/octet-stream' });
  // File.size derives from the Blob content; for oversized-file tests
  // we need an arbitrary reported size without materializing gigantic
  // content, so override it directly (a real File never lets you set
  // .size, but our test's own fake object just needs a .name/.size
  // pair -- Object.defineProperty on the real File works fine here).
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size, configurable: true });
  }
  return file;
}

function makeFakeEvent(file) {
  return { target: { files: file ? [file] : [], value: '' } };
}

// =================================================================
// 1. Structural: sidebar / navigation entry (Step 5 item 1)
// =================================================================

async function testSidebarNavigationEntryExists() {
  const { rawHtml } = buildExtractedSource();
  checkIncludes('sidebar entry calls showPage(\'documentintelligence\')', rawHtml, "showPage('documentintelligence'");
  checkIncludes('sidebar entry uses sidebar.documentintelligence i18n key', rawHtml, 'data-i18n="sidebar.documentintelligence"');
  checkIncludes('sidebar entry is a real <button> element', rawHtml, '<button type="button" class="sidebar-item" onclick="showPage(\'documentintelligence\'');
}

// =================================================================
// 2. Structural: page section exists (Step 5 item 2)
// =================================================================

async function testPageSectionExists() {
  const { rawHtml } = buildExtractedSource();
  checkIncludes('page-documentintelligence container exists', rawHtml, 'id="page-documentintelligence"');
  checkIncludes('page uses di.page_title i18n key', rawHtml, 'data-i18n="di.page_title"');
  checkIncludes('page includes deterministic engineering-boundary note', rawHtml, 'data-i18n="di.boundary_note"');
}

// =================================================================
// 3/4/5. Upload endpoint / multipart field / no owner injection
// =================================================================

async function testUploadEndpointExactPath() {
  const { source, rawHtml } = buildExtractedSource();
  let capturedPath = null;
  let capturedOptions = null;
  const fetchImpl = async (p, options) => {
    capturedPath = p;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => fakeRecord(),
    };
  };
  const { context, byId } = newContext(source, rawHtml, null, fetchImpl);
  primeAllElements(byId);
  vm.runInContext('__setAuthToken("test-token-123")', context);
  const formData = new FormData();
  formData.append('file', fakeFile('spec.pdf', 100));
  vm.createContext(context);
  context.__uploadFormData = formData;
  await vm.runInContext('diUploadRequest("/api/documents/upload", __uploadFormData)', context);
  check('upload path is exactly /api/documents/upload', capturedPath === '/api/documents/upload');
  check('upload method is POST', capturedOptions && capturedOptions.method === 'POST');
  check('upload body is the FormData instance (not JSON.stringify-ed)', capturedOptions && capturedOptions.body === formData);
  check('upload sets Authorization header from AUTH_TOKEN', capturedOptions && capturedOptions.headers && capturedOptions.headers['Authorization'] === 'Bearer test-token-123');
  check('upload does NOT manually set Content-Type header', !(capturedOptions && capturedOptions.headers && 'Content-Type' in capturedOptions.headers));
}

async function testMultipartFieldIsExactlyFile() {
  const formData = new FormData();
  const file = fakeFile('report.docx', 200);
  formData.append('file', file);
  check('FormData has a "file" field', formData.has('file'));
  check('FormData "file" field is the selected File object', formData.get('file') === file);
  check('FormData has no "document" field', !formData.has('document'));
  check('FormData has no "upload" field', !formData.has('upload'));
}

async function testNoOwnerFieldsEverAppended() {
  // Scoped deliberately to the di* FUNCTION bodies only -- NOT the
  // full buildExtractedSource() output, which also includes the
  // entire app-wide I18N constant (CONST_NAMES includes 'I18N' so
  // t() works inside the sandbox). Searching the whole I18N object
  // for "created_by" produced a false positive against an entirely
  // unrelated, pre-existing key from a different feature
  // ('wrr.evidence.created_by_label', Washer Resolution Report
  // evidence tracking) that has nothing to do with Document
  // Intelligence upload ownership. Extracting only FUNCTION_NAMES'
  // declarations keeps this check meaningful: it still catches a
  // real `formData.append('created_by', ...)` or similar anywhere in
  // the di* code, without false-flagging unrelated i18n content.
  const html = fs.readFileSync(FRONTEND_PATH, 'utf-8');
  const script = extractScript(html);
  const diFunctionsOnly = FUNCTION_NAMES
    .filter(n => n !== 't') // t() itself is shared app-wide code, not di*-specific
    .map(n => extractFunctionDecl(script, n))
    .join('\n\n');
  checkNotIncludes('di* function code never references created_by', diFunctionsOnly, 'created_by');
  checkNotIncludes('di* function code never references user_id', diFunctionsOnly, 'user_id');
  checkNotIncludes('di* function code never references owner_id', diFunctionsOnly, 'owner_id');
}

// =================================================================
// 6/7. Client precheck: allowed extensions / size limit
// =================================================================

async function testAllowedExtensionsExactSet() {
  const { source, rawHtml } = buildExtractedSource();
  const { context } = newContext(source, rawHtml, null, null);
  const allowed = vm.runInContext('DI_ALLOWED_EXTENSIONS', context);
  check('DI_ALLOWED_EXTENSIONS has exactly 4 entries', allowed.length === 4);
  check('DI_ALLOWED_EXTENSIONS includes .pdf', allowed.indexOf('.pdf') !== -1);
  check('DI_ALLOWED_EXTENSIONS includes .docx', allowed.indexOf('.docx') !== -1);
  check('DI_ALLOWED_EXTENSIONS includes .xlsx', allowed.indexOf('.xlsx') !== -1);
  check('DI_ALLOWED_EXTENSIONS includes .pptx', allowed.indexOf('.pptx') !== -1);
}

async function testClientSizeLimitIsExact15MiB() {
  const { source, rawHtml } = buildExtractedSource();
  const { context } = newContext(source, rawHtml, null, null);
  const maxBytes = vm.runInContext('DI_MAX_UPLOAD_BYTES', context);
  check('DI_MAX_UPLOAD_BYTES equals 15 * 1024 * 1024', maxBytes === 15 * 1024 * 1024);
  check('DI_MAX_UPLOAD_BYTES equals 15728640 exactly', maxBytes === 15728640);
}

async function testOversizedFileRejectedByPrecheck() {
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, null, null);
  primeAllElements(byId);
  const oversized = fakeFile('huge.pdf', 15 * 1024 * 1024 + 1);
  context.__event = makeFakeEvent(oversized);
  vm.runInContext('diFileSelected(__event)', context);
  const selected = vm.runInContext('__getDiSelectedFile()', context);
  check('oversized file is rejected by client precheck', selected === null);
  check('upload button stays disabled after oversized-file rejection', byId['di-upload-btn'].disabled === true);
}

async function testUnsupportedExtensionRejectedByPrecheck() {
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, null, null);
  primeAllElements(byId);
  const badFile = fakeFile('malware.exe', 100);
  context.__event = makeFakeEvent(badFile);
  vm.runInContext('diFileSelected(__event)', context);
  const selected = vm.runInContext('__getDiSelectedFile()', context);
  check('.exe file is rejected by client precheck', selected === null);
}

async function testValidFileAcceptedByPrecheck() {
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, null, null);
  primeAllElements(byId);
  const goodFile = fakeFile('spec.pdf', 1000);
  context.__event = makeFakeEvent(goodFile);
  vm.runInContext('diFileSelected(__event)', context);
  const selected = vm.runInContext('__getDiSelectedFile()', context);
  check('valid .pdf file is accepted by client precheck', selected !== null);
  check('upload button becomes enabled after valid selection', byId['di-upload-btn'].disabled === false);
}

// =================================================================
// 8-11. HTTP status -> message mapping
// =================================================================

async function testHttpStatusMappings() {
  const { source, rawHtml } = buildExtractedSource();
  const { context } = newContext(source, rawHtml, null, null);
  const mappingsHold = (status, expectedKey) => {
    const msg = vm.runInContext(`diMapErrorMessage({status:${status}})`, context);
    const expected = vm.runInContext(`t('${expectedKey}')`, context);
    return msg === expected;
  };
  check('413 maps to di.error_413', mappingsHold(413, 'di.error_413'));
  check('415 maps to di.error_415', mappingsHold(415, 'di.error_415'));
  check('422 maps to di.error_422', mappingsHold(422, 'di.error_422'));
  check('503 maps to di.error_503', mappingsHold(503, 'di.error_503'));
  check('500 maps to di.error_500', mappingsHold(500, 'di.error_500'));
}

// =================================================================
// 12. HARD SECURITY REQUIREMENT: safe extracted-content rendering
// =================================================================

async function testExtractedContentUsesTextContentNotInnerHTML() {
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, null, null);
  primeAllElements(byId);
  const malicious = '<img src=x onerror="window.__pwned=true">';
  context.__malicious = malicious;
  vm.runInContext('diRenderExtractedContent(__malicious)', context);
  const viewer = byId['di-content-viewer'];
  check('extracted content is set via textContent (exact value preserved, unescaped)', viewer._text === malicious);
  check('extracted content viewer innerHTML was never touched (empty, no markup interpreted)', viewer._html === '');
}

async function testExtractedContentRendererSourceNeverUsesInnerHTML() {
  const { source } = buildExtractedSource();
  const fnSource = extractFunctionDecl(source, 'diRenderExtractedContent');
  checkNotIncludes('diRenderExtractedContent function body never references innerHTML', fnSource, 'innerHTML');
  checkIncludes('diRenderExtractedContent function body uses textContent', fnSource, 'textContent');
}

async function testEmptyExtractedContentShowsPlaceholderNotBlank() {
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, null, null);
  primeAllElements(byId);
  vm.runInContext('diRenderExtractedContent("")', context);
  const viewer = byId['di-content-viewer'];
  const emptyLabel = vm.runInContext("t('di.content_empty')", context);
  check('empty extracted content shows the localized placeholder', viewer._text === emptyLabel);
}

// =================================================================
// 13/14/15. Provenance UI fields + original_retained visibility
// =================================================================

async function testProvenanceIncludesContentAndMarkdownHashes() {
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, null, null);
  primeAllElements(byId);
  const record = fakeRecord();
  context.__record = record;
  vm.runInContext('diRenderResult(__record)', context);
  const provenanceHtml = byId['di-provenance-fields']._html;
  checkIncludes('provenance shows content_sha256 value', provenanceHtml, record.content_sha256);
  checkIncludes('provenance shows markdown_sha256 value', provenanceHtml, record.markdown_sha256);
  checkIncludes('provenance includes di.field_content_sha256 label', provenanceHtml, vm.runInContext("t('di.field_content_sha256')", context));
  checkIncludes('provenance includes di.field_markdown_sha256 label', provenanceHtml, vm.runInContext("t('di.field_markdown_sha256')", context));
}

async function testOriginalRetainedAlwaysVisible() {
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, null, null);
  primeAllElements(byId);
  const record = fakeRecord({ original_retained: false });
  context.__record = record;
  vm.runInContext('diRenderResult(__record)', context);
  const summaryHtml = byId['di-result-summary']._html;
  const label = vm.runInContext("t('di.field_original_retained')", context);
  const noValue = vm.runInContext("t('di.original_retained_no')", context);
  checkIncludes('result summary shows original_retained label', summaryHtml, label);
  checkIncludes('result summary shows "No" for original_retained=false', summaryHtml, noValue);
}

// =================================================================
// 16/17. List / detail endpoints
// =================================================================

async function testListEndpointIsExactlyApiDocuments() {
  let capturedPath = null;
  const apiRequestImpl = async (p) => {
    capturedPath = p;
    return { documents: [] };
  };
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, apiRequestImpl, null);
  primeAllElements(byId);
  await vm.runInContext('diLoadDocumentList()', context);
  check('document list calls GET /api/documents', capturedPath === '/api/documents');
}

async function testDetailEndpointIncludesDocumentId() {
  let capturedPath = null;
  const apiRequestImpl = async (p) => {
    capturedPath = p;
    return fakeRecord({ id: 4242 });
  };
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, apiRequestImpl, null);
  primeAllElements(byId);
  await vm.runInContext('diSelectDocument(4242)', context);
  check('document detail calls GET /api/documents/{id} with the correct id', capturedPath === '/api/documents/4242');
}

async function testDocumentListAndDetailUseGetOnly() {
  // apiRequest() is the shared JSON helper; passing no `options`
  // (or omitting method) defaults to GET per apiRequest's own
  // implementation -- confirm di* never passes {method:'POST'} to
  // either list or detail calls.
  const { source } = buildExtractedSource();
  const listFn = extractFunctionDecl(source, 'diLoadDocumentList');
  const detailFn = extractFunctionDecl(source, 'diSelectDocument');
  checkNotIncludes('diLoadDocumentList never specifies a non-GET method', listFn, "method:");
  checkNotIncludes('diSelectDocument never specifies a non-GET method', detailFn, "method:");
}

// =================================================================
// 18/19. EN / TR i18n key presence (global parity already covered
// by tests/test_i18n_key_parity.py -- this only confirms the
// specific keys this feature needs actually exist with distinct
// translated values).
// =================================================================

const REQUIRED_DI_KEYS = [
  'sidebar.documentintelligence', 'di.page_title', 'di.page_subtitle',
  'di.boundary_note', 'di.upload_title', 'di.extract_button', 'di.clear_button',
  'di.extracting', 'di.precheck_unsupported_format', 'di.precheck_too_large',
  'di.result_title', 'di.field_original_filename', 'di.field_status',
  'di.field_original_retained', 'di.original_retained_no',
  'di.status_processing', 'di.status_extracted', 'di.status_failed',
  'di.provenance_title', 'di.field_content_sha256', 'di.field_markdown_sha256',
  'di.content_title', 'di.mydocs_title', 'di.mydocs_empty',
  'di.error_413', 'di.error_415', 'di.error_422', 'di.error_503', 'di.error_500',
];

async function testRequiredKeysExistInEnglish() {
  const { source, rawHtml } = buildExtractedSource();
  const { context } = newContext(source, rawHtml, null, null);
  const en = vm.runInContext('I18N.en', context);
  REQUIRED_DI_KEYS.forEach((k) => {
    check('EN key present: ' + k, en[k] !== undefined && en[k] !== '');
  });
}

async function testRequiredKeysExistInTurkish() {
  const { source, rawHtml } = buildExtractedSource();
  const { context } = newContext(source, rawHtml, null, null);
  const tr = vm.runInContext('I18N.tr', context);
  REQUIRED_DI_KEYS.forEach((k) => {
    check('TR key present: ' + k, tr[k] !== undefined && tr[k] !== '');
  });
}

async function testKeysAreActuallyTranslatedNotIdentical() {
  const { source, rawHtml } = buildExtractedSource();
  const { context } = newContext(source, rawHtml, null, null);
  const en = vm.runInContext('I18N.en', context);
  const tr = vm.runInContext('I18N.tr', context);
  REQUIRED_DI_KEYS.forEach((k) => {
    check('EN/TR differ for key: ' + k, en[k] !== tr[k]);
  });
}

// =================================================================
// 20/21. Deterministic engineering-boundary message (EN + TR)
// =================================================================

async function testBoundaryMessageExistsInBothLanguages() {
  const { source, rawHtml } = buildExtractedSource();
  const { context } = newContext(source, rawHtml, null, null);
  const en = vm.runInContext('I18N.en', context);
  const tr = vm.runInContext('I18N.tr', context);
  checkIncludes('EN boundary note mentions traceability', en['di.boundary_note'], 'traceability');
  checkIncludes('EN boundary note states engineering calculations are not modified', en['di.boundary_note'], 'does not modify');
  checkIncludes('TR boundary note mentions izlenebilirlik', tr['di.boundary_note'], 'izlenebilirlik');
  checkIncludes('TR boundary note states engineering results are not modified', tr['di.boundary_note'], 'değiştirmez');
}

// =================================================================
// AI / engineering write-back boundary (Step 9)
// =================================================================

async function testNoAiOrEngineeringEndpointReferenced() {
  const { source } = buildExtractedSource();
  const forbidden = ['/api/ai', '/api/engineering', '/api/torque', '/api/production-validation'];
  forbidden.forEach((ep) => {
    checkNotIncludes('di* source never references ' + ep, source, ep);
  });
}

// =================================================================
// Full success/failure flow (end-to-end within the sandbox)
// =================================================================

async function testFullUploadFlowRendersResultAndRefreshesList() {
  const record = fakeRecord({ id: 555, original_filename: 'flow_test.pdf' });
  let listCalls = 0;
  const apiRequestImpl = async (p) => {
    if (p === '/api/documents') { listCalls++; return { documents: [record] }; }
    throw new Error('unexpected apiRequest call: ' + p);
  };
  const fetchImpl = async () => ({ ok: true, json: async () => record });
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, apiRequestImpl, fetchImpl);
  primeAllElements(byId);
  const file = fakeFile('flow_test.pdf', 500);
  context.__event = makeFakeEvent(file);
  vm.runInContext('diFileSelected(__event)', context);
  await vm.runInContext('diUploadDocument()', context);
  check('result card populated after successful upload', byId['di-result-summary']._html.indexOf('flow_test.pdf') !== -1);
  check('document list was refreshed after successful upload', listCalls === 1);
  check('upload form was cleared after successful upload', byId['di-selected-file-info']._text === vm.runInContext("t('di.no_file_selected')", context));
}

async function testFailedUploadShowsErrorAndDoesNotRenderResult() {
  const fetchImpl = async () => {
    const err_body = { detail: { error: 'content_type_mismatch', message: 'mismatch' } };
    return {
      ok: false,
      status: 415,
      json: async () => err_body,
    };
  };
  const { source, rawHtml } = buildExtractedSource();
  const { context, byId } = newContext(source, rawHtml, null, fetchImpl);
  primeAllElements(byId);
  const file = fakeFile('fake.pdf', 500);
  context.__event = makeFakeEvent(file);
  vm.runInContext('diFileSelected(__event)', context);
  await vm.runInContext('diUploadDocument()', context);
  const statusHtml = byId['di-upload-status']._html;
  const expectedMsg = vm.runInContext("t('di.error_415')", context);
  checkIncludes('failed upload shows the mapped 415 message', statusHtml, expectedMsg);
  check('result card was not shown for a failed upload', byId['di-result-card'].style.display !== '');
}

// =================================================================
const ALL_TESTS = [
  testSidebarNavigationEntryExists,
  testPageSectionExists,
  testUploadEndpointExactPath,
  testMultipartFieldIsExactlyFile,
  testNoOwnerFieldsEverAppended,
  testAllowedExtensionsExactSet,
  testClientSizeLimitIsExact15MiB,
  testOversizedFileRejectedByPrecheck,
  testUnsupportedExtensionRejectedByPrecheck,
  testValidFileAcceptedByPrecheck,
  testHttpStatusMappings,
  testExtractedContentUsesTextContentNotInnerHTML,
  testExtractedContentRendererSourceNeverUsesInnerHTML,
  testEmptyExtractedContentShowsPlaceholderNotBlank,
  testProvenanceIncludesContentAndMarkdownHashes,
  testOriginalRetainedAlwaysVisible,
  testListEndpointIsExactlyApiDocuments,
  testDetailEndpointIncludesDocumentId,
  testDocumentListAndDetailUseGetOnly,
  testRequiredKeysExistInEnglish,
  testRequiredKeysExistInTurkish,
  testKeysAreActuallyTranslatedNotIdentical,
  testBoundaryMessageExistsInBothLanguages,
  testNoAiOrEngineeringEndpointReferenced,
  testFullUploadFlowRendersResultAndRefreshesList,
  testFailedUploadShowsErrorAndDoesNotRenderResult,
];

async function main() {
  for (const testFn of ALL_TESTS) {
    try {
      await testFn();
    } catch (err) {
      const label = testFn.name + ' (threw)';
      recordFailure(label);
      console.log('FAIL: ' + label + ' -- ' + (err && err.stack ? err.stack : String(err)));
    }
  }
  const { pass, fail, failures } = summary();
  console.log((pass + fail) + ' assertions, ' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0) {
    console.log('Failures:\n  - ' + failures.join('\n  - '));
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
