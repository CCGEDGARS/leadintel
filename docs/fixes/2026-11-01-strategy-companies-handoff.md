# Strategy → Companies: explicit research handoff

Owner request: 1 November 2026. Continuing from reviewed Strategy must produce company research/results, rather than only opening an unchanged Companies screen.

## Root cause

`activateMarketStrategy` saved approval and called the navigation-only Discovery API. Its success message said Companies were ready even when no research had started. Separately, the Companies badge displayed the last run's stored `complete` status despite stale qualification, the approval blocker was hidden behind a generic refresh message, and the empty state claimed selected companies remained even when none were selected. The progress model could also count a globally stale shortlist as reviewed.

## Resulting behavior

The existing review dialog now explains the saved target amount, bounded Firecrawl call ceiling and connected-provider billing, preservation of saved work, and manual buyer selection. After local and acknowledged workspace persistence, explicit confirmation opens Companies and calls `startFromStrategy`:

- A current completed checked shortlist is reused without new provider work.
- An existing run is observed without a duplicate dispatch.
- Missing/stale/incomplete results start the existing bounded company-discovery pipeline once. Existing qualification, provider, cancellation, account/Strategy ownership and research-budget gates still apply.
- A blocked or unavailable startup has explicit recovery feedback. Acknowledged Strategy approval is retained when research startup fails.

Ordinary sidebar navigation, reopening, reload and CRM hydration stay read-only. This action never selects buyers, enriches contacts or sends outreach. A requested company amount is a target, not permission to invent matches or weaken qualification.

The header distinguishes research running, Strategy review, stale evidence, no checked companies and checked companies awaiting selection. Global stale state cannot complete verification/review in the progress model. The zero-selection empty state no longer claims retained selections.

## Prevention and verification

Behavioral regressions exercise acknowledged-save ordering, duplicate confirmation, missing/throwing research startup, reuse, stale-run dispatch, existing-run attachment, retained evidence, approval gates, truthful status and globally stale progress. Existing context-race tests retain protection against changed users, workspaces and Strategy revisions. Static cache keys change only for the affected app, Discovery and journey entry assets. Three new mandatory release checks verify the entry and both handoff runtimes.

Run customer tests from repository root, backend tests from `backend` with its WASM loader, the static build and syntax checks. Check exact-SHA CI, manifest/backend and downloaded `release-proof.json` before production claims. Authenticated production research must be observed separately; fixture tests do not prove real company quality or provider yield.

Rollback: revert this change. Saved research and CRM records use existing schemas; no migration or destructive data operation is introduced.
