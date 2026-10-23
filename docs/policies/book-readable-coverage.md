# Writing book readable coverage

User rule, 23 October 2026: at least **80% readable pages** is enough to use a successfully analysed book. Missing pages alone do not require acknowledgement at or above this inclusive threshold.

- Completed analysis at 80% or higher becomes **Ready**, eligible for explicit activation. No automatic activation or sending.
- Below 80%, retain the existing review/accept-readable-pages path.
- Keep original files, page locations and accurate readable/unreadable counts. Retrieval only uses readable source content.
- Existing eligible `Needs attention` books are durably reconciled when listed or opened. Recovery is workspace-scoped, idempotent, and atomically advances source, slot and workspace revisions without changing active selection.
- Do not invoke native PDF recovery merely to fill missing pages once deterministic extraction meets 80%. Sparse text is an independent quality concern.
- Native/vision extraction review, failed/incomplete analysis, unavailable source objects and invalid coverage counts retain their independent checks.

Implementation: `backend/src/writing-reference-coverage.js`, used by extraction, completed analysis and stored-book recovery. Regression coverage includes the exact boundary, 79%, full coverage, malformed counts, prior uploads, isolation, save/reload, explicit activation, unchanged originals, and native extraction provenance.
