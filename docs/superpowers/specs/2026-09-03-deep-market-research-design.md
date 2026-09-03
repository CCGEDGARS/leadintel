# LeadIntel Quick + Deep Market Research Design

Date: 2026-09-03
Status: proposed for implementation after user review
Branch: feat/deep-market-research

## 1. Goal

Replace the single ambiguous Market Strategy research action with two explicit research modes:

- **Quick Research** — fast, bounded public-web evidence collection using the existing OpenAI Web Search + Firecrawl path.
- **Deep Research** — iterative multi-source market intelligence using OpenAI Web Search + Firecrawl + Scrapling fallback, deeper extraction, repeated gap-driven queries, source-quality scoring, and transparent progress/provenance.

The system must never describe a profile-only hypothesis as though live research already ran.

## 2. Current behavior to preserve

The current Market Strategy flow already supports:

- up to 4 research queries;
- OpenAI Web Search discovery through the authenticated `/api/ai/web-search?workspace_id=...` endpoint;
- Firecrawl search/verification for every research query;
- canonical-URL deduplication and provider provenance;
- evidence-backed opportunity scoring;
- fail-closed behavior: when no live evidence exists, LeadIntel keeps a low-confidence hypothesis instead of inventing support;
- no Apollo contact enrichment during Market Strategy research.

This existing path becomes **Quick Research** rather than being removed.

## 3. UX

### 3.1 Buttons

Replace the single `Run market research` action with two adjacent actions:

1. **Quick Research**
   - helper text: `OpenAI Web Search + Firecrawl · fast`
   - intended for fast validation and routine refreshes.

2. **✦ Deep Research**
   - visually primary/emphasized when evidence is weak;
   - helper text: `Multi-source · iterative · maximum evidence`;
   - intended for first-time strategy building, market-entry analysis, weak-evidence opportunities, or manual analyst-quality investigation.

### 3.2 Research-not-run state

Before either mode has run, opportunity cards must say:

- `Profile hypothesis — research not run yet`

They must not say `No public evidence was returned` until a live research attempt has actually completed and returned zero usable evidence.

### 3.3 Progress visibility

Quick Research shows compact progress:

- OpenAI discovery
- Firecrawl verification
- usable evidence count

Deep Research shows a live research ledger, for example:

`Deep Research · Pass 2/3 · 14 searches · 32 pages examined · 18 usable sources`

and per-source/provider states:

- OpenAI Web Search
- Firecrawl Search
- Firecrawl Scrape/Crawl
- Scrapling fallback

### 3.4 Completion summary

Deep Research completion should expose at minimum:

- research themes generated;
- total queries attempted;
- pages/results examined;
- usable evidence sources;
- primary/official sources;
- corroborated sources;
- providers used / unavailable;
- elapsed time;
- research stopped because coverage threshold was reached, max passes were reached, or no meaningful new evidence was found.

## 4. Quick Research contract

Quick Research remains intentionally bounded:

- maximum 4 generated queries;
- up to 5 OpenAI Web Search results per query;
- up to 5 Firecrawl results per query;
- merge/deduplicate by canonical URL;
- preserve source-provider provenance;
- keep at most the current bounded evidence/result budget;
- do not invoke Scrapling;
- do not recursively crawl discovered sites;
- do not invoke Apollo;
- one provider failure must not erase evidence collected by the other provider.

Quick Research should normally complete in seconds.

## 5. Deep Research architecture

Deep Research is a backend-orchestrated research run rather than a larger browser loop.

### 5.1 Research plan generation

Create multiple query families from the current Company Intelligence Profile, selected markets, active ICPs, active signals, and commercial objective.

The first pass should cover distinct commercial themes such as:

- product/service demand;
- company expansion / new facilities;
- investment / capex;
- procurement / tenders;
- hiring / workforce growth;
- relocation / fit-out / modernization;
- regulation / compliance change;
- distributor / reseller / partner searches;
- management or ownership change where commercially relevant;
- competitor activity;
- industry-specific buying triggers;
- public-sector / education / institutional demand where relevant;
- market-entry barriers and exclusions.

The orchestrator must not blindly execute every theme. It should select only themes relevant to the current profile and market.

### 5.2 Pass 1 — broad discovery

For each selected query family:

- run OpenAI Web Search for current source-backed candidate evidence;
- run Firecrawl Search independently;
- merge and canonicalize results;
- discard unsafe/non-HTTP(S) URLs;
- classify source type and likely quality.

### 5.3 Deep extraction

For promising URLs:

- use Firecrawl Scrape for the target page;
- use Firecrawl Map/Crawl only when the domain is promising and deeper site sections are likely to contain relevant evidence;
- bound crawl depth/pages to prevent runaway usage;
- extract readable text, publication/update date when available, organization/domain, and supporting passage/summary.

### 5.4 Scrapling fallback

Scrapling is a fallback extraction engine, not the first-line search engine.

Use Scrapling only when:

- a high-value public URL was discovered;
- Firecrawl could not retrieve usable content or returned incomplete content;
- the domain is permitted by the public-URL safety policy;
- the request remains within configured time/page budgets.

A Scrapling failure must not erase evidence from OpenAI or Firecrawl.

### 5.5 Gap analysis and iterative passes

After each pass, calculate evidence coverage by market, opportunity, active signal, and research theme.

Generate follow-up queries only for material gaps, for example:

- a high-priority signal has no supporting evidence;
- a promising opportunity has only one weak source;
- evidence exists but is old;
- evidence comes only from aggregators rather than first-party/official sources;
- the initial query was too broad or ambiguous.

Run at most a bounded number of passes. Initial implementation target: **maximum 3 passes**.

Stop early when either:

- required coverage threshold is reached;
- the latest pass adds no meaningful unique evidence;
- time/query/page budget is reached;
- all remaining gaps are classified as unavailable/not publicly observable.

## 6. Source quality and evidence model

Each evidence item must preserve:

- canonical URL;
- title;
- publication/update date when available;
- source domain;
- source type;
- provider(s) that discovered/verified it;
- extracted supporting text/summary;
- associated market, query, signal/opportunity;
- source-quality score;
- corroboration count;
- retrieval timestamp.

### 6.1 Source-quality tiers

Recommended ranking:

1. **Primary / official** — company websites, government portals, procurement/tender systems, regulators, official company registries, official press releases.
2. **High-quality secondary** — established news, industry publications, trade associations, specialist databases with attributable reporting.
3. **Supporting secondary** — credible directories, event pages, job posts, professional-network public pages, partner announcements.
4. **Weak / discovery-only** — generic aggregators, SEO pages, unattributed summaries.

Weak/discovery-only sources may trigger further investigation but should contribute less to final Evidence score.

### 6.2 Corroboration

Independent corroboration increases confidence. Corroboration should mean genuinely independent URLs/domains or primary-source confirmation, not merely OpenAI and Firecrawl discovering the same page.

Provider overlap is still useful provenance but is not equivalent to independent-source corroboration.

## 7. Opportunity scoring changes

Keep the existing Fit / Intent / Timing / Value / Evidence model.

Deep Research improves the **Evidence**, **Intent**, and **Timing** inputs; it must not fabricate changes to Fit or Value.

Evidence scoring should consider:

- number of usable sources;
- source-quality tier;
- recency;
- independent corroboration;
- directness of the evidence to the active signal/opportunity;
- whether evidence is primary/official.

Every opportunity card should show which evidence caused the score to rise.

## 8. Backend API / run orchestration

Introduce a dedicated authenticated Deep Research run API rather than exposing provider credentials to the browser.

Recommended contract:

- `POST /api/research/deep?workspace_id=...` starts a run;
- request contains bounded profile/strategy context or references persisted workspace state;
- response returns `run_id` and initial state;
- `GET /api/research/deep/:run_id?workspace_id=...` returns progress and incremental results;
- optional cancellation endpoint may be added only if implementation cost is low and safe.

The backend owns provider orchestration, budgets, retries, timeouts, URL safety, audit logging, and credential access.

Research runs should be persisted using the existing run-orchestration conventions where practical rather than inventing a parallel job model.

## 9. Provider rules

### OpenAI

- OpenAI Web Search remains OpenAI-specific and uses the workspace's connected OpenAI credential even when another provider is ACTIVE for general AI generation.
- A missing OpenAI credential should degrade gracefully; Deep Research may continue using Firecrawl/Scrapling with a visible provider-unavailable state.

### Firecrawl

