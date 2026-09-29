# Delivery setup and current release state

The workspace owner can save an automatic daily email limit under Setup → Brand & Email Identity. Presets are 5, 10, and 20; Custom accepts 1–500. New workspaces default to 5. The backend enforces the same 1–500 range for workspace and mailbox limits. The detailed Manual/Automatic mode, working days, timezone, send window, follow-ups, pause, and emergency stop remain in Delivery.

Production keeps `AUTOMATIC_GMAIL_DELIVERY_MODE=manual_only`. Saving the limit cannot send any email; manual Gmail delivery requires an explicit action. Do not change this switch until the production Gmail sender, approved package handoff, queue, reply stop, idempotency, suppression, and monitoring have passed an end-to-end pilot. Changing the feature switch is a separate release action.

A workspace currently has one Gmail connection. The mailbox and workspace counts are consequently the same, and the send window plus minimum delay may keep actual throughput below a high custom ceiling. Supporting multiple mailboxes and a larger organization requires connection routing, separate mailbox counters, reply ownership, and sender reputation controls. The current custom ceiling does not imply multi-mailbox support or guaranteed throughput.

Activity visible now: confirmed sends today, queue size, next eligible send, and blocked-by-limit count. The runner stores Gmail message/thread IDs and reply outcomes. Open rate and full delivery/bounce analytics are not implemented; they must not be presented as verified measurements.
