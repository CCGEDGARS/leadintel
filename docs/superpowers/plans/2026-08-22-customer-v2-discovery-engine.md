# LeadIntel Customer V2 Discovery Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/customer/` from activated Market Strategy into real company discovery, evidence-backed company scoring, Apollo decision-maker discovery and a persistent customer pipeline.

**Architecture:** Add a pure `discovery-engine.js` for candidate normalization, filtering, scoring, Apollo payload/result normalization and pipeline state. Extend the existing customer state with `state.discovery`, add Step 5 UI, use the existing Firecrawl proxy for explicit company searches and the existing Apollo people-search proxy only on explicit per-company requests.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node built-in test runner, Firecrawl search proxy, Apollo People API Search proxy, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-22-customer-v2-discovery-engine-design.md`

## Global Constraints
- Do not modify legacy `/v2/` application files.
- Require an activated Market Strategy before Step 5 company discovery runs.
- Maximum four Firecrawl company-search requests per manual run and five results per query.
- Maximum twelve normalized company candidates per run.
- Company Opportunity Score = Fit 0–30 + Signal 0–25 + Evidence 0–20 + Timing 0–15 + Value 0–10.
- Never create a candidate without a source URL and canonical domain.
- Exclude obvious news/social/directory hosts from candidate creation.
- Apollo People Search runs only after an explicit user action for one candidate and returns at most five people.
- Do not store personal emails or phone numbers in this milestone.
- Pipeline deduplicates by company domain and supports established LeadIntel CRM stages.

---

### Task 1: Discovery engine
**Files:** Create `customer/discovery-engine.js`; Create `customer/test/discovery-engine.test.js`.

**Interfaces:**
- Consumes: approved Company Intelligence Profile and activated `state.market`.
- Produces: `buildDiscoveryQueries(profile,market,maxQueries)`, `normalizeCompanySearchResults(payload,queryMeta)`, `mergeCompanyCandidates(results,profile,market)`, `buildApolloPeopleSearchPayload(candidate,profile)`, `normalizeApolloPeople(payload)`, `upsertPipelineItem(pipeline,candidate)`, `normalizeDiscoveryState(value)`.

- [ ] Write failing tests for discovery query guard, blocked-domain filtering, domain deduplication, five-part company scoring, signal evidence matching, Apollo request filters, Apollo no-email normalization, pipeline deduplication and state caps.
- [ ] Run tests and confirm failure because `discovery-engine.js` does not exist.
- [ ] Implement the minimal pure engine.
- [ ] Run the discovery-engine tests and confirm pass.

### Task 2: Step 5 Discovery UI
**Files:** Modify `customer/index.html`, `customer/app.js`; Create `customer/discovery.css`; Modify `customer/test/structure.test.js`.

**Interfaces:**
- Consumes: `LeadIntelDiscovery` functions and existing profile/market state.
- Produces: company discovery controls, ranked candidate cards, source evidence, matched signals, Apollo decision-maker action, save-to-pipeline action and pipeline stage controls.

- [ ] Add failing structure tests for Step 5, run discovery, candidate list, company score dimensions, decision-maker action, pipeline table and pipeline stage control.
- [ ] Extend load/save with `state.discovery` while preserving existing onboarding and market strategy state.
- [ ] Gate Step 5 on `state.market.strategyApproved`.
- [ ] Run Firecrawl company discovery with a four-query hard cap.
- [ ] Render up to twelve ranked candidates with score breakdown, evidence and matched signals.
- [ ] Add explicit Apollo `Find decision-makers` request for one candidate, maximum five people.
- [ ] Add Save to Pipeline and duplicate-safe pipeline persistence.
- [ ] Add manual pipeline stage selector using established CRM stages.
- [ ] Run all structure tests and JavaScript syntax checks.

### Task 3: CI verification
**Files:** Modify `.github/workflows/customer-ci.yml`.

- [ ] Add syntax check for `customer/discovery-engine.js`.
- [ ] Keep `node --test customer/test/*.test.js` as the full customer suite.
- [ ] Open PR and verify Customer V2 CI is green.

### Task 4: Integration verification
**Files:** No production file changes unless verification finds a defect.

- [ ] Confirm PR contains no `v2/**` changes.
- [ ] Confirm CI tests and syntax checks pass.
- [ ] Merge to `main` only after PR is mergeable and CI is successful.
- [ ] Confirm `main/customer/discovery-engine.js`, Step 5 markup and existing `/v2/` remain present after merge.
