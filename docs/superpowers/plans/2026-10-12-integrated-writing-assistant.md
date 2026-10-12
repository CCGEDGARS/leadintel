# Integrated Writing Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Adjust message with a source-aware Writing Assistant while preserving the canonical scripts, quick actions and explicit Save boundary.

**Architecture:** Reuse the workspace's three-slot private document library and AI provider pipeline. Add bounded passage retrieval and a dedicated server-owned assistant request/response contract. One client controller owns compact/expanded chat, context fingerprints and non-destructive previews; the existing message editor applies accepted drafts.

**Tech Stack:** Browser JavaScript/CSS, Node test runner/JSDOM, Cloudflare Worker, D1, R2, existing PDF extraction and AI provider adapters. No new provider, embedding service or OCR dependency.

**Spec:** `docs/superpowers/specs/2026-10-12-integrated-writing-assistant-design.md`

## Global Constraints

- Keep three source slots, 20 MiB/document, 600 PDF pages and two million extracted characters/document.
- Instruction <=4,000 characters; ten prior turns <=12,000 combined; context <=60,000; current working body <=12,000.
- Retrieve <=8 passages and <=12,000 characters combined; retain source/revision/page or line provenance.
- Core masters and first personalized originals remain immutable; generated/edited alternatives are working versions only.
- Chat is transient; explicitly saved messages and uploaded sources remain durable and workspace-scoped.
- No generation on render/hydration/expansion; no autonomous Save, approval, flow activation or sending.
- Built-in skills, OCR, new browsing tools and separate sidebar/toolbar entry points are deferred.
- Execute inline in the existing isolated `leadintel-writing-assistant` worktree; preserve other branches/worktrees.

## Review Focus

1. A changed buyer during an AI request must not receive the previous buyer's reply or draft (Task 4).
2. An unsaved edit while a preview exists must make Apply unavailable, rather than overwrite the edit (Task 4).
3. A partially readable or unavailable activated book must disclose its coverage, rather than silently substitute another source (Task 2).
4. A seller brochure must not be treated as independent evidence of customer need (Task 3).
5. Expand/close while uploading must preserve the sole upload instance and focus/input state (Task 5).

## File Boundaries

- `backend/migrations/0032_writing_reference_roles.sql`: persistent source role.
- Existing source store/routes/UI: role serialization, revision and editing.
- `backend/src/writing-assistant-retrieval.js`: deterministic passage chunking/ranking and source resolution.
- `backend/src/writing-assistant.js`: bounded context validation, server prompt and structured result/citation validation.
- `backend/src/ai-routes.js`: authenticated assistant endpoint using existing credentials, provider accounting and errors.
- `customer/writing-assistant.js`: request ownership, history, preview and Apply checks.
- `customer/writing-assistant-ui.js`, `customer/writing-assistant.css`: safe rendering and compact/expanded view.
- Existing composer/outreach/source loader: context capture, mount, preview apply and single source-library location.
- New focused backend/customer tests; existing core, source and release regressions remain required.

### Task 1: Source roles without another document store

**Files:** create migration above; modify `backend/src/writing-reference-store.js`, `writing-reference-routes.js`, `customer/writing-references-ui.js`; test `backend/test/writing-reference-roles.test.mjs`, `customer/test/writing-references-ui.test.js`.

**Interfaces:** source role is `guidance | seller | customer`; default `guidance`. Source cards expose `role`. Existing PATCH accepts role with `expectedRevision`, increments source/library revision and rejects unknown values.

- [ ] Write failing tests: old records default to guidance; each role persists/reloads; role changes increment revision; foreign-workspace IDs and invalid roles fail without mutation.
- [ ] Run focused tests and confirm the expected missing-field/validation failures.
- [ ] Add the checked D1 column and extend existing serializers/PATCH/UI. Source upload/replacement/deletion retains current ownership and slot behavior.
- [ ] Run source storage, route, quota, migration and UI tests; verify no original bytes are transformed.
- [ ] Commit this isolated source-role change.

### Task 2: Page-aware lexical retrieval

**Files:** create `backend/src/writing-assistant-retrieval.js`; test `backend/test/writing-assistant-retrieval.test.mjs`.

**Interfaces:** `chunkSections(source, sections)` returns passages `{id,sourceId,revision,filename,role,location,text}`. `retrieveAssistantSources(env, scope, {sourceRefs, query})` returns `{referenceRevision,sourceRefs,passages,warnings}`. Resolve sources through workspace-scoped existing records and active/Ready state.

- [ ] Write failing tests for two books with different relevant pages, long pages, eight-passage/12,000-character bounds, page/line attribution, absent relevance, unknown/inactive/changed/foreign sources, partial coverage and missing private text objects.
- [ ] Confirm failures before creating the module.
- [ ] Chunk at 1,200 characters with 150-character overlap; rank normalized Unicode word overlap weighted by inverse corpus frequency, with stable source/location tie-breaking. Filter zero-score passages; never invent a match or page number.
- [ ] Validate requested IDs/revisions, read extracted sections privately and disclose unavailable/partial coverage. Keep techniques plus passages within the shared retrieval budget.
- [ ] Run focused retrieval and existing reference-context tests; commit.

### Task 3: Authenticated assistant endpoint and protected output contract

**Files:** create `backend/src/writing-assistant.js`; modify `backend/src/ai-routes.js`; test `backend/test/writing-assistant.test.mjs`, `backend/test/writing-assistant-route.test.mjs`.

**Interfaces:** POST `/api/writing-assistant/reply?workspace_id=...` consumes `{instruction,history,context,sourceRefs}`. `prepareAssistantRequest(env, scope, body)` returns validated context, source provenance and server-owned system/prompt. `validateAssistantReply(text, prepared)` returns `{reply,draft:null|{subject,message},citations,warnings,provenance}`.

