# Monitoring approval returns to its originating task

The owner delegated product and implementation decisions and asked to proceed without repeated design questions. Keep the existing JavaScript app, normal Profile/Strategy approval controls and backend monitoring service.

## Problem and chosen approach

The shared Ercon session established that monitoring settings save and survive reload, but Profile and Strategy are unapproved. The monitoring entry redirects to Profile review without retaining a clear continuation. The controlled browser acceptance additionally shows Strategy activation opening Companies and starting unrelated discovery. Monitoring setup should return to monitoring after its approval prerequisites are satisfied.

Keep one transient, account/workspace/seller/market-bound continuation in the existing app. The normal Strategy review and activation remain authoritative. Review launched from monitoring changes the destination and review copy; normal Companies activation retains its existing behavior. Profile approval continues the pending monitoring review. Cancel returns to monitoring. A stale account, seller or market discards the continuation. No credentials, Profile content or approval decisions are duplicated in a new store.

Other approaches considered: simply add navigation instructions (leaves the incorrect destination and research side effect); introduce a separate monitoring-only Strategy approval endpoint (duplicates approval ownership). Reusing the current approval transaction with a bounded destination is the smallest coherent change. This is an implementation decision made under the owner's delegation.

## Acceptance

- Saved off monitoring settings remain intact through Profile and Strategy review.
- Approval gates and acknowledged server persistence remain mandatory.
- Monitoring review names the destination and does not imply that approval enables a schedule.
- Successful activation returns to the actual Profile monitoring wrapper without starting company discovery or monitoring research.
- Profile review has a clear continuation/cancel action. No automatic approval occurs.
- Cancel, save failure, account/workspace/seller/market changes and cancellation during persistence cannot cause stale navigation or research.
- The normal Companies activation still starts its bounded search after acknowledged approval.
- Browser acceptance exercises real HTTP/SQL and the registered monitoring scheduler; controlled results remain distinct from customer results.

## Verification and product readiness

Use focused failure-first regressions, the authenticated monitoring browser journey, adjacent Strategy/Profile tests, the full customer suite and the existing mandatory CI journeys. Release only with an exact-SHA PROVEN production proof. Private customer Profile review remains a separate blocked acceptance item: automatic approval review rejected its export to Firecrawl. The monitoring settings already saved in that account are not evidence of enabled automation or completed research.
