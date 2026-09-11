# General File Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure Ask LeadIntel workflow that analyzes one Word, Excel, PDF, CSV or PowerPoint file, preserves the original, cites source locations, saves results and exports business documents.

**Architecture:** The browser validates and extracts structured, locator-aware content through isolated format adapters. The Cloudflare Worker stores immutable originals in private R2, persists metadata/results in D1, selects bounded relevant blocks and invokes the configured AI provider under a strict JSON contract. The Copilot UI renders canonical result JSON and generates downloads without injecting model HTML.

**Tech Stack:** Vanilla ES modules, PDF.js, Mammoth, SheetJS, JSZip, PptxGenJS, docx, jsPDF, Cloudflare Workers, D1, R2, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-11-general-file-analysis-design.md`

## Global Constraints

- Accept one file per analysis.
- Accept `.pdf`, `.docx`, `.xlsx`, `.xls`, `.csv` and `.pptx`; reject legacy `.doc` and `.ppt`.
- Maximum original size is 15 MB.
- Maximum request length is 8,000 characters.
- Maximum normalized extraction is 250,000 characters, 50,000 non-empty spreadsheet cells or 20,000 CSV rows.
- Maximum result length is 30,000 characters.
- Preserve the unchanged original as a private, immutable R2 object.
- Unretained files expire after 24 hours; retained analyses remain until deletion.
- Never execute document content or treat it as instructions.
- Never display a completed state after extraction or AI failure.
- Existing customer-list Excel/CSV intelligence remains separate and unchanged.
- Every production change follows red-green TDD and receives a focused commit.

---

## File map

**Create**

- `customer/copilot-general-file-analysis.js` — UI controller and state machine.
- `customer/copilot-file-contract.js` — validation, limits and canonical extraction/result shapes.
- `customer/copilot-file-extractors.js` — adapter registry and bounded extraction.
- `customer/copilot-file-downloads.js` — Word, PDF, PowerPoint, Excel and CSV generation.
- `customer/test/copilot-file-contract.test.mjs`
- `customer/test/copilot-file-extractors.test.mjs`
- `customer/test/copilot-general-file-analysis.test.mjs`
- `customer/test/copilot-file-downloads.test.mjs`
- `customer/test/fixtures/file-analysis/fixture.pdf`
- `customer/test/fixtures/file-analysis/fixture.docx`
- `customer/test/fixtures/file-analysis/fixture.xlsx`
- `customer/test/fixtures/file-analysis/fixture.xls`
- `customer/test/fixtures/file-analysis/fixture.csv`
- `customer/test/fixtures/file-analysis/fixture.pptx`
- `backend/migrations/0017_general_file_analysis.sql` — D1 file-analysis schema.
- `backend/src/copilot-file-store.js` — D1/R2 persistence and deletion.
- `backend/src/copilot-file-security.js` — upload signature, MIME, archive and limit enforcement.
- `backend/src/copilot-file-context.js` — locator-aware block selection and prompt-injection isolation.
- `backend/src/copilot-file-analysis-service.js` — AI contract, schema validation and one repair attempt.
- `backend/src/copilot-file-routes.js` — authenticated file-analysis endpoints.
- `backend/test/copilot-file-store.test.mjs`
- `backend/test/copilot-file-security.test.mjs`
- `backend/test/copilot-file-context.test.mjs`
- `backend/test/copilot-file-analysis-service.test.mjs`
- `backend/test/copilot-file-routes.test.mjs`

**Modify**

- `customer/copilot-api.js` — file-analysis API methods.
- `customer/copilot-loader.js` — lazy-load the general analyzer.
- `customer/copilot-ui.js` — mount analyzer and render saved-analysis entry points.
- `customer/copilot.css` — responsive, accessible analyzer styles.
- `customer/process-map.js` — refresh nested asset versions.
- `customer/index.html` — refresh the process-map entry version.
- `backend/src/app.js` — route file-analysis requests and scheduled cleanup.
- `backend/wrangler.toml` — bind private `COPILOT_FILES` R2 bucket.
- `backend/package.json` — keep the existing full backend test command.
- `README.md` — operations, limits and deletion behavior.

### Task 1: File contract and validation

**Files:**
- Create: `customer/copilot-file-contract.js`
- Test: `customer/test/copilot-file-contract.test.mjs`

**Interfaces:**
- Produces: `validateCopilotFile(fileMeta) -> {ok, format, errors}`
- Produces: `normalizeExtraction(input) -> ExtractionDocument`
- Produces: `normalizeAnalysisResult(input) -> AnalysisResult`
- Produces: constants `FILE_LIMITS` and `SUPPORTED_FILE_FORMATS`

- [ ] **Step 1: Write failing contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILE_LIMITS,
  validateCopilotFile,
  normalizeAnalysisResult
} from '../copilot-file-contract.js';

test('accepts one safe supported file up to 15 MB', () => {
  const result=validateCopilotFile({
    name:'pipeline.xlsx',
    size:15*1024*1024,
    type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signature:'504b0304'
  });
  assert.equal(result.ok,true);
  assert.equal(result.format,'xlsx');
  assert.equal(FILE_LIMITS.maxFiles,1);
});

test('rejects legacy, oversized and macro-enabled files', () => {
  for(const file of [
    {name:'old.doc',size:10,type:'application/msword',signature:'d0cf11e0'},
    {name:'deck.pptm',size:10,type:'application/vnd.ms-powerpoint',signature:'504b0304'},
    {name:'large.pdf',size:15*1024*1024+1,type:'application/pdf',signature:'25504446'}
  ]) assert.equal(validateCopilotFile(file).ok,false);
});

test('normalizes canonical result and removes unknown keys', () => {
  const value=normalizeAnalysisResult({
    title:'Review',
    executive_summary:'Summary',
    sections:[],
    findings:[],
    recommendations:[],
    risks:[],
    assumptions:[],
    data_gaps:[],
    warnings:[],
    html:'<script>alert(1)</script>'
  });
  assert.equal(value.title,'Review');
  assert.equal('html' in value,false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test customer/test/copilot-file-contract.test.mjs`

