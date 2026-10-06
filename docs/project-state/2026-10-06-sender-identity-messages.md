# Sender identity in Messages — 6 October 2026

The user approved moving sender details from Setup to Messages, combining reusable sender name, role, company, contact details, signature, images and Calendly. Email account connections and credentials remain in Settings. Supporting company research inputs remain in Setup.

The existing identity panel is staged outside Setup and moved intact into Messages when the message studio mounts. Its controls and handlers are retained rather than cloned. Duplicate message sender/name/company fields are removed. A one-time workspace migration fills only absent identity fields from existing message settings; existing identity values, assets and contacts take precedence. The migration marker survives load/save. Subsequent generation derives sender fields from the same identity used for branded approval, including intentional clearing. Identity edits cancel pending generation and invalidate approval without deleting draft text. The Calendly field is inside the identity panel and persists on change or identity/settings save.

Identity is still optional for research and branded rendering. Its optional journey substep moves from Setup to Messages. Protected templates, personal templates, writing reference slots and manual LinkedIn sending remain as previously defined.

Validation: identity DOM relocation retains controls and event listeners; cross-industry canonical generation and deliberate clearing; one-time migration preserves data and does not resurrect cleared values. Full customer suite and static build are run before publication. Exact production release evidence and authenticated acceptance must be recorded before claiming the change live.

The first production reload exposed a legacy website-input lifecycle helper that reattached branding to Setup. The follow-up removes that old relocation, tests repeated website simplification against the real DOM, and anchors workflow controls to the target-market panel so moving identity cannot hide them. Every changed lazy-loader link is versioned, including the intermediate automation loader. Existing tests asserting the old placement are updated to the approved Messages placement.

## Verified production outcome

PR 444 published the initial relocation; PR 445 fixed the lifecycle conflict detected during authenticated acceptance. Final main SHA: 8181b819c78e6c493fe301b3eff0c6917afb766c. Customer CI 37500885954 succeeded for that SHA. Vercel production deployment dpl_FCe1JW9zis9RjaZg4dw1RbVKLFg2 reached READY. Release Integrity 37500939229 succeeded; the independent release proof also returned PROVEN with all 37 mandatory checks passing. Backend code was unchanged.

Authenticated reload confirmed exactly one identity panel under Messages and none under Setup. Expanding it showed the retained Edgars Untāls / Ercon identity and the exact user-provided Calendly link. Cloud status returned SYNCED TO LEADINTEL. The prior LinkedIn draft and selection were retained, and all writing-reference slots remained empty. No messages were sent. The two unreviewed Step 2 answers remain a separate generation prerequisite. Full customer suite: 1,828 tests passed; static build passed; independent review and follow-up review completed with no remaining findings.
