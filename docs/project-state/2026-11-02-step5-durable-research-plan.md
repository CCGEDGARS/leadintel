# Step 5 durable recovery implementation contract

Status: implemented and controlled authenticated acceptance passed; exact-release production verification pending. Acceptance against the owner's actual saved workspace and real providers remains open. The recovery contract and existing source/contact/approval policies govern.

## Observable outcome

Start/resume a free-source Buyers job once, publish useful named findings as they arrive, close/reopen the browser, and restore the same persisted job without rerunning completed work. One unavailable source does not skip other useful sources. Preserve all nine base per-person queries and the priority deep wave. An accepted exact-person official email/phone retains its provenance and the exact selected buyer reaches Messages/CRM. Genuine identity or same-record conflicts remain held; unrelated edits are preserved.

## Ownership and compatibility

D1 owns job input, phase, result projection and individual search/read receipts. The browser issues commands and observes snapshots. Existing workspace/CRM snapshots remain compatibility projections and never control job lifetime or its checkpoint. Existing dossier and official-source engines are reused. No paid contact lookup or sending is introduced. Older data is not deleted or silently replaced with invented contacts.

## API and data

`/api/buyers/research?workspace_id=...`: GET by domain/job_id is read-only. POST actions start/resume/cancel are authenticated owner/researcher/sales commands. Returns `{job}` with id/domain/contextKey/input/status/phase/revision/updatedAt/candidate/diagnostics/progress. Statuses queued/running/needs_review/complete/failed/canceled are distinct. Job input includes bounded company/domain/profile/roles/personIds. Concurrent duplicate starts share an active job; a context replacement cancels stale execution via lease/CAS guards. Resume retries missing/failed receipts within bounds; force creates a new generation only on explicit request.

New workspace-scoped jobs and task-receipt tables have foreign keys and one active job per company. Every runner checkpoint and result write checks current lease, job status, session/member authority and request context. Cancellation/revocation blocks late writes. Actual results have bounded bodies/receipts and no secrets are exposed.

## Execution and budgets

Use the existing minute scheduler; start may wake a short bounded processing slice through waitUntil. Phases collect official company contacts, checkpointed dossier passes, remaining identities, mandatory per-person research and AI evidence review. Search/read receipts are reused across slices. Work windows, provider deadlines, per-task attempts and cumulative phase budgets are separate. Terminal incomplete work becomes needs_review with explicit gaps; it never loops indefinitely or calls paid enrichment. Useful official findings survive incomplete dossier/review phases.

## Verification and release

1. Test store/routes with production SQL and actual hashed-session auth: duplicate command, scope denial, revoke/cancel, expired lease, late result, reload/resume, successful receipt reuse, changed context and bounded retries.
2. Run actual Chromium against production frontend and authenticated backend routes with controlled external source/provider responses. Exercise CAS conflicts, accepted named official data, reload and exact Messages/CRM handoff; retain screenshots and assertions.
3. Run meaningful engine failure tests and complete relevant regression suites, build and syntax checks. Inspect changed trust boundaries and rollback compatibility.
4. Publish only scoped paths, verify exact-SHA CI/deployment/manifest/health/mandatory smokes and PROVEN proof. Separately report actual live-provider/customer acceptance and any remaining access gap. No production outcome is inferred from fixture success.

## Rollback

Keep old saved work and legacy code paths during migration, but the new production entry must not silently fall back to repeated browser-provider orchestration on a job error. Removing the new client entry restores the prior path without deleting authoritative job data. Server schema additions are backward-compatible. Roll back exact release through existing approved deployment controls if acceptance fails.

## Controlled acceptance obtained

The actual frontend runs in Chromium against production backend routes, hashed sessions, all SQL migrations and competing browser revisions. External source/provider responses are controlled. The browser starts a job, closes after its official phase, and reopens after background processing. The worker never writes the broad workspace snapshot; reopen uses GET only and repeats no provider work. Published named email/phone evidence survives delayed confirmation, a real unrelated-edit 409 merge and reload, the first-ever Messages recipient, actual CRM draft saving, and fresh browser storage. A deliberate same-person identity edit preserves both versions and blocks recipient selection. Four screenshots and an evidence JSON are uploaded by the mandatory Customer V2 CI browser job; missing Chromium fails that job. No paid request, outbound message or delivery queue entry occurs.

The journey exposed two production bugs beyond research execution: first-recipient history dereferenced null, and a genuine merge/reload could interrupt Messages creation after recipient intent was saved. Both are reproduced and repaired. Handoff recovery replays only an exact persisted intent through existing identity and accepted CRM recipient checks.

Separate real-SQL phase journeys use two industries. The sourced manufacturing case reaches four qualified priority buyers, two accepted work emails, complete mandatory research and completed AI/Buyer Agent review. The healthcare case completes actual required checks and retains two emails but stays needs_review because opportunity responsibility is unsupported. Selected-person Recheck performs only the selected person's mandatory plan and does not claim the full-company quality target passed. Failure cases cover unavailable media followed by useful sources, source attribution conflicts, lease replacement, revocation/cancellation, changed seller context, quota exhaustion, receipt reuse and truthful executed-tool counts.

Local full customer suite: 5,235 passed, zero skipped. Local full backend suite: 1,687 passed, zero skipped, including Chromium under concurrent load. Later added tool-accounting cases receive a separate focused run; exact publication is rechecked by CI. Browser acceptance also passed two independent concurrent-load repeats without increasing its timeout. Static production build passed.

Scope: this replaces the authenticated manual/free Buyers and Recheck browser orchestration. Existing approved automatic workflows retain their separate leased backend runner and consume the same shared engine policy; unifying their job records is not claimed here. Actual customer conflict fields and real-provider completion/cost have not been observed. Controlled results and release provenance cannot establish those outcomes.
