# Saved email → Delivery handoff

The Messages screen could display a durably saved email and an inactive Add to flow button with no adjacent explanation. Pending source/template changes blocked progression while the explicit Update action was buried in Tools. Approval also retained a legacy requirement for a LinkedIn draft, even though email and LinkedIn now have separate composers. The flow/default/planner listeners were also bound before MessageWorkspace.mount created their controls, leaving visible buttons without handlers. Finally, successful flow membership persistence did not navigate into Delivery and could enqueue automatic sending when an earlier workspace policy was enabled.

## Resulting behavior

- Show the blocker and a targeted resolution action immediately below the message header. Updates remain explicit, preserve the previous version, and require Save. The shared page-quality flow gate drives the UI and remains authoritative at action time.
- Email approval requires email subject/body, current facts, language and existing approval provenance. An unrelated LinkedIn draft is no longer required. LinkedIn remains a separate manual channel.
- Add to flow persists the exact saved subject, body, recipient, person, company domain, workspace and approval timestamp in the CRM script snapshot. Failed/local-only persistence does not report success or open Delivery.
- A distinct message-flow-ready event opens Delivery for that exact approved buyer. The receiving module rejects another workspace/person/approval or changed content. Delivery preserves a verified CRM email even if the older dossier lacks its email field.
- Repeated addition opens Delivery without duplicating approval or sending. Adding a message never enqueues automatic delivery. Manual send and automation activation retain their explicit controls in Delivery.
- My Flows continues to represent reusable seven-step setups. A message handoff does not fabricate a saved setup or claim a draft timing plan is a scheduled send.

## Verification

Regression tests exercise missing LinkedIn content through the real email approval handler; saved message → Delivery selection → CRM snapshot restore; missing legacy email; duplicate clicks; failed CRM writes; buyer/workspace switches; visible Update/Save recovery; an already enabled automation policy with zero enqueue calls; stale dossier email superseded by scoped CRM verification; delayed Delivery module initialization; and approval invalidation during loading. Run the full customer suite, backend suite, build/standalone contract, hosted CI and the exact-SHA production release proof. This document does not itself assert production or authenticated-user acceptance.

Authenticated acceptance found the pre-mount listener defect that function-level tests missed. The regression now clicks the enabled rendered Add to flow button after real approval and checks Stage 7; handlers for flow, default and planner actions bind after mount.
