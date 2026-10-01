# Delivery settings and sync recovery — 1 October 2026

## Customer evidence
Screenshots show a disabled Step 1 delivery preference asking an authenticated Google user to sign in, followed by the top bar reporting “Sync skipped · Local cache safe”. The account identity remains present. These are not evidence of failed Google authentication. Preserve local and server records; no reset or credential replacement.

## Root causes in source
1. Delivery setup used Boolean(policy) as authentication readiness. Failed/missing policy loads looked signed out. The refresh required policy AND live status success, silently withholding valid preferences if unrelated status failed; its error rendered only in the unopened Delivery panel.
2. Automation bridge and UI imported concurrently. UI startup could precede attachment of its bridge methods after the server-ready event had already fired, leaving preferences permanently uninitialized.
3. Legacy no-intent saveNow calls encounter the persistence fetch boundary's deliberate synthetic saved:false response. The server bridge then reported Sync skipped as an error even though this was a client save-ownership mismatch.

## Changes
- Load automation bridge before its UI; retain all auth and owner checks.
- Distinguish authentication, unavailable connection, policy loading, policy failure and role permission. Show the actual error in Setup and provide Retry delivery settings.
- Use successful policy independently of live status; reject stale results after workspace changes.
- Route legacy no-intent saves through the existing persistence owner, which adds the required save intent, retains conflict/version protection and reports true save outcomes. Blank workspaces are not automatically written through this path. No fetch boundary bypass and no false success result.
- Invalidate every changed asset boundary.

## Verification and scope
Regression cases cover authenticated failure/retry, successful preferences with failed status, stale workspace responses, unauthenticated access remaining disabled, and save delegation. Run full customer tests and exact-SHA production verification. Sending remains off unless separately activated; this fix does not enable automation or send messages. The screenshot's original backend settings failure response is unavailable, so do not invent a 401/404/provider error diagnosis. The new error display provides concrete diagnostics if a server failure remains.

Regression review: preserve the existing reset transaction path even when the workspace is empty. The production brand asset reset tests caught this interaction before publication.
