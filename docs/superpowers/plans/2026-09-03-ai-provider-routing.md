# LeadIntel Multi-Provider AI Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-scoped multi-provider AI routing so OpenAI, Anthropic and Gemini can remain connected simultaneously while LeadIntel uses one provider per normal request, falls back only on retryable failures, and optionally performs second-model verification for high-value work.

**Architecture:** Preserve the existing encrypted BYOK adapters in `ai-provider.js`, add a focused pure routing-policy module for deterministic provider selection/retry decisions, store workspace routing settings separately in D1, and make `ai-routes.js` orchestrate credential resolution, attempts, audit and compatibility. Customer Settings replaces the single Active-provider concept with routing mode controls and per-provider Enabled state. OpenAI web search remains a separate source-backed capability and is not routed to Gemini/Anthropic.

**Tech Stack:** Cloudflare Workers, Cloudflare D1/SQLite migrations, Node.js 22 `node:test`, vanilla browser JavaScript/CSS, Vercel static frontend, GitHub Actions release-integrity pipeline.

**Spec:** `docs/superpowers/specs/2026-09-03-ai-provider-routing-design.md`

## Global Constraints

- Supported AI providers remain exactly `openai`, `anthropic`, `gemini`.
- Routing modes remain exactly `automatic`, `preferred`, `single`.
- Normal generation calls one provider initially and at most one fallback provider.
- Fallback is allowed only for timeout/network, 429, transient 5xx, or unusable/empty provider output.
- Authentication, invalid input/model/configuration and authorization failures must not silently fall back.
- Second-model verification is opt-in and must use a different enabled provider.
- API keys remain encrypted server-side and must never enter browser storage, status payloads, audit metadata or generated logs.
- Existing one-provider workspaces must continue to work.
- Existing active provider migrates to `preferred` routing.
- `/api/ai/web-search` remains OpenAI-specific; no false capability parity.
- Apollo, Firecrawl, Google/Gmail and CRM behavior are out of scope.
- Completion requires RED→GREEN evidence, full Backend/Customer suites, D1 migration, exact-SHA deployment proof, Vercel READY and Release Integrity green.

---

## File Structure

**Create**
- `backend/migrations/0014_ai_provider_routing.sql` — routing settings table, provider `enabled` column and compatibility backfill.
- `backend/src/ai-routing.js` — pure routing mode/task policy, provider ordering, retry classification helpers and verification-provider selection.
- `backend/test/ai-routing.test.mjs` — focused policy tests independent of D1/HTTP.

**Modify**
- `backend/src/ai-provider.js` — attach safe retry metadata to provider errors without exposing upstream messages or secrets.
- `backend/src/ai-routes.js` — routing settings endpoints, enabled-provider endpoint, multi-provider generation orchestration, compatibility behavior and audit metadata.
- `backend/test/ai-provider.test.mjs` — retryability/error-metadata regressions.
- `backend/test/ai-integration-routes.test.mjs` — route/storage/security/generation orchestration contracts.
- `customer/ai-settings.js` — routing panel, enabled controls, status summary, save behavior.
- `customer/ai-settings.css` — routing controls and enabled-state presentation.
- `customer/process-map.js` — cache-bust AI settings asset import.
- `customer/test/ai-settings.test.js` — three modes, enabled state, no secret persistence, no old single-active UX.
- `.github/workflows/backend-ci.yml` and/or `.github/workflows/customer-ci.yml` only if needed to ensure the new files are covered by syntax/test/release paths; do not change unrelated release policy.

---

### Task 1: Add durable routing settings and migration compatibility

**Files:**
- Create: `backend/migrations/0014_ai_provider_routing.sql`
- Test: `backend/test/ai-integration-routes.test.mjs`

**Interfaces:**
- Produces D1 columns/table consumed by Tasks 3–5:
  - `workspace_ai_integrations.enabled INTEGER NOT NULL DEFAULT 1`
  - `workspace_ai_routing_settings(workspace_id, mode, preferred_provider, fallback_provider, updated_at)`

- [ ] **Step 1: Write the failing migration contract test**

Add assertions that migration `0014_ai_provider_routing.sql` exists and contains the exact routing schema, enabled column, mode check and active-provider backfill. The test must require a grouped backfill so every workspace with configured AI receives one routing row and the legacy active provider becomes `preferred_provider` with mode `preferred`.