- [ ] Write failing tests for request bounds, unsupported channels, malformed JSON, advice without a draft, changed facts, protected identities/links/meeting duration, disclosure, subject <=60 characters, invalid citation IDs/pages, document injection, seller/customer claim classification and no source relevance.
- [ ] Write route failures for absent session, non-member, foreign sources, caller-supplied system prompt, provider timeout/payment failure and source revision changing during generation.
- [ ] Reuse the existing membership, active provider, decrypted key, credit-status recovery/failure reporting, usage audit and bounded generation pipeline. Add the dedicated path to `handleAiRoute`; keep canonical field generation untouched.
- [ ] Build server instructions that distinguish evidence from hypotheses and document roles. Output drafts omit unsupported claims and report gaps. Only passages actually retrieved may be cited.
- [ ] Validate citations and supported invariants after generation; recheck document revision before returning. Return useful errors without app writes or credential disclosure.
- [ ] Run focused endpoint/provider/security tests and existing AI/core generation tests; commit.

### Task 4: One client controller with stale-preview protection

**Files:** create `customer/writing-assistant.js`; test `customer/test/writing-assistant.test.js`.

**Interfaces:** `createWritingAssistant({capture,request,apply,onChange})` exposes `state()`, `ask(instruction)`, `applyPreview()`, `discardPreview()`, `syncContext()`, `cancel()`, `destroy()`. Capture returns `{scope,fingerprint,context,sourceRefs,referenceRevision,usable}`. Apply consumes `{draft,provenance}` and never saves.

- [ ] Write failing tests for no request on mount/render, single in-flight request, capped history, advice versus draft, explicit Apply/Discard, provider failure/cancellation, source revision change, unsaved edit, style/language change and recipient/workspace/channel switching.
- [ ] Confirm failures, then implement ownership tokens, AbortController, 60-second client deadline and exact context/source fingerprint rechecks before preview and Apply.
- [ ] Clear conversation/preview on scope changes; mark proposals stale for other context changes. Keep safe prior draft on every rejected or failed operation.
- [ ] Preserve conversation on compact/expanded changes; discard history on destroy/reload. Apply invalidates approval and saved readiness through the existing editor adapter.
- [ ] Run focused tests plus editor/race/CRM snapshot tests; commit.

### Task 5: Integrated panel, expanded dialog and composer handoff

**Files:** create `customer/writing-assistant-ui.js`, `customer/writing-assistant.css`; modify `customer/message-workspace.js`, `customer/outreach-ui.js`, `customer/writing-references-loader.js`; test `customer/test/writing-assistant-ui.test.js`, `customer/test/writing-assistant-handoff.test.js`.

**Interfaces:** `mountWritingAssistant(document, controller, options)` renders a shared session and returns `render()`/`destroy()`. Context capture reads exact visible `editorDraft()`, reviewed `studioMessageContext()`, selected recipient and source snapshot. Apply uses `LeadIntelMessageEditor.apply` with working-rewrite origin, recovery and source provenance; it cannot replace the tailored original.

- [ ] Write mounted failures for quick-action presence/listeners, unsaved context, buyer/company identity, edited-draft label, safe text rendering, proposal Apply/Discard, Reset and Save/reopen.
- [ ] Write expand/close tests covering keyboard focus return, one chat/request/upload instance, pending file selection and retained instruction/history.
- [ ] Rename the card Writing Assistant; mount chat, recipient chip, Sources and preview. Move the existing reference host into Sources without cloning its instance or changing support uploads. Add role/coverage help and transient-chat notice.
- [ ] Use semantic labels, keyboard-operable dialog and responsive CSS. Render model/user/document text through textContent; citation labels use server-validated metadata.
- [ ] Keep quick actions direct and chat requests preview-only. Disable Apply under editing, approval, synchronization conflict, missing recipient or pending operations. Maintain original update/reset/template contracts.
- [ ] Run mounted UI, source-loader, core-template, default-language and adjustment regressions; commit.

### Task 6: Final integration, release proof and user-facing validation

**Files:** modify `customer/outreach-ui.js`, `customer/discovery-ui.js`, `customer/index.html` cache chain and `release-integrity.config.json`; create `docs/project-state/2026-10-12-writing-assistant.md` and `customer/test/writing-assistant-release.test.js`.

- [ ] Add meaningful release smoke checks for the mounted assistant, dedicated route registration, passage retrieval and source-role interface. Keep existing gates intact.
- [ ] Verify canonical records are byte-identical and existing support still has no upload controls. Use at least a manufacturing and a services customer fixture.
- [ ] Run `node --test customer/test/*.test.js`, `npm run build` and the backend's `npm test`; syntax-check changed JS and run `git diff --check`. Require zero failures on final contents.
- [ ] Self-review spec coverage, request bounds, preview/Save ownership, private-source reads and actual document-role semantics. Resolve omissions before publishing.
- [ ] Push reviewed source through a PR; require exact-head customer/backend CI before merge. Apply migration/deploy through the existing verified backend workflow, then verify exact main SHA, mandatory production smoke checks and release-proof verdict PROVEN.
- [ ] Exercise compact/expanded view, source upload/activation, advice, draft preview/Apply/Discard, edited Save/reopen and Reset in authenticated browser context without sending outreach. Report any quality limitation separately from release status.
- [ ] Commit final operational documentation and hand off the verified app URL.

## Plan Self-Review

All thirteen design sections map to the six tasks above. The five Review Focus cases have explicit owning tests. Existing original preservation, source limits, transient chat, private durable files, no automatic sending, no skills and no added support uploads are carried as global constraints. No unresolved implementation placeholder remains. Current migration numbering is 0031; recheck the remote branch before assigning 0032 to avoid collision with concurrent work.
