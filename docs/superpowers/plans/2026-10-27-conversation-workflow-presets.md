# Conversation Workflow Presets Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. Keep existing isolated cloud checkout; no extra worktree.

**Goal:** Approve communication presets once, automate bounded follow-ups/reply scripts, and expose monitoring plus manual takeover.

**Architecture:** Extend the existing authenticated conversation system with durable approved presets/assignments and a guarded runner. Keep transport, limits, CRM and suppression safeguards shared; add a dedicated UI preset manager and global conversation attention entry.

**Tech Stack:** Cloudflare Worker, D1 SQLite, vanilla browser JavaScript, node:test/jsdom.

**Spec:** docs/superpowers/specs/2026-10-27-conversation-workflow-presets-design.md

## Global Constraints

- No real recipient sends, no deployment during tests.
- Use existing checkout; keep protected first-email masters unchanged.
- Owner approves preset scripts/timing once; never infer authorization from inactivity.
- Takeover/manual outbound must stop stale sends; changed scripts require new approval.
- Workspace isolation, fresh Gmail guards, limits, suppression, no blind retries and storage accounting mandatory.

## Review Focus

- Concurrent polling/takeover and changed presets during OAuth must prevent stale delivery.
- Duplicate replies and autoresponder chains cannot cause repeated sends.
- Default changes cannot enroll old threads or revive a paused conversation.
- Workspace switches during editing/confirmation cannot write to another workspace.
- Resume after manual outbound must not replay old follow-ups or answer an old reply.

### Task 1: Backend presets and guarded execution

**Files:** Create backend/src/conversation-workflows.js and backend/migrations/0063_conversation_workflows.sql; modify backend/src/conversations.js and backend/src/app.js; create backend/test/conversation-workflows.test.mjs and shared fixture if useful.

**Interfaces:** Produce the API and conversation metadata in the spec. Existing `/api/conversations` routes remain compatible. Runner called in the existing hourly cycle after polling. Use explicit helper interfaces to avoid cyclic imports where practical.

- [x] Write failing SQLite/provider tests covering approved presets, roles, defaults/future enrollment, no-response and reply delivery, takeover/resume, duplicate polls, suppression, revision and identity guards, uncertain delivery and deletion.
- [x] Run new tests; confirm RED for missing behaviour.
- [x] Implement storage, validation, immutable approved snapshots, authenticated routes and guarded scheduling/delivery. New preset creation sends nothing.
- [x] Run new and existing conversation tests, record GREEN and self-review.

### Task 2: Preset UI, attention control and takeover

**Files:** Modify customer/conversation-ui.js and customer/conversation.css; create customer/conversation-workflow-ui.js if needed; modify customer/index.html and topbar.js/app-shell.css as appropriate; add rendered UI tests.

**Interfaces:** Consume Task 1 REST API verbatim, preserve old conversation panel and app dialog patterns. Emit/use a scoped conversation attention event for top-bar count/severity.

- [x] Write failing rendered tests for save/approve/default/reload, cancellation, assignment, takeover/resume, timing/script visibility, attention and cross-workspace races.
- [x] Run tests; confirm RED.
- [x] Implement accessible preset manager, contextual workflow controls and top-bar Conversations entry with meaningful attention and waiting states.
- [x] Run new and existing conversation/topbar tests; confirm GREEN and self-review.

### Task 3: Integration verification and review

- [x] Review all changed code independently for the five Review Focus risks; fix meaningful findings with regression tests.
- [x] Apply local migrations twice; run full backend and customer tests plus npm run build.
- [x] Validate the local Worker serves frontend, preset auth boundary and health; document implementation and limits in docs/policies/supervised-follow-up.md.
- [x] Report local results separately from production/authenticated acceptance. Leave a reviewable branch without publishing or sending.
