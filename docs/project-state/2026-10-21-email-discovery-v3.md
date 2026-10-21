# Mandatory work-email discovery and Gmail research v3

User instruction: make deeper direct-email discovery mandatory in Buyers and provide complete Gmail research with matching but unconfirmed emails.

## Delivered behaviour

- Shared manual/automatic adaptive policy `20261021-adaptive-depth-v3`: two direct-email searches per retained full identity, three Gmail business-contact searches, and the existing deeper wave for four unresolved priority buyers.
- Official named colleagues supply address-format evidence, including first-name-only aliases. Original/transliterated names are searched; non-Latin identities still receive original-name searches when safe Latin address patterns cannot be generated.
- Gmail source matches retain exact name/company context, URL, structured excerpt, matching basis and unconfirmed status in `gmailMatches`. Separate expandable name patterns remain hypotheses in `gmailCandidates`. Earlier listings require source rechecking. No Gmail hypothesis or match becomes a confirmed work-email recipient.
- Every query retains outcome, count, time and reason. Current coverage requires both work-email receipts and all three Gmail receipts. Old single-query completion is shown as needing refresh. Paid Apollo/Hunter gates and sending approval remain separate.
- Source-budget interruptions leave incomplete receipts and resume outstanding work. Reusing accountability clears superseded run gaps; prior cached pages do not exhaust the new-run read budget. Concurrent work remains limited to two identities, 24 new source-page attempts and 180 seconds per run.
- Workspace/CRM normalization preserves hypotheses, matches and receipts. Durable backend CRM round-trip tests prove Gmail evidence does not create a Gmail recipient. CRM hydration prefers current-policy/newer same-identity research instead of blindly restoring older local checks; local buyer selection remains protected.

## Validation

- 3,302 customer tests, 739 backend tests, build and diff/syntax checks passed locally. Final exact-commit CI and production proof remain independent release gates.
- Twelve dedicated v3 tests cover learned official formats, original/transliterated/non-Latin names, actual search execution, public business matching, wrong employer/domain and other staff-card rejection, plain/heading/bold/list/inline/uncased names, instruction text, source-derived versus generated separation, partial searches, strict receipt gates, state/CRM persistence, hydration and source-budget resume.
- Independent code review approved after all identified Important findings were fixed and reproduced in regression tests.

Deployment and authenticated customer outcomes must be verified separately. This implementation does not promise that any individual has a discoverable direct work email or Gmail address. Never fabricate a source-backed match to reach a target count.
