# Rich text editors implementation plan

> Execute inline using superpowers:executing-plans. User already approved implementation.

**Goal:** shared formatting with durable save and correct email delivery.
**Architecture:** optional messageHtml/emailBodyHtml accompanies canonical text; shared safe model and editor; approval freezes rendered HTML.
**Tech Stack:** existing JavaScript browser modules, native editing, Node test/jsdom, Cloudflare Worker.
**Spec:** docs/superpowers/specs/2026-10-25-rich-text-editors.md

## Global constraints
Protect masters, isolation, existing drafts, explicit saves, and sending authority. Subject plain. Arial/Normal default. Four fonts/four sizes as approved. Sanitized HTML bounded to 80000 characters. No outbound mail during verification.

## Review focus
- Formatting-only changes invalidate saved/approval state.
- Context switches with identical text never retain another recipient's formatting.
- Paste cannot inject script, remote assets or unsafe links.
- AI/translation changes cannot deliver stale HTML wording.
- Toolbar interaction keeps selection and keyboard focus inside the assistant.

### Task 1: shared model/editor
- [ ] Add failing customer/test/rich-text.test.js for sanitizer, text agreement, typography, edit/undo/disabled/paste and rich copy.
- [ ] Implement customer/rich-text.js, customer/rich-text-editor.js and customer/rich-text.css; run focused tests.
### Task 2: connected persistence and rendering
- [ ] Add failing customer/test/rich-text-flow.test.js and backend tests for save/reload, approval, MIME, general templates.
- [ ] Integrate message-editor.js, outreach-ui.js, writing-assistant*.js, message-translations.js, channel-scripts.js and index.html. Preserve HTML in outreach-engine normalization and brand-identity rendering. Validate/persist optional HTML in writing-workspace/script-library routes; allow safe lists/underline in email-content.js.
- [ ] Verify focused tests then relevant full customer/backend suites and build.
### Task 3: release and browser verification
- [ ] Exercise desktop/narrow editor fixtures with browser, review whole change, fix findings, document evidence.
- [ ] Push feature branch, PR, exact-SHA CI, merge/deploy under existing user authorization, require release-integrity proof before claiming production complete.
