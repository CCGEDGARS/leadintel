# LeadIntel Master CRM — Design Specification

**Date:** 2026-08-28  
**Status:** Approved architecture / implementation spec for review  
**Project:** LeadIntel  
**Target path in repo:** `docs/superpowers/specs/2026-08-28-master-crm-design.md`

## 1. Objective

Create a durable, workspace-scoped Master CRM that becomes LeadIntel's permanent commercial memory across Discovery, Pipeline, Content & Scripts, Gmail delivery, reply sync, outcomes, and learning.

The CRM must solve these problems:

- pipeline records must not disappear when removed from active work;
- the same company must not be repeatedly recreated across discovery runs;
- company, contact, intelligence, outreach, reply, and outcome history must survive browser resets and device changes;
- CRM data must not be stored inside the existing 500 KB customer workspace state budget;
- LeadIntel must distinguish company lifecycle from sales pipeline stage;
- destructive deletion must be exceptional and owner-controlled.

## 2. Architectural Decision

### Selected approach

Use **dedicated Cloudflare D1 CRM tables** as the system of record.

Existing browser/localStorage state remains the fast working state for the current customer workflow. Existing server workspace state remains responsible for synchronized workflow state. CRM records are stored separately and accessed through workspace-scoped backend APIs.

### Rejected approaches

1. **localStorage-only CRM**
   - browser/device bound;
   - unsuitable for multi-user/multi-device use;
   - history can be lost;
   - poor long-term search/deduplication.

2. **CRM embedded inside existing customer workspace JSON**
   - conflicts with the existing 500 KB state budget;
   - increases sync conflict probability;
   - makes CRM growth dependent on onboarding/workflow-state limits;
   - weak query/search model.

## 3. Core Principle

**Removing a company from the active pipeline must never destroy its commercial intelligence or history.**

Pipeline is a view/state of CRM. CRM is the durable record.

## 4. Scope — V1

### Included

- durable companies;
- durable contacts;
- durable intelligence snapshot;
- durable activities;
- workspace isolation;
- company deduplication;
- contact deduplication;
- lifecycle status;
- pipeline stage;
- save to CRM;
- add to pipeline;
- remove from pipeline;
- mark as customer;
- archive;
- suppress;
- restore;
- owner-only permanent delete;
- CRM list/search/filter;
- company detail;
- contact detail within company;
- activity timeline;
- integration with Discovery;
- integration with current Pipeline UI;
- integration with Content & Scripts;
- integration with Gmail send and reply sync;
- integration with outcome changes;
- local-pipeline-to-CRM migration;
- tests and release verification.

### Explicitly deferred from V1

- automatic external CRM sync to HubSpot/Salesforce/Pipedrive;
- fully autonomous reply polling;
- lead assignment rules for large teams;
- sales forecasting engine;
- complex custom fields;
- bulk import beyond current migration path;
- marketing automation sequences.

## 5. Data Model

## 5.1 `crm_companies`

Purpose: canonical company record.

Fields:

```sql
id TEXT PRIMARY KEY
workspace_id TEXT NOT NULL
normalized_domain TEXT
company_name TEXT NOT NULL
website TEXT
country TEXT
industry TEXT
lifecycle_status TEXT NOT NULL DEFAULT 'prospect'
pipeline_stage TEXT
opportunity_score INTEGER
confidence TEXT
source TEXT
first_seen_at TEXT NOT NULL
last_seen_at TEXT NOT NULL
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
archived_at TEXT
suppressed_at TEXT
customer_since TEXT
deleted_at TEXT
```

Allowed `lifecycle_status`:

- `prospect`
- `customer`
- `archived`
- `suppressed`

`pipeline_stage` is nullable.

Recommended stages preserve current LeadIntel semantics:

- `Discovered`
- `Qualified`
- `Ready for Outreach`
- `Contacted`
- `Replied`
- `Meeting`
- `Proposal`
- `Won`
- `Lost`

`Won` may automatically transition lifecycle to `customer` only after explicit user confirmation in V1. Do not silently assume every "Won" outcome should become a customer record without confirmation.

Indexes:

