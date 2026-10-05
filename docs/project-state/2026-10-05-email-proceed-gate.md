# Buyer channel controls — 5 October 2026

Four consistent actions: Confirm email, Confirm phone, Confirm LinkedIn, Select & proceed.

Select & proceed is an email-only Content Creation handoff: green only for an eligible company email, disabled otherwise. Confirm email is highlighted when confirmation is needed. LinkedIn message creation remains inside its profile review dialog; confirming LinkedIn or phone never establishes email readiness. Workflow automation selection is not email verification.

Confirmation reuses exact-person CRM evidence before paid calls, checks available official email evidence through the existing direct-public-page confirmation endpoint, then uses Apollo and enabled Hunter within existing backend permissions/credit controls. Strict provider verification still requires provider evidence after public identity confirmation. The public confirmation endpoint can fall back to Firecrawl: do not describe every source recheck as free. A bare public listing is never sufficient to unlock Content Creation without the server confirmation record. Research does not guarantee delivery. Draft selection never sends.

Root cause: the shared proceed handler and rendering accepted either email or LinkedIn, while public policy could consider a raw source listing ready. Both paths now require the appropriate confirmed email evidence, preserving separate LinkedIn handoff.

Regression coverage exercises confirmed LinkedIn with missing email, phone-only state, pending verification, source listing without server confirmation, CRM reuse, public-first ordering, provider fallback and qualification holds. Production proof and authenticated customer acceptance are separate release gates.
