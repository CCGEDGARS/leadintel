# Unified settings and mandatory automatic email verification

## Behavior
Setup uses aligned qualification controls and one Save settings action. The required checked email-verification control cannot be disabled. Saving preferences does not grant sending approval. Qualification changes still invalidate downstream workflow approvals; unchanged values preserve them. Delivery and qualification saves use separate server APIs; errors are surfaced and partial saves are not reported as complete.

Every automatic initial email and follow-up requires both the existing CRM identity/business-email gate and a fresh Hunter mailbox check immediately before sending. Only exact-address valid, non-catch-all, non-blocked results pass. Missing credentials, exhausted credits, pending, unknown, catch-all, invalid, mismatched responses and network errors hold the queue for review. No fallback bypasses verification. Hunter must be connected in the active workspace. Approved workflow activation reports this requirement; its delivery snapshot always includes verifyEmails=true.

The runner claims the queue before the provider check, records a verification audit event, and rechecks owner policy, workflow approval, sequence state, suppression and CRM verification after the provider call. Verification does not imply consent or authorize sending. Held addresses appear in Delivery with owner-only Retry verification, which requeues only matching held active sequences in the authenticated workspace. Existing approval and all scheduling gates remain in force.

## Validation
Customer and backend suites cover unchanged/changed unified qualification saves, settings failure/retry and workspace switching, strict mailbox response acceptance, missing credentials/quota/provider failure, zero Gmail calls on failed verification, deliberate retry and pause during verification, and owner-only scoped retry routing. Existing send idempotency, scheduling, reply, suppression and workflow approval tests use an explicit verifier stub; the production provider helper has separate response tests.

Browser screenshot verification was attempted but the local Chromium executable was unavailable and browser download failed. No authenticated customer-provider or real-send acceptance is claimed. Production is reported only after exact-SHA CI, deployed manifest, backend health, smoke checks and matching assets pass release integrity.
