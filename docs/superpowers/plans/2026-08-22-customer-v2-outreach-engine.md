# LeadIntel Customer V2 Opportunity Dossier & Outreach Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/customer/` from saved Discovery pipeline companies into evidence-backed opportunity dossiers and human-approved outreach packages.

**Architecture:** Add a pure `outreach-engine.js` for research normalization, dossier synthesis, offer recommendation, grounded draft generation and state normalization. Add a modular `outreach-ui.js`/`outreach.css` Step 6 that reads the existing customer/discovery browser state, performs one official scrape plus at most two targeted Firecrawl searches, renders/edit drafts, and updates the existing local pipeline only after approval/manual contact actions.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node built-in test runner, Firecrawl scrape/search proxy, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-22-customer-v2-outreach-engine-design.md`

## Global Constraints
- Do not modify legacy `/v2/` application files.
- Require at least one saved pipeline company before Step 6 can build a dossier.
- Maximum one official-site scrape + two Firecrawl searches per dossier build; five search results per query.
- Never fabricate company facts, purchase intent, budgets, pains or events.
- Hypotheses must remain separated and visibly labelled from evidence.
- Use only approved priority offers and approved buyer-role context.
- Do not introduce email/phone enrichment or automatic sending.
- Approval may move pipeline to `Ready for Outreach`; manual contact confirmation may move it to `Contacted`.
- Outreach state persists separately under `leadintel_customer_v2_outreach`.

---

### Task 1: Outreach engine
**Files:** Create `customer/outreach-engine.js`; Create `customer/test/outreach-engine.test.js`.

**Interfaces:**
- Consumes: one Discovery pipeline item, approved Company Intelligence Profile, activated Market Strategy, deep-research results.
- Produces: `buildDossierSearchQueries(candidate,profile,market,maxQueries)`, `normalizeDossierResearchResults(payload,meta)`, `recommendOffer(candidate,profile,research)`, `buildOpportunityDossier(candidate,profile,market,research)`, `buildOutreachDrafts(dossier,contact,profile,tone)`, `approveOutreachItem(item,editedDrafts)`, `normalizeOutreachState(value)`.

- [ ] Write failing tests for search cap/context, research normalization, evidence-only Why Now, approved-offer selection, safe drafts, approval gate and state caps.
- [ ] Run tests and confirm failure because `outreach-engine.js` does not exist.
- [ ] Implement the minimal pure engine.
- [ ] Run outreach-engine tests and confirm pass.

### Task 2: Step 6 Opportunity Dossier UI
**Files:** Create `customer/outreach-ui.js`, `customer/outreach.css`; Modify `customer/index.html`; Modify `customer/test/structure.test.js`.

**Interfaces:**
- Consumes: `LeadIntelOutreach`, existing customer profile/market local state and existing Discovery pipeline local state.
- Produces: Step 6 navigation, pipeline-company selector/cards, dossier build action, Why Now, recommended offer, buyer strategy, evidence ledger, hypotheses, editable email/LinkedIn drafts, approval and mark-contacted controls.

- [ ] Add failing structural assertions for Outreach modules, Step 6, dossier builder, evidence ledger, email/LinkedIn editors, approval and contact controls.
- [ ] Inject Step 6 after existing modular Discovery UI.
- [ ] Gate dossier build on a saved pipeline company.
- [ ] Perform one official Firecrawl scrape and at most two Firecrawl searches.
- [ ] Build/render dossier through `LeadIntelOutreach`.
- [ ] Allow contact selection from already discovered people.
- [ ] Generate three deterministic tones: Consultative, Direct, Brief.
- [ ] Persist user edits before approval.
- [ ] Approval updates matching discovery pipeline domain to `Ready for Outreach` unless already later.
- [ ] Manual `Mark contacted` updates to `Contacted` unless already later.
- [ ] Add copy-to-clipboard controls; do not send externally.

### Task 3: CI hardening
**Files:** Modify `.github/workflows/customer-ci.yml`.

- [ ] Keep full `node --test customer/test/*.test.js` suite.
- [ ] Add syntax checks for `customer/outreach-engine.js` and `customer/outreach-ui.js`.
- [ ] Open PR and verify Customer V2 CI is green.

### Task 4: Integration verification
**Files:** No production changes unless verification reveals a defect.

- [ ] Confirm PR contains no `v2/**` changes.
- [ ] Confirm tests and syntax checks pass on the final PR tree.
- [ ] Merge only after PR is mergeable and CI successful.
- [ ] Confirm `main/customer/outreach-engine.js`, `outreach-ui.js`, `outreach.css` and existing `/v2/` remain present after merge.