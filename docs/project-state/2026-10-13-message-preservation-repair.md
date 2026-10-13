# Step 6 preservation and provenance repair — 13 October 2026

## Reproduced defects

- Rendering a saved tailored or rewritten historical subject longer than 60 characters silently replaced it with a fresh subject. This violated exact saved reopening. Automatic repair also changed unsaved explicit rewrites.
- After AI Generated failed, Reset restored the Professional original but labelled and persisted that body as AI Original, because it used the selected retry style rather than the historical original's provenance.
- The new Writing Assistant Apply adapter did not enforce the existing link, sender and meeting-duration guard used by legacy adjustments. Its shared validation is now applied before any mutation.

## Repairs

Implicit legacy subject repair excludes saved, pending-save, manual, rewritten and translated drafts. Historical invalid text stays visible for review; preserving it does not authorize sending. The approval and subject validators remain active.

New tailored originals store their style, essentials and trigger URL with immutable original text. Reset restores that provenance. Legacy originals derive their style from their historical scope or applied draft mode. Reset changes only the active channel’s mode/default selection, preserving the other channel’s settings. Reset clears prior Save readiness even when the restored text is identical and retains recovery history; the user must explicitly Save the restoration.

The composer separately labels edited working copies, personalized templates, AI generated copies and legacy saved copies, so a saved rewrite is not mistaken for an approved canonical restoration. Its selected/applied Style label remains intact, including failed preparation and blank loading states.

Writing Assistant Apply validates the displayed draft against captured current context before protected-frame/event checks or persistence. A mounted adapter test rejects a proposal that drops the booking link without mutating the stored message.

## Verification limits

No approved-reference literal changed. Regression tests reproduce defects before the changes and exercise mounted rendering, Reset, CRM serialization and the real assistant adapter after the changes. Local tests do not establish authenticated production behavior or any exact-SHA deployment proof. No live provider calls, emails or deployments were performed in this repair task.
