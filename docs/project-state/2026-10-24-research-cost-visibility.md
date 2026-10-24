# Research cost visibility — 24 October 2026

Implemented a read-only workspace research-cost report. This is incomplete financial coverage by design: only an existing authoritative settled-provider receipt contributes money, and unmeasured costs remain unknown. The report never adds invented pricing, provider balances, subscription allowance allocations, synthetic invoices, copied contact results or CRM activity costs to receipt spend.

## Sources and limits

| Source | Reported information | Monetary treatment |
| --- | --- | --- |
| `treg_contact_calls` | Unique call IDs, persisted positive settled micro-USD, unknown receipt count, duplicate count | Confirmed USD receipt subtotal only |
| `audit_events` | Executed AI events and recorded input/output tokens where present; saved direct Firecrawl activity | Usage only; cost and currency remain unknown |
| `additional_contact_policies` and `additional_contact_attempts` | Saved daily/monthly lookup caps, current UTC usage, email and phone permission, per-company cap | Lookup-count controls; no monetary budget exists in this policy |
| `crm_contacts` joined to workspace CRM companies | Distinct currently usable recipients whose `verified_at` is in the selected period, checked with the shared contact confirmation policy | Denominator for recorded Treg receipt spend per newly verified usable Treg contact |
| Apollo/Hunter attempts, reserved credits, snapshots, activities, invoices | Excluded from monetary sums | No authoritative monetary ledger is present for these paths |

Treg's existing writer saves `X-Treg-Original-Cost-Micro` on replay, otherwise `X-Treg-Cost-Micro`; the stored operation is overwritten idempotently with its maximum settled value. Historical missing/invalid headers were normalized to zero, so zero cannot prove that a call was free. This report conservatively leaves zero, missing call IDs, malformed amounts, negative/fractional amounts and conflicting duplicate call-ID amounts unknown. A positive amount without a call ID also remains unknown. No schema migration or paid provider request is introduced.

Call IDs are deduplicated inside the workspace across all recording dates before period filtering. Identical replay copies count once. Conflicting copies contribute no confirmed money. A call is attributed to its earliest local receipt `created_at`; this is a local recording period, not an external provider settlement/billing date. USD is the Treg source currency; costs in other currencies are neither inferred nor converted. The `confirmedSpend` response is currency separated and has no all-currency grand total.

The report's `totalResearchCost` is always `null`, with `coverage: "incomplete"`. No monetary research cap exists in the saved policy, so the monetary budget remains not configured. Daily/monthly count usage follows the shared additional-contact policy and includes processing/reserved and unsuccessful attempts; retryable attempts are excluded. Caps and usage describe the current UTC day/month, clearly labelled separately from the selected receipt period. Missing source tables/columns return explicit unavailable/unknown values. Unexpected database errors fail the request without exposing provider details.

The unit metric is **recorded Treg receipt spend / newly verified, currently usable Treg contacts** in the same selected period. Unsuccessful, profile and phone calls remain in its numerator. Other provider costs remain unmeasured. It is not all-in acquisition cost, historical conversion yield or a claim that calls in the period directly caused every denominator contact. Zero/missing denominators and unknown numerator costs produce an unknown unit cost. Existing provider-confirmed work emails satisfy the shared policy; unconfirmed/personal-domain/shared inboxes, archived contacts, and suppressed/deleted/archived companies do not. Contacts missing `verified_at` cannot silently enter a dated denominator. Contact names, emails, credentials, raw provider payloads and call IDs never appear in the response.

Only known executed AI audit event names are counted; changing/saving a provider connection does not imply it ran. AI audit token values are saved usage counters, with incomplete coverage; they are not priced. Dossier and fallback provider paths do not all create direct Firecrawl audit events, so reported Firecrawl events cannot be presented as complete scrape/credit totals.

## Backend contract and wiring

`backend/src/research-costs.js` exports:

