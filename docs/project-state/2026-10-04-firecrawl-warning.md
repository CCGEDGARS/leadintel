# Firecrawl warning diagnosis

Three false-positive paths reproduced using the real checkFirecrawlStatus function:
- Any historical OpenAI fallback was treated as HTTP 402, even without a billing response.
- Number(null) converted an unknown balance to zero.
- Historical local failure overrode a fresh successful positive customer credit check.

Corrected precedence: current explicit provider billing error, current connection failure, current customer balance, then historical managed HTTP 402 with an explicit historical label. Generic fallback is not credit evidence. Unknown balance remains unknown. Successful credit verification does not prove paid search/extraction works.

User screenshots confirm their browser is signed in and Firecrawl dashboard shows 97,915 credits. They do not expose the exact provider response used by LeadIntel. The agent test browser still has no authenticated workspace, so the exact current customer error remains inaccessible; do not claim these fixes prove the sole cause of that screenshot.
