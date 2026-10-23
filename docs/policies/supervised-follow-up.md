# Conversations and supervised follow-ups

Version: supervised-follow-up-v1. Approved by Edgars on 23 October 2026.

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
