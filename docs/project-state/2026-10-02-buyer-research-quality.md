# Buyer research quality correction

Observed customer result: four Apollo first-name suggestions for an industrial seller included content-production roles and lacked direct profile/contact evidence. Apollo suggestions do not establish identity, authority or deliverable contact details.

Corrections:
- Industrial production/operations/engineering roles exclude content, film, editorial and creative production unless those functions are explicitly requested. Content sellers still match their own production roles.
- Public LinkedIn matching reads extracted Markdown and accepts supported names containing two to five words. Company and role attribution and unique-profile checks remain required.
- Buyer search waits for its bounded public identity/contact pass before completing the task. Public errors remain marked incomplete. Cancellation propagates to follow-up research.
- Public-provider requests have explicit abort/deadline handling, including a race that releases callers when a transport ignores cancellation.
- Contact research version advances so earlier incomplete saved checks can be refreshed.

The existing Firecrawl, OpenAI grounded search and Gemini grounded contact paths remain in use. No restricted LinkedIn access or new provider configuration is claimed. Available extracted evidence is used; missing identities, addresses and phones are not fabricated. Tests use fixtures and mocked providers, not the customer's signed-in account or live Polestar provider calls. Production proof demonstrates release integrity, not that every Polestar buyer can be found.
