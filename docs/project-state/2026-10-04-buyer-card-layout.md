# Buyer card hierarchy and single save action — 4 October 2026

User request: show the four chosen buyers before potential candidates, equalize the four cards and controls, and remove duplicate per-buyer save buttons.

## Changes

- Render ranked recommendations first, additional full-name candidates second, and unresolved identities afterwards in a collapsed disclosure. Research coverage stays accessible below the buyers; warnings remain visible.
- Use equal-width two-column cards with equal grid row heights and bottom-aligned contact actions on desktop. Mobile uses a single column with natural heights. All four action controls use matching sizing and centered labels.
- Remove the extra per-card Save buyer button. Save & proceed remains the single per-buyer save action: it requires an accepted company email, saves first, and proceeds only after successful persistence. Whole-company Save buyer research in CRM remains distinct because it preserves the entire research snapshot.
- Fix original-contact indexing for ranked display copies by matching stable buyer identity rather than object reference. Ranking clones previously produced index -1 for contact controls.
- Invalidate the discovery JS/CSS asset boundary with ranked-buyers v15.

## Validation

Regression checks render recommendations before additional candidates and unresolved identities, assert four actions and one save control, and confirm display copies retain their original contact index. Existing persistence, email gate, save failure and already-saved continuation tests remain in the full customer suite.

Production claims require the exact merged SHA release-proof verdict PROVEN. Authenticated visual inspection verifies actual ordering, card/control geometry, and retained evidence independently of code tests.
