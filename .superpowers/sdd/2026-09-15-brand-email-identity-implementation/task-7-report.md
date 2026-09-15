# Task 7 — Pre-release infrastructure and import hardening

Status: COMPLETE (not merged or deployed).

Required rebase parent: `c0a101877666952dc87548163fdcb801de8be52f`

## Implemented

- Added an idempotent production R2 gate after `npm ci` and before Worker deployment.
- The gate uses pinned project Wrangler through `npx`, verifies `leadintel-brand-assets`, distinguishes an absent bucket through an authenticated JSON bucket listing, creates only when absent, and performs a final `bucket info` verification.
- Authentication, authorization, malformed JSON, and existing-bucket information failures stop deployment instead of being treated as absence.
- Brand asset website imports now read `customer_workspace_state.payload_json` for the authorized workspace after membership/role validation.
- Only the exact normalized host from a valid `main.website` HTTPS URL is authorized by workspace state. Configured exact import hosts remain supported.
- Client request bodies cannot supply or override the trusted website host.
- Subdomains, parent domains, lookalikes, arbitrary hosts, private IPs, known DNS-to-IP alias services, credentials, non-HTTPS URLs, malformed state, and missing state fail closed.
- Every redirect target is revalidated against the same exact configured/workspace authorization set.
- Workspace state lookup is bound to the requested workspace ID, with cross-workspace regression coverage.

## TDD evidence

Initial focused RED run: 42 tests, 38 passed and 4 failed for the missing workspace-host authorization and R2 deployment gate.

Focused GREEN run before final redirect hardening: 42 passed, 0 failed.

## Verification

- Final focused brand-assets and deployment-contract suite: 43 passed, 0 failed.
- Full backend suite from the reconciled Task 6 security-fixed codebase after all changes: 313 passed, 0 failed.
- `node --check src/brand-assets.js`: passed.
- Pinned Wrangler `4.125.0` exposes `r2 bucket info <bucket> --json`; CLI contract checked locally.
- Task 6 `backend/src/email-content.js`, renderer, and associated security tests were preserved unchanged from `c0a101877666952dc87548163fdcb801de8be52f`.

## Cloudflare permission assumption

The production `CLOUDFLARE_API_TOKEN` must be scoped to the configured account and permit R2 bucket read/list plus bucket creation. If it can verify an existing bucket, no create permission is exercised. If the bucket is absent, create permission is required. Missing or insufficient permission intentionally fails the release before migration/deployment.
