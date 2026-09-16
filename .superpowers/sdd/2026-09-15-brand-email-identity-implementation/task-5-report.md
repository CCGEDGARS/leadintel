# Task 5 report — outreach approval snapshot and exact preview

Status: COMPLETE.

Starting branch head: `829c89b9c4516e313ec4e9441837209383dacbbc`

Implementation head before this report commit: `1ce1c0edbe2dff4adcf9ffea74b5bc0585a8b4d0`

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
12. `d9b60554c5360f6f8c17f48537e0df5d167feeb0` — independent-review fix for frozen manual delivery and plain automation handoff
13. `1ce1c0edbe2dff4adcf9ffea74b5bc0585a8b4d0` — CRM sent activity uses the frozen approved subject

## Implemented

- approval consumes `LeadIntelBrandIdentity.snapshot` only for a valid Ready identity
- the approved package stores a deeply immutable `brandSnapshot`, immutable `approvedSource`, and deterministic `approvedEmail`
- resolved managed logo/headshot/banner metadata are frozen with the identity revision
- preview is always regenerated from the approved source plus frozen snapshot; persisted HTML is never trusted
- approval retains the plain approved source in `drafts` and no longer overwrites it with branded rendering
- Gmail Compose resolves its subject and text from `buildApprovedSendPayload`, not mutable drafts
- explicit Gmail and Microsoft API requests resolve subject, text, and HTML from `buildApprovedSendPayload`, not mutable drafts
- later mutation of `drafts` cannot change the approved preview or any explicit manual-send payload
- CRM send confirmation derives its recorded subject from the same frozen approved payload, not mutable drafts
- CRM activity ID, recipient, channel, timestamp, metadata, and pipeline behavior remain unchanged
- automatic delivery handoff reads immutable `approvedSource` and receives no snapshot-rendered signature, legal footer, assets, or HTML
- `buildApprovedSendPayload` exposes the same frozen subject, text fallback, and HTML used by preview and explicit manual delivery
- later Step 1 identity changes cannot mutate an approved package
- dossier rebuild and explicit regeneration invalidate approval, snapshot, rendered email, and contacted state
- regeneration remains explicit and requires a fresh approval
- legacy and non-ready identity packages remain plain text and retain their original copy
- `[Your name]` and `[Jūsu vārds]` are removed only when the body still matches generated content and a ready identity supplies sender details
- arbitrary user-edited placeholder text is preserved
- CRM stage/activity, recipient selection, idempotency inputs, and the separate human send action remain intact
- no branded automatic-delivery path was enabled
- the outreach and delivery cache chain uses `20260916-brand-outreach-v3`; the unchanged process-map and automation loader remain on v2

## Verification

Initial RED run: 0 passed, 6 failed for the missing snapshot/rendering behavior.

Focused outreach and delivery verification: 25 passed, 0 failed, 0 skipped, 0 cancelled.

Final relevant regression verification after cache-contract changes: 109 passed, 0 failed, 0 skipped, 0 cancelled.

Independent-review RED run: 6 passed and 2 failed for mutable draft delivery and missing plain automation handoff.

Independent-review focused verification: 28 passed, 0 failed, 0 skipped, 0 cancelled.

Independent-review affected regression verification: 156 passed, 0 failed, 0 skipped, 0 cancelled.

JavaScript syntax checks passed for all 9 changed JavaScript runtime/loader files.

CRM-subject RED run: 8 passed and 1 failed because the delivery engine did not expose a snapshot-derived CRM activity builder.

CRM-subject focused verification: 22 passed, 0 failed, 0 skipped, 0 cancelled.

CRM-subject affected regression verification: 157 passed, 0 failed, 0 skipped, 0 cancelled.

JavaScript syntax checks passed for all 4 runtime files changed by the CRM-subject fix.

The relevant regression set covered Brand Identity, outreach, manual delivery, language switching, automation isolation, state budget, and customer structure.

The broad all-customer command is not a valid gate in this partial checkout because unrelated `step2-readiness-engine.js` and reference-customer runtime files are absent. No Task 5 affected test depends on those missing fixtures.

## Scope and concerns

- Task 5 is complete with no blocker.
- Automatic Gmail delivery remains on its existing plain-text path and receives only immutable `approvedSource`, as required.
- Task 6 backend commit `4ebd4538f7a9bd4fb3eddcbb809693248741e62d` was preserved below the final Task 5 CRM fix without overlap or force push.
- Task 5 cache-contract changes are committed. This fix did not modify `main` or any Task 6 backend file.
