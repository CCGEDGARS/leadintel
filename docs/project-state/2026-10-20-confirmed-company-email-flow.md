# Confirmed company email handoff — 20 October 2026

## Customer requirement
Official-source-confirmed company emails must be visible with green Select & proceed actions, usable in manual and automatic flows. Firecrawl research is permitted. Apollo and Hunter paid actions need separate consent. A mailbox check and a confirmed person–email association are different claims.

## Root causes
The whole-company record retained the two published Wernedal addresses, while the buyer-role shortlist excluded their logistics/administration contacts. The record had no selection action. Its bounded staff-card extractor accepted first-name addresses, but the confirmation endpoint used a different ownership check that rejected those same cards. Finally, an enabled Hunter setting blocked otherwise accepted public emails and delivery could invoke a paid Hunter request without a fresh contact action.

## Change
- Share the exact official staff-card ownership gate with backend confirmation, retaining full name, actual role, company-domain URL, one bounded published address, and neighboring-card boundaries.
- Show published company email contacts prominently above the decision-maker shortlist. Green actions require persisted confirmation; listing alone is insufficient. Keep actual roles and unknown purchasing authority explicit.
- Selecting a company contact preserves its exact identity/email/title and uses the existing saved-recipient → Messages handoff. Explicit routing-contact selections are retained for automatic workflows without inventing a buying role.
- Rehydrate confirmation from CRM so reload does not repeat source or paid requests. Public-source confirmation can run independently of Apollo/Hunter.
- Delivery reuses accepted CRM evidence; it never starts a paid verifier. Optional paid provider actions retain separate approval and existing budgets. Explicit provider-only confirmation requirements still remain stricter than public-source confirmation.

## Verification
Regression coverage includes the two published first-name addresses, neighboring-card rejection, green/pending controls, actual recipient selection, explicit routing-contact eligibility, reload cache reuse, backend confirmation, automatic-email acceptance, and no paid requests during delivery. Full customer/backend suites, build, exact-SHA release checks and customer acceptance are required before completion.
