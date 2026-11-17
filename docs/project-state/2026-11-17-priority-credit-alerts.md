# Priority provider credit alerts in Workspace status

## Outcome and cause

The owner requested a red, high-priority Workspace status message when a tool engaged in a process exhausts its credits. The drawer already classified confirmed billing failures as red, but the visible top bar copied only its count and text, leaving its badge yellow. A sync warning was also prepended ahead of credit alerts and replaced their summary. Treg was absent from the credit-alert name registry, did not publish paid-lookup billing failures to shared provider health, and its verified prepaid balance was not classified.

## Implementation

- The visible Workspace status control inherits health severity. Confirmed credit/billing issues show a red control and badge plus a visible Credits label and accessible summary.
- Billing cards appear first, above sync information, with red headings and alert semantics. Ordinary connection, rate-limit, unfinished-task and sync warnings remain yellow.
- The existing provider-health polling and Recheck tools flow retains known alerts if checking fails and removes them on confirmed recovery. Alerts remain scoped to their workspace.
- Treg joins the existing AI/Firecrawl/Apollo/Hunter alert registry. Real Treg billing failures write the existing workspace/provider health ledger. A successful fresh lookup can report recovery; a status-only poll cannot clear billing failure. Unknown balances remain unknown; a verified zero prepaid balance is a billing alert and a positive balance recheck clears it.
- Health reporting checks the current provider connection, remains best effort and preserves the original failure and paid receipts. No approval, spending ceiling, lookup identity or sending behavior changes.

## Verification

New DOM tests load the real attention model, drawer, top bar and styles with controlled status responses. They assert computed red/yellow colors, ordering relative to sync, billing actions, failed-check retention, recovery and workspace isolation. Backend tests exercise persisted Treg failure/recovery through real SQLite and the authenticated service-status route.

Initial new tests failed on the missing top-bar severity, omitted Treg alerts, missing prepaid-balance classification and unrecorded HTTP 402 rechecks. Focused UI validation: 69 passed. Focused backend validation: 149 passed, including paid receipt preservation after authorization revocation. Static build passed. The first broad run exposed a redundant workflow guard in health telemetry; it could mutate paid-cohort continuation. An unchanged checkout passed that case. Replacing the telemetry guard with a connection-identity check restored the case while preserving the original workflow guard. The shared admin stylesheet version was also synchronized after its regression check flagged it. The full frontend run completed 6,386 tests: 6,372 passed, 13 skipped and the one admin stylesheet-version assertion failed before its correction. All 9 admin-page checks passed after the correction. The final focused UI/admin recheck passed all 12 tests. The full backend run completed 2,086 tests: 2,078 passed, 6 failed and 2 timed out. These eight failures were in the parallel browser journeys: timeouts, subsequent stale fixture interception, and a delayed message module. The isolated unchanged-baseline Viscaria/recheck checks passed. The affected journeys are being rechecked serially, matching mandatory CI; deployment requires the exact-SHA CI and release proof, and this note does not treat the parallel browser run as green.

External providers were fixtures; no paid lookup was purchased during testing. This note does not claim production release or authenticated customer acceptance.
