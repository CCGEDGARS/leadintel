# Workspace status and blocked buyer controls — 30 October 2026

## Evidence and causes

The customer screenshots show a completed CRM refresh still titled as a connection failure, an unmet buyer-quality check titled as met, and public Recheck advertised while every buyer action is disabled by a sync conflict.

Reproduction found:

- Task completion retained the failed task title and retry capability. Rebinding durable task actions after reload could restore Retry on a completed task.
- Buyer quality used the success label for both passing and failing states. Journey guidance did not prioritize the workspace sync prerequisite.
- Page checks omitted the server-conflict event and targeted the legacy header's now-hidden recovery controls. Journey guidance likewise omitted conflict/synced refresh events. Buyer cards offered no local recovery control.
- The keyed-record merger rejected independent first additions when their baseline list was absent. Two sessions adding distinct stable buyer identities then produced a false overlap. This scenario is reproduced; the screenshot alone does not identify the conflicting fields in the customer's workspace.
- Paid-search ON describes saved permission. It does not establish remaining lookup budget, provider readiness or a successful lookup. Saved historical provider/limit errors were displayed without identifying their historical scope, and the public Recheck advice ignored the current sync block.

## Fix and prevention

Normalize completed CRM task presentation and terminal capabilities, including persisted history and handler rebinding. Use outcome-dependent buyer-quality labels. Refresh page/journey checks on conflict and synchronization events; route recovery to the visible Workspace status surface. Prioritize sync recovery over downstream quality actions and provide the same recovery action beside blocked buyer controls.

Treat absent baseline arrays as empty only for approved keyed-record lists. Live deletion, duplicate/unknown identities, competing identity/email evidence, missing/wrong-workspace baselines and recovery-backup failures remain protected conflicts. Reproduce 409 -> backup -> merged PUT -> acknowledged snapshot -> reload with both buyers retained.

Label saved paid attempts as history and explain permission versus budget. Recheck advice reflects the actual sync gate. No provider request, paid consent, budget, saved message master or sending approval is changed by these fixes.

Regression coverage exercises failure -> retry -> success -> reload, stale terminal actions, immediate conflict events, visible recovery routing, sync-priority restoration, independent first buyer additions, overlapping identities, 409 save/reload and historical paid holds without initiating paid lookups. The release gate checks changed runtime assets and versioned entry points. These checks prevent the reproduced recurrences; real concurrent business edits must still be reviewed rather than silently overwritten.

Authenticated customer conflict resolution and real paid-provider outcomes require separate evidence. No such outcome is inferred from unit tests, screenshots or deployment proof.
