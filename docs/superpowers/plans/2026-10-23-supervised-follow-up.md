# Supervised Follow-up Implementation Plan

User explicitly authorized complete implementation. Execute within isolated branch; no real prospect messages in verification.

**Goal:** Approved per-thread follow-ups, persistent monitoring and next-action work queue.
**Architecture:** Extend Gmail/CRM and existing scheduler/automation safeguards; dedicated persistent conversation/task data. Reuse existing Follow-Up Assistant for substantive drafts.
**Tech Stack:** Cloudflare Worker/D1, JavaScript browser UI, Node SQLite and jsdom tests.
**Spec:** docs/superpowers/specs/2026-10-23-supervised-follow-up.md

## Global Constraints
- Exact reviewed follow-ups only; substantive replies require human review. No initial resend.
- Three distinct messages at 3,7,14 business days by default; finite stop.
- Every reply/manual Gmail send cancels stale sequence; failed pre-send sync holds send.
- Workspace isolation, suppression, existing authorization, daily limits, windows and spacing remain enforced.
- No real emails during tests; release evidence exact SHA; app confirmations use LeadIntelDialogs.confirm.

## Review Focus
- Replies after stopped/completed sequence, multiple replies and CRM failure recovery.
- Aliased manual sender, bounce, opt-out, negative answer mixed with quoted prior content.
- Simultaneous cron/sync/approval/cancel, ambiguous send and mailbox reconnection.
- Overdue dates, DST business-day math and no catch-up bursts.
- Workspace switch during request, stored XSS, draft editing and no accidental send.

### Task 1: Backend conversation monitoring and supervised plans
Files: backend/src/conversation*.js, backend/migrations/0049_supervised_follow_up.sql, backend/src/app.js, backend/src/index.js; integrate existing Gmail/reply/runner modules as needed; backend/test/conversation*.test.mjs.
Interfaces: consume existing Gmail confirmed sends, CRM and Follow-Up Assistant; produce exact /api/conversations contract in spec.
- [ ] Write failing integration tests with actual SQLite and injected Gmail, observe failures.
- [ ] Implement durable monitoring/recommendations/tasks, exact reviewed plan queue and fail-closed send. Reuse existing runner/safeguards when practical.
- [ ] Test all Review Focus backend cases, legacy regression; document API choices.

### Task 2: Customer conversation panel
Files: customer/conversation-ui.js, customer/conversation.css, customer/test/conversation-ui.test.js, customer/index.html, customer/outreach-ui.js.
Interfaces: consume /api/conversations contract and existing follow-up-assistant endpoints; module mount(root,{bridge,request,confirm}) test adapters allowed; use active bridge workspace and session.
- [ ] Write jsdom failing tests for render, plan distinct messages, explicit confirmation, cancellation, stale context, task completion, reply AI draft/save no-send, observe failures.
- [ ] Implement Delivery panel with ongoing status, history/recommendation/tasks, exact 3-message review/activation and reply draft/save.
- [ ] Integrate entry boundary and cache version; verify browser build and full customer tests.

### Task 3: Integration, review and release
- [ ] Run complete backend/customer suites and static build; fix regressions.
- [ ] Fresh review against spec; resolve important findings with regression checks.
- [ ] Commit/push branch, PR/CI and release using repository integrity workflow; user authorization includes applying changes.
- [ ] Verify exact-SHA release proof, report actual active scope and any authenticated Gmail verification gaps.
