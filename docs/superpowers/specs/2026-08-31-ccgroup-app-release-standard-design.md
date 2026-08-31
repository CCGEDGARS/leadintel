# CCGROUP App Release Standard — Design

**Date:** 2026-08-31
**Status:** Proposed for rollout
**Canonical reference implementation:** LeadIntel

## Purpose

Create one permanent release-integrity standard for CCGROUP applications so no agent, developer, or deployment workflow can present an old, stale, failed, mismatched, or unverified build as the current production version.

The standard extends the proven LeadIntel chain:

`exact Git SHA -> required CI success for same SHA -> deployment identity -> live artifact same SHA -> health -> mandatory smoke checks -> release-proof.json -> PROVEN`

Only proof verdict `PROVEN` authorizes the label **PROVEN PRODUCTION**.

## Current repository landscape

The authenticated GitHub account currently exposes these active repositories:

1. `CCGEDGARS/leadintel` — Vercel, reference implementation already installed.
2. `CCGEDGARS/ai-sales-platform` — Vercel-linked application; also backs the Dana Studio Vercel project.
3. `CCGEDGARS/the-masterminds` — Vercel-linked application.
4. `CCGEDGARS/mushroom-app` — Vercel-linked application.
5. `CCGEDGARS/story-engine` — Vercel-linked application.
6. `CCGEDGARS/einsteins-ai-trainer` — deployable web application; a Vercel project exists but current Vercel metadata is not Git-linked.
7. `CCGEDGARS/promptforge` — Vite/Vercel-capable web application; a Vercel project exists but current Vercel metadata is not Git-linked.
8. `CCGEDGARS/roaring-figolla-ff0d8b` — Netlify application.
9. `CCGEDGARS/flightintel-scrapling` — Docker/service repository rather than a conventional Vercel web app.

No repository is allowed to claim **PROVEN PRODUCTION** until its actual deployment target is identified and the relevant profile below is fully configured.

## Architecture decision

### Chosen approach: versioned local release-integrity package per repository

Each repository receives a small standard package copied from the canonical LeadIntel implementation and adapted only through configuration and a deployment-profile adapter.

This is preferred now over a cross-repository reusable GitHub workflow because it has no dependency on repository-sharing permissions, private-workflow access settings, or a separate central repository. Every app remains independently verifiable even if another repository is unavailable.

The package is versioned with `standardVersion` so later we can migrate all apps to a shared reusable workflow/action without changing the proof contract.

## Mandatory repository package

Every application repository must contain:

- `release-integrity.config.json`
- `scripts/release-integrity-core.mjs`
- `scripts/verify-release-integrity.mjs`
- `.github/workflows/release-integrity.yml` or platform-equivalent CI automation
- `.agents/skills/release-integrity/SKILL.md`
- root `AGENTS.md` release-status rule, merged with existing agent instructions when present
- regression tests for the verifier and workflow contract
- generated live release identity endpoint/file where the deployment profile supports it
- `.gitignore` rule excluding local `release-proof.json`

The proof artifact must never contain secrets, cookies, tokens, authorization headers, API keys, or sensitive response bodies.

## Deployment profiles

### Profile A — VERCEL_WEB

Used for LeadIntel, AI Sales Platform / Dana Studio, The Masterminds, Mushroom App, Story Engine, Einstein AI Trainer when re-linked, and PromptForge when re-linked.

Required gates:

1. exact Git SHA
2. required app CI success for that SHA
3. Vercel deployment metadata reports `READY` and the same Git SHA where metadata is accessible
4. live `release.json` returns the same SHA, expected ref, and service identity
5. critical page/API health checks
6. deterministic smoke checks for the app's most important user path and known regression-sensitive features
7. `release-proof.json` verdict `PROVEN`

### Profile B — NETLIFY_WEB

Used for `roaring-figolla-ff0d8b`.

The proof contract is identical to VERCEL_WEB, but deployment-provider evidence is Netlify deployment identity/state rather than Vercel. If provider metadata cannot be queried automatically, the live exact-SHA manifest remains mandatory and provider evidence is recorded as unavailable rather than silently assumed.

