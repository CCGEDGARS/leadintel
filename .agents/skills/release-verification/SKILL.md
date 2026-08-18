---
name: release-verification
description: Run final pre-release and post-deployment verification before declaring work complete, promoting staging, merging major changes, or releasing to production.
---

# Release Verification

Pre-release as applicable: confirm intended branch/commit, understood diff, lockfile install, build, typecheck, lint/static checks, relevant unit/integration/e2e tests, migration safety, secret configuration without exposure, security review, and rollback path.

For user-facing work use `browser-ui-verification` and confirm desktop/mobile, correct interface, critical interactions, console, and network status.

Production promotion requires explicit authorization unless already granted in the current request. State exact target before promotion.

After deployment: open the exact URL, confirm health/readiness, execute critical path, verify expected version/change, and inspect immediate errors when available.
Only say complete/fixed/deployed/working when evidence supports that exact claim. State anything unverified, why, risk, and deterministic next verification action.
