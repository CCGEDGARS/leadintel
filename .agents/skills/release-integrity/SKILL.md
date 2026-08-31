---
name: release-integrity
description: Enforce exact-SHA, fail-closed release status before calling any CCGROUP application latest, current, live, deployed, fixed in production, or proven.
---

# Release Integrity

Use this skill whenever a response or development workflow is about release freshness, deployment status, production links, or whether a fix is actually live.

## Fixed status vocabulary

Use only these status labels when release state matters:

- **LATEST CODE** — newest intended source revision. It may be untested or undeployed.
- **VERIFIED PREVIEW** — preview artifact proven for its exact SHA with applicable checks.
- **PROVEN PRODUCTION** — production/custom-domain artifact proven for its exact SHA with every mandatory gate satisfied.
- **LAST KNOWN WORKING** — older production known to work. This label must never be substituted for latest/current production.

## Fail-closed rule

Release status is fail-closed. Missing evidence, stale evidence, pending CI, failed CI, SHA mismatch, inaccessible production, failed health, skipped mandatory smoke checks, or unavailable verification is not success.

Never silently fall back to an older deployment or file and call it current. If the newest intended revision is not proven, report the unresolved gate explicitly.

## Required proof chain

Before using words such as latest, current, live, deployed, fixed in production, production ready, or proven for a production link:

1. Resolve the exact intended 40-character Git SHA.
2. Require the required CI run for that exact SHA to have conclusion `success`.
3. Read or generate `release-proof.json` for that exact SHA and environment.
4. Require live `release.json` evidence in the proof to report the same exact SHA and expected ref/service.
5. Require backend health and every configured mandatory smoke check to pass.
6. Require proof verdict `PROVEN`.

If `release-proof.json` is missing, belongs to another SHA/environment, is stale, or has any non-PROVEN verdict, do not issue a current/proven link. State the unresolved gate and, when useful, identify any **LAST KNOWN WORKING** version separately.

## Proof interpretation

A valid production proof must identify at least:

- application and environment;
- verification timestamp;
- expected SHA/ref;
- CI run ID, conclusion, and pass state;
- live manifest URL/status/SHA/ref/service;
- backend health result;
- every smoke-check result;
- overall verdict and failure reasons.

Never copy secrets, tokens, cookies, authorization values, API keys, or private response bodies into proof records or user-facing status reports.

## LeadIntel

LeadIntel uses `release-integrity.config.json`, `scripts/release-integrity-core.mjs`, `scripts/verify-release-integrity.mjs`, and `.github/workflows/release-integrity.yml`. The canonical production link may be labelled **PROVEN PRODUCTION** only after the machine-readable proof for the exact `main` SHA returns `PROVEN`.
