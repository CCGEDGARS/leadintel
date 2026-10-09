# Shared project context: Gällivare / Malmberget

The 16:17 screenshot still showed Gällivare in suggested subjects. The previous fix tested an English event summary separate from headline metadata; the actual Swedish source combines a Gällivare heading with the Malmbergsgruvan paragraph in the same extracted event.

Verified first-party sources:
- https://lkab.com/sida/2/ : heading uses Gällivare; adjacent paragraph names Malmbergsgruvan.
- https://lkab.com/press/lkab-gor-miljardinvestering-i-nytt-sovringsverk-i-gallivare/ : explicitly places the plant at the mine in Malmberget, Gällivare.

This is a project-label extraction inconsistency, not evidence of an unrelated signal. Exact saved customer URL cannot be established from the screenshot alone.

The selected event now carries the same conservative English project summary used in the trigger card. Subject resolution prioritizes that representation, while preserving raw reviewed evidence and its URL for field preparation and verification. The derived representation participates in scope and prepared-field fingerprints to invalidate stale preparations. No subject templates, original bodies, manual edits or source excerpts are overwritten.

Regression runs the real selected-trigger normalizer, context builder and working subject resolver against the combined Swedish source and checks all project subject styles, CRM reload, preserved evidence, and changed-context invalidation. Future regressions must match the complete actual source shape; separate English summaries are insufficient.

Release proof covers published assets, CI, health and mandatory smokes. Authenticated customer AI preparation remains a separate unverified gate.
