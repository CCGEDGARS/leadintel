# LeadIntel Outreach Automation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-safe Gmail outreach automation engine with Manual/Automatic modes, backend-enforced limits, scheduling, follow-ups, reply-stop behavior and operational controls while preserving the current human-approved Gmail send path.

**Architecture:** Add additive D1 persistence for automation policy, sequences, queue items and inbound-reply dedupe; isolate policy/time/eligibility logic in a focused backend module; expose owner-only mutation and read APIs; run automation from the existing hourly Cloudflare Worker cron; reuse the existing Gmail OAuth/send/thread primitives and CRM helpers; add a customer-side control panel that treats backend state as authoritative. Manual Gmail remains the fail-safe default and continues through the existing route unchanged.

**Tech Stack:** Cloudflare Workers, D1/SQLite migrations, ES modules, Gmail API, Node `node:test`, vanilla JS customer UI, Vercel static frontend, GitHub Actions release-integrity checks.

**Spec:** `docs/superpowers/specs/2026-09-08-outreach-automation-engine-design.md`

## Global Constraints

- Manual mode is the permanent default.
- Automatic mode requires explicit owner activation and approved outreach content.
- Backend state is authoritative for limits and scheduling; browser/localStorage is informational only.
- Suppression, pause and emergency stop always win over queue state.
- Daily usage counts confirmed sent Gmail records, not attempts.
- Existing Gmail idempotency and CRM `Contacted` behavior must remain green.
- Queue content is snapshotted at enqueue time and cannot silently change after later UI edits.
- Calendly/Zoom, LinkedIn automation and AI-generated reply sending are out of scope.
- TDD is mandatory for every behavioral change.

---

### Task 1: Add durable automation schema and defaults

**Files:**
- Create: `backend/migrations/0015_outreach_automation.sql`
- Create: `backend/test/outreach-automation-schema.test.mjs`

**Interfaces:**
- Produces tables `outreach_automation_policies`, `outreach_automation_sequences`, `outreach_automation_queue`, `outreach_automation_processed_replies`.
- Policy fields mirror the approved spec; queue and sequence status values are DB-constrained.

