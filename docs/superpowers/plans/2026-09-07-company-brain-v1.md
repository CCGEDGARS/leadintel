# Company Brain v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LeadIntel Step 3 classify the business before inference, eliminate false keyword-driven pains/default signals, deepen first-party source collection, and keep generated commercial intelligence evidence-grounded and language-consistent.

**Architecture:** Add a focused `company-brain.js` module for business classification, contextual pain families, evidence-aware signal recommendations and claim metadata. Integrate it into existing `profile-engine.js`, `business-identity.js` and `app.js` without breaking the existing profile shape. Add bounded first-party link discovery from the homepage scrape rather than introducing a new backend dependency.

**Tech Stack:** Browser JavaScript, Node test runner, existing Firecrawl proxy, current LeadIntel customer app.

**Spec:** `docs/superpowers/specs/2026-09-07-company-brain-v1-design.md`

## Global Constraints

- Existing saved workspaces must continue to load.
- Existing `profile` fields remain available for Step 4 consumers.
- New metadata is additive.
- Tenders/procurement are excluded unless explicitly evidenced or enabled by user input.
- A single broad noun such as `instrument`, `tool`, `office`, or `training` must never be sufficient by itself to classify a company or generate a customer pain.
- Generated presentation text follows selected UI language; evidence excerpts remain original.
- Automatic first-party discovery is capped at 8 URLs.

---

### Task 1: Company Brain classification and contextual inference

**Files:**
- Create: `customer/company-brain.js`
- Create: `customer/test/company-brain.test.js`

**Interfaces:**
- Produces: `LeadIntelCompanyBrain.classifyCompany(input)`, `derivePainPoints(profile,input,language)`, `recommendSignals(input)`, `claim(value,status,confidence,evidenceIds)`.

- [ ] **Step 1: Write failing tests** covering professional-services classification, `digital tools` not causing warehouse pains, professional-services pain families, and no unconditional facility/capex/tender defaults.
- [ ] **Step 2: Run** `node --test customer/test/company-brain.test.js` and confirm RED.
- [ ] **Step 3: Implement** `company-brain.js` as an IIFE/CommonJS-compatible module with contextual phrase scoring and explicit classification thresholds.
- [ ] **Step 4: Run** `node --test customer/test/company-brain.test.js` and confirm GREEN.
- [ ] **Step 5: Commit** module + tests.

### Task 2: Replace profile signal defaults with Company Brain recommendations

**Files:**
- Modify: `customer/profile-engine.js`
- Modify: `customer/app.js`
- Test: `customer/test/profile-engine.test.js` and/or `customer/test/company-brain.test.js`

**Interfaces:**
- Consumes: `LeadIntelCompanyBrain.recommendSignals(input)`.
- Produces: `profile.companyClassification`, `profile.companyClaims`, `profile.recommendedSignals` while preserving existing profile fields.

- [ ] **Step 1: Add failing tests** asserting no generic signal defaults and tender omission without evidence.
- [ ] **Step 2: Run targeted tests** and confirm RED.
- [ ] **Step 3: Import `company-brain.js` before `business-identity.js` in `app.js`; update `buildCompanyIntelligenceProfile` to store classification and use Company Brain signal recommendations when available, with safe legacy fallback only if module is unavailable.**
- [ ] **Step 4: Run targeted tests** and confirm GREEN.
- [ ] **Step 5: Commit** integration.

### Task 3: Replace keyword-only customer pains/framework contamination

**Files:**
- Modify: `customer/business-identity.js`
- Test: `customer/test/business-identity.test.js` and `customer/test/company-brain.test.js`

**Interfaces:**
- Consumes: `profile.companyClassification`, `LeadIntelCompanyBrain.derivePainPoints`.
- Produces: current Step 3 Customer Pain Points and commercial framework fields using classification-aware outcomes.

- [ ] **Step 1: Add failing regression test** where professional-services source text contains `digital tools` and assert no warehouse/storage pain or warehouse FAB benefit.
- [ ] **Step 2: Run targeted test** and confirm RED.
- [ ] **Step 3: Route `deriveCustomerPainPoints` through Company Brain when available; tighten warehouse fallback regex so `instrument` alone cannot trigger storage/workshop logic. Make inferred benefits/advantages respect classification before industry-specific heuristics.**
- [ ] **Step 4: Run targeted tests** and confirm GREEN.
- [ ] **Step 5: Commit** regression fix.

### Task 4: Bounded first-party source discovery

**Files:**
- Modify: `customer/app.js`
- Create or modify: `customer/test/source-discovery.test.js`

**Interfaces:**
- Produces: `discoverFirstPartySources(primaryUrl,markdown)` and page-category metadata for up to 8 first-party URLs.

- [ ] **Step 1: Write failing tests** for canonical-domain filtering, deduplication, exclusion of assets/login/privacy noise and prioritization of about/services/cases/clients/method/contact URLs.
- [ ] **Step 2: Run targeted test** and confirm RED.
- [ ] **Step 3: Implement discovery from homepage markdown links; after homepage scrape, scrape prioritized discovered URLs without blocking analysis if any fail; tag page categories.**
- [ ] **Step 4: Run targeted tests** and confirm GREEN.
- [ ] **Step 5: Commit** source discovery.

### Task 5: Language consistency and compatibility

**Files:**
- Modify: `customer/business-identity.js`
- Modify: `customer/profile-engine.js` if needed
- Test: existing language/business-identity tests plus new assertions.

**Interfaces:**
- Consumes: selected workspace language.
- Produces: consistent generated Latvian or English UI copy while evidence excerpts remain untouched.

- [ ] **Step 1: Add failing assertions** for Latvian/English framework copy consistency.
- [ ] **Step 2: Run targeted test** and confirm RED if current behavior violates it.
- [ ] **Step 3: Normalize generated fallback/pain/framework copy through the existing language selector; do not translate evidence excerpts.**
- [ ] **Step 4: Run targeted tests** and confirm GREEN.
- [ ] **Step 5: Commit** language consistency changes.

### Task 6: Full verification and release preparation

**Files:**
- No product-code changes unless verification exposes a defect.

- [ ] **Step 1: Run** `node --test customer/test/*.test.js`.
- [ ] **Step 2: Run syntax checks** equivalent to `.github/workflows/customer-ci.yml`, including `node --check customer/company-brain.js`, `profile-engine.js`, `business-identity.js`, and `app.js`.
- [ ] **Step 3: Inspect git diff** for accidental unrelated changes and verify the CCGROUP regression tests explicitly cover the observed failure.
- [ ] **Step 4: Open PR** with root cause, architecture, test evidence and rollout notes.
- [ ] **Step 5: Do not merge until CI passes on exact PR SHA; after merge, use release-integrity proof before calling it production.**
