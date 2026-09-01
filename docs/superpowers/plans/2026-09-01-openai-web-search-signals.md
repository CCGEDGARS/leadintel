# OpenAI Web Search Signal Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenAI Web Search to LeadIntel's Market Strategy signal research so fresh public-web evidence is discovered before Firecrawl verification and before any Apollo enrichment.

**Architecture:** Extend the existing OpenAI Responses API provider adapter with a dedicated web-search function that returns normalized source-backed evidence. Expose it through the authenticated AI routes using the workspace's configured OpenAI credential. In the customer Market Strategy flow, call OpenAI search and Firecrawl search independently, merge/deduplicate evidence, then feed the existing opportunity scorer.

**Tech Stack:** Cloudflare Worker JavaScript, OpenAI Responses API, D1 workspace integrations, browser JavaScript, Node test runner, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-01-openai-web-search-signals.md`

## Global Constraints
- Never expose workspace AI credentials to frontend code.
- Web-search evidence must contain a valid source URL to affect opportunity evidence scoring.
- OpenAI Web Search failure must not block Firecrawl research.
- Firecrawl failure must not discard valid OpenAI evidence.
- Apollo remains downstream and is not called by this feature.
- Existing multi-provider text generation behavior must remain unchanged.

---

### Task 1: OpenAI web-search provider contract

**Files:**
- Modify: `backend/src/ai-provider.js`
- Test: `backend/test/ai-provider.test.mjs`

**Interfaces:**
- Consumes: workspace OpenAI API key and model.
- Produces: `searchWeb({apiKey,model,query,maxResults,fetchImpl}) -> {provider,model,results,sources,usage}`.

- [ ] **Step 1: Write failing provider tests**
  - Assert the request uses `POST /v1/responses`, `tools:[{type:"web_search"}]` (or the supported current web-search tool type), `store:false`, source inclusion, and structured output.
  - Assert normalized results reject invalid URLs and deduplicate canonical URLs.
  - Assert upstream errors are sanitized.
- [ ] **Step 2: Run the focused provider tests and confirm RED because `searchWeb` does not exist.**
- [ ] **Step 3: Implement the minimal OpenAI web-search adapter and parser.**
- [ ] **Step 4: Run provider tests and the full backend test suite; confirm GREEN.**
- [ ] **Step 5: Commit provider implementation.**

### Task 2: Authenticated backend web-search route

**Files:**
- Modify: `backend/src/ai-routes.js`
- Test: `backend/test/ai-integration-routes.test.mjs`

**Interfaces:**
- Consumes: `POST /api/ai/web-search?workspace_id=<id>` body `{query,max_results}`.
- Produces: `{provider:"openai",model,results,usage}` or a sanitized error.

- [ ] **Step 1: Write failing route tests**
  - Require authentication/workspace membership.
  - Require a configured OpenAI workspace integration specifically.
  - Bound query length and result count.
  - Verify credential decryption stays server-side.
  - Verify successful searches update `last_used_at` and create an audit event.
- [ ] **Step 2: Run focused route tests and confirm RED because the route is absent.**
- [ ] **Step 3: Implement `/api/ai/web-search` using the stored OpenAI integration even if another provider is active.**
- [ ] **Step 4: Run focused and full backend tests; confirm GREEN.**
- [ ] **Step 5: Commit route implementation.**

### Task 3: Market Strategy dual-source research

**Files:**
- Modify: `customer/app.js`
- Modify: `customer/market-engine.js`
- Test: create `customer/test/openai-web-search-market.test.js`
- Test: update relevant Market Strategy tests only where behavior legitimately changes.

**Interfaces:**
- Consumes: query metadata from `LeadIntelMarket.buildResearchQueries`.
- Produces: merged normalized `state.market.researchResults` with canonical URL deduplication and source metadata.

- [ ] **Step 1: Write failing customer tests**
  - Assert Market Strategy calls `/api/ai/web-search` using authenticated credentials and workspace id.
  - Assert each query still runs Firecrawl search.
  - Assert results from both sources are merged and deduplicated by canonical URL.
  - Assert one source failure does not block the other.
  - Assert Apollo is not invoked by market research.
- [ ] **Step 2: Run Customer V2 tests and confirm RED for the new behavior.**
- [ ] **Step 3: Add `searchOpenAiWeb`, source normalization/deduplication, and dual-source orchestration with bounded queries.**
- [ ] **Step 4: Update research-status copy to communicate OpenAI discovery + Firecrawl verification without claiming a provider succeeded when it did not.**
- [ ] **Step 5: Run full Customer V2 tests and JavaScript syntax checks; confirm GREEN.**
- [ ] **Step 6: Commit customer integration.**

### Task 4: Release verification and production deployment

**Files:**
- No product-code changes unless verification reveals a defect.

**Interfaces:**
- Produces: merged PR, successful exact-SHA Customer V2 CI + Backend CI/deploy as applicable, READY Vercel production deployment, healthy Worker endpoint.

- [ ] **Step 1: Review the PR diff for credential leakage, accidental Apollo calls, and unrelated changes.**
- [ ] **Step 2: Run/confirm full CI on the exact PR head.**
- [ ] **Step 3: Merge with expected-head protection.**
- [ ] **Step 4: Verify exact merge SHA Customer V2 CI and Backend CI/deploy.**
- [ ] **Step 5: Verify Vercel production deployment is READY on the exact merge SHA.**
- [ ] **Step 6: Verify live backend health and live frontend asset contains the dual-source search path.**
- [ ] **Step 7: If no OpenAI workspace credential is configured at runtime, report only that final configuration blocker and use the existing Settings path; do not request the API key in chat.**
