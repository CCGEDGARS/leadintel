# Native Storyselling correction — implementation report

Status: implemented on `feature/storyselling-native-templates`; no push, merge, outreach or release claim. Parent owns review, exact-SHA full CI, authenticated browser checks and release proof.

## Delivered

- Restored the ordinary Writing Assistant, including optional books, instructions and normal explicit preview/apply/save. The separate story style/purpose/example/objection controls and bank are no longer mounted or imported into runtime.
- Added separately authorized shared native masters for Email, LinkedIn DM and Phone call, plus the four-stage paid LinkedIn InMail sequence. Shared source is `customer/storyselling-native.js`; server catalogue and browser use that exact authority. The four existing canonical masters and backend seed files were not changed.
- Storyselling follows normal template selection, deterministic personalization, working copy, subject choice, Undo, first-original/history and CRM serialization. Seller offer/problem/value, buyer role/company and reviewed reason are used. Prefixes such as “As Head…” are normalized. Missing seller facts preserve the current draft with an actionable error. Missing booking URL uses the normal review marker rather than blocking creation or inventing a URL.
- Zero company references/cards works through an explicit hypothetical scene with an obstacle, sequence, action and resolution. No dates, client names, results or quotations are invented as historical facts. Fourteen types and detailed source policy templates remain internal assistant guidance.
- Native explicit ordinary assistant revisions use normal relevant company PDF/image evidence retrieval, passage citations and stale-reference checks. A website never establishes customer success. Legacy card APIs, records and historical receipts remain available; old receipts no longer silently force ordinary revisions into card-based generation.
- Phone template replacement now retains bounded Undo history and its first tailored original, including through the existing exact workspace/user/company/contact CRM draft endpoint. History is limited to 20 entries; the phone endpoint alone allows a bounded larger request to accommodate them.
- Refreshed discovery → outreach → changed-module loader URLs, and replaced obsolete bank/launcher mandatory release smoke assertions with native-source/ordinary-assistant checks. Authentication/legacy backend smoke gates remain.

## Tests and evidence

Initial red regressions: `node --test customer/test/storyselling-native.test.js` failed before implementation on absent native templates and missing-field behavior.

Final passing focused commands (run from repository root unless noted):

1. `node --test --test-concurrency=2 customer/test/storyselling-native.test.js customer/test/message-studio.test.js customer/test/inmail-factual-frames.test.js customer/test/linkedin-inmail.test.js customer/test/storyselling-entry.test.js customer/test/release-integrity-policy.test.js` — 38 passed.
2. `node --test --test-concurrency=2 customer/test/channel-scripts.test.js customer/test/channel-scripts-integration.test.js customer/test/storyselling-entry.test.js customer/test/storyselling-native.test.js` — 26 passed; existing jsdom `window.scrollTo` diagnostic is non-fatal.
3. `node --test --test-concurrency=1 customer/test/linkedin-inmail.test.js customer/test/storyselling-native.test.js` — 9 passed after the last native InMail optional-reason fix.
4. From `backend`: `node --import ./test/register-wasm-loader.mjs --test --test-concurrency=2 test/storyselling-native.test.mjs test/channel-script-library.test.mjs test/writing-assistant.test.mjs test/inmail-script-library.test.mjs test/storyselling.test.mjs` — 44 passed.
5. From `backend`: `node --import ./test/register-wasm-loader.mjs --test --test-concurrency=1 test/channel-script-library.test.mjs test/storyselling-native.test.mjs` — 13 passed after the bounded phone-history payload change.
6. Broader customer regression run covering channel integration, assistant UI/controller, canonical verbatim contracts/core rules and legacy Storyselling: 75/76 initially passed; the only failure was the old four-InMail inventory, corrected and covered by command 1. A subsequent 59-test run exposed two further old-inventory assumptions, both corrected while keeping all four canonical-source assertions, and covered by command 1.
7. `npm run build` — passed, including standalone discovery bootstrap/bounded runtime/startup checks. Final build repeated after loader/content corrections.
8. `git diff --check` — clean. `git diff -- customer/approved-reference-scripts.js backend/src/core-script-seeds.js backend/src/phone-script-seeds.js backend/src/inmail-script-seeds.js` — empty, proving the four existing masters/seeds were not edited.

New regressions cover no-card operation, all native channels, body-only direct LinkedIn/phone, role normalization, seller-specific hypothetical scenes, reviewed reason preservation, optional-book ordinary interface, missing-link review state, native subjects, exact-source backend catalogue, seller/buyer isolation, native CRM history/reopen, legacy receipt reopen, no receipt-driven card reuse, InMail stage gates, and phone CRM history/isolation/stale saves.

