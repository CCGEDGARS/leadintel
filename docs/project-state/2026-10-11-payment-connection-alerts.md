# Red payment alerts and yellow connection warnings

The user approved a strict distinction: red for payment/credit issues, yellow for
connection issues, and Hunter included alongside the existing paid API providers.
Subscription monitoring and a separate persistent header indicator are outside
this change.

The previous integration badges displayed every `bad` health state in red and
inline errors used the same red style. Hunter account balances were read but not
classified as payment problems. Hunter finder/verifier errors did not persist a
credit-health event. The service readiness decorator also overwrote the central
credit-alert text with a normal readiness count.

Presentation now maps non-payment failures to yellow while preserving underlying
health failure states. Confirmed payment, billing and credit failures stay red.
Inline errors follow the same distinction; connected AI credentials are green.
Hunter reads the documented remaining credit/search/verification balances rather
than inferring a balance from period allocations. Missing balances remain unknown.
Confirmed billing failures from account checks and real finder/verifier calls are
recorded per workspace; verification of positive balances or successful requests
can clear their own recorded issue. No paid request is performed just to diagnose
the account. The central payment summary includes Hunter and survives decoration.

Regressions cover mixed payment/connection failures, refresh, close/reopen,
recovery, inline credential-save errors, Hunter account balances, real 402/403
credit failures, ordinary 429/invalid-key failures, persistence through status
reload, and privacy of configured keys. Backend health advertises the new alert
version, and three mandatory production smoke checks cover the frontend mapping,
colour rules and preservation of the payment summary.

Hunter account reference: https://hunter.io/api-documentation#account
Automated fixtures exercise provider responses; no actual customer's connected
Hunter or Gmail credentials are used as acceptance evidence.
