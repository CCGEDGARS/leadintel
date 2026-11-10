# Universal Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a shared monitored-event inbox and reviewed formatted-message/automatic-delivery path for organizations and individuals.

**Architecture:** Extend the existing workspace monitor with versioned workflow settings. Use a shared deterministic purpose model, additive D1 findings/subjects/messages, a single inbox and native guarded mail delivery.

**Tech Stack:** Existing JavaScript modules, Node tests, Cloudflare Workers/D1, Firecrawl and Gmail adapters, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-universal-monitoring-design.md`

## Global Constraints

- Existing rows normalize to legacy buying-signals behavior, alert-only delivery, and no automatic migration of sources or thresholds.
- A person is never stored as a fake company.
- New direct-page reads count toward the same budget.
- Protected system/core templates are untouched.
- No restricted scraping, private-person enrichment or paid contact confirmation is introduced.
- Automatic delivery is an optional capability, not a live-send authorization from this implementation request.
- Exact-SHA production proof and authenticated customer acceptance are separate gates.

## Review Focus

- Unknown page layouts and anonymized parties remain unresolved rather than acquiring guessed identities.
- Changed deadlines and same-URL event changes produce a version without repeated alerts on unchanged reads.
- A stale workspace/configuration/template/recipient cannot publish or deliver an old result.
- Partial providers preserve useful observations and stay within the operation budget.
- Ambiguous provider acceptance cannot create a second send; pause/suppression/shared limits apply.

### Task 1: Shared purpose model and durable records

**Files:** Create `customer/monitoring-model.js`, `backend/migrations/0071_universal_monitoring.sql`, `backend/migrations/0072_universal_monitoring_storage.sql`, `customer/test/monitoring-model.test.js`; modify `customer/market-engine.js` and `backend/src/market-monitoring-engine.js`.
**Interfaces:** `normalizeWorkflow(input)`, `buildPlan(payload,config,cursor)`, `extractEvents(evidence,workflow)`, `assessEvent(event,workflow,now)`, `renderMessage(template,context)` shared via UMD. New workflow JSON remains optional in legacy configuration.

- [x] Write and run failing normalization, role/identity, source-update, purpose-query, deadline/unknown and literal-template tests.
- [x] Implement bounded shared functions and additive findings/versions/subjects/messages schema with storage accounting.
- [x] Run model, schema and existing monitoring-engine suites; commit a green task.

### Task 2: Monitoring execution and inbox API

**Files:** Create `backend/src/monitoring-inbox.js`, `backend/test/monitoring-inbox.test.mjs`; modify `backend/src/market-monitoring.js` and relevant monitoring fixtures.
**Interfaces:** `recordFinding(env,scope,event,assessment,guard)`, `handleInboxRoute(request,env,scope)`, `getReviewedSubject(...)`. Existing monitoring entry authenticates/scopes all inbox calls.

- [x] Reproduce missing same-URL updates, independent-person records, restricted content and scope/revision rejection using actual SQL/HTTP.
- [x] Connect purpose search/page reads and retained event versions to existing leases/run budgets; expose paginated scoped inbox/review/message endpoints.
- [x] Verify legacy alert compatibility, stale writes, source failures and useful partial progress; commit a green task.

### Task 3: Inbox, settings, company intake and formats

**Files:** Create `customer/monitoring-inbox.js`, `customer/monitoring-inbox.css`, `customer/test/monitoring-inbox.test.js`; modify `customer/app.js`, `customer/index.html`, loaders and necessary company-intake interfaces.
**Interfaces:** One global inbox entry and the Profile link; existing known-target handoff for organizations; independent subject review and personal-template preview for all subjects. Settings serialize only the shared workflow contract.

- [x] Write failing DOM tests for purpose settings, drafts, scope changes, filters, reviewed organization intake and person review without fake companies.
- [x] Implement accessible responsive inbox/detail/message controls and matching cache identities.
- [x] Verify save/reopen, no implicit send, no paid research, exact format and safe source rendering; commit a green task.

### Task 4: Guarded automatic delivery and full acceptance

**Files:** Create `backend/src/monitoring-delivery.js`, `backend/test/monitoring-delivery.test.mjs`, `backend/test/universal-monitoring-journey.test.mjs`; modify registered scheduler, CI, release smoke configuration and cache fixtures.
**Interfaces:** `runMonitoringDeliveries(env,{now,sendMessage})`, approved version-bound messages, native Gmail receipts and shared automation policy. Scheduler invocation is observable and independent of the browser.

- [x] Write failing tests for missing approvals, private-person review, templates, suppression, limits/windows, context/recipient races, duplicate and ambiguous acceptance.
- [x] Implement bounded reservation/dispatch/acceptance using existing native helpers; register the job and prove one controlled accepted delivery with no live send.
- [ ] Run three-purpose real HTTP/SQL/browser journeys, full customer/backend checks, a fresh whole-branch review and one verified fix pass.
- [ ] Merge only after required CI, then obtain exact-SHA production proof and reopen preserved Ercon settings without enabling new message automation.
