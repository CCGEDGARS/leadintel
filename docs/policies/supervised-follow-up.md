# Conversations and supervised follow-ups

Version: supervised-follow-up-v1. Approved by Edgars on 23 October 2026.

## Saved workflow presets — 27 October 2026

The user approved extending per-thread approval with saved presets: approve the steps, exact scripts and timing once, then run automatically within that scope. The original per-thread controls remain available. This approval to implement does not activate presets or authorize development sends.

Use the top-bar **Conversations** control to view attention items, scheduled/waiting threads and manual control. Owners create multiple presets with one to three distinct no-response scripts, increasing business-day offsets and a minimum reply delay of 15–10080 minutes. The existing Delivery policy still sets working days, timezone, send window, daily limits and spacing. Optional response scripts cover clearly expressed interest and meeting invitations. Blank response scripts require manual handling. Messages are literal approved text, including links/signatures; this version does not send freely generated AI responses or interpolate guessed facts. Review the checkbox and approval dialog before saving.

One approved preset may be the default for future confirmed Gmail sends after its approval time. Existing conversations require **Apply to this conversation**. Applying or replacing a preset checks current conversation context and rejects expired schedules. Preset revisions are immutable approvals; changing a preset holds its existing assignments for explicit reapplication. Deactivate or Delete stops its assignments while preserving approvals and communication history.

Automatic response eligibility deliberately uses a narrow authored-text grammar, the exact tracked recipient and non-automatic mail headers. Only an unambiguous permitted reply can queue the corresponding exact approved script after the minimum delay. New replies cancel stale messages. There is a lifetime maximum of one automatic reply per thread assignment, retained through replacement/resume; further replies, substantive questions, negotiations, uncertain language, referrals and unclear timing require human review. This boundary prevents unattended reply loops; it is not a general multilingual AI responder.

**Take over** stops pending automation and retains monitoring/history. Owner-only **Review & resume automation** requires fresh mailbox/context checks and explicit confirmation. It can requeue only future unsent no-response actions from the current approved revision, never expired steps, old revision scripts or old reply responses. Unknown delivery outcomes remain held for reconciliation. Sending also requires the server's existing approved-workflow capability; the legacy global automation setting remains manual-only.

The panel distinguishes a meeting request from a confirmed booking. Only a workspace/recipient-matched verified Calendly webhook receipt after the initial send establishes a booking. That stops pending outreach and creates a preparation task; cancellation stays manual and does not restart outreach. Google Calendar free/busy does not prove a booking. The drawer shows latest reply, next action, next approved message/time, last successful sync and errors. A paused plan's next action is a preview, not an active scheduled send.

Monitoring retains the existing hourly bounded runner (25 tracked threads per cycle across the service) and max-500 conversation list. These limits mean background detection can exceed an hour as usage grows. Missing enrollment prerequisites are persisted as visible blocked items; reviewed manual assignment can resolve them. No proactive email/push notifications are added by this version.

If storage prevents default enrollment, a preset-wide block prevents repeated failures from starving other workspaces. All affected pending conversations expose that block, and the preset shows the error. Freeing storage alone does not restart sending: an owner must Edit & reapprove the preset for future sends, or explicitly Apply it to an individual existing thread. Reapproval resets the future-enrollment boundary; older pending threads still require explicit assignment.

## Use

1. Send the approved first email through LeadIntel's connected Gmail. A recorded Compose/manual confirmation without a provider thread ID cannot establish mailbox monitoring.
2. Open **Delivery → Conversations & follow-ups**, or **Open conversations & follow-ups** in Messages. Select the recipient/thread, check original sent text and latest reply, then use **Check Gmail now** if needed.
3. For an unanswered thread, edit each of the three starter messages. Review the exact dates (business days 3, 7 and 14, using the configured timezone/send window). Check the review box, then **Approve and activate follow-ups**. The confirmation approves the exact text shown; it never resends the initial email. Expired dates cannot activate. Existing legacy automation for the recipient must be stopped before a new plan is approved.
4. Each follow-up is sent only if fresh Gmail checks succeed, no inbound or manual outbound change is detected, the recipient is still eligible, the approving owner/mailbox/CRM identity still matches, and limits/windows/spacing permit. You can **Stop follow-ups** at any time. A missed date holds the plan for review rather than sending a catch-up burst.
5. Any reply cancels no-response follow-ups. Review the suggested action and internal task. Explicit unambiguous dates produce reminders; uncertain timing stays a review task. Reminders never send messages automatically. Clear rejection/opt-out stops further outreach; bounce requires address review.
6. **Prepare reply for review** uses the existing Follow-Up Assistant and owned sent/reply history. Edit its response and **Save reviewed draft to CRM**. Saving never sends. The existing Writing Assistant in Messages remains available for broader customer-context writing and optional books.

## Monitoring and history

The existing hourly Worker cron checks only Gmail threads associated with confirmed LeadIntel sends, including stopped/completed sequences. Every detected message is retained with source IDs and chronology; inbound messages are saved to gmail_replies, CRM synchronization can recover independently. Original sent body is read from Gmail, never a current unsent composer. The panel exposes last successful sync and errors. Reads do not claim AI analysis has run: immediate next-action recommendations are conservative rules; AI drafting is explicit.

Monitoring still runs while the browser is closed. Detection latency is normally up to an hour plus provider/runtime delay. Before each due send, a separate fresh thread read is mandatory. Threads unrelated to LeadIntel sends are excluded. Replies in a new unrelated Gmail thread are outside this version's matching boundary. The sender can continue manually in the tracked Gmail thread; SENT labels identify aliases as own outbound.

## Authorization and storage

Workspace-scoped routes require an authenticated member. Owners activate plans; owner/sales can sync, stop plans and finish tasks. Read access is allowed to owner/sales/researcher. No global legacy-automation flag is enabled. Only explicitly approved per-thread plans use the existing approved-workflow server capability. Dedicated D1 conversation/plan/event tables keep growing history outside workspace JSON and account retained text against storage quota.

Idempotent storage, atomic claims and no blind retries protect sends. Ambiguous sends remain held for human reconciliation. The approval action itself sends no email. Verification must use simulated mailboxes/providers; no real prospects are contacted to prove a build.
