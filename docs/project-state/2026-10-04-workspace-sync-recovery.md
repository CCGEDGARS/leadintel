# Recurring workspace sync conflict — 4 October 2026

## Root cause

The first-party API transport used for cookie-safe Google authentication rewrites customer state requests to the application origin. The persistence boundary only matched the legacy Worker origin. As a result, successful saves did not attach persistence metadata or update the saved local snapshot. The browser continued to show an unsaved draft, producing redundant saves and cross-session version conflicts. Existing tests exercised only the legacy origin.

The keep-local action also reused the version from the original conflict response, which could already be stale. The automatic save path called this destructive resolution without a user click. Storage writes of unchanged values marked the workspace dirty.

## Correction

- Match both the fixed Worker origin and the application's own origin, scoped to the customer state endpoint. Preserve authentication and all version checks.
- Recognize previously persisted nonempty server records without the missing persistence metadata, rather than substituting a stale local snapshot.
- Never resolve a conflict automatically. Explicit recovery refreshes the current server state, serializes double clicks, and retries at most three concurrent version changes.
- Keep-local saves update the explicit saved baseline. Use-server uses freshly fetched state and updates the baseline before reload.
- Preserve both local and server copies before either resolution. A workspace-scoped recovery download is available. Failure to store a recovery copy prevents the overwrite. The original recovery pair remains available across retries within the active workspace.
- Ignore unchanged storage writes; clear obsolete dirty markers only when the saved snapshot confirms no local edits. Synchronize conflict/saved status across both UI controls.

## Evidence and limits

Behavioral tests exercise first-party persistence, legacy payload migration, automatic conflict blocking, stale versions followed by another concurrent write, double clicks, use-server reload, recovery quota failures, unrelated origins and workspace separation. Full customer suite and release proof are required before production acceptance.

Both choices remain explicit whole-workspace choices. Genuine conflicting edits are not silently merged. Recovery copies are browser-local; clearing browser storage removes them. CRM records are separate and are not rewritten by workspace resolution. No buyer research or paid contact verification is rerun by this change.
