# Search Relevance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve company relevance and efficient research without changing qualification scores or automation policy.

**Architecture:** Extend the existing discovery engine with pure planning, screening and feedback functions; wire them through the existing Companies runner and authenticated query planner. Persist feedback in the existing workspace-scoped discovery section.

**Tech Stack:** Browser JavaScript, Node test runner, existing Firecrawl/AI endpoints, existing GitHub/Vercel release pipeline.

**Spec:** docs/superpowers/specs/2026-10-20-search-relevance.md

## Global Constraints
- Automatic company threshold remains 80; email readiness is separate.
- Preserve existing evidence, companies, buyer selections and scores.
- Workspace context determines behavior; no named-customer runtime defaults.
- All paid calls use the existing shared budget; no new provider or automatic outreach.
- Explicit signals/lookalike modes and event audience rules remain enforced.

## Review Focus
- Sparse and non-English profiles must not acquire an invented industrial ICP.
- Mixed-company evidence must not give one company another company's fit.
- Feedback from another workspace or obsolete offer must not affect searches.
- Bad-fit feedback must remain reversible and preserve checked company cards.
- Provider failures, cancellation and budget exhaustion must preserve completed work and stop new paid calls.

### Task 1: Context-driven queries and early screening
**Files:** customer/discovery-engine.js; customer/first-party-research.js; customer/test/discovery-search-relevance.test.js; customer/test/first-party-research.test.js.
**Interfaces:** existing buildDiscoveryQueries/buildDiscoveryFollowUpQueries; new prioritizeCompanyMentions(mentions,evidence,profile,limit), normalizeSearchFeedback(rows), recordSearchFeedback(rows,candidate,decision,profile), searchFeedbackForProfile(rows,profile).
- [ ] Write and run failing cross-industry, mode, diversity, per-company evidence, feedback-scope and parsing regressions. Expected: new behaviors fail.
- [ ] Implement context query families, bounded early screening and validated planning routes. Expected: focused tests pass.
- [ ] Commit engine changes after focused tests pass.

### Task 2: Runner, feedback controls and durable handoff
**Files:** customer/discovery-ui.js; customer/discovery-engine.js; customer/discovery.css; customer/test/discovery-global-timeout.test.js.
**Interfaces:** Task 1 functions used by extraction, follow-up, planner and feedback actions; normalized discovery.searchFeedback survives reload.
- [ ] Add failing real-runner and UI tests for prioritized paid research, adaptive follow-up after a failed sibling, feedback save/reload/undo and score preservation. Expected: tests expose missing integration.
- [ ] Implement feedback controls, run-time context binding, broad bounded extraction, prioritized verification and gap-driven follow-up. Expected: new tests and existing discovery regressions pass.
- [ ] Commit integrated change and record verification.

### Task 3: Release and acceptance evidence
**Files:** customer/index.html; release-integrity.config.json; docs/project-state/2026-10-20-search-relevance.md.
**Interfaces:** refreshed asset entry URLs and mandatory release smoke checks cover changed runtime.
- [ ] Refresh only changed asset boundaries, document root causes and test limits.
- [ ] Run full customer/backend suites, JavaScript checks and build. Expected: zero failures.
- [ ] Obtain independent whole-branch review; fix important findings with RED/GREEN tests.
- [ ] Push branch, open PR, verify required exact-head CI, merge authorized implementation and inspect exact-main release proof. Expected: PROVEN or explicit unresolved gate.
- [ ] Report code, release and authenticated customer evidence separately.
