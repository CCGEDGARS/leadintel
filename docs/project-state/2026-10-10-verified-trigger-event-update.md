# Verified trigger and event update audit — 10 October 2026

The user requested an actual double-check that Update message produces a tailored approved script using current confirmed triggers/events within the agreed frame.

## Findings and corrections

All four core styles rebuild from protected literals and source-verified/user-reviewed fields. A newly confirmed Riverport project replaces the previous Northport project in the working body and eligible subject choices; protected frame validation passes. Invalid AI fields, stale source fingerprints, cross-workspace responses, unsafe links and unsupported claims remain covered by the existing contract tests.

A reproduced gap affected explicitly applied event invitations: Update message forced eventCampaign=null and clearEvent=true, switching the invitation to a business default or regular core email. The route now handles an applied event first, rebuilding through EventCampaigns.draft and validateDraft. It reads the newest saved details for that same event ID and preserves its chosen event style. Archived, expired or incomplete events fail closed. A different globally active event is not silently substituted. No default business template overrides an applied invitation.

The new event regression also exposed an Undo comparison error: the event draft has style/language/linkedinMessage metadata, while the displayed working draft has only subject/message. Undo now stores only displayed fields in appliedDraft, preserving its original event context separately. CRM save/reopen Undo restores the exact previous text and previous event snapshot.

## Verification boundary

New regressions exercise all four styles with a changed confirmed source; applied event versus business default; saved event dates/stand/location; preserved friendly style; current sender and recipient; event subject; no AI whole-script rewriting; invalid event preservation; and persistent Undo. Authenticated customer-tab operations and sending are not part of this audit. Production must be proven for the exact merged SHA.
