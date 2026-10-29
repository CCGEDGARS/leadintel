# Writing Assistant Delivery Toolbar Implementation Plan

> Execute inline in this session using superpowers:executing-plans. User already approved implementation.

**Goal:** Simplify the toolbar and save safely before returning to delivery.
**Architecture:** Existing workbench controller owns revision history; the rich editor optionally delegates Undo/Redo. The modal reuses its existing save callbacks and restores focus without invoking delivery.
**Tech stack:** Browser JavaScript, CSS, node:test and jsdom.
**Spec:** docs/superpowers/specs/2026-10-29-writing-delivery-toolbar-design.md

## Global constraints

- Preserve protected templates, exact rich text, provenance, workspace isolation and explicit approval/send boundaries.
- Never close on failed/local-only save or navigate after scope/draft/session changes.
- Keep the general and manual-channel saving paths available.

## Review focus

- Async save failure, double click and close/reopen races.
- Disabled main delivery action with incomplete customer facts.
- Undo/Redo after AI revisions, manual formatting and context changes.
- General/phone/LinkedIn do not promise email delivery.
- Narrow/short viewport keeps footer and More actions accessible.

## Task 1: Toolbar, history and safe handoff

Files: customer/writing-assistant{,-ui}.js, customer/writing-assistant.css, customer/rich-text-editor.js, customer/outreach-ui.js; customer/test/writing-delivery-toolbar.test.js and existing manual-edit tests.

- [ ] Add behavioral regression cases, run and observe failures.
- [ ] Add controller redo and optional rich-editor history delegation; render top toolbar/More and a fixed dialog footer.
- [ ] Save via finish; only a confirmed unchanged active session may close/return focus. Never click delivery.
- [ ] Update superseded Edit tests and asset cache versions; run focused tests, full customer suite, syntax and static build.
- [ ] Review diff, commit/push, merge after CI, and verify exact-SHA production proof.

Expected verification: zero failed customer tests, successful build/syntax checks, required CI for the exact SHA, production release-proof.json verdict PROVEN. Report any external blocker accurately.
