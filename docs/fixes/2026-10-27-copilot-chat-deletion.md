# Ask LeadIntel — chat history deletion

The History panel now offers a trash button beside each conversation and **Clear all history**. Both use the standard LeadIntel confirmation dialog, with Cancel as the initial focus and an explicit permanent-deletion warning. Chat history is shared within a workspace; only its owner can delete it.

Deletion runs on the server, scoped to the authenticated workspace. A single database statement removes a conversation (or every conversation in that workspace, including those beyond the 50-row list). Existing foreign keys cascade to messages and detach saved memories without deleting their values. CRM, workspace state, diagnostics and other workspaces are untouched. No schema migration is needed.

Deleting the open chat resets its conversation ID, messages, draft input and print preview. The next message starts a new chat. Cancel and failed requests preserve the conversation. Controls are locked during confirmation/deletion and while an answer is being saved. Workspace and request-version checks prevent delayed reads from restoring deleted text. Saved memories remain separately manageable under **Remembers**.

## Verification

Regression coverage uses the real UI in JSDOM and the actual route with SQLite and foreign keys enabled. It covers single/bulk deletion, cancellation, failures, active-chat reset, reopen, saved-memory preservation, bulk deletion beyond 50 chats, authentication, owner permissions, cross-workspace isolation, delayed reads and in-flight answer protection. Release smoke checks require the new entry token, UI controls and transport functions.

Manual acceptance: open **Ask LeadIntel → History**, select a trash icon or **Clear all history**, cancel first, then test confirmation using disposable chats. Reopen the assistant and refresh the page to confirm persistence. Existing customer chats are not deleted as part of deployment verification.
