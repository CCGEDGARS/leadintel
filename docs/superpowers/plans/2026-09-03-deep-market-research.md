# Quick + Deep Market Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two explicit Market Strategy research modes: a fast Quick Research path using the current OpenAI Web Search + Firecrawl workflow, and a deeper iterative research path with backend-owned orchestration, Firecrawl deep extraction, optional Scrapling fallback, source-quality scoring, progress reporting, and traceable evidence.

**Architecture:** Quick Research remains browser-orchestrated and preserves the current bounded behavior. Deep Research uses a server-owned state machine persisted in the existing `research_runs` / `run_events` tables: the browser starts a run, repeatedly asks the backend to advance one bounded batch, polls status, and renders progress. This avoids relying on long-lived Worker background execution while keeping provider credentials, budgets, URL safety, source scoring, and orchestration decisions on the backend. Scrapling is integrated behind a controlled `SCRAPLING_API_URL` service boundary and is used only when configured and Firecrawl cannot extract a high-value public page.

**Tech Stack:** Vanilla JS customer app, Cloudflare Workers, D1, OpenAI Responses API Web Search, Firecrawl Search/Scrape, optional Scrapling HTTP microservice, Node test runner, GitHub Actions, Vercel static frontend.

**Spec:** `docs/superpowers/specs/2026-09-03-deep-market-research-design.md`

## Global Constraints

- Quick Research maximum: 4 generated queries, up to 5 OpenAI results per query, up to 5 Firecrawl results per query.
- Deep Research maximum: 3 passes, 30 total search requests, 60 deep page extractions, bounded per-domain extraction, bounded elapsed time.
- OpenAI Web Search must use the workspace's connected OpenAI integration even if OpenAI is not the ACTIVE general-generation provider.
- Firecrawl uses the workspace-owned credential when configured, otherwise the existing managed fallback.
- Scrapling is fallback extraction only; it is never a first-line search engine.
- Apollo must not be invoked by Quick or Deep Market Strategy research.
- Only public HTTP(S) URLs are allowed; private/local-network targets are rejected before extraction.
- One provider failure must preserve evidence collected by the other providers.
- No API keys or raw secrets may enter frontend source, browser payloads, research result JSON, logs, or audit metadata.
- Existing saved Quick Research state must remain backward-compatible.
- A profile-only opportunity before any live research has run must say `Profile hypothesis — research not run yet`.

---

### Task 1: Two research buttons and unambiguous pre-run state

**Files:**
- Modify: `customer/index.html`
- Modify: `customer/app.js`
- Modify: `customer/market.css`
- Test: `customer/test/market-research-modes.test.js`

**Interfaces:**
- Consumes: existing `runMarketResearch()` Quick Research function and Market Strategy DOM.
- Produces: `#run-market-research-quick`, `#run-market-research-deep`, `runQuickMarketResearch()`, `runDeepMarketResearch()`, and idle-copy semantics keyed by `state.market.researchStatus`.

- [ ] **Step 1: Write the failing UI contract test**

Create `customer/test/market-research-modes.test.js` asserting:

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('Market Strategy exposes Quick Research and Deep Research as separate actions',()=>{
  assert.match(html,/id="run-market-research-quick"/);
  assert.match(html,/Quick Research/);
  assert.match(html,/id="run-market-research-deep"/);
  assert.match(html,/Deep Research/);
  assert.match(app,/function runQuickMarketResearch|async function runQuickMarketResearch/);
  assert.match(app,/function runDeepMarketResearch|async function runDeepMarketResearch/);
});

