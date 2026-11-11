# Monitoring categories implementation plan

Spec: `docs/superpowers/specs/2026-11-11-monitoring-categories-design.md`
Execution: inline, user delegated routine decisions and implementation.

## Global constraints
Preserve legacy config and core templates. No live outreach or paid contacts. Existing shared scheduler, authority and quota controls remain authoritative. Test RED→GREEN per task. Source previews are explicit bounded public reads. Never imply support from category naming alone.

## Task 1 — persistence, model and management API
Add schema, shared category/monitor helpers and scoped CRUD/preview API. Tests first: isolated categories, revisions, archive invalidation, no source writes on preview, expiry and full-quota pause.
Interfaces: monitor config row compatible with current runner; category definition hash; monitor_id='legacy' compatibility.
Expected: new management suite and current monitoring suites pass.

## Task 2 — scheduler, inbox and delivery integration
Refactor runner to resolve legacy/named config; scope run/evidence/cursor/lease. Attach finding/message origin; resolve current monitor/category authority. Retain shared mailbox caps and monitor-specific limits/duplicate protection. Test real HTTP + registered scheduled wrapper and late revocations.
Expected: original plus new scheduler/inbox/delivery suites pass, legacy behavior unchanged.

## Task 3 — category and monitor interface
Dedicated accessible manager, custom dropdown options, create/edit/archive/pause, one-page preview then activation, list histories and origin filters. Keep drafts and account/context guards. Add browser model/UI regressions.
Expected: meaningful DOM and real HTTP/browser flow passes, desktop/mobile usable.

## Task 4 — acceptance, review and release
Run production-equivalent acceptance, fresh whole-branch review (scope, workspace/category/source authority, quota, scheduling, delivery), fix Important/Critical once with RED→GREEN. Required CI, exact-SHA deployment and canonical PROVEN artifact; authenticated read-only Ercon review. Record actual scope and gaps.
Expected: evidence-backed release and acceptance; no real send.

## Review focus
Custom category/base purpose mismatch; cross-monitor lease/cursor/evidence bleed; category rename versus criteria revisions; pause at full quota; revoked membership during source preview; stale preview enabling automation; pending messages after category/archive/source edits; shared mailbox and per-monitor limits; duplicate sends across monitors; accessible dialog cancellation and unsaved edits; registered scheduler fairness.