```sql
UNIQUE(workspace_id, normalized_domain)
INDEX(workspace_id, lifecycle_status)
INDEX(workspace_id, pipeline_stage)
INDEX(workspace_id, updated_at)
INDEX(workspace_id, company_name)
```

For companies without a usable domain, no automatic merge is performed from name alone. Such records remain separate unless explicitly linked by the user or a future entity-resolution process.

## 5.2 `crm_contacts`

Purpose: durable people associated with companies.

```sql
id TEXT PRIMARY KEY
workspace_id TEXT NOT NULL
company_id TEXT NOT NULL
name TEXT
title TEXT
work_email TEXT
normalized_email TEXT
email_status TEXT
linkedin_url TEXT
source TEXT
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
archived_at TEXT
FOREIGN KEY(company_id) REFERENCES crm_companies(id)
```

Indexes:

```sql
UNIQUE(workspace_id, normalized_email) WHERE normalized_email IS NOT NULL
INDEX(company_id)
INDEX(workspace_id, name)
```

A contact without email may deduplicate only when the company plus a stable external identifier exists. Do not merge people based only on similar names/titles.

## 5.3 `crm_intelligence`

Purpose: latest durable commercial intelligence for a company.

```sql
company_id TEXT PRIMARY KEY
workspace_id TEXT NOT NULL
matched_signals_json TEXT NOT NULL DEFAULT '[]'
evidence_json TEXT NOT NULL DEFAULT '[]'
opportunity_hypothesis TEXT
score_breakdown_json TEXT
confidence TEXT
research_snapshot_json TEXT
intelligence_updated_at TEXT NOT NULL
FOREIGN KEY(company_id) REFERENCES crm_companies(id)
```

V1 keeps one current intelligence snapshot. Activity history preserves material changes. A later version may add full version history if needed.

## 5.4 `crm_activities`

Purpose: immutable commercial timeline.

```sql
id TEXT PRIMARY KEY
workspace_id TEXT NOT NULL
company_id TEXT NOT NULL
contact_id TEXT
activity_type TEXT NOT NULL
channel TEXT
direction TEXT
subject TEXT
summary TEXT
metadata_json TEXT NOT NULL DEFAULT '{}'
occurred_at TEXT NOT NULL
created_at TEXT NOT NULL
actor_user_id TEXT
FOREIGN KEY(company_id) REFERENCES crm_companies(id)
FOREIGN KEY(contact_id) REFERENCES crm_contacts(id)
```

Examples of `activity_type`:

- `company.discovered`
- `company.saved`
- `pipeline.added`
- `pipeline.stage_changed`
- `pipeline.removed`
- `company.archived`
- `company.restored`
- `company.suppressed`
- `company.customer_marked`
- `contact.added`
- `contact.updated`
- `dossier.built`
- `content.approved`
- `email.sent`
- `email.reply_received`
- `meeting.recorded`
- `proposal.recorded`
- `deal.won`
- `deal.lost`
- `intelligence.updated`

Activities should generally be append-only.

## 6. Identity and Deduplication

### Company normalization

Normalize domain by:

1. lowercase;
2. strip protocol;
3. strip `www.`;
4. strip path/query/fragment;
5. strip trailing dot;
6. IDN handling through URL parser where available.

Example:

`https://WWW.Example.com/products?a=1` → `example.com`

### Company deduplication rule

Primary key for matching:

`workspace_id + normalized_domain`

If domain exists, upsert.

If domain is absent:
- never auto-merge by name only;
- return `potential_duplicate=false` unless a future entity-resolution service confirms it.

### Contact deduplication

Primary:
`workspace_id + normalized_email`

Fallback:
stable Apollo/external person ID scoped to company when present.

Do not deduplicate only by name/title.

## 7. Lifecycle vs Pipeline

These are separate concepts.

### Lifecycle

Answers: "What is this company to us?"

- prospect
- customer
- archived
- suppressed

### Pipeline stage

Answers: "Where is the current sales opportunity?"

Nullable when company is not currently in active pipeline.

### Rules

**Save to CRM**
- creates/updates canonical company;
- lifecycle defaults to `prospect`;
- does not require active pipeline stage.

**Add to Pipeline**
- ensures company exists in CRM;
- sets stage to `Discovered` unless a later valid stage already exists;
- adds activity.

