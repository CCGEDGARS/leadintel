# Single-pass books Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse upload analysis for skills and accelerate all book jobs with safe parallel processing and honest progress.
**Architecture:** Versioned upload methods stored alongside existing technique data; independent cached skill packaging; durable workspace lock and bounded three-worker waves. Existing plans/checkpoints remain readable.
**Tech Stack:** Cloudflare Worker/D1/R2, plain JavaScript, Node test runner, existing UI/dialogs.
**Spec:** docs/superpowers/specs/2026-10-27-single-pass-books-design.md

## Global Constraints

- Three requests per workspace; 24 units / four-minute launch window per invocation; 120-second request deadline and drain margin.
- 3 books, 30 skills, 0–3 applied; all readable source text covered; no model retraining.
- Owner/revision/lease guards, quota metering, independent source deletion and protected templates remain.
- Legacy plans and saved work stay intact. No new model/provider choice or queue dependency.

## Review Focus

- Delete/replacement during parallel generation cannot publish late work or leak objects.
- Mixed successes and 429 failures checkpoint successes and delay new calls.
- A corrupt/incomplete prepared catalogue cannot bypass full-coverage validation.
- Two overlapping invocations/jobs for one workspace cannot double provider concurrency.
- Existing partial conversions retain IDs, progress and independently export all methods.

### Task 1: Shared processing and reusable method contract
**Files:** backend/src/book-processing.js, workspace-skill-generation.js, workspace-skill-plan.js; migration 0059; tests/book-processing.test.mjs.
**Interfaces:** boundedBookWork(items,perform,options), acquire/release workspace lock, processingProgress; validateSkillModule; skillModuleId; preparedSkillModules.
- [ ] Write/run RED tests for three concurrent calls, stop/drain, cross-job locks, prepared cache validation and progress baseline.
- [ ] Implement helpers, compact hints and migration; preserve validation of every method field/location.
- [ ] Run focused tests and commit.

### Task 2: Single-pass upload and cached/parallel conversion
**Files:** writing-reference-store/runner/analysis.js, workspace-skill-store/runner.js, fixtures and integration tests.
**Interfaces:** new coverage marker drives stable method plan; catalogue.preparedSkill={version,modules}; cached skill package publication uses prepared_count; progress public fields are additive.
- [ ] RED tests: upload -> summary -> confirmed skill with zero second-pass calls, source deletion, legacy resume, mixed failures, cancellation and bounded parallel speed.
- [ ] Implement stable versioned upload plans and cached packaging; bounded concurrent legacy/skill execution with workspace locks and checkpointed telemetry.
- [ ] Run integration/backend suite and commit.

### Task 3: Progress UI and production verification
**Files:** writing-references-ui.js/CSS/tests, cache keys, health/release config, project checkpoint.
- [ ] RED tests for percentage/rate/ETA/last-save, no false ETA, silent polling preserving controls, prepared-method confirmation.
- [ ] Implement UI, update release health/cache and document trade-offs/benchmarks.
- [ ] Run full frontend/backend/build; one independent whole-branch review, resolve important findings with RED→GREEN, publish PR/merge and exact-SHA PROVEN release.
