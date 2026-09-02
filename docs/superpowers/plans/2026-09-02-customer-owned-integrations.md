# Customer-Owned Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each LeadIntel workspace sign in with Google and independently add, test, replace, monitor, and disconnect its own OpenAI, Anthropic, Gemini, Apollo, and Firecrawl credentials without exposing secrets to browser storage.

**Architecture:** Keep existing Google OAuth and workspace AI credential storage. Add a parallel encrypted `workspace_service_integrations` store for Apollo and Firecrawl, owner-only integration routes, and backend provider adapters. Apollo CRM enrichment and Firecrawl company research resolve a workspace credential first and fall back to the existing platform-managed credential/proxy so current production remains operational during migration.

**Tech Stack:** Cloudflare Worker, D1, Web Crypto AES encryption, vanilla JavaScript customer UI, GitHub Actions, Vercel.

**Spec:** User-approved LeadIntel self-service integration architecture from the 2026-09-02 project conversation.

## Global Constraints

- Complete API keys never return to the browser after save.
- API keys are never written to localStorage/sessionStorage.
- Credential mutations are workspace-owner only.
- Google OAuth remains the workspace identity layer; Gmail OAuth remains separate.
- Existing managed Apollo/Firecrawl infrastructure remains a fallback during transition.
- Resetting customer workspace data must not delete integrations, CRM, or authentication.
- Provider diagnostics must prefer no-credit/no-search endpoints where available.

---

### Task 1: Encrypted workspace service credentials

**Files:**
- Create: `backend/migrations/0013_workspace_service_integrations.sql`
- Create: `backend/src/service-integrations.js`
- Modify: `backend/src/app.js`
- Create: `backend/test/service-integrations.test.mjs`

**Interfaces:**
- Produces: `handleServiceIntegrationRoute(request, env, cors)` and `resolveWorkspaceServiceCredential(env, workspaceId, provider)`.

- [ ] Write failing tests requiring owner-only status/save/delete routes, AES encryption, masked key hints, Apollo auth/health verification, Firecrawl credit-usage verification, and no secret response fields.
- [ ] Run Backend CI and confirm only the new service-integration tests fail.
- [ ] Add migration and route implementation.
- [ ] Run Backend CI and confirm service-integration tests pass.

### Task 2: Use customer Apollo credentials in enrichment

**Files:**
- Modify: `backend/src/crm-routes.js`
- Modify: `backend/test/crm-enrichment.test.mjs`

**Interfaces:**
- Consumes: `resolveWorkspaceServiceCredential(env, workspaceId, 'apollo')`.
- Produces: Apollo enrichment using workspace credential first, platform `env.APOLLO_API_KEY` fallback second.

- [ ] Write failing test requiring workspace Apollo credential precedence and platform fallback.
- [ ] Run Backend CI and observe failure.
- [ ] Update enrichment credential resolution and provider status metadata.
- [ ] Run Backend CI and confirm green.

### Task 3: Route Firecrawl research through the authenticated LeadIntel backend

**Files:**
- Modify: `backend/src/service-integrations.js`
- Modify: `customer/company-research-ui.js`
- Modify: `customer/test/company-research-structure.test.js`
- Modify: `backend/test/service-integrations.test.mjs`

**Interfaces:**
- Produces: authenticated workspace `/api/integrations/services/firecrawl/scrape` and `/search` proxy routes that use workspace Firecrawl key first and managed fallback only when no customer key exists.

- [ ] Write failing backend and customer tests requiring workspace-scoped Firecrawl proxy routes and removal of direct browser calls to the legacy managed Firecrawl proxy for signed-in workspaces.
- [ ] Run Customer V2 + Backend CI and observe the new failures.
- [ ] Implement bounded scrape/search forwarding with safe request schemas and last-used timestamps.
- [ ] Update company research to call the authenticated backend when signed in, preserving legacy proxy fallback only for local/unsigned mode.
- [ ] Run both CI suites and confirm green.

### Task 4: Google-first self-service Integration Control Centre

**Files:**
- Modify: `customer/ai-settings.js`
- Modify: `customer/ai-settings.css`
- Modify: `customer/process-map.js`
- Modify: `customer/test/ai-settings.test.js`

**Interfaces:**
- Consumes: existing Google `bridge().signIn()`, AI routes, and new service-integration routes.
- Produces: Google-first setup, editable Apollo/Firecrawl key cards, source indicator (`Customer key` / `LeadIntel managed fallback`), health/readiness summary, test/replace/disconnect controls.

- [ ] Rewrite Settings tests to require five customer-manageable providers plus Google/Gmail connection status, while asserting secrets never persist in browser storage.
- [ ] Run Customer V2 CI and confirm RED.
- [ ] Implement the new control centre and cache-bust module/CSS.
- [ ] Run Customer V2 CI and confirm GREEN.

### Task 5: Release verification

**Files:**
- Review all branch changes.

- [ ] Verify Backend CI success on exact branch head.
- [ ] Verify Customer V2 CI success on exact branch head.
- [ ] Review diff for secret leakage, CRM regressions, paid diagnostic calls, and accidental removal of platform fallback.
- [ ] Merge with expected-head protection.
- [ ] Verify Vercel production exact SHA and direct live assets on `leadintel.ccgroup.lv`.
- [ ] Verify backend health and, when deployment workflow runs for the backend change, exact-SHA backend deploy success.