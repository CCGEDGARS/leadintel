# Paid email lookup execution correction

## Root cause
The additional-services run included paid readiness inside its context-validity predicate. A failed readiness check returned false before any outcome was shown or saved. Readiness required four eligible buyers and company-wide research even for a manually selected person. The public-only compatibility path then left a generic qualification message. Customer-owned credentials and enabled permissions could therefore coexist with zero provider attempts and a misleading completed-research label. Hunter finding existed as a service endpoint but was bypassed whenever the additional-services module was installed.

## Resulting behavior
- Manual lookup requires the current qualified company, the exact selected eligible identity, fresh mandatory checks for that person and actual shared official-page receipts. An unrelated buyer cannot veto that manual action. Automatic lookup retains full-roster research and four qualified buyers.
- Invalid context cancels. Invalid readiness shows the actual blocker in the existing buyer card and saves the contact-check outcome through workspace/CRM research snapshots.
- Apollo keeps its explicit approval and existing account credit policy. After a missing or failed Apollo result, enabled customer-owned Hunter can be approved separately for named work-email finding and at most one required verification. Hunter is never silently enabled for automation.
- Hunter requires the returned full name and exact company domain, a valid delivery result and no catch-all/block condition. Wrong or ambiguous results remain unconfirmed. Only the backend sets verified CRM status. This action sends no outreach.
- Provider-specific monthly receipts prevent duplicate paid requests. Migration 0043 preserves earlier Apollo results and timestamps. Shared daily/monthly limits count provider lookups; the company cap counts distinct buyers. A Hunter finder may itself use a search credit and one verification credit; the confirmation states these operations without inventing a monetary price.

## Verification
Customer and backend regression suites cover the original silent block, unrelated-buyer isolation, selected-buyer missing checks, separate approvals, cancellation/context changes, exact-owner/domain and delivery rejection, provider failure/no-result distinction, duplicate suppression, combined limits, migration preservation and CRM/workspace outcome retention. Production proof must target the release SHA and `qualified-email-v2` backend health marker. Contact yield remains a separate authenticated acceptance result.
