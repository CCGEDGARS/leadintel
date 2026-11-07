# LeadIntel parallel rescue execution charter — 2026-10-12

## Goal
Prepare a verified buyer-demo release within seven days. All work derives from PR #555 QA and decision records. Work on isolated branches; NEVER alter live Cloudflare D1, production secrets, paid API settings or outbound email during tests. Baseline production SHA 452a64100ae82182aaf85a484b5e10990943b96c. Complete verified database backup exists with owner; do not add any backup or customer credentials to Git.

## Agents / ownership / deliverables
1. **Persistence**: audit account-cache, server-bridge, workspace sync/storage and D1 API for recovered ERCON state; add tests for login/relogin, navigation and cross-account isolation. Outputs: code+tests+failure reproduction.
2. **UX Stages 1–5**: implement only well scoped simplifications from retroactive UX and stage QA, single Lookalike field, collapsed Sources/Monitoring, buyer/qualification visibility. Preserve scoring/state and all reference records.
3. **Step6 Script Guardian**: P0 investigate why automatically generated Professional live draft differs from immutable 2026-10-09 master; test DOM lifecycle/default and saved variants, 5 subject lines, message provenance; fix root cause without rewriting approved files.
4. **Step6 Writing & Follow-up**: preserve Writing Assistant agreed contextual preview/apply/reject, optional book references, no skills yet; build safe reply analysis and editable follow-up draft as independent feature; do not auto-send.
5. **Events & Delivery**: conditional Step1 event intent drives Stage6 event invitation, event script library only after approved masters; inspect Stage7, dry-run flow activation and credentials ownership; no actual sends without authorization.
6. **QA / Security / Performance**: CI runs, regression coverage, cost safeguards, detect secrets in public repo and expose no data, audit D1 reads and production health; provide reproducible failure table.

## Shared quality gates
- All changes are isolated, reviewable and testable.
- No two agents edit same files simultaneously without coordination; Step6 Script Guardian owns canonical generator, Writing agent owns assistant UI/response routes.
- Execute npm ci + node --test customer/test/*.test.js + npm run check:step6; backend npm ci && npm test.
- Run safe end-to-end test using isolated workspace, with no actual outbound mail or paid API calls.
- Coordinator merges only passing PRs; production deployment is a distinct final gate requiring smoke tests and rollback readiness.
- Every issue status must be one of Reported, Reproduced, Fixed, Tested, Deployed, Verified.
- Work mode may orchestrate tasks, but this charter alone DOES NOT start agents, incur credits or run jobs.

## Critical focus
P0 Step6 default-generator discrepancy, workspace data integrity, account isolation and messaging subject contracts take precedence. UI improvements may not destabilize existing functioning features.

## Sources of truth
PR #555 documentation: rescue baseline; consolidated ERCON QA register; retroactive stages 1–3; Strategy, Companies, Buyers and Step6 audits; Lookalike decision; Writing Assistant and event routing; Follow-Up Assistant decision.
