# Purchasing-fit response contract — 19 October 2026

Authenticated acceptance of release eaf71816 confirmed a one-company LKAB recheck and removal of the freshness blocker. The run read 17 evidence results but returned no accepted purchasing-fit assessment and no AI error. That release passed production proof (252 smoke checks), but did not establish a usable Swedish shortlist.

## Reproduced boundary failures

`parseBuyerFit` silently discarded semantically invalid JSON responses, so a missing assessment looked like a successful no-result run. The prompt supplied independent and official sources without telling the AI that the parser accepted only official first-party purchasing quotes. The exact-text offer and URL contract also rejected harmless formatting variation. Local reproduction using the same visible seller offer/buyer/exclusion fields proves that a valid official-source assessment does survive the runner; a profile/persistence mismatch has not been established for this workspace. The exact original raw response was not available, so do not attribute LKAB's rejected assessment to one specific parser guard.

## Changes

- Supply first-party-only quotation material and stable `sourceId` values, resolved back to their exact official URLs. Independent corroboration remains required by company qualification.
- Supply stable `offerId` choices resolved to the exact confirmed offer. Preserve compatibility with validated legacy `purchase` / URL responses.
- Normalize numeric JSON text without accepting empty, nonnumeric, boolean or out-of-range scores.
- Preserve a bounded, explicit rejection reason through fit caching and review save/reload.
- Report semantic rejection as `BUYER_FIT_EVIDENCE_REJECTED` for the affected companies, retaining successful assessments in the same batch. This enables the existing purchasing-fit-only retry rather than pretending the check completed or repeating website acquisition.
- Keep exact quote validation, first-party attribution, exclusions, independent corroboration, freshness and qualification thresholds unchanged. Unknown offer/source IDs fail closed.

Focused regressions cover the contract, canonical IDs, honest partial failures, numeric normalization and persisted rejection reasons. Full-suite, production proof and authenticated acceptance are recorded separately.

Validation before publication: 3,014 customer tests and 688 backend tests passed; two additional review regressions (stale retry issues and malformed sibling isolation) passed in a fresh 21-test qualification run. Production build and source checks passed. Independent review found no remaining critical/important issues. Exact-commit CI and authenticated acceptance remain required.
