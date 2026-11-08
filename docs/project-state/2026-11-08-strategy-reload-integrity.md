# Strategy approval after Profile reload

## Authenticated observation

The Ercon/Denmark journey approved Profile and Strategy, then reopened the saved workspace. Profile remained approved, but Strategy became stale without a user edit. Comparing saved cloud and browser state found no material difference. Passing the saved state through the actual Profile normalization and Market recovery pipeline changed only `profile.marketFocus`: the canonical field was empty, while the readiness compatibility wrapper substituted the ideal-customer answer. The two resulting signatures matched the two observed approval signatures.

## Cause and repair

The readiness builder respects canonical field values, including an empty market focus, but its normalizer filled that same empty value with the ideal customer. The normalizer now respects the canonical market-focus record when present. Legacy profiles without that record retain their existing fallback. Strategy fingerprinting and stale-context protection remain intact.

The regression executes the real Profile, company-brain, canonical, readiness, Market and Strategy modules. It covers industrial and clinical sellers, repeated JSON save/reload cycles, canonical/compatibility consistency and invalidation after a real offer edit. Both fixtures failed on the original fallback and pass with the repair.

## Customer acceptance still open

The earlier Profile research deadline fix is independently proven on production revision `6c83b481650d196ee3f442f6b8309a13917a424c`. This reload repair requires its own release proof and authenticated reopen verification.

Real company research retained five Danish-market candidates. Subsequent evidence review verified five company websites but qualified none. Johnson Controls and Kitron have plausible purchasing applications; unresolved exclusions block qualification. Kitron was moved using the explicit manual Move to Buyers control, retaining its evidence gaps. No contact lookup or outreach outcome is claimed here. Paid email and phone permissions remain off; the user's total allowance is one lookup per channel.
