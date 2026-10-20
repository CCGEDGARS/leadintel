# Research reliability and durable workspace records

Authorized: find and fix interrupted/failed company research and the 500 KB sync ceiling.

1. Reproduce a researched workspace above 500 KB with the real SQLite migrations; prove save/read, CAS conflicts, quota rollback and workspace isolation. Add a negotiated record codec so existing clients retain their existing safety ceiling.
2. Store large payloads in dedicated workspace-scoped, immutable content-addressed chunks. Keep only a small manifest in workspace/flow rows. Include chunks and the CAS/flow projections in one transaction. Hydrate every backend consumer, protect original scripts before storage, meter chunks against existing storage allowances, and reclaim only unreferenced snapshots.
3. Reproduce invalid purchasing-fit quotes and transient AI failures. Retry only failed assessments with bounded single-company evidence; retain successful batches and report evidence rejection separately from transport failure. Preserve provider and call-budget gates.
4. Derive current attention from the newest attempt per task scope; keep older attempts in history. Test success, cancellation, distinct companies and active tasks.
5. Run customer/backend suites, build and review the final diff. Merge through CI and verify exact-SHA production proof and authenticated save/reload. Record root causes and limits.
