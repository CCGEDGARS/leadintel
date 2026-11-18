# Writing Assistant control and integration review

## Scope and findings

This review follows the unpublished Books fixes in `a9a968f5`. It checks the actual Writing Assistant, its independent writing library and customer Messages/CRM handoff. Storage and Stripe remain paused. No canonical master, provider prompt, approval or sending authority changes.

Two reproduced control failures were fixed:

- Failed skill selection put its error inside collapsed Book knowledge. The Writing skills section now displays its own accessible error, clears it before retry and resets it at session/context boundaries. Book errors remain with the book discussion controls.
- Closing the saved-script picker did not invalidate an in-flight list refresh, so its eventual response reopened a canceled picker. Cancel now invalidates that pending load while preserving the draft and focus.

An empty saved-script picker now explains how to create a draft or template. The changed UI asset has a cache version propagated through index → Discovery → outreach → Writing Assistant.

## Evidence

`customer/test/writing-assistant-controls.test.js` reproduces both failures with the real controller and DOM view; both tests failed before the fixes and passed afterward.

Run `node scripts/verify-writing-assistant-journey.mjs` for the Chromium acceptance journey. It runs the full customer application with cookie-authenticated backend routes, all database migrations, real writing-library and CRM persistence, and controlled external AI responses. Evidence and desktop/mobile screenshots are written to `/tmp/leadintel-writing-assistant-review/`.

The browser journey verifies draft creation, explicit general-writing context isolation, Undo/Redo, advisory output preserving text, invalid AI output preserving text, generation cancellation, failed saves with successful retry, separate template/draft records, fresh-browser reload, Clear/Undo, mobile width and exact customer-draft handoff into Messages and CRM without approval or sending. No browser page errors occurred in the passing run.

Focused validation covers 217 customer tests and 49 backend tests: book/skill selection, stale source/context responses, rich-text editing and links, copying, dialog controls, customer and general validation, and save/reload/CAS behavior. Two asset-token assertions initially failed while the cache parameter was placed before the existing `v` parameter; moving the new parameter to the query's end preserved the established loader contract, and all four release-asset assertions then passed. The static build passed separately.

Acceptance uses synthetic customer data and controlled provider responses. It establishes local behavior, not a particular live customer's provider availability, credentials, balance or model output quality. Publication and exact-SHA release proof remain separate.
