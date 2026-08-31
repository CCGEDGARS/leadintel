# CCGROUP Release Integrity System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, fail-closed release verification system that proves the exact Git revision served in production before LeadIntel or any future CCGROUP app can be called latest, live, deployed, or proven.

**Architecture:** A generic Node.js verifier reads repository-owned JSON configuration, validates CI context, fetches the live release manifest with cache busting, verifies backend health and configured smoke checks, and always emits a machine-readable proof record. A post-CI GitHub Actions workflow runs the verifier for the exact `main` SHA after Customer V2 CI completes and uploads the proof as an artifact; repository agent policy and regression tests require the same terminology and fail-closed behavior.

**Tech Stack:** Node.js 22 built-in `fetch`, Node test runner, JSON configuration, GitHub Actions, Vercel static release manifest, Cloudflare Worker health endpoint.

**Spec:** `docs/superpowers/specs/2026-08-31-release-integrity-system-design.md`

## Global Constraints

- Fail closed: unknown, pending, failed, stale, mismatched, skipped-required, inaccessible, or partially verified states are not current/proven.
- Exact Git commit SHA is the primary release identity.
- Live `/release.json` must be fetched from the exact production URL with cache busting.
- No silent fallback to an older deployment.
- `release-proof.json` must contain operational evidence only and no secrets, tokens, cookies, or API keys.
- Existing Customer V2 CI remains the pre-deployment code-quality gate; release integrity is a separate post-CI production gate.
- LeadIntel production URL is `https://leadintel.ccgroup.lv` and the active workspace is `/customer/`.
- LeadIntel backend health endpoint is `https://leadintel-api.edgars-7e7.workers.dev/api/health`.

---

### Task 1: Generic verification core and LeadIntel configuration

**Files:**
- Create: `release-integrity.config.json`
- Create: `scripts/release-integrity-core.mjs`
- Create: `customer/test/release-integrity-core.test.js`

**Interfaces:**
- Produces: `verifyRelease({ config, expectedSha, ciConclusion, ciRunId, environment, fetchImpl, now, nonce }) -> Promise<proof>`.
- Produces: `VERDICTS` constants and helper functions `validateConfig`, `cacheBustedUrl`, `matchesExpectedJson`.
- Proof shape includes `schemaVersion`, `application`, `environment`, `verifiedAt`, `expected`, `ci`, `manifest`, `backend`, `smokeChecks`, `deployment`, `verdict`, and `failures`.

- [ ] **Step 1: Write failing verifier tests**

Create tests using a deterministic mock `fetchImpl` for these cases: CI failure -> `BLOCKED_CI` without network verification; manifest SHA mismatch -> `BLOCKED_STALE_DEPLOYMENT`; missing manifest -> `INCOMPLETE_VERIFICATION`; backend non-200 -> `BLOCKED_BACKEND_HEALTH`; smoke text mismatch -> `BLOCKED_SMOKE_CHECK`; all mandatory gates pass -> `PROVEN`; skipped mandatory gate can never yield `PROVEN`; cache-busted manifest URL contains a unique `verify=` value.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test customer/test/release-integrity-core.test.js`
Expected: FAIL because `scripts/release-integrity-core.mjs` and/or exported verifier functions do not exist.

- [ ] **Step 3: Create LeadIntel config**

Use this contract:

```json
{
  "schemaVersion": 1,
  "application": "LeadIntel",
  "service": "leadintel-customer",
  "productionUrl": "https://leadintel.ccgroup.lv",
  "manifestPath": "/release.json",
  "expectedRef": "main",
  "backendHealth": {
    "url": "https://leadintel-api.edgars-7e7.workers.dev/api/health",
    "status": 200,
    "json": {"status": "ok", "service": "leadintel-api"}
  },
  "smokeChecks": [
    {"id": "customer-shell", "type": "text", "url": "/customer/", "status": 200, "contains": ["LeadIntel — Build Your Commercial Intelligence Strategy", "id=\"company-website\""]},
    {"id": "website-input-normalization", "type": "text", "url": "/customer/website-input-sync.js", "status": 200, "contains": ["toVisibleWebsite", "syncVisibleWebsite", "displayChanged"]},
    {"id": "production-entry", "type": "text", "url": "/", "status": 200, "contains": ["location.replace('/customer/')"], "notContains": ["location.replace('/v2/')"]}
  ],
  "retry": {"attempts": 12, "delayMs": 10000, "timeoutMs": 180000}
}
```

- [ ] **Step 4: Implement minimal generic core**

Rules: validate full 40-char hex SHA; refuse non-success `ciConclusion`; build manifest URL with a cache-busting `verify` query; require manifest service/ref/SHA; require backend expected JSON subset; run every configured smoke check; collect all per-gate evidence; return `PROVEN` only when every mandatory gate passes. Network/tool failures return `INCOMPLETE_VERIFICATION`, never success.

- [ ] **Step 5: Run focused tests GREEN**

Run: `node --test customer/test/release-integrity-core.test.js`
Expected: all tests PASS.

- [ ] **Step 6: Commit Task 1**

Commit message: `feat: add generic release integrity verifier core`

---

### Task 2: CLI proof generator and deterministic exit behavior

**Files:**
- Create: `scripts/verify-release-integrity.mjs`
- Create: `customer/test/release-integrity-cli.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `verifyRelease` from `scripts/release-integrity-core.mjs`.
- CLI args: `--expected-sha`, `--ci-conclusion`, `--ci-run-id`, `--environment`, `--config`, `--proof`.
- Produces: `release-proof.json` by default.
- Exit code `0` only when proof verdict is `PROVEN`; all other verdicts exit non-zero after writing proof.

