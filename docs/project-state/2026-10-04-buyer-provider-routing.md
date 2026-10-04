# Buyer provider routing correction

Customer evidence: 18 public queries report Failed to fetch; grounded research returns four rows; identity directory returns ten first-name-only identities. This establishes a failed public path, not quota exhaustion or buyer absence. Exact customer network exception and grounded row contents remain inaccessible in the agent session.

Code fault: Buyer public searches and public contact extraction bypassed the authenticated workspace Firecrawl endpoint and its encrypted customer credential, calling the separate managed intelligence proxy directly. Settings verified a different path.

Fix: shared Buyer Firecrawl transport uses /api/integrations/services/firecrawl/search and /scrape with workspace_id and credentials:include when authenticated. Local-only research retains the existing managed path. Workspace requests exclude X-LeadIntel-Research-Mode because API CORS permits Content-Type, X-CSRF-Token and Idempotency-Key. Public email search, official contact extraction and grounded-result page extraction use the same transport. Query payloads, abort behavior and upstream failure handling remain intact.

Regression: real transport/search functions verify workspace URL encoding, credential inclusion, correct payload, absent unsupported header, V2 result parsing, local fallback and scrape routing. Existing identity/grounded contact tests exercise both endpoint forms. Full customer suite: 1514 passed; static artifact and syntax verified. Authenticated LKAB candidates and CRM acceptance remain required; tests do not prove this customer outcome.
