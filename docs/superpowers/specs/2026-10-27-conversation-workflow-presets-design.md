# Approved conversation workflow presets

The user approved implementation on 27 October 2026 after discussing saved presets, one default, one-time approval of scripts/timing/steps, automation for silence and replies, and manual takeover. This document records that scope; it does not authorize sending to real recipients during development.

## Intent and approaches

Use saved workflow presets rather than one inflexible global sequence or repetitive per-contact approval. Owners approve exact scripts, timing, scope and allowed response branches once. A default enrolls future confirmed LeadIntel Gmail threads; existing conversations require explicit application. Presets can also be applied individually. Initial outreach still uses its existing approval/send flow.

## Behaviour

- Workspace-scoped durable presets with immutable approval snapshots/revisions, owner-only approval/default management and explicit deactivation/deletion. Changes require renewed approval and cannot silently broaden running authorization.
- One to three distinct no-response steps, default business days 3/7/14; timezone/send window/daily limits remain the existing policy. Show timing and scripts before approval. No past-due bursts.
- Optional exact response scripts for clearly positive replies and meeting requests, with a configurable minimum response delay. One automatic response per incoming message, never an unbounded autoresponder exchange. Other questions, objections, referrals, ambiguous timing, negotiation, rejection, bounce and uncertainty require a task or stop. No free-form AI responses, inferred commitments or unverified calendar claims. Approved scripts remain separate from protected initial-email masters.
- A fresh inbound reply cancels stale pending messages. Manual outbound or Take over pauses the workflow. Owner can explicitly Resume after viewing the next actions; stale/changed context cannot resume. Do not replay expired or already-sent steps. Continue monitoring paused/completed threads.
- Every send checks fresh mailbox chronology, owner/mailbox/contact identity, suppression, CRM eligibility, approved preset revision, pause state, limits/windows and atomic send claims immediately before Gmail. Failed checks hold; ambiguous send outcomes never retry blindly. Never contact real prospects in tests.
- Conversations top-bar control carries attention count and labelled severity; opens a panel/dashboard showing replies/tasks, scheduled/waiting, manual control, completed and blocked states. Show latest development, next action, last sync, exact next send/time, and takeover/resume. New reply remains actionable until acknowledged/task completed. Do not label a meeting request as a confirmed booking.
- Existing manual workflows, per-thread approved sequences, campaigns, and global legacy manual-only switch remain compatible. Default approval does not enroll pre-existing threads silently. Server-side durable history and storage accounting; workspace/role isolation and context races covered.

## API contract for implementation

Extend authenticated conversation routing. GET `/api/conversation-workflows` returns `{workflows:[{id,name,revision,isDefault,active,approvedAt,config}],defaultWorkflowId}`. POST saves/approves `{id?,expectedRevision?,name,approved:true,isDefault,config:{steps:[{days,body}],replyDelayMinutes,replyScripts:{positive?,meeting_request?}}}`. POST `/api/conversation-workflows/:id/deactivate` and `/delete` disable/delete without erasing conversation history; active assignments must stop. Only owners manage presets.

POST `/api/conversations/:id/workflow` with `{workflowId,contextVersion}` explicitly applies an approved workflow to an existing thread; POST `takeover` pauses; POST `resume` requires current `contextVersion` and explicit `approved:true`. Owner/sales may take over; owner resumes/assigns. GET conversations adds `workflows` metadata if convenient, and each row `workflow:{id,name,revision,status,nextSendAt,nextBody,error}|null`, `controlMode` (`automatic`/`manual`), and `needsAttention`. Keep old fields backward compatible. UI can fetch workflows separately.

## Validation and practical limits

Use real SQLite fixtures and mocked Gmail providers to verify approval → future enrollment → silence sends → reply branch → duplicate poll → takeover → manual outbound → explicit resume, role/isolation boundaries, changed preset/mailbox, opt-out, ambiguous replies, stale context and uncertain send. Rendered UI tests cover preset save/reload, confirmation/cancel, takeover/resume, badges and workspace switching. Run full backend/customer suites and static build. Production release and authenticated customer acceptance are separate from local verification.
