# Execution ledger — 2026-10-14-event-campaign-flow.md
Execution: inline. Existing session authorizes implementation and publication without another approval gate.
Preflight: event state is normalized by its model; email setup persists selection JSON without a migration; discovery already exposes scoped research routes.
Ruling: reuse the campaign recipient picker and bulk writer for event audiences via an explicit event ID; retain individual event writer — avoids duplicate CRM/import/send systems.
Task 1: models and Profile placement complete; focused event/model/layout tests pass.
Task 2: shared source/count/depth/recipient picker, persistence and discovery adapters implemented; mixed route test and backend setup tests pass.
Task 3: exact-edition evidence, outside/participant invitations, assistant/evidence context and changed-event authorization implemented.
Fresh reviewer identified scope/edition/quick-batch/participant-broadening/new-campaign-reset/assistant-evidence gaps. Corrected with regressions; retry-path regression fixed using existing runner tests.
Ruling: exact-edition participation requires positive source text plus explicit event date/edition metadata and a recorded check date; otherwise remain unknown — protects attendee claims, may leave sparse participant lists unconfirmed.
Ruling: source-unavailable and system-discovery budget shortfalls are reported, never completed with weak matches.

Full customer suite: 2622/2622. Full backend suite: 620/620. Build and focused latest picker/layout checks pass. Release smoke checks updated. Fresh whole-branch review completed; all important findings corrected with regression coverage. Publication proof pending.
