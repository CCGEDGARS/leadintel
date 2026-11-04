# Buyer Progress Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Concise truthful Step 5 timing and clear person Recheck behaviour.
**Architecture:** Existing durable job API supplies timing; existing client projects it; existing panel renders it. No parallel scheduler or new research state owner.
**Tech Stack:** JavaScript, Cloudflare D1, Node tests.
**Spec:** docs/superpowers/specs/2026-11-04-buyer-progress-design.md

## Global Constraints

Preserve email-only Proceed, public-only person Recheck, all paid budgets and saved evidence. Never claim a target as measured timing.

## Review Focus

- No history: explicitly unavailable estimate.
- Long or failed run: no false completion/countdown zero.
- Other workspace/paid mode: no contamination of timing sample.
- One-person recheck: preserve roster and separate batch statistics.
- Sync conflict: explicit block, no overwrite or paid request.

### Task 1: Durable timing and compact rendering

Files: backend/src/buyer-research-store.js, customer/buyer-research-jobs.js, customer/discovery-ui.js, corresponding job-store/progress tests.
- [ ] Add failing tests for isolated empirical timing and no-history/overdue rendering.
- [ ] Expose nextAttemptAt, lastResultAt, and empirical total duration range from comparable terminal runs.
- [ ] Pass timing through client and render elapsed/remaining with details collapsed.
- [ ] Run focused SQL/client/render tests.

### Task 2: Recheck clarity and result scope

Files: customer/discovery-ui.js, customer/test/buyer-recheck-button-outcomes.test.js.
- [ ] Test conflicted Recheck reports reason without starting work.
- [ ] Explain blocked Recheck and distinguish company email count from selected-batch coverage.
- [ ] Run actual source success/failure, durable client, workspace merge and recipient regressions.
- [ ] Verify exact release independently; report authenticated acceptance separately.
