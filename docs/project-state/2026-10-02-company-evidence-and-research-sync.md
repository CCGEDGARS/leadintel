# Company evidence and research sync — 2 October 2026

## Observed defects and causes

The customer's company results assigned H2 Green Steel to `en.highnorthnews.com` and included unrelated and duplicate oil-project articles. Company matching used the first hostname segment, so the short language subdomain `en` matched part of an unrelated company name. Qualified-candidate merging lacked the identity and attribution checks already present in the potential-match path. Whole-page keyword matching treated generic investment text as an event. Successful homepage/product crawling returned immediately without performing the company event search.

The screenshots also displayed a failed cloud sync. Inspection reproduced a separate save defect: extracted page bodies and copied reports can exceed the backend's 500 KB workspace limit. The existing budget helper was not connected to workspace PUT requests and only compacted seller website/PDF copies. The exact authenticated server error from the customer's session was unavailable; payload overflow is a reproduced cause, not a claim that every sync failure has this cause.

## Corrective behavior

- Match the company to the actual domain label, ignoring language/news subdomains; preserve accent-folded names and exact short brands. A renamed company resolves only when its own website explicitly connects the previous and current names. Carry old-name article attribution to that proven identity.
- Apply identity and sentence attribution to both qualified and potential results. Publisher text is limited to the named company's statements before fit and signal scoring. Reject another company's explicit event actor even on a first-party customer-story page.
- Require a concrete event/action near the signal term, suppress evergreen investment marketing and events older than 365 days, deduplicate tracking URLs and syndicated stories, and keep event evidence before the five-page cap. Preserve exact event quote, URL and date through saved discovery state. Undated events remain Low confidence, display date uncertainty and receive zero timing points; a score never confirms a purchase or supplier need.
- Crawl identity/fit pages and perform the bounded event query. Retain usable website evidence on an event-provider failure while recording the failed check for visible partial coverage/retry. Do not scrape the successful website again merely because the event query failed.
- Require short, exact first-party similarity quotes; reject contact/navigation boilerplate. Similarity remains separate from event qualification.
- Upgrade discovery quality version to require revalidation of old search results. Preserve deliberate selections and existing CRM/Pipeline records; do not delete customer records to solve evidence quality.
- Connect research compaction to both workspace save paths, including final persistence metadata. Compact copied research text progressively, retaining every record, source URL/date, verification metadata, event quote, buyer and approved script. Mark shortened research bodies. Preserve full local research copies and compare the original local save baseline, avoiding endless dirty-state autosaves. Keep concurrent edits pending and prevent oversized business data from being sent/deleted. Detect local changes across all workspace namespaces, not only discovery.
- Cache-version every changed application entry and shared support module. No customer-specific routing, provider invention, outreach sending or backend limit relaxation.

## Verification boundaries

Regression coverage includes the reported publisher-language collision, cross-company contamination, generic/stale events, duplicate stories, renamed primary identity, accent names, undated-event confidence, commercial quote validation, cross-industry/name-invariance, provider failure/retry and save/reload/concurrent edits with oversized research. The full customer suite and syntax/static build run before publication. Exact SHA CI, release manifest, backend health, mandatory smoke checks and changed-asset equality must establish the production release separately.

The customer's authenticated search, real shortlist usefulness, Buyers handoff and actual account save/reopen remain acceptance evidence to obtain. Public-source coverage may yield fewer supported companies than requested. No guaranteed best or complete market coverage is claimed.

## Prevention lesson

Identity, attribution, recency and deduplication must be enforced where evidence is merged, not merely in one renderer or the potential-result path. Fit-page extraction cannot stand in for event acquisition. Workspace budget checks belong at the actual network boundary; compacted server copies must not replace a richer local save baseline or erase concurrent business edits.
