# Public buyer contact research

The Buyers and Companies cards run a bounded public evidence pass after people search and once for saved cards per research version. Refresh public contacts explicitly reruns it. This pass does not call Apollo enrichment.

1. Firecrawl searches official company and public profile pages. It also scrapes the official homepage and up to two relevant same-domain links. Scrapling is an extraction fallback only when configured and when a Firecrawl scrape fails.
2. OpenAI web search examines the company and follows up individually for unresolved people. Gemini Grounding with Google Search independently searches unresolved people. The backend accepts only source URLs returned in grounding metadata. A Google citation redirect is resolved without visiting its final destination; only the company domain or a direct public LinkedIn profile URL is admitted.
3. Official pages are read for company email and phone listings. A person's work email requires an exact company-domain address near a matching full name and role or name-bearing email local part. A company inbox or switchboard remains a company contact. Search snippets alone do not establish a person's direct contact.
4. A LinkedIn profile needs one unique public source with a matching name and employer; first-name-only suggestions additionally need role evidence. A prior truncated name can be upgraded to the longer sourced surname, but conflicting names are not silently replaced.
5. Gemini's non-web evidence review flags contradictions; it cannot create a contact. The UI exposes official source links, provider result counts, and gaps. Public evidence does not verify email deliverability or phone ownership.

The per-card pass is bounded by four people, a small number of official pages, at most eight grounded person calls, and a total deadline. If a provider is unavailable or sources do not match, the UI reports the gap and leaves the corresponding person field empty. The separate Apollo email and phone actions remain optional after public research.
