# Messages: evidence-first personalization

## Root causes

The fact picker displayed source page titles rather than researched developments. Late-page excerpts did not survive trigger normalization, and the persisted 15-source cap could discard newly researched events. Full regeneration was the only practical way to incorporate a fact.

## Changes

- Rank extracted developments above company background; show source/date and an explicit user-review gate. A recommendation is not verification.
- Add targeted fact research through the existing dossier search path, preserving drafts and guarding workspace, buyer, channel and concurrent generation changes.
- Preserve exact reviewed excerpts and newly researched evidence through CRM save/reload.
- Add opening-only updates. Preserve the remaining draft; refuse ambiguous boundaries, embedded proof and unsupported language/context changes.
- Distinguish saved-template generation from AI generation; protected originals remain unchanged.
- Show approved value/proof guidance. Revenue, costs and process benefits require support; missing numbers stay missing.
- Group manual LinkedIn copy/profile actions. No automatic sending.

## Verification

34 focused regression tests and all 1,871 full-suite tests passed, including abbreviation/proof preservation, source-cap retention, exact excerpt save/reload, workspace isolation and email approval after an opening edit. The production build passed. Runtime logic derives from the active customer profile, not ERCON/LKAB fixtures.
## Completed production verification

2026-10-07: exact main revision c6886153a94bc71b1152adc60f9a395cef915fcf, Customer V2 CI 37639255113 success, Release Integrity workflow 37639331559 success. Direct proof verdict PROVEN: manifest SHA matches, backend health passes, all 39 mandatory smoke checks pass. An earlier transient 502 cleared on fresh verification.

Authenticated Messages verification: fact research completed with seven candidates, existing email draft remained byte-for-byte unchanged, source review remained unchecked, opening update remained gated, template generation label was correct, and workspace was synced. Candidates require user source review; none were auto-confirmed. New message-facts asset separately returned 200 with preservation and prompt guards. No outreach sent.
