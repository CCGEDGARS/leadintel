# Selected buyer Recheck isolation — 4 November 2026

Owner requirement: a person's Recheck must not change any other buyer's card, even its informational text or Recheck control. Show green active progress and a terminal result on that person. Explicit Recheck must execute Gmail research again.

## Findings
- The prior UI used company-wide activity to replace nonselected card text and disable their Recheck buttons.
- The server intentionally restored recent completed query receipts. This included successful zero-result Gmail checks, so a new focused Recheck could skip Gmail.
- Selected snapshots could also replace shared role/review context and hydrate CRM data for unrelated people.

## Changes
- Only the selected card enters a busy state. A separately clicked buyer queues a separate scoped job; workspace, identity, and current-context checks apply before dispatch.
- Preserve other person objects, shared role/review context, CRM hydration scope, card positions, and recommendation badges. Company-wide Refresh can rank the shortlist again.
- Selected progress is green, with current saved activity, elapsed time, and an evidence-based estimate when available. Terminal feedback distinguishes completion, incomplete Gmail checks, and cancellation. No guarantee of finding an address.
- Reset only the selected person's Gmail query receipts when creating a new explicit job. Earlier receipts remain in the prior durable job. Execute the three business-context Gmail queries early, and diversify through the existing configured search adapter. Resuming the same job reuses its completed tasks.
- Source-backed Gmail matches and generated patterns remain separate and unconfirmed. They do not enable email Proceed. Recheck is free-only.

## Evidence and limits
Controlled regression coverage compares nonselected card markup before/during/after Recheck; verifies queued person IDs, unchanged shared review context, fresh three-query Gmail execution, original receipt retention, and actual task progress labels. Existing Buyers suites cover scheduler entry, continuation, evidence, identity, and save/reload guards.
Production release proof and authenticated customer research yield remain separate gates. No paid lookup or outbound contact is part of this verification.
