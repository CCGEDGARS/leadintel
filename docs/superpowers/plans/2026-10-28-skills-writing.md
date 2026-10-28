# Skills-first Writing Implementation Plan

> Execute natively in this session under the user's instruction to apply the agreed changes.

**Goal:** Simplify Writing Assistant and make Improve draft update the isolated working copy immediately.
**Architecture:** Reuse existing preview validation and Undo rather than bypassing them. Separate skills-only writing from one-book advisory requests.
**Tech Stack:** Vanilla JavaScript/CSS, existing Worker API, node:test and jsdom.
**Spec:** docs/superpowers/specs/2026-10-28-skills-writing-design.md

## Global constraints
Preserve masters, customer/general isolation, provenance validation, stale-response rejection, explicit saves and send gates. Maximum three selected skills. No new dependencies.

## Review focus
Empty drafts need instructions; repeated actions use current text; late responses cannot cross scope; validation failure preserves original; book advice never mutates draft.

- [x] Add behavioral tests for immediate application, repeat, Undo, empty instructions, validation and scope races.
- [x] Extend customer/writing-assistant.js with improveDraft and request source separation.
- [x] Update customer/writing-assistant-ui.js and CSS: scrollable skill list, selected chips, collapsed books, one-book discussion.
- [x] Update superseded UI expectations and run full customer tests, Step 6 checks and build.
- [x] Review diff, record actual checks and release limitations.