**Remove from Pipeline**
- sets `pipeline_stage = NULL`;
- preserves company/contact/intelligence/activity;
- adds `pipeline.removed`.

**Archive**
- lifecycle=`archived`;
- pipeline_stage=NULL;
- hidden from default active views;
- restorable.

**Suppress**
- lifecycle=`suppressed`;
- pipeline_stage=NULL;
- blocks automatic re-add and outbound eligibility;
- preserves all history.

**Mark Customer**
- lifecycle=`customer`;
- may preserve a terminal `Won` stage;
- customer remains searchable in CRM.

**Restore**
- archived → prospect;
- suppressed → prospect only with explicit owner action;
- does not automatically restore pipeline stage.

**Permanent Delete**
- owner only;
- requires explicit destructive confirmation;
- hard delete company and dependent records, or soft-delete followed by controlled cleanup according to the backend pattern chosen during implementation;
- never used as normal "Remove" behavior.

## 8. API Design

All routes require an authenticated workspace member and enforce `workspace_id` server-side.

## 8.1 Companies

### `GET /api/crm/companies`

Query parameters:

- `workspace_id`
- `q`
- `lifecycle`
- `pipeline_stage`
- `limit`
- `cursor`

Response:

```json
{
  "companies": [],
  "next_cursor": null
}
```

### `POST /api/crm/companies`

Create/upsert company from Discovery/manual CRM entry.

Input:

```json
{
  "workspace_id": "...",
  "company": {
    "company_name": "...",
    "domain": "...",
    "website": "...",
    "country": "...",
    "industry": "...",
    "opportunity_score": 82,
    "confidence": "High",
    "source": "discovery"
  },
  "intelligence": {
    "matched_signals": [],
    "evidence": [],
    "opportunity_hypothesis": "...",
    "score_breakdown": {}
  },
  "contacts": []
}
```

Response includes:
- canonical company;
- whether record was created or updated;
- dedupe result.

### `GET /api/crm/companies/:id`

Returns company + contacts + intelligence + recent activities.

### `PATCH /api/crm/companies/:id`

Editable company fields/lifecycle.

### `POST /api/crm/companies/:id/pipeline`

Input:

```json
{"stage":"Discovered"}
```

### `DELETE /api/crm/companies/:id/pipeline`

Means remove from active pipeline, **not delete company**.

### `POST /api/crm/companies/:id/archive`

### `POST /api/crm/companies/:id/restore`

### `POST /api/crm/companies/:id/suppress`

### `POST /api/crm/companies/:id/mark-customer`

### `DELETE /api/crm/companies/:id`

Owner-only permanent destructive operation.

## 8.2 Contacts

### `POST /api/crm/companies/:companyId/contacts`

Upsert contacts.

### `PATCH /api/crm/contacts/:id`

### `DELETE /api/crm/contacts/:id`

Archive/remove contact from current use; company history remains.

## 8.3 Activities

### `GET /api/crm/companies/:id/activities`

Paginated timeline.

Activities are normally written by backend business actions, not arbitrary client-supplied text-only events.

## 9. Integration with Existing LeadIntel Flow

## Step 5 — Discovery

Each candidate receives:

- `Save to CRM`
- `Add to Pipeline`

If already in CRM:
- button becomes `In CRM ✓`;
- current lifecycle/stage shown;
- rerun updates intelligence rather than duplicating record.

If suppressed:
- show `Suppressed`;
- do not allow normal save-to-pipeline without explicit restore.

## Existing Customer Pipeline

Change the pipeline source of truth from the browser discovery state's embedded pipeline to CRM API results.

Transition must be staged so current local users do not lose records.

Pipeline actions:

- stage selector;
- remove from pipeline;
- open CRM record;
- archive;
- suppress where authorized.

## Step 6 — Content & Scripts

Dossier/content approval attaches activities to canonical CRM company/contact.

Existing local workflow state may still cache the active draft, but durable events are written to CRM.

## Step 7 — Delivery & Learning

On successful Gmail send:

- write `email.sent`;
- update pipeline stage to Contacted;
- preserve idempotency key.

On reply sync:

- write `email.reply_received`;
- classify reply using current LeadIntel logic;
- advance pipeline where appropriate.

