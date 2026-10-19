# Discovery research budget, sync-size warning and test e-mail gate — 19 October 2026

Observed (customer portal QA, 19 October):

1. A "5 companies" search made about 105 Firecrawl calls (≈70 searches, ≈35 page reads) before stopping on two provider errors, and nothing told the customer beforehand how much a search may cost. The cost is structural: up to 30 company mentions per request, each resolved (1 search), verified (2 searches) and read (up to 3 pages), plus a follow-up wave and up to three automatic broadening passes, each a full repeat.
2. Brand variants ("Nasdaq, Inc.", "NASDAQ Inc", "Nasdaq") were separate mentions, so each paid for its own resolution and verification.
3. One session brought the workspace to 488 KB of the 500 KB sync ceiling; the first warning a customer gets today is the failed save.
4. "Send test email" was clickable with no draft and the dialog's send button was enabled with no recipient (native validation stopped the submit, but the control promised otherwise).

Changes:

- `discovery-engine.js`: `estimateDiscoveryCalls()` / `discoveryCallBudget()` compute the Firecrawl call ceiling for a request from the same bounds the run uses (market, resolution, verification, page reads, follow-up; target-only, recheck and Saving Mode variants). Every request size stays at or under 200 calls. `companyMentionKey()` strips legal-form tokens so brand variants resolve once; `buildCandidateVerificationQueries()` accepts `excludeDomains` so the follow-up wave never re-verifies a domain. The funnel records `firecrawlPageReads`, `firecrawlCallLimit` and `budgetSkippedChecks`.
- `discovery-ui.js`: one budget per request (`startDiscoveryBudget`, `reserveFirecrawlCall`): searches and page reads (`collectWebsiteEvidence` via `fetchImpl`) count alike; when the budget is used up, remaining checks are skipped (`skipped:'budget'`) instead of failing, the follow-up wave is not started, and automatic broadening passes draw from the same budget and stop when less than a fifth remains ("Research budget reached"). Retries count as calls, so a flapping provider cannot exceed the budget either. The Companies step shows the budget next to the amount selector before any paid call, and Search details shows calls used (searches, page reads, skipped checks). Saving Mode keeps its 10-search, 3-page bound through the same mechanism; the former throw-on-limit is gone.
- `workspace-persistence.js` + `attention-centre-model.js` + `attention-centre.js`: each cloud save records the compacted payload size; from 80 % of the 500 KB ceiling the Workspace status shows "close to the sync limit" with the fix (clear older company search results), and an over-limit save explains the same instead of only "Retry save".
- `test-email-ui.js`: the launch button is disabled with the reason as its tooltip until a complete draft exists (subject, body, no `{{placeholders}}`); the dialog's send button stays disabled until a valid recipient address is typed.

Verification: `customer/test/discovery-research-budget.test.js` (cost model, brand-key dedupe, exclusion of verified domains, a capped run in the discovery runner sandbox that makes exactly the budgeted number of Firecrawl calls with zero failures and no second pass, a target-only run that reports usage), additions to `attention-centre.test.js` and `test-email-ui.test.js`; full customer suite green.

Not changed (product decisions for the owner): the mention multiplier (3 per requested company), the 30-company ceiling, independent corroboration searches and 3 pages per website define the budget itself; market/ICP pre-filtering before paid verification would lower it further.

Prevention: any new paid provider call inside discovery goes through `reserveFirecrawlCall`, and any new request type gets a line in `DISCOVERY_COST_MODEL` so the displayed budget stays the real bound.
