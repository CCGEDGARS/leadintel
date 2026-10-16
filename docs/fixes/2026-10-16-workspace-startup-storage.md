# Workspace startup blocked by expanded browser state

## Root cause

The production browser reproduced the recovery screen. Its console reported
`QuotaExceededError` while `hydrateAuthenticated` called `applyPayload` and wrote
`leadintel_customer_v2_outreach`. Cloud state passed the 500 KB compressed sync
limit, but restoration expanded its working sections into JSON larger than the
browser's localStorage quota. The account gate correctly stayed closed after
the failed restore. Clearing browser data would risk unsynced work and would
not solve a large server workspace being restored again.

## Fix

The existing state-budget storage guard now stores large working sections with
lossless, bounded compression. Its `getItem` boundary returns the original
string exactly, including approved wording, whitespace, Unicode, and evidence.
The guarded sections are profile, discovery, outreach, delivery, and discovery
metadata. Small values, unrelated application data, and sessionStorage retain
their prior representation.

The decoder loads synchronously immediately after account-cache, before any
application module can read compressed state. Its module dependency uses the
same version URL. Existing expanded sections are compacted in place before
server hydration needs space; an unsuccessful write retains the old record.
Decoded reads cache only the exact stored value and recheck the account guard
on every access, so cross-tab writes, deletion, and account changes invalidate
the cached view. Cloud codecs and backend limits are unchanged.

Before the first compressed write, account-cache durably rotates its existing
context epoch to a codec-marked generation. Previous-version tabs immediately
fail their existing read/write/API ticket checks and reload, even before a
storage event arrives. Updated tabs share the generation, and account changes
preserve its marker. A failed fence leaves the exact legacy record and ticket
intact. The marker fits the existing UUID epoch without consuming more quota.
Local compression measures the original UTF-8 string against the 8 MB section
limit, avoiding double-serialization overhead for escape-heavy message text.

## Verification and prevention

- Regression reproduces the quota error before the fix with multi-megabyte
  approved outreach that still fits the cloud sync format.
- Exercise exact save/reload/edit, migration of legacy sections, native browser
  Storage quota behavior, failed-write preservation, and cross-tab changes.
- Real persistence/account integration restores large cloud outreach, reopens
  it without a false dirty state or PUT, signs out, isolates a second account,
  and restores the original account's outreach from its durable archive.
- Production release checks require the local codec and its early bootstrap.

Release verification and authenticated production acceptance are separate:
only a successful post-deployment browser reopen establishes resolution of the
observed production startup failure. No outreach sends or calls are authorised
by this repair.

Lesson: a server-side compressed save fitting the sync budget does not prove
that its expanded browser working copy fits Web Storage. Test both boundaries.

## Production follow-up: parsed response lifetime

The first release removed the quota exception. The affected browser then opened
with a baseline-unavailable conflict: its local Discovery/outreach/delivery
sections were empty, while cloud version 5319 retained the complete workflow.
A recovery copy of both sides was downloaded before restoring the cloud copy.
The local differences were derived profile metadata and the visible step.

The full-cloud reopen exposed another failure, `Invalid workspace verification
response`. The GET persistence boundary had already parsed a clone and then
performed recovery snapshot work, but returned the original network response
for a second body read. A regression reproduces failure when that original
stream expires after the clone succeeds. Return a buffered JSON response from
the already parsed body, and let failed initial body reads propagate rather
than fabricating empty state. This separates successful network download from
subsequent local snapshot work without weakening verification.

## Recurrence: shared body errors and startup ordering

A subsequent authenticated reload reproduced the same recovery screen. The
stack now ended in `fetchWorkspaces`, before workspace-state hydration. This
proved that buffering the state GET alone did not cover the shared startup
request boundary. `api()` swallowed every `response.json()` failure as `{}`;
a timeout or interrupted body therefore became an invalid payload, bypassing
the retry policy for transient startup reads.

Successful response-body errors now retain a safe path, phase, HTTP status,
and original error cause. The three mandatory startup GETs retry transient
AbortError, TimeoutError and TypeError body failures with their existing bounded
policy. Malformed successful JSON remains a verification failure. Empty or
non-JSON HTTP error responses retain status handling. Writes are never retried.

The startup sequence also mounted the app and optional normalization modules
before verification completed. `app.init -> setStep -> saveState` could mutate
the local baseline behind the CSS verification overlay. The application now
loads saved state and mounts only after successful bridge readiness; support
modules wait at the same boundary. Failure readiness events and stale tabs
cannot start either callback, and callbacks run only once. The minimal storage,
persistence and bridge dependencies remain available for authentication and
hydration, avoiding a circular startup dependency.

Regressions exercise interrupted real ReadableStream bodies at session,
workspace-list and workspace-state checks, real AbortController deadlines,
exhausted failures without clearing saved records, non-retried logout writes,
and the real app's public entrypoints while the verification gate is closed.
Repeated authenticated reloads are required for acceptance; a single successful
open and static production smoke checks do not prove restart reliability.

Discovery's saved-message bootstrap and the process-map mount also wait for
verification, so restoring Step 6 cannot load the full workflow while session
checks are pending. The pure CRM mapper remains a static prerequisite of the
support entrypoint so the bridge's post-verification pipeline migration keeps
its dependency ordering. Public navigation returns without mutation until app
state exists; page checks explicitly report loading during that interval.

The bridge itself now waits for DOMContentLoaded when running as a parser-
deferred script. Browsers mark those scripts `interactive` while later module
dependencies are still loading; the old `loading`-only check could start API
verification before persistence or the CRM mapper existed. Dynamic bridges
after DOMContentLoaded still start immediately. A real harness regression
reproduces the parser-interactive ordering and verifies no request starts until
the dependency barrier is reached.

Repeated production reloads also caught a retired `improve-profile` button:
the canonical profile runtime removes its legacy panel before verified app
mounting. The obsolete direct binding now tolerates that removed control;
a regression runs the real app bind function against the customer HTML with
the retired button absent and checks that later controls are still bound.

## Observer stability found during repeated reload acceptance

A separate render-stability review found two conditional observer feedback loops.
Profile-only market cards compared escaped HTML against the browser's serialized
HTML. Quotes and apostrophes serialize differently, so the body observer could
rewrite the same text forever. These fields now compare textContent and update
only changed text. Research-plan markup is normalized through an inert template
before comparison for the same reason.

The research-preview observer also removed and recreated the source-count label
on every refresh. Populated source cards therefore scheduled another refresh
indefinitely, including in a hidden preview. The count label now retains its node,
updates only when the count changes, and disappears when no source cards remain.
Real MutationObserver regressions failed before both fixes and now assert that
the callbacks settle, subsequent edits still refresh, and literal HTML-like text
stays text. These conditional reproductions do not alone prove the cause of the
authenticated Step 6 delay; repeated authenticated acceptance is still required.

The remaining live reload stall requires stage evidence. Adding `startup_trace=1`
to the URL enables opt-in console timing for the storage codec, parser-loaded
bridge, snapshot baseline, session/list reads, account activation, workspace
hydration and verified app mounting. Logs contain fixed stage
labels and elapsed milliseconds only, without workspace data, identities, URLs
or credentials. Normal visits do not emit these diagnostic entries.