Expected: FAIL because `copilot-file-contract.js` does not exist.

- [ ] **Step 3: Implement the minimal contract**

Implement frozen format metadata for PDF, DOCX, XLSX, XLS, CSV and PPTX; exact limits from Global Constraints; extension/MIME/signature consistency; filename sanitization; unknown-key removal; bounded strings and arrays. Return all validation errors without reading document contents.

- [ ] **Step 4: Run the focused test and full existing frontend tests**

Run:

```bash
node --test customer/test/copilot-file-contract.test.mjs
node --test customer/test/*.test.mjs
```

Expected: all tests PASS with zero warnings.

- [ ] **Step 5: Commit**

```bash
git add customer/copilot-file-contract.js customer/test/copilot-file-contract.test.mjs
git commit -m "feat: define secure Copilot file contracts"
```

### Task 2: Format extraction adapters

**Files:**
- Create: `customer/copilot-file-extractors.js`
- Create: `customer/test/copilot-file-extractors.test.mjs`
- Create: six fixtures under `customer/test/fixtures/file-analysis/`

**Interfaces:**
- Consumes: `normalizeExtraction`, `FILE_LIMITS`
- Produces: `extractCopilotFile(file, dependencies) -> Promise<ExtractionDocument>`
- Produces: `ExtractionDocument={format,title,blocks,evidenceIndex,warnings,coverage,counts}`

- [ ] **Step 1: Add deterministic fixtures and failing adapter tests**

Create small fixtures containing unique markers and test:

```js
for(const fixture of [
  ['fixture.pdf','page:2','PDF_MARKER'],
  ['fixture.docx','section:Commercial priorities','DOCX_MARKER'],
  ['fixture.xlsx','sheet:Pipeline!B3','XLSX_MARKER'],
  ['fixture.xls','sheet:Legacy!A2','XLS_MARKER'],
  ['fixture.csv','row:3','CSV_MARKER'],
  ['fixture.pptx','slide:2','PPTX_MARKER']
]){
  test(`extracts ${fixture[0]} with a stable locator`,async()=>{
    const file=await fixtureFile(fixture[0]);
    const result=await extractCopilotFile(file,testDependencies);
    assert.ok(result.blocks.some(block=>block.locator===fixture[1]));
    assert.ok(JSON.stringify(result).includes(fixture[2]));
  });
}
```

