# Intelligence Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a workspace-level source registry with real access audits, trigger mapping, mandatory-source monitoring, source health, and a Step 4 management UI.

**Architecture:** Add focused backend source-registry/audit modules and D1 tables, then integrate mandatory source queries into the existing Market Monitoring engine. Add a standalone frontend runtime injected by `process-map.js` so the current Step 4 HTML does not need a large rewrite.

**Tech Stack:** Cloudflare Worker, D1/SQL, Firecrawl public extraction, vanilla JavaScript customer UI, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-10-intelligence-sources-design.md`

## Global Constraints

- Visible access states: `not_tested`, `full`, `partial`, `no_access`.
- V1 authenticated access is metadata/status only unless an authorized site-specific integration exists; never collect Google passwords or arbitrary browser cookies.
- Mandatory sources require latest public access status `full` or `partial`.
- Monitoring cadence remains `daily`, `weekly`, or `monthly`.
- Mandatory sources augment, not replace, diversified monitoring research.
- Reject unsafe/private URL targets.
- Preserve Known → Planned → Researched → Verified evidence semantics.
- Production claims require release-integrity proof.

---

### Task 1: Source model, safety, grading and schema

**Files:**
- Create: `backend/migrations/0017_intelligence_sources.sql`
- Create: `backend/src/intelligence-sources-engine.js`
- Create: `backend/test/intelligence-sources-engine.test.mjs`
- Create: `backend/test/intelligence-sources-schema.test.mjs`

**Interfaces:**
- Produces `normalizeSourceInput(input)`, `validateSourceUrl(value)`, `gradeAccessAudit(result)`, `inferExtractableData(text)`, `buildMandatorySourceQueries(sources,signals,profile)`.

- [ ] Write failing engine/schema tests for URL safety, access grading, extraction categories, mapped-signal site queries, and required D1 columns/check constraints.
- [ ] Run backend tests and confirm the new tests fail because implementation/schema does not exist.
- [ ] Add `intelligence_sources` and append-only `intelligence_source_audits` tables plus indexes.
- [ ] Implement pure normalization, safe URL validation, deterministic audit grading and mandatory-source query generation.
- [ ] Run the focused tests and confirm pass.

### Task 2: Source CRUD and real public audit API

**Files:**
- Create: `backend/src/intelligence-sources.js`
- Create: `backend/test/intelligence-sources-routes.test.mjs`
- Modify: `backend/src/app.js`

**Interfaces:**
- Produces `handleIntelligenceSourceRoute(request,env,cors)` and `runDueSourceHealthChecks(env,now)`.
- Routes: `GET/POST /api/intelligence-sources`, `PATCH/DELETE /api/intelligence-sources/:id`, `POST /api/intelligence-sources/:id/audit`, `GET /api/intelligence-sources/:id/audits`.

- [ ] Write failing route-contract tests for membership, owner/researcher writes, CRUD, audit endpoint and no raw credential fields.
- [ ] Run focused tests and verify RED.
- [ ] Implement workspace-scoped CRUD.
- [ ] Implement real public audit using the configured Firecrawl credential or managed proxy and store provider/method evidence.
- [ ] Update source health and append audit history after every attempted audit.
- [ ] Wire routes and due health checks into `backend/src/app.js`.
- [ ] Run focused tests and verify GREEN.

### Task 3: Mandatory sources in Market Monitoring

**Files:**
- Modify: `backend/src/market-monitoring.js`
- Modify/Create tests under: `backend/test/market-monitoring-*.test.mjs`

**Interfaces:**
- Consumes `buildMandatorySourceQueries` from source engine.
- Produces site-specific planned queries using each source's mapped signals while preserving existing diversified queries.

- [ ] Add a failing test proving mandatory sources are loaded and site-specific queries are added without removing normal source queries.
- [ ] Implement source loading and mandatory query concatenation in `runWorkspaceMonitoring`.
- [ ] Include mandatory-source IDs/hosts in the run snapshot and count failed checks as gaps.
- [ ] Run monitoring/backend test suite.

### Task 4: Step 4 Intelligence Sources UI

**Files:**
- Create: `customer/intelligence-sources-ui.js`
- Create: `customer/test/intelligence-sources-ui.test.js`
- Modify: `customer/process-map.js`

**Interfaces:**
- Calls backend source routes using the signed-in workspace from `LeadIntelServerBridge`.
- Reads active signals from `leadintel_customer_v2_state`.

- [ ] Write failing static/runtime contract tests for Step 4 panel, modal, access badges, auth disclosure, signal mapping, mandatory gating and source health.
- [ ] Implement a standalone UI runtime that injects **Intelligence Sources** before/near automatic monitoring.
- [ ] Implement add/edit/delete/test-access actions and render `NOT TESTED`, `FULL ACCESS`, `PARTIAL ACCESS`, `NO ACCESS` badges.
- [ ] Render anonymous vs authenticated status and explicit Google-login limitation.
- [ ] Render active signal checkboxes, cadence, monitoring and mandatory controls; disable mandatory when access is not Full/Partial.
- [ ] Wire runtime import in `process-map.js` with a fresh cache version.
- [ ] Run customer tests and JS syntax checks.

### Task 5: Verification and release

**Files:**
- No new product files unless verification exposes a defect.

- [ ] Run complete backend test suite.
- [ ] Run complete customer CI suite and JavaScript syntax checks.
- [ ] Open PR and inspect changed files/diff.
- [ ] Merge only after required branch checks pass.
- [ ] Verify main backend CI and deployment/migration health.
- [ ] Verify main customer CI and Vercel deployment.
- [ ] Run repository release-integrity proof for the exact merged SHA and only label production `PROVEN PRODUCTION` if verdict is `PROVEN`.