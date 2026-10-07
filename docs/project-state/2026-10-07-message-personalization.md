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

34 focused regression tests passed, including abbreviation/proof preservation, source-cap retention, exact excerpt save/reload, workspace isolation and email approval after an opening edit. Full suite and production proof are recorded separately. Runtime logic derives from the active customer profile, not ERCON/LKAB fixtures.
