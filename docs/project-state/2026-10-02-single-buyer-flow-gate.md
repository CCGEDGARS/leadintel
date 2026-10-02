# Single buyer-to-Scripts action — 2026-10-02

## Authorized UX
Remove the two Add to flow enrichment checkboxes beside Confirm email/phone. Keep those confirmation buttons as manual verification actions. Add one next-step action beside Keep candidate. Show the notice: “Verify this contact’s email before continuing to content creation. Phone verification is optional.”

The next button is disabled before saving. A saved unverified buyer displays Verify email to continue; clicking focuses, scrolls to and highlights that card’s Confirm email button. Saved verified buyers display Add to flow →, with Added to flow ✓ · Open Scripts after selection. This action persists the exact person/contact reference and opens Scripts, without sending or approving outreach.

## Evidence gate and handoff
The click reads the workspace CRM contact and requires a unique matching full identity with a verified business email. Public listings, Gmail, inferred patterns and catch-all/inconclusive checks do not satisfy this gate. Identity-attributed valid/deliverable Hunter results can be saved as verified business contacts without requiring Apollo. Optional phone confirmation never blocks entry.

The selected person survives normalization/refresh. Scripts reads the workspace-scoped contact reference, rechecks the CRM email and preserves the exact person during dossier/draft creation, including the sixth recommendation. Changing buyers invalidates a previous script package. Authenticated generation without a saved selected buyer redirects back to Buyers. Server preference sync failure prevents navigation. Unsave revokes the flow marker while retaining CRM history. Old enrichment checkbox flags no longer trigger lookups after public research.

## Verification
Full customer/backend tests plus exact-SHA CI, deployment, live manifest, health, smoke and asset parity checks govern release. New tests cover save/verification states, no progression for public/Gmail/unverified addresses, focus redirection, exact-contact selection and failed preference sync. No real outreach was sent. Authenticated customer acceptance remains separate from provider mocks and public deployment proof.
