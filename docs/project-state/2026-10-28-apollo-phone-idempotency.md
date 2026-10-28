# PR 760 — paid phone lookup completion

## Root causes

The original duplicate check used a read followed by an unconditional request insert. Concurrent requests could both dispatch a paid reveal. Callback handling checked idempotency before updating, wrote contacts before claiming the receipt, and could arrive before a contact was linked. A subsequent initial response could overwrite callback status/credits. Empty callbacks used a terminal status absent from the SQL constraint. Phone traces were dropped by workspace/CRM serializers, and refresh presented every missing number as pending.

## Controls

- One D1 INSERT/SELECT atomically checks the active/recent same-person request, retained phone and combined credit budget while reserving the lookup. All callbacks and requests remain workspace/company/person scoped. No schema migration is needed.
- Link the selected contact before dispatch. Save the initial provider receipt before CRM projection. An uncertain network outcome retains its reservation and pending request; it cannot silently authorize another paid retry.
- Signed callbacks atomically claim and persist the result once, add actual callback credits once, and preserve an early callback when the initial response arrives later. Interim callbacks remain pending. Exact provider identity must match before data reaches a selected buyer. Old receipts require exact retained provider identity.
- The durable callback inbox supports replay after partial projection failure. CRM refresh repairs unfinished projection without calling a provider. Completed projection never overwrites later manual contact corrections. Archived contacts stay archived.
- Treg no-result/failure may fall back to Apollo only with explicit workflow phone approval, current Buyer Agent identity evidence, an unambiguous directory ID, the workspace capability, webhook signing and credit policy. Existing usable phones are retained. Server callback signing remains separate from the workspace billing credential.
- CRM stores provider trace/request IDs and returns authoritative ledger status on reload. UI distinguishes pending, terminal-empty and available results. Callback completion refreshes the saved Buyer Agent trace without replacing unrelated company intelligence.

## Verification

Regressions use fictional contacts and mocked providers only. They cover simultaneous requests/budgets, early/concurrent/replayed callbacks, partial-write recovery, identity mismatch, manual corrections, interim/empty results, uncertain dispatch, Treg fallback approval/ambiguity/capability/webhook/budget gates, CRM persistence and frontend refresh. No paid Apollo lookup for Klas Nilsson and no outreach execution is part of validation. Require full backend/customer CI, then exact-SHA deployment and production proof before completion.
