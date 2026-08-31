---
name: release-verification
description: Run final pre-release and post-deployment verification before declaring work complete, promoting staging, merging major changes, or releasing to production.
---

# Release Verification

Pre-release as applicable: confirm intended branch/commit, understood diff, lockfile install, build, typecheck, lint/static checks, relevant unit/integration/e2e tests, migration safety, secret configuration without exposure, security review, and rollback path.

For user-facing work use `browser-ui-verification` and confirm desktop/mobile, correct interface, critical interactions, console, and network status.

Production promotion requires explicit authorization unless already granted in the current request. State exact target before promotion.

After deployment: open the exact URL, confirm health/readiness, execute critical path, verify expected version/change, and inspect immediate errors when available.

For any claim that a build is latest, current, live, deployed, fixed in production, production ready, or proven, invoke `release-integrity` and require a matching `release-proof.json` verdict for the exact SHA/environment. General release verification does not override the fail-closed release-integrity gate.

Only say complete/fixed/deployed/working when evidence supports that exact claim. State anything unverified, why, risk, and deterministic next verification action.
