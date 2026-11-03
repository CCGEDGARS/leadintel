# Buyers Refresh: control requests versus saved research — 3 November 2026

The owner reported “Buyer research snapshot is too large” immediately after pressing Refresh on a mature saved company. This is a new acceptance failure after PR830, not evidence that all saved contacts or storage capacity were lost. The prior release proved controlled small-record behavior; it missed the large retained-record request boundary.

## Reproduction and root cause

The browser built a research command by copying retained company-contact records, the identity pool, diagnostic/source bodies and person research metadata. Although some top-level receipts were removed, nested copies survived. Legitimate accumulated research crossed the browser's 240,000-byte request budget before the server could receive Refresh. A matching Resume command built the same unnecessary snapshot even though the server uses only its job ID and revision.

A controlled authenticated workspace with ten named identities, twenty company-contact records and retained per-source receipts reproduces the exact error with the prior production client. The raw record is about 2.3 MB. The fixture exercises actual SQL/session ownership, workspace storage and the real browser Refresh control; source reads use controlled official company HTML. It contains no real customer information.

## Fixed boundary

New research commands carry current company/person identities, role and source hints, compact source excerpts and the canonical seller research context. Saved research inventories, execution receipts and broad diagnostic bodies stay in workspace/CRM and durable job records. Existing manual profile reviews and role/identity holds are retained as relevant input hints; paid lookup approvals and execution receipts are not transported as authority. Resume sends the existing job ID and expected revision only, after the unchanged scope/roster/profile checks. Backend context, revision and session guards still apply.

The fix does not raise the browser or backend request limits, delete saved research, create contacts, activate paid enrichment or send outreach. The actual controlled Refresh command is about 14 KB. An oversized unsupported request is still rejected by the backend.

## Acceptance and prevention

Tests cover the prior-client failure and corrected browser flow, full ten-person identity/source retention, independent source receipts, the real authenticated start/resume endpoints, completed task reuse, unchanged stored workspace data, role/manual review and privacy boundaries, four confirmed mixed-channel contacts with six collapsed, and fresh-browser reopen with no provider replay. Existing workspace/identity/CAS and downstream recipient tests remain required. Run the full customer/backend suites, mandatory browser CI, build and exact-main-SHA production proof before release claims.

Future research changes must distinguish command inputs from retained research state. Include a normalized mature workspace in Refresh acceptance, not only newly seeded small companies. Do not resolve request-size errors by asking the user to clear contacts, trim saved evidence or repeatedly save the same already-stored record. Controlled acceptance and exact release proof remain separate from private customer yield, which is not accessible in this environment.
