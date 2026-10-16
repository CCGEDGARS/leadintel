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
