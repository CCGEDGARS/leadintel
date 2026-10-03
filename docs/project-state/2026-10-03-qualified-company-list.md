# Qualified company list — 3 October 2026

## Decision
Discovery modes are exclusive: Lookalike discovers reference-customer analogues then enriches their signals; Signals discovers demand events without reference searches; Balanced combines both with a 60/40 query target. A query allocation is not a guaranteed result quota. One deduplicated qualified list ranks total score first, buyer fit second, signals third. Nonqualifiers appear only in collapsed research diagnostics and cannot enter automatic buyer/outreach flow.

## Qualification
Buyer fit contributes 0–70 and recent relevant buying signals 0–30. Default threshold is 80, mandatory buyer fit minimum 50. Saved owner thresholds 70/80/90 remain configurable. Identity, target market, official evidence, independent corroboration, evidence freshness, exclusions and workspace CRM lifecycle remain mandatory. Lookalike additionally needs a strong evidence-backed reference-customer match. No signal means monitor, not automatic qualification.

An AI assessment must identify an exact confirmed offer and a concrete purchasing application, cite an exact official company quote, distinguish customer from supplier/competitor, and mark inferred needs. Signal relevance must be grounded in supplied event URLs. Invalid quotes or offers earn no purchasing assessment. Changing offers, buyer targeting, markets or exclusions invalidates previous assessment context. Invalid replacement research clears stale assessments. Neither fit nor signals imply guaranteed buying intent or profit.

## Connected paths
Manual Companies and approved server workflows share purchasing research, scoring and qualification. CRM snapshots retain purchasing reasoning and score breakdown. Save/reload retains evidence and reference quote mappings. Automatic approvals use qualification version 3, invalidating old downstream approvals before further automatic sending. Cache keys refresh changed runtime modules.

## Research limits
Adaptive follow-up is bounded by configured query/provider/run budgets. Qualified shortfalls are reported explicitly; weak candidates never fill the quota. Missing AI/provider/evidence paths fail closed. Current implementation uses evidence quotation validation plus AI commercial reasoning, not a guarantee of perfect commercial judgment.

## Validation and acceptance
Run full customer/backend suites, static build and syntax checks. Release requires exact-SHA CI, matching live manifest, health and mandatory smoke proof. Real signed-in workspace search/acceptance is separate from mocked provider tests and public release checks. No outreach is authorized or sent by this implementation task.
