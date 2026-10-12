# Active tools credential ownership

## Root cause

The backend deliberately resolves a managed Apollo fallback when a workspace has
no customer Apollo key. The Settings health check collapsed this distinction
into `Operational`, using the legacy enrichment-policy `configured` flag, and
the Active tools summary rendered every good Apollo state as `READY`. This did
not establish a personal Apollo connection or expose its API key. It incorrectly
represented platform access as the customer's own connection.

The summary also rendered before asynchronous diagnostics finished and was not
refreshed afterward. Integration diagnostics lacked the workspace/generation
guards already used by AI provider status, allowing a previous workspace's
in-flight diagnostics to replace the next workspace's cleared status.

## Change

Use the workspace service response as the credential source of truth. Preserve
`customer` versus `managed` through the health result and summary. Customer Apollo
is `Connected` / `READY`; the fallback is `Managed access` / `MANAGED` and explicitly
states that no personal Apollo key is connected. Managed Firecrawl proxy reachability
is displayed as `CREDITS UNVERIFIED`, rather than as a ready paid research service.
Refresh the summary after diagnostics complete. Clear integration health on
workspace changes and discard stale/in-flight responses by workspace and generation.

The managed fallback routing and saved credentials are preserved. Apollo and
Firecrawl credentials do not activate an AI engine: an AI provider becomes the
main engine only after a successful saved model test and selection in that
workspace. Existing connection failures remain visible in the provider card.

## Verification

Five behavioral regression tests mount the real Settings module and check managed
Apollo, customer Apollo, unverified managed Firecrawl, immediate summary refresh,
and an account switch while diagnostics are in flight. These failed before the
fix and pass afterward. Existing privacy, provider-credit and settings tests run
alongside them. Production smoke checks verify the ownership behavior markers
and cache-busted module entry. Production claims require exact-SHA release proof;
these tests do not substitute for the affected customer's authenticated acceptance.
