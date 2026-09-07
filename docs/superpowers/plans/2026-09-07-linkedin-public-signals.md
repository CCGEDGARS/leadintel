# LinkedIn Public Signal Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compliant LinkedIn public-index research category with explicit provenance and Apollo identity-link separation.

**Architecture:** A focused browser-side extension wraps the existing market-engine public API instead of rewriting it. It adds LinkedIn public-index query families, preserves LinkedIn source selection/state, tags normalized results with `linkedin-public-index`, and adds the source checkbox to the existing research UI. Apollo LinkedIn URLs remain identity enrichment, not signal evidence.

**Tech Stack:** Existing customer JavaScript market engine, OpenAI web search, Firecrawl/Scrapling verification, Apollo enrichment, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-07-linkedin-public-signals-design.md`

## Global Constraints
- Do not scrape authenticated/restricted LinkedIn pages.
- Never emit `linkedin-api` unless an authorized LinkedIn-backed provider actually ran.
- A LinkedIn URL alone is not sufficient buying-signal evidence.
- Preserve tender exclusions and normal Market Scan/Research/Intelligence limits.

---

### Task 1: LinkedIn source extension
**Files:**
- Create: `customer/linkedin-signals.js`
- Test: `customer/test/linkedin-signals.test.js`

- [ ] Write failing tests for public-index query generation, state preservation, provenance tagging and absence of `linkedin-api` claims.
- [ ] Implement a wrapper around `LeadIntelMarket.buildResearchQueries`, `filterResearchSourceTypes`, `normalizeSearchResults`, and `normalizeMarketState`.
- [ ] Generate leadership, hiring and company-activity query families constrained to public LinkedIn URLs.
- [ ] Run focused tests.

### Task 2: UI activation
**Files:**
- Modify: `customer/process-map.js`
- Test: `customer/test/linkedin-signals-ui.test.js`

- [ ] Add the LinkedIn extension import.
- [ ] Dynamically add `LinkedIn public signals` to research source categories when the research UI exists.
- [ ] Keep it off for the fastest Market Scan by default and available for Market Research/Market Intelligence.
- [ ] Add explanatory copy that this is public-index research, not login bypass.
- [ ] Run UI tests and full customer tests.

### Task 3: Documentation and release
**Files:**
- Modify: `docs/market-research-and-monitoring.md`

- [ ] Document source provenance distinctions: `linkedin-public-index`, `apollo-linkedin-url`, reserved `linkedin-api`.
- [ ] Open PR and inspect changed scope.
- [ ] Merge only after Customer V2 CI succeeds.
- [ ] Verify exact production SHA through release-integrity before calling the feature live.
