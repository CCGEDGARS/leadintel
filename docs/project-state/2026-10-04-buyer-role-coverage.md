# Buyer search coverage correction

Customer screenshots show four full-name results but all four match Project Director. Public provider routing now returns 27 rows and grounded search six; this establishes provider recovery, not buyer-quality acceptance.

Root cause: query generation exhausted the first 18-query budget on aliases of early roles. A raw-row threshold then stopped research before other roles were searched. The plan now gives each planned role a first query including local aliases, then performs broader searches. The bounded UI pass no longer stops on raw page counts. Role relevance is labelled Role match because it does not establish buying authority.

Regression reproduces omitted procurement before the fix and tests balanced coverage for two company names. Customer acceptance remains unproven: current employment, buying committee diversity, unresolved identities, contact availability, message handoff and CRM reopen need separate evidence. No outreach is authorized by this change.
