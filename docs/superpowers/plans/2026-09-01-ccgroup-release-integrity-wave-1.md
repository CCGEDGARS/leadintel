# CCGROUP Release Integrity Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the approved CCGROUP fail-closed release-integrity standard in the four GitHub-linked Vercel applications in Wave 1 and prove each real production target against its exact `main` SHA.

**Architecture:** Each repository receives the versioned local verifier package proven in LeadIntel, an app-specific exact-SHA release endpoint, a stable release-health endpoint, deterministic smoke checks, a dedicated CI workflow, a post-CI proof workflow, and mandatory agent policy. `ai-sales-platform` is a multi-target repository: the same source SHA must be independently proven on both AI Sales Platform and Dana Studio production domains using separate configs and proof files.

**Tech Stack:** Node.js built-in test runner and `fetch`, GitHub Actions, Vercel Git deployments, Next.js API routes where applicable, Vercel Node functions for static/Vite apps, JSON release configuration.

**Spec:** `docs/superpowers/specs/2026-08-31-ccgroup-app-release-standard-design.md`

## Global Constraints

- Fail closed: pending, missing, inaccessible, stale, mismatched, failed, skipped-required, or partially verified evidence is never `PROVEN`.
- Exact 40-character Git SHA is the primary release identity.
- Fixed status vocabulary: `LATEST CODE`, `VERIFIED PREVIEW`, `PROVEN PRODUCTION`, `LAST KNOWN WORKING`.
- No older deployment may be substituted for a newer unproven revision.
- `release-proof*.json` must contain operational evidence only; never secrets, cookies, authorization values, provider keys, or sensitive response bodies.
- Every network request in the verifier must have a bounded timeout.
- Production verification runs only after the repository's required CI completes for the same exact `main` SHA.
- Every Vercel target must expose a cache-busted exact-SHA JSON identity and a deterministic release-health endpoint that does not depend on third-party provider availability.
- Existing feature/provider health endpoints remain untouched unless required for compatibility; release-health is intentionally separate from Gemini, OpenAI, Anthropic, Firecrawl, ElevenLabs, weather, or similar upstream status.
- A repository with multiple production targets must generate one proof per target; one successful target never proves another.
- Merge only through a reviewed feature branch. After merge, require exact-main CI, Vercel `READY` for the same SHA, live exact-SHA identity, health, smoke checks, and automatic proof success before calling the target `PROVEN PRODUCTION`.

---

### Task 1: `ai-sales-platform` — dual-target release identity and RED gate

**Files:**
- Create: `tests/release-integrity-core.test.mjs`
- Create: `tests/release-integrity-cli.test.mjs`
- Create: `tests/release-integrity-policy.test.mjs`
- Create: `tests/release-integrity-targets.test.mjs`
- Create: `.github/workflows/ccgroup-release-ci.yml`

**Interfaces:**
- Required CI workflow name: `CCGROUP Release CI`.
- Production targets: `https://ai-sales-platform.vercel.app` and `https://dana-studio-jet.vercel.app`.
- Shared service identity: `dana-ai-production-studio`.
- Live identity route: `/api/release`.
- Stable release health route: `/api/release-health`.

- [ ] **Step 1:** Create feature branch `feature/ccgroup-release-integrity` from current `main`.
- [ ] **Step 2:** Add tests that require the verifier core/CLI, two target configs, exact-SHA Next release route, stable release-health route, agent policy, workflow matrix, proof artifact retention, timeout behavior, and exact same CI head SHA for both targets.
- [ ] **Step 3:** Add `CCGROUP Release CI` that runs `npm test`, syntax-checks the release scripts, and is triggered by application source plus every release-integrity surface.
- [ ] **Step 4:** Push the RED state and require CI failure specifically because the package/config/routes are still absent. Do not fix unrelated tests under this step.

### Task 2: `ai-sales-platform` — GREEN dual-target implementation

**Files:**
- Create: `scripts/release-integrity-core.mjs`
- Create: `scripts/verify-release-integrity.mjs`
- Create: `release-integrity.ai-sales-platform.json`
- Create: `release-integrity.dana-studio.json`
- Create: `app/api/release/route.ts`
- Create: `app/api/release-health/route.ts`
- Create: `.github/workflows/release-integrity.yml`
- Create: `.agents/skills/release-integrity/SKILL.md`
- Create: `AGENTS.md`
- Modify: `.gitignore`

**Interfaces:**
- `GET /api/release` returns JSON `{service, commit, ref, provenance}` using `VERCEL_GIT_COMMIT_SHA` and `VERCEL_GIT_COMMIT_REF`, with `Cache-Control: no-store`.
- `GET /api/release-health` returns JSON `{status:'ok', service:'dana-ai-production-studio'}` with `Cache-Control: no-store`.
- Config A uses `https://ai-sales-platform.vercel.app`.
- Config B uses `https://dana-studio-jet.vercel.app`.
- Both configs use `/api/release`, `/api/release-health`, ref `main`, bounded retry timeout, and root smoke tokens `DANA AI Production Studio` plus `Tailored Voice-over Studio`.
- Workflow matrix emits `release-proof-ai-sales-platform.json` and `release-proof-dana-studio.json`; every matrix leg receives `${{ github.event.workflow_run.head_sha }}` for automatic runs.

- [ ] **Step 1:** Copy the LeadIntel verifier core and CLI without weakening fail-closed verdict semantics or timeout protection.
- [ ] **Step 2:** Add both production configs with `schemaVersion: 1` and `standardVersion: "1.0.0"`.
- [ ] **Step 3:** Implement the two Next.js release routes.
- [ ] **Step 4:** Add agent skill/root policy and ignore `release-proof*.json`.
- [ ] **Step 5:** Add post-CI matrix workflow that checks out the exact completed CI SHA, verifies both targets independently, and uploads both proof files with `if: always()`.
- [ ] **Step 6:** Run focused release tests GREEN, then full `npm test`, `npm run build`, and syntax validation.
- [ ] **Step 7:** Review diff, open PR, require exact PR-head `CCGROUP Release CI` success, then merge with expected-head SHA.
- [ ] **Step 8:** On merged `main`, require exact-main CI success, Vercel production deployments `READY` for the same SHA on both Vercel projects, automatic release workflow success, and independently fetch both `/api/release?verify=<nonce>`, both `/api/release-health`, and both root pages.
- [ ] **Step 9:** Mark each target separately `PROTECTED + PROVEN` only if its proof is `PROVEN`; otherwise record `PROTECTED + NOT YET PROVABLE` and the failed gate.

---

### Task 3: `the-masterminds` — install and prove VERCEL_WEB profile

**Files:**
- Create: `tests/release-integrity-core.test.mjs`
- Create: `tests/release-integrity-cli.test.mjs`
- Create: `tests/release-integrity-policy.test.mjs`
- Create: `scripts/release-integrity-core.mjs`
- Create: `scripts/verify-release-integrity.mjs`
- Create: `release-integrity.config.json`
- Create: `api/release.js`
- Create: `api/release-health.js`
- Create: `.github/workflows/ccgroup-release-ci.yml`
- Create: `.github/workflows/release-integrity.yml`
- Create: `.agents/skills/release-integrity/SKILL.md`
- Create: `AGENTS.md`
- Modify: `.gitignore`

**Interfaces:**
- Required CI workflow: `CCGROUP Release CI`.
- Production URL: `https://masterminds.ccgroup.lv`.
- Service: `the-masterminds`.
- `GET /api/release` exposes exact Vercel Git SHA/ref.
- `GET /api/release-health` returns `{status:'ok',service:'the-masterminds'}` and must not call Anthropic, ElevenLabs, Firecrawl, or any other third party.
- Root smoke requires `The Masterminds` and `200 sharp minds`.

- [ ] **Step 1:** Create isolated feature branch and RED tests/CI requiring the absent package.
- [ ] **Step 2:** Confirm RED from the intended release-integrity absence.
- [ ] **Step 3:** Install core/CLI/config/routes/policies/workflows and `.gitignore` rule.
- [ ] **Step 4:** Run release tests, normal build/lint, and syntax checks GREEN.
- [ ] **Step 5:** PR, exact-head CI, review, merge with expected SHA.
- [ ] **Step 6:** Verify exact-main CI, Vercel READY same SHA, automatic `PROVEN` proof, and fresh live release/health/root checks before `PROTECTED + PROVEN`.

---

### Task 4: `mushroom-app` — install and prove VERCEL_WEB profile

**Files:**
- Create: `release-integrity.test.mjs`
- Create: `scripts/release-integrity-core.mjs`
- Create: `scripts/verify-release-integrity.mjs`
- Create: `release-integrity.config.json`
- Create: `api/release.js`
- Create: `api/release-health.js`
- Create: `.github/workflows/ccgroup-release-ci.yml`
- Create: `.github/workflows/release-integrity.yml`
- Create: `.agents/skills/release-integrity/SKILL.md`
- Create: `AGENTS.md`
- Modify: `.gitignore`
- Modify: `server.js` only to provide local parity for `/api/release` and `/api/release-health` if tests require local-server coverage; do not alter mushroom intelligence behavior.

**Interfaces:**
- Required CI workflow: `CCGROUP Release CI`.
- Production URL: `https://mushroom-app-bay.vercel.app`.
- Service: `mushroom-app`.
- Stable health response: `{status:'ok',service:'mushroom-app'}`.
- Root smoke requires `Sēņu asistents · MycoScout` and `MYCOSCOUT`.

- [ ] **Step 1:** Create isolated branch, RED tests and CI.
- [ ] **Step 2:** Confirm intended RED.
- [ ] **Step 3:** Install package, release/health functions, policy and workflows; preserve existing `vmd-inventory.yml`.
- [ ] **Step 4:** Run `npm test`, focused release tests and syntax checks GREEN.
- [ ] **Step 5:** PR/review/exact-head CI/merge.
- [ ] **Step 6:** Require exact-main CI, Vercel READY same SHA, automatic proof `PROVEN`, and fresh root/release/health checks.

---

### Task 5: `story-engine` — install and prove static VERCEL_WEB profile

**Files:**
- Create: `tests/release-integrity.test.mjs`
- Create: `scripts/release-integrity-core.mjs`
- Create: `scripts/verify-release-integrity.mjs`
- Create: `release-integrity.config.json`
- Create: `api/release.js`
- Create: `api/release-health.js`
- Create: `.github/workflows/ccgroup-release-ci.yml`
- Create: `.github/workflows/release-integrity.yml`
- Create: `.agents/skills/release-integrity/SKILL.md`
- Create: `AGENTS.md`
- Create: `.gitignore`

**Interfaces:**
- Required CI workflow: `CCGROUP Release CI`.
- Production URL: `https://story-engine-roan.vercel.app`.
- Service: `story-engine`.
- Stable health response: `{status:'ok',service:'story-engine'}`.
- Root smoke requires `Story Engine v2 — One Ordinary Day`.

- [ ] **Step 1:** Create isolated branch, RED structural/core tests and CI using Node's built-in test runner.
- [ ] **Step 2:** Confirm intended RED.
- [ ] **Step 3:** Install verifier/config/functions/policies/workflows and ignore proof outputs without changing Story Engine generation behavior.
- [ ] **Step 4:** Run focused tests, `node --check` on all added JS/MJS functions, and deterministic static checks GREEN.
- [ ] **Step 5:** PR/review/exact-head CI/merge.
- [ ] **Step 6:** Require exact-main CI, Vercel READY same SHA, automatic proof `PROVEN`, and fresh root/release/health checks.

---

### Task 6: Wave‑1 audit and standard synchronization

**Files:**
- Modify on LeadIntel standard branch: `docs/superpowers/specs/2026-08-31-ccgroup-app-release-standard-design.md`
- Create on LeadIntel standard branch: `docs/release-integrity-wave-1-status.md`

**Interfaces:**
- Status table records repository, production target, profile, exact production SHA, CI run, deployment ID, release-proof run/artifact, verdict, and unresolved gate if any.
- Multi-target repositories have one row per target.

- [ ] **Step 1:** Re-audit all four repositories against the approved spec and this plan.
- [ ] **Step 2:** Confirm every release-integrity CI path includes verifier/config/workflow/policy/identity-route files so the standard cannot silently rot.
- [ ] **Step 3:** Confirm every production target has a same-SHA proof or an explicit `PROTECTED + NOT YET PROVABLE` gate.
- [ ] **Step 4:** Update the standard design with the discovered multi-target rule and mark the approved status/date without weakening the original contract.
- [ ] **Step 5:** Record Wave‑1 evidence in the status document.
- [ ] **Step 6:** Review and merge the standard documentation branch only after its diff matches actual deployed evidence.

## Self-review

- Spec coverage: VERCEL_WEB identity, CI, exact live SHA, health, smoke, proof, agent rule, no fallback, and per-repository success states are covered.
- Hidden topology: one repository with multiple production deployments is explicitly supported and independently proven per target.
- Health isolation: release proof cannot fail merely because an unrelated third-party AI/data provider is temporarily unavailable.
- Type/interface consistency: every verifier uses the LeadIntel `verifyRelease`/CLI contract; every live identity returns `service`, `commit`, `ref`, `provenance`; every stable health check returns `status`, `service`.
- No placeholders remain. Wave 2 and Wave 3 are intentionally outside this plan and will receive separate plans after Wave 1 evidence is complete.