test('idle opportunity copy says research has not run yet',()=>{
  assert.match(app,/Profile hypothesis[^\n]{0,80}research not run yet/i);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test customer/test/market-research-modes.test.js`

Expected: FAIL because the two button IDs and new idle copy do not exist.

- [ ] **Step 3: Implement the two-button UI**

Replace the single Market Strategy research button with adjacent actions:

```html
<div class="market-research-actions">
  <button id="run-market-research-quick" class="secondary" type="button">
    <strong>Quick Research</strong>
    <span>OpenAI Web Search + Firecrawl · fast</span>
  </button>
  <button id="run-market-research-deep" class="primary deep-research-action" type="button">
    <strong>✦ Deep Research</strong>
    <span>Multi-source · iterative · maximum evidence</span>
  </button>
</div>
```

Rename the current `runMarketResearch()` implementation to `runQuickMarketResearch()` without changing its provider logic. Add a temporary `runDeepMarketResearch()` that displays `Deep Research is being prepared` until Task 5 wires the real controller. Update the click bindings to the new IDs.

In opportunity rendering, choose the no-evidence copy by status:

```js
const noEvidenceCopy=state.market.researchStatus==='idle'
  ? 'Profile hypothesis — research not run yet.'
  : 'No live public evidence was returned. LeadIntel has kept this as a low-evidence hypothesis instead of inventing support.';
```

Add CSS so both buttons are clearly distinct, responsive, and the deep button is visually stronger when evidence is weak.

- [ ] **Step 4: Run focused and existing market tests**

Run:

```bash
node --test customer/test/market-research-modes.test.js customer/test/openai-web-search-market.test.js customer/test/market-engine.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: split quick and deep market research actions`

---

### Task 2: Extend market state for research mode, progress, statistics, and evidence quality

**Files:**
- Modify: `customer/market-engine.js`
- Test: `customer/test/market-engine.test.js`
- Test: `customer/test/deep-research-state.test.js`

**Interfaces:**
- Produces: normalized fields `researchMode`, `researchRunId`, `researchProgress`, `researchStats`, `researchStopReason` and evidence fields `sourceType`, `sourceQuality`, `corroborationCount`, `retrievedAt`.
- Produces: `scoreEvidenceQuality(evidence)` for deterministic Evidence scoring.

- [ ] **Step 1: Write failing backward-compatibility and scoring tests**

Add tests equivalent to:

```js
test('old market state loads with safe deep-research defaults',()=>{
  const state=LeadIntelMarket.normalizeMarketState({researchStatus:'complete',researchResults:[]});
  assert.equal(state.researchMode,'quick');
  assert.equal(state.researchRunId,'');
  assert.deepEqual(state.researchProgress,{pass:0,maxPasses:0,stage:'idle',message:''});
});

test('primary corroborated evidence scores higher than one weak source',()=>{
  const strong=[
    {url:'https://gov.lv/tender/1',sourceQuality:4,corroborationCount:2,date:new Date().toISOString()},
    {url:'https://company.lv/news/expansion',sourceQuality:4,corroborationCount:2,date:new Date().toISOString()}
  ];
  const weak=[{url:'https://directory.example/a',sourceQuality:1,corroborationCount:1,date:''}];
  assert.ok(LeadIntelMarket.scoreEvidenceQuality(strong)>LeadIntelMarket.scoreEvidenceQuality(weak));
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test customer/test/deep-research-state.test.js customer/test/market-engine.test.js`

Expected: FAIL on missing fields/function.

- [ ] **Step 3: Implement normalization and deterministic Evidence scoring**

Extend `DEFAULT_MARKET_STATE` with:

```js
researchMode:'quick',
researchRunId:'',
researchProgress:{pass:0,maxPasses:0,stage:'idle',message:''},
researchStats:{themes:0,queries:0,pagesExamined:0,usableSources:0,primarySources:0,corroboratedSources:0,elapsedMs:0},
researchStopReason:''
```

Normalize evidence metadata and keep old records valid. Implement `scoreEvidenceQuality` so the output remains bounded 3–20 and considers count, `sourceQuality`, corroboration, and recency. Replace the current count-only Evidence score in `buildMarketOpportunities` with this deterministic function while keeping zero evidence at `3`.

- [ ] **Step 4: Run tests**

Run: `node --test customer/test/deep-research-state.test.js customer/test/market-engine.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add deep research state and evidence quality scoring`

---

### Task 3: Backend deep-research planner, safety model, and state-machine unit

**Files:**
- Create: `backend/src/deep-research.js`
- Test: `backend/test/deep-research.test.mjs`

**Interfaces:**
- Produces: `DEEP_RESEARCH_LIMITS`, `buildDeepResearchPlan(context)`, `publicDeepResearchUrl(value)`, `classifySource(url,title,description)`, `mergeDeepEvidence(groups)`, `nextDeepResearchAction(runState)`, `applyDeepResearchActionResult(runState,result)`.

- [ ] **Step 1: Write failing unit tests**

Tests must cover:

```js
assert.equal(DEEP_RESEARCH_LIMITS.maxPasses,3);
assert.equal(DEEP_RESEARCH_LIMITS.maxSearchRequests,30);
assert.equal(DEEP_RESEARCH_LIMITS.maxPages,60);
assert.ok(buildDeepResearchPlan(context).themes.length>=4);
assert.ok(buildDeepResearchPlan(context).themes.length<=12);
assert.equal(publicDeepResearchUrl('http://127.0.0.1/x'),null);
assert.equal(publicDeepResearchUrl('https://example.com/x').hostname,'example.com');
```

Also verify that the planner selects only relevant theme families, canonical URL merge preserves provider provenance, same-page provider overlap does not increment independent corroboration, and a second independent domain can increment `corroborationCount` for the same commercial claim/theme.

- [ ] **Step 2: Verify RED**

Run: `cd backend && npm test -- --test-name-pattern="deep research"`

Expected: FAIL because `deep-research.js` does not exist.

- [ ] **Step 3: Implement the pure state-machine core**

Create centralized limits:

```js
export const DEEP_RESEARCH_LIMITS=Object.freeze({
  maxPasses:3,
  maxThemes:12,
  maxSearchRequests:30,
  maxPages:60,
  maxPagesPerDomain:8,
  maxResultsPerSearch:5,
  maxElapsedMs:5*60*1000
});
```

Planner theme IDs must come from a bounded known set such as `demand`, `expansion`, `investment`, `procurement`, `hiring`, `modernization`, `partnerships`, `regulation`, `competitors`, and signal-derived custom themes. Queries must incorporate market, offer, ICP and active signal language without exceeding backend query limits.

The state machine must never schedule actions that exceed limits and must produce a terminal stop reason: `coverage_reached`, `no_new_evidence`, `max_passes`, `budget_reached`, or `elapsed_time_reached`.

- [ ] **Step 4: Run unit tests**

Run: `cd backend && npm test -- --test-name-pattern="deep research"`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add deep research planning state machine`

---

### Task 4: Deep Research authenticated API and D1 persistence using existing run tables

**Files:**
- Create: `backend/src/deep-research-routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/test/deep-research-routes.test.mjs`

**Interfaces:**
- `POST /api/research/deep?workspace_id=...` → `{run_id,status,progress}`
- `POST /api/research/deep/:run_id/advance?workspace_id=...` → executes one bounded backend-owned batch and returns current run state.
- `GET /api/research/deep/:run_id?workspace_id=...` → read-only progress/result status.
- Persists state in existing `research_runs.request_json`, `research_runs.response_json`, and `run_events`.

- [ ] **Step 1: Write failing route/auth tests**

Tests must verify unauthenticated `401`, non-member `403`, missing workspace `400`, start creates a `research_runs` row with `candidate_budget=0`, GET only returns the caller workspace run, and advance refuses completed/cancelled runs.

- [ ] **Step 2: Verify RED**

Run: `cd backend && npm test -- --test-name-pattern="deep research route"`

Expected: FAIL on missing route handler.

- [ ] **Step 3: Implement routes without long-lived background execution**

Use the existing D1 run tables. Start stores the sanitized research context and initial planner state. Advance loads state, calls `nextDeepResearchAction`, executes only the bounded action batch, persists new state, records a `run_events` progress event, and returns. GET never advances work.

Modify the Worker entry to route Deep Research after CORS/auth context is established:

```js
const deep=await handleDeepResearchRoute(request,runtimeEnv,cors);
if(deep)return deep;
```

Do not use `ctx.waitUntil` as the sole execution mechanism; progress must survive page polling and request boundaries.

- [ ] **Step 4: Run route and full backend tests**

Run:

```bash
cd backend
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add persisted deep research run API`

---

### Task 5: Provider execution — OpenAI discovery, Firecrawl search/scrape, controlled Scrapling fallback

**Files:**
- Modify: `backend/src/deep-research.js`
- Modify: `backend/src/deep-research-routes.js`
- Modify: `backend/wrangler.toml`
- Create: `scrapling-service/app.py`
- Create: `scrapling-service/requirements.txt`
- Create: `scrapling-service/Dockerfile`
- Create: `scrapling-service/README.md`
- Test: `backend/test/deep-research-providers.test.mjs`

**Interfaces:**
- OpenAI: decrypt workspace OpenAI credential and call existing `searchWeb()`.
- Firecrawl: resolve workspace Firecrawl credential using existing service-integration storage; search and scrape through direct Firecrawl v2 when customer-owned, otherwise managed proxy.
- Scrapling: `POST ${SCRAPLING_API_URL}/extract` with bearer `SCRAPLING_API_TOKEN`, body `{url,mode:'ai'}`; used only after eligible Firecrawl extraction failure.

- [ ] **Step 1: Write failing provider/fallback tests**

Tests must verify:

```js
// Firecrawl failure on a high-value public URL + Scrapling configured => one Scrapling call.
// Firecrawl success => zero Scrapling calls.
// private URL => zero Firecrawl and zero Scrapling calls.
// OpenAI unavailable => Firecrawl evidence remains.
// Firecrawl unavailable => OpenAI evidence remains.
// Apollo strings/endpoints never occur in deep research modules.
```

- [ ] **Step 2: Verify RED**

Run: `cd backend && npm test -- --test-name-pattern="deep research provider"`

Expected: FAIL on missing execution adapters.

- [ ] **Step 3: Implement OpenAI + Firecrawl adapters**

Reuse `searchWeb` from `ai-provider.js`. Resolve/decrypt the workspace OpenAI row server-side. For Firecrawl, use `resolveWorkspaceServiceCredential(env,workspaceId,'firecrawl')`; customer credentials call `https://api.firecrawl.dev/v2/search` / `v2/scrape`, managed fallback calls the existing managed proxy routes. Sanitize all provider errors before persistence or response.

- [ ] **Step 4: Implement Scrapling service and adapter**

`requirements.txt`:

```txt
fastapi
uvicorn[standard]
scrapling[fetchers]
```

`app.py` exposes only `POST /extract`, validates a bearer token from `SCRAPLING_API_TOKEN`, validates public HTTP(S) URLs, performs a bounded `Fetcher.get()` first and `StealthyFetcher.fetch()` only when necessary, extracts AI-targeted readable text, and returns `{url,title,text,provider:'scrapling'}`. It must reject local/private targets and cap returned text size.

The backend adapter treats Scrapling as `unavailable` when `SCRAPLING_API_URL` / token are not configured; Deep Research still completes with OpenAI + Firecrawl and exposes provider-unavailable status rather than failing the run.

Add commented secret documentation to `backend/wrangler.toml`:

```toml
# SCRAPLING_API_URL
# SCRAPLING_API_TOKEN
```

- [ ] **Step 5: Run provider and full backend tests**

Run:

```bash
cd backend
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add deep research provider orchestration`

---

### Task 6: Frontend Deep Research controller, polling, progress ledger, and result handoff

**Files:**
- Create: `customer/deep-research-ui.js`
- Modify: `customer/process-map.js`
- Modify: `customer/app.js`
- Modify: `customer/index.html`
- Modify: `customer/market.css`
- Test: `customer/test/deep-research-ui.test.js`

**Interfaces:**
- `window.LeadIntelDeepResearch.start(context)` starts and auto-advances a run.
- Emits `leadintel:deep-research-progress` and `leadintel:deep-research-complete` events.
- Completion detail includes normalized `researchResults`, `researchStats`, `researchSourceStatus`, `researchStopReason`, and `runId`.

- [ ] **Step 1: Write failing controller/DOM tests**

Tests assert the module uses authenticated backend requests with `credentials:'include'`, calls start then `/advance`, has no provider secrets, renders provider rows for OpenAI/Firecrawl/Scrapling, and completion updates Market Strategy without reloading the page.

- [ ] **Step 2: Verify RED**

Run: `node --test customer/test/deep-research-ui.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement controller**

The controller obtains `workspace.id` from `window.LeadIntelServerBridge`, posts the sanitized profile/market context, then loops advance requests until terminal state. Between advances it updates a live ledger such as:

```text
Deep Research · Pass 2/3 · 14 searches · 32 pages examined · 18 usable sources
OpenAI Web Search  ✓  Firecrawl Search/Scrape ✓  Scrapling fallback — unavailable/not needed
```

The loop must stop on page unload, terminal status, authentication loss, or a hard client safety timeout. It must never call `location.reload()`.

- [ ] **Step 4: Wire completion into Market Strategy**

`runDeepMarketResearch()` passes the current research profile, ICPs and active signals to the controller. On completion, write the returned evidence/stats into `state.market`, rebuild opportunities via `LeadIntelMarket.buildMarketOpportunities`, save local state, and rerender. Set `researchMode='deep'` and retain the run ID/progress/stats.

- [ ] **Step 5: Run focused and full customer tests**

Run:

```bash
node --test customer/test/deep-research-ui.test.js customer/test/market-research-modes.test.js customer/test/openai-web-search-market.test.js customer/test/market-engine.test.js
npm --prefix backend test
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add interactive deep research workflow`

---

### Task 7: Research summary, evidence provenance UI, quality gates, and release verification

**Files:**
- Modify: `customer/app.js`
- Modify: `customer/market.css`
- Test: `customer/test/deep-research-summary.test.js`
- Modify: `docs/superpowers/plans/EXECUTION_STATUS.md`

**Interfaces:**
- Completion UI exposes themes, searches, pages examined, usable sources, primary sources, corroborated sources, providers used/unavailable, elapsed time, and stop reason.

- [ ] **Step 1: Write failing summary/provenance tests**

Tests require visible labels for `Pages examined`, `Usable sources`, `Primary sources`, `Corroborated`, provider provenance, and stop reason. They also require opportunity evidence rows to surface source type/quality when available.

- [ ] **Step 2: Verify RED**

Run: `node --test customer/test/deep-research-summary.test.js`

Expected: FAIL on missing summary UI.

- [ ] **Step 3: Implement completion summary and evidence metadata UI**

Add a compact completion strip above opportunities and source badges such as `Official`, `Industry`, `Supporting`, and `Discovery-only`. Do not expose internal provider errors or secrets. Show `Scrapling unavailable` distinctly from `Scrapling not needed`.

- [ ] **Step 4: Run full suites and syntax checks**

Run:

```bash
node --test customer/test/*.test.js
node --check customer/app.js
node --check customer/deep-research-ui.js
node --check customer/market-engine.js
cd backend && npm test
```

Expected: all PASS.

- [ ] **Step 5: Open PR and inspect scope**

Open a PR from `feat/deep-market-research` to `main`. Confirm changed files are limited to the approved research feature, provider adapter, tests, docs, and deployment metadata. Confirm no Apollo/CRM/Gmail behavior changed.

- [ ] **Step 6: Verify CI and merge**

Require Customer CI and Backend CI GREEN. Merge only after reviewing the PR patch and provider-security boundaries.

- [ ] **Step 7: Verify production exact SHA**

After merge, require:

- `main` SHA resolved;
- Vercel production READY on exact SHA;
- Cloudflare backend deployment/health green for exact SHA;
- Release Integrity green;
- live frontend contains both button IDs and Deep Research module version;
- live backend health returns 200.

Do not claim Scrapling is active unless `SCRAPLING_API_URL` is actually configured and a live extraction smoke test succeeds. If it is not configured, report Deep Research as operational with OpenAI + Firecrawl and Scrapling adapter ready but unavailable.

- [ ] **Step 8: Update execution status and commit final docs**

Record implementation status, exact production SHA, provider availability, and verification evidence in `docs/superpowers/plans/EXECUTION_STATUS.md`.
