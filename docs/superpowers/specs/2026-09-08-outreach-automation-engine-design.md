# LeadIntel Outreach Automation Engine Design

## Goal
Extend the existing human-approved Gmail outreach flow into a safe, workspace-controlled automation engine that can operate in Manual or Automatic mode while enforcing daily send limits, sending windows, follow-up policy, reply-stop behavior and mailbox-level safety controls on the backend.

## Existing foundations
LeadIntel already provides:
- evidence-backed outreach drafts;
- editable outreach packages;
- explicit outreach approval;
- Gmail OAuth connection;
- real Gmail API sending;
- send idempotency protection;
- CRM transition to `Contacted` after confirmed send;
- Gmail reply retrieval and classification;
- pipeline updates based on replies.

The current production Gmail flow is explicitly human-approved and user-triggered. This design preserves that path and adds an opt-in automatic path around it.

## Scope
This subsystem adds:
1. Workspace outreach operating mode: `manual` or `automatic`.
2. Workspace-level automation policy persisted server-side.
3. Backend-enforced daily send limit.
4. Per-mailbox daily send limit.
5. Working-day controls.
6. Sending window and timezone.
7. Configurable minimum/randomized delay between sends.
8. Follow-up schedule with configurable maximum follow-ups.
9. Automatic cancellation of pending follow-ups after any qualifying inbound reply.
10. Pause/resume control and emergency stop-all-sending control.
11. Queue visibility and send-usage status in the customer workspace.
12. Automatic reply polling/synchronization for messages that belong to automated sequences.
13. Auditability for policy changes, queue decisions, sends, skips, reply stops and failures.

Calendly/Zoom booking is intentionally outside this subsystem and will follow as a separate integration layer after the outreach automation engine is production-proven.

## Operating modes
### Manual mode
Manual remains the permanent default.

Flow:
1. LeadIntel builds or updates an outreach package.
2. User reviews/edits the message.
3. User explicitly approves the package.
4. User explicitly triggers Gmail send.
5. Existing confirmation/idempotency/CRM behavior remains intact.

Manual mode must not be affected by the automatic scheduler except that the same global suppression and safety rules still apply.

### Automatic mode
Automatic mode is explicit opt-in and cannot activate silently.

Only outreach packages that satisfy all of the following may enter the automatic queue:
- package is explicitly approved;
- target has a valid recipient email;
- target company is not suppressed;
- no previous reply-stop state exists for the sequence;
- workspace automatic mode is enabled;
- workspace is not paused;
- global emergency stop is not active;
- daily/workspace/mailbox limits allow another send;
- current time is inside an allowed sending window;
- current weekday is enabled;
- minimum/randomized delay rule is satisfied.

## Automation policy model
Persist one policy record per workspace with at least:
- `mode`: `manual | automatic`
- `enabled`: boolean
- `paused`: boolean
- `emergency_stop`: boolean
- `workspace_daily_limit`: integer
- `mailbox_daily_limit`: integer
- `working_days`: array of weekday integers or canonical weekday strings
- `timezone`: IANA timezone string
- `send_window_start`: local `HH:MM`
- `send_window_end`: local `HH:MM`
- `min_delay_minutes`: integer
- `max_delay_minutes`: integer, greater than or equal to min delay
- `max_followups`: integer
- `followup_delays_days`: ordered integer array
- `reply_poll_interval_minutes`: integer
- `updated_at`
- `updated_by`

Defaults:
- mode `manual`
- enabled `false`
- paused `false`
- emergency stop `false`
- workspace daily limit `20`
- mailbox daily limit `20`
- working days Monday-Friday
- timezone inherited from workspace/user when available, otherwise `Europe/Riga` for the current reference workspace
- send window `09:00` to `16:30`
- min delay `8` minutes
- max delay `18` minutes
- max followups `2`
- follow-up delays `[3,7]`
- reply polling interval `60` minutes

UI may offer presets such as 10/20/30/50 emails per day plus a custom value, but the backend stores and enforces the final integer.

## Queue model
Create durable queue records for outbound automated sequence steps.

Each queue item stores at least:
- workspace id
- source outreach package id/domain/contact identity
- Gmail connection/mailbox identity
- sequence id
- step index (`0` for first touch, `1+` for follow-ups)
- recipient email
- subject/body snapshot approved for that step
- status: `queued | waiting_window | sending | sent | cancelled_reply | cancelled_pause | blocked_limit | failed | skipped`
- earliest send time
- scheduled send time
- attempt count
- last error code/message
- Gmail message/thread ids when sent
- created/updated timestamps

Queue item content is snapshotted from the approved package/sequence at enqueue time so later UI edits cannot silently change a message already authorized for automatic delivery. Any change that should alter queued content requires explicit re-approval/requeue.

## Backend enforcement
All automatic sends must pass a single server-side eligibility check immediately before Gmail API execution.

The check must enforce:
- workspace membership/authorization;
- policy mode/enabled state;
- pause/emergency stop;
- company suppression;
- recipient validity;
- sequence reply-stop state;
- workspace daily sent count;
- mailbox daily sent count;
- working day;
- timezone-local send window;
- per-sequence spacing/randomization;
- duplicate/idempotency protection.

Frontend state is informative only and must never be trusted for send-limit enforcement.

## Daily counters and limits
Daily usage is calculated from confirmed sent Gmail records, not queue attempts.

The system must expose:
- workspace sent today / workspace limit;
- mailbox sent today / mailbox limit;
- queued count;
- blocked-by-limit count;
- next eligible send time.

Cross-midnight behavior is evaluated in the configured automation timezone.

## Delay and randomization
For automatic sends, calculate the next eligible time using a bounded random delay between `min_delay_minutes` and `max_delay_minutes`.

