# Research completion and durable record storage — 20 October 2026

## Root causes

- The 500 KB cap applied to the entire synchronized workspace, including repeatedly embedded research. It rejected new research despite the account's separate 100 MB records allowance. Compression helped temporarily but could not remove this architectural ceiling.
- An additional HTTP body cap rejected workspace requests above 1,150,000 bytes before state validation.
- Purchasing-fit AI responses sometimes paraphrased official quotes. Correctly rejecting those claims left companies unchecked, but no targeted automatic repair ran. Transport failures also received no fit-assessment retry.
- Safe concurrent-save reconciliation could reload the page while company research was running, interrupting its controller and leaving historical interrupted tasks.
- Every old failed company-discovery attempt remained a current health warning. Task-centre retries could also leave their original task ID running after the handler completed a different ID.

## Changes and invariants

Migration `0042_workspace_payload_records.sql` adds immutable, workspace-scoped, content-addressed research chunks. Large workspace and saved-flow rows hold small manifests, not embedded evidence. Manifest CAS, saved-flow projection, reclamation and chunk writes share one database transaction. Only unreferenced snapshots are collected; inactive flows retain their snapshots. Reclamation precedes replacement inserts so the final retained content determines quota use. Hash, chunk order and byte count are verified. Owner and chunks are read in one joined SELECT so concurrent save/GC cannot tear reads. Every backend state consumer hydrates records, including approved workflow, monitoring and brand-asset reference checks. Original-script authorization still runs on complete restored content before persistence.

The server advertises `workspace-records-v1` and an 8 MiB bounded transfer envelope; this is a transport safety bound, not the account storage allowance. Legacy clients retain their 500 KB encoding until capability negotiation. Research is preserved losslessly inside the record-capable envelope. Streamed HTTP reads enforce the same bound plus small JSON envelope overhead. The normal workspace storage meter and quota include chunks.

Purchasing-fit prompts offer stable IDs for exact official excerpts. The parser resolves those IDs back to supplied evidence and still rejects fabricated IDs/quotes. Each incomplete or transiently failed assessment gets at most one targeted single-company retry. Billing/authentication errors do not trigger paid retries. Successful assessments remain intact. No fit or email evidence gate is weakened.

On a save-version conflict, running research keeps its local data and retries sync later instead of reloading. Company-discovery attention reflects its latest attempt; historical tasks remain inspectable. Other unscoped task types retain independent warnings. Retrying via a new task ID finalizes the original attempt after the handler returns.

## Verification

- Real SQLite migration/HTTP tests: >500 KB saves, >1.15 MB routed requests, exact hydration, storage counters, quota rollback, CAS loser, owner+chunk read race, near-quota replacement, inactive-flow retention, missing/foreign records and forged manifests.
- Customer tests: capability-aware lossless transfer, legacy ceiling, exact quote resolution, targeted recovery, billing/auth no-retry, task retry lifecycle, independent contact warnings, conflict deferral during live research.
- Local backend tests must use `TZ=UTC`, matching GitHub CI. This sandbox defaults to America/Los_Angeles, which makes existing timezone-less SQLite UTC contact timestamps appear seven hours in the future and causes three unchanged campaign fixtures to fail. Production Worker/CI use UTC; no delivery policy was relaxed.
- Release and authenticated acceptance are recorded only after exact-SHA deployment verification. Do not infer customer company counts from unit tests.
