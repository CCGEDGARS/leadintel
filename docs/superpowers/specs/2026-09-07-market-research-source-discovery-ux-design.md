# Market Research Source Discovery UX — Design

**Date:** 2026-09-07

## Purpose

Make Market Scan, Market Research and Market Intelligence behave like three genuinely different intelligence depths rather than three variations of the same search preview. The user must be able to understand the difference immediately, trust what is shown before research, and see source recommendations only when LeadIntel has actually discovered evidence for them.

## Governing state model

LeadIntel must keep four states distinct:

1. **Known** — Company Brain / user-approved facts already available before market research.
2. **Planned** — what LeadIntel intends to search and which source categories it intends to use.
3. **Researched** — public evidence returned by a completed research run.
4. **Verified** — researched evidence that has passed the normal verification/extraction path.

Pre-research UI must never present a numeric opportunity score, opportunity conclusion, or a specific site as if it has already been researched.

## Research mode UX

### Market Scan

Primary button label: **Market Scan**

Readable description beneath the button:

> Fast validation of the strongest buying signals and opportunities in your selected market.

Behavior:
- LeadIntel chooses source categories and source sites automatically.
- No pre-run specific-site recommendation list is shown.
- The review panel shows the planned scope, broad source categories and how the scan works.
- It remains the fastest bounded mode: 4 queries, 5 results/query, 20 stored evidence sources maximum.

### Market Research

Primary button label: **Market Research**

Readable description beneath the button:

> Deeper research across companies, market activity, news, hiring, expansion and other relevant sources.

Behavior:
- Before the full run, LeadIntel performs a lightweight **source discovery** pass using authenticated OpenAI web search.
- The source-discovery result is a list of up to 8 unique source sites derived from live web-search results, not a static country catalog.
- Each source shows why it is relevant based on the returned search-result context.
- User can select sources and add them to direct-check/monitoring sources using the existing custom-source mechanism.
- If source discovery is unavailable, LeadIntel says so explicitly and continues to show the research plan without inventing recommendations.
- Full research remains bounded to 12 queries, 8 results/query, 80 stored evidence sources maximum.

### Market Intelligence

Primary button label: **Market Intelligence**

Readable description beneath the button:

> Comprehensive investigation across multiple source types to uncover opportunities, patterns, competitors and hidden signals.

Behavior:
- Before the full run, LeadIntel performs wider live source discovery.
- Up to 15 unique source sites may be displayed.
- Sources are grouped into a **Source Intelligence Map** with categories such as official/company, hiring, news/media, registries/data, industry, technology and growth/investment.
- User can select individual sources to add for direct checking and monitoring.
- If source discovery is unavailable, no static fallback is presented as a recommendation.
- Full intelligence remains bounded to 24 queries, 10 results/query, 200 stored evidence sources maximum.

## Source discovery rules

Source discovery must be evidence-backed:
- Use the authenticated workspace OpenAI web-search endpoint already used by Market Research.
- Search from the approved Company Brain context: target market, priority offers/commercial focus, ICP/buyer context and active buying signals.
- Convert returned result URLs to canonical site origins before presenting them as source sites.
- Deduplicate by hostname/origin.
- Never recommend a site solely because the selected geography is Latvia/Baltics.
- Do not silently fall back to the old static Latvia catalog (LSM, Dienas Bizness, etc.). Those sites may still appear if live discovery finds evidence that they are relevant.
- Tender/procurement remains excluded unless an active tender signal explicitly enables it.
- Credentials remain server-side and workspace-scoped; no API key is exposed in browser UI.

## Pre-research market card

Before live research:
- Headline is the selected geographic market only (for example **Latvia** / **Latvija**), not `Latvia: <all offers>`.
- Show Company Brain context separately:
  - **Commercial focus** — concise priority offers/focus.
  - **Target customers** — concise approved/inferred ICP.
- Show **Not researched yet** status.
- Do **not** show `0/100` or any numeric opportunity score.

After live research:
- Existing researched opportunity cards may show the evidence-derived 0–100 score and detailed score components.

## Review panel

The review panel remains mandatory before starting a research run.

Before any run, it may show:
- mode name;
- scope/cost bounds;
- planned source categories;
- how it works;
- planned searches;
- source-discovery state appropriate to the selected mode.

It must not show:
- opportunity scores;
- market conclusions;
- unresearched companies as findings;
- static sites labelled as AI recommendations.

## Compatibility

- Preserve saved `researchMode` values: `quick`, `deep`, `intelligence`.
- Preserve existing `researchCustomSources`, monitoring sources, history and tender gating.
- No state migration is required.
- Existing custom URLs continue to be checked directly.

## Implementation boundary

Use a focused browser module `customer/market-research-ux.js` rather than expanding the already-large `customer/app.js`. The module may augment the existing market runtime and DOM after render, while pure helper functions remain CommonJS-testable.

The module will be loaded from the existing small `customer/evidence-view.js` browser bootstrap, following the already-proven Company Brain dynamic-import pattern.

## Acceptance criteria

1. Three buttons read exactly `Market Scan`, `Market Research`, `Market Intelligence` when idle.
2. Each button has its own clearly readable description directly beneath/with the button.
3. Pre-research profile-only market cards contain no `/100` score.
4. Pre-research market headline is market geography, with commercial focus and target customers shown separately.
5. Market Scan shows no specific recommended-site list before it starts.
6. Market Research can discover and show up to 8 deduplicated live source sites.
7. Market Intelligence can discover and group up to 15 source sites into the Source Intelligence Map.
8. No hardcoded Latvia source list is presented as dynamic AI recommendation.
9. Source discovery failure produces an honest unavailable state, not invented recommendations.
10. Existing research execution, workspace auth, tender exclusion, custom sources, monitoring and release-integrity paths remain green.
11. `docs/market-research-and-monitoring.md` is updated so this behavior becomes the maintained product rule.
