# Company research evidence quality correction

## Observed failures
Customer screenshots from 10:39–10:40 showed Polestar twice (media/investor hosts), a 2020 China factory announcement and forward-looking financial disclaimers counted as current buying signals, Atlas Copco's 2002 mining announcement contributing similarity, blocked Norck page text admitted as evidence, and generic profile language inflating fit. A build passing did not establish the quality of that customer result.

## Shared corrections
- One evidence policy supports discovery, market-result normalization, first-party extraction, similarity and CRM identity. Corporate publication/localization prefixes normalize to the company domain; independent hosted tenants remain separate. CRM alias lookup is workspace scoped, prefers suppressed records, reuses legacy IDs and preserves contacts, activities and pipeline stage. No data migration or record deletion.
- Preserve publication provenance from explicit fields, target metadata, dated URLs or article datelines. Scrape timestamps/copyright are not publication evidence. Events need dated evidence within 365 days; unknown dates stay potential research with an explicit gap, historical/future events cannot qualify. Verification queries use a recent date window; unsupported country claims and clearly foreign event locations do not establish the requested market event.
- Reject target HTTP errors and blocked/error/captcha pages even when the scraper wrapper reports success. Exclude historical/error/legal content from similarity quotes and scoring. Ignore legal funding disclaimers as events.
- Commercial overlap derives from confirmed offers and target profile, rather than generated ICP prose or generic development/structure/currently/relevant wording. Textual fit is capped; supplier need remains unconfirmed. Corporate subdomains count as one source family. Correct the displayed fit component maximum to 24.
- Quality version 6 requires earlier search results to be researched again; saved CRM/pipeline records and contact history are preserved. Potential cards provide two readable columns with a single-column small-screen layout.

## Verification and remaining acceptance boundary
Regression fixtures cover the observed Polestar/Atlas Copco/Norck failure texts, unknown dates, metadata dates, hosted tenants, cross-industry/name invariance, save/reload, bounded adaptive discovery and legacy CRM alias/contact/pipeline/suppression/workspace isolation.

Exact release proof must follow repository policy after publication. Customer-specific authenticated research, the identities of the three Workspace Health alerts and runtime Scrapling service configuration are not established by these tests. The adapter exists; do not claim it executed without a provider/extraction record. No new paid provider is required to correct these evidence-policy defects. Provider gaps should be assessed only after a correctly filtered real research run.
