# Company Intelligence Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans or subagent-driven-development. Execute with TDD and verify the exact final head before merge.

**Goal:** Make website + target market trigger bounded company/public web research and evidence-backed prefill of the ten strategic context fields, then publish the complete development update set to production.

**Architecture:** Add a testable `company-research-engine.js` for query construction, source normalization, AI JSON parsing, conservative fallback and merge safety. Add a `company-research-ui.js` module that intercepts the Step 1 CTA before the legacy navigation handler, runs the existing Firecrawl proxy and authenticated workspace AI route, persists answers/evidence in the existing Customer V2 state, and reloads Step 2 for review. Keep profile/strategy/discovery architecture unchanged.

**Tech Stack:** Vanilla JS, existing Firecrawl Worker proxy, existing LeadIntel Cloudflare Worker AI route, localStorage + current server bridge, Node `node:test`, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-26-company-intelligence-autofill-design.md`

## Task 1 — Research engine (TDD)

**Create:**
- `customer/company-research-engine.js`
- `customer/test/company-research-engine.test.js`

- [ ] RED: query builder caps public research at 3 and includes company/domain + target market context.
- [ ] RED: Firecrawl result normalization deduplicates URLs, rejects unsafe URLs and preserves source evidence.
- [ ] RED: strict AI draft parser whitelists 10 question IDs, confidence values and valid source IDs.
- [ ] RED: merge never overwrites non-empty answers.
- [ ] RED: evidence fallback leaves unsupported value/objective/exclusions blank.
- [ ] GREEN: implement engine until tests pass.

## Task 2 — Automatic research UX

**Create:**
- `customer/company-research-ui.js`
- `customer/company-research.css`

**Modify:**
- `customer/process-map.js`
- `customer/index.html` only where needed for cache/versioning
- `customer/test/structure.test.js`
- `customer/test/premium-ux-redesign.test.js` / cache tests as needed

- [ ] RED: Customer V2 loads the research module.
- [ ] RED: Step 1 action is research-first rather than questionnaire-first.
- [ ] RED: Step 2 exposes research summary and field provenance UI hooks.
- [ ] GREEN: intercept Step 1 CTA in capture phase, validate website + target market, collect optional links/PDF evidence, run research, persist state, navigate/reload to Step 2.
- [ ] GREEN: render source/confidence metadata and Needs your input states.
- [ ] GREEN: explicit rerun action available without silently overwriting non-empty answers.

## Task 3 — Firecrawl + AI execution

**Modify/Create within research modules:**

- [ ] Scrape website + supplied links through existing `/firecrawl-scrape`.
- [ ] Run max 3 public searches through existing `/firecrawl-search`, max 4 results each.
- [ ] Deduplicate/cap persisted sources to protect 1 MB Customer State ceiling.
- [ ] Attempt `/api/ai/generate?workspace_id=...` only when authenticated workspace context exists.
- [ ] Use strict evidence-only JSON prompt and sanitize parse failures.
- [ ] Fall back to deterministic evidence draft on 401/409/upstream failure.
- [ ] Preserve all existing non-empty answers on merge.
- [ ] Invalidate stale profile/market state after fresh onboarding research.

## Task 4 — Regression and cache contract

**Modify:**
- `.github/workflows/customer-ci.yml`
- relevant cache-version tests

- [ ] Add syntax checks for both new JS modules.
- [ ] Bump static shell/process-map release key so existing browsers load the research module.
- [ ] Run full `node --test customer/test/*.test.js` in CI.
- [ ] Run all Customer V2 JavaScript syntax checks.

## Task 5 — Review and production merge

- [ ] Compare `feature/customer-v2-mission-migration` against `main` and confirm it contains: mission migration/cache fix, mandatory target market selector, region expansion, compact optional source fields, and company intelligence autofill.
- [ ] Review for accidental files, stale domains, secrets, raw provider keys, or production-domain regressions.
- [ ] Confirm Vercel preview is READY on exact final branch SHA.
- [ ] Create PR from development branch to `main`.
- [ ] Confirm Customer V2 CI (and any applicable backend CI) is green on exact PR head.
- [ ] Merge PR.

## Task 6 — Production verification

- [ ] Confirm Vercel production deployment is READY on merge SHA.
- [ ] Verify `https://leadintel.ccgroup.lv/customer/` serves the new release.
- [ ] Verify research engine/UI assets are reachable and current.
- [ ] Verify approved LeadIntel mission copy is live.
- [ ] Verify target market selector and compact source CSS are live.
- [ ] Verify Cloudflare Worker `/api/health` is 200.
- [ ] Verify production origin remains allowed by backend CORS configuration.
- [ ] If authenticated live AI run cannot be performed through available tools, stop short of claiming full AI E2E and ask the user for exactly one small UI action to run the final signed-in test.