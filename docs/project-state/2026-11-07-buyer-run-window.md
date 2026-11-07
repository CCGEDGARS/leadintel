# Buyer research lifecycle recovery

Reported symptom: 57 minutes at contact evidence, 0/10 buyer reviews complete, a dossier labelled in progress after a checked stage, and no visible Stop control. This screenshot does not prove whether its production worker was stalled. A proposed production diagnostic was blocked by automatic approval review; no production customer record or metrics were exported.

Confirmed implementation defects: contact progress resets the consecutive-idle counter without an elapsed run window; stage checks inferred success from phase order; dossier activity borrowed any buyer-loading status; Stop depended on an ephemeral Task Centre id; terminal observation errors hid the main progress panel.

Fix: a 30-minute explicit start/resume window, with a checkpoint-preserving needs-review pause in the current phase. Completed source tasks never extend it. Both old and new active rows are covered; paused work cannot be silently recovered. Explicit Resume keeps its job, phase, source receipts, scope and paid intent. Stop is directly bound to the revision-checked durable job. Actual stage evidence, saved-check counts, delay/time-limit state and readable elapsed duration are shown; status transport loss exposes Check saved progress and Stop.

Validation: actual HTTP start/GET/resume and app.scheduled wrapper tests cover expired legacy/current rows, no new provider calls after expiry, no automatic restart, stable identity/source receipts and new resume deadline. Controlled authenticated Chromium verifies start, reopen, overdue display, scheduler pause, same-job Resume, status outage/reconnection, Stop, reload and mobile layout. Providers are controlled fixtures; this is not authenticated acceptance of the reported production LKAB job. Exact release proof is required separately.

No source facts, contact identities, paid permissions or messaging/sending behavior are changed. No database migration is required. Rollback can restore earlier code without transforming saved records; the paused status is an existing state.
