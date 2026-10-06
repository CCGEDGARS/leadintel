# Sender identity in Messages — 6 October 2026

The user approved moving sender details from Setup to Messages, combining reusable sender name, role, company, contact details, signature, images and Calendly. Email account connections and credentials remain in Settings. Supporting company research inputs remain in Setup.

The existing identity panel is staged outside Setup and moved intact into Messages when the message studio mounts. Its controls and handlers are retained rather than cloned. Duplicate message sender/name/company fields are removed. A one-time workspace migration fills only absent identity fields from existing message settings; existing identity values, assets and contacts take precedence. The migration marker survives load/save. Subsequent generation derives sender fields from the same identity used for branded approval, including intentional clearing. Identity edits cancel pending generation and invalidate approval without deleting draft text. The Calendly field is inside the identity panel and persists on change or identity/settings save.

Identity is still optional for research and branded rendering. Its optional journey substep moves from Setup to Messages. Protected templates, personal templates, writing reference slots and manual LinkedIn sending remain as previously defined.

Validation: identity DOM relocation retains controls and event listeners; cross-industry canonical generation and deliberate clearing; one-time migration preserves data and does not resurrect cleared values. Full customer suite and static build are run before publication. Exact production release evidence and authenticated acceptance must be recorded before claiming the change live.
