# Messages recipient continuity — 5 November 2026

## Observations and scope

The supplied screen recording shows Charlotte's accepted paid email and selected
Proceed state in Buyers, then a Messages draft with a recipient-confirmation
block. Robert is retained under Other contacts with a role-review hold. The clip
does not show the earlier Chrome Page Unresponsive dialog. No current customer
browser session or performance trace is available; that freeze is not reproduced
or claimed fixed. A missing Calendly URL is genuine missing input, not an email
failure, and must not be invented.

## Reproduced defects and changes

- A valid recipient handoff captured every buyer's public-research conflicts.
  Adding a conflict for another person invalidated the selected recipient's
  `current()` guard. Capture only conflicts belonging to that selected person.
  Preserve selected-person identity, role, company, email, profile, workspace,
  authentication, sync and CRM guards. Do not qualify a held buyer automatically.
- While CRM validation is pending, show a pending recipient check with its actual
  activity instead of telling the user to reconfirm immediately. Refresh page
  readiness after the handoff settles, including failure paths.
- Recipient review explicitly opens the Buyers focus. Module step 5 alone can
  resolve to Companies, which sends the user to the wrong recovery view.

## Regression and integration evidence

The new mounted-runtime test failed before the conflict-scope change and passes
afterward. Another buyer's role conflict leaves the selected draft unchanged;
the selected buyer's own conflict still invalidates the recipient and prevents
reopening. Pending CRM validation and completed status are tested. Page-quality
UI tests verify recovery opens Buyers, not generic module 5.

49 focused regression tests passed. The real HTTP/CRM controlled Chromium
Messages journey passed with an added sidebar reopen assertion: the exact saved
draft survives and recipient confirmation passes. It also covers fresh-browser
reopen, two-buyer isolation, failed-save recovery, CRM-authoritative draft recovery,
and separate LinkedIn/email drafts. Providers are controlled; no paid contacts or
outbound messages are requested. Setup activation was added to this fixture to
exercise sidebar availability with production prerequisites. An initial locked
sidebar observation without that activation was a fixture omission, not an app
root cause.

## Remaining acceptance limits

These tests prove the reproduced scope/feedback/navigation defects, not the cause
of the historic browser freeze or the customer's current role-review conflicts.
Current authenticated customer-session acceptance remains outstanding. Release
status requires exact-SHA release-integrity proof separately.
