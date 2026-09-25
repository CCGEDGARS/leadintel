# Company extraction provider fallback

Company Discovery still collects public evidence with Firecrawl. The active workspace AI provider extracts named companies from that evidence. Gemini is a one-time backup for this extraction task only.

The backend tries Gemini only when all of these conditions are true:

- the request is explicitly marked `company-extraction` and asks for Gemini fallback;
- OpenAI is the active primary provider;
- OpenAI fails with a timeout, HTTP 408, HTTP 429, or a server error (5xx);
- Gemini has a saved workspace integration.

The same system prompt, evidence, and output limit are sent to Gemini. A successful OpenAI response ends the attempt even when it contains an empty company list. Invalid client requests and unrelated AI tasks do not trigger fallback. The worker gives each provider up to 20 seconds; the Discovery request allows 47 seconds for both attempts.

Both providers' output is parsed against the collected source URLs and company-name evidence. Candidate websites, target-market fit, and buying signals continue through the existing resolution and qualification checks. The client reports the provider and whether Gemini fallback was used; provider credentials remain encrypted in the backend.
