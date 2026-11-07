# Lookalike state discrepancy — ERCON 2026-10-12

Evidence: user Strategy screenshot + authorized read-only inspection of uploaded D1 SQLite backup, no private records or credentials committed.

- Saved referenceCustomers contains Epiroc (epiroc.com) with row status ready.
- referenceCustomers.activated=true; activeIds contains the saved Epiroc reference ID; publishedModel.activeRows contains Epiroc.
- Saved discovery potentialMatches include lookalikeMatch to Epiroc; prior results used that reference.
- Strategy screenshot nevertheless shows Lookalike ICP disabled and 'Add and activate a reference customer'.
- Lookalike ICP rationale has missing interpolated reference name ('Use  as commercial anchors'), another observable state/rendering problem.
- Separate 'Lookalike-led / Past Customer Context' profile is present, producing confusing duplicate concepts.

Diagnosis NOT established: Reference activation and ICP switch may intentionally be separate. Trace selectors and enablement prerequisites before any fix.

Acceptance:
1. Active reference display and Lookalike status must be consistent, with clear distinction between reference readiness and ICP enabled preference.
2. Never automatically enable paid research; activating a reference does not trigger expenditure.
3. Show activated reference names and counts; never suggest no reference exists when one is active.
4. Avoid two indistinguishable Lookalike cards. Offer canonical Lookalike Customers with optional advanced variants and preserve original data/score behaviour.
5. Add tests for old saved state hydration, reference active/inactive, switch persistence and existing discovery match preservation.
