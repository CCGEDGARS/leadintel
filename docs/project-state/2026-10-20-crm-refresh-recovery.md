# Recoverable CRM reads do not become page crashes — 20 October 2026

Authenticated acceptance showed a synchronized, functional workspace with a generic “page component stopped” warning after a CRM list request timed out. The actual `refreshCrmState` startup wrapper left its typed list-request rejection unhandled. The Attention centre correctly retained unexpected rejections, but this expected transport outcome had never been handled by its owning operation.

The CRM refresh boundary now handles only explicitly transient `request_timeout` and `response_body_failed` errors for `/api/crm/companies`. It retains cached companies and local buyer evidence, marks the CRM connection unconfirmed, and exposes one workspace-scoped retryable task. A successful refresh completes that warning. A stale workspace response or retry cannot apply to another workspace. Unknown errors and programming exceptions outside the list-read boundary still reach runtime reporting.

Eight regressions include the actual server-ready callback, interrupted response bodies, cached evidence preservation, workspace/bridge replacement, genuine programming failures, and the visible Workspace status → Review task → Retry path. All 86 affected checks and independent review passed. No backend latency improvement is claimed; this change repairs frontend ownership and recovery of the observed failure.

All 3,193 customer tests, the production build, changed JavaScript syntax, and diff checks passed on the final contents. Exact-SHA release proof and authenticated customer acceptance remain required release gates.