- Primary search and extraction engine.
- Use workspace-owned Firecrawl credentials when configured; retain managed fallback behavior according to existing integration rules.

### Scrapling

- Extraction fallback only in v1.
- Must run server-side or behind an authenticated controlled service boundary.
- Do not expose unrestricted scraping capability directly to the browser.

### Apollo

- Explicitly out of scope for Market Strategy research.
- Apollo remains a later Discovery/contact-enrichment stage.

## 10. Budgets and safety

Deep Research must be powerful but bounded.

Initial implementation budgets:

- max 3 iterative passes;
- max 8–12 query families selected from the relevant profile themes;
- max 30 total search requests across all providers per run;
- max 60 pages deeply extracted/crawled per run;
- per-domain crawl caps;
- global elapsed-time cap;
- URL validation and private/local-network blocking;
- no credential values in frontend, logs, audit metadata, or result payloads;
- provider errors sanitized before user display.

Exact budget constants should be centralized so they can later become plan/tier settings.

## 11. Failure behavior

The run must be partial-success tolerant:

- OpenAI failure → continue Firecrawl;
- Firecrawl Search failure → retain OpenAI evidence and try only safe downstream extraction where possible;
- Firecrawl scrape failure on a high-value public URL → try Scrapling fallback;
- Scrapling failure → keep previously collected evidence;
- one failed query/theme must not mark the entire run failed;
- final state distinguishes `complete`, `partial`, `cancelled`, and `error`.

No-evidence completion must explicitly say that research was attempted and name which providers/themes were attempted.

## 12. Data model

Extend market research state without breaking Quick Research compatibility.

Recommended additions:

- `researchMode: "quick" | "deep"`;
- `researchRunId`;
- `researchProgress`;
- `researchStats`;
- per-source `sourceType`, `sourceQuality`, `corroborationCount`, `retrievedAt`;
- per-run provider status including `openai`, `firecrawl`, `scrapling`;
- stop reason;
- deep-research pass/theme metadata.

Existing quick-research records without these fields must continue to load normally.

## 13. Files/components expected to change

Likely frontend:

- `customer/index.html`
- `customer/app.js`
- `customer/market-engine.js`
- `customer/market.css` / `customer/premium.css`
- new focused Deep Research UI/controller module if needed
- customer regression tests

Likely backend:

- new focused deep-research orchestration module;
- backend route registration;
- existing AI / service integration helpers reused where possible;
- run/audit persistence integration;
- backend tests.

Do not add Deep Research orchestration to an already oversized unrelated file if a focused module creates a cleaner boundary.

## 14. Testing contract

Implementation must be TDD-first.

Required tests include:

- two research buttons render and call different modes;
- pre-run hypothesis copy says research has not run;
- Quick Research preserves current OpenAI + Firecrawl behavior and limits;
- Deep Research plans relevant themes and never exceeds budgets;
- OpenAI and Firecrawl results deduplicate correctly;
- Firecrawl deep extraction is bounded;
- Scrapling runs only as fallback on eligible high-value public URLs;
- private/local URLs are rejected before extraction;
- iterative gap analysis stops at coverage/no-new-evidence/max-pass conditions;
- partial provider failures preserve other evidence;
- source-quality/corroboration changes Evidence score deterministically;
- progress/statistics are persisted and restored;
- old saved market state remains backward-compatible;
- no Apollo calls occur during Quick or Deep Market Strategy research;
- credentials never appear in frontend payloads or stored research results;
- Customer CI, Backend CI, syntax checks, release integrity, and exact-SHA production verification pass before completion is claimed.

## 15. Success criteria

The feature is complete when:

1. Market Strategy visibly offers **Quick Research** and **✦ Deep Research**.
2. The idle state cannot be mistaken for a completed zero-evidence search.
3. Quick Research retains the current fast OpenAI + Firecrawl workflow.
4. Deep Research performs iterative multi-source research with transparent progress and bounded resource use.
5. Deep Research uses OpenAI + Firecrawl and can use Scrapling as a controlled fallback.
6. Every elevated opportunity score is traceable to concrete public evidence.
7. The user can see how much research was actually performed and which providers contributed.
8. No provider failure silently converts a deep run into a fake successful result.
9. Existing saved workspaces and Quick Research remain backward-compatible.
10. Production release passes the full verification chain before being marked complete.
