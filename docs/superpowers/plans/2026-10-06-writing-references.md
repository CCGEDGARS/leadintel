# Writing References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver three private document slots whose extracted writing guidance influences only activated AI Generated email and LinkedIn drafts.

**Architecture:** Private object storage holds originals and page/section text; workspace-scoped D1 records hold slot revisions, jobs and technique catalogues. Durable processing analyses all readable chunks, and authenticated generation selects bounded relevant guidance. No document payload enters ordinary workspace JSON.

**Tech Stack:** Existing JavaScript customer app, Cloudflare Worker/D1/private R2, bundled pinned PDF.js text extraction, existing workspace AI provider, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-writing-references-design.md`

## Global Constraints

- Three slots; one file per slot; PDF, UTF-8 TXT and Markdown only.
- Maximum 20 MiB, 600 PDF pages and 2 million extracted characters per file.
- Inactive by default; activation persists; only Ready sources activate.
- AI Generated/original modes only, including Improve; protected and numbered personal styles unchanged.
- Verified facts and mandatory message rules outrank source techniques; 30-minute Zoom/Calendly and channel rules remain.
- Original bytes unchanged; workspace-private reads; no public URLs or document text in logs, CRM or workspace JSON.
- Deletion invalidates influence immediately and removes files, guidance and settings; existing drafts/templates remain intact.
- No fabricated sender inputs, outreach sending or automatic use of conversation attachments during acceptance.

## Review Focus

- A replacement finishing after deletion must not revive a slot: Task 2 revision race test.
- Mixed scanned/text PDF pages must report incomplete coverage rather than Ready: Task 1 mixed-page fixture test.
- Foreign-workspace opaque IDs must remain inaccessible even when guessed: Task 2 authorization test.
- A deactivation during generation must prevent the old response being applied: Task 4 stale-context test.
- Provider failure halfway through a book must retain completed chunks and support a bounded retry: Task 3 resume test.

## Shared types and boundaries

`Scope = {workspaceId,userId}` from existing server authentication, never body input. `Slot` is integer 1..3. `SourceRef = {id,revision,workspaceId,slot}`. `Extracted = {sections:[{location,text}],coverage:{total,readable,unreadable},characters}`. `Technique = {id,name,principle,uses,cautions,pattern,locations}`. `Card = {id,slot,revision,filename,status,active,instruction,coverage,summary}`. `WritingContext = {referenceRevision,sourceRefs,techniques,passages}`. Source statuses match the spec; Empty is a UI projection, not a stored document.

### Task 1: Validated document extraction

**Files:** Create `customer/writing-reference-extractor.js`, `backend/src/writing-reference-validation.js`, `customer/test/writing-reference-extractor.test.js`, `backend/test/writing-reference-validation.test.mjs`; modify customer build configuration/dependency lockfile to bundle the verified PDF.js package locally.

**Interfaces:** `extractWritingReference(bytes,mime) -> Promise<Extracted>`; `validateWritingReference({bytes,mime,filename,extracted}) -> {sha256,mime,bytes,extracted}`. Validation applies server-side even when extraction originates in the browser. PDF bytes remain source truth; recompute coverage server-side through the same parser where Worker-compatible, otherwise use a configured private extraction worker before Ready.

- [ ] Write `extractsTextWithLocationsAndTruthfulCoverage`: real text-PDF fixture has readable text and page locations; mixed fixture has `coverage.unreadable > 0`; image-only file never becomes Ready. Add fixtures for Unicode TXT/Markdown, encrypted PDF, invalid signatures, invalid UTF-8 and 600/601-page boundaries.
- [ ] Run `node --test customer/test/writing-reference-extractor.test.js backend/test/writing-reference-validation.test.mjs`; require failure before implementation.
- [ ] Implement the two interfaces; pin and bundle dependencies after checking official documentation and Worker compatibility. Enforce `20*1024*1024` bytes and `2_000_000` extracted characters without silent truncation. Unavailable private extraction is a reported deployment blocker, not client-trusted coverage.
- [ ] Rerun the command; require all fixture and limit tests passing, plus customer build success.
- [ ] Commit only task files with `feat: validate and extract writing reference documents`.

### Task 2: Private source lifecycle and durable jobs

**Files:** Create `backend/migrations/0028_writing_references.sql` (resolve next free migration number at execution), `backend/src/writing-reference-store.js`, `backend/src/writing-reference-routes.js`, `backend/test/writing-reference-store.test.mjs`, `backend/test/writing-reference-routes.test.mjs`; modify `backend/src/app.js`, `backend/wrangler.toml`.

**Interfaces:** `listWritingReferences(env,scope) -> Card[]`; `putWritingReference(env,scope,{slot,expectedRevision,document}) -> Card`; `patchWritingReference(env,scope,{id,expectedRevision,active,instruction}) -> Card`; `deleteWritingReference(env,scope,{id,expectedRevision}) -> {status,referenceRevision}`; `claimWritingReferenceJob(env,{now,leaseId}) -> Job|null`. API root `/api/writing-references`: GET list, POST upload; `/:id` GET details/PATCH settings/DELETE; `/:id/retry` POST processing retry. Use authenticated cookie transport and existing origin checks. Original download is an authenticated attachment endpoint.

- [ ] Write `enforcesPrivateThreeSlotLifecycle` against real SQLite and an object-store fixture: slots 1..3 succeed, 4 rejects; foreign workspace reads/updates reject; stale revision returns 409; replacement validation failure preserves original; delete removes original/text/catalogue/settings; a late old-revision upload/job cannot restore deleted data.
- [ ] Run `node --test backend/test/writing-reference-{store,routes}.test.mjs`; require failing lifecycle tests.
- [ ] Implement unique workspace/slot D1 ownership, immutable document revisions, workspace reference revision, cleanup queue and job leases. Private binding `WRITING_REFERENCES_BUCKET` must be provisioned through authorized tooling; stop with a specific blocker if authority/access is absent. Do not reuse public brand assets. Mark Deleting before cleanup; tombstones carry no guidance. Revision-check every completion.
- [ ] Rerun tests; additionally assert interrupted cleanup remains Deleting, retries are idempotent, activation refuses partial processing, and normalized reload cannot resurrect deletion.
- [ ] Commit with `feat: store private workspace writing references`.

### Task 3: Resumable AI technique analysis and relevant selection

**Files:** Create `backend/src/writing-reference-analysis.js`, `backend/src/writing-reference-runner.js`, `backend/test/writing-reference-analysis.test.mjs`, `backend/test/writing-reference-runner.test.mjs`; modify `backend/src/app.js` scheduled handler. Reuse `backend/src/ai-provider.js` and workspace service/provider resolution.

**Interfaces:** `chunkWritingReference(extracted,{maxCharacters=12000,overlap=400}) -> Chunk[]`; `analyseWritingReferenceChunk({chunk,generate}) -> Promise<Technique[]>`; `aggregateWritingReference(chunks) -> {summary,techniques}`; `runWritingReferenceJobs(env,{now,maxJobs=2}) -> Promise<JobResults>`; `selectWritingGuidance({catalogues,query,maxCharacters=12000}) -> {techniques,passages}`.

- [ ] Write `analysesAllReadableChunksAndResumes`: every section is represented; overlaps deduplicate; failure on chunk 2 preserves chunk 1; retry skips completed chunk hashes; bounded leases prevent two workers charging the same chunk; malformed provider JSON fails safely. Add injection, conflicting technique and misleading numerical example fixtures.
- [ ] Run `node --test backend/test/writing-reference-{analysis,runner}.test.mjs`; require failure.
- [ ] Implement bounded schema validation, adapted patterns with source locations, three retry attempts per failed chunk and explicit provider/quota failure statuses. Dispatch processing after upload through Worker background execution; use scheduled recovery for expired jobs. Honour provider/time/usage limits and keep book text out of logs. Ready requires complete readable coverage and complete analysis; mixed/scanned files show Needs attention and remain inactive.
- [ ] Rerun tests; assert selection stays within 12,000 characters, preserves relevant techniques across all three sources and omits incompatible advice. Run a real provider check with a purpose-made non-sensitive document; distinguish it from fixture tests.
- [ ] Commit with `feat: analyse and select writing reference techniques`.

### Task 4: Authenticated generation integration

**Files:** Create `backend/src/writing-reference-context.js`, `backend/test/writing-reference-generation.test.mjs`; modify `backend/src/ai-routes.js`, `customer/message-studio.js`, `customer/outreach-ui.js`, `customer/outreach-engine.js` and their relevant tests.

**Interfaces:** `resolveWritingContext(env,scope,{mode,channel,query}) -> Promise<WritingContext|null>`; `assertWritingContextCurrent(env,scope,context) -> Promise<void>`. Generation carries validated `mode`/`channel` metadata; the server resolves document content itself. Response adds provenance metadata alongside unchanged message JSON.

- [ ] Write `appliesOnlyActiveOriginalGuidance`: zero active yields the original prompt unchanged; each activation combination yields only relevant active revisions; protected and numbered-template modes ignore sources; browser-supplied foreign refs cannot inject content. Write `discardsResponseAfterDeactivationOrDeletion` and cross-industry lawyer/manufacturer fixtures.
- [ ] Run `node --test backend/test/writing-reference-generation.test.mjs customer/test/*message*test.js customer/test/linkedin-studio.test.js`; require new tests failing before changes.
- [ ] Integrate selected guidance as clearly delimited untrusted data under existing factual/safety rules. Recheck revisions after provider completion and before draft application; stale results return an actionable regeneration status, never overwrite the edited draft. Save source/technique IDs only in CRM provenance; no passages. Fresh Generate excludes existing draft content; Improve intentionally includes it.
- [ ] Rerun tests; assert supported benefits, evidence-only numbers, Zoom/Calendly, email subjects, LinkedIn length, separate drafts and no sending regressions.
- [ ] Commit with `feat: apply activated references to original AI messages`.

### Task 5: Three-card customer interface

**Files:** Create `customer/writing-references-ui.js`, `customer/writing-references.css`, `customer/test/writing-references-ui.test.js`; modify `customer/index.html` and scoped runtime/build entry paths.

**Interfaces:** `mountWritingReferences({root,api,onChange}) -> {refresh,destroy}`; API adapter calls Task 2 routes. `onChange({referenceRevision,activeCount})` updates the existing message studio indicator without replacing drafts.

- [ ] Write `rendersAndPersistsThreeCards`: upload/replace, inactive default, readiness gate, summary/details, custom instruction, activate/deactivate, quota failure/retry, delete confirmation/cancel/cleanup and empty states. Verify duplicate mount has one handler and late responses after workspace switch are ignored.
- [ ] Run `node --test customer/test/writing-references-ui.test.js`; require failure.
- [ ] Implement accessible responsive cards with exact labels from the spec, file validation/progress and server-backed reload. Display “Using N writing references” with active names only in eligible modes. Existing draft stays untouched on all source operations. Keep source bodies and catalogues outside workspace sync.
- [ ] Rerun UI tests, including keyboard navigation, escaping hostile filenames and stale settings conflicts. Build and inspect mobile/desktop layouts.
- [ ] Commit with `feat: add three writing reference cards to message settings`.

### Task 6: Release, deletion proof and authenticated acceptance

**Files:** Modify `release-integrity.config.json`, applicable release fixtures and production watcher tests; create `docs/project-state/2026-10-06-writing-references.md` and usage/retention documentation.

**Interfaces:** Existing exact-SHA release-proof contract; add mandatory private reference runtime/API checks without exposing files. Reuse Task 2 reads and cleanup status for acceptance evidence.

- [ ] Add release tests requiring reference assets and unauthenticated API denial. Run them and verify new expectations initially fail.
- [ ] Add checks and documentation for formats/limits, provider processing, actual retention, manual sending, deactivation versus deletion and pre-existing draft influence.
- [ ] Run `node --test customer/test/*.test.js`, `npm test` in backend, root `npm run build`, migration tests and `git diff --check`; require all passing on final contents.
- [ ] Apply migrations and private bindings through authorized tooling; ship the reviewed branch via existing CI/PR workflow; obtain matching SHA, successful required CI/backend deployment, manifest, backend health and every mandatory smoke check with verdict PROVEN. Missing authority is a blocker, not an excuse to claim completion.
- [ ] In authenticated UI, upload a purpose-made source, inspect real analysis, activate and verify influence, deactivate and verify exclusion, reload, replace, cancel deletion, confirm deletion and prove originals/derivatives/settings are gone. Test a second workspace denial and late-result exclusion. Complete genuine sender inputs only with supplied evidence; if unavailable, report the precise unverified acceptance gate instead of fabricating them.
- [ ] Record separate test, release and customer acceptance evidence; provide the verified page and saved screenshot. Commit docs with `docs: record writing references acceptance evidence`.

## Execution handoff

Recommended: Native execution using `superpowers:executing-plans`; the main agent implements the connected tasks and an independent final review follows as permitted by the chosen execution method. Subagent-driven execution is available if explicitly selected. No product code or infrastructure changes begin until this written plan is reviewed and an execution method is chosen.
