# CRM Action Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent pending CRM actions and responses from leaking across accounts, workspaces or selected records, while making failure recoverable.

**Architecture:** Local operation snapshots and revisions protect UI state; shared CRM requests reject stale results. Existing authenticated APIs and durable storage remain authoritative.

**Tech Stack:** Browser JavaScript, Node 22, node:test and jsdom.

**Spec:** docs/superpowers/specs/2026-10-24-crm-action-safety-design.md

## Global Constraints

- Preserve all saved companies, contacts, intelligence and activity.
- Use LeadIntelDialogs; never native confirmation dialogs.
- Never retry a mutation automatically.
- No real destructive action, paid lookup or email is needed for acceptance.

## Review Focus

- Same workspace with a different viewer or bridge must invalidate old work.
- Workspace A → B → A must not revive a pending approval.
- Navigating to another company or closing CRM must invalidate pending approval.
- Transport rejection must unlock the record without claiming failure implies no server commit.
- Read-only roles and owner-only actions remain consistent with backend authorization.

### Task 1: Guard CRM operations and recover failed actions

**Files:** customer/crm-ui.js, customer/server-bridge.js; customer/test/crm-action-safety.test.js, customer/test/crm-request-scope.test.js and affected CRM fixtures.

- [x] Write and observe failing regressions for confirmation context drift, stale reads/results, duplicate submit, rejected requests and role gates.
- [x] Implement operation snapshots, invalidation and pending/error rendering in the existing CRM controller. Add the shared CRM request response guard.
- [x] Verify successful action refresh, retry, contact archive and buyer-save guards; keep pagination/history tests green.

### Task 2: Release and document

**Files:** customer/index.html, customer/shell-support-loader.js, release-integrity.config.json; docs/project-state/2026-10-24-crm-action-safety.md.

- [x] Bump actual entry URLs and CRM CSS version; add a release smoke assertion for the new guard.
- [x] Run the full customer suite, build, syntax and diff checks. Review the final diff.
- [ ] Publish, merge after exact-head CI success, and obtain exact merged-SHA PROVEN production evidence.
- [ ] Record evidence and browser limitations; return the verified release link.
