# Customer CI and release verification repair

## Failure evidence

Customer V2 CI run 37902907314 failed at Run customer tests for commit 284cc73e5bba1868d412d6156da3d577e674b5c0. Installation succeeded; syntax verification was skipped after the failing suite. The broad local baseline had 127 failed tests. This was a verification block, not an offline production site.

## Causes and repairs

- The Discovery VM fixture lacked window.addEventListener. Seventy-one tests failed before exercising their research behavior. The fixture now models that event entry point and the read-only contact-policy API separately from research/provider request counts. The real public-first enrichment, provider failure, bounded research, save/reload and isolation assertions still run.
- Active meeting contracts used 20-minute invitations while older test drafts expected 30 minutes. Active LinkedIn patterns and pitch previews are aligned to 20 minutes. Test fixtures for current messages follow that contract; historical migration bodies, archived scripts and literal calendar URLs are preserved.
- Working subject lists had drifted from the recorded approvals in 2026-10-07-approved-subject-restoration.md. The five approved subject patterns per style are restored, with legacy selection aliases, exact fixed wording, reviewed-project gates, supported benefits and real company-fit scores. Personal subjects and existing saved drafts remain separate. Full-name/company aliases now also work in active personal subject patterns.
- The subject resolver used an incorrectly escaped placeholder expression. It now fills verified values deterministically. Benefit subjects use the approved seller outcome instead of accepting new AI claims. Missing evidence uses the approved fallback, and missing score plus sender identity cannot admit an invented score.
- Archived ERCON/LKAB example text had entered the live generation payload. The archived reference is now excluded from the generation payload; protected original views remain verbatim.
- Older UI fixtures did not include current helpers or reflected superseded layouts and automatic draft saves. They now exercise the agreed deterministic template application and explicit Save behavior, plus actual AI cancellation/buyer/workspace races. DOM label/cache assertions reflect current field wording and a canonical v-first asset URL.
- Release smoke checks referenced superseded labels. They now require the Save/Edit/Rewrite/Restore original and preview controls, verify the separate controlled-message-editor asset, and retain the independent three-slot LinkedIn library check. A negative test rejects a missing message-editor asset. CI syntax checks now include all three editor modules.

## Validation

Final local customer suite: 1,978 tests, all passed. The 19 Save/Edit/Rewrite/Restore tests are included. Vercel static build, discovery deployment contract and all CI-listed syntax checks pass. No test or mandatory release gate was skipped, disabled, or made optional. No outreach was sent. CI success and an exact-SHA PROVEN release proof remain required before a production claim; their evidence is checked after publication.
