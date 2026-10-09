# Saved companies and buyers recovery — 9 October 2026

## Root cause and customer evidence

An existing company recheck moved previously qualified targets into Research review. `buyerSelectionRows` allowed a previously qualified selection only while its current candidate remained eligible and did not need rechecking. That hid the selected company and its retained buyer evidence. Qualification changes must not undo an explicit company selection.

The authenticated customer view retained 16 company research-review records. Master CRM showed six companies: LKAB, Polestar, Boliden, Billerud, Modvion and Mural. LKAB could be reselected through the existing review action, restoring four priority buyers and six other buyer identities, including the previously selected recipient. The existing Save buyer research in CRM action returned a successful save confirmation.

The workspace separately reported that it exceeded the 500 KB sync ceiling. That error is not evidence that CRM records were deleted. The recovered buyer research was saved using the independent CRM path. Full workspace sync remains unresolved; do not claim that a local selection was saved to the cloud.

## Prevention change

Explicit selections whose domains remain in current candidates or Research review continue to appear in Buyers after rechecking. Stale qualified selections absent from the current search remain excluded. Suppressed companies remain excluded. No CRM pipeline history is silently imported, and no qualification or contact-confirmation requirement is relaxed.

Failed workspace saves expose Download recovery copy. The export preserves the current unsynced workspace data and only a saved baseline belonging to the same workspace. It does not overwrite the acknowledged cloud baseline or include unrelated browser credential keys.

## Verification boundaries

Behavioral regression tests reproduced both hiding paths before the fix. Additional checks cover stale search isolation, suppression, unsynced buyer export, baseline retention and credential-key exclusion. Run the complete customer test suite and static build before publishing. Exact-SHA release proof and authenticated save/reload verification remain required before describing this change as fixed in production.

No outreach was sent.
