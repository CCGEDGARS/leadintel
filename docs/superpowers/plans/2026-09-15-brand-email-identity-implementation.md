# Brand & Email Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete workspace-scoped brand identity system whose approved appearance is identical in preview, Gmail, and Microsoft 365 delivery.

**Architecture:** Identity metadata remains inside the existing `main` workspace payload while image bytes live in a new Cloudflare R2 binding. A deterministic renderer produces equivalent text and safe HTML; outreach approval snapshots the active identity so later edits cannot mutate approved communication. Existing plain-text delivery remains backward compatible.

**Tech Stack:** Browser JavaScript/CSS, Node test runner, Cloudflare Workers, D1, R2, Gmail API MIME, Microsoft Graph.

**Spec:** `docs/superpowers/specs/2026-09-15-brand-email-identity-design.md`

## Global Constraints

- One active identity per workspace in version 1.
- Identity setup remains optional and cannot block research or legacy plain-text sending.
- Images are PNG, JPEG, or WebP; SVG and arbitrary remote images are rejected.
- No image bytes or data URLs enter the 500 KB workspace state.
- Website extraction creates suggestions only and requires explicit approval.
- Approved drafts use immutable brand snapshots.
- Gmail and Microsoft keep text-only compatibility when HTML is absent.
- Automated Gmail remains plain text until its queue persists an approved snapshot.

---

### Task 1: Identity model and deterministic renderer

**Files:**
- Create: `customer/brand-identity.js`
- Create: `customer/test/brand-identity.test.js`

**Interfaces:**
- Produces: `LeadIntelBrandIdentity.normalize(value)`, `validate(value)`, `snapshot(value)`, `renderEmail(input)`, `safeAssetReference(value)`.

- [ ] Write tests with literal expected state, escaped HTML, safe URL handling, text equivalence, ready-state validation, and immutable snapshots.
- [ ] Run `node --test customer/test/brand-identity.test.js`; verify failures report the missing module/API.
- [ ] Implement normalization, validation, escaping, snapshot cloning, and `{subject,textBody,htmlBody}` rendering.
- [ ] Run the focused test and confirm zero failures.
- [ ] Commit `test: define brand identity rendering contract` and `feat: add safe brand identity renderer`.

### Task 2: R2 asset boundary

**Files:**
- Create: `backend/src/brand-assets.js`
- Create: `backend/test/brand-assets.test.js`
- Modify: `backend/src/app.js`
- Modify: `backend/wrangler.toml`

**Interfaces:**
- Produces: `handleBrandAssetRoute(request, env, cors)` and `validateBrandAsset(file, kind)`.
- Consumes: authenticated workspace membership from the existing SaaS route helpers and `env.BRAND_ASSETS`.

- [ ] Write failing tests for authorization, opaque IDs, MIME/magic-byte/size checks, safe response headers, import restrictions, replacement safety, and deletion.
- [ ] Run `npm --prefix backend test -- brand-assets`; verify the route/module is missing.
- [ ] Implement upload, approved URL import, public GET, deletion, R2 object keys, audit events, and strict response headers.
- [ ] Add the `BRAND_ASSETS` R2 binding without changing existing D1/assets bindings.
- [ ] Run focused backend tests and confirm zero failures.
- [ ] Commit `feat: add workspace brand asset storage`.

### Task 3: Step 1 identity module

**Files:**
- Modify: `customer/index.html`
- Modify: `customer/app.js`
- Create: `customer/brand-identity-ui.js`
- Create: `customer/brand-identity.css`
- Create: `customer/test/brand-identity-ui.test.js`

**Interfaces:**
- Consumes: `LeadIntelBrandIdentity` and `LeadIntelServer.uploadBrandAsset/importBrandAsset/deleteBrandAsset`.
- Produces: Step 1 draft/ready state, website suggestions, asset controls, and three preview modes.

- [ ] Write failing UI tests for placement, collapse state, labels, extraction approval, replacement preservation, keyboard tabs, mobile-safe markup, and inline errors.
- [ ] Run the focused test; verify expected missing selectors and handlers.
- [ ] Add the highlighted module after Main company website and load its JS/CSS with a new cache version.
- [ ] Bind form state to `main.brandIdentity`, implement suggestion-only extraction, upload/import/delete actions, validation, and desktop/mobile/plain previews.
- [ ] Run focused UI tests and confirm zero failures.
- [ ] Commit `feat: add Step 1 brand and email identity`.

