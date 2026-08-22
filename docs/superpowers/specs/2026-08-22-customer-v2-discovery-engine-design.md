# LeadIntel Customer V2 Discovery Engine Design

## Goal
Turn an activated Market Strategy into a ranked, evidence-backed shortlist of real company domains, identify relevant decision-makers on explicit request, and let the customer save qualified companies into a persistent pipeline.

## Scope
This milestone adds Step 5 to `/customer/`. It discovers and ranks companies and can search Apollo for people at a selected company. It does not send outreach, reveal personal emails, or automate contact without customer action.

## Customer flow
1. Activate Market Strategy.
2. Continue to Discovery.
3. Run company discovery.
4. LeadIntel performs up to four Firecrawl searches with up to five results each.
5. The system filters obvious news/social/directory hosts, deduplicates by company domain, and ranks candidate companies.
6. Customer can inspect evidence and matched signals.
7. Customer can request Apollo decision-maker discovery for a specific company.
8. Customer saves selected companies to Pipeline.
9. Pipeline status can be advanced manually through commercial stages.

## Discovery queries
- Maximum four Firecrawl search requests per manual run.
- Maximum five results per query.
- Queries use active ICPs, active market opportunities, priority offers, target markets and top-weight signals.
- Search queries are designed to surface company sites rather than generic articles.
- Public-search failure does not create substitute companies.

## Candidate identity
A candidate requires a valid HTTP(S) URL and usable hostname. LeadIntel derives a canonical domain and company display name from the search result. Candidates are deduplicated by canonical domain. Obvious non-company hosts such as major social networks, generic search engines, encyclopedias, directories and major news sites are excluded from candidate creation.

## Company Opportunity Score
Each candidate receives a transparent score out of 100:
- Fit: 0–30
- Signal: 0–25
- Evidence: 0–20
- Timing: 0–15
- Value: 0–10

Total = Fit + Signal + Evidence + Timing + Value.

Fit measures overlap with approved ICP, offer and market context. Signal measures explicit matches against active Signal Designer keywords, weighted by signal importance. Evidence measures direct-source quality and evidence depth. Timing uses publication/updated dates when available and stays conservative when dates are absent. Value uses the active market-opportunity score and declared opportunity economics; it must not invent company revenue or budget.

## Evidence discipline
- Every candidate retains at least one source URL.
- A matched signal must come from candidate evidence text, not merely from the search query.
- Missing dates reduce Timing.
- Missing evidence reduces Evidence and confidence.
- Do not infer a specific budget, purchase, project, hiring event or expansion unless present in evidence.

## Decision-makers
Apollo People API Search is used only after a customer clicks `Find decision-makers` on one candidate.
Request filters:
- exact company domain via `q_organization_domains_list`
- approved decision-maker titles via `person_titles`
- similar titles enabled
- seniorities limited to c-suite, VP, head, director and manager
- maximum five people

Apollo People Search does not provide emails or phone numbers. This milestone therefore stores names, titles and search metadata only; later enrichment is a separate controlled step.

## Pipeline
Pipeline stages mirror the established LeadIntel model:
Discovered → Qualified → Contact Found → Ready for Outreach → Contacted → Replied → Meeting → Proposal → Won / Lost.

Saving the same domain twice updates the existing pipeline record instead of creating a duplicate. Pipeline stores company, domain, website, market, score, confidence, matched signals, evidence and discovered people.

## State and privacy
- Discovery state persists inside browser-local `state.discovery`.
- Maximum 20 raw search results, 12 company candidates, 50 pipeline items and 5 people per company.
- No personal emails or phone numbers are stored by this milestone.
- No outreach is sent.
- Original `/v2/` files remain untouched.
