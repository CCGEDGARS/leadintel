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
