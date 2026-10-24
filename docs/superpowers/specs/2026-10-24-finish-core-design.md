# Finish the core: reliability, clarity and measurable outcomes

Edgars approved taking ownership of all seven areas in the preceding product review: reliability/recovery; coherent status and navigation; buyer-search outcome quality; complete journey testing; daily CRM priorities; consistent controls/spacing; truthful cost visibility. This document makes the approved work concrete. Use existing vanilla frontend, Worker/D1 backend and CRM/conversation records.

## Intended behavior

1. Requests settle under deadline/cancellation even if a transport ignores abort. Durable failed CRM work retains a working Retry after reload. Recovery clears only an incident proven recovered in the same workspace; unrelated runtime failures stay visible.
2. Completion describes required work. Active navigation is independent of completion. Optional improvements have their own progress and never produce contradictory Complete 2/3 or In progress 6/6 labels. The next action targets the missing required item, and existing eligibility gates remain authoritative.
3. Buyers exposes outcome evidence separately: ranked buyers, exact-domain usable work emails, research/AI review coverage, retained paid receipts and missing checks. Use the existing contact policy and source receipts; an email pattern or phone listing cannot become a verified recipient. Benchmark multiple industries and negative/stale/partial cases.
4. Complete controlled journey coverage includes approved exact buyer, one provider-confirmed send, duplicate prevention, inbound reply stopping pending follow-ups, CRM history, refresh and workspace isolation. Synthetic providers establish implementation behavior only. Never contact prospects or activate paid/outreach work merely to test a release.
5. CRM Today reuses saved companies and tracked conversations to show replies requiring review, due tasks/follow-ups and blocked opportunities. Bounded/partial datasets and unavailable sources must be labelled. Links open existing company/conversation controls; no second follow-up engine.
6. Shared presentation tokens give fields, headings, help and action rows consistent spacing/focus/target sizes across steps. Preserve hidden, disabled, radio/checkbox and protected-message behavior.
7. Read-only authenticated workspace costs show only authoritative measured spend, with currency, period, coverage and receipt provenance. AI tokens/Firecrawl usage cannot be silently priced. Lookup caps are separate from money budgets. Deduplicate receipts; missing measurements stay unknown.

## Approach and constraints

Prefer scoped repair and shared small modules over replacing the app. A broad rewrite risks saved drafts/CRM history and adds no acceptance evidence. Global arbitrary CSS overrides would preserve behavioral inconsistencies, so presentation uses low-specificity defaults plus existing component rules.

Preserve all customer records, templates, approvals, paid limits, suppression, exact-recipient and idempotency gates. No new default customer/market/provider. Never claim live buyer yield from synthetic tests. Protected core scripts and multilingual rules remain governed by their existing policies. The uploaded Master CRM spec governs durable history and workspace isolation.

## Acceptance and proof

Meaningful regressions reproduce each discovered defect, then pass after the repair. Full customer/backend suites, build, syntax and whitespace checks must pass. Review independently, inspect authenticated UI and no-send states where browser access is available, and require same-SHA CI/manifests/health/smoke with PROVEN release-proof.json before calling production complete. Distinguish automated/synthetic proof, observed saved buyer outcomes and any unperformed live send/provider benchmark.
