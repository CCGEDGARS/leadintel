# Provider-specific research timing

Customer's exported retry report confirms four OpenAI queries hit the frontend's 30-second cutoff. This is evidence of frontend cancellation, not insufficient credits or a demonstrated upstream outage. The earlier diagnostics fix exposed this cause but did not solve premature cancellation.

OpenAI first pass, adaptive searches and OpenAI-only retry now share a bounded 120-second provider budget, independently of Firecrawl's unchanged 30/35/45-second mode limits. The countdown uses the same OpenAI deadline. A timed-out OpenAI market request is not automatically replayed; short-lived server/network failures retain the existing single retry. This avoids repeating paid searches that may still have been processing when the browser cancelled. The selected model and source evidence gates are unchanged. Quick Overview still has four planned queries; hosted discovery can take longer, and ongoing progress remains visible.

Regression covers provider-specific limits, all three call paths, no timeout replay, and unchanged Firecrawl timeout. Authenticated end-to-end success cannot be claimed from mocks or a release proof: the user's next retry is required to measure provider completion in that workspace. Existing evidence and saved reports remain available.
