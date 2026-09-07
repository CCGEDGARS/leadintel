# Market research and continuous monitoring

LeadIntel provides three evidence workflows in Market Strategy. The product separates four states deliberately:

**Known → Planned → Researched → Verified**

- **Known** — Company Brain facts and user-approved context available before market research.
- **Planned** — the research depth, source categories and searches LeadIntel intends to use.
- **Researched** — live public evidence returned by a completed research run.
- **Verified** — researched evidence that has passed the normal extraction/verification path.

Pre-research UI must never present an opportunity score, company finding or specific site as though it has already been researched.

## Market Scan

**Button label:** `Market Scan`

**Description:** Fast validation of the strongest buying signals and opportunities in your selected market.

- Manual, on-demand snapshot.
- Maximum 4 queries.
- Maximum 5 results per query.
- Maximum 20 unique stored evidence sources.
- Best for fast initial validation.
- LeadIntel chooses source categories and specific sites automatically.
- No pre-run specific-site recommendation list is shown.
- The confirmation panel still shows scope, broad source categories, planned searches and how the scan works.

## Market Research

**Button label:** `Market Research`

**Description:** Deeper research across companies, market activity, news, hiring, expansion and other relevant sources.

- Manual, on-demand strategic assessment.
- Maximum 12 queries.
- Maximum 8 results per query.
- Maximum 80 unique stored evidence sources.
- Searches selected source categories such as news, jobs, investments, official company sources and registries.
- Can include **LinkedIn public signals** as a bounded public-index source category for leadership changes, hiring, company activity and role verification.
- Before the full run, LeadIntel performs a lightweight authenticated live **source discovery** pass.
- Live discovery can show up to 8 unique, deduplicated source sites.
- Specific-site recommendations must come from returned web-search evidence, not a static country catalog.
- Users can select discovered sites and add them to the existing direct-check/custom-source and monitoring source path.
- If source discovery is unavailable, LeadIntel states that explicitly and continues with the research plan without inventing recommended sites.
- Preserves each completed run in workspace research history.

## Market Intelligence

**Button label:** `Market Intelligence`

**Description:** Comprehensive investigation across multiple source types to uncover opportunities, patterns, competitors and hidden signals.

- Manual, on-demand widest investigation.
- Maximum 24 queries.
- Maximum 10 results per query.
- Maximum 200 unique stored evidence sources.
- Can include a wider LinkedIn public-index query family covering leadership, hiring, company activity, role identity and company growth.
- Before the full run, LeadIntel performs wider live source discovery.
- Up to 15 unique source sites can be displayed in a **Source Intelligence Map**.
- Source groups include:
  - Official & company sources
  - Hiring & leadership
  - News & media
  - Registries & public data
  - Industry & specialist sources
  - Technology signals
  - Growth & investment
  - Other relevant sources
- Users can select individual discovered sites for direct checking and later monitoring.
- If discovery is unavailable, LeadIntel shows an unavailable state instead of falling back to invented or static recommendations.

## LinkedIn evidence provenance

LeadIntel distinguishes three LinkedIn-related evidence states and must never conflate them:

- **`linkedin-public-index`** — a public LinkedIn URL discovered through the normal public web-search index. LeadIntel does not bypass LinkedIn authentication to obtain it. A public-index snippet or URL is lower-confidence evidence until corroborated or successfully extracted from a publicly accessible page.
- **`apollo-linkedin-url`** — a LinkedIn profile/company URL returned by Apollo for a matched decision maker or organization identity. This is an enrichment/identity link, not by itself a buying signal.
- **`linkedin-api`** — reserved for a future sanctioned LinkedIn API or authorized LinkedIn-backed data provider. LeadIntel must never emit this provenance unless such a provider actually ran and returned the evidence.

LinkedIn public signals are disabled for the fastest Market Scan by default and are available for Market Research and Market Intelligence. Restricted/logged-in pages are not scraped or bypassed.

## Pre-research market presentation

Before any live research is complete:

- The market headline is the selected geography only, for example `Latvia` / `Latvija`.
- **Commercial focus** is shown separately from the market name.
- **Target customers** are shown separately from the market name.
- Status is `Not researched yet`.
- No `0/100` or other numeric opportunity score is displayed.

After research is complete, the evidence-derived opportunity score and its components may be shown normally.

## Source discovery rules

- Source discovery uses the authenticated workspace OpenAI web-search endpoint already used by market research.
- Discovery queries are built from the selected market, priority offers/commercial focus, ICP/buyer context and active buying signals.
- Result URLs are canonicalized to site origins and deduplicated before display.
- A site is never recommended solely because the geography is Latvia, the Baltics or another country/region.
- The legacy Latvia source catalog is not presented as AI recommendation. A site such as LSM, Dienas Bizness, CV.lv or another local source may still appear when live source discovery actually returns it as relevant evidence.
- Tender/procurement sources remain excluded by default and may be used only when the tender signal is explicitly active and the source category is enabled.
- Credentials remain server-side and workspace-scoped.

## Review before starting

The review panel remains mandatory before a research run starts.

It may show:
- selected research mode;
- scope and cost bounds;
- planned source categories;
- how the mode works;
- planned searches;
- live source-discovery state appropriate to the selected mode.

It must not show:
- pre-research opportunity scores;
- market conclusions not yet researched;
- unresearched companies presented as findings;
- static sites labelled as AI recommendations.

## Continuous Monitoring

- Requires an activated Market Strategy, a signed-in workspace and an explicitly saved workspace.
- Runs through the Cloudflare Worker scheduler every hour and executes only configurations that are due.
- Supports daily, weekly and monthly cadence.
- Uses selected active signals, source categories, custom public sources and a minimum alert score.
- Discovered sites selected by the user use the existing custom-source path and can therefore be retained for direct checks and monitoring.
- Stores configuration, runs, deduplicated evidence and alerts in D1.
- Repeated evidence updates its last-seen timestamp but does not create a duplicate alert.
- New evidence is scored for signal match, recency and source validity. Evidence at or above the threshold creates an in-app alert.
- Users can run the saved monitoring configuration immediately and can mark alerts as read.

## Safety and cost controls

- Query/result/source limits are enforced per mode: Market Scan `4/5/20`, Market Research `12/8/80`, Market Intelligence `24/10/200`.
- Source discovery itself is bounded: zero specific-site discovery for Market Scan, up to 8 sites for Market Research and up to 15 sites for Market Intelligence.
- Automatic monitoring processes at most 10 due workspaces per hourly scheduler invocation.
- Only public HTTP(S) custom sources are accepted.
- Provider credentials remain encrypted in backend integration storage.
- Evidence is deduplicated by workspace and canonical source URL fingerprint.
- Research failures create partial or failed run records instead of manufacturing evidence.

## User workflow

1. Build and review the Company Brain profile.
2. Configure ICPs and buying signals.
3. Select **Market Scan**, **Market Research** or **Market Intelligence**.
4. Review the planned research before anything starts.
5. For Market Research or Market Intelligence, review live-discovered source sites and optionally add selected sites for direct checking/monitoring.
6. Start the selected research mode.
7. Review researched and verified evidence, opportunity scores and findings.
8. Activate Market Strategy when ready.
9. Configure monitoring frequency, threshold, signals and sources.
10. Save monitoring settings. LeadIntel saves the workspace before enabling the schedule.
11. Review new opportunity alerts and monitoring history in Market Strategy.