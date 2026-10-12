# ERCON Companies Research Review — 2026-10-12

Evidence: screenshots of expanded Research review (4 need evidence, 29 not qualified). Visual assessment only: root causes not yet proven.

## Critical / P1
1. **Unqualified but selected for Buyers**: LKAB appears "Not qualified" yet "Selected for Buyers ✓". Do not silently remove it. Establish explicit manual override semantics, visual exception badge and audit reason, with warning of failed gates. Qualified status must not be implied.
2. **Duplicate entries**: LKAB and ABB appear multiple times in review list. Identify whether multiple search runs or differing source records, and normalize display by company/domain plus source-run history; preserve distinct evidence and all CRM data.
3. **Research gate ambiguity**: many rows simultaneously show hard buyer-fit fail, below threshold, missing signals, and "obtain two independent source families"; clarify hard fail vs lack of evidence vs stale data. "Needs more evidence" vs "Not qualified" must correspond to actual verified criteria, not merely absent sources.
4. **Paid action safety**: Recheck, Recheck all, Move to Buyers should show when they call paid providers and confirmation/usage assumptions. Avoid unannounced rechecks.

## UX / P2
5. Huge 33-row review list dominates screen. Collapsed by default, grouped into Needs evidence / Not qualified / Manually selected; add counts, search/filter and paginated or bounded rendering.
6. Four repeated reason chips per row are noisy. Show primary reason, expandable rationale.
7. Each row shows 3 repetitive actions. Use one primary action (Review) and secondary menu for Recheck / Manual override / Remove with confirmations where destructive.
8. Remove and Clear review list actions have high data-loss ambiguity: distinguish clearing review UI from deletion of CRM/evidence. Preserve records unless explicitly and safely instructed.
9. Several company names are broadly industry relevant yet have no recent buying signal: clarify that they are leads to nurture, not necessarily disqualified as future customers. Separate ICP fit from timing/readiness to contact.
10. Screenshot review lists LKAB twice and ABB twice, potential search-run carryover. Do not dedupe original evidence destructively.

## Verification
- Add tests for manually selected unqualified company, duplicate cross-run records, threshold and source-coverage semantics, no surprise paid calls, review-list clear behavior, and account persistence.
- Preserve existing LKAB buyer selection and provenance.
- No code or production mutations made during this audit.
