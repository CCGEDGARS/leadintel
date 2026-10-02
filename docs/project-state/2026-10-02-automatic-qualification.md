# Automatic qualification settings

Setup places Research priority and Minimum qualification score beside workflow mode. Priorities are Lookalike first, Signals first and Balanced; thresholds are 70, 80 (default) and 90 out of 100. Companies shows the saved rule and links back to settings. Saving these rules does not activate automation or authorize outreach. Changes invalidate Companies and downstream approvals; approved workflows require renewed review.

Signal qualification requires current dated company-specific events. Lookalike qualification requires first-party evidence matching at least two supported reference dimensions; it can qualify without public buying intent and must not imply demand. Balanced accepts either route and prioritizes companies passing both. Discovery query order follows the saved priority.

Opportunity score weights commercial fit (30), verified signals (25), evidence (20), timing (15) and value (10). Lookalike score weights supported reference-dimension coverage (70), commercial fit (20) and evidence (10). These are rule-based qualification scores, not purchase probabilities or calibrated predictions. Missing evidence remains unknown. No company receives an automatic starting score.

All thresholds retain identity, target market, commercial fit, readable official evidence, independent corroboration, exclusions and CRM lifecycle checks. Actual official-source verification and research timestamps must be fresh; a new run timestamp cannot refresh cached evidence. Paused reference models cannot qualify the lookalike route. Existing unsupported numeric thresholds migrate to 80; new settings accept only 70/80/90.

Regression coverage includes route-specific qualification, threshold boundaries, cached verification, suppression, cross-industry and seller-name invariance, workspace isolation, save/reload, approval invalidation, and the full lookalike path through verified buyers and sourced message generation. Provider calls and sending are mocked in tests. Production release checks do not constitute authenticated customer acceptance.

Company discovery cards offer Select for Buyers and Save in CRM. Add to Pipeline remains in the subsequent buyer/sales workflow and CRM; it is not a prerequisite for buyer research. Existing pipeline records are preserved.
