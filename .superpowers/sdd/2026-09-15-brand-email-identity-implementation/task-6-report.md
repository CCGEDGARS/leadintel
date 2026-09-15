# Task 6 report — Gmail and Microsoft branded delivery

Status: COMPLETE.

Requested starting head: `827b446f3e0700a1c5883f0885a86a6c5d701c06`

Rebased branch head before Task 6 commit: `a9211c6cea7c6fbb11b4623324f955b016b22ad7`

The two intervening Task 5 follow-up commits changed only customer frontend files and the Task 5 report. Task 6 changes are backend-only plus this report, so the rebase produced no conflict and preserved every frontend change.

## Implemented

- added authoritative `validateEmailContent({body,text_body,html_body})`
- retained `body` as the required canonical plain-text field
- retained body-only compatibility and optional rendered text fallback
- enforced UTF-8 byte limits of 100,000 bytes for plain text and 200,000 bytes for HTML
- added a strict HTML tag, attribute, URL, inline-style, and nesting allowlist
- preserved safe table email markup, inline email CSS, HTTPS links, validated telephone links, and exact opaque LeadIntel brand assets
- rejected scripts, event handlers, unsafe protocols, forms, SVG, comments, malformed markup, CSS URLs, credentialed links, arbitrary remote images, image query strings, tracking-pixel dimensions, and over-limit payloads
- changed Gmail to `multipart/alternative` only when validated HTML is present
- encoded Gmail text and HTML alternatives as wrapped UTF-8 base64 with a fresh cryptographically random safe boundary
- preserved existing body-only Gmail `text/plain` MIME
- rejected subject/header newline injection
- changed Microsoft Graph to `contentType: "HTML"` only for validated HTML
- preserved existing Microsoft body-only `contentType: "Text"`
- validated branded content in manual send routes before provider calls or durable message/audit/CRM side effects
- preserved existing idempotency keys, daily limits, CRM activity, audits, sent-message records, token rotation, and reply tracking
- left the automated Gmail queue on its existing plain-text `queue.body` path

## TDD evidence

- RED: the new email-content test failed because `backend/src/email-content.js` did not exist
- GREEN: 19 validator cases passed
- RED: Gmail tests failed for missing multipart output and missing subject-newline rejection
- GREEN: 6 Gmail transport tests passed
- RED: Microsoft tests failed because Graph still sent Text and accepted unsafe HTML
- GREEN: 5 Microsoft transport tests passed
- RED: route tests showed both manual routes dropping HTML and validating too late
- GREEN: 7 route tests passed with no provider or durable side effect for rejected HTML
- RED: managed images styled as 1 × 1 pixels were accepted
- GREEN: tracking-pixel style validation was added and 20 validator cases passed

## Verification

- focused delivery and automation regression suite: 47 passed, 0 failed
- full backend suite: 299 passed, 0 failed
- syntax checks passed for `email-content.js`, `gmail.js`, `microsoft-mail.js`, and `saas-routes.js`
- `npm audit --omit=dev`: 0 vulnerabilities

## Scope

- no frontend files were changed
- no migration or queue schema was changed
- branded automatic Gmail delivery remains disabled until a future queue schema persists the approved brand snapshot
- branch only; not merged or deployed
