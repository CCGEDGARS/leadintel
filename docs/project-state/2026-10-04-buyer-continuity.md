# Buyer continuity — 4 October 2026

Reproduced two additional failures using the real searchDecisionMakers function, then fixed them:

1. Company website extraction rejected before public/identity fallbacks. Catch extraction outages, preserve existing evidence, continue independently attributed buyer research, and retain Research incomplete. Cancellation remains terminal; failed website checks never enter checkedCompanyDomains.
2. CRM saved before final public identity/contact verification, and a CRM transport exception converted useful buyer research to an error. Save after final verification and progress persistence; contain CRM failures and report local preservation without claiming a backend save.

Regressions exercise website HTTP 503 plus identity fallback, and inspect the CRM snapshot after a changed verified identity with a throwing CRM transport. Synthetic identities are test fixtures, not LKAB acceptance evidence.

Added mandatory buyer-failure-recovery deployment smoke markers and refreshed the browser entry asset version. Public release proof and actual authenticated LKAB acceptance remain distinct gates. Google account verification is required in the test browser; historical ten-result customer provider payloads are not available in the checkout.

Completion target remains Profile → Companies → Buyers → Triggers → Scripts → CRM. No claim of complete SaaS readiness or authorized outreach follows from these fixes.
