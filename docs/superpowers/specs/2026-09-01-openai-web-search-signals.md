# OpenAI Web Search Signal Discovery Spec

## Goal
Integrate OpenAI Web Search into LeadIntel's Market Strategy research flow as a fresh public-web signal discovery layer before Apollo enrichment, while retaining Firecrawl as verification/deep-read coverage and preserving existing fail-closed evidence scoring.

## Required behavior
- Add an authenticated backend endpoint for OpenAI Web Search under `/api/ai/web-search?workspace_id=...`.
- Use the workspace's configured OpenAI credential; never expose the credential to the browser.
- Call the OpenAI Responses API with the built-in web search tool and request source metadata.
- Require structured JSON output for candidate evidence rows.
- Return normalized rows containing at minimum: title, url, description/evidence, date when supported, and query metadata.
- Reject unsupported providers for this endpoint with a clear 409 response; the normal multi-provider generation endpoint remains unchanged.
- Audit successful web-search use without storing credentials or raw secrets.
- In Market Strategy research, query OpenAI Web Search first for each active market/signal query, then run the existing Firecrawl search for verification/coverage.
- Merge and deduplicate both source sets before opportunity scoring.
- Preserve the existing Firecrawl-only path if OpenAI web search is unavailable or not configured; one provider failure must not erase evidence from the other.
- Surface research status indicating that OpenAI Web Search and Firecrawl verification were attempted/used.
- Apollo remains downstream: no Apollo enrichment is triggered by this feature.

## Security and quality constraints
- Authentication and workspace membership are mandatory.
- Only owner/researcher/sales roles can run searches, matching existing AI generation access.
- Search prompt/query length must be bounded.
- OpenAI API errors must be sanitized before returning to the browser.
- No API keys in frontend source, logs, audit metadata, or returned payloads.
- Search results without valid HTTP(S) URLs are discarded.
- Results are deduplicated by canonical URL.
- Existing opportunity scoring remains evidence-driven; OpenAI prose alone must not create evidence without a source URL.

## OpenAI contract
Use `POST https://api.openai.com/v1/responses` with a supported OpenAI model, built-in web search tool, `store:false`, and `include:["web_search_call.action.sources"]`. Prefer Structured Outputs via `text.format.type="json_schema"` for stable result rows. This follows the current OpenAI Responses API contract as of 2026-09-01.
