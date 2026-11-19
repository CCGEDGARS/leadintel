# Delivery setup before a message exists

Owner outcome: open Delivery at any point to configure the mailbox, sending plan, limits and follow-ups. A message approval is preparation, and saving a plan is preparation; sending and activation retain explicit confirmation.

## Cause and implementation

Delivery's content already handled missing packages, but four navigation owners still required upstream website/profile/research/message readiness: the website click guard, profile module availability, process map and saved-route restoration. The app also used campaign approval as an entry condition. These now allow Delivery setup while preserving research prerequisites, workspace reconciliation and every message/recipient/send authority check. The lazy loader restores Delivery even before a profile exists. A null message passed to the language-pack suggestion helper previously crashed the shared Messages loader in this fresh-account path; it now receives an empty context without generating or changing a message.

The empty view explains that no messages are ready, retains mailbox and settings access, and hides unused outcome/learning panels until there is a message or history. Go to Messages uses the existing upstream navigation and recipient requirements. Manual-only workspaces can edit the same schedule and follow-up plan in Delivery. Their server capability remains manual-only.

Save settings keeps an inactive plan disabled. A separate activation control requires an owner, enabled server capability, connected Gmail and current approved messages. Its final review includes mailbox, schedule, limits, follow-ups and available approved message text. Changes to active settings also require review, with account, policy, form and message snapshots rechecked after confirmation. Existing approved workflow controls, queued delivery authority, pause/emergency stop and automatic approval-event behavior are retained. Sunday uses the server's 1–7 convention. Saved/error feedback survives form rerender.

Connected mailbox Send buttons stay disabled without the selected approved recipient and message. The final manual send review shows the mailbox, recipient, timing, subject and exact approved text. Cancel and changed-context paths do not send; existing provider receipts and idempotency protection remain authoritative.

## Acceptance and limits

- Focused customer coverage includes empty setup, save/reload without activation, Sunday, missing message send disablement, exact preview cancellation and activation cancellation/context edits.
- `backend/test/delivery-setup-access.test.mjs` enters the real application through authenticated HTTP and SQLite: blank Setup to Delivery, desktop/mobile, saved plan/reload, zero queued/provider sends, and prepared-workspace return to Messages. It is mandatory in the Customer CI browser journey job.
- Existing Step 7 browser acceptance covers exact approved copy, a single controlled provider submission, duplicate clicks, CRM outage recovery, saved replies/outcomes, Cancel/Escape and workspace isolation. Synthetic mail providers are used; no real outreach is authorized by this work.
- Exact release proof is separate from the controlled acceptance. Publication requires exact-SHA CI, the matching production manifest, backend health and all mandatory smokes with a PROVEN verdict. No authenticated customer production session is available here.

No schema migration or production data rewrite. Rollback is the prior frontend revision; saved policy data remains compatible. Storage/Stripe, core message masters and research behavior are outside this change.
