# LeadIntel seven-stage reliability audit

Owner: continuing coding audit requested by Edgars, 30 October 2026 (Europe/Riga). This is the persistent handoff for Instructions 1–7. Record evidence, not inferred completion. Status vocabulary: **NOT TESTED**, **PASS**, **FAIL**, **BLOCKED**. A partial result retains its incomplete requirements; it is not a pass.

## Acceptance gates

Each stage has four independent gates: deterministic code verification, exact production release, authenticated customer workflow, and business outcome. CI/build checks do not prove customer data, provider success, contact yield, quota reconciliation, or delivery. Any release claim requires the repository's exact-SHA `release-proof.json` verdict `PROVEN`.

| Visible stage | Internal screen/module | Code | Production | Authenticated workflow | Business outcome |
|---|---|---|---|---|---|
| 1 Setup | 1 | PASS: 4,211 customer + 1,214 backend; build/syntax/controlled Chromium | NOT TESTED: audit revision pending | BLOCKED: no customer browser/session | BLOCKED: durable real company setup not observed |
| 2 Profile | 2 questionnaire/research + 3 profile review | NOT TESTED in this audit | NOT TESTED in this audit | NOT TESTED | NOT TESTED |
| 3 Strategy | 4 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| 4 Companies | 5 with company journey focus | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| 5 Buyers | 5 with buyer journey focus | NOT TESTED for new authenticated acceptance; prior regression evidence in Step 5 report | Prior release evidence is historical, not a new release claim | BLOCKED: prior customer acceptance still open | BLOCKED: actual priority-email/receipt outcomes still open |
| 6 Messages | 6 | NOT TESTED in this audit | NOT TESTED in this audit | NOT TESTED | NOT TESTED |
| 7 Delivery | 7 | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |

Never infer the visible stage from the internal numeric module alone. `data-workflow-stage`, `LeadIntelJourney.openWorkflowStage`, and company/buyer focus distinguish these paths. Profile review is not a separate visible third stage.

## Context and access inventory

- Starting source/default branch: `e9faaa76b61ebce4f744d08a648fc55671d70614`, confirmed through GitHub main read. Previous Step 5 release proof is historical evidence only.
- Working branch: `codex/setup-reliability-audit-20261030`.
- Frontend authority: Vercel `leadintel`, static output `.vercel-static`; backend authority: Cloudflare Worker `leadintel-api`. GitHub Pages/Cloudflare Pages are retired frontend authorities.
- Connected GitHub repository read/write and Vercel deployment inspection are available. The initial Vercel inventory reported production deployment `dpl_D3oBa9ooShT2LbWbBwhBm9R8Jw2v` READY for the baseline SHA; READY alone is not release proof.
- Managed environment observations are current, network policy enforced/restricted, with no configured secrets, runtime variables, or outbound identities. No user-authenticated interactive browser connector is available. Local Chromium/Playwright is available for controlled fixtures.
- Read-only Wrangler connection check reports unauthenticated. Do not create a temporary account, replace customer credentials, or pretend local SQLite is the production database.
- Database migrations present through `0064_microsoft_calendar.sql`. Setup regressions use a local full-migration SQLite fixture. No schema migration is required for these fixes; this does not assert remote migration state.
- No real paid enrichment, provider connection mutation, automation activation, or outbound message is authorized by a passing fixture. Existing app consent and sending gates remain authoritative.

## Finding ledger and evidence contract

For every finding, record stage/requirement, expected/observed behavior, severity, reproducible trigger, cause and affected files, downstream impact, fix, red/green regression evidence, residual risk, tested SHA, and release/run links. Never store credentials, cookies, signed upload tickets, raw provider responses, or private customer drafts here.

Stage 1 findings and test mapping: [Setup detailed audit](2026-10-30-setup-reliability.md). Earlier Buyers evidence: [Step 5 priority audit](../fixes/2026-10-30-step5-priority-audit.md). Earlier sync causes: [workspace status](../fixes/2026-10-30-workspace-status-root-causes.md).

Existing conflict behavior remains protected: review does not choose a version, both versions/recovery are retained, competing legitimate edits require an explicit resolution. No audit fix may silently replace either version to clear a blocker.

## Shared operation visibility and investigation

`LeadIntelSetupTrace.snapshot()` returns at most 100 in-memory, copied records. The `leadintel:setup-operation` event reports safe action/phase/outcome, operation ID, workspace ID, timestamp and trace-schema version. No URLs, keys, documents, messages, or error bodies are retained. Records clear on changed account/workspace/ticket or invalidated cache; old operations cannot repopulate a new context. This diagnostic buffer is not a durable monitoring service or a product-success metric.

Service/AI settings send `X-LeadIntel-Operation-Id`; the first-party proxy preserves it and the backend validates/replaces invalid IDs. Existing `audit_events` link provider check start/success/failure/supersession, connection save/disconnect/conflict with the ID and authenticated workspace/user. This is request correlation, not authorization or an idempotency key. New check tracing is best-effort; existing AI save/audit behavior is retained. Absence of an event is not proof no provider call occurred.

Website activation traces acquisition and workspace persistence separately. Material upload traces ticket acquisition and upload persistence, while server material IDs/revisions identify retained files. Those local traces do not claim complete server/provider correlation. Workspace save/version/conflict diagnostics and provider execution receipts remain their own evidence; later stages should extend these existing boundaries only as needed.

Investigation: identify the failed action and operation ID in the diagnostic buffer; locate the backend audit events in authorized workspace access; compare outcome, credential revision/connection state and HTTP status; use existing workspace state versions for save conflicts. Do not replay a paid or uncertain action automatically. Diagnose credential errors through sanitized reason categories, not raw provider response logging. A superseded operation requires fresh settings/status, not reapplication of its old result.

## Instruction 2 handoff

Read this record, Setup detail, AGENTS.md, market-intelligence and Profile policies before editing. Start from the final merged revision/PR evidence linked below, and recheck actual branch/runtime freshness. Keep authenticated Setup and prior Buyers blockers open until independently demonstrated.

Verify preserved optional links/materials and activated evidence through Profile normalization and source citations. Check tentative website changes, redirects, canonical identity, reference-model publishing, research cancellation/resume, approval signatures, seller/reference separation, and Profile → Strategy payloads. Do not weaken any gate to manufacture a successful outcome. Continue updating the same four acceptance columns for all seven stages.

## Final revision and evidence

Final local verification: `node --test customer/test/*.test.js customer/*.test.js` passed 4,211/4,211 (includes three root-level legacy suites); backend `npm test` passed 1,214/1,214. Static build, changed JavaScript syntax and whitespace checks pass. Controlled Chromium at 1440/720/390 CSS pixels exercised activation, market selection, keyboard continuation to Profile and retained local state on reload; no horizontal overflow/page errors. The 720px case checks a narrowed desktop layout, not native browser zoom or assistive-technology acceptance.

Exact source SHA, CI/run links, production proof and deployment acceptance are recorded in the linked audit pull request and its release-proof artifact. Before merging, production for this audit revision remains NOT TESTED. Authenticated acceptance remains BLOCKED until actual access and evidence exist.


Final evidence handoff: [audit PR #781](https://github.com/CCGEDGARS/leadintel/pull/781). Its validation and release-proof links record the exact final source/merged SHA and observed CI/production status. This document records the pre-release audit snapshot; use the PR proof to resolve the pending production gate, never infer it from this document. Runtime code was locally verified at `9bba49abe849f6c7ae9cfb4646ba96a594c61431`; the following documentation-only revision adds this permanent evidence link.
