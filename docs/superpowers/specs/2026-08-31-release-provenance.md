# LeadIntel Release Provenance Gate

**Date:** 2026-08-31  
**Status:** Mandatory release verification policy

## Purpose

LeadIntel must never present an old, failed, stale, or unverified build as the current version. Release status is **fail-closed**: missing, pending, mismatched, failed, inaccessible, or incomplete evidence is not success.

A link is labelled current, latest, live, production, deployed, fixed in production, or proven only after the exact deployed artifact is matched to the exact Git revision and a machine-readable `release-proof.json` records every mandatory gate.

## Fixed release states

1. **LATEST CODE** — newest intended Git commit. This does not imply it is deployed or safe.
2. **VERIFIED PREVIEW** — a preview whose exact commit SHA and applicable checks are proven.
3. **PROVEN PRODUCTION** — the production/custom-domain artifact passes every mandatory gate for the exact production commit.
4. **LAST KNOWN WORKING** — an older production version known to work. It is never substituted for current/latest when a newer candidate is unproven.

## Mandatory proven-link algorithm

Before presenting a LeadIntel link as current or proven:

1. **Resolve the candidate revision**
   - Production: resolve the intended `main` revision / merge commit.
   - Preview: resolve the exact branch-head commit SHA.
   - Record the exact 40-character commit SHA and branch/ref.

2. **Require CI success for that exact revision**
   - Required LeadIntel CI must report `success` for that exact SHA.
   - Pending, skipped-required, cancelled, stale, historical-for-another-SHA, or failed results do not pass.

3. **Check deployment identity/readiness when provider metadata is available**
   - Match deployment metadata to the exact candidate SHA and require provider readiness when that metadata can be queried.
   - LeadIntel currently deploys through Vercel; when Vercel provider evidence is available, it must match the exact candidate SHA and Vercel must report `READY`.
   - Provider readiness is supplemental evidence; it never replaces the authoritative live-artifact verification below.

4. **Verify the deployed artifact itself**
   - Fetch `/release.json?verify=<unique nonce>` from the exact URL being presented.
   - Use cache busting / no-store semantics.
   - Require `release.json.commit` to equal the exact candidate SHA.
   - Require expected service/ref metadata.
   - Missing manifest, mismatched SHA/ref/service, stale cache, or inaccessible artifact fails the gate.

5. **Require backend health**
   - Resolve the configured backend from repository configuration; do not guess it.
   - Require `/api/health` HTTP 200 and the expected service identity.

6. **Apply feature-specific gates**
   - CRM-affecting releases require migration/schema compatibility and authenticated CRM smoke evidence before a complete CRM-production claim.
   - Discovery/outreach/Gmail-affecting releases require their applicable regression/integration smoke evidence.

7. **Generate machine-readable proof**
   - Run `scripts/verify-release-integrity.mjs` using the exact SHA and CI conclusion.
   - Persist `release-proof.json` with expected SHA/ref, CI evidence, live manifest evidence, backend health, every smoke check, verdict, timestamp, and failure reasons.
   - Proof must never contain secrets, tokens, cookies, API keys, authorization values, or sensitive response bodies.

8. **Only then present the link**
   - Only proof verdict `PROVEN` authorizes **PROVEN PRODUCTION** for that exact SHA/environment.
   - If any gate fails or cannot be verified, state the unresolved gate and do not present an older or unrelated link as current.

## Anti-staleness invariant

A URL alone is never proof of freshness. The authoritative chain is:

`exact Git SHA → required CI success for same SHA → live release.json same SHA → backend health → required smoke checks → release-proof.json verdict PROVEN`

Deployment-provider identity/readiness is checked as supplemental evidence whenever authenticated metadata is available.

Any break in the authoritative chain means the build is not proven current.

## Required operational behavior

- Never label an old file, deployment, preview, or production URL as current without the exact-SHA proof gate.
- Never infer freshness from filename, browser appearance, deployment recency, branch name, or a successful historical test.
- Never silently fall back to an older build when the newest intended build fails.
- An older version may be identified only as **LAST KNOWN WORKING**.
- Keep preview and production states explicit.
- When a previously fixed bug reappears, first check release provenance, cache/browser restoration, and state hydration before applying another UI-only patch.
