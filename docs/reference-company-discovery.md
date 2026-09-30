# Reference Companies and ranked discovery

Reference Companies replaces the displayed Top Customers label without renaming storage keys or losing saved portfolios. References can be existing customers or ideal examples from any country. Manual entry records company name, website and a short business reason. The Reference type selector and classification labels are removed; existing stored classifications remain compatible. Existing Excel/CSV import, deduplication, and PDF review paths remain in use. Recommend 3–5 relevant references; no mandatory five-company gate.

Target Companies contains a region-aware discovery action, 5/10/20 presets and custom integer 1–50. The action saves the selection in synchronized discovery metadata and invokes full general discovery, rather than target-only research. Known targets remain editable via Add manually. Target-list test controls and the Saving Mode explanation are removed; the dialog offers one main discovery action. Reference copying is hidden to prevent converting examples into outreach targets.

Discovery combines the seller offer, ICP, target region, active reference model and signals. Fit-oriented queries supplement signal queries. Extraction admits relevant operating companies without inventing a buying event; later evidence gates still control qualification. Reference domains are excluded from new results.

Fit is an evidence-based research estimate, not buying probability. Score uses existing commercial-fit evidence matching, normalized to 100 and capped at 70 when only one independent source supports it. No score appears without usable evidence. Buying-signal, opportunity score and qualification gaps remain separate. Results are ordered by fit within the qualified and review lists. The Target Companies dialog also exposes a combined regional shortlist and short explanations.

Requested count is a goal, not a promised quantity. Provider failures, missing sources and bounded research can produce fewer companies. Saving Mode remains available on the main discovery screen; the new dialog action explicitly invokes Full research. Count selection survives reopening and handoff.

No automatic outreach is enabled by this change. Existing automation eligibility, CRM suppression, authentication and delivery gates remain applicable. Only a user review or existing qualified-flow rules may advance prospects.

Verification: full customer suite; behavioral tests for fit evidence, source caps, reference classification/reason preservation, reference exclusion and shortlist reload; control tests for count handoff, validation and saved count restoration; production UI inspection; exact-SHA production integrity checks.



## Single-reference similarity search — 30 September 2026

One evidenced company is a valid similarity seed. Additional references strengthen cross-company pattern confidence but are never a minimum requirement. An Opportunity Map is optional deal context; it does not gate activation or similar-company discovery.

The reference DNA preserves two layers: majority-supported shared dimensions, and each individual company’s evidenced dimensions. Mixed lists remain usable without claiming that distinct characteristics are shared. Published models upgrade from recorded analysis without deleting source lists or CRM records. An active status requires usable reference DNA, not only a saved activation flag.

Reference analysis uses seller context for commercial relevance and a consistent broad sector/production vocabulary. New canonical commercial fields retain exact first-party quotations and source URLs; unsupported fields are omitted. Input evidence is bounded to the backend prompt limit.

Discovery reserves query capacity for separate reference-sector and production/capability families. No buying trigger is required for similarity queries, and distinct industries are not combined into one restrictive query. Collected prospect website evidence receives a bounded AI commercial-similarity comparison. Accepted scores must cite an existing reference, supplied prospect URL and exact prospect quotation; directory-only evidence is rejected. One prospect source caps the similarity estimate at 85. Scores are research estimates, not probabilities or buying-intent confirmation.

Similarity scores survive shortlist reload and remain separate from fit and opportunity qualification. A similar company without a verified buying signal stays in the review shortlist. Provider failure retains evidence-term comparison and reports the missing AI comparison. The requested count remains a research goal; unsupported companies must not be invented to reach it.

Verification: `node --test customer/test/*.test.js`, including `reference-similarity-single-seed.test.js`, plus static build and exact-SHA release proof. Live provider/output quality still requires a signed-in research run.


## Profile → Companies → Buyers evidence upgrade — 30 September 2026

The existing provider set remains OpenAI, Firecrawl and Gemini; Scrapling is a configured extraction fallback and Apollo supplies buyer lookup/enrichment. This change does not add a provider account or subscription.

### Profile

Reference analysis reads the supplied official website plus up to four relevant first-level internal pages. Links come from extracted links or markdown; product, capability, project, reference and about pages are prioritized. URLs outside the normalized company host, credentials, query links, documents and irrelevant administrative pages are excluded. Requests have 25-second deadlines and two internal pages run concurrently. Partial failures remain explicit. Each reference keeps per-page URLs and bounded text; classification quotes must occur on the precise supplied page. Evidence remains under the 80,000-character AI prompt limit even with 24 references. Analysis status reports the number of pages read and saved analyses retain coverage.

The seller Profile scan also uses extracted internal links alongside its existing authoritative page searches. The authenticated Firecrawl adapter preserves the supported markdown+links formats, rejecting arbitrary extra formats.

### Companies

Normal discovery preserves eight requested search results rather than silently reducing them to four; explicit Saving Mode can retain its smaller cap. Full discovery asks the existing authenticated AI provider to plan native-language and English query families from reference traits and seller context, without requiring buying events or inventing company names. Planning failure keeps deterministic reference queries and records a fallback; Saving Mode remains bounded and uses the existing families.

Verification first reads the official homepage and up to two internal pages (one homepage in Saving Mode), preferring contact/location and capability evidence. Unreadable or foreign redirects fail. Search fallback remains available if direct extraction fails. A successful search response alone does not mark a company site checked: readable first-party text on the company domain is required. The existing strict market, commercial-fit and buying-signal gates remain separate from reference similarity, with a candidate investigation pool capped at 30.

### Buyers

Before each new buyer lookup, LeadIntel rechecks the official company site and relevant people/contact pages. Failure stops the Apollo lookup and shows an error; the company is not silently promoted or discarded. Successful pages join saved company evidence. Manually selected targets retain their explicit review status; finding readable company content does not create market fit or purchasing intent. Existing public name/contact research, Gemini grounded identity checks, and explicit contact-enrichment controls remain in place.

### Recovery, cost and limits

An HTTP 200 scrape containing a short or blocker response can now invoke the installed Scrapling fallback. Authentication failures remain visible. Scrapling execution still depends on the configured runtime; this release does not claim browser rendering or live Scrapling execution merely because the adapter exists. Cancellation rejects even when an upstream promise ignores its signal. There is no unbounded crawl: discovery depth, pages, concurrency, query count and prompt budgets are capped.

The shared reader uses extracted first-level links, not the Firecrawl Map/Crawl endpoints. Dynamic Scrapling rendering, Exa and Perplexity are not introduced. Ten results is a research target, not permission to invent companies when fewer pass evidence checks.

### Verification

Behavioral tests cover Swedish internal-link selection, per-page citation validation, large-upload prompt limits, partial extraction, blocker/foreign-domain rejection, cancellation, authenticated bilingual planning, HTTP-200 fallback and the no-Apollo-on-failed-company-precheck gate. Full customer/backend regression suites and the static build are required. Production status additionally requires exact-SHA CI, release manifest, backend health and configured smoke proof. An authenticated ten-company end-to-end run must be reported separately from deployment proof.
