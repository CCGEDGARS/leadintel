# Customer-only provider billing

The owner explicitly requires each customer to connect and pay their own tool
accounts. This supersedes the managed-fallback design described in earlier notes.

## Enforced policy

- Apollo, Firecrawl and Hunter resolve only encrypted credentials saved in the
  active workspace. No server/provider environment key is a customer fallback.
- Missing service keys return an actionable 409 before any paid upstream request.
- Request-scoped legacy CRM/enrichment environments mask the platform Apollo key,
  including absent, unauthenticated and unauthorized workspace contexts.
- Scheduled workflow research, market monitoring, source audits and public-email
  checks require the same customer Firecrawl credential before paid scraping/search.
- Browser research never retries the legacy proxy or hosted Scrapling after a
  provider/authentication/billing/network failure. Signed-out legacy requests stop.
- Hosted Scrapling extraction is unavailable to customer requests. Bounded direct
  public HTML extraction remains a free recovery path; it does not use a paid
  service account. AI fallback uses only providers connected in that workspace.
- The legacy proxy ignores all environment provider secrets and requires the
  caller's own key header. Backend deployment publishes this policy to the existing
  `apollo-proxy` Worker and verifies the exact release SHA and billing health marker.
- Disconnecting a customer key makes the corresponding provider unavailable; it
  never reactivates shared access. Old managed credit alerts do not become a new
  customer's payment issue. Settings explicitly explains customer-owned billing.

## Account and infrastructure boundaries

AI keys were already workspace-scoped. Gmail/Microsoft mailbox delivery and
Calendly already use the authenticated customer's connections; OAuth application
client credentials are application infrastructure, not the owner's mailbox.
Customers remain responsible for subscriptions, limits and credits charged to
their own connected provider accounts. The app cannot establish who owns a key
that a customer voluntarily pastes or transfer the provider's billing account.

Hosting, database and included storage are still platform infrastructure. Their
invoices remain payable by the platform owner and require recovery through the
LeadIntel commercial plan. Disabling shared provider consumption does not claim
that these infrastructure costs or dormant Render hosting invoices disappear.
This change does not create a new subscription, change a storage plan, delete
financial data, rotate saved customer keys or send outreach.

## Verification

Behavioral tests assert zero provider requests for missing keys despite configured
platform secrets, no inherited legacy Apollo key, per-customer encryption/routing,
no browser retry on 401/402/403/404/409/429/5xx or network failure, and no platform
key use by any legacy proxy operation. Existing automatic-flow/source fixtures
now provide customer Firecrawl keys. Production smoke checks require the settings
policy, browser routing policy and deployed legacy proxy billing marker. Exact-SHA
CI/backend deployment and a PROVEN release proof remain mandatory release gates.
