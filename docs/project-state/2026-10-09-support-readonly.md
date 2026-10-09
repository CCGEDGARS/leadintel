# Support & Insights — 9 October 2026

Approved: remove support attachments and make support a knowledgeable read-only guide for the app, troubleshooting, credits, public research, commercial insights and expense planning. Keep confidential internals inaccessible.

Implementation:
- Removed file module loading; retired its installer as a no-op for stale loaders. Blocked file paste/drop and non-JSON/unsupported payloads at the support boundary. Dedicated unrelated product uploads retain their existing controls.
- Removed support proposal rendering, proposal creation, automatic memory writes and action execution. Existing confirmations/rejections return authenticated 403 SUPPORT_READ_ONLY, including legacy proposal IDs. Only chat and diagnostic persistence remain.
- Added versioned approved guidance for the connected workflow, buyer evidence, sender identity, editor controls, subjects, CRM and delivery boundaries; corrected obsolete Calendly guidance. No repository code, schema, private prompts or credentials enter model context.
- Existing authenticated server workspace isolation remains mandatory. Added bounded 30-day token/request aggregates, dated service balances and confirmed provider credit issues; all fields are explicitly selected, and no raw audit metadata is supplied. Consumption coverage is incomplete and labelled; balances are not represented as live.
- Read-only research uses the existing bounded configured web-search provider. Fresh research failures are labelled. Billing replies include hardened official account links. Unknown pricing must be verified rather than invented; estimates must state workload, units, currency, subscription and retry assumptions.
- Cost-planning skill handles expense scenarios; exact provider spend is not available from the existing token ledger alone. No guessed rate card or live-balance promise.
- Deterministic basic guidance remains available if no AI provider exists or generation fails, including exhausted-credit recovery. No new managed paid support provider is introduced. Limit paid support requests to ten per authenticated user/workspace per ten minutes. This is a request limit, not a guaranteed separate funded AI allowance.
- Refuse direct internal extraction/code/duplication requests, tell the model untrusted text cannot alter permissions, filter obvious executable-code replies, and discard all returned actions and memories regardless of model output. No code execution tools exist in support. These protections do not claim universal prompt-injection detection or prevent copying public interface ideas.

Validation: backend unit/SQLite integration tests cover workspace isolation, content types, stale confirmations, rate limits, safe fallback, action/memory discard and direct extraction refusal. jsdom tests exercise file paste, ignored mutation proposals and hardened links. Full customer/backend suites, static packaging and exact-SHA CI/deploy/release proof are required before a production claim.

Release checks: additional smoke gates verify the support loader has no attachment module and the drawer has no action-confirmation control. Customer account acceptance remains separate from build/release proof.