### Profile C — SERVICE_BACKEND

Used for `flightintel-scrapling` and future APIs, workers, scrapers, Docker services, or scheduled services without a conventional web UI.

Required gates:

1. exact Git SHA
2. required CI success for that SHA
3. deployed service exposes immutable version identity, preferably `/version` or `/release.json`, containing the exact SHA
4. health/readiness probe passes
5. one or more service-specific functional smoke checks pass
6. `release-proof.json` verdict `PROVEN`

If no deployed service target exists, only **LATEST CODE** or a verified local/CI build may be reported; **PROVEN PRODUCTION** is forbidden.

## Fixed status vocabulary

All repositories and agents use only these release-state labels:

- **LATEST CODE** — newest intended source revision; deployment not proven.
- **VERIFIED PREVIEW** — exact preview revision passed applicable preview gates.
- **PROVEN PRODUCTION** — exact production revision passed all mandatory gates.
- **LAST KNOWN WORKING** — older verified production revision, explicitly not current.

No optimistic synonyms may bypass the proof contract.

## Installation algorithm

For each repository:

1. Inventory current framework, CI, deployment provider, production domain, backend/API dependencies, and existing agent instructions.
2. Select the deployment profile.
3. Create a feature branch from current `main`.
4. Add regression tests first and confirm RED where the integrity package is absent.
5. Install/adapt the verifier package.
6. Generate or expose the exact-SHA live release identity.
7. Add app-specific health and smoke checks.
8. Make normal CI run when release-integrity surfaces change.
9. Add post-CI production proof workflow.
10. Merge only after exact-head CI is green.
11. On `main`, require normal CI, deployment readiness, exact live SHA, health, smoke checks, and a successful proof workflow.
12. Only then label the production URL **PROVEN PRODUCTION**.

A failed rollout never falls back to an older URL under the label current/latest. The older URL may only be stated as **LAST KNOWN WORKING**.

## Rollout order

### Wave 1 — GitHub-linked Vercel production apps

1. `ai-sales-platform`
2. `the-masterminds`
3. `mushroom-app`
4. `story-engine`

These have the clearest provider identity chain and therefore provide the safest first rollout.

### Wave 2 — deployable apps needing deployment-link reconciliation

5. `einsteins-ai-trainer`
6. `promptforge`

Repository safeguards may be installed immediately, but production cannot be called proven until the real production deployment/domain is reconciled with the Git repository and exact-SHA identity.

### Wave 3 — alternative runtime profiles

7. `roaring-figolla-ff0d8b` using NETLIFY_WEB
8. `flightintel-scrapling` using SERVICE_BACKEND

### Reference implementation

`leadintel` remains the reference implementation and regression benchmark. Changes to the shared standard must not weaken LeadIntel's existing fail-closed behavior.

## Future-app default

Any newly created CCGROUP application is considered incomplete until a release-integrity profile is selected and installed. This is part of project bootstrap, not optional post-launch cleanup.

For future agents and Codex sessions, the governing rule is:

> Never present a production link as current, latest, live, fixed, deployed, or proven unless the exact intended source revision has a successful machine-verifiable release proof for that environment.

## Testing standard

Every installation must include tests proving at minimum:

- CI failure blocks all network verification.
- wrong/missing live SHA cannot become PROVEN.
- health failure blocks proof.
- mandatory smoke failure blocks proof.
- skipped mandatory gates cannot become PROVEN.
- network requests are bounded by timeout.
- failed verification still produces a proof artifact where CI/platform permits.
- the app-specific normal CI includes release-integrity files in its trigger/path coverage.
- all success cases require the same exact Git SHA end to end.

## Success criteria

The rollout is complete only when every in-scope repository has one of two explicit states:

1. **PROTECTED + PROVEN** — the integrity package is installed and a real production release has passed it; or
2. **PROTECTED + NOT YET PROVABLE** — repository safeguards are installed, but an unresolved production target/provider/link prevents a valid production proof. The unresolved gate must be named explicitly.

There is no silent third state.