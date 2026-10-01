# Report deletion and recurring-error controls

Missed basic report lifecycle controls: added individual Delete and Delete all saved reports with confirmation. Only snapshot history is removed; Strategy source evidence, opportunities and research state remain. Persistent initialized marker prevents automatic legacy migration from recreating deleted reports on render/reload. New completed runs can still save new reports.

Reviewed the 30 September checkpoint and 1 October research/diagnostic changes. Recurring failures and controls:
- Acknowledging an authorized fix without acting: complete implementation, validation and publication before final response.
- Incomplete lifecycle: check create, view, save/reopen, export/print, individual delete, bulk delete, cancellation and empty state.
- State reinitialization/data loss: test normalized reload and preserve downstream evidence separately from report history.
- Timeout-only fixes and arrival-order caps: retain real provider errors; rank merged candidates before limits; do not equate source count with quality.
- Customer-specific defaults: derive runtime behavior from active workspace; retain cross-industry regression checks.
- Overclaimed verification: separate test/deployment evidence from authenticated real provider acceptance. User deferred the latter until the end.
- Repeated approval requests: existing authorization covers these reversible fixes and publication.

Tests cover deleting one/all, normalized reload, preservation of source evidence and saving a new report after deletion. Production release must pass exact-SHA proof.
