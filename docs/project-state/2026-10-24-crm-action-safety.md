# CRM action safety and recovery

## Priority and root cause

Edgars authorized ownership of the next important defect. The supplied Master CRM brief prioritizes durable, workspace-scoped commercial memory. Inspection and failing runtime tests found that company confirmations captured an ID without rechecking account/workspace/selection after awaiting the dialog. General CRM reads and shared CRM response handling did not check the complete account context. Company mutations also lacked a duplicate lock and rejected-transport recovery.

## Implemented

- UI snapshots include bridge identity, workspace object/ID, authenticated user, role and scope revision. Record revisions invalidate approvals after selection/tab/close, including A → B → A workspace transitions.
- Shared CRM response handling rejects stale account/workspace/role results before exposing their payload.
- Dispatched writes retain an account/workspace/company lock until settlement, independently of which record is open. Company changes, contact archiving and saved buyer-contact writes share this lock.
- Company confirmations name the company. Canceled or stale confirmations never issue the mutation. Viewer actions and owner-only delete/unsuppress match backend authority.
- Pending controls, inline uncertainty/errors and an explicit **Refresh record** action replace silent transport failures. No automatic mutation retry occurs. Refresh preserves the last displayed record while offline; successful reads replace it. A verified 404 reconciles the stale row without repeating a delete.
- Existing saved companies, contact evidence, pipeline-removal semantics and commercial history remain governed by existing backend APIs. No schema/data migration, provider change or message-template change.

## Review and verification

- Initial 22 failing regression cases reproduced stale confirmations/results, repeated submissions, unhandled transport rejection and missing recovery feedback, then passed after implementation.
- Independent read-only review found two important gaps: record reopening bypassed the dispatched-write lock; failed recovery reads discarded the original record/retry control. Both were reproduced with five failing navigation/recovery/404 tests and fixed. The related buyer-contact write path received an additional failing-to-passing lock regression. A final compatibility regression preserves the existing null-company event on confirmed permanent deletion.
- Final focused suite: **111/111** CRM/integration checks passed. Full Node 22 customer suite: **3,756 passed, 0 failed**. Full backend suite: **905 passed, 0 failed**. Total: **4,661 tests passed**. Production build (including staged startup isolation), JavaScript syntax and diff checks passed. Exact-SHA release evidence is recorded in the release PR.

## Boundaries and decisions

- This controller prevents duplicate writes within its page, including reopening the same company. Cross-tab/browser concurrency remains governed by the existing server API and is not a new global exactly-once guarantee.
- Never infer whether a timed-out mutation committed. Keep uncertainty visible until an authoritative read. Production testing does not delete/archive/suppress real companies, send email or run paid research.
- Browser access initially showed the previous view. After reload, the alternate DOM surface showed the released core UI, but subsequent browser interaction stalled. No fresh visual acceptance of this patch is claimed unless later evidence is recorded.
- The independent reviewer performed no production execution; release verification belongs to the executor and the mandatory machine-readable proof.

## Completion evidence

See the merged release PR for the exact intended SHA, same-SHA CI results, live manifest/ref/service, backend health, mandatory smoke results and PROVEN artifact. A test/build result alone does not establish production freshness.
