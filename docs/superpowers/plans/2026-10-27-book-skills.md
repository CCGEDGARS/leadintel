# Book Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Create reusable book-derived skills with durable storage, export and contextual AI use.
**Architecture:** Independent D1 skill records and private R2 snapshots; resumable chunk generation under the existing minute scheduler; workspace-scoped retrieval.
**Tech Stack:** JavaScript, Cloudflare D1/R2/Workers, existing AI provider, DOM UI and node:test.
**Spec:** docs/superpowers/specs/2026-10-27-book-skills-design.md

## Global Constraints
- 3 book uploads, 30 skills per workspace, at most 3 relevant skills per request.
- Exact saved book title without extension. Original deletion preserves skills.
- Owner-only mutations, authenticated workspace isolation, revision and lease guards.
- All readable chunks processed before Ready. Coverage and errors explicit.
- Advisory-only use; protected masters and operational flows cannot be overridden.

## Review Focus
- Concurrent creation at capacity and duplicate clicks must not spend twice.
- Book deletion/replacement during generation must not destroy the snapshot.
- Skill deletion or disabled state during inference must invalidate stale proposals.
- Non-English requests must use semantic selection, not English-only matching.
- Malformed model output and private source instructions must not become authority.

### Task 1: Independent persistence and resumable generation
Files: backend/migrations/0055_workspace_skills.sql, backend/src/workspace-skill-{store,generation,runner,export}.js, backend/test/workspace-skills.test.mjs.
Interfaces: createWorkspaceSkill(env,scope,{sourceId,expectedRevision}); listWorkspaceSkills(env,scope); runWorkspaceSkillJobs(env,options); getWorkspaceSkill; mutateWorkspaceSkill; skillPackage.
- [ ] Write failing persistence/generation tests and observe RED.
- [ ] Implement snapshot, atomic limit, deduplication, leases, complete generation, retry and deletion.
- [ ] Verify independence, all-chunk depth, malformed output, capacity, concurrency and ZIP integrity; commit.

### Task 2: Authenticated API and library interface
Files: backend/src/workspace-skill-routes.js, backend/src/app.js, customer/writing-references-{api,ui,loader}.js, customer/writing-references.css; route and DOM tests.
Interfaces: /api/workspace-skills list/create/detail/download/patch/delete/retry; existing writing API wraps skills calls.
- [ ] Write failing routes/UI tests and observe RED.
- [ ] Implement auth, confirmation, tabs, skill controls, polling, download and workspace/disposal guards.
- [ ] Verify cancellation, enablement, errors, refresh, limits and safe rendering; commit.

### Task 3: Assistant selection and evidence
Files: backend/src/workspace-skill-context.js, backend/src/copilot-{service,routes}.js, backend/src/writing-assistant.js, customer/copilot-ui.js, customer/writing-assistant*.js and loader; context tests.
Interfaces: selectWorkspaceSkillContext returns validated skills/modules; assertWorkspaceSkillsCurrent guards inference and apply; selected IDs/revisions travel in provenance.
- [ ] Write failing semantic-selection, no-relevance, isolation and stale-state tests; observe RED.
- [ ] Integrate zero-to-three semantic skills into Ask LeadIntel and explicit Writing Assistant selection.
- [ ] Verify reported use, protected masters, non-English and cross-industry context; commit.

### Task 4: Release and verification
- [ ] Document behavior and limitations; add cache tokens, health version and mandatory release checks.
- [ ] Run complete frontend/backend suites and build; obtain independent whole-branch review and resolve important findings.
- [ ] Publish PR, verify exact-SHA CI, merge, and obtain exact-SHA PROVEN release proof.
