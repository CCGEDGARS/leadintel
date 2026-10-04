# Recurring Google/Microsoft sign-in failure

The customer app and Worker had unrelated site origins. OAuth completed on the Worker, which set a host-only HttpOnly session cookie. The customer app then requested the Worker as a third-party resource. Browser cookie restrictions could therefore leave `/api/session` unauthenticated despite `auth=success`. Additional Google/Gmail approval cannot repair that transport boundary. Gmail permissions remain independent of workspace sign-in.

## Resolution

- The Vercel project uses `/customer` as its root. Its own `vercel.json` must register the API route and function; editing only repository-root deployment config produces a successful static build with a missing API. Keep a root compatibility entry point, and exclude `customer/api` from the public static artifact.
- Serve authenticated API traffic through a fixed Vercel proxy at the customer origin. Preserve raw request bodies, Origin, CSRF headers, idempotency keys and host-only HttpOnly cookies; never follow upstream redirects or cache private responses.
- Before consuming Google/Microsoft login state, bounce the registered Worker callback to the fixed customer-origin callback. The proxy marks its upstream request, preventing a bounce loop. Token exchange still uses the original registered Worker redirect URI; provider console configuration does not change.
- Install the transport before integration scripts. Existing modules use first-party requests through one compatibility boundary, while external provider requests remain unchanged.
- Session secrets stay out of browser JavaScript and JSON. Existing workspace membership, state conflict and encryption checks remain authoritative.
- Browser sessions established on the Worker host do not automatically migrate to the customer host. The next successful sign-in creates the first-party session.

## Validation and acceptance

Regression coverage checks fixed callback destinations, state preservation before consumption, request/cookie forwarding, logout deletion, path traversal rejection and early browser transport initialization. Existing Google/Microsoft, brand asset, workspace-save, CRM and provider suites must remain green.

Production acceptance requires exact-SHA CI/release proof, `/api/session` through the customer origin, successful authenticated workspace hydration, reload persistence and the saved LKAB research inspection. Local tests do not establish those browser outcomes.
