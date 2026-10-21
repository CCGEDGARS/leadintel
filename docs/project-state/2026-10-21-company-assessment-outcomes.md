# Company assessment outcomes — 21 October 2026

The authenticated Companies run requested five companies and retained six checked matches. Its three purchasing-fit warnings referred to separate domains: volvocars.com, volvo.com and electroluxgroup.com. The two Volvo labels were ambiguous because the alert omitted their domains. Saved review reasons were one insufficient-operating-evidence outcome and two invalid fit scores. Original model responses were not retained, so these records do not establish whether the invalid scores were null, missing or otherwise malformed.

## Root causes and correction

The model was told never to score missing operating evidence as zero, but the parser required a numeric score and confirmed offer before checking its explicit insufficient-evidence response. The contract now permits fit:null, offerId:null and empty evidence for an abstention. Parse this before numeric validation, retain a typed insufficient_evidence review outcome and its explanation, and keep the company outside qualification. This is a completed review with an evidence gap; it is not a provider transport failure. Do not repeatedly ask the same evidence to support a score. Invalid sufficient-evidence responses still receive one bounded recovery with the precise validation reason and remain technical failures if unresolved. Provider billing, authorization and transport failures retain their original treatment.

Quote choices were generated from readable operating text but checked first against raw Markdown. A valid quoteId could fail merely because its source contained links or bold formatting. Resolve and validate against the same filtered first-party text supplied to the model. Domain, source, exact-text, boilerplate, recency and qualification gates remain mandatory; invented quotes and foreign sources still fail.

Retain the typed gap through the run's fit cache, workspace normalization and CRM research snapshot. Clear superseded per-domain fit failures when a later assessment completes. Show domains and precise validation reasons in technical warnings, describe assessment failures separately from provider failures, and display evidence gaps in Search details and Research review without assigning a score. Existing checked companies, selected Buyers, manual ranking and automatic qualification thresholds are preserved.

## Verification

Regressions cover abstention without a numeric score or offer, no repeated same-evidence call, no qualification, workspace and CRM persistence, Markdown quoteId round-trip and forged quote rejection, precise recovery feedback, same-name/different-domain display, live retry state, and full-run cache retention. Full customer/backend suites, build, exact-revision production proof and authenticated saved-run recheck remain separate release gates.
