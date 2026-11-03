# Buyer scheduler continuation and visible progress

The owner reported a company remaining at official Stage 1 with 0s elapsed for more than two minutes after Refresh.

`app.scheduled` invokes `observeScheduledTask('buyer_research', ...)`, but the task was absent from `SCHEDULED_TASKS`. The observer rejected before entering the worker. `Promise.allSettled` isolated that rejection, and the task was also absent from the expected scheduler-health list. The optional 18-second HTTP wake could start work; minute continuation could not run. Earlier browser fixtures called the worker directly after closure and missed this integration boundary. Production release proof and those fixtures did not establish live customer-job continuation.

The regression starts a real saved job and enters actual `app.scheduled`, with migrated SQL, authority checks, task receipts and controlled sources. It failed with unchanged revision before registering the 60-second Buyer task. Browser fixtures now also enter this wrapper. GET restore remains read-only.

Enabling the real caller exposed a resource failure: two source-heavy buyer jobs prepared 1,070 SQL statements in one minute invocation, or 1,190 alongside 120 admitted peer queries. An authenticated HTTP wake with ten identities and unavailable providers prepared 2,656. These are controlled reproductions, not live-customer metrics.

HTTP wake and cron now share the existing invocation budget, including storage accounting. Buyer slices and source tasks reserve query room, preserve authority/time/identity guards and leave finalization headroom. Exhaustion retains the current phase and queued checkpoints; a swallowed individual task error cannot advance an incomplete phase. Tests retained completed evidence/receipts at approximately 499 statements for HTTP and 498/520 for cron, including all 120 peer queries. Temporary Treg time/lease yields retry the same saved reservation and idempotency keys. Revocation and changed identities remain holds.

The local SQLite fixture allowed overlapping BEGIN calls between concurrent asynchronous batches, unlike atomic D1 batches. Its per-database queue now preserves sequencing and rollback independence. Production warnings were not suppressed.

Durable progress lacked a start timestamp, used mismatched phase keys and did not refresh its scoped panel on unchanged revisions. Read-only job views now expose request creation, execution state, saved/active task counts and latest saved activity without task bodies. The panel shows time since request and a stale-activity message. Neither elapsed time nor a spinner is presented as evidence of completed provider work.

Existing jobs are retained for the next authorized scheduler invocation after release. No resets, synthetic contacts, new approvals, budget increases, live paid tests or outreach are part of this fix. Private-workspace job state and live contact yield remain unverified without access; report those separately from actual-entry tests and exact-SHA production proof.
