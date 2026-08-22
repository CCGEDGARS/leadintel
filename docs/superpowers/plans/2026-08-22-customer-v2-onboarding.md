# LeadIntel Customer V2 Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe customer-facing onboarding and approved Company Intelligence Profile at `/customer/` while preserving `/v2/`.

**Architecture:** Static GitHub Pages customer workspace with a deterministic profile engine, browser-local state, existing Firecrawl proxy for public-page evidence and browser-side PDF text extraction. Customer strategic answers are authoritative and evidence gaps remain explicit.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node built-in test runner, PDF.js 6.2.108, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-22-customer-v2-onboarding-design.md`

## Global Constraints
- Do not modify legacy `/v2/` application files.
- Main website is required; additional URLs and PDFs are optional.
- Ten canonical onboarding questions; lookalike customers is the only optional question.
- Questionnaire answers override conflicting public website inference.
- Never invent missing intelligence; report gaps.
- PDF original bytes are not persisted by the onboarding page.
- Deployment must continue copying `v2/.` to `.pages/v2/`.

---

### Task 1: Profile engine
**Files:** Create `customer/profile-engine.js`; Test `customer/test/profile-engine.test.js`.
- [x] Write failing tests for URL normalization, completeness, precedence, market inference, signal recommendations, document evidence, information gaps and state normalization.
- [x] Run tests and confirm failure while engine is absent.
- [x] Implement the minimal profile engine.
- [x] Run tests and confirm all engine tests pass.

### Task 2: Customer onboarding interface
**Files:** Create `customer/index.html`, `customer/styles.css`, `customer/app.js`; Test `customer/test/structure.test.js`.
- [x] Write failing structural tests for company sources, ten questions and profile approval controls.
- [x] Implement the three-step responsive customer UI.
- [x] Wire local persistence, PDF text extraction, Firecrawl source collection, profile editing, signal toggles and approval.
- [x] Run structural tests and JavaScript syntax checks.

### Task 3: Safe Pages deployment
**Files:** Modify `.github/workflows/deploy-pages.yml`; Test `customer/test/deployment.test.js`.
- [x] Write failing test requiring `/customer/` artifact copy while retaining `/v2/` copy.
- [x] Update Pages workflow path filters and artifact build.
- [x] Run deployment tests and confirm legacy copy remains present.

### Task 4: CI verification
**Files:** Create `.github/workflows/customer-ci.yml`.
- [x] Add push/PR verification for customer files.
- [x] Run Node tests and JavaScript syntax checks in GitHub Actions.
- [x] Confirm the feature branch CI result before merge.