Add limit tests proving 50,001 cells, 20,001 CSV rows and 250,001 characters produce explicit omissions in `warnings` and `coverage`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test customer/test/copilot-file-extractors.test.mjs`

Expected: FAIL because `extractCopilotFile` is missing.

- [ ] **Step 3: Implement adapters behind one registry**

Use injected library dependencies so tests do not access CDNs. Emit:
- PDF blocks per page;
- DOCX blocks per heading, paragraph group and table;
- spreadsheet blocks per populated range with sheet name and cell address;
- CSV blocks per bounded row range after encoding and delimiter detection;
- PPTX blocks per slide, including notes when present.

Strip control characters, OOXML relationships that reference executables, formula payloads and embedded objects. Preserve displayed cell values; never evaluate formulas or macros.

- [ ] **Step 4: Verify focused and complete client suites**

Run:

```bash
node --test customer/test/copilot-file-extractors.test.mjs
node --test customer/test/*.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add customer/copilot-file-extractors.js customer/test/copilot-file-extractors.test.mjs customer/test/fixtures/file-analysis
git commit -m "feat: extract supported business files with evidence locators"
```

### Task 3: D1 schema and immutable R2 persistence

**Files:**
- Create: `backend/migrations/0017_general_file_analysis.sql`
- Create: `backend/src/copilot-file-store.js`
- Create: `backend/test/copilot-file-store.test.mjs`
- Modify: `backend/wrangler.toml`

**Interfaces:**
- Produces: `createFileRecord(env,input)`
- Produces: `putImmutableOriginal(env,{workspaceId,fileId,bytes,sha256})`
- Produces: `saveExtraction(env,input)`
- Produces: `createAnalysis(env,input)`, `retainAnalysis(env,id)`
- Produces: `deleteAnalysisTree(env,{workspaceId,analysisId})`
- Produces: `purgeExpiredUnretainedFiles(env,now)`

- [ ] **Step 1: Write failing store tests**

Use fake D1 and R2 bindings to prove:
- object key contains workspace ID and random file ID, never original filename;
- a second write to the same key is rejected;
- workspace A cannot read workspace B metadata;
- retain prevents 24-hour cleanup;
- deletion removes analysis rows, extraction, metadata and R2 object;
- repeated deletion succeeds without side effects.

- [ ] **Step 2: Run and verify RED**

Run: `cd backend && node --test test/copilot-file-store.test.mjs`

Expected: FAIL because store functions and schema do not exist.

- [ ] **Step 3: Add exact schema and store implementation**

Create the four tables and indexes defined by the spec. Add foreign keys with cascading deletion inside D1 transactions. Bind:

```toml
[[r2_buckets]]
binding = "COPILOT_FILES"
bucket_name = "leadintel-copilot-files"
preview_bucket_name = "leadintel-copilot-files-preview"
```

Store originals with `httpMetadata.contentType` and custom SHA-256 metadata. Reject overwrite when `head(key)` already exists.

- [ ] **Step 4: Apply local migration and run tests**

Run:

```bash
cd backend
npx wrangler d1 migrations apply leadintel --local
node --test test/copilot-file-store.test.mjs
npm test
```

Expected: migration succeeds and all backend tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/0017_general_file_analysis.sql backend/src/copilot-file-store.js backend/test/copilot-file-store.test.mjs backend/wrangler.toml
git commit -m "feat: persist immutable Copilot file analyses"
```

### Task 4: Upload security and authenticated routes

**Files:**
- Create: `backend/src/copilot-file-security.js`
- Create: `backend/src/copilot-file-routes.js`
- Create: `backend/test/copilot-file-security.test.mjs`
- Create: `backend/test/copilot-file-routes.test.mjs`
- Modify: `backend/src/app.js`

**Interfaces:**
- Consumes: Task 1 format rules mirrored as server constants; Task 3 store API.
- Produces: `validateUploadedFile({headers,bytes,name})`
- Produces: `handleCopilotFileRoute(request,env,cors)`

- [ ] **Step 1: Write failing security and route tests**

Cover unauthenticated 401, non-member 403, cross-workspace 403, unsupported 415, oversize 413, MIME/signature mismatch 422, archive traversal 422, embedded executable 422, duplicate digest reuse and valid 201 upload.

Assert response bodies never echo extracted content or credentials.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
cd backend
node --test test/copilot-file-security.test.mjs test/copilot-file-routes.test.mjs
```

Expected: FAIL because route/security modules do not exist.

- [ ] **Step 3: Implement validation and upload/list/get/save/delete routes**

Reuse the membership pattern from `copilot-routes.js`. Require multipart fields `file`, `extraction_json`, `sha256` and `extractor_version`. Recompute SHA-256 server-side, validate signature before R2 write, validate normalized extraction against limits and refuse unsupported keys.

Mount `handleCopilotFileRoute` before the generic Copilot route in `backend/src/app.js`.

- [ ] **Step 4: Run route tests and complete backend suite**

Run:

```bash
cd backend
node --test test/copilot-file-security.test.mjs test/copilot-file-routes.test.mjs
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/copilot-file-security.js backend/src/copilot-file-routes.js backend/src/app.js backend/test/copilot-file-security.test.mjs backend/test/copilot-file-routes.test.mjs
git commit -m "feat: add secure workspace-scoped file upload routes"
```

### Task 5: Evidence selection and AI analysis service

**Files:**
- Create: `backend/src/copilot-file-context.js`
- Create: `backend/src/copilot-file-analysis-service.js`
- Create: `backend/test/copilot-file-context.test.mjs`
- Create: `backend/test/copilot-file-analysis-service.test.mjs`
- Modify: `backend/src/copilot-file-routes.js`

**Interfaces:**
- Produces: `selectRelevantFileBlocks({request,extraction,maxChars})`
- Produces: `runFileAnalysis(env,{workspaceId,userId,file,extraction,request})`
- Produces: `continueFileAnalysis(env,{analysisId,message})`

- [ ] **Step 1: Write failing context and service tests**

Prove that block selection keeps request-relevant locators, respects 250,000 characters, preserves coverage warnings and treats document phrases such as “ignore previous instructions” as quoted source data.

Stub the existing provider abstraction with:
1. valid canonical JSON;
2. invalid output followed by valid repair;
3. two invalid outputs;
4. timeout;
5. claims citing nonexistent locators.

Expect case 2 to succeed, cases 3–5 to fail without a completed analysis.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
cd backend
node --test test/copilot-file-context.test.mjs test/copilot-file-analysis-service.test.mjs
```

Expected: FAIL because context/service exports do not exist.

- [ ] **Step 3: Implement bounded context and strict AI contract**

Use the existing encrypted workspace provider credential path. Build the prompt from:
- user request;
- immutable file metadata;
- extraction coverage;
- selected source blocks wrapped as untrusted document data;
- the canonical result schema.

Validate every evidence locator against `evidenceIndex`. Retry schema repair once. Persist provider/model/usage and canonical JSON only after successful validation.

Add POST analysis and follow-up message handlers to `copilot-file-routes.js`.

- [ ] **Step 4: Run focused and full backend tests**

Run:

```bash
cd backend
node --test test/copilot-file-context.test.mjs test/copilot-file-analysis-service.test.mjs test/copilot-file-routes.test.mjs
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/copilot-file-context.js backend/src/copilot-file-analysis-service.js backend/src/copilot-file-routes.js backend/test/copilot-file-context.test.mjs backend/test/copilot-file-analysis-service.test.mjs
git commit -m "feat: analyze files with bounded cited AI context"
```

### Task 6: Copilot API and analyzer UI

**Files:**
- Create: `customer/copilot-general-file-analysis.js`
- Create: `customer/test/copilot-general-file-analysis.test.mjs`
- Modify: `customer/copilot-api.js`
- Modify: `customer/copilot-loader.js`
- Modify: `customer/copilot-ui.js`
- Modify: `customer/copilot.css`

**Interfaces:**
- Consumes: Tasks 1–2 extractors and Tasks 4–5 endpoints.
- Produces: `installGeneralFileAnalysis({api})`
- Produces API methods `uploadCopilotFile`, `analyzeCopilotFile`, `continueCopilotFileAnalysis`, `listCopilotFileAnalyses`, `saveCopilotFileAnalysis`, `deleteCopilotFileAnalysis`

- [ ] **Step 1: Write failing UI state-machine tests**

Test transitions:
- empty → file selected → extracted → analyzing → ready;
- unsupported/oversized → rejected;
- partial extraction → confirmation required;
- extraction failure → error, not ready;
- AI failure → retryable error;
- save failure → visible unsaved state;
- delete confirmation → removed;
- changing the file clears the previous request/result;
- selecting a second file rejects it.

Use a real DOM test harness and injected extractor/API functions; assert accessible names and `aria-live` statuses.

- [ ] **Step 2: Run and verify RED**

Run: `node --test customer/test/copilot-general-file-analysis.test.mjs`

Expected: FAIL because the analyzer module does not exist.

- [ ] **Step 3: Implement API methods and state-machine UI**

Add **Analyze Any File** beside the specialized **Attach Excel / CSV** tool. Render one hidden file input with exact accept values, a request textarea, stage indicator, warnings, canonical result sections, evidence badges, history, save/delete/new-analysis actions and retry controls.

Do not place raw file bytes in localStorage. Revoke object URLs and clear ArrayBuffers after upload or cancellation. Render all model text through `textContent`.

- [ ] **Step 4: Run accessibility-focused and full client tests**

Run:

```bash
node --test customer/test/copilot-general-file-analysis.test.mjs
node --test customer/test/*.test.mjs
```

Expected: all tests PASS with no unhandled promise rejections.

- [ ] **Step 5: Commit**

```bash
git add customer/copilot-general-file-analysis.js customer/copilot-api.js customer/copilot-loader.js customer/copilot-ui.js customer/copilot.css customer/test/copilot-general-file-analysis.test.mjs
git commit -m "feat: add Ask LeadIntel general file analysis workflow"
```

### Task 7: Download generators

**Files:**
- Create: `customer/copilot-file-downloads.js`
- Create: `customer/test/copilot-file-downloads.test.mjs`
- Modify: `customer/copilot-general-file-analysis.js`

**Interfaces:**
- Consumes: canonical `AnalysisResult`.
- Produces: `availableDownloads(result) -> string[]`
- Produces: `generateAnalysisDownload({result,format,fileName,date,dependencies}) -> Promise<Blob>`

- [ ] **Step 1: Write failing generator tests**

For one canonical fixture, open generated DOCX, PDF, PPTX and XLSX artifacts and assert title, executive summary, findings, recommendations and evidence references exist. Assert CSV is offered only with a primary rectangular table and uses RFC 4180 escaping.

Assert filenames remove slashes, control characters and traversal sequences.

- [ ] **Step 2: Run and verify RED**

Run: `node --test customer/test/copilot-file-downloads.test.mjs`

Expected: FAIL because download exports do not exist.

- [ ] **Step 3: Implement format-specific generators**

Generate:
- DOCX with headings, tables and evidence footnotes;
- PDF with equivalent content and page breaks;
- PPTX with title, summary, bounded section slides, recommendations and sources;
- XLSX with Summary, Findings, Recommendations, Risks and extracted-table sheets;
- CSV only from the primary rectangular table.

Return Blob objects; the controller owns temporary download URLs and revokes them after use.

- [ ] **Step 4: Run artifact and full client tests**

Run:

```bash
node --test customer/test/copilot-file-downloads.test.mjs
node --test customer/test/*.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add customer/copilot-file-downloads.js customer/copilot-general-file-analysis.js customer/test/copilot-file-downloads.test.mjs
git commit -m "feat: export Copilot file analyses in business formats"
```

### Task 8: Expiry cleanup, feature flag and asset chain

**Files:**
- Modify: `backend/src/app.js`
- Modify: `customer/copilot-loader.js`
- Modify: `customer/process-map.js`
- Modify: `customer/index.html`
- Modify: `README.md`
- Test: `backend/test/copilot-file-store.test.mjs`
- Test: `customer/test/copilot-general-file-analysis.test.mjs`

**Interfaces:**
- Consumes: `purgeExpiredUnretainedFiles(env,now)`
- Produces: hourly cleanup and workspace feature-flag gating.

- [ ] **Step 1: Add failing cleanup, flag and cache-chain tests**

Assert hourly scheduling purges only unretained files older than 24 hours. Assert the analyzer is absent when `general_file_analysis` is false and present when true. Assert the HTML → process-map → Copilot loader → analyzer import chain uses one new release token at every nested edge.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
cd backend && node --test test/copilot-file-store.test.mjs
cd .. && node --test customer/test/copilot-general-file-analysis.test.mjs
```

Expected: FAIL because cleanup, gating and release tokens are not wired.

- [ ] **Step 3: Wire cleanup, gating and full cache invalidation**

Add cleanup to the existing hourly `scheduled` `Promise.allSettled` list. Return the workspace feature flag from Copilot bootstrap. Lazy-load the analyzer only when enabled. Update every nested static asset version through `customer/index.html`.

Document bucket provisioning, D1 migration, accepted formats, limits, retention and deletion commands in `README.md`.

- [ ] **Step 4: Run complete verification locally**

Run:

```bash
cd backend
npx wrangler d1 migrations apply leadintel --local
npm test
cd ..
node --test customer/test/*.test.mjs
npm run build
test ! -e .vercel-static/backend
test ! -e .vercel-static/docs
```

Expected: every command exits 0; the build contains customer runtime assets and excludes private source trees.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.js backend/test/copilot-file-store.test.mjs customer/copilot-loader.js customer/process-map.js customer/index.html customer/test/copilot-general-file-analysis.test.mjs README.md
git commit -m "feat: gate and operate general file analysis"
```

### Task 9: Preview integration and production rollout

**Files:**
- Modify only defects discovered by verification.
- Test: all client and backend suites.

**Interfaces:**
- Produces: verified preview, production migration, R2 binding and release provenance.

- [ ] **Step 1: Run the full clean verification suite**

Run the Task 8 verification block from a clean worktree. Expected: all commands exit 0.

- [ ] **Step 2: Open a pull request and verify preview**

Create the PR with the spec and plan linked. Verify the preview with each fixture:
- upload and extraction coverage;
- custom request;
- cited result;
- follow-up question;
- save and reload;
- all eligible downloads;
- deletion;
- customer-list importer unchanged;
- mobile drawer and keyboard navigation.

Record exact preview deployment ID and commit SHA in the PR.

- [ ] **Step 3: Provision production infrastructure**

Run:

```bash
cd backend
npx wrangler r2 bucket create leadintel-copilot-files
npx wrangler d1 migrations apply leadintel --remote
npx wrangler deploy
```

Expected: bucket exists, migration applies once, Worker deployment succeeds. Record Worker version ID.

- [ ] **Step 4: Enable the feature for the owner workspace and run production smoke tests**

Use one sanitized fixture for each supported extension. Confirm the stored SHA-256 matches the local original, analysis cites valid locators, save/reload works, eligible downloads open, and delete removes the R2 object plus D1 records.

- [ ] **Step 5: Merge and verify public release**

After required checks pass, merge the PR. Wait for production READY, then verify:
- `release.json` contains the merge SHA;
- customer HTML contains the new process-map token;
- process-map imports the new Copilot loader token;
- loader imports the analyzer token;
- the production feature flag is enabled only for the intended workspace.

- [ ] **Step 6: Final evidence record**

Add a PR comment containing:
- merge SHA;
- Vercel production deployment ID;
- Cloudflare Worker version ID;
- remote D1 migration result;
- R2 bucket name;
- exact frontend and backend test counts;
- five-format smoke-test results;
- known limitations: legacy .doc/.ppt and password-protected files are rejected.

No completion claim is allowed unless every recorded check has fresh evidence.
