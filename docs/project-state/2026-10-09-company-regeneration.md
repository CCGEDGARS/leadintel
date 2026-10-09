# Company regeneration delay and incomplete research

The customer supplied four screenshots showing a Sweden search requesting five companies, progressing through market search/domain lookup/website verification and ending with a generic provider failure. An authenticated reproduction on the prior production revision showed a Firecrawl timeout, one unavailable AI extraction batch, and automatic broadening into a second pass. No storage-quota evidence was observed in those screenshots. During authenticated verification, conflict recovery failed because its multi-version snapshot exceeded browser localStorage quota; this prevented saving the research state.

## Root causes

- Full markdown scraping was requested for domain-resolution search results even though that stage only needs an official identity and URL.
- Website verification read several pages serially and could retry the same failed domain scrape during event-search recovery. Website reading preceded event search.
- Adaptive follow-up counted qualified candidates before commercial buyer-fit research. Version 2 qualification requires that research, so the decision could force unnecessary follow-up.
- Purchasing-fit batches ran serially with no individual request/response-body deadline. A failure discarded earlier successful batches. Search progress continued to say website verification during the fit stage.
- Fit errors were treated as an optional fallback rather than persisted failed research checks. Cancellation also produced provider-timeout diagnostics for aborted requests.

- Recovery snapshots repeated original/latest local/server records verbatim, exhausting browser localStorage during larger research runs.

## Fix and preservation rules

Run official identity lookup without bulk result scraping; actual company and event evidence still require verification. Read each website once per run with a total duration budget, retaining readable pages when an internal page stalls. Start website and event checks together with two verification workers, keeping at most four simultaneous provider requests. Fit batches use two workers, individual deadlines and independent failure handling. Preserve successful assessments, report purchasing-fit progress, and record failed company checks across save/reload. Perform purchasing-fit research before adaptive broadening; reuse its result for the final ranking when the supplied operating/event evidence is unchanged. New evidence invalidates that assessment cache. Targeted failed-check retries use the same bounded fit evaluation and qualification gates. Customer cancellation preserves completed evidence and is identified as cancellation. Large recovery records use lossless nested references across all original/latest copies; legacy records are read, full records are exported, workspace identity is validated, and restoration stays bounded. Actual storage failure still prevents overwriting either side.

Minimum scores, independent-source requirements, official evidence, exact confirmed-offer matching, recency and signal gates remain enforced. Seller/market context comes from the active workspace; no customer names or industries are runtime defaults. CRM, saved buyer selections and approved message masters are outside the changed research logic.

## Validation

Regression cases cover stuck provider bodies, failed scrapes queried twice, official lookup without scraping, fit-stage labels and failure normalization, two fit workers with one failed batch across different seller industries/names, bounded internal-page failure, cancellation, and qualified first-pass suppression of unnecessary broadening with save/reload. Production proof also requires the deadline, batch-preservation and website-budget runtime markers.

Release and authenticated acceptance evidence are recorded in the associated pull request once deployment verification completes. An exact-SHA production proof is required before claiming the change is live.