```js
const migrationPath=path.join(process.cwd(),'migrations','0014_ai_provider_routing.sql');
const migration=fs.existsSync(migrationPath)?fs.readFileSync(migrationPath,'utf8'):'';

test('AI routing migration preserves existing credentials and maps legacy active provider to preferred routing',()=>{
  assert.equal(fs.existsSync(migrationPath),true);
  assert.match(migration,/ALTER TABLE workspace_ai_integrations ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS workspace_ai_routing_settings/);
  assert.match(migration,/mode TEXT NOT NULL DEFAULT 'automatic' CHECK \(mode IN \('automatic','preferred','single'\)\)/);
  assert.match(migration,/preferred_provider TEXT/);
  assert.match(migration,/fallback_provider TEXT/);
  assert.match(migration,/CASE WHEN MAX\(active\)=1 THEN 'preferred' ELSE 'automatic' END/);
  assert.match(migration,/MAX\(CASE WHEN active=1 THEN provider END\)/);
  assert.doesNotMatch(migration,/DROP TABLE workspace_ai_integrations/);
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run from `backend/`:

```bash
node --test test/ai-integration-routes.test.mjs
```

Expected: FAIL because `0014_ai_provider_routing.sql` does not exist.

- [ ] **Step 3: Create the migration**

Use this migration shape:

```sql
PRAGMA foreign_keys = ON;

ALTER TABLE workspace_ai_integrations
  ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1));