- [ ] **Step 1: Write failing CLI structure/behavior tests**

Test that the CLI requires explicit expected SHA and CI conclusion, writes a proof path even on blocked verification, defaults environment to production/config to `release-integrity.config.json`, never embeds known secret-key field names, and sets non-zero exit behavior for non-PROVEN verdicts through exported `exitCodeForVerdict(verdict)`.

- [ ] **Step 2: Run focused tests RED**

Run: `node --test customer/test/release-integrity-cli.test.js`
Expected: FAIL because CLI/exported helpers do not exist.

- [ ] **Step 3: Implement CLI**

The CLI loads JSON config, invokes `verifyRelease`, writes formatted JSON plus newline to the requested proof path, prints a compact status line, and sets `process.exitCode = 0` only for `PROVEN`. Add `release-proof.json` to `.gitignore` because CI artifacts are evidence outputs, not source files.

- [ ] **Step 4: Run focused tests GREEN**

Run: `node --test customer/test/release-integrity-cli.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit Task 2**

Commit message: `feat: add release integrity proof CLI`

---

### Task 3: Post-CI production workflow and proof artifact

**Files:**
- Create: `.github/workflows/release-integrity.yml`
- Modify: `customer/test/ci-release.test.js`
- Modify: `customer/test/release-provenance.test.js`

**Interfaces:**
- Trigger: `workflow_run` for workflow name `Customer V2 CI`, type `completed`, branch `main`; plus `workflow_dispatch` for deterministic manual recheck.
- Expected SHA: `${{ github.event.workflow_run.head_sha }}` for automatic runs.
- CI conclusion: `${{ github.event.workflow_run.conclusion }}`.
- Artifact name: `release-proof-${SHA}` containing `release-proof.json`.

- [ ] **Step 1: Add failing structural regression tests**

Require workflow to: run only after Customer V2 CI completion on main; check out exact source SHA; pass exact same SHA and CI conclusion to verifier; use `if: always()` artifact upload; retain proof on verifier failure; never use `github.sha` as a substitute for `workflow_run.head_sha` in the automatic verification command.

- [ ] **Step 2: Run CI/release tests RED**

Run: `node --test customer/test/ci-release.test.js customer/test/release-provenance.test.js`
Expected: FAIL because `release-integrity.yml` is absent.

- [ ] **Step 3: Implement workflow**

Automatic job runs after CI completion, checks out `${{ github.event.workflow_run.head_sha }}`, invokes the CLI with that SHA/conclusion/run ID, and uploads proof even when the verifier exits non-zero. Manual dispatch accepts an explicit `expected_sha` and treats manual CI context as `success` only for re-verification of an already-approved revision; the workflow description must state that manual execution does not replace repository CI evidence.

- [ ] **Step 4: Run CI/release tests GREEN**

Run: `node --test customer/test/ci-release.test.js customer/test/release-provenance.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit Task 3**

