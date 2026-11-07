# LeadIntel rescue baseline — 2026-10-12

## Production baseline (do not overwrite)
- Repository: CCGEDGARS/leadintel; main commit: `452a64100ae82182aaf85a484b5e10990943b96c`.
- Production: https://leadintel.ccgroup.lv/customer/
- Vercel project: `prj_q3nFlZSiQO3IeSsd9vwiLd9Trd0R`; deployment `dpl_C9o83grjG8tSP31gvBPJniRfpFyx` is READY.
- Backend is Cloudflare Worker `leadintel-api`, NOT Neon.
- D1 database binding `DB`, name `leadintel`, id `79f8c0fb-82f9-4ff8-9ab7-38bf5742fc50`; R2 bucket `leadintel-writing-reference`.
- GitHub repository visibility was PUBLIC on inspection. Review potential source and secret exposure before making it private; do not assume secrets were exposed.
- Cloudflare D1 backups, table integrity, OAuth status, and actual Worker logs remain UNVERIFIED.

## Non-destructive rules
1. Do not change production, migrations, credentials, billing, or stored customer data in this rescue branch.
2. Back up D1 using authenticated Cloudflare tooling before any mutation. Check backup export integrity and recovery procedure.
3. Do not treat Vercel READY as functional acceptance.
4. Do not mark Vercel Node 24 DEP0169 deprecation warnings as request failures without response status/body.
5. All fixes need a regression test and deployment verification. Do not alter approved subject lines or base email scripts.
6. All external service charges must remain customer-owned; no platform-paid fallback. Outbound email sends only with explicit authorization.

## Diagnostic sequence and acceptance gates
P0 — Account/workspace persistence:
- Reproduce sign-in, reload, logout/relogin in same verified user and workspace, and switch account; check D1 state versions.
- Identify missing data vs UI hydration/navigation issues.
- Run customer/test/account-workspace-isolation.test.js and related server-bridge/workspace-sync tests.
- Zero cross-account data leaks, silent overwrites or unsaved-data losses.

P0 — Website intake:
- Capture safe redacted API statuses and field hydration with a test company website.
- Validate endpoint/DOM mapping and saved flow navigation.
- Avoid paid API calls until deterministic tests pass.

P0 — Step 6:
- Compare generated scripts with immutable approved templates and exactly required subjects for each category.
- Run `npm run check:step6`; check out-of-order generation and manual edit persistence.
- No messages auto-sent during testing.

P1 — End-to-end demo:
- Authorized test workspace, sample company, decision maker with source quality labels, personalization, approval, save/reload.
- Human-approved sending only when separately authorized and configured.

## Current evidence
- Latest Vercel production commit/deployment verified via project and deployment APIs.
- Production runtime log entries contain repeated `url.parse()` deprecation warnings; no reproduced failing HTTP responses yet.
- Existing regression suites and basic architecture verified by reading package.json, backend/package.json, backend/src/app.js, and account-workspace-isolation tests.

## Exit criteria
- Backup verified; high-priority tests executed with outputs saved.
- P0 failures fixed on branch; reviewable PR; preview acceptance passes.
- Production deploy only after verification, and monitor post-deploy.