On Meeting / Proposal / Won / Lost:

- write activity;
- update pipeline;
- never move backwards unless explicit correction is supported in future.

## 10. CRM User Interface

CRM is **not Step 8** in the linear process.

It is a persistent cross-process destination accessible from top-level navigation.

Suggested top action:

`CRM`

## CRM Home

Tabs/filters:

- All Companies
- Active Pipeline
- Customers
- Archived
- Suppressed

Search:
- company name;
- domain;
- contact name;
- contact email where authorized.

Core columns:

- Company
- Lifecycle
- Pipeline stage
- Opportunity score
- Top signal
- Contact count
- Last activity
- Updated
- Actions

## Company Detail Drawer/Page

### Header
- company name;
- website/domain;
- lifecycle;
- pipeline stage;
- score/confidence.

### Intelligence
- opportunity hypothesis;
- matched signals;
- evidence;
- score breakdown.

### Contacts
- name;
- title;
- work email;
- email status;
- source.

### Activity
chronological timeline.

### Actions
- add/remove pipeline;
- change stage;
- mark customer;
- archive;
- suppress;
- restore where applicable.

## 11. Security and Authorization

- Every CRM row has `workspace_id`.
- Every request verifies workspace membership server-side.
- Client-provided `workspace_id` is never sufficient authorization.
- Owner-only:
  - permanent deletion;
  - unsuppress;
  - potentially company-wide destructive actions.
- Gmail tokens remain in existing encrypted integration storage, never CRM tables.
- No API/provider secret is stored in CRM.
- Contacts remain business-context data only.
- Suppression is enforced server-side for outbound eligibility.

## 12. State-Budget Rule

CRM records are explicitly excluded from the existing 500 KB synchronized customer-state payload.

Customer state keeps:
- onboarding;
- current strategic configuration;
- current workflow/draft UI state;
- compact references/IDs.

CRM keeps:
- growing company/contact/history dataset.

This separation is mandatory.

## 13. Migration

Current users may have saved pipeline records only in:

`leadintel_customer_v2_discovery`

### Migration behavior

After authenticated CRM capability loads:

1. check migration marker per workspace;
2. read existing local discovery pipeline;
3. for each item:
   - normalize domain;
   - upsert company;
   - upsert people;
   - upsert intelligence;
   - preserve current stage;
   - create `company.migrated` activity;
4. mark migration completed only after all records succeed;
5. do not delete local data during initial migration;
6. switch UI reads to server CRM after migration;
7. retain rollback-safe local data until a later cleanup milestone.

Migration must be idempotent.

## 14. Offline / Backend-Unavailable Behavior

CRM is server-backed.

If CRM API is unavailable:

- existing local workflow remains readable;
- new CRM-changing actions are disabled or queued only if an explicit safe queue is implemented;
- never claim a CRM save succeeded unless backend confirms it;
- show `CRM unavailable · local workflow safe`.

V1 recommendation: **disable CRM writes when backend unavailable rather than invent an offline mutation queue.**

## 15. Error Handling

### Duplicate domain
Server returns existing canonical company and treats request as update/upsert.

### Version/race
Use transaction/upsert semantics in D1.

### Invalid stage/lifecycle
400 with stable error code.

### Unauthorized workspace
403.

### Missing company
404.

### Suppressed company re-add
409:
`CRM_COMPANY_SUPPRESSED`

### Oversized evidence
Bound and sanitize evidence before storage.

## 16. TDD Implementation Order

1. Migration schema tests — RED.
2. Company domain normalization/dedup tests — RED.
3. CRM company API tests — RED.
4. Lifecycle/pipeline transition tests — RED.
5. Contact dedup tests — RED.
6. Activity-writing tests — RED.
7. Suppression enforcement tests — RED.
8. Existing-pipeline migration tests — RED.
9. Discovery CRM integration tests — RED.
10. Pipeline server-source tests — RED.
11. Gmail activity integration tests — RED.
12. CRM UI structure/behavior tests — RED.
13. Production/static artifact tests.
14. Full existing test suites.
15. Browser end-to-end verification.

Every production behavior must first have an observed failing test.

## 17. Expected Files

### Backend

Create:

