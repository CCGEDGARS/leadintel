# Gmail test email

## Why
Delivery's recipient field intentionally matches the approved buyer. Replacing it with a personal Gmail address is blocked. A mailbox/formatting test needs a distinct action, not a weakened customer-recipient gate.

## Behavior
“Send test email” is available in the email editor header (Step 6) and Delivery's message controls (Step 7). It opens a modal with the connected sender, a blank test-recipient field, a [TEST] subject and the rendered plain-text preview. Current email text can be tested before approval. Approved branding uses the frozen approved snapshot; other drafts use the active ready brand snapshot. The body is preserved. Phone/LinkedIn are excluded. Actual sending requires submitting the form and confirming the displayed sender, recipient and subject.

The POST /api/integrations/gmail/test-send route checks the session, workspace membership and owner/sales role, connected Gmail, one recipient, confirmation, header safety and existing HTML/text validation. It uses the workspace's existing encrypted Gmail credential. This does not add credentials, providers or billing accounts.

Test sends have a separate gmail_test_messages ledger. They never write gmail_messages, email_activity_events, CRM customer activity/stage, automation queues or sequences. Existing reply-sync and outreach counts do not include them. Replies to tests stay in Gmail; they are not sales replies in CRM. They are real emails and remain subject to Gmail's own limits.

## Duplicate prevention and failures
Each attempt has a workspace/user-scoped key and payload hash. Atomic reservation prevents concurrent duplicate Gmail submissions. A reused key with different content is rejected. After an ambiguous provider/network result the reservation stays pending and retries return its state without sending again. The browser retains the attempt key in session storage across reopening/reload for the same content/address/account; no email body is stored there. “Prepare another test” enables an explicit new attempt after known success or rejection. Changing workspace/message invalidates a preview before submission.

Migration 0038 creates the ledger and reserves 2 KB per row against workspace record storage before sending. Status updates need no further quota reservation. No full test-email body or OAuth token is saved in the ledger. No destructive migration or data cleanup is needed; rollback can leave the unused additive table in place.

## Verification
Real SQLite route tests mock only the Google network boundary and cover authorization, MIME recipient/content, no commercial side effects, confirmation, invalid payloads, disconnected Gmail, parallel idempotency, payload conflicts, unknown delivery, provider rejection and storage limits. DOM tests cover the real Messages header, preview, cancellation, account/message races, duplicate clicks, retry keys, deliberate additional tests and text escaping. Production release proof also checks the module, layout, protected endpoint and backend feature version. No real message is sent by automated tests or deployment.
