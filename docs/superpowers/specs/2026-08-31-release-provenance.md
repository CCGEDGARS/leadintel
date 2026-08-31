# LeadIntel Release Provenance Gate

**Date:** 2026-08-31  
**Status:** Mandatory release verification policy

## Purpose

LeadIntel must never present an old, failed, stale, or unverified build as the current version. A link is labelled **current**, **latest**, **live**, **production**, or **proven** only after the exact deployed artifact is matched back to the exact Git revision and its required health checks.

## Three distinct states

1. **Latest code** — newest intended Git commit. This does not imply it is deployed or safe.
2. **Latest verified preview** — a Vercel preview whose exact commit SHA matches the candidate, Vercel reports `READY`, and CI for that candidate is successful.
3. **Proven production** — the production/custom-domain artifact passes every gate below for the exact production commit.

Never substitute an older production build and describe it as the current version merely because the newest candidate failed CI or deployment.

## Mandatory proven-link algorithm

Before presenting a LeadIntel link as current or proven:

1. **Resolve the candidate revision**
   - Production: resolve the intended `main` revision / merge commit.
   - Preview: resolve the exact branch-head commit SHA.
   - Record the exact commit SHA and branch/ref.

2. **Require CI success for that revision**
   - Required LeadIntel CI workflows must report `success` for the candidate revision or its GitHub pull-request merge check as applicable.
   - A pending, skipped-required, cancelled, stale, or failed result does not pass.

3. **Require Vercel deployment identity and readiness**
   - Find the Vercel deployment whose Git metadata references the exact candidate commit SHA.
   - Require deployment state `READY`.
   - For production, require the deployment to be the production/custom-domain candidate rather than an unrelated preview.

4. **Verify the deployed artifact itself**
   - Fetch `/release.json?verify=<unique timestamp or nonce>` from the exact URL being presented.
   - Use a cache-busting request and no-store semantics where supported.
   - Require `release.json.commit` to equal the exact candidate commit SHA represented by that deployment.
   - Require the expected LeadIntel service/ref metadata.
   - A missing manifest, mismatched SHA, cached stale manifest, or inaccessible artifact does not pass the proven-production gate.

5. **Require backend health**
   - Resolve the configured LeadIntel backend endpoint from the current repository/configuration; do not guess it.
   - Require `/api/health` to return HTTP 200 before declaring the integrated production system proven.

6. **Apply feature-specific release gates**
   - CRM-affecting releases must also satisfy migration and authenticated CRM smoke checks defined by the Master CRM release specification.
   - Discovery/outreach/Gmail-affecting releases must run their applicable regression/smoke path before a complete-production claim.

7. **Record verification evidence**
   - Record verification time, candidate SHA, CI state, Vercel deployment ID/state, artifact SHA, backend-health result, and any required smoke-test result.

8. **Only then present the link**
   - If every required gate passes, label the link `PROVEN PRODUCTION` or `VERIFIED PREVIEW` as appropriate.
   - If any gate fails or cannot be verified, state exactly which gate is unresolved and do not present an older or unrelated link as current.

## Anti-staleness invariant

A URL alone is never proof of freshness. The authoritative identity is the chain:

`Git commit SHA → CI success → Vercel READY deployment for same SHA → live release.json same SHA → backend /api/health 200 → required smoke checks`

Any break in that chain means the build is **not proven current**.

## Required operational behavior

- Never label an old file, deployment, preview, or production URL as current without running this gate.
- Never infer freshness from filename, browser appearance, deployment recency, or a successful historical test.
- Never silently fall back to an older build when the newest build fails.
- Keep preview and production status explicit.
- When a previously fixed bug reappears, first check deployment provenance and browser/state restoration paths before applying another UI-only patch.