Requirements:
- max delay must be >= min delay;
- no send occurs before the prior automatic send plus selected delay;
- delay cannot override send-window restrictions;
- if delay pushes a send outside the allowed window, move to the next enabled sending window.

Deterministic tests must inject/fake the random source and clock.

## Follow-ups
Automatic mode may create follow-up steps only when:
- initial send was confirmed as sent;
- no qualifying reply has been received;
- sequence is not suppressed/cancelled;
- configured follow-up count permits another step.

Follow-up delays are measured in enabled business days in the policy timezone.

The follow-up message source is the approved outreach package's follow-up draft for the current milestone. If multiple follow-up variants are later introduced, that is a future extension.

## Reply-stop behavior
Any inbound reply associated with the Gmail thread stops all future automated follow-ups for that sequence, regardless of reply category.

On reply detection:
1. Store normalized reply and category using the existing classifier.
2. Update CRM/pipeline using existing delivery behavior.
3. Mark all pending queue items for that sequence `cancelled_reply`.
4. Persist a sequence-level stop flag.
5. Audit the stop reason and affected queue item ids.

Unsubscribe replies additionally preserve/trigger suppression behavior where existing CRM policy supports it; automation must never send again to a suppressed company/contact.

## Automatic reply monitoring
The system needs a scheduled backend process that checks Gmail threads for active automated sequences at a safe cadence.

Requirements:
- reuse existing Gmail OAuth connection and thread retrieval logic;
- poll only active sequences with a sent message and no stop/completion state;
- deduplicate inbound messages using Gmail message ids;
- classify replies with the existing classifier;
- never process the same inbound Gmail message twice;
- stop pending follow-ups immediately after a newly detected reply;
- record failures without disabling unrelated sequences.

The minimum supported scheduler frequency should match platform capabilities; if the deployment platform supports hourly cron, use hourly polling for the first production version.

## Pause and emergency stop
### Pause
Pause prevents new automatic sends but preserves queue state. Resuming recalculates eligibility/scheduled times.

### Emergency stop
Emergency stop prevents all new automatic sends immediately. It remains active until explicitly cleared by an authorized workspace user. Existing sent messages are not recalled.

Both controls are server-side and audited.

## UI
Add an `Outreach Automation` panel in the delivery/outreach area showing:
- mode selector: Manual / Automatic;
- explicit activation confirmation for Automatic mode;
- daily limit presets and custom limit;
- per-mailbox limit;
- working days;
- timezone;
- sending window;
- delay range;
- max follow-ups;
- follow-up delays;
- pause/resume;
- emergency stop;
- status summary: sent today, limit, queue size, next send;
- queue preview with company/contact/step/status/scheduled time;
- reason text for blocked/skipped items.

Automatic mode must display clear copy that approved contacts may be emailed without an additional per-message confirmation while automation is active.

## Authorization
- Workspace owner can enable/disable Automatic mode, change limits, configure mailbox rules, pause/resume and clear emergency stop.
- Workspace sales users may view status and queue; sending permissions should continue to follow existing Gmail route roles.
- If owner-only policy is more restrictive than current role architecture, prefer owner-only for automation policy mutation in the first version.

## Failure handling
- One failed queue item must not block unrelated queue items.
- Transient Gmail/network failures may retry with bounded attempts and backoff.
- Validation/policy/suppression failures are non-retryable until state changes.
- Unknown/unsafe state defaults to no-send.
- Any scheduler failure is recorded and visible in audit/queue status.

## Security and safety
- Gmail refresh tokens remain encrypted server-side using the existing mechanism.
- No automatic send decision depends solely on browser/localStorage state.
- All policy mutations and automatic sends require authenticated workspace context.
- Idempotency remains mandatory for Gmail send execution.
- Suppression always wins over campaign state.
- Manual mode is fail-safe default.
- Emergency stop is fail-closed.

## Data and migration
Add backend persistence for:
- workspace automation policy;
- automation sequences;
- automation queue items;
- processed inbound Gmail message ids / reply dedupe state if not already safely represented elsewhere.

Migration must be additive and preserve all existing Gmail, CRM, enrichment and market-monitoring data.

## Testing
Required automated coverage:
- default policy is Manual/off;
- automatic activation requires explicit policy mutation by authorized user;
- backend rejects send over workspace daily limit;
- backend rejects send over mailbox daily limit;
- disabled weekday blocks send;
- outside-window blocks/reschedules send;
- timezone boundary correctness;
- min/max delay enforcement with deterministic random source;
- queue sends only approved package snapshots;
- no send to suppressed company;
- reply cancels all pending follow-ups;
- reply dedupe is idempotent;
- follow-up count/delay behavior;
- pause blocks sends and resume recovers queue;
- emergency stop blocks sends immediately;
- one failed queue item does not halt others;
- manual Gmail send still works exactly as before;
- existing Gmail idempotency and CRM contacted behavior remain green.

## Release and verification
Implementation must follow TDD, preserve existing CI, and only be considered production-current after:
1. feature tests pass locally;
2. full customer/backend suites pass;
3. PR CI is green;
4. merged main SHA passes Customer V2 CI and backend CI where relevant;
5. Vercel production deployment succeeds for the exact main SHA;
6. backend deployment succeeds for the exact main SHA;
7. Release Integrity succeeds for the exact main SHA;
8. live custom domain and backend health/automation-policy endpoints are verified.

## Out of scope for this subsystem
- Calendly booking automation;
- Zoom meeting creation;
- LinkedIn message automation;
- multi-channel sequencing beyond Gmail;
- AI-generated reply sending;
- advanced deliverability warmup/domain rotation;
- autonomous modification of approved message text after queueing.

These may be layered later without weakening the safety boundaries defined here.
