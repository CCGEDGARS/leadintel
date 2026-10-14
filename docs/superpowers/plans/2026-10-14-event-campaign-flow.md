# Shared Event Campaign Flow Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Run a fresh whole-branch review at the end.

**Goal:** Implement the approved event/campaign choices in one shared workflow.
**Architecture:** Extend existing event model, email campaign setup/selection JSON and discovery adapters; reuse CRM, contact discovery, writing and delivery. No parallel sender/research subsystem.
**Tech Stack:** browser JavaScript, Worker JavaScript, D1, Node test/JSDOM.
**Spec:** docs/superpowers/specs/2026-10-14-event-campaign-flow.md

## Global Constraints
- Optional setup belongs at end of Step 2; incomplete drafts allowed.
- No invented attendance, paid-provider claims, core-template mutation, automatic approval or sending.
- Supplied targets retained; system additions qualified; scope changes stop stale async work.

## Review Focus
- Existing saved event migration and unfinished stand/date fields.
- All/list/selected quantities and cross-workspace async completions.
- No attendee data, old event edition, company vs person evidence.
- Event changed after review/queue; delivery must stop.
- Direct path with missing contacts/email must report gaps without research.

### Task 1: Models and setup placement
Files: customer/event-campaigns.js, customer/event-campaign-ui.js, customer/email-campaign-ui.js, customer/event-campaigns.css; tests event-campaigns/campaign-studio.
- [x] Add failing tests for draft save, audience/source metadata, qualification dedupe, conditional fields and Step 2 placement.
- [x] Implement event defaults/schema and shared campaign selection controls.
- [x] Verify focused tests.

### Task 2: Shared research and recipient routes
Files: customer/discovery-ui.js, customer/email-campaign-ui.js, backend/src/email-campaigns.js.
Interfaces: email UI opens event-linked selection; Discovery discovers qualified additions/researches supplied targets; selection carries event ID/depth/count/contact cap.
- [x] Add failing tests for source options, save/reload and direct route with no research.
- [x] Implement persisted selection, scoped discovery additions, contact cap and event handoff.
- [x] Verify campaign/research/backend tests.

### Task 3: Event evidence and invitations
Files: customer/event-campaigns.js, customer/discovery-ui.js, customer/event-campaign-ui.js, backend/src/email-campaigns.js.
Interfaces: EventCampaigns derives attendance and drafts; CRM evidence feeds event-linked backend source/hash.
- [x] Add failing tests for outside/participant queries, edition-bound company evidence and changed-event approval.
- [x] Implement evidence carryover, conditional outside invitation and current-event source fingerprint.
- [x] Verify all event/campaign tests and workspace protections.

### Task 4: Release
- [x] Run full customer/backend suites and build, inspect diff and fresh-review findings.
- [x] Document supported paths, evidence gaps and user steps; add release smoke checks.
- [ ] Publish exact SHA and retrieve PROVEN release proof before claiming live.
