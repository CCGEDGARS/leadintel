# Book readable coverage implementation plan

**Goal:** A successfully analysed book with at least 80% readable pages is eligible for activation without acknowledging missing pages. Apply the same rule to existing uploaded books.

**Architecture:** One backend coverage policy controls completed analysis and recovery of older `Needs attention` records. Persist recovered status and bump source, slot and workspace revisions atomically. Keep missing-page counts and original files. Extraction review remains independent; activation stays explicit and workspace-scoped.

**Approved requirement:** User instruction on 23 October 2026: “if the book is readable for 80% it is good enaugh to apply”. This implements the coverage rule only; no automatic activation, sending or changes to approved scripts.

## Task 1 — Coverage policy and existing-source recovery

- [x] Add behavioural regression tests for exactly 80%, above 80%, below 80%, native extraction review, existing uploads, persistent/idempotent recovery, invalid coverage, workspace isolation, and inactive sources.
- [x] Observe expected failure using `node --test backend/test/writing-reference-coverage.test.mjs`.
- [x] Add `backend/src/writing-reference-coverage.js`; use it in `writing-reference-runner.js` and `writing-reference-store.js`. Skip native recovery for missing pages when deterministic text meets 80% coverage; retain the independent sparse-text quality check.
- [x] Run the regression file and existing writing-reference tests.
- [ ] Document the rule, run backend/customer suites, and verify the exact release SHA through the repository release-integrity workflow.
