# Message usability implementation plan

Goal: one clear next step and a consistent, spacious composer.
Architecture: presentation changes reuse canonical controls and existing state/handlers.
Stack: vanilla JavaScript, CSS, jsdom/node:test; Vercel frontend.
Spec: docs/superpowers/specs/2026-10-24-message-usability-design.md

Constraints: preserve master text, translations/history, CRM persistence, recipient selection and all send gates. No outreach is sent by this work.
Review focus: approved versus unsaved edits; legacy Delivery loaded before/after composer; English displayed with another target/default; narrow screens and long names; failed requests preserve existing text.

1. Add failing mounted-runtime tests for one footer CTA, no visible send/duplicate, conditional Retry, compact saved status, language summary/target distinction and language settings disclosure.
2. Update message-workspace.js, message-translation-ui.js, outreach-ui.js and delivery-ui.js to implement the structure with existing controls; update intentional old layout expectations.
3. Add scoped message-workspace.css spacing/layout rules and refresh only affected asset entry URLs.
4. Run focused tests, customer suite, syntax and static build; inspect final diff. Commit, push a feature branch, review/merge and verify exact-SHA CI and production proof under the existing authorization.