CREATE TABLE IF NOT EXISTS workspace_ai_routing_settings (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'automatic' CHECK (mode IN ('automatic','preferred','single')),
  preferred_provider TEXT CHECK (preferred_provider IS NULL OR preferred_provider IN ('openai','anthropic','gemini')),
  fallback_provider TEXT CHECK (fallback_provider IS NULL OR fallback_provider IN ('openai','anthropic','gemini')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO workspace_ai_routing_settings(
  workspace_id,mode,preferred_provider,fallback_provider,updated_at
)
SELECT
  workspace_id,
  CASE WHEN MAX(active)=1 THEN 'preferred' ELSE 'automatic' END,
  MAX(CASE WHEN active=1 THEN provider END),
  NULL,
  CURRENT_TIMESTAMP
FROM workspace_ai_integrations
GROUP BY workspace_id;
```

Do not remove the legacy `active` column or one-active index in this milestone.

- [ ] **Step 4: Run targeted test and local migration**

```bash
node --test test/ai-integration-routes.test.mjs
npx wrangler d1 migrations apply leadintel --local
```

Expected: PASS; migration applies without deleting existing tables.

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/0014_ai_provider_routing.sql backend/test/ai-integration-routes.test.mjs
git commit -m "feat: add AI routing persistence"
```

---

### Task 2: Add deterministic routing policy and safe retry classification

**Files:**
- Create: `backend/src/ai-routing.js`
- Create: `backend/test/ai-routing.test.mjs`
- Modify: `backend/src/ai-provider.js`
- Modify: `backend/test/ai-provider.test.mjs`

**Interfaces:**
- Produces:
  - `ROUTING_MODES`
  - `normalizeRoutingMode(value)`
  - `normalizeTaskType(value)`
  - `providerOrder({mode,taskType,preferredProvider,fallbackProvider,integrations})`
  - `verificationProvider({primaryProvider,integrations,taskType})`
  - `isRetryableAiError(error)`
- `generateText()` continues returning `{provider,model,text,usage}` and throws sanitized `Error` objects with safe non-secret properties `status`, `code`, `retryable`.

- [ ] **Step 1: Write failing policy tests**

Cover these exact expectations:

```js
assert.deepEqual(providerOrder({mode:'automatic',taskType:'strategy',integrations:enabledAll}),['openai','anthropic','gemini']);
assert.deepEqual(providerOrder({mode:'automatic',taskType:'content',integrations:enabledAll}),['anthropic','openai','gemini']);
assert.deepEqual(providerOrder({mode:'automatic',taskType:'summary',integrations:enabledAll}),['gemini','openai','anthropic']);
assert.deepEqual(providerOrder({mode:'preferred',preferredProvider:'openai',fallbackProvider:'gemini',integrations:enabledAll}),['openai','gemini']);
assert.deepEqual(providerOrder({mode:'single',preferredProvider:'anthropic',fallbackProvider:'gemini',integrations:enabledAll}),['anthropic']);
assert.deepEqual(providerOrder({mode:'automatic',taskType:'summary',integrations:[{provider:'openai',enabled:true},{provider:'gemini',enabled:false}]}),['openai']);
assert.equal(verificationProvider({primaryProvider:'openai',integrations:enabledAll,taskType:'strategy'}),'anthropic');
```

Also assert `isRetryableAiError()` is true for safe provider errors carrying 408, 429, 500–599 or `code='EMPTY_RESPONSE'`, and false for 400, 401, 403 and validation/configuration errors.

- [ ] **Step 2: Run policy tests and verify RED**

```bash
node --test test/ai-routing.test.mjs test/ai-provider.test.mjs
```

Expected: FAIL because `ai-routing.js` and retry metadata do not exist.

- [ ] **Step 3: Implement `ai-routing.js`**

Use constant task families:

```js
const AUTOMATIC_ORDER=Object.freeze({
  strategy:['openai','anthropic','gemini'],
  qualification:['openai','anthropic','gemini'],
  reasoning:['openai','anthropic','gemini'],
  general:['openai','anthropic','gemini'],
  content:['anthropic','openai','gemini'],
  copywriting:['anthropic','openai','gemini'],
  summary:['gemini','openai','anthropic'],
  extraction:['gemini','openai','anthropic'],
  classification:['gemini','openai','anthropic']
});
```

Filter every order against configured + `enabled===true` integrations, deduplicate providers, and cap normal orders to two attempts at the orchestration layer. Unknown/missing task types place a configured preferred provider first, then the default `openai → anthropic → gemini` order.

- [ ] **Step 4: Preserve safe provider error metadata**

In `ai-provider.js`, keep the current sanitized messages but attach only safe diagnostics:

```js
function providerError(message,{status=0,code='',param='',retryable=false}={}){
  const error=new Error(message);
  error.name='AiProviderError';
  error.status=Number(status)||0;
  error.code=safeDiagnosticToken(code);
  error.param=safeDiagnosticToken(param);
  error.retryable=Boolean(retryable);
  return error;
}
```

Provider HTTP errors are retryable only when status is `408`, `429` or `>=500`. Network/unknown adapter failures become sanitized retryable 502 errors. Empty provider output becomes sanitized retryable 502 with `code='EMPTY_RESPONSE'`. Input/model/key validation remains non-retryable.

- [ ] **Step 5: Run targeted tests and commit**

```bash
node --test test/ai-routing.test.mjs test/ai-provider.test.mjs
git add backend/src/ai-routing.js backend/src/ai-provider.js backend/test/ai-routing.test.mjs backend/test/ai-provider.test.mjs
git commit -m "feat: add deterministic AI routing policy"
```

---

### Task 3: Add routing settings and provider-enabled APIs

**Files:**
- Modify: `backend/src/ai-routes.js`
- Modify: `backend/test/ai-integration-routes.test.mjs`

**Interfaces:**
- Extend `GET /api/integrations/ai/status` with:
  - `routing: {mode,preferred_provider,fallback_provider}`
  - each provider `{configured,enabled,active,model,key_hint,verified_at,last_used_at}`
- Add owner-only `PUT /api/integrations/ai/routing`.
- Add owner-only `POST /api/integrations/ai/provider-enabled`.
- Preserve `/api/integrations/ai/activate` as a legacy compatibility route that updates legacy `active` and routing preference together.

- [ ] **Step 1: Write failing route/source contracts**

Require both new routes, owner-only authorization, `enabled` in provider status, `routing` in status, validation that preferred/fallback providers are configured, and no encrypted key in responses.

Also require provider save to stop using `UPDATE workspace_ai_integrations SET active=0` as the normal new-client behavior.

- [ ] **Step 2: Run route tests and verify RED**

```bash
node --test test/ai-integration-routes.test.mjs
```

- [ ] **Step 3: Implement routing settings helpers**

Add helpers in `ai-routes.js` to:

```js
async function routingSettings(env,workspaceId){ /* load persisted row or derive compatibility default */ }
async function configuredIntegrations(env,workspaceId){ /* load provider encrypted key/model/enabled/active */ }
function validateRoutingSelection(mode,preferred,fallback,integrations){ /* deterministic 400/409 validation */ }
```

Rules:
- `automatic`: preferred/fallback may be null; preferred may be stored as a tiebreaker.
- `preferred`: preferred required; fallback optional; fallback must differ from preferred.
- `single`: preferred required; fallback stored as null.
- selected providers must be configured and enabled.

- [ ] **Step 4: Implement write endpoints and compatibility**

`PUT /api/integrations/ai/routing` upserts one settings row. `POST /api/integrations/ai/provider-enabled` updates only the selected provider's `enabled`; it must reject disabling the only provider required by `single` mode or the preferred provider in `preferred` mode unless routing is changed first.

Legacy `/activate` updates the old active marker and upserts `mode='preferred', preferred_provider=<provider>` so cached older frontend code still produces a valid routing state.

Provider `PUT` continues encrypting/verifying credentials. Saving a provider must not disable any other provider. New-client saves default the saved provider to `enabled=1`.

- [ ] **Step 5: Keep OpenAI web search capability-specific**

Require an OpenAI row that is both configured and enabled. If unavailable, return 409 with a stable user-correctable message. Do not call the generic router and do not add Gemini/Anthropic search adapters in this milestone.

- [ ] **Step 6: Run route tests and commit**

```bash
node --test test/ai-integration-routes.test.mjs
git add backend/src/ai-routes.js backend/test/ai-integration-routes.test.mjs
git commit -m "feat: add AI routing settings APIs"
```

---

### Task 4: Route generation with one retryable fallback and opt-in second-model verification

**Files:**
- Modify: `backend/src/ai-routes.js`
- Modify: `backend/test/ai-integration-routes.test.mjs`
- Modify: `backend/test/ai-routing.test.mjs`

**Interfaces:**
- `POST /api/ai/generate` accepts `task_type` and `verification`.
- Response preserves top-level primary `{provider,model,text,usage}` and adds:

```json
{
  "routing": {
    "mode": "automatic",
    "attempted_providers": ["openai"],
    "fallback_used": false
  },
  "verification": {
    "status": "completed|unavailable|failed",
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "text": "...",
    "usage": {"input_tokens":0,"output_tokens":0}
  }
}
```

`verification` is omitted when not requested.

- [ ] **Step 1: Write failing generation orchestration tests**

Use injected/fake provider calls or source-level contract tests to prove:
- strategy automatic selects OpenAI when enabled;
- summary automatic selects Gemini when enabled;
- retryable OpenAI 429 calls exactly one fallback provider;
- OpenAI 401/400 does not call fallback;
- single mode never calls fallback;
- attempted providers are recorded in order;
- second-model verification uses a different provider only after primary succeeds;
- no second provider returns `verification.status='unavailable'` while primary still succeeds;
- verifier failure returns `verification.status='failed'` without changing the successful primary answer.

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test test/ai-routing.test.mjs test/ai-integration-routes.test.mjs
```

- [ ] **Step 3: Implement sequential orchestration**

For normal generation:
1. load routing settings + configured enabled integrations;
2. compute order using `providerOrder()`;
3. take at most the first two eligible providers;
4. decrypt/call first provider;
5. on `isRetryableAiError(error)`, call the second provider once;
6. otherwise surface the sanitized error immediately;
7. update `last_used_at` only for providers actually called.

Never dispatch provider calls in parallel.

- [ ] **Step 4: Implement verification prompt and result**

When `verification==='second_model'`, select a different enabled provider and call it after primary success with this fixed review instruction:

```text
Review the primary LeadIntel answer as a critical second model. Identify only material errors, unsupported assumptions, missed risks, or important omissions. Do not rewrite the answer for style. Return a compact verification note with: Verdict, Material issues, Missed risks, Confidence.
```

The user prompt must include the original task plus the primary answer, bounded to the existing prompt limits. Never log the full verification prompt or answer in audit metadata.

- [ ] **Step 5: Extend audit metadata safely**

Audit `ai.generation_completed` with provider/model, `task_type`, routing mode, attempted provider list, `fallback_used`, primary token usage, and verification provider/model/status when present. No API keys, prompts, system instructions, generated text or verification text.

- [ ] **Step 6: Run targeted backend suite and commit**

```bash
node --test test/ai-routing.test.mjs test/ai-provider.test.mjs test/ai-integration-routes.test.mjs
git add backend/src/ai-routes.js backend/test/ai-routing.test.mjs backend/test/ai-integration-routes.test.mjs
git commit -m "feat: route AI generation with controlled fallback"
```

---

### Task 5: Replace single Active-provider Settings UX with routing controls

**Files:**
- Modify: `customer/ai-settings.js`
- Modify: `customer/ai-settings.css`
- Modify: `customer/process-map.js`
- Modify: `customer/test/ai-settings.test.js`

**Interfaces:**
- Reads `status.routing` and provider `enabled` from `/api/integrations/ai/status`.
- Writes routing through `PUT /api/integrations/ai/routing`.
- Writes provider enabled state through `POST /api/integrations/ai/provider-enabled`.

- [ ] **Step 1: Write failing Customer Settings contracts**

Require UI text/controls for:
- `Automatic — Recommended`
- `Preferred + fallback`
- `Single provider`
- provider `Enabled` toggle
- effective status line examples such as `one provider per request`

Require the new routes and assert the new module no longer renders `Use this provider` as the main provider selection mechanism.

Keep all existing key-security tests: no `localStorage`, `sessionStorage`, `setItem()`, plaintext key echo or platform secret names.

- [ ] **Step 2: Run Customer test and verify RED**

```bash
node --test customer/test/ai-settings.test.js
```

Expected: FAIL because routing controls do not exist and old Active UI remains.

- [ ] **Step 3: Add routing panel to the existing drawer**

Add a section before provider cards with radio/select controls. Automatic copy must say:

```text
LeadIntel selects one connected AI for each task and uses another only if the first provider has a retryable failure.
```

Preferred mode exposes Preferred Provider + Fallback Provider. Single mode exposes one Provider selector. Only configured + enabled providers appear as selectable options.

- [ ] **Step 4: Convert provider cards from Active to Enabled**

Provider cards retain API key, model, masked key hint, verified/last-used times, Test & save and Disconnect. Replace `Use this provider` with an Enabled toggle/action that does not delete credentials.

Saving a credential clears the transient key only on success and refreshes status; failure keeps the current inline error behavior and does not clear the transient key.

- [ ] **Step 5: Update status/readiness presentation and cache version**

AI summary examples:
- `Automatic · OpenAI, Gemini enabled · one provider per request`
- `Preferred · OpenAI → Gemini fallback`
- `Single · Anthropic only`

Count AI readiness as true when at least one configured provider is enabled and the routing configuration is valid. Preserve Apollo/Firecrawl/Google/Gmail monitoring unchanged.

Bump `SETTINGS_VERSION` and the import token in `customer/process-map.js` to `20260903-ai-provider-routing-v1`.

- [ ] **Step 6: Run Customer tests/syntax and commit**

```bash
node --test customer/test/*.test.js
node --check customer/ai-settings.js
node --check customer/process-map.js
git add customer/ai-settings.js customer/ai-settings.css customer/process-map.js customer/test/ai-settings.test.js
git commit -m "feat: add multi-provider AI routing settings"
```

---

### Task 6: Full regression, CI, PR and exact-SHA release verification

**Files:**
- Modify CI only if the new source/test files are not already covered.
- No production behavior changes unless a failing regression identifies a real defect.

**Interfaces:**
- Produces a reviewable PR from `feat/ai-provider-router` to `main` and exact-SHA production evidence after merge/deploy.

- [ ] **Step 1: Run full backend suite**

```bash
cd backend
npm test
node --check src/ai-provider.js
node --check src/ai-routing.js
node --check src/ai-routes.js
npm audit --audit-level=high
```

Expected: all tests PASS, syntax PASS, no high-severity dependency findings.

- [ ] **Step 2: Run full customer suite**

From repository root:

```bash
node --test customer/test/*.test.js
node --check customer/ai-settings.js
node --check customer/process-map.js
node --check scripts/release-integrity-core.mjs
node --check scripts/verify-release-integrity.mjs
```

Expected: all PASS.

- [ ] **Step 3: Rebase/compare against current `main` before PR**

Confirm no later production changes conflict with AI integration, release integrity, CRM, service integrations, or Settings. Resolve only relevant conflicts; do not fold unrelated open PR #50 into this milestone.

- [ ] **Step 4: Open PR**

PR title:

```text
Add multi-provider AI routing
```

PR body must state:
- multiple AI providers stay enabled simultaneously;
- automatic/preferred/single modes;
- one normal provider call + one retryable fallback maximum;
- opt-in second-model verification;
- OpenAI web search remains OpenAI-specific;
- encrypted BYOK unchanged;
- Apollo/Firecrawl/Google/Gmail/CRM unchanged;
- RED→GREEN evidence and exact branch SHA.

- [ ] **Step 5: Require CI green before merge**

Verify Backend CI and Customer V2 CI are green on the PR head SHA. If either fails, inspect the failing job, fix on the same branch, rerun the full local-equivalent suite, and update the PR.

- [ ] **Step 6: Merge only after green CI and then verify deployment**

After merge, verify:
- D1 `0014_ai_provider_routing.sql` applied remotely;
- Cloudflare backend deployment corresponds to the merged SHA;
- `/api/health` returns 200;
- Vercel production is READY on the same intended release;
- authenticated Settings shows all three routing modes;
- smoke path: save two providers → enable both → Automatic → generate strategy → provider metadata present;
- simulated/controlled retryable failure proves one fallback without duplicate normal calls;
- Single mode proves no cross-provider fallback;
- OpenAI web search remains source-backed and OpenAI-specific;
- Release Integrity exact-SHA proof is green.

- [ ] **Step 7: Final completion report**

Report only evidence-backed facts: merged SHA, migration status, Backend CI, Customer V2 CI, Vercel READY, Cloudflare health, authenticated routing smoke result, fallback smoke result and Release Integrity result. Do not claim complete if any item is missing or inferred.
