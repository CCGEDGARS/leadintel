# Sync conflict and message recovery — 7 October 2026

User request: fix the Messages errors and separate Confirm this profile / Proceed to message in the LinkedIn review.

## Root cause and prevention

Explicit sync choices previously replaced an entire workspace with one session's payload. Keeping a local draft could discard newer remote Profile answers or booking settings. Choices now apply only to overlapping fields when a valid shared baseline exists; unrelated changes from both sides are retained. Without a baseline, existing whole-version recovery remains explicit and both versions are backed up.

Resolution reads the local payload after the server refresh, makes workflow controls inert through saving, cancels pending generation, and reloads canonical modules after a merged save. Regression tests cover edits during GET, deferred PUT, and independent Profile/Calendly/template changes.

Messages show the sync conflict before apparent missing Profile answers. Generation stops during conflicts. Unapproved saved drafts replace the literal missing-booking marker only from an authenticated, ready, nonconflicting workspace whose selected buyer belongs to that workspace. Approved drafts are unchanged. Copying email/LinkedIn is blocked during unsafe restoration or with an unresolved booking marker.

LinkedIn review actions have a 16px flex gap and stack at mobile widths. Relevant asset revisions are cache-busted.

## Validation

- All 1,848 customer tests passed with bounded concurrency.
- Production build and whitespace checks passed.
- Independent review found no remaining Critical or Important issues after the GET/PUT race safeguards.
- Signed-in server workspace observed before release: 12/12 confirmed Profile inputs, synced. User screenshots showed an older local session conflict; do not claim that separate browser has been reconciled merely from this server observation.

## Release

PROVEN PRODUCTION: `fe3d5f64cf51f4056f9c182cf5888cdc49fa7620`, Customer V2 CI run `37629442249` succeeded. Live manifest matched the exact SHA; backend health and mandatory smoke checks passed. Proof stored alongside this record.

Authenticated post-release evidence: Synced to LeadIntel, 12/12 core inputs confirmed, saved Calendly `https://calendly.com/edgars-7go/strategy-call`, draft ready to review. LinkedIn review computed gap 16px and screenshot confirmed separated controls. The separate local browser in the user screenshots was not directly reconciled by this observation.

No outreach authorized or sent.