### Task 4: Server bridge and persistence integration

**Files:**
- Modify: `customer/server-bridge.js`
- Modify: `customer/workspace-reset-hygiene.js`
- Modify: `customer/test/workspace-isolation.test.js`
- Create: `customer/test/brand-asset-bridge.test.js`

**Interfaces:**
- Produces: `uploadBrandAsset`, `importBrandAsset`, `deleteBrandAsset`; extended send methods accepting `textBody` and `htmlBody`.

- [ ] Write failing tests proving assets are never serialized as bytes/data URLs, calls carry workspace identity, failed replacement preserves old metadata, and reset requests asset cleanup.
- [ ] Run focused tests and verify the new bridge contract is absent.
- [ ] Implement authenticated multipart/import/delete calls and safe workspace cleanup.
- [ ] Extend Gmail/Microsoft bridge payloads without removing `body`.
- [ ] Run focused persistence/bridge tests and confirm zero failures.
- [ ] Commit `feat: connect brand assets to workspace persistence`.

### Task 5: Outreach approval snapshot and exact preview

**Files:**
- Modify: `customer/outreach-engine.js`
- Modify: `customer/outreach-ui.js`
- Create: `customer/test/outreach-brand-snapshot.test.js`

**Interfaces:**
- Consumes: `LeadIntelBrandIdentity.snapshot` and `renderEmail`.
- Produces: approved drafts with `brandSnapshot`, and send payloads derived from that snapshot.

- [ ] Write failing tests proving approval snapshots the current revision, later identity edits do not change preview/send, explicit refresh requires reapproval, and legacy drafts remain plain text.
- [ ] Run the focused test and verify snapshot behavior is missing.
- [ ] Snapshot identity at approval, render exact preview from the snapshot, and pass rendered text/HTML into delivery.
- [ ] Remove `[Your name]`/`[Jūsu vārds]` when a ready identity supplies sender details.
- [ ] Run focused outreach tests and confirm zero failures.
- [ ] Commit `feat: freeze brand identity on outreach approval`.

### Task 6: Gmail and Microsoft branded delivery

**Files:**
- Modify: `backend/src/gmail.js`
- Modify: `backend/src/microsoft-mail.js`
- Modify: `backend/src/saas-routes.js`
- Create: `backend/src/email-content.js`
- Create: `backend/test/email-content.test.js`
- Modify: existing Gmail/Microsoft route tests

**Interfaces:**
- Produces: `validateEmailContent({body,text_body,html_body})`; Gmail `multipart/alternative`; Microsoft Graph HTML payload with text fallback compatibility.

- [ ] Write failing tests with literal MIME boundaries/payload assertions, unsafe HTML/URL rejection, size limits, and text-only compatibility.
- [ ] Run focused backend tests and verify current senders remain text only.
- [ ] Implement backend sanitization and normalized content selection.
- [ ] Extend Gmail MIME construction and Microsoft Graph body selection.
- [ ] Wire optional fields through manual send routes while preserving idempotency, CRM logging, limits, and reply tracking.
- [ ] Run focused tests and confirm zero failures.
- [ ] Commit `feat: deliver branded email with text fallback`.

### Task 7: Regression, deployment, and production proof

**Files:**
- Modify: relevant cache/version contracts and release verification fixtures only where behavior changed.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: deployed exact-SHA release and verified final URL.

- [ ] Run `npm test` and `npm --prefix backend test`; fix every relevant failure through a failing regression test first.
- [ ] Run the repository build and release-integrity commands from `package.json` and `.github/workflows/release-integrity.yml`.
- [ ] Review desktop/mobile hierarchy, keyboard focus, all error states, and image-blocked rendering.
- [ ] Push the complete branch, merge after checks, and record the exact main SHA.
- [ ] Verify the deployed SHA, upload/save/preview flow, legacy plain text, one Gmail branded send, and one Microsoft branded send.
- [ ] Return only the final LeadIntel URL plus concise verified outcomes; disclose any external credential/resource action that still requires the owner.
