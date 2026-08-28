# LeadIntel Master CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a durable, workspace-scoped D1 Master CRM that becomes LeadIntel's permanent commercial memory while preserving the existing seven-stage customer workflow and 500 KB synced state budget.

**Architecture:** CRM data lives in dedicated Cloudflare D1 tables and is accessed through authenticated workspace-scoped APIs. Existing customer/local state remains the fast workflow cache; Discovery, Pipeline, Content, Gmail, Replies and Learning progressively write/read durable CRM records. Pipeline becomes a CRM view, never the sole system of record.

**Tech Stack:** Cloudflare Workers, D1 SQLite, vanilla JavaScript, Node.js built-in test runner, Vercel static deployment, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-28-master-crm-design.md`

## Global Constraints

- CRM records MUST NOT be embedded in the existing 500 KB synchronized customer-state payload.
- Removing a company from the active pipeline MUST preserve company, contact, intelligence and activity history.
- Company canonical dedupe key is `workspace_id + normalized_domain`.
- Contact canonical dedupe key is `workspace_id + normalized_email` when an email exists.
- Company name alone MUST NOT trigger automatic merging.
- Lifecycle and pipeline stage are separate states.
- Suppressed companies MUST NOT be re-added to active pipeline by normal Discovery actions.
- Permanent company deletion is owner-only and destructive; normal "Remove" means remove from pipeline, not delete.
- Existing local pipeline data MUST migrate idempotently and MUST NOT be deleted during the first migration milestone.
- CRM writes MUST NOT claim success when the backend is unavailable.
- Vercel remains the frontend deployment system.
- Cloudflare Worker + D1 remains the backend/system-of-record platform.
- GitHub Pages deployment MUST NOT be restored.
- No real secrets, OAuth tokens, provider keys, `CLIENT ID/`, untracked spreadsheets, blueprints or private documents may be committed.
- Every behavior is implemented through observed RED → GREEN TDD.
- Every implementation task ends with a commit and remote push.
- Never force-push the CRM branch.
- Production is changed only after green tests, reviewed merge and explicit release verification.

---

# Recovery-Safe Execution Protocol

This protocol is mandatory for every task below.

## Worktree / branch

Target branch:

```text
feature/master-crm
```

Preferred isolated workspace:

```text
.worktrees/master-crm
```

Before creation:

```bash
git fetch origin
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
git check-ignore -q .worktrees
```

If `.worktrees` is not ignored, add:

```text
.worktrees/
```

to `.gitignore`, commit it on `main`, push it, then create the worktree.

Create:

```bash
git worktree add .worktrees/master-crm -b feature/master-crm origin/main
cd .worktrees/master-crm
```

## Baseline

Run:

```bash
cd backend && npm ci && npm test
cd ..
node --test customer/test/*.test.js
```

Both suites must be green before CRM implementation begins.

## Checkpoint rule

At the end of **every task**:

```bash
git status --short
git add <only-files-for-this-task>
git diff --cached --check
git commit -m "<task commit message>"
git push -u origin feature/master-crm
git status --short --branch
```

Then verify the remote SHA:

```bash
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git ls-remote origin refs/heads/feature/master-crm | awk '{print $1}')
test "$LOCAL_SHA" = "$REMOTE_SHA"
```

Expected: command exits `0`.

This remote-SHA equality check is the permanent "never lose updates" gate.

---

# File / Module Structure

## Backend

Create:

```text
backend/migrations/0011_master_crm.sql
backend/src/crm.js
backend/src/crm-routes.js
backend/test/crm-schema.test.mjs
backend/test/crm.test.mjs
backend/test/crm-routes.test.mjs
backend/test/crm-migration.test.mjs
```

Responsibilities:

- `crm.js` — normalization, validation, repository/service functions, lifecycle/pipeline transition rules.
- `crm-routes.js` — HTTP parsing, auth/workspace enforcement handoff, CRM API responses.
- `0011_master_crm.sql` — companies, contacts, intelligence, activity tables and indexes.
- tests split schema/domain/API/migration behavior.

Modify existing backend routing only at the narrow integration points.

## Customer

Create:

```text
customer/crm-engine.js
customer/crm-ui.js
customer/crm.css
customer/test/crm-engine.test.js
customer/test/crm-structure.test.js
customer/test/crm-integration.test.js
customer/test/crm-migration.test.js
```

Responsibilities:

- `crm-engine.js` — browser-safe normalization/mapping/view helpers only; no server authority.
- `crm-ui.js` — CRM navigation, list, filters, detail drawer, action handlers.
- `crm.css` — CRM-only presentation.
- `server-bridge.js` — authenticated transport to CRM routes.
- Discovery/Outreach/Delivery modules emit CRM mutations through bridge interfaces.

Do not turn `app.js` into a CRM monolith.

---

# Task 1 — Commit the approved spec and implementation plan

**Files:**
- Create: `docs/superpowers/specs/2026-08-28-master-crm-design.md`
- Create: `docs/superpowers/plans/2026-08-28-master-crm.md`

**Produces:**
- Canonical reviewed spec and executable plan travel with the codebase.

- [ ] **Step 1: Copy the approved design specification into the repo**

Use the exact approved file contents with no semantic changes.

- [ ] **Step 2: Copy this implementation plan into the repo**

Target:

```text
docs/superpowers/plans/2026-08-28-master-crm.md
```

- [ ] **Step 3: Verify no unfinished-work markers**

Run:

```bash
pattern="$(printf '%s|%s|%s' T''BD T''ODO F''IXME)"
grep -RniE "\b(${pattern})\b" \
  docs/superpowers/specs/2026-08-28-master-crm-design.md \
  docs/superpowers/plans/2026-08-28-master-crm.md
```

Expected: no output.

- [ ] **Step 4: Commit and push checkpoint**

```bash
git add docs/superpowers/specs/2026-08-28-master-crm-design.md \
        docs/superpowers/plans/2026-08-28-master-crm.md
git diff --cached --check
git commit -m "docs: lock master crm architecture"
git push -u origin feature/master-crm
```

Verify local/remote SHA equality using the global checkpoint rule.

---

# Task 2 — D1 CRM schema

**Files:**
- Create: `backend/migrations/0011_master_crm.sql`
- Create: `backend/test/crm-schema.test.mjs`

**Interfaces:**
- Produces tables: `crm_companies`, `crm_contacts`, `crm_intelligence`, `crm_activities`.
- Later backend tasks depend on exact column names from the spec.

- [ ] **Step 1: Write failing schema test**

Create `backend/test/crm-schema.test.mjs` that loads the migration file and asserts:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(
  path.join(__dirname, '..', 'migrations', '0011_master_crm.sql'),
  'utf8'
);

test('master crm migration defines all durable crm tables', () => {
  for (const table of [
    'crm_companies',
    'crm_contacts',
    'crm_intelligence',
    'crm_activities'
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}`, 'i'));
  }
});

test('companies enforce workspace domain deduplication', () => {
  assert.match(
    migration,
    /UNIQUE\s*\(\s*workspace_id\s*,\s*normalized_domain\s*\)/i
  );
});

test('crm tables remain workspace scoped', () => {
  for (const table of ['crm_companies','crm_contacts','crm_intelligence','crm_activities']) {
    const section = migration.split(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}`, 'i'))[1] || '';
    assert.match(section.split(';')[0], /workspace_id\s+TEXT\s+NOT NULL/i);
  }
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend
node --test test/crm-schema.test.mjs
```

Expected: FAIL because `0011_master_crm.sql` does not exist.

- [ ] **Step 3: Implement migration**

Create schema matching the approved spec. Include:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_companies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  normalized_domain TEXT,
  company_name TEXT NOT NULL,
  website TEXT,
  country TEXT,
  industry TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'prospect'
    CHECK (lifecycle_status IN ('prospect','customer','archived','suppressed')),
  pipeline_stage TEXT
    CHECK (
      pipeline_stage IS NULL OR pipeline_stage IN (
        'Discovered','Qualified','Ready for Outreach','Contacted',
        'Replied','Meeting','Proposal','Won','Lost'
      )
    ),
  opportunity_score INTEGER,
  confidence TEXT,
  source TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  suppressed_at TEXT,
  customer_since TEXT,
  deleted_at TEXT,
  UNIQUE(workspace_id, normalized_domain)
);
```

Add the approved contacts, intelligence and activities tables plus indexes.

- [ ] **Step 4: Verify GREEN**

```bash
cd backend
node --test test/crm-schema.test.mjs
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit/push**

```bash
git add backend/migrations/0011_master_crm.sql backend/test/crm-schema.test.mjs
git commit -m "feat: add master crm schema"
git push
```

Verify remote SHA equality.

---

# Task 3 — CRM domain model and normalization

**Files:**
- Create: `backend/src/crm.js`
- Create: `backend/test/crm.test.mjs`

**Interfaces:**
- Produces:
  - `normalizeDomain(value): string`
  - `normalizeEmail(value): string`
  - `validateLifecycle(value): string`
  - `validatePipelineStage(value, {allowNull=true}): string|null`
  - `nextPipelineStage(current, requested): string|null`
  - `canRestoreSuppressed(role): boolean`
  - repository/service exports used by `crm-routes.js`.

- [ ] **Step 1: Write failing normalization tests**

Required cases:

```js
assert.equal(normalizeDomain('https://WWW.Example.com/products?a=1'), 'example.com');
assert.equal(normalizeDomain('example.com/'), 'example.com');
assert.equal(normalizeDomain(''), '');
assert.equal(normalizeEmail(' Buyer@Example.COM '), 'buyer@example.com');
```

Add invalid lifecycle/stage tests and stage-forward behavior tests.

- [ ] **Step 2: Verify RED**

```bash
cd backend
node --test test/crm.test.mjs
```

Expected: FAIL because module/functions do not exist.

- [ ] **Step 3: Implement minimal pure functions**

Use URL parsing where possible. Domain normalization must not silently invent a domain from arbitrary text.

Define canonical sets:

```js
export const CRM_LIFECYCLES = Object.freeze([
  'prospect','customer','archived','suppressed'
]);

export const CRM_PIPELINE_STAGES = Object.freeze([
  'Discovered','Qualified','Ready for Outreach','Contacted',
  'Replied','Meeting','Proposal','Won','Lost'
]);
```

- [ ] **Step 4: Verify GREEN**

```bash
cd backend
node --test test/crm.test.mjs
npm test
```

- [ ] **Step 5: Commit/push**

```bash
git add backend/src/crm.js backend/test/crm.test.mjs
git commit -m "feat: add crm domain rules"
git push
```

Verify remote SHA equality.

---

# Task 4 — Company, intelligence and contact persistence service

**Files:**
- Modify: `backend/src/crm.js`
- Modify: `backend/test/crm.test.mjs`

**Interfaces:**
- Produces service functions:
  - `upsertCrmCompany(db, context, input)`
  - `getCrmCompany(db, context, companyId)`
  - `listCrmCompanies(db, context, filters)`
  - `upsertCrmContacts(db, context, companyId, contacts)`
  - `upsertCrmIntelligence(db, context, companyId, intelligence)`
  - `appendCrmActivity(db, context, activity)`

`context` includes authenticated workspace/user data already resolved by the server:

```js
{
  workspaceId,
  userId,
  role
}
```

- [ ] **Step 1: Add failing repository tests using the project's existing D1 mock/test pattern**

Required tests:

1. same workspace + same normalized domain → one company;
2. same domain in two workspaces → two isolated records;
3. no-domain companies are not auto-merged by name;
4. duplicate normalized work email → one contact;
5. intelligence upsert replaces current snapshot, not company history;
6. activity insert is append-only.

- [ ] **Step 2: Verify RED**

```bash
cd backend
node --test test/crm.test.mjs
```

- [ ] **Step 3: Implement transaction-safe upserts**

Company upsert must:

- normalize the domain;
- lookup existing company by workspace+domain;
- update `last_seen_at`, score/confidence, safe fields;
- preserve lifecycle/pipeline unless the caller explicitly requests a valid transition;
- create `company.saved` or `intelligence.updated` activity as appropriate.

Do not allow a rediscovery upsert to unsuppress a suppressed company.

- [ ] **Step 4: Verify GREEN**

```bash
cd backend
node --test test/crm.test.mjs
npm test
```

- [ ] **Step 5: Commit/push**

```bash
git add backend/src/crm.js backend/test/crm.test.mjs
git commit -m "feat: persist crm companies contacts intelligence"
git push
```

Verify remote SHA equality.

---

# Task 5 — CRM API routes and authorization

**Files:**
- Create: `backend/src/crm-routes.js`
- Create: `backend/test/crm-routes.test.mjs`
- Modify: `backend/src/app.js`
- Modify existing auth/workspace helper only if required.

**Interfaces:**
- Routes implement exact spec endpoints under `/api/crm/...`.
- Must reuse existing session/workspace authorization patterns.

- [ ] **Step 1: Write route tests**

Cover:

```text
GET    /api/crm/companies
POST   /api/crm/companies
GET    /api/crm/companies/:id
PATCH  /api/crm/companies/:id
POST   /api/crm/companies/:id/pipeline
DELETE /api/crm/companies/:id/pipeline
POST   /api/crm/companies/:id/archive
POST   /api/crm/companies/:id/restore
POST   /api/crm/companies/:id/suppress
POST   /api/crm/companies/:id/mark-customer
DELETE /api/crm/companies/:id
POST   /api/crm/companies/:id/contacts
PATCH  /api/crm/contacts/:id
DELETE /api/crm/contacts/:id
GET    /api/crm/companies/:id/activities
```

Required security cases:

- unauthenticated → 401;
- authenticated but not workspace member → 403;
- other workspace's company ID → 404/403 without leaking record existence;
- permanent delete by non-owner → 403;
- normal add-to-pipeline on suppressed company → 409 `CRM_COMPANY_SUPPRESSED`.

- [ ] **Step 2: Verify RED**

```bash
cd backend
node --test test/crm-routes.test.mjs
```

- [ ] **Step 3: Implement route dispatcher**

`crm-routes.js` should expose a focused handler such as:

```js
export async function handleCrmRequest(request, env, context) {
  // return Response or null when route is not CRM
}
```

Wire it before generic fallback routing in `app.js`, following existing route ordering.

- [ ] **Step 4: Verify GREEN and route regression**

```bash
cd backend
node --test test/crm-routes.test.mjs
npm test
node --check src/crm.js
node --check src/crm-routes.js
node --check src/app.js
```

- [ ] **Step 5: Commit/push**

```bash
git add backend/src/crm-routes.js backend/test/crm-routes.test.mjs backend/src/app.js
git commit -m "feat: expose workspace scoped crm api"
git push
```

Verify remote SHA equality.

---

# Task 6 — Lifecycle, pipeline transitions and suppression

**Files:**
- Modify: `backend/src/crm.js`
- Modify: `backend/src/crm-routes.js`
- Modify tests from Tasks 3–5.

**Interfaces:**
- `setCrmPipelineStage(...)`
- `removeCrmFromPipeline(...)`
- `archiveCrmCompany(...)`
- `restoreCrmCompany(...)`
- `suppressCrmCompany(...)`
- `markCrmCustomer(...)`
- `deleteCrmCompany(...)`

- [ ] **Step 1: Add failing transition tests**

Exact required assertions:

- remove pipeline → stage NULL, company remains;
- archive → lifecycle archived + stage NULL;
- restore archive → prospect + stage NULL;
- suppress → suppressed + stage NULL;
- regular restore of suppressed company forbidden;
- owner explicit unsuppress allowed;
- mark customer → customer;
- permanent delete non-owner forbidden;
- every transition emits an activity.

- [ ] **Step 2: Verify RED**

```bash
cd backend
node --test test/crm.test.mjs test/crm-routes.test.mjs
```

- [ ] **Step 3: Implement transitions**

All state changes use backend service functions; the browser must not fabricate successful transition state.

- [ ] **Step 4: Verify GREEN**

```bash
cd backend
npm test
```

- [ ] **Step 5: Commit/push**

```bash
git add backend/src/crm.js backend/src/crm-routes.js backend/test/crm.test.mjs backend/test/crm-routes.test.mjs
git commit -m "feat: enforce crm lifecycle and pipeline rules"
git push
```

Verify remote SHA equality.

---

# Task 7 — Browser CRM engine and server bridge

**Files:**
- Create: `customer/crm-engine.js`
- Create: `customer/test/crm-engine.test.js`
- Modify: `customer/server-bridge.js`
- Create/Modify: `customer/test/crm-integration.test.js`

**Interfaces:**
`crm-engine.js` produces pure helpers:

- `normalizeCrmCompany(value)`
- `crmCompanyBadge(value)`
- `filterCrmCompanies(companies, filters)`
- `mapDiscoveryCandidateToCrm(candidate)`
- `mapDiscoveryContacts(candidate)`
- `isSuppressed(company)`

`server-bridge.js` produces:

- `listCrmCompanies(filters)`
- `getCrmCompany(id)`
- `saveCrmCompany(payload)`
- `addCrmToPipeline(id, stage)`
- `removeCrmFromPipeline(id)`
- `archiveCrmCompany(id)`
- `restoreCrmCompany(id)`
- `suppressCrmCompany(id)`
- `markCrmCustomer(id)`
- `saveCrmContacts(companyId, contacts)`

- [ ] **Step 1: Write failing engine/bridge contract tests**

Validate that Discovery mapping carries:

- company name/domain/website;
- score/confidence;
- matched signals;
- evidence;
- score breakdown;
- contacts.

Validate that suppression is never converted into a normal active prospect in the browser.

- [ ] **Step 2: Verify RED**

```bash
node --test customer/test/crm-engine.test.js customer/test/crm-integration.test.js
```

- [ ] **Step 3: Implement pure engine and authenticated bridge calls**

CRM write methods must throw/return explicit error when unauthenticated or backend unavailable.

- [ ] **Step 4: Verify GREEN**

```bash
node --test customer/test/crm-engine.test.js customer/test/crm-integration.test.js
node --check customer/crm-engine.js
node --check customer/server-bridge.js
node --test customer/test/*.test.js
```

- [ ] **Step 5: Commit/push**

```bash
git add customer/crm-engine.js customer/server-bridge.js \
        customer/test/crm-engine.test.js customer/test/crm-integration.test.js
git commit -m "feat: connect customer workspace to master crm"
git push
```

Verify remote SHA equality.

---

# Task 8 — Idempotent migration of existing local pipeline

**Files:**
- Create: `customer/test/crm-migration.test.js`
- Create: `backend/test/crm-migration.test.mjs`
- Modify: `customer/server-bridge.js`
- Modify: `backend/src/crm-routes.js`
- Modify: `backend/src/crm.js`

**Interfaces:**
- Browser migration marker is workspace-scoped.
- Migration endpoint/upsert remains idempotent.

- [ ] **Step 1: Write failing migration tests**

Required scenario:

```text
existing local discovery pipeline has two companies
→ first authenticated migration creates two canonical CRM records
→ second migration creates zero duplicates
→ original localStorage pipeline remains present
→ migration marker records successful workspace migration
```

Also test one record failure:
- marker must not claim global completion if any row fails.

- [ ] **Step 2: Verify RED**

```bash
cd backend && node --test test/crm-migration.test.mjs
cd ..
node --test customer/test/crm-migration.test.js
```

- [ ] **Step 3: Implement migration**

Migration must use the same normal CRM upsert service, not a second parallel storage path.

- [ ] **Step 4: Verify GREEN**

```bash
cd backend && npm test
cd ..
node --test customer/test/*.test.js
```

- [ ] **Step 5: Commit/push**

```bash
git add backend/src/crm.js backend/src/crm-routes.js backend/test/crm-migration.test.mjs \
        customer/server-bridge.js customer/test/crm-migration.test.js
git commit -m "feat: migrate saved pipeline into durable crm"
git push
```

Verify remote SHA equality.

---

# Task 9 — Discovery → CRM → Pipeline integration

**Files:**
- Modify: `customer/discovery-ui.js`
- Modify/create relevant Discovery tests.
- Modify: `customer/crm-engine.js`

**Interfaces:**
Discovery candidate actions:

```text
Save to CRM
Add to Pipeline
In CRM ✓
Suppressed
```

- [ ] **Step 1: Write failing UI/behavior tests**

Required behavior:

- Save to CRM persists without requiring pipeline stage.
- Add to Pipeline upserts CRM first, then sets stage.
- rediscovered existing domain shows `In CRM ✓`;
- suppressed company shows `Suppressed`;
- suppressed company cannot use normal Add to Pipeline;
- discovery intelligence updates existing CRM record;
- no duplicate server company is created.

- [ ] **Step 2: Verify RED**

```bash
node --test customer/test/discovery-engine.test.js customer/test/crm-integration.test.js
```

- [ ] **Step 3: Implement integration**

Do not remove the old local pipeline data yet. During transition it remains rollback-safe, but server CRM is authoritative whenever authenticated/available.

- [ ] **Step 4: Verify GREEN**

```bash
node --check customer/discovery-ui.js
node --test customer/test/*.test.js
```

- [ ] **Step 5: Commit/push**

```bash
git add customer/discovery-ui.js customer/crm-engine.js customer/test/
git commit -m "feat: persist discovery candidates to crm"
git push
```

Before commit, replace `customer/test/` with explicit changed test paths in the actual `git add` command so unrelated files cannot enter the commit.

Verify remote SHA equality.

---

# Task 10 — CRM UI

**Files:**
- Create: `customer/crm-ui.js`
- Create: `customer/crm.css`
- Create: `customer/test/crm-structure.test.js`
- Modify: `customer/index.html`
- Modify: `customer/styles.css` only where shared top navigation requires it.

**Interfaces:**
Top-level CRM destination, not Step 8.

Views:

- All Companies
- Active Pipeline
- Customers
- Archived
- Suppressed

Company detail:

- identity/lifecycle/stage;
- intelligence;
- contacts;
- activity;
- actions.

- [ ] **Step 1: Write failing structure tests**

Assert:

- top-level `CRM` action exists;
- CRM surface is not `[data-step="8"]`;
- search input exists;
- lifecycle filters exist;
- detail region exists;
- archive/suppress/restore/pipeline actions exist in UI module;
- CRM module loads from customer artifact.

- [ ] **Step 2: Verify RED**

```bash
node --test customer/test/crm-structure.test.js
```

- [ ] **Step 3: Implement CRM UI**

Default table columns:

```text
Company | Lifecycle | Pipeline | Score | Top Signal | Contacts | Last Activity | Updated | Actions
```

CRM backend unavailable state:

```text
CRM unavailable · local workflow safe
```

Do not display fake success after a failed mutation.

- [ ] **Step 4: Verify GREEN**

```bash
node --check customer/crm-ui.js
node --test customer/test/crm-structure.test.js
node --test customer/test/*.test.js
```

- [ ] **Step 5: Commit/push**

```bash
git add customer/crm-ui.js customer/crm.css customer/index.html customer/styles.css \
        customer/test/crm-structure.test.js
git commit -m "feat: add master crm workspace"
git push
```

Verify remote SHA equality.

---

# Task 11 — Make current Pipeline a CRM view

**Files:**
- Modify: `customer/discovery-ui.js`
- Modify: `customer/crm-ui.js`
- Modify relevant tests.

**Interfaces:**
Pipeline UI reads CRM companies where `pipeline_stage IS NOT NULL` whenever server CRM is available.

- [ ] **Step 1: Write failing transition tests**

Verify:

- active pipeline list is server CRM-backed;
- remove pipeline clears stage but company remains in CRM;
- stage updates call CRM backend;
- archive removes from active pipeline;
- customer remains available in CRM;
- browser local pipeline is fallback/migration source, not authenticated source of truth.

- [ ] **Step 2: Verify RED**

```bash
node --test customer/test/crm-integration.test.js
```

- [ ] **Step 3: Implement server-backed pipeline rendering/actions**

Keep transition compatibility with Step 6 selection until Step 12 lands.

- [ ] **Step 4: Verify GREEN**

```bash
node --test customer/test/*.test.js
```

- [ ] **Step 5: Commit/push**

```bash
git add customer/discovery-ui.js customer/crm-ui.js customer/test/crm-integration.test.js
git commit -m "feat: make pipeline a crm view"
git push
```

Verify remote SHA equality.

---

# Task 12 — Content & Scripts CRM activity integration

**Files:**
- Modify: `customer/outreach-ui.js`
- Modify: `customer/server-bridge.js`
- Modify CRM backend service/routes if an internal activity endpoint/helper is required.
- Modify tests.

**Interfaces:**
Durable events:
- `dossier.built`
- `content.approved`

- [ ] **Step 1: Write failing activity tests**

Ensure activities are associated with canonical company and selected contact when available.

- [ ] **Step 2: Verify RED**

Run focused backend/customer CRM tests.

- [ ] **Step 3: Implement activity writes**

An activity-write failure must not silently claim CRM durability. Existing local draft can remain usable; UI must indicate server sync error.

- [ ] **Step 4: Verify GREEN**

Run full customer/backend suites.

- [ ] **Step 5: Commit/push**

Commit message:

```text
feat: connect outreach activity to crm
```

Verify remote SHA equality.

---

# Task 13 — Gmail send/reply/outcome CRM integration

**Files:**
- Modify: `backend/src/gmail.js`
- Modify CRM service layer.
- Modify: `customer/production-gmail-ui.js`
- Modify: `customer/delivery-ui.js`
- Modify Gmail/CRM tests.

**Interfaces:**
Durable events:

- `email.sent`
- `email.reply_received`
- `meeting.recorded`
- `proposal.recorded`
- `deal.won`
- `deal.lost`

- [ ] **Step 1: Write failing Gmail CRM tests**

Critical assertions:

- one idempotent Gmail send → exactly one `email.sent`;
- duplicate send request → no duplicate activity;
- synced reply → reply activity + appropriate stage;
- Meeting/Proposal/Won/Lost → activity and forward stage transition;
- suppressed company is not eligible for normal outbound send.

- [ ] **Step 2: Verify RED**

```bash
cd backend
node --test test/gmail.test.mjs test/crm.test.mjs
```

Run corresponding customer production Gmail tests.

- [ ] **Step 3: Implement CRM event integration**

Keep OAuth/token storage unchanged.

- [ ] **Step 4: Verify GREEN**

```bash
cd backend && npm test
cd ..
node --test customer/test/*.test.js
```

- [ ] **Step 5: Commit/push**

```bash
git add <explicit gmail/crm files>
git diff --cached --check
git commit -m "feat: record gmail revenue activity in crm"
git push
```

Verify remote SHA equality.

---

# Task 14 — CI cleanup and main-branch protection

**Files:**
- Modify: `.github/workflows/backend-ci.yml`
- Modify: `.github/workflows/customer-ci.yml`
- Modify: `customer/test/deployment.test.js`
- Modify stale current documentation strings only where they describe production deployment incorrectly.

**Interfaces:**
- backend/customer tests run on relevant `main` pushes and PRs.
- No dependency on retired `deploy-pages.yml`.

- [ ] **Step 1: Write/adjust failing deployment/CI tests**

Assert:

- retired Pages workflow remains absent;
- Vercel config/build artifact remains required;
- CRM files are included in safe static artifact;
- customer test directories remain excluded from artifact.

- [ ] **Step 2: Verify RED where applicable**

```bash
node --test customer/test/deployment.test.js
```

- [ ] **Step 3: Clean workflows**

Remove `.github/workflows/deploy-pages.yml` from path filters.

Backend `push.branches` must include `main`.

Customer `push.branches` must include `main`.

Keep PR verification.

Add CRM source files to syntax checks.

- [ ] **Step 4: Run full local gates**

```bash
cd backend
npm ci
npm audit --audit-level=high
npm test
cd ..
node --test customer/test/*.test.js
```

Run all explicit `node --check` commands represented in CI.

- [ ] **Step 5: Commit/push**

```bash
git add .github/workflows/backend-ci.yml .github/workflows/customer-ci.yml \
        customer/test/deployment.test.js <explicit-doc-files-if-changed>
git commit -m "ci: protect master crm release path"
git push
```

Verify remote SHA equality.

---

# Task 15 — Build artifact and security verification

**Files:**
- Modify: `scripts/build-vercel-static.sh` only if CRM assets are not already copied by the existing `customer/.` copy.
- Modify tests only if required.

- [ ] **Step 1: Build locally**

```bash
bash scripts/build-vercel-static.sh
```

- [ ] **Step 2: Verify CRM assets are present**

```bash
test -f .vercel-static/customer/crm-engine.js
test -f .vercel-static/customer/crm-ui.js
test -f .vercel-static/customer/crm.css
```

- [ ] **Step 3: Verify forbidden content is absent**

```bash
test ! -e .vercel-static/backend
test ! -e .vercel-static/.git
test ! -e .vercel-static/customer/test
test ! -e .vercel-static/"CLIENT ID"
```

- [ ] **Step 4: Secret-pattern review**

Run a repository-aware secret scan/check without printing secret values. At minimum:

```bash
git grep -n -E 'sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}' -- \
  ':!backend/.dev.vars.example' || true
```

Any real credential match blocks release.

- [ ] **Step 5: Commit only if the build script/tests required changes**

Commit/push and verify remote SHA equality.

---

# Task 16 — Preview verification

**Precondition:** every previous task is committed and pushed.

- [ ] **Step 1: Confirm clean branch**

```bash
git status --short --branch
```

Expected: clean `feature/master-crm`.

- [ ] **Step 2: Confirm local = remote**

Use global SHA equality check.

- [ ] **Step 3: Confirm Vercel preview is READY on exact branch HEAD**

Record:

```text
branch SHA
deployment ID
preview URL
READY state
```

- [ ] **Step 4: Browser acceptance on preview**

Test:

1. open `/customer/`;
2. sign in;
3. local existing pipeline migrates;
4. CRM loads;
5. save a discovered company;
6. rediscover same domain — no duplicate;
7. add to pipeline;
8. remove from pipeline — record remains CRM;
9. archive/restore;
10. suppress — normal Add to Pipeline blocked;
11. customer view;
12. company detail contacts/intelligence/activity;
13. browser refresh retains state;
14. another signed-in browser/device sees same CRM if available for test.

- [ ] **Step 5: Run backend health regression**

```text
GET https://leadintel-api.edgars-7e7.workers.dev/api/health
```

Expected:

```json
{"status":"ok","service":"leadintel-api"}
```

No production mutation yet.

---

# Task 17 — Pull request and merge gate

- [ ] **Step 1: Final branch verification**

```bash
cd backend && npm test
cd ..
node --test customer/test/*.test.js
git status --short
```

- [ ] **Step 2: Push final branch HEAD**

```bash
git push
```

Verify local/remote SHA equality.

- [ ] **Step 3: Open PR**

Title:

```text
LeadIntel Master CRM
```

PR description must contain:

- architecture summary;
- D1 migration;
- CRM API;
- migration behavior;
- Discovery/Pipeline changes;
- Gmail activity changes;
- suppression rule;
- test evidence;
- preview deployment URL;
- rollback statement.

- [ ] **Step 4: Require green CI**

Do not merge with failing Backend CI or Customer V2 CI.

- [ ] **Step 5: Merge only reviewed branch**

No direct ad-hoc production edits.

---

# Task 18 — Production D1 migration and backend deploy

**Production safety:** apply only after PR/merge and explicit release authorization.

- [ ] **Step 1: Record production `main` SHA**

```bash
git fetch origin
git rev-parse origin/main
```

Save it in release notes.

- [ ] **Step 2: Apply D1 migration**

From backend:

```bash
npm run db:remote
```

Expected: migration `0011_master_crm.sql` applied successfully.

Do not rerun destructive manual SQL.

- [ ] **Step 3: Deploy Worker**

```bash
npm run deploy
```

Record Worker version/deployment output.

- [ ] **Step 4: Health verification**

Verify `/api/health` = 200.

- [ ] **Step 5: Authenticated CRM API smoke test**

Using the browser/app authenticated session:

- list CRM companies;
- save one controlled test company or migrate existing real local record;
- fetch it;
- confirm workspace isolation and expected lifecycle.

---

# Task 19 — Production frontend verification

- [ ] **Step 1: Confirm Vercel production READY**

Exact production deployment must correspond to merged `main` SHA.

- [ ] **Step 2: Confirm custom domain**

```text
https://leadintel.ccgroup.lv/
https://leadintel.ccgroup.lv/customer/
```

- [ ] **Step 3: Verify public artifact boundaries**

Confirm:

```text
/customer/crm-ui.js         → 200
/customer/crm-engine.js     → 200
/customer/test/...          → 404
/backend/...                → 404
```

- [ ] **Step 4: End-to-end live acceptance**

Run exact path:

```text
Website
→ Context
→ Intelligence
→ Strategy / Signals
→ Discovery
→ Save to CRM
→ Add to Pipeline
→ Dossier
→ Content approval
→ Gmail/manual safe delivery path
→ Reply/outcome
→ CRM activity timeline
→ Remove from Pipeline
→ Confirm CRM history remains
```

Do not claim complete unless the tested path is supported by evidence.

---

# Task 20 — Final recovery checkpoint and documentation

- [ ] **Step 1: Record final release state**

Document:

```text
production git SHA
Vercel deployment ID
Cloudflare Worker version
D1 migration number
backend test result
customer test result
production health result
acceptance result
```

- [ ] **Step 2: Update README/current architecture documentation**

Replace stale GitHub Pages production wording where it is still presented as current.

Canonical deployment:

```text
Frontend: Vercel
Domain: leadintel.ccgroup.lv
Backend: Cloudflare Worker + D1
CRM: D1 Master CRM
Repository: GitHub
```

- [ ] **Step 3: Commit documentation**

```bash
git add README.md docs/
git diff --cached --check
git commit -m "docs: record master crm production architecture"
git push
```

- [ ] **Step 4: Tag the known-good release**

After verified production:

```bash
git tag -a leadintel-crm-v1 -m "LeadIntel Master CRM V1 verified production release"
git push origin leadintel-crm-v1
```

This tag is the immutable recovery anchor.

---

# Definition of Done

The milestone is finished only when all are true:

- D1 migration applied safely.
- Master CRM APIs pass backend tests.
- Discovery persists canonical companies.
- Duplicate domains do not create duplicates per workspace.
- Contacts deduplicate safely by normalized work email.
- Pipeline reads/writes CRM state.
- Remove from Pipeline preserves CRM/history.
- Archive/restore works.
- Suppression blocks normal rediscovery-to-pipeline flow.
- Customer lifecycle works independently of pipeline.
- Content activity is durable.
- Gmail send/reply/outcome activity is durable.
- Existing local pipeline migrates idempotently.
- 500 KB workflow-state budget remains intact.
- Backend suite is green.
- Customer suite is green.
- Main CI is green.
- Vercel production is READY on the exact merged SHA.
- Cloudflare health is green.
- Live end-to-end path is verified.
- Every completed implementation task exists in GitHub.
- Final verified release has immutable tag `leadintel-crm-v1`.
