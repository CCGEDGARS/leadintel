# Workspace login controls — 12 October 2026

## Report and root cause
A signed-in customer saw both Google and Microsoft labelled Session active, with Create account / Manage account buttons opening external provider pages. The login-provider display hint was treated as workspace data: callback detach and first workspace activation removed it, then reload lost the selected-provider identity. Generic tool links were appended to every integration card regardless of workspace authentication.

## Correction
The login-provider hint now survives cache cleanup and cannot be overwritten by an archived workspace hint. Explicit sign-out still removes it. It is display metadata only and never grants authentication or workspace access. Signed-in workspace cards show LeadIntel Sign out / Switch controls without external account links. Unknown legacy sessions report provider unavailable and retain sign-out/switch controls, without guessing a provider from email or mailbox connection. Signed-out cards keep Continue with Google/Microsoft and explicitly labelled external Create Google/Microsoft account links. Mailbox connection remains separate.

## Verification and prevention
Regression coverage exercises callback cleanup, first activation, reload, sign-out, old archive restore, both selected providers, unknown sessions and settings close/reopen. Cache versions cover the changed entry points and both shared tool-link imports. Release smoke gates require the login controls, cache exclusion and entry versions. Customer tests and the exact-SHA release proof must pass before claiming production completion. Authenticated customer acceptance is separate from the DOM/runtime tests.
