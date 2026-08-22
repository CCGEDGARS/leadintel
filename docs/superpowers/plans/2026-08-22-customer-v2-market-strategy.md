# LeadIntel Customer V2 Market Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/customer/` from approved Company Intelligence Profile into a working ICP, Signal Designer and live Market Opportunity strategy stage.

**Architecture:** Add a pure `market-engine.js` module for deterministic strategy logic and scoring. Extend browser state with a `market` object, wire Step 4 into the existing onboarding UI, and use the existing Firecrawl `/firecrawl-search` proxy only on explicit research runs with a four-query cap.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node built-in test runner, Firecrawl proxy, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-22-customer-v2-market-strategy-design.md`

## Global Constraints
- Do not modify legacy `/v2/` application files.
- Require an approved Company Intelligence Profile before Step 4 becomes actionable.
- Maximum four Firecrawl searches per manual run; maximum five normalized results per query.
- Market hypothesis score = Fit + Intent + Timing + Value + Evidence, each 0–20.
- Never fabricate evidence, companies or market events.
- Strategy state persists separately under `state.market`.
- Existing onboarding behavior and tests must remain green.

---

### Task 1: Market strategy engine
**Files:** Create `customer/market-engine.js`; Create `customer/test/market-engine.test.js`.

**Interfaces:**
- Consumes: approved profile object from `LeadIntelProfile.buildCompanyIntelligenceProfile`.
- Produces: `buildIcpCandidates(profile)`, `normalizeSignals(profileSignals, savedSignals)`, `addCustomSignal(signals,input)`, `buildResearchQueries(profile,signals,maxQueries)`, `normalizeSearchResults(payload,query)`, `buildMarketOpportunities(profile,icps,signals,researchResults)`, `normalizeMarketState(value)`.

- [ ] Write failing tests for ICP generation, signal normalization/custom signals, research-query limits, search normalization, five-part scoring and market-state normalization.
- [ ] Run the tests and confirm failure because `market-engine.js` does not exist.
- [ ] Implement the minimal pure engine.
- [ ] Run market-engine tests and confirm pass.

### Task 2: Step 4 UI and state integration
**Files:** Modify `customer/index.html`, `customer/app.js`, `customer/styles.css`; Modify `customer/test/structure.test.js`.

**Interfaces:**
- Consumes: `LeadIntelMarket` public functions from Task 1 and existing customer state/profile.
- Produces: editable ICP cards, editable signal rows, custom signal creation, live research run, opportunity cards, strategy activation.

- [ ] Add failing structural assertions for Step 4, ICP Engine, Signal Designer, research controls, score components and strategy activation.
- [ ] Extend state load/save with `market` state without changing onboarding normalization semantics.
- [ ] Add Step 4 navigation and approved-profile gate.
- [ ] Render ICPs and Signal Designer, including active toggles, weight/keywords/name editing and custom signal creation.
- [ ] Add explicit `Run market research` flow using `/firecrawl-search` with maximum four requests.
- [ ] Render ranked opportunities with Fit/Intent/Timing/Value/Evidence breakdown and source links.
- [ ] Add Activate Strategy action and persist approval timestamp.
- [ ] Run structural tests and syntax checks.

### Task 3: CI hardening
**Files:** Modify `.github/workflows/customer-ci.yml`.

- [ ] Generalize feature-branch trigger for Customer V2 work.
- [ ] Run all `customer/test/*.test.js` tests.
- [ ] Add syntax check for `customer/market-engine.js`.
- [ ] Open PR and verify GitHub Actions is green before merge.

### Task 4: Integration verification
**Files:** No production file changes unless verification reveals a defect.

- [ ] Confirm PR changes do not include `v2/**`.
- [ ] Confirm CI job reports tests and syntax checks successful.
- [ ] Merge to `main` only after the PR is mergeable and CI is successful.
- [ ] Confirm `main/customer/index.html`, `main/customer/market-engine.js` and Pages workflow are present after merge.
