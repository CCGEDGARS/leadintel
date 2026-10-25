# Simple Writing Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved single-instruction assistant with explicit apply, draft-save and template-save semantics.
**Architecture:** Reuse workbench state, safe previews, book retrieval and existing customer/general/channel storage. Add auto request intent, remove visible preset controls and connect one draft-save action to the active context.
**Tech Stack:** Vanilla JavaScript, CSS, Cloudflare Worker, Node tests/JSDOM, existing D1 CRM and writing library.
**Spec:** docs/superpowers/specs/2026-10-25-simple-writing-assistant-design.md

## Global Constraints
- Preserve protected masters and exact manual text/formatting; Apply changes affects only the working copy.
- Books are optional, independently selectable and reset per open session; facts remain evidence-governed.
- Old preview/advice clients remain compatible. No hidden length choice in the simplified UI.
- Save/approve/send remain separate, and customer/general/channel/workspace contexts remain isolated.
- Use app confirmations, retain cancellation/retry paths and preserve all existing records.

## Review Focus
- Questions must yield advice without inventing a replacement draft.
- Save failures and context changes must retain work and never show false success.
- Saving while a preview is pending must not silently save a different version.
- Zero/all book selections must reach the request accurately without generating on selection.
- Compact layouts must keep instructions, three book cards and saved status reachable.

### Task 1: Unified outcome request and simplified workbench
**Files:** customer/writing-assistant-ui.js, customer/writing-assistant.css, backend/src/writing-assistant.js; focused customer/backend tests.
**Interfaces:** consumes createWritingAssistant.ask(instruction,{intent}); produces auto intent with advice-or-preview reply, one saveDraft control dispatching the existing general saveDraft/customer useDraft adapter.
- [x] Write failing UI/controller request, question, optional book, pending preview and save failure/race tests; run and inspect RED.
- [x] Add auto intent guidance and preserve existing validators; remove visible preset, length and Ask controls; reorder instruction/books/results and implement truthful save status.
- [x] Run focused customer/backend suites and adjust intentional UI expectations. Expected: all pass.
- [x] Commit implementation and record outcomes.

### Task 2: Integrate and prove production
**Files:** customer/outreach-ui.js, discovery-ui.js, index.html, docs/policies/core-template-ai-rules.md, release-integrity.config.json; integration/release fixtures.
**Interfaces:** consumes simplified UI; preserves useAssistantDraft/saveGeneralWriting/saveAssistantTemplate and exact CRM snapshots.
- [x] Test actual save adapter, HTML/provenance preservation, auto intent request and canonical-master nonmutation. Expected: pass after integration changes.
- [x] Bump affected asset URLs, update mandatory smoke checks for the new UI and add the approved policy supersession for removed length UI.
- [x] Run all customer and backend tests, syntax/build and independent read-only review; resolve material findings with regression coverage.
- [ ] Upload exact verified tree, pass CI, merge and verify exact SHA in release-proof.json with PROVEN verdict.
- [ ] Inspect signed-in UI without sending outreach; report the verified release and limits accurately.

## Execution evidence

- Native execution on a dedicated feature branch from a clean managed checkout. Existing assistant baseline: 84 tests passed.
- New UI/controller and backend intent tests failed before implementation and passed after changes. Existing UI assertions were updated for the approved removed controls and passive book shelf.
- Independent review found one Important issue: save receipts persisted after Clear, Load current and upstream replacement. Three real-controller/UI regressions failed first, then the receipt was bound to its exact scope and serialized working draft.
- Compact-height geometry and live model advice/draft routing will be checked in the signed-in production UI after the automated release gates.

- Reviewed final checks: 3,809 customer tests, 921 backend tests, JavaScript syntax and the static build passed. The independent review's one Important finding is fixed and the three reproductions now pass.
- Browser verification limit: the connected browser reported no connected originating instance. Authenticated UI, actual compact-height geometry and live model intent classification could not be observed in this turn. Existing runtime tests exercise save routing, source selection and recovery; no outreach was sent.
