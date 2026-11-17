# Event preparation review — 17 November 2026

## Outcome and ownership

One saved workspace event supplies the audience, edition, meeting details and invitation context. The existing campaign recipient selector owns company/contact selection; Messages owns reviewed content; existing Delivery and Conversations own transport and no-response follow-up. No new parallel CRM, mailbox or scheduler was introduced. No real invitations or paid contact lookups were used during verification.

## Findings and changes

- The three audience modes existed, but the event’s target industries were appended to a potentially long Profile description before a 180-character truncation. Event queries now prefer the explicit event targeting. Combined mode previously put outside research after every participant URL; its outside query now runs second. Existing qualification/edition checks and bounded counts remain.
- The desktop sticky event action bar could obscure the audience fields, as in the supplied screenshot. It is now in normal document flow. Source choice is visible, with audience explanations and combined-count semantics.
- The dormant follow-up draft branch rejected past events, ignored the meeting notes it required, and retained future invitation wording. Post-meeting drafting now has an explicit Messages purpose, actual conversation notes, validation for past events and a distinct recap body. A separate saved-event activation control permits reopening a past event for writing while research still rejects expired events.
- Purpose and notes persist with the individual CRM draft and participate in approval checks. They are supplied to working-editor validation, rewriting and message update paths; unsaved notes reset on buyer/workspace/event changes. Existing business drafts and approval/sending separation remain.
- Confirmed Gmail campaign sends already enter Conversations through their stored provider thread IDs. Delivery now exposes general and exact-recipient follow-up links and describes Gmail versus Outlook/manual support. Merely opening the tools does not approve or schedule follow-ups.

## Acceptance evidence

Focused model/UI tests cover the three query families, early mixed-audience coverage, event-specific targeting, qualification and attendance filtering, target deduplication, incomplete discovery, future/past event validation, note persistence, buyer isolation and approval binding. Authenticated HTTP/SQLite/Chromium tests exercise all three audience choices through saved company selection, Messages, approval, controlled Gmail delivery, exact conversation handoff and fresh browsers. A separate browser case exercises post-meeting notes, saved preview reopen, working-editor save and original preservation. Provider responses are controlled fixtures; these tests do not establish live participant availability or private customer mailbox outcomes.

Run results and release status are recorded with the PR. Production deployment is a separate owner-requested step; no production claim is made by this review.

Local validation: 116 focused event/campaign/dialog tests, 128 backend campaign/conversation/follow-up tests, 688 Messages tests (one existing skip), 258 Delivery tests, and four authenticated browser journeys passed. The three audience journeys each submitted one invitation to the controlled Gmail fixture, reopened the exact thread and left follow-up activation unchecked. The past-event journey saved/reopened notes, preserved the original, approved via Continue to Delivery and submitted the recap once to the controlled mailbox. The static build and JavaScript syntax checks passed. Real external email submissions: zero.
