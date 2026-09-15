# Task 5 report — outreach approval snapshot and exact preview

Status: COMPLETE.

Starting branch head: `829c89b9c4516e313ec4e9441837209383dacbbc`

Implementation head before this report commit: `3d486bd6b56d9e5806a22410c730ed3f8f642e93`

## Remote commits

1. `70bd0bba9cd9f8df7785dc2fa75843c7dbf29c78` — RED frozen-brand approval contracts
2. `59da1917b80e1ab8bd40370e799eedef1699e8da` — expanded lifecycle and UI contracts
3. `17f145b178ab46270678a046fffbb3e00dff5d08` — frozen approval snapshot and deterministic email rendering
4. `71d9d68ab62ed17c007422e40ed7562f67d91043` — approved email preview and reapproval UX
5. `37c7593275d563ae1ff9d2699dd6403de61e6010` — explicit manual-send parity contract
6. `3d486bd6b56d9e5806a22410c730ed3f8f642e93` — frozen text handoff to current manual delivery

## Implemented

- approval consumes `LeadIntelBrandIdentity.snapshot` only for a valid Ready identity
- the approved package stores a deeply immutable `brandSnapshot`, immutable `approvedSource`, and deterministic `approvedEmail`
- resolved managed logo/headshot/banner metadata are frozen with the identity revision
- preview is always regenerated from the approved source plus frozen snapshot; persisted HTML is never trusted
- current Gmail Compose and manual mailbox flows receive the exact approved text rendering through `drafts.emailBody`
- `buildApprovedSendPayload` exposes the same subject, text fallback, and HTML for Task 6 delivery
- later Step 1 identity changes cannot mutate an approved package
- dossier rebuild and explicit regeneration invalidate approval, snapshot, rendered email, and contacted state
- regeneration remains explicit and requires a fresh approval
- legacy and non-ready identity packages remain plain text and retain their original copy
- `[Your name]` and `[Jūsu vārds]` are removed only when the body still matches generated content and a ready identity supplies sender details
- arbitrary user-edited placeholder text is preserved
- CRM stage/activity, recipient selection, idempotency inputs, and the separate human send action remain intact
- no branded automatic-delivery path was enabled

## Verification

Initial RED run: 0 passed, 6 failed for the missing snapshot/rendering behavior.

Focused outreach and delivery verification: 25 passed, 0 failed, 0 skipped, 0 cancelled.

Final relevant regression verification: 103 passed, 0 failed, 0 skipped, 0 cancelled.

JavaScript syntax checks passed for `customer/outreach-engine.js` and `customer/outreach-ui.js`.

The relevant regression set covered Brand Identity, outreach, manual delivery, language switching, automation isolation, state budget, and customer structure.

## Scope and concerns

- Task 5 is complete with no blocker.
- Safe HTML is frozen and exposed to delivery, but backend HTML validation/MIME and Microsoft Graph HTML transport intentionally remain Task 6.
- Automatic Gmail delivery remains on its existing plain-text path until queue snapshot support exists, as required.
- Browser cache/version release changes intentionally remain Task 7; this task did not modify release files or `main`.
