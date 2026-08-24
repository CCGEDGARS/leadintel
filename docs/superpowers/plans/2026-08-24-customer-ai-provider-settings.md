# Customer AI Provider Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure customer-owned OpenAI, Anthropic and Google Gemini provider configuration and a unified workspace AI generation endpoint to Customer V2.

**Architecture:** Store provider keys encrypted per workspace in D1, expose owner-only configuration routes plus member generation through a dedicated `ai-routes.js`, and keep provider-specific HTTP details isolated in `ai-provider.js`. Customer V2 receives a dynamically loaded Settings drawer that never persists raw keys in browser storage.

**Tech Stack:** Cloudflare Workers, D1 SQLite, Web Crypto AES-GCM, vanilla JavaScript Customer V2, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-24-customer-ai-provider-settings-design.md`

## Global Constraints

- Exactly three first-class providers: `openai`, `anthropic`, `gemini`.
- Default models at implementation time: OpenAI `gpt-5.6`, Anthropic `claude-sonnet-4-6`, Google Gemini `gemini-3.7-flash`; model remains editable by workspace owner.
- Customer owns and pays for every provider API key.
- Raw provider keys never enter localStorage, sessionStorage, customer state JSON, logs or API responses.
- Credential mutations are workspace-owner only.
- Provider credentials must pass a real minimal provider request before persistence.
- Use existing `OAUTH_TOKEN_ENCRYPTION_KEY` as the production encryption root for this release.
- Preserve all existing Google/Gmail/customer state behavior.
- TDD red-green cycle for production behavior.

---

### Task 1: Provider adapter

**Files:**
- Create: `backend/src/ai-provider.js`
- Create: `backend/test/ai-provider.test.mjs`

**Interfaces:**
- Produces: `AI_PROVIDERS`, `normalizeAiProvider(value)`, `defaultAiModel(provider)`, `generateText(options)`, `verifyProviderCredential(options)`.

- [x] Write failing provider tests and confirm RED before production module existed.
- [x] Implement provider normalization and current editable defaults.
- [x] Implement OpenAI Responses adapter with Bearer auth and `store:false`.
- [x] Implement Anthropic Messages adapter with `x-api-key` and `anthropic-version: 2023-06-01`.
- [x] Implement Gemini GenerateContent adapter with `x-goog-api-key`.
- [x] Normalize text and token usage across all three providers.
- [x] Sanitize upstream failures so provider bodies and customer keys are never echoed.
- [x] Add real credential verification with a deliberately small but reasoning-safe output budget.

### Task 2: Encrypted workspace provider persistence

**Files:**
- Create: `backend/migrations/0010_workspace_ai_integrations.sql`
- Modify: `backend/test/customer-saas-schema.test.mjs`

**Interfaces:**
- Produces D1 table `workspace_ai_integrations` keyed by `(workspace_id, provider)`.

- [x] Add schema assertions for encrypted key storage, provider check and one-active-provider index.
- [x] Add migration with encrypted envelope, key hint, model, active, verification/use timestamps and partial unique active index.
- [x] Prove there is no standalone raw `api_key` column.

### Task 3: AI integration backend routes

**Files:**
- Create: `backend/src/ai-routes.js`
- Modify: `backend/src/app.js`
- Create: `backend/test/ai-integration-routes.test.mjs`

**Interfaces:**
- Consumes provider adapter from Task 1 and AES helpers from `oauth.js`.
- Produces `/api/integrations/ai/status`, `/api/integrations/ai/provider`, `/api/integrations/ai/activate`, `/api/ai/generate`.

- [x] Keep AI integration routing isolated from the existing Google/Gmail SaaS router.
- [x] Implement GET status with exactly three provider entries and no encrypted/raw key fields.
- [x] Implement owner-only PUT provider: live verify → encrypt → upsert → optional activate → audit.
- [x] Implement owner-only POST activate with configured-provider guard and single-active invariant.
- [x] Implement owner-only DELETE provider.
- [x] Implement member POST generate using active provider, prompt limits, provider adapter and `last_used_at` update.
- [x] Delegate AI routes before the existing SaaS router in the Worker entrypoint.

### Task 4: Customer V2 AI Settings drawer

**Files:**
- Create: `customer/ai-settings.js`
- Create: `customer/ai-settings.css`
- Modify: `customer/process-map.js`
- Create: `customer/test/ai-settings.test.js`

**Interfaces:**
- Consumes existing `window.LeadIntelServerBridge` workspace/session context.
- Produces a Settings button/drawer and `leadintel:ai-provider-changed` browser event.

- [x] Render exactly OpenAI, Anthropic and Google Gemini cards.
- [x] Show customer-owned billing language, configured/verified/active state, model, masked key hint and verification/use metadata.
- [x] Implement Test & save, Activate and Disconnect actions.
- [x] Keep raw key fields password-style and transient; clear them after successful save.
- [x] Never write provider keys to localStorage/sessionStorage.
- [x] Add 1px individual button borders, hover/focus-visible and disabled states.
- [x] Cache-bust the Settings JS/CSS assets.

### Task 5: CI and regression verification

**Files:**
- Modify: `.github/workflows/backend-ci.yml`
- Modify: `.github/workflows/customer-ci.yml`

- [x] Add `ai-provider.js` and `ai-routes.js` to backend syntax gate.
- [x] Add `ai-settings.js` to Customer V2 syntax gate.
- [x] Run provider request/response contract tests for all three providers.
- [x] Run encrypted-schema and role/route contract tests.
- [x] Run Customer V2 Settings security/UX tests.
- [ ] Confirm final PR head passes the complete Backend CI and Customer V2 CI after the final verification-budget fix.
- [ ] Review final PR diff for raw-key persistence/leakage and stale provider defaults.
- [ ] Merge only after both CI suites pass on the exact final PR head.

### Task 6: Production activation

- [ ] Apply D1 migration `0010_workspace_ai_integrations.sql` remotely.
- [ ] Deploy the updated Worker with existing secrets preserved.
- [ ] Confirm Cloudflare Pages serves the new Settings module.
- [ ] Confirm the production AI status endpoint recognizes the authenticated workspace.
- [ ] In the LeadIntel UI—not chat—enter one customer-owned provider key and use **Test & save**.
- [ ] Verify the provider becomes `Active`, the raw key is cleared from the browser field and no key is present in workspace state.
- [ ] Run one small production generation through the active provider.

## Follow-on integrations

Firecrawl, Scrapling and Apollo customer-owned credentials will reuse this encrypted workspace-integration pattern in separate sub-projects. They are intentionally not mixed into this AI-provider PR so each external provider boundary can be tested and deployed independently.