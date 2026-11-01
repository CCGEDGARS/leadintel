# Creator Library

Owner-approved 1 November 2026. Private platform-creator source management in Messages, above the channel picker. Separate from customer personal templates and Books/Skills.

## Use

1. Sign in with the configured creator account. Expand **Creator Library**.
2. Enter the creator password: the existing owner sign-in password by default. Optional Worker secret `CREATOR_LIBRARY_PASSWORD` overrides it. Never store credentials in source code or browser storage.
3. Choose **New script**, or copy an existing active master into a source draft.
4. Choose Emails, Messages (LinkedIn direct messages), or Phone Calls, and a style. Optional subfolders group sources within each channel.
5. Paste the exact original, or import `.txt`/`.md`. Paste the reusable pattern separately, or copy the original into it and replace factual values with explicit `{{field}}` placeholders. Email requires a subject pattern.
6. Confirm review and **Save draft**. Saving does not change generation.
7. **Activate version** after reviewing the confirmation. The saved snapshot becomes that channel/style's core master. Later source edits remain drafts until reactivated.

Multiple source drafts may be stored; one master is active per channel/style. Literal wording is preserved except explicit factual fields. AI gains no authority to rewrite originals. Messages means LinkedIn direct messages; this feature adds no WhatsApp delivery. Four-stage InMail stays in its existing editor; its master writes also require this unlock.

## Protection and versions

- Server requires a valid session, workspace membership and exact configured `ADMIN_EMAIL`. Customer workspace ownership never grants creator access.
- Constant-time password comparison, throttled attempts, session-bound HMAC unlock cookie (HttpOnly, Secure, 15 minutes). Missing secrets or creator throttle storage failures fail closed.
- Passwords are cleared from the form and never persisted by the client. Lock, account/workspace change and expiry clear the private editor. Expiry can discard unsaved edits; save drafts regularly.
- Private drafts use `creator_script_library` (migration 0066). Ordinary catalogues exclude activated original-source text/history; generation receives the active reusable pattern.
- Source/active revisions use compare-and-swap; concurrent edits reject activation. Last 30 prior source/master snapshots are retained. Review history, then save to restore as a new draft revision.
- Source removal is recoverable via Removed source drafts. It leaves the activated master intact; explicitly replace that active slot when needed.
- Activation updates subsequent explicit preparation/style selection. Existing saved/manual drafts, approvals, first tailored originals and personal defaults remain intact. It never sends outreach or approves campaigns.

## Implementation and verification

Backend: `backend/src/creator-library.js`, `backend/src/script-library-routes.js`. Client: `customer/creator-library.js`, mounted by `customer/channel-scripts.js`. Generation continues through the existing `coreScripts` registry and channel renderers.

Tests cover owner/password/legacy-write protection, cookie session binding, throttling, missing configuration, draft/activation separation, revision conflicts, history, removal and literal interpolation. DOM tests cover hidden customer panel, unlock, manual entry, activation, catalogue refresh and account change. Existing channel/core/InMail/message regressions remain required. Tests do not substitute for authenticated production acceptance. Release requires exact-SHA release-integrity proof.
