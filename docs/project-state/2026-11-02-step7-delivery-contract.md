# Step 7 Delivery recovery contract — 2 November 2026

## Outcome and authority

An authenticated owner can review the exact approved recipient, subject and rich/plain message, choose a connected mailbox or explicitly record an external send, recover an interrupted CRM write without sending twice, and record the correct sent recipient's replies and real outcomes. Reload preserves acknowledged history. Approval, saving, delivery activation, provider acceptance and inbox delivery remain separate facts.

The approved Outreach package and canonical Profile/Strategy binding own send eligibility. Backend provider reservations and acceptance receipts own API delivery. CRM activity acknowledgements own recorded history; broad workspace persistence is a recoverable projection. Manual records are self-reported facts, never provider acceptance or permission to send. Historical records remain usable after a new approval or upstream edit. No test sends real outreach, changes paid research permissions or activates customer automation.

## Starting evidence

- Main at inspection: `a84457e896d40fcb1b4b0aba0fd7d5afe397ef12`.
- Existing provider/queue protections and the 31 October audit remain mandatory; no wholesale orchestration rewrite is justified.
- Delivery offers recipient selection and send controls without showing the approved subject/body. A selected-recipient preview is required before the action.
- Confirmed controlled backend reproduction: automatic provider acceptance followed by CRM outage remains terminal `sent`; a later worker pass never repairs CRM, despite retaining the receipt. Repair must use existing immutable receipt authority and never transport again.
- Mailbox defaults cannot distinguish loading from confirmed unconfigured state. Async context/sync recovery must not leave unusable controls or apply a previous account's response.
- Manual reply/outcome persistence and concurrent UI writes require controlled failure and fresh-browser acceptance, not source inspection alone.
- The authenticated browser run reproduced duplicate CRM `email.sent` activities for one provider submission. The UI had invented an unscoped event ID while the backend had already written the canonical event. Accepted responses now carry the canonical ID; retries reuse it.
- Reply acknowledgement erased text typed while waiting. Busy guards and compare-before-clear preserve the next working reply. Failed writes retain stable, account-bound pending operations rather than requiring a second observation.
- A history read could recreate a deleted CRM company from stale local pipeline data. History now uses read-only lookup, retains local history and reports the missing company. A stale history response also releases controls and reads the newly selected company.
- The rich-text editor allowlist removed approved branding from the Delivery preview. Branded email now uses the same isolated sandboxed preview pattern as Messages; plain-text Gmail Compose is explicitly distinguished.
- A fresh authenticated browser could manually record an unresolved API send because its original warning lived only in session storage. A controlled actual-route reproduction retained `gmail_messages.status='sending'` while creating a false manual `email.sent`. Manual recording now checks durable server holds and commits its local Sent projection only after CRM acknowledgement; the CRM write also requires a transaction-time hold check. The check and recording perform no transport.
- Recovery's old bounded scan could repeatedly select the same held rows and starve a later recoverable receipt. A monotonic persisted check-order cursor rotates the bounded scan, keeps one cursor row per queue and never changes delivery status or attempt counts. A regression places more than one scan limit of held rows ahead of a valid acceptance.

## Preservation and recovery

Pending observations retain their original activity ID, workspace/user, exact recipient/history snapshot and target stage. Explicit retry reuses these IDs and never invokes a mailbox send. Failed or stale operations retain their observations. A pending external-send observation blocks another send while CRM confirmation is outstanding. Its absence from the Sent projection is intentional: a failed or reconciliation-blocked write is not an acknowledged record.

CRM `delivery_record` metadata is a versioned history projection, never approval or sending permission. It restores missing acknowledged history after a lost broad workspace save, merges independent replies and preserves conflicting local original recipient/content. Reads retain older local records and use bounded pagination. Provider times and IDs come from actual acceptance receipts; `reviewed_approved_at` is an inert historical label bound into request idempotency. Missing snapshots on original owned canonical/legacy receipts may be backfilled without replacing their existing evidence.

## Acceptance

1. Actual Messages approval and exact buyer/source bindings reach Delivery, including plain/rich text; a different buyer or account never inherits them.
2. Mailbox loading, failure, retry, disconnected and connected states are explicit. Duplicate submission and unresolved provider holds remain protected.
3. Manual confirmation identifies the exact recipient and message; Cancel writes nothing. Provider receipt recording does not ask the user to claim a manual send.
4. Local replies/outcomes survive failed CRM writes with a visible bounded retry. Retries reuse the same activity identity, do not duplicate observations, regress a stage, or contact anyone. Typing during a delayed acknowledgement is preserved.
5. Acknowledged delivery history can recover from CRM if a subsequent broad workspace save was lost; it never grants approval or clears an unknown-send hold.
6. Backend accepted-send recovery repairs CRM only under retained owned authority and does not call transport again. Revoked/foreign/mismatched authority remains held.
7. Real authenticated Chromium plus production routes and all-migration SQLite exercise desktop/narrow, exact preview, failures, reload and recipient isolation. Deterministic mailbox responses are substituted only at the provider HTTP boundary.
8. Relevant/full CI, build and exact-SHA release proof pass before production completion is claimed.

## Constraints and release

Preserve all protected masters, manual drafts, approvals, historical receipts and workspace/user isolation. Add no dependencies, credentials, schema migration or automatic sending permission. Bound reads/retries, retain failed operations rather than silently dropping them, and preserve unknown outcomes. Rollback is the prior proven source revision; retained CRM observations and provider receipts are not deleted on rollback. Production customer/mailbox and real inbox acceptance remain unavailable without the customer's authenticated context and separate exact-recipient send authorization. Controlled acceptance and release proof do not close those gates.

## Evidence obtained before release

The real Chromium harness uses the shipping UI, hashed session authentication, production routes, all-migration SQLite and encrypted synthetic mailbox credentials. Only the provider HTTP boundary is controlled. Six fresh contexts and 1440/390/320 pixel views exercise exact plain/rich message content, mailbox loading/error/retry, provider acceptance followed by a SQL CRM outage, idempotent retry, reply-save failure with preserved new input, acknowledged outcome recovery after aborted workspace PUT, manual Cancel/Escape/confirmation, unknown holds and buyer/workspace isolation. It writes screenshots, execution receipts and source SHA256 hashes and rejects source changes during a run. No real recipient, paid enrichment or customer automation is used.

The completed full customer run passed 5,319/5,319 tests, zero skips; 251 focused checks cover the final guard/UI changes. The full backend run passed 1,713/1,713 tests with mandatory browser mode and zero skips. Final stable-source Step 7 acceptance passed 2/2, including manual confirmation first after an unknown send in a fresh browser. Build and whitespace checks passed. CI and exact production proof remain independent completion gates and must be observed for the published revision.
