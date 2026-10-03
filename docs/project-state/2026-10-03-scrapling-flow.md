# Scrapling extraction fallback — 3 October 2026

Scrapling already had an authenticated Worker adapter, Render service and customer router. The gap was operational: HTTP 402 was excluded from retry routing, the server-side Firecrawl route only attempted direct fetching, and Scrapling discarded internal links. The Python extractor could label HTTP error/blocker text as successful evidence and had an incorrectly large seconds-based fetch timeout.

The extraction chain now tries Firecrawl, bounded direct extraction, then configured Scrapling. The authenticated customer router also covers billing failures, transient failures, network failures and weak HTTP 200 responses. Authentication failures are not bypassed. Search remains grounded search: Scrapling extracts URLs and does not replace a search index. Existing research results and qualification gates are retained.

Scrapling returns deduplicated page links and accurate provenance, rejects unsuccessful/blocker content, bounds HTTP timeout to 25 seconds, checks public destinations before every manual redirect and requires a service token. Health identifies Render revision and token configuration without exposing credentials. Current runtime uses the lightweight static Fetcher; browser rendering is not installed or claimed.

Verification: customer/backend suites plus Python extraction behavior tests. Production requires exact-SHA CI/release proof, matching Render revision, protected health and actual authenticated workspace extraction acceptance. Unit tests use mocked providers; they do not prove customer-specific extraction or credentials. No new hosting service, paid plan or outreach was activated.
