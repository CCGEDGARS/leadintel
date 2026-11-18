# Protected saved workflows — 18 November 2026

## Scope and separate paused work

Owner paused Storage/Stripe and explicitly moved to workflows. Unfinished storage work is isolated in `/workspace/leadintel-storage`, branch `feature/storage-management-cost-plus-20261118`; it is not part of this change. No Stripe writes or charges were made. That branch's draft migration number 0076 must be renumbered before any future integration; its cleanup must also preserve workflow versions.

## Observable outcome

Main navigation shows the selected workflow immediately beside CRM. The name and protected version come from the authenticated workspace, not unscoped browser storage. The dropdown switches workflows or opens Save, duplicate & manage workflows. It shows Running, Paused, Manual or Needs attention; opening does not activate automation. Mobile keeps CRM and the workflow control together. Controls survive CRM being mounted after the top bar.

Newly saved workflows snapshot the complete business context and message-library content. Previously, reopening overlaid current workspace business details and original/personal template libraries, silently changing the effective saved environment. `snapshot_policy=pinned` now returns the saved data, including exact script text, instead of this overlay. Connections, credentials, CRM records and mailbox/provider spending controls remain shared server authorities; copying a workflow never duplicates credentials or grants sending approval.

The working copy continues to autosave via the existing workspace CAS and flow projection. Explicit Save protected version appends an immutable server record of the full payload and automation configuration. AI generation and ordinary autosave cannot update these records. Initial save and duplication create version 1. Up to 50 versions per workflow, within the existing quota; older versions are never silently pruned. Existing 10-flow and 2-active-flow limits remain.

Version history creates a separate paused copy of an older configuration. It never rewinds sent messages, CRM or the original's working progress. Duplicates preserve settings and exact template text, clear recipients/research results/queues, and require the existing complete review/approval sequence before automation can run. A normal Open resumes saved working progress, including the last journey step.

Legacy workflows retain their established shared-business behavior until the owner opens one and selects Save protected version. The UI explicitly identifies these flows. This avoids silently changing already-approved running workflows during migration.

## Preservation and authorization

All versions are workspace-scoped. Membership/session and captured row assertions run in the same transaction as creation and checkpoint writes. Mutations are owner-only. Stale saves fail without overwriting newer work. Script restoration from a pinned server snapshot uses internal authority only after authenticated saved-flow row assertions; ordinary browser writes retain the platform-originals restriction.

Large version payloads use existing content-addressed research chunks. GC includes immutable versions as owners. A database trigger also protects referenced chunks from older workers during rolling deployments. Version bytes count against the existing storage allowance; quota failures roll back both the new record and version pointer. No billing behavior is changed.

Deploy additive migrations 0076 and 0077 before the backend. Do not drop version tables or their payload-protection trigger on rollback. An older frontend may be used while retaining the version-aware backend and migrations; older backend GC is guarded by the SQL protection trigger. Saved data is not rewritten during migration.

## Validation and limits

- Authenticated HTTP/SQLite tests exercise create, checkpoint, copy, reopen, exact script preservation, cross-workspace denial, session revocation, quota rollback, immutable rows, large payloads and old-worker GC protection.
- Existing shared-flow scheduler authorization regressions remain explicitly exercised as legacy behavior. A pinned-flow test enters through the real app scheduled wrapper and proves unrelated workspace changes do not replace its approved context; stage execution uses controlled stubs, not paid providers or real sending.
- Browser journey: `node scripts/verify-saved-workflows-local.mjs`. Real Chromium, actual client modules and actual flow/state SQL routes: topbar → protected version → duplicate → edit → reload → switch back. Runs against an ephemeral database with no customer data or external provider calls. Includes mobile placement assertion.
- Run customer and backend suites, the static build, and `git diff --check`. Their outcomes are recorded in the completion response.
- This document does not establish production deployment, actual customer-account acceptance or external-provider outcomes.

Local verification completed: the focused backend suite passed 188 tests, the final UI/admin suite passed 40 tests, and the additional final snapshot/original-script authority suite passed 10 tests. The D1 migration/runtime checks and static build passed. The Chromium workflow journey passed with exact settings/script preservation after duplication, reload and switching back, plus mobile placement beside CRM.

The broad regression run is not a clean acceptance gate: the initial customer run caught an admin stylesheet cache-token mismatch (fixed and retested). Broader backend browser journeys reported startup/action timeouts, and a company-list journey reported a missing retained signal. Buyers browser failures and the exact company-list missing-signal assertion were reproduced on unchanged base commit `878c1bff` (the comparison completed with 1 passing and 3 failing tests). Event and market-research timeout failures remain unclassified. Do not substitute the focused passing checks for a full-suite or production acceptance claim.

## Recurrence control

Every future saved-flow field must be classified explicitly as saved configuration, working progress or shared server authority. Test exact text after changing another workflow, not only list counts or successful saves. When introducing another immutable payload owner, update both GC ownership and rolling-deployment protection before releasing it.