- [ ] **Step 1: Write the failing schema test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('outreach automation migration defines fail-safe policy defaults and queue tables', async()=>{
  const sql=await readFile(new URL('../migrations/0015_outreach_automation.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS outreach_automation_policies/);
  assert.match(sql,/mode TEXT NOT NULL DEFAULT 'manual'/);
  assert.match(sql,/workspace_daily_limit INTEGER NOT NULL DEFAULT 20/);
  assert.match(sql,/mailbox_daily_limit INTEGER NOT NULL DEFAULT 20/);
  assert.match(sql,/timezone TEXT NOT NULL DEFAULT 'Europe\/Riga'/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS outreach_automation_sequences/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS outreach_automation_queue/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS outreach_automation_processed_replies/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd backend && node --test test/outreach-automation-schema.test.mjs`
Expected: FAIL because migration file does not exist.

- [ ] **Step 3: Add the migration**

Create additive tables with foreign keys to `workspaces`, `users` and existing Gmail records where safe. Use explicit CHECK constraints for:

```sql
mode IN ('manual','automatic')
status IN ('active','stopped_reply','completed','cancelled')
queue status IN ('queued','waiting_window','sending','sent','cancelled_reply','cancelled_pause','blocked_limit','failed','skipped')
```

Store JSON arrays with `CHECK(json_valid(...))`. Add indexes on `(workspace_id,status,scheduled_send_at)`, `(sequence_id,status)` and processed Gmail message id uniqueness.

- [ ] **Step 4: Run migration test GREEN**

Run: `cd backend && node --test test/outreach-automation-schema.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run full backend suite**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/0015_outreach_automation.sql backend/test/outreach-automation-schema.test.mjs
git commit -m "feat: add outreach automation persistence"
```

---

### Task 2: Implement deterministic policy, timezone, delay and eligibility logic

**Files:**
- Create: `backend/src/outreach-automation.js`
- Create: `backend/test/outreach-automation.test.mjs`

**Interfaces:**
- Produces `defaultAutomationPolicy()`, `normalizeAutomationPolicy(input,current)`, `localClockParts(now,timeZone)`, `isWithinSendWindow(policy,now)`, `nextEnabledWindow(policy,now)`, `boundedDelayMinutes(policy,random)`, `evaluateAutomaticSend(context)`.
- `evaluateAutomaticSend(context)` returns `{allowed:boolean, reason:string, nextEligibleAt:string|null}` and never sends.

- [ ] **Step 1: Write failing tests for defaults and validation**

Cover: default manual/off; invalid automatic policy rejected/normalized fail-closed; max delay >= min; limits positive; IANA timezone validation; Monday-Friday defaults.

- [ ] **Step 2: Write failing time-window tests with injected dates**

Include Europe/Riga examples for inside window, outside window, disabled weekend, and a UTC timestamp that crosses local midnight.

- [ ] **Step 3: Write failing deterministic delay tests**

Inject `random=()=>0`, `()=>0.5`, `()=>0.999999` and assert results stay within `[min,max]`.

- [ ] **Step 4: Write failing eligibility tests**

Use contexts that independently block for: manual mode, disabled, paused, emergency stop, suppression, invalid recipient, reply stop, workspace daily limit, mailbox daily limit, disabled weekday, outside window and minimum-spacing requirement. Add one fully eligible case.

- [ ] **Step 5: Run RED**

Run: `cd backend && node --test test/outreach-automation.test.mjs`
Expected: FAIL because module/functions do not exist.

- [ ] **Step 6: Implement minimal pure module**

Keep DB/Gmail I/O out of this file. Unknown or invalid state returns `allowed:false`. Use `Intl.DateTimeFormat(...,{timeZone,...})` for timezone-local parts; compute next enabled window without trusting browser time.

- [ ] **Step 7: Run tests GREEN and full backend suite**

Run:
```bash
cd backend
node --test test/outreach-automation.test.mjs
npm test
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/outreach-automation.js backend/test/outreach-automation.test.mjs
git commit -m "feat: add outreach automation policy engine"
```

---

### Task 3: Add automation policy/status APIs and owner-only mutation

**Files:**
- Modify: `backend/src/saas-routes.js`
- Create: `backend/test/outreach-automation-routes.test.mjs`

**Interfaces:**
- `GET /api/outreach-automation/policy?workspace_id=...`
- `PUT /api/outreach-automation/policy?workspace_id=...`
- `GET /api/outreach-automation/status?workspace_id=...`
- Mutations are owner-only in v1; reads require workspace membership.

- [ ] **Step 1: Write failing route tests**

Assert GET creates/returns default `manual`, `enabled:false`; sales role can read; sales role cannot PUT; owner can PUT valid automatic config; malformed limits/timezone/window return 400; policy mutation writes an audit event.

- [ ] **Step 2: Write failing usage-status tests**

Seed confirmed `gmail_messages.status='sent'` records on both sides of the configured local-day boundary and assert status returns only the timezone-local current day count. Assert workspace/mailbox counts, queue count, blocked count and `next_eligible_send_at` shape.

- [ ] **Step 3: Run RED**

Run: `cd backend && node --test test/outreach-automation-routes.test.mjs`
Expected: FAIL with unknown routes.

- [ ] **Step 4: Implement routes**

Use the pure normalization functions from Task 2. Persist working days and follow-up delays as JSON. On first GET, return defaults without silently enabling automation. On PUT, preserve explicit owner intent and audit before/after safety-relevant fields.

- [ ] **Step 5: Run GREEN and regression suites**

Run:
```bash
cd backend
node --test test/outreach-automation-routes.test.mjs
node --test test/gmail.test.mjs test/routes.test.mjs
npm test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/saas-routes.js backend/test/outreach-automation-routes.test.mjs
git commit -m "feat: expose outreach automation policy controls"
```

---

### Task 4: Add approved-package enqueue and durable sequence snapshots

**Files:**
- Modify: `backend/src/saas-routes.js`
- Create: `backend/test/outreach-automation-queue.test.mjs`
- Modify: `customer/server-bridge.js`

**Interfaces:**
- `POST /api/outreach-automation/sequences?workspace_id=...`
- Request contains approved package snapshot: `{domain,recipient,subject,body,followup_body,approved_at,contact_identity}`.
- Response returns `{sequence,queue_items}`.
- Server bridge adds `enqueueOutreachAutomation(payload)`.

- [ ] **Step 1: Write failing backend tests**

Assert enqueue rejects manual/disabled automation, unapproved package marker, invalid recipient, suppressed CRM company and missing Gmail connection. Assert successful enqueue snapshots subject/body/follow-up and creates step 0 only; later package edits do not alter stored queue text.

- [ ] **Step 2: Write failing idempotency test**

Use deterministic enqueue idempotency key derived from workspace/domain/recipient/approved_at and assert repeated request returns the same sequence rather than duplicate queue rows.

- [ ] **Step 3: Run RED**

Run: `cd backend && node --test test/outreach-automation-queue.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement enqueue path**

Create sequence and initial queue item transactionally. Set `earliest_send_at` from policy and current time; call Task 2 scheduling helpers. Do not create follow-up queue rows yet; those are created only after confirmed send in Task 5.

- [ ] **Step 5: Add bridge method and focused customer contract test**

Add/update `customer/test/server-bridge.test.js` to assert the bridge posts to the new endpoint with workspace context and credentials.

- [ ] **Step 6: Run backend/customer GREEN**

Run:
```bash
cd backend && node --test test/outreach-automation-queue.test.mjs && npm test
cd ../customer && node --test test/server-bridge.test.js
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/saas-routes.js backend/test/outreach-automation-queue.test.mjs customer/server-bridge.js customer/test/server-bridge.test.js
git commit -m "feat: enqueue approved automated outreach"
```

---

### Task 5: Implement scheduler execution, limits, retries and follow-up creation

**Files:**
- Create: `backend/src/outreach-automation-runner.js`
- Create: `backend/test/outreach-automation-runner.test.mjs`
- Modify: `backend/src/app.js`

**Interfaces:**
- Produces `runOutreachAutomation(env,{now=new Date(),random=Math.random,limit=25}={})`.
- Cloudflare scheduled handler calls runner from existing hourly cron.

- [ ] **Step 1: Write failing runner tests with fake DB/Gmail adapters**

Cover: only due queued items considered; workspace and mailbox daily limit blocks before Gmail call; pause/emergency stop fail closed; outside window reschedules; suppressed company skips; one failed item does not halt the next; confirmed send updates queue to `sent`; transient failure retries with bounded attempt count/backoff.

- [ ] **Step 2: Write failing confirmed-send follow-up tests**

After initial send, assert max 2 follow-ups using configured `[3,7]` enabled business-day delays, and no follow-up created beyond `max_followups`. Use a Monday-Friday policy and verify weekend skipping.

- [ ] **Step 3: Write failing Gmail idempotency regression**

Runner must create/use a stable idempotency key per queue item and never double-send the same row if scheduled execution repeats.

- [ ] **Step 4: Run RED**

Run: `cd backend && node --test test/outreach-automation-runner.test.mjs`
Expected: FAIL.

- [ ] **Step 5: Implement runner**

Reuse existing `connectedGmail`, token refresh, MIME building, `sendGmailMessage`, CRM suppression lookup/activity/stage helpers. Immediately before each Gmail call, recompute policy eligibility and confirmed sent counts. Use transaction/state transition `queued|waiting_window -> sending -> sent|failed|...` so concurrent invocations do not both own the same row.

- [ ] **Step 6: Wire scheduled event**

In `backend/src/app.js`, preserve existing scheduled work and add the outreach runner to the hourly handler. Failure in outreach automation must be caught/audited and must not prevent unrelated scheduled jobs.

- [ ] **Step 7: Run GREEN and Gmail regression tests**

Run:
```bash
cd backend
node --test test/outreach-automation-runner.test.mjs
node --test test/gmail.test.mjs
npm test
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/outreach-automation-runner.js backend/test/outreach-automation-runner.test.mjs backend/src/app.js
git commit -m "feat: run scheduled automated outreach safely"
```

---

### Task 6: Add automatic reply polling, dedupe and sequence stop

**Files:**
- Modify: `backend/src/outreach-automation-runner.js`
- Create: `backend/test/outreach-automation-replies.test.mjs`

**Interfaces:**
- Runner polls active sent sequences at policy cadence during hourly cron.
- Newly observed inbound Gmail message IDs are inserted into `outreach_automation_processed_replies` before/with state updates.

- [ ] **Step 1: Write failing reply-stop tests**

Seed a sent sequence with pending follow-ups and a Gmail thread containing one new inbound message. Assert classifier output is stored, CRM reply behavior is invoked, sequence becomes `stopped_reply`, every pending queue row becomes `cancelled_reply`, and audit metadata lists affected queue ids.

- [ ] **Step 2: Write failing dedupe test**

Run polling twice with the same Gmail message id and assert only one processed-reply row, one CRM reply event and one cancellation action.

- [ ] **Step 3: Write failing isolation test**

One thread retrieval failure must mark/audit that sequence failure but still process a second healthy sequence.

- [ ] **Step 4: Run RED**

Run: `cd backend && node --test test/outreach-automation-replies.test.mjs`
Expected: FAIL.

- [ ] **Step 5: Implement polling**

Reuse `fetchGmailThread`, `normalizeInboundReplies`, existing classifier and CRM reply-stage semantics. Any inbound reply category stops future automation for that sequence. Unsubscribe must additionally honor existing suppression behavior if a supported helper already exists; otherwise record the unsubscribe stop without inventing a new suppression contract in this task.

- [ ] **Step 6: Run GREEN and full backend suite**

Run: `cd backend && node --test test/outreach-automation-replies.test.mjs && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/outreach-automation-runner.js backend/test/outreach-automation-replies.test.mjs
git commit -m "feat: stop automated followups on replies"
```

---

### Task 7: Build customer Outreach Automation control panel

**Files:**
- Create: `customer/outreach-automation-ui.js`
- Create: `customer/outreach-automation.css`
- Modify: `customer/content-variants.js` or the active customer shell loader following existing module-loading pattern
- Modify: `customer/server-bridge.js`
- Create: `customer/test/outreach-automation-ui.test.js`

**Interfaces:**
- Bridge methods: `getOutreachAutomationPolicy()`, `saveOutreachAutomationPolicy(policy)`, `getOutreachAutomationStatus()`, `enqueueOutreachAutomation(payload)`.
- UI renders server-authoritative policy/status and owner controls.

- [ ] **Step 1: Write failing source-contract/UI tests**

Assert copy and controls exist for: Manual/Automatic, explicit automatic activation confirmation, 10/20/30/50 + custom daily limit, mailbox limit, weekdays, timezone, window, 8-18 style delay range, follow-ups, pause/resume, emergency stop, `sent today / limit`, queue count, next send, queue preview and blocked reason text.

- [ ] **Step 2: Write failing permission tests**

Owner can mutate; non-owner controls render disabled/read-only. Automatic mode save requires `window.confirm` copy that approved contacts may be emailed without per-message confirmation.

- [ ] **Step 3: Run RED**

Run: `cd customer && node --test test/outreach-automation-ui.test.js`
Expected: FAIL.

- [ ] **Step 4: Implement focused UI module**

Do not modify the large outreach/delivery engines more than necessary. Insert one `Outreach Automation` panel in the delivery/outreach area. Always refresh policy/status from backend after a mutation. Display failures without claiming settings were saved.

- [ ] **Step 5: Wire enqueue action from approved package**

Add an explicit owner action such as `Add approved contact to automatic queue` only when policy is Automatic/enabled and Gmail is connected. Manual `Send with Gmail` remains available and unchanged.

- [ ] **Step 6: Run GREEN and customer suite**

Run:
```bash
cd customer
node --test test/outreach-automation-ui.test.js
node --test test/gmail-production.test.js test/gmail-idempotency.test.js test/gmail-send-status.test.js
node --test test/*.test.js
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add customer/outreach-automation-ui.js customer/outreach-automation.css customer/content-variants.js customer/server-bridge.js customer/test/outreach-automation-ui.test.js
git commit -m "feat: add outreach automation controls"
```

---

### Task 8: Preserve manual send behavior and add end-to-end contract coverage

**Files:**
- Create: `backend/test/outreach-automation-regression.test.mjs`
- Create: `customer/test/outreach-automation-regression.test.js`
- Modify only production files if tests expose an actual regression.

**Interfaces:**
- No new API; this task proves the old manual path and new automatic path coexist safely.

- [ ] **Step 1: Add manual-mode regression test**

Assert policy default/manual does not enqueue or auto-send anything, while existing `/api/integrations/gmail/send` still accepts an authorized human-triggered send exactly as before.

- [ ] **Step 2: Add automatic safety-chain test**

Exercise: approved snapshot -> enqueue -> due scheduler -> confirmed Gmail send -> follow-up queued -> reply appears -> reply deduped -> follow-up cancelled -> no second Gmail send.

- [ ] **Step 3: Add emergency-stop test**

Activate emergency stop between enqueue and runner execution and assert zero Gmail calls; clear it as owner, rerun and assert eligibility can resume.

- [ ] **Step 4: Run all suites**

Run:
```bash
cd backend && npm test
cd ../customer && node --test test/*.test.js
```
Expected: PASS with no skipped/failing regression coverage introduced by this feature.

- [ ] **Step 5: Commit**

```bash
git add backend/test/outreach-automation-regression.test.mjs customer/test/outreach-automation-regression.test.js
git commit -m "test: verify outreach automation safety chain"
```

---

### Task 9: Release verification and production proof

**Files:**
- Modify: `backend/scripts/verify-deployment.mjs` only if the new policy/status endpoints are not already covered by generic verification.
- Modify: `release-integrity.config.json` only if exact-SHA backend verification requires an explicit new endpoint contract.
- Test: existing deployment/release-integrity suites.

**Interfaces:**
- Production proof must include custom domain frontend and Worker backend for the exact merged main SHA.

- [ ] **Step 1: Run local verification**

```bash
cd backend && npm test
cd ../customer && node --test test/*.test.js
```
Expected: PASS.

- [ ] **Step 2: Run syntax/static checks matching Customer V2 CI**

Use the exact commands from `.github/workflows/customer-ci.yml` and backend CI locally where possible.

- [ ] **Step 3: Open implementation PR and request code review**

PR summary must state safety invariants, migration, APIs, scheduler behavior, manual-path preservation and test evidence.

- [ ] **Step 4: Require green PR CI before merge**

Customer V2 CI and backend CI must both be green for the PR head SHA.

- [ ] **Step 5: Merge only after review**

Record exact merged `main` SHA.

- [ ] **Step 6: Verify exact main SHA**

Require:
1. main Customer V2 CI success;
2. main backend CI success;
3. Vercel production success for exact SHA;
4. Cloudflare backend deployment success for exact SHA;
5. Release Integrity success for exact SHA.

- [ ] **Step 7: Verify live runtime**

Check:
- `https://leadintel.ccgroup.lv/customer/` loads the automation panel;
- `GET /api/outreach-automation/policy` returns manual/off by default for an authenticated workspace;
- `GET /api/outreach-automation/status` returns counters/queue shape;
- backend `/api/health` is healthy;
- automatic mode is not silently enabled in production.

- [ ] **Step 8: Document production evidence in PR/release note**

Include exact SHA and URLs/run IDs. Do not claim production-current until every exact-SHA gate is green.
