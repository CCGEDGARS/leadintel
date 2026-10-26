# Company Reference Materials Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upload once and automatically prepare relevant company evidence for requested writing.
**Architecture:** D1 manifests, private R2 originals and extracted text, durable minute-scheduler jobs, relevance selection in backend writing paths, lightweight upload UI.
**Tech Stack:** Existing browser JS, Cloudflare Worker/D1/R2 and customer-owned AI credentials.
**Spec:** docs/superpowers/specs/2026-10-26-company-reference-materials.md

## Global Constraints
- Five PDFs and ten JPG/PNG images, 15 MiB each; books keep their independent three slots.
- Originals saved before extraction. Workspace isolation, authenticated downloads and expiring upload tickets.
- No core-template wording changes; General Writing remains isolated; no send authority.
- Never invent unsupported claims. Unreadable or failed extraction remains Needs attention.

## Review Focus
- Concurrent uploads cannot exceed limits or create duplicate records.
- Provider failure, worker restart and deletion during processing cannot resurrect a source.
- Files with misleading names/signatures or malformed provider output cannot become Ready.
- Unrelated prospects do not receive a forced testimonial; unsupported numbers remain rejected.
- Changing workspace or deleting a reference during generation cannot leak or apply stale results.

### Task 1: Durable ingestion and processing
Files: backend/migrations/0052_company_materials.sql; backend/src/company-materials*.js; backend/test/company-materials.test.mjs; backend/src/app.js; backend/src/workspace-storage-objects.js.
- [ ] Write and observe failing tests for limits, authorization, signatures, original preservation, deduplication, job leases, analysis validation, retries and deletion.
- [ ] Implement ticket upload, bounded extraction/analysis, storage and scheduler integration.
- [ ] Run backend focused tests.

### Task 2: Automatic writing references
Files: backend/src/company-materials-context.js; backend/src/writing-assistant.js; backend/src/ai-routes.js; backend/test/company-materials-context.test.mjs.
- [ ] Write and observe failing tests for selection, claim boundaries, core/general exclusion and generation races.
- [ ] Inject relevant source excerpts into explicit working-copy writing and return readable provenance without altering book attribution.
- [ ] Run writing assistant and template regression suites.

### Task 3: Upload and review interface
Files: customer/company-materials.js; customer/app.js; customer/index.html; customer/website-input-sync.js; customer/test/company-materials.test.js.
- [ ] Write and observe failing DOM/API tests for multi-file uploads, states, limits, reload, retry, review, delete and workspace switching.
- [ ] Implement upload and automatic polling, preserve legacy documents, update heading and help text.
- [ ] Run complete customer/backend tests, build and syntax checks.

### Task 4: Release and verify
- [ ] Document behavior and limitations, commit and push the change, inspect required CI.
- [ ] Deploy via the existing verified pipeline and inspect exact-SHA release proof. Report authentication or external blockers precisely.
