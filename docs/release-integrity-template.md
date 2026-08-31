# CCGROUP Release Integrity Template

Use this package as the default release-freshness layer for future CCGROUP applications deployed from GitHub to Vercel or a comparable platform.

## Portable package

Copy or adapt these repository components:

1. `release-integrity.config.json` — application-specific production URL, manifest identity, backend health contract, mandatory smoke checks, and bounded retry settings.
2. `scripts/release-integrity-core.mjs` — generic fail-closed verification engine.
3. `scripts/verify-release-integrity.mjs` — CLI that writes `release-proof.json` and exits zero only for `PROVEN`.
4. `.github/workflows/release-integrity.yml` — post-CI production verification and durable proof artifact.
5. `.agents/skills/release-integrity/SKILL.md` — agent rule that controls what may be described as current/proven.

The build must also expose a live release manifest containing the exact source revision, equivalent to LeadIntel's `/release.json`.

## Required invariant

Every future CCGROUP application must preserve this identity chain:

`exact Git SHA -> required CI success for same SHA -> live artifact same SHA -> backend/critical health -> mandatory smoke checks -> release-proof.json -> PROVEN`

An older working release may be labelled **LAST KNOWN WORKING** but must never satisfy or replace proof for a newer SHA.

## Adaptation checklist

- Set `application`, `service`, `productionUrl`, `manifestPath`, and `expectedRef`.
- Define a backend health contract that verifies both HTTP status and service identity.
- Define small deterministic smoke checks for the active production shell and regression-sensitive modules.
- Ensure the normal CI workflow runs when release-integrity sources/config change.
- Trigger release integrity only after the required CI workflow completes for production/main.
- Upload `release-proof.json` even when verification fails.
- Keep the proof free of secrets, tokens, cookies, authorization values, API keys, and sensitive response bodies.
- Require the release-integrity skill for any AI or agent that reports deployment status.

## Status vocabulary

- **LATEST CODE** — source only.
- **VERIFIED PREVIEW** — exact preview proof passed.
- **PROVEN PRODUCTION** — exact production proof passed.
- **LAST KNOWN WORKING** — older working release, explicitly not current.

Do not invent additional optimistic labels that bypass the proof contract.