Commit message: `ci: enforce post-deployment release integrity proof`

---

### Task 4: Agent policy, documentation, and reusable CCGROUP template contract

**Files:**
- Create: `.agents/skills/release-integrity/SKILL.md`
- Modify: `.agents/skills/release-verification/SKILL.md`
- Modify: `docs/superpowers/specs/2026-08-31-release-provenance.md`
- Create: `docs/release-integrity-template.md`
- Create: `customer/test/release-integrity-policy.test.js`

**Interfaces:**
- Agent status labels are fixed: `LATEST CODE`, `VERIFIED PREVIEW`, `PROVEN PRODUCTION`, `LAST KNOWN WORKING`.
- Any claim using latest/current/live/deployed/fixed-in-production/proven requires exact-SHA proof for the corresponding environment.

- [ ] **Step 1: Write failing policy tests**

Require the new skill to reference `release-proof.json`, exact SHA, fail-closed behavior, no silent fallback, and all four fixed status labels. Require release-verification skill to delegate current/proven claims to the new release-integrity skill. Require reusable template docs to list the four files future apps copy/adapt: config, core/CLI scripts, workflow, skill.

- [ ] **Step 2: Run policy tests RED**

Run: `node --test customer/test/release-integrity-policy.test.js`
Expected: FAIL because the new skill/template do not exist.

- [ ] **Step 3: Implement policy and template docs**

State unequivocally that absence/staleness of proof is not success, an older working production is only `LAST KNOWN WORKING`, and agents must report the unresolved gate rather than issue a false current link.

- [ ] **Step 4: Run policy tests GREEN**

Run: `node --test customer/test/release-integrity-policy.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit Task 4**

Commit message: `docs: enforce fail-closed release status policy`

---

### Task 5: Full regression, review, merge, and live self-proof

**Files:**
- Verify all changed files from Tasks 1–4.
- No production source changes beyond reviewed release-system files unless a regression requires a focused fix.

**Interfaces:**
- Final branch must pass Customer V2 CI.
- After merge, main Customer V2 CI must pass for the exact merge SHA.
- The new Release Integrity workflow must produce a `PROVEN` `release-proof.json` for that same production SHA before the production link is described as proven.

- [ ] **Step 1: Run full repository customer tests**

Run: `node --test customer/test/*.test.js`
Expected: zero failures.

- [ ] **Step 2: Run syntax validation**

Run: `node --check scripts/release-integrity-core.mjs && node --check scripts/verify-release-integrity.mjs`
Expected: exit 0.

- [ ] **Step 3: Review diff against spec**

Check every design success criterion: stale SHA blocks; CI failure blocks before network proof; backend/smoke failures block; proof records every gate; workflow uses exact CI SHA; agent policy forbids old-link substitution; config is reusable.

- [ ] **Step 4: Open PR and require branch CI success**

PR title: `CCGROUP Release Integrity System — LeadIntel implementation`.
Do not merge until exact PR head CI is successful.

- [ ] **Step 5: Merge and verify exact main SHA**

After merge, capture merge SHA, require Customer V2 CI success for that SHA, require Vercel production deployment/live manifest to converge to that SHA, and require the Release Integrity workflow proof artifact to report `PROVEN` for that SHA.

- [ ] **Step 6: Verify live production critical paths independently**

Confirm live `/release.json?verify=<nonce>` exact SHA, `/customer/` HTTP 200, backend `/api/health` 200 with service `leadintel-api`, normalization module present, and production root still routes to `/customer/`.

- [ ] **Step 7: Only then report completion**

Present `https://leadintel.ccgroup.lv/customer/` as **PROVEN PRODUCTION** only if the exact merge SHA has successful CI and a successful machine-readable release proof. Otherwise report the unresolved gate and do not substitute an older build.
