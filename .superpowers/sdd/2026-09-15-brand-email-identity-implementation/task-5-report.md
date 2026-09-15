# Task 5 report — outreach approval snapshot and exact preview

Status: COMPLETE.

Starting branch head: `829c89b9c4516e313ec4e9441837209383dacbbc`

Implementation head before this report commit: `3c4f2959c4ee0060350c4ab5aa21e1a203c98677`

## Remote commits

1. `70bd0bba9cd9f8df7785dc2fa75843c7dbf29c78` — RED frozen-brand approval contracts
2. `59da1917b80e1ab8bd40370e799eedef1699e8da` — expanded lifecycle and UI contracts
3. `17f145b178ab46270678a046fffbb3e00dff5d08` — frozen approval snapshot and deterministic email rendering
4. `71d9d68ab62ed17c007422e40ed7562f67d91043` — approved email preview and reapproval UX
5. `37c7593275d563ae1ff9d2699dd6403de61e6010` — explicit manual-send parity contract
6. `3d486bd6b56d9e5806a22410c730ed3f8f642e93` — frozen text handoff to current manual delivery
7. `37dd1056a5f33ff69bc918a445c8c2b20b767525` — outreach runtime cache-chain contract
8. `e47178b71e983f720bdd5ea12153fc7525b4fe55` — refreshed discovery entry cache contract
9. `bf55d9317ae0a551b92a1d1a1eef194e29fb5108` — branded-outreach bootstrap cache contract
10. `2447c7b012b5e9281ba347cfd536440d7d44319d` — outreach engine/UI loader cache refresh
11. `3c4f2959c4ee0060350c4ab5aa21e1a203c98677` — discovery entry-point cache refresh

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
- `discovery-ui.js`, `outreach-engine.js`, and `outreach-ui.js` now share the fresh `20260916-brand-outreach-v1` cache chain

## Verification

Initial RED run: 0 passed, 6 failed for the missing snapshot/rendering behavior.

Focused outreach and delivery verification: 25 passed, 0 failed, 0 skipped, 0 cancelled.

Final relevant regression verification after cache-contract changes: 109 passed, 0 failed, 0 skipped, 0 cancelled.

JavaScript syntax checks passed for `customer/outreach-engine.js`, `customer/outreach-ui.js`, and `customer/discovery-ui.js`.

The relevant regression set covered Brand Identity, outreach, manual delivery, language switching, automation isolation, state budget, and customer structure.

## Scope and concerns

- Task 5 is complete with no blocker.
- Safe HTML is frozen and exposed to delivery, but backend HTML validation/MIME and Microsoft Graph HTML transport intentionally remain Task 6.
- Automatic Gmail delivery remains on its existing plain-text path until queue snapshot support exists, as required.
- Task 5 cache-contract changes are committed. `main` and Task 6+ remain untouched.