```text
backend/migrations/0011_master_crm.sql
backend/src/crm.js
backend/src/crm-routes.js
backend/test/crm-schema.test.mjs
backend/test/crm.test.mjs
backend/test/crm-routes.test.mjs
```

Potentially modify:

```text
backend/src/app.js
backend/src/gmail.js
backend/src/saas-routes.js
backend/test/gmail.test.mjs
backend/test/routes.test.mjs
```

### Customer

Create:

```text
customer/crm-engine.js
customer/crm-ui.js
customer/crm.css
customer/test/crm-engine.test.js
customer/test/crm-structure.test.js
customer/test/crm-integration.test.js
```

Modify:

```text
customer/index.html
customer/app.js
customer/discovery-ui.js
customer/outreach-ui.js
customer/delivery-ui.js
customer/production-gmail-ui.js
customer/server-bridge.js
customer/styles.css
customer/test/discovery-engine.test.js
customer/test/gmail-production.test.js
customer/test/deployment.test.js
.github/workflows/backend-ci.yml
.github/workflows/customer-ci.yml
```

Exact files may be reduced if existing module boundaries already provide a cleaner integration point.

## 18. CI / Release Cleanup in Same Milestone

Because GitHub Pages is retired:

- remove stale `.github/workflows/deploy-pages.yml` path references from Customer V2 CI;
- ensure relevant tests run on `main` as well as feature/PR paths;
- preserve Vercel as frontend deployment system;
- preserve Cloudflare Worker/D1 as backend;
- do not restore Pages deployment.

Release gates:

```text
backend tests
customer tests
syntax checks
dependency audit
Vercel production READY
custom domain points at production
Cloudflare /api/health = 200
CRM migration applied
authenticated CRM smoke test
Discovery → CRM → Pipeline smoke test
Gmail/reply path regression test
no forbidden source/test trees published
```

## 19. Acceptance Scenarios

### A. First discovery
- discover example.com;
- Save to CRM;
- company exists once;
- activity recorded.

### B. Rediscovery
- discover example.com again;
- same company updated;
- no duplicate.

### C. Pipeline
- add CRM company to pipeline;
- stage Discovered;
- remove from pipeline;
- company/history remain.

### D. Customer
- mark customer;
- visible under Customers;
- remains searchable.

### E. Archive
- archive prospect;
- disappears from active views;
- restore returns it to prospect lifecycle without automatically re-adding to pipeline.

### F. Suppression
- suppress company;
- Discovery recognizes existing suppressed company;
- normal add-to-pipeline is blocked.

### G. Contact
- same work email discovered twice;
- one contact record remains.

### H. Gmail
- approved send creates one `email.sent` activity;
- idempotent duplicate send does not create duplicate commercial event.

### I. Reply
- synced reply adds activity;
- appropriate CRM pipeline update occurs.

### J. Browser reset
- clear browser localStorage;
- sign back in;
- CRM companies/history remain.

### K. Multi-device
- same workspace on another browser/device sees same CRM.

### L. Workspace isolation
- company saved in workspace A is invisible to workspace B unless independently saved there.

## 20. Definition of Done

This milestone is complete only when:

1. D1 migration applied safely.
2. Master CRM APIs pass tests.
3. Discovery persists companies into CRM.
4. Pipeline reads/writes durable CRM state.
5. Remove from Pipeline preserves company/history.
6. Contacts persist and deduplicate safely.
7. Gmail send/reply actions create CRM activities.
8. CRM UI supports search/filter/core actions.
9. Existing local pipeline migrates idempotently.
10. Suppression blocks accidental reactivation/outreach.
11. 500 KB customer-state budget remains intact.
12. All backend/customer tests pass.
13. Vercel production deployment is READY.
14. Cloudflare health is green.
15. Exact live-domain end-to-end acceptance path is verified.
16. No claim of "complete" is made until those checks have evidence.

## 21. Future Extensions

This architecture intentionally supports later:

- external CRM connectors;
- background Gmail polling/webhooks;
- sales forecasting;
- account ownership;
- company relationship graphs;
- opportunity objects separate from company;
- multiple concurrent opportunities per company;
- AI account planning;
- monitoring/research refresh jobs;
- automated signal change alerts;
- customer health/expansion opportunities.