## Review/limits

Self-review checked the native loader order, server/browser authority, ordinary assistant payload, preservation of canonical source files, legacy storage compatibility, subject rendering, and phone history limits. Human factual review remains necessary for free-form assistant revisions; prompts plus existing numeric/link/identity/source validators are not a full semantic truth proof. Deterministic fallback does not turn company references into success claims. Full customer/backend suites and real authenticated customer UI remain the parent's exact-SHA CI/browser gates. No production completion is claimed here.

Design: `docs/plans/2026-10-26-storyselling-native-correction.md`.

## Review corrections after `27924a70`

Addressed findings 1–3 in `task-1-review.md`:

1. Extracted shared native required-field validation and invoked it in InMail preparation before a replacement sequence can be returned or assigned. Missing sender/company/offer now raises the normal actionable message, preserving an existing manual sequence. The optional booking-link behavior remains unchanged.
2. Phone template snapshots now clone the exact existing `writingAssistant` receipt with its corresponding text. Undo restores that historical receipt or explicitly removes any newer receipt when the old text had none; it cannot run during a pending operation. CRM historical entries and first originals validate attribution using the same workspace/schema/citation checks as current receipts and preserve the complete validated object. Phone-only bounded payload allowance is 500,000 characters to accommodate the existing 20-entry text history together with bounded source receipts; other script payload limits remain 40,000. Tests cover source-backed draft → template → Undo → save/reopen and template → newer assistant edit → Undo → save/reopen, plus malformed/foreign historical receipt rejection.
3. Allowed the separately authorized `storyselling` IDs in platform-owner core edit/delete routing for email, direct LinkedIn, phone and InMail. Customer writes remain forbidden and the four existing canonical masters/permissions remain unchanged.

Refreshed the changed module loader chain to `native-storyselling=20261026-v2` / `storyselling-native.js?v=20261026-native-v2`, including its matching mandatory release smoke expectations.

Review regression evidence:

- Red: `node --test --test-concurrency=2 customer/test/linkedin-inmail.test.js customer/test/linkedin-inmail-ui.test.js customer/test/channel-scripts-integration.test.js` — 18 passed, 4 new failures reproduced both InMail missing-field paths and both phone receipt defects before fixes.
- Red, from `backend`: `node --import ./test/register-wasm-loader.mjs --test --test-concurrency=1 test/channel-script-library.test.mjs` — 11 passed, 2 new failures reproduced rejected native core mutation and stripped historical attribution before fixes.
- Green: `node --test --test-concurrency=2 customer/test/linkedin-inmail.test.js customer/test/linkedin-inmail-ui.test.js customer/test/channel-scripts-integration.test.js customer/test/storyselling-native.test.js` — 26 passed, 0 failed. Existing jsdom `window.scrollTo` diagnostics remain non-fatal.
- Green, from `backend`: `node --import ./test/register-wasm-loader.mjs --test --test-concurrency=2 test/channel-script-library.test.mjs test/storyselling-native.test.mjs` — 15 passed, 0 failed; repeated after the final bounded receipt payload adjustment.
- `npm run build` — passed after the review fixes and loader refresh, including discovery startup checks.
- `git diff --check` — clean. Four canonical source/seed files remain unchanged.

No push, publication, merge or release action was taken. Parent retains exact-SHA full CI and authenticated browser/release verification.

## Consolidated whole-branch review and CI correction after `546dd406`

Addressed all findings in `final-review.md` and every root listed in `ci-failures.json`:

- The assembled direct LinkedIn style action now uses the shared native deterministic renderer before the general AI path. It retains the normal recipient/workspace/channel/busy/factual gates, preserves required-field failures without replacement, and records the exact previous manual body/attribution through existing template Undo, first-original/history and CRM serialization. Native replacement clears the replaced receipt from the new body while retaining it in Undo. The existing Undo control is visible when a recoverable update exists. The new regression installs the real channel-library module, resolves the builtin catalogue, clicks the actual native style button, verifies no `/api/ai/generate` request, compares exact mandatory-source output, saves through the CRM package adapter, reopens and restores the exact manual text. Email text and no-send boundaries are checked in the same flow.
- InMail style selection and Apply facts now retain up to five complete prior sequence snapshots plus the first tailored sequence. Snapshots include all four exact subjects/bodies, stage attribution, source metadata, facts and checks without recursively nesting history. Undo sequence change restores a complete snapshot and requires the same current scope/facts. Current and historical stage receipts are independently validated on the backend; foreign attribution, excess history and nested histories are rejected without modifying the saved revision. The InMail-only request limit is bounded at 250,000 characters while every current/historical sequence retains the existing 30,000-character limit. Source history is preserved as historical attribution, not automatically retrieved/current evidence.
- Native templates now use noun/infinitive-compatible frames (`The aim: …`, `The obstacle: …`) and normalize only terminal field punctuation. Singular and plural problems and infinitive benefits retain their exact facts without subject/verb disagreement or “aiming for make …”.
- Native styles append to the existing email/LinkedIn default arrays without changing their initial entries. Style painting uses only real options and deduplicates by ID. The initial studio select also includes the real native option. Canonical email, LinkedIn and phone source assertions remain; native inventories are tested separately. Legacy InMail unresolved-placeholder tests retain their original assertions, while native missing required fields assert the intended failure.
- Restored the existing `discovery-ui.js?v=…` query prefix, appending the native cache marker. Production-watch serves the native asset, and the VM InMail integration loads its native dependency before consumers. Final loader chain uses `native-storyselling=20261026-v3` and `storyselling-native.js?v=20261026-native-v3`; mandatory smoke expectations match, including conditional recoverable Undo.

Exact targeted evidence:

1. Red: `node --test --test-concurrency=2 customer/test/storyselling-native.test.js customer/test/linkedin-inmail-ui.test.js` — 19 tests, 14 passed and 5 failures reproduced the missing InMail sequence history, prepended LinkedIn default, phrase-shape errors and both actual direct-message routing/preservation paths.
2. Red, from `backend`: `node --import ./test/register-wasm-loader.mjs --test --test-concurrency=1 test/inmail-script-library.test.mjs test/phone-script-masters.test.mjs` — 10 tests, 8 passed and 2 failures reproduced unvalidated sequence history and the old phone inventory.
3. Green: `node --test --test-concurrency=1 customer/test/storyselling-native.test.js` — 8 passed, 0 failed, including the final real channel-library click/save/reopen/Undo regressions and missing seller facts.
4. Green: `node --test --test-concurrency=2 customer/test/storyselling-native.test.js customer/test/linkedin-inmail-ui.test.js customer/test/discovery-production-watch.test.js` — 30 passed, 0 failed, covering native content, complete InMail history/attribution/checks, bounded history, Apply facts/Undo and the fixed production-watch fixture.
5. Green, from `backend`: `node --import ./test/register-wasm-loader.mjs --test --test-concurrency=2 test/inmail-script-library.test.mjs test/phone-script-masters.test.mjs test/storyselling-native.test.mjs test/channel-script-library.test.mjs` — 26 passed, 0 failed.
6. CI-root verification: `node --test --test-concurrency=2 customer/test/discovery-bootstrap-resilience.test.js customer/test/discovery-production-watch.test.js customer/test/discovery-research-budget.test.js customer/test/outreach-brand-snapshot.test.js customer/test/premium-ux-redesign.test.js customer/test/server-bridge.test.js customer/test/spinner-hard-stop.test.js customer/test/typography-v2.test.js customer/test/writing-assistant-release.test.js` — 73/74 passed; the sole remaining obsolete smoke assertion required Undo to stay permanently hidden. It was corrected to the actual recoverable Undo condition and its production-watch file passed in commands 4 and 8. All other listed asset/bootstrap CI roots passed this run.
7. Functional-root verification: `node --test --test-concurrency=2 customer/test/storyselling-native.test.js customer/test/linkedin-inmail-ui.test.js customer/test/linkedin-inmail-integration.test.js customer/test/inmail-factual-frames.test.js customer/test/linkedin-core-styles.test.js customer/test/message-workspace.test.js` — 56/58 passed; only two new test-fixture issues remained (cross-realm object comparison and a non-global storage-key identifier). Both fixtures were corrected and passed in commands 3 and 4. All existing inventory/workspace/VM integration roots passed this run.
8. Final safety verification after cache/smoke refresh: `node --test --test-concurrency=2 customer/test/explicit-message-controls.test.js customer/test/storyselling-entry.test.js customer/test/discovery-production-watch.test.js` — 32 passed, 0 failed, including all four canonical style click/save/reopen controls, ordinary assistant interface, generation race safeguards and production proof fixtures.
9. `npm run build` — passed after the final implementation/cache refresh; standalone discovery bootstrap/startup checks passed. `git diff --check` is clean. Base-to-head source diffs for the four canonical master/seed files remain empty.

No known failing targeted check remains. No redundant local full-suite run, push, merge, publication or production claim was made; parent owns exact-head full GitHub CI, review and authenticated release proof.
