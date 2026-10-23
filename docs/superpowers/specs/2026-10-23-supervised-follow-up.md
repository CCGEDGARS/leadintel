# Supervised follow-up — user-approved design

User approved the supervised automation recommendation on 23 October 2026 and authorized implementation. No additional conversational approval is needed to build/release; real recipient sends still require explicit in-app approval.

## Intent
Track Gmail conversations started through LeadIntel continuously; preserve CRM history, recommend next actions, automatically create internal dated tasks, and send only exact individually approved no-response follow-ups. Substantive replies, prices, proposals and commitments require human review. No test sends to real prospects.

## Behaviour
- Support already sent initial emails, including explicit manual Gmail sends from LeadIntel. Monitor associated threads even after sequences stop/complete. Do not read unrelated inbox mail.
- Three independently editable follow-ups by default on business days 3,7,14 after first confirmed send, then stop. Never repeat one body across all steps. Show exact texts/dates before activation. Per-thread explicit approval; no retroactive auto-activation of existing records. Past-due schedules require review rather than immediate catch-up bursts.
- Any inbound reply stops the no-response sequence. Out-of-office and timing delays create a dated reminder when an explicit unambiguous return/request date exists; otherwise create a review task. Do not automatically restart outreach after those replies. Rejection/opt-out and bounce stop sending; suppression enforced for opt-outs and clear rejection. Uncertain meaning pauses, never guesses permission.
- Check live Gmail thread immediately before automatic follow-up; failure holds send. Recognize human outbound messages in Gmail (including SENT-label aliases), stop the stale sequence, save history. Deduplication and no blind retries after ambiguous sends. Guard suppression, identity, mailbox reconnect, workspace, context revision and owner pause/cancel.
- Continuous background monitoring uses existing Cloudflare scheduler (hourly polling, accurately exposed), without adding Google Pub/Sub infrastructure. Poll fairly, bounded, with status/error visible; record failed sync separately from last successful sync. Persist all inbound replies, not just first. Recover CRM sync independently.
- Recommendations show original reply, conservative intent, latest development, recommended next action/reason, due date, and editable review draft where eligible. Use existing Follow-Up Assistant AI boundary for drafting; no automatic substantive replies. Show truthful awaiting-analysis state if AI unavailable.

## UI/API contract
New standalone workspace conversation panel in Delivery & Learning, plus contextual link/access from Messages. Reuse app dialogs, isolated request state, escape untrusted content. APIs under `/api/conversations` use authenticated workspace from query; read owner/sales/researcher, writes owner/sales, activation owner. No stored tokens in frontend.

GET `/api/conversations`: `{conversations:[{id,domain,recipient,subject,gmailThreadId,sentAt,lastSyncedAt,syncError,latestReply,summary,nextAction,reason,dueAt,status,plan:{status,steps}|null,companyId,contactId}],monitoring:{intervalMinutes:60}}`. IDs are persisted gmail_messages IDs, latestReply includes id/bodyText/category/receivedAt.
POST `/api/conversations/:id/sync`: same conversation object after fresh sync.
POST `/api/conversations/:id/plan`: `{approved:true,steps:[{body,days:3},{body,days:7},{body,days:14}]}` exact reviewed plain text, optional explicit subject per step default initial subject. Returns `{conversation}`. Reject stale/latestReply/manual later send, missing confirmed CRM contact, past schedule, concurrent duplicate plan; no initial resend.
POST `/api/conversations/:id/cancel`: stops pending followups, returns `{conversation}`.
POST `/api/conversations/:id/task`: `{status:'done'}` completes internal task, returns `{conversation}`.
AI prepare/save uses existing `/api/follow-up-assistant` context/analyze/save contract with companyId/contactId/recipient and latest stored reply. Draft save never sends. UI displays draft text, intent and nextAction. All new responses no-store.

## Limits and compatibility
Preserve canonical first-email masters, old approved workflows, campaigns, global manual-only default, CRM source architecture and suppressed contact rules. New supervised plan is separately approved and may use approved-workflow enabled server capability; never enable arbitrary legacy automation. Keep configurable existing send windows, spacing, limits, emergency stop. Preserve working tree isolation. Verify with mock providers and actual SQLite DB, UI tests, full suites/build and exact-SHA release integrity. Distinguish implementation/release proof from actual Gmail customer acceptance.
