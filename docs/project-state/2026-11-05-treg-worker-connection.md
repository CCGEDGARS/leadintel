# Treg connection request rejected before dispatch

Customer evidence: Test & save reported TREG_NETWORK_ERROR; paid email consequently reported no connected Treg account.

Root cause reproduced in workerd: verifyTreg used redirect:error, unsupported by Cloudflare Workers. Native Request construction throws before any outbound call. Node tests mocked fetch and asserted the unsupported option, so they passed without testing the deployed runtime. The earlier diagnostic change exposed the catch category but did not repair this defect.

Fix: redirect:manual with explicit rejection of every 3xx response. No token is forwarded to a redirect destination. Keep the documented GET /home and X-Treg-Token REST authentication; no metered call is needed to save a connection. Fixed diagnostics never include upstream response bodies or secrets.

Regression: native workerd fetch through Miniflare, intercepted only at the outbound service boundary, proves GET reaches the endpoint, returns verified team/balance metadata, and sends no follow-up request for a redirect. SQLite route tests cover encrypted save, revalidation, rejected credentials and safe audit diagnostics.

The connected Treg plugin balance succeeds, but it uses a separate credential from LeadIntel. Actual customer Test & save and paid lookup acceptance require the customer's authenticated connection; fixture success cannot establish them. No paid credits spent for this change.
