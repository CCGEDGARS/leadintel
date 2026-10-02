# Profile Review consistency repair — 2 October 2026

## Confirmed causes

The customer's screenshots show an industrial offer, a sales/HR-role warning, a missing commercial objective, an inferred customer problem and 100% Information completeness.

Regression tests reproduced these causes:
- Profile Review inherited the questionnaire completeness percentage, although it displayed a separate eight-field canonical diagnosis.
- Canonical customerPainPoints had no mapping to the supplied buying_outcomes answer, so the supplied answer could lose to generic inferred pain.
- Commercial goals moved to workspaceGoals.successOutcome, but the canonical source reconciliation still read the retired success_outcome questionnaire field and mislabeled any compatible fallback as website evidence.
- Buyer-role repair ran only in Strategy and did not reconcile the current canonical record and the targeting answers. The industrial mismatch rule also rejected HR when workforce services made that function relevant.
- A later-installed readiness wrapper could overwrite canonical compatibility values and restore the stale questionnaire score.
- Profile edits changed visible canonical values without updating the corresponding targeting answers or workspace goals, permitting drift after reload/downstream qualification.

## Correction

Review completeness derives from the same canonical known/review/missing diagnostics displayed on the page. Evidence coverage remains a separate measure; 100% review completion is not a claim of full evidence verification.

Supplied customer problems retain their answer provenance. Existing commercial objectives are sourced from workspace goals as user configuration. When absent, the system proposes only an operational objective based on the selected markets, marked Needs confirmation; it does not invent numeric targets, revenue or guarantees.

Industrial buyer functions are suggested from the active offer and classification, preserving compatible functions and HR for workforce services. Replaced roles and their original values are retained in the canonical repair metadata; suggestions require review. Migration aligns targeting answers and ICP buyer roles, invalidates approval and retains research results. The confirmation action commits reviewed context into the shared targeting source without authorizing sending. Saved edits also update that source. Legal, furniture and sales-training fixtures confirm customer portability.

Profile context version 3 and a versioned session migration marker refresh older in-memory profiles once. Explicitly empty reference libraries are not repopulated from retired lookalike answers. Cache keys update the changed entry and dependency chain.

## Verification

Eight behavioral regressions exercise score agreement, supplied problems, role relevance, goals/provenance, reload and downstream buyer-role state, cross-industry preservation, profile approval and late readiness installation. Initial failures were observed before the corresponding corrections. Full customer suite: 1,370 passing. Syntax and static build checks pass. Exact-SHA CI and production proof follow publication. These tests do not claim real company/buyer research or automatic email acceptance in the authenticated customer account.

## Prevention

One field model must govern review, score, approval and downstream context. Retiring an intake field requires updating its canonical source mapping. Test extension load order as well as reload; a wrapper must not overwrite an already canonical value. A suggested operating objective is configuration requiring review, never externally verified evidence.
