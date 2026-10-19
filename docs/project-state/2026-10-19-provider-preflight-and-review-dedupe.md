# Provider pre-flight, honest 409s, review dedupe and runtime-error copy — 19 October 2026

Observed (authenticated workspace with Anthropic + Firecrawl only):

1. Quick Overview started and spent Firecrawl calls although the plan screen promised OpenAI discovery; `/api/ai/web-search` then returned 502 for every query. `/api/integrations/services/apollo/people-search` returned 503 for a workspace without an Apollo key.
2. The Companies research review listed 19 rows for 15 companies: `corporate.thermofisher.com`, `thermofisher.com` and `jobs.thermofisher.com` (and `careers.westernunion.com` / `westernunion.com`) were separate rows.
3. A customer-defined buying signal disappeared from Strategy after the Profile research was refreshed (`ACTIVE SIGNALS 0`).
4. Workspace status rendered raw exception text to the customer ("Cannot set properties of null (setting 'innerHTML')", "… buyerRoles).join is not a function") and repeated identical items.

Changes:

- `searchWorkspaceResearch` throws `409 AI_SEARCH_PROVIDER_NOT_CONNECTED` before any call when neither OpenAI nor Gemini is connected; `/api/ai/web-search` passes that status and code through. Apollo people-search and Hunter now answer `409` (codes unchanged) when the workspace key is missing — the customer-only billing contract ("a missing key returns 409 before any paid call").
- The market-research plan screen shows a pre-flight line (`#research-preview-providers`) from `LeadIntelAttentionModel.researchProviderNotice(status)`; the attention centre keeps the last `/api/integrations/ai|services/status` payloads and exposes them as `LeadIntelAttention.providerStatus()`. The Companies review modal warns when Apollo (or both discovery providers) are not connected. The partial-research banner says "OpenAI is not connected" when that is the recorded reason.
- `EvidencePolicy.companyDomain` folds careers/jobs/corporate/company/about/group/global/blog/shop/store/support/help/docs hosts into the company domain; the research review is keyed by that identity domain (`researchReviewKey`), prefers more evidence and then the apex host, and Remove clears every host of the company.
- `readAnswers()` rebuilt strategy signals with an empty saved list whenever the buying-triggers answer changed, dropping every customer-defined signal; it now passes the saved signals like the other two rebuild paths.
- Runtime errors in Workspace status show a customer-facing sentence, collapse duplicates, and keep the technical message on `item.technical` only.

Verification: backend `npm test` 675/675 (new 409 web-search test; Apollo test updated to 409); customer `node --test customer/test/*.test.js` (new: `research-review-dedupe`, `research-preflight-notice`, attention-centre additions). Live re-test to follow the deployment.

Prevention: every paid provider path checks the workspace credential first and fails with 409 + code; any new company list keyed by host uses `companyIdentityDomain`; no raw exception text reaches customer surfaces.
