# Email campaigns implementation plan

> For agentic workers: use superpowers:executing-plans to implement the existing user-authorized integration.

Goal: One template applied to a selected group, with separate reviewable messages and explicit delivery.
Architecture: Dedicated D1 campaign records; browser UI calls workspace-scoped APIs. Existing template renderers, CRM and delivery engines remain authoritative.
Tech stack: vanilla browser JS, Cloudflare Worker/D1, existing Gmail automation.
Spec: docs/superpowers/specs/2026-10-14-email-campaigns.md

Global constraints: preserve approved templates; no automatic activation; no customer fixtures as runtime defaults; campaign data outside workspace JSON; never send development outreach.
Review focus: workspace switches; stale identity/template changes; duplicate contacts; partial generation/queue failure; user-edited drafts during refresh.

## Task 1: Campaign service
Files: backend/migrations/0034_email_campaigns.sql, backend/src/email-campaigns.js, backend/src/email-campaign-routes.js, backend/src/app.js, backend/test/email-campaigns.test.mjs.
- [x] Write failing SQLite tests for workspace authorization, selected contacts, deduplication, no-send creation, server reload, edit approval invalidation and stale revision.
- [x] Implement service and routes; use canonical renderer and existing queue/send handlers.
- [x] Verify import creates unverified contacts, suppression blocks delivery and partial results are visible.

## Task 2: Campaign interface
Files: customer/email-campaigns.js, customer/email-campaign-ui.js, customer/email-campaigns.css, customer/index.html, customer/process-map.js, customer/test/email-campaigns.test.js.
- [x] Write failing pure/DOM tests for CSV quoting/headers, one-per-company selection, placement below event, controlled navigation, inert message text and workspace races.
- [x] Implement Step 1 selection, Step 6 prepare/review and Step 7 explicit delivery with server persistence.
- [x] Verify edit fields survive failed saves, selection changes invalidate downstream approval and queue uses current server revision.

## Task 3: Review and release
- [x] Run focused tests, complete frontend/backend suites and build.
- [x] Independent review; fix findings and rerun affected tests.
- [x] Publish source through CI, deploy, read exact-SHA release proof and report evidence/limits.
