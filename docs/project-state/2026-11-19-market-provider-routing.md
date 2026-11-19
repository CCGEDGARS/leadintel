# Market research provider routing

The reported Microsoft-account journey showed an OpenAI connection warning despite Claude being selected. On baseline `3c9e11711eb2ddba8ab585f5d6027be3d0892b98`, an authenticated Claude-only workspace returned HTTP 409 from `/api/ai/web-search`: “Connect OpenAI or Google Gemini …”. No provider request ran. This is a controlled reproduction, not access to the customer's private account.

The shared discovery endpoint had hard-coded OpenAI as primary and Gemini as fallback. Its caller labelled every discovery result and receipt OpenAI. Connection checks and saved provenance also excluded Anthropic. Claude's existing grounded search adapter was used only by company dossiers.

## Behavior

- Discovery honors the saved Main researcher, otherwise the active main engine. Automatic fallback prefers Gemini, Claude, then OpenAI, excluding the primary. An explicitly disconnected primary returns an actionable configuration error. A connected single provider is sufficient for discovery; the two-provider company dossier contract is unchanged.
- Claude uses the same actual web-search tool adapter as company dossiers. Source URLs come from tool results/citations. Queries use at most one connected fallback and retain the existing request, retry, cancellation and authorization bounds. Customer credentials only.
- HTTP search responses include actual provider attempts. Browser execution records preserve these separately from the aggregate AI discovery request. Evidence retains Claude/Gemini attribution and the distinction between model summaries and extracted text. Unsupported model summaries cannot become market opportunities.
- Optional Gemini evidence verification remains separate from discovery. Missing or interrupted verification stays incomplete. Report source selection precedes verification so its coverage and IDs describe the saved, deduplicated evidence.
- Claude billing/model failures use the existing sanitized provider diagnostics and credit-health events. No raw provider messages or credentials are exposed.
- Old evidence and reports remain available, including during failed retries. Old OpenAI-only internal function names remain for compatibility; their customer copy now describes AI discovery.

## Acceptance

Authenticated HTTP/SQL tests cover Claude-only discovery, explicit researcher vs active engine, OpenAI connected but not selected, one fallback with both receipts, ungrounded output, disconnected settings, billing diagnostics, tenant isolation and membership revocation before fallback.

The existing browser acceptance harness now runs Quick Overview, Market Research and Deep Analysis with Claude as well as Gemini. It exercises the actual controls, authenticated APIs, report generation, fresh-browser reload, desktop/mobile views and Strategy → Companies handoff. External services use controlled provider-shaped responses; no customer research credits or outreach are used. Separate lifecycle regressions cover cancellation, late responses, duplicate clicks and partial evidence checkpoints.

Exact production verification is required through the repository release proof. A proven release establishes deployed code and mandatory checks; it does not establish the customer's current provider balance, model entitlement or a successful private-account research run.
