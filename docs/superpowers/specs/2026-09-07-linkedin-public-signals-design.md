# LinkedIn Public Signal Access Design

## Purpose
Give LeadIntel a compliant LinkedIn signal path that improves leadership-change, hiring, company-activity and professional-identity research without scraping authenticated LinkedIn pages or pretending to have unsupported official API access.

## Architecture
LeadIntel adds a `linkedin` research source category as a public-index source. Market Research and Market Intelligence generate targeted OpenAI web-search queries constrained to public LinkedIn URLs (`linkedin.com/company`, `linkedin.com/jobs/view`, and role/profile URLs where relevant). Search evidence is tagged `sourceKind: linkedin-public-index`. Firecrawl may verify a public page; Scrapling may act only as the verified fallback after Firecrawl/direct extraction failure. Apollo continues to provide LinkedIn profile URLs during decision-maker enrichment and those are tagged separately as Apollo identity links, not LinkedIn research evidence.

The system explicitly distinguishes:
- `linkedin-public-index` — discovered via public web index/search and validated only from accessible public evidence.
- `apollo-linkedin-url` — LinkedIn URL returned by Apollo for a matched person/company identity.
- `linkedin-api` — reserved for a future sanctioned LinkedIn API/provider and must never be emitted unless that provider actually ran.

## UX
A `LinkedIn public signals` checkbox is added to research source categories for Market Research and Market Intelligence. It is not selected for the fastest Market Scan by default. The UI copy makes clear that the system searches public LinkedIn-indexed pages and does not bypass login restrictions.

## Query strategy
LinkedIn query families include:
1. Leadership changes: site:linkedin.com/in OR site:linkedin.com/company + target market + buyer roles + appointed/new/head/director.
2. Hiring/team growth: site:linkedin.com/jobs/view OR site:linkedin.com/company + target market + hiring/growth/sales/team.
3. Company activity: site:linkedin.com/company + target market + expansion/launch/AI/CRM/transformation/selected signals.
4. Identity verification: company + expected role + site:linkedin.com/in, used only after a company is already relevant.

## Evidence rules
- A LinkedIn URL alone is not a buying signal.
- Public-index snippets are lower-confidence evidence until corroborated by a second source or an accessible page extract.
- No result may be labelled `linkedin-api` without a verified authorized provider response.
- Logged-in/restricted content is not scraped or bypassed.
- Tender exclusions and the normal market-intelligence skill rules still apply.

## Acceptance
1. Market Research/Intelligence can explicitly include LinkedIn public signals.
2. Query generation creates LinkedIn-specific public-index searches.
3. Results preserve `linkedin-public-index` provenance.
4. Apollo LinkedIn URLs remain distinguishable from research evidence.
5. No code claims direct LinkedIn API access.
6. Tests cover query families, state persistence, provenance and no-false-claim behavior.
