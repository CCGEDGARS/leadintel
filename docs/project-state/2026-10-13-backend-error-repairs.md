# Backend error repairs — 13 October 2026

## Reproduced and repaired

- **Research cancellation / request duration:** authenticated Firecrawl forwarding previously had no abort signal or network deadline. A cancelled scrape could enter direct extraction fallback. Forwarding now combines the client signal with a 30-second search deadline or the requested scrape timeout plus 5 seconds (65-second ceiling), preserves cancellation after body parsing, and prevents fallback after cancellation. The direct fallback shares the outer deadline and retains its own 10-second ceiling. Cancellation returns a structured 499; an elapsed deadline returns 504.
- **Website extraction memory bound:** the direct fallback previously checked actual page size only after `response.text()` buffered the entire body. It now counts streamed bytes, stops at the existing 2,000,000-byte bound, and cancels the response reader. Chunked pages without Content-Length are covered by a regression test.
- **Storage visibility during billing outages:** when billing was configured, a live Stripe catalogue failure caused GET storage status to return 503 and hide otherwise valid usage/entitlement information. Status now preserves the authenticated workspace's usage, paid-period capacity and payment state, while disabling temporarily unavailable billing actions and returning a separate availability message. A network outage does not create a payment failure.
- **Provider health query index:** local SQLite EXPLAIN reproduced the audit lookup using only the workspace-created index plus a temporary ordering tree. Idempotent migration `0033_provider_credit_lookup_index.sql` adds `(workspace_id, entity_type, entity_id)`. The same query then uses exact equality keys and implicit rowid ordering without a temporary sort. Regression coverage verifies both the query plan and workspace/provider isolation.

## Existing protections verified

Customer-only provider credential resolution remains fail-closed. An empty workspace never inherits platform Apollo/Firecrawl/Hunter credentials or calls shared Scrapling. Owner opt-in for Hunter verification and Apollo enrichment remains unchanged. Storage checkout remains owner-only; signed webhook events scope capacity to the mapped Stripe customer/workspace, and unverified or unpaid checkout cannot grant capacity. Cancellation and expiry preserve saved documents.

## Verification and limitations

Targeted backend tests: 46 passed, 0 failed, 0 skipped. These use local SQLite, signed webhook fixtures and mocked provider HTTP calls; they did not charge customers, consume paid API credits, send outreach or mutate production data.

The provider health index is a non-destructive schema addition. It does **not** establish that this query caused the reported 734-million daily D1 reads. Production query attribution and before/after metrics remain necessary to diagnose that total.

Storage Plus remains disabled by the checked-in deployment configuration until merchant price/tax/secrets and live billing acceptance are verified. The status outage fix does not enable billing. Exact-SHA release proof and authenticated customer acceptance are separate from local test success.

## Development dependency security follow-up

A complete `npm audit` found four high-severity findings in the development tool chain (Wrangler, Miniflare, Sharp and Undici), while the production-only dependency audit had no findings. The backend's exact Wrangler pin was upgraded from `4.132.0` to the audit-recommended `4.149.0`; its lockfile was regenerated without a broad or forced upgrade. The official registry's Node >=22 requirement matches both backend CI/deploy workflows (Node 22) and the local test runtime (Node 24).

After upgrade, both complete and production-only npm audits report **zero vulnerabilities**. The complete backend suite passed again: **578 tests, zero failures, zero skipped**, including actual Workers/Miniflare D1 and PDF extraction execution. `WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run --outdir /tmp/leadintel-worker-dry-run` compiled the Worker successfully and exited without deploying or applying remote migrations. No production credentials or live provider calls were used for this acceptance.