- `handleResearchCostsRoute(request, env, cors = {})`: route handler; returns `null` for unrelated paths.
- `getResearchCosts(db, workspaceId, period, {now})`: internal report builder for authenticated callers/testing.
- `researchCostPeriod(url, now)`: strict UTC calendar-date period validation.

Mount `handleResearchCostsRoute` in the root app router, using its existing CORS headers, and return a non-null response. The handler owns the existing `leadintel_session` hash/expiry check and workspace-membership check before querying financial sources. All read queries bind and restrict the workspace. Any workspace member may read their workspace's report; absent/expired sessions receive 401 and nonmembers receive 403. Only GET is allowed; other methods receive 405. Responses are `Cache-Control: no-store`.

`GET /api/research/costs?workspace_id=WORKSPACE&start=2026-10-01&end=2026-11-01`

`start` and `end` are strict `YYYY-MM-DD` UTC dates; end is exclusive and the maximum interval is 366 days. Omitted dates default to the current UTC calendar month. The response contains `workspaceId`, `period`, `generatedAt`, `coverage`, `totalResearchCost`, `monetaryBudget`, `confirmedSpend[]`, `providers[]`, `limits`, `contacts`, `costPerUsableContact` and explanatory `notes[]`. Monetary values are `amountMicro` / `confirmedAmountMicro`, with explicit currency. Unknown amounts are `null`, not zero. Micro-unit contact averages can be fractional without rounding to a false integer receipt.

## Customer UI contract and wiring

Load `customer/research-costs.css` and `customer/research-costs.js` with the existing asset version policy, then mount in the CRM insights host:

```js
const view = window.LeadIntelResearchCosts.mount(host, {
  request: (path, options) => authenticatedBridgeRequest(path, options),
  getWorkspace: () => window.LeadIntelServerBridge.session?.authenticated ? window.LeadIntelServerBridge.workspace : null,
  getSession: () => window.LeadIntelServerBridge.session
});
```

The injected request function accepts a relative API path and GET options; it may return a parsed payload, Fetch `Response`, or the existing bridge shape `{response, payload}`. It must reuse the existing authenticated bridge rather than introducing a second API origin/session transport. Pass `getSession` to capture the viewer ID and authenticated state, or include `viewerId` in the workspace object. The controller exposes `ready`, `refresh()` and `destroy()`. The UI listens for `leadintel:workspace-changed`, clears old values synchronously, re-reads current workspace and account identity, and ignores stale/reordered/cross-workspace results. Its change revision rejects an old A response after A → B → A switches, and its account scope rejects a same-workspace response after the viewer changes. Unauthenticated scope makes no requests. A CRM re-render that replaces the host must destroy the previous controller and mount its replacement. Explicit refresh/period submission provide retry. All dynamic data uses DOM text content.

The UI labels total research cost unknown, shows source-specific confirmed receipt amounts to six decimal places, separates current saved lookup-count caps from monetary budgets, displays provider coverage gaps and recorded usage, and marks the unit metric as Treg receipt cost rather than an all-in price. It supports UTC period selection, loading, unavailable/retry, empty/unknown, and workspace-switch states. It performs no customer mutations, policy updates or provider calls.

## Verification

`node --test backend/test/research-costs.test.mjs customer/test/research-costs-runtime.test.js`

15 tests pass using real SQLite and jsdom. Tests cover authoritative-only money, duplicate/replay/cross-period deduplication, unknown/invalid/conflicting receipts, currency separation, usage-only AI/Firecrawl records, settings events excluded from execution counts, saved caps/reserved-count use, usable-contact gating, membership/expiry isolation, read-only behavior, schema-unavailable handling, safe projections/errors, six-decimal cost rendering, unknown/empty unit costs, period submission, text-only rendering, workspace/account/A → B → A races, unauthenticated requests, retry and destroy.

These tests establish implementation behavior using controlled local data. They do not establish production deployment status, real provider spend coverage, measured all-in costs or customer contact yield. Root router/CRM asset wiring and exact-SHA release proof are separate integration/release steps.
