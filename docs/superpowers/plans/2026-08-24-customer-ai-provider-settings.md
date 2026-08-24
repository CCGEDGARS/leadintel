# Customer AI Provider Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure customer-owned OpenAI, Anthropic and Google Gemini provider configuration and a unified workspace AI generation endpoint to Customer V2.

**Architecture:** Store provider keys encrypted per workspace in D1, expose owner-only configuration routes plus member generation, and keep provider-specific HTTP details isolated in one adapter. Customer V2 receives a Settings drawer that never persists raw keys in browser storage.

**Tech Stack:** Cloudflare Workers, D1 SQLite, Web Crypto AES-GCM, vanilla JavaScript Customer V2, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-24-customer-ai-provider-settings-design.md`

## Global Constraints

- Exactly three first-class providers: `openai`, `anthropic`, `gemini`.
- Customer owns and pays for every provider API key.
- Raw provider keys never enter localStorage, sessionStorage, customer state JSON, logs or API responses.
- Credential mutations are workspace-owner only.
- Provider credentials must pass a real minimal provider request before persistence.
- Use existing `OAUTH_TOKEN_ENCRYPTION_KEY` as the production encryption root for this release.
- Preserve all existing Google/Gmail/customer state behavior.
- TDD red-green cycle for every production behavior.

---

### Task 1: Provider adapter

**Files:**
- Create: `backend/src/ai-provider.js`
- Create: `backend/test/ai-provider.test.mjs`

**Interfaces:**
- Produces: `AI_PROVIDERS`, `normalizeAiProvider(value)`, `defaultAiModel(provider)`, `generateText(options)`, `verifyProviderCredential(options)`.

- [ ] Write failing tests for provider normalization/default models.
- [ ] Run `node --test backend/test/ai-provider.test.mjs` and confirm missing-module/behavior failure.
- [ ] Implement normalization/defaults.
- [ ] Add failing tests for OpenAI request/response extraction.
- [ ] Implement OpenAI adapter using `/v1/responses`, Bearer auth and `store:false`.
- [ ] Add failing tests for Anthropic request/response extraction.
- [ ] Implement Anthropic adapter using `/v1/messages`, `x-api-key`, and `anthropic-version: 2023-06-01`.
- [ ] Add failing tests for Gemini request/response extraction.
- [ ] Implement Gemini adapter using `models/{model}:generateContent` and `x-goog-api-key`.
- [ ] Add failing tests for sanitized upstream failures and tiny credential verification.
- [ ] Implement sanitized errors and `verifyProviderCredential`.
- [ ] Run provider tests to green.

### Task 2: Encrypted workspace provider persistence

**Files:**
- Create: `backend/migrations/0010_workspace_ai_integrations.sql`
- Modify: `backend/test/customer-saas-schema.test.mjs`

**Interfaces:**
- Produces D1 table `workspace_ai_integrations` keyed by `(workspace_id, provider)`.

- [ ] Add failing schema assertions for encrypted key storage, provider check and one-active-provider index.
- [ ] Run schema test and confirm failure.
- [ ] Add migration with encrypted envelope, key hint, model, active, verification/use timestamps and partial unique active index.
- [ ] Run schema test to green.

### Task 3: AI integration backend routes

**Files:**
- Modify: `backend/src/saas-routes.js`
- Create: `backend/test/ai-integration-routes.test.mjs`

**Interfaces:**
- Consumes provider adapter from Task 1 and AES helpers from `oauth.js`.
- Produces `/api/integrations/ai/status`, `/api/integrations/ai/provider`, `/api/integrations/ai/activate`, `/api/ai/generate`.

- [ ] Write failing route-contract tests for known route recognition and role policy.
- [ ] Add helpers to load/decrypt configured provider without exposing the key.
- [ ] Implement GET status with exactly three provider entries and no encrypted/raw key fields.
- [ ] Implement owner-only PUT provider: live verify → encrypt → upsert → optional activate → audit.
- [ ] Implement owner-only POST activate with configured-provider guard and single-active invariant.
- [ ] Implement owner-only DELETE provider.
- [ ] Implement member POST generate using active provider, sanitized prompt length limits, provider adapter and `last_used_at` update.
- [ ] Run route tests and full backend tests.

### Task 4: Customer V2 AI Settings drawer

**Files:**
- Modify: `customer/index.html`
- Create: `customer/ai-settings.js`
- Create: `customer/ai-settings.css`
- Create: `customer/test/ai-settings.test.mjs`

**Interfaces:**
- Consumes existing `window.LeadIntelServerBridge` workspace/session context.
- Produces Settings drawer UI and `leadintel:ai-provider-changed` browser event.

- [ ] Write failing DOM/source contract tests for exactly OpenAI, Anthropic and Google Gemini cards.
- [ ] Add failing tests proving no API key is written to localStorage/sessionStorage and all action buttons use bordered control classes.
- [ ] Add Settings topbar button and drawer markup shell.
- [ ] Implement CSS with individual 1px borders, focus-visible rings and explicit disabled states.
- [ ] Implement `ai-settings.js`: load status, render cards, Test & save, Activate, Disconnect, clear key field after save, refresh status.
- [ ] Add cache-busted stylesheet/script references matching Customer V2 versioning convention.
- [ ] Run Customer V2 tests.

### Task 5: CI and regression verification

**Files:**
- Modify CI/test manifest only if new files are not picked up automatically.

- [ ] Run full backend test suite.
- [ ] Run full Customer V2 test suite.
- [ ] Run `node --check` on all Customer V2 JavaScript including `ai-settings.js`.
- [ ] Verify migration syntax through existing schema tests.
- [ ] Review diff for any occurrence of browser persistence of `api_key` or encrypted credential leakage.
- [ ] Open PR only after all gates pass.
- [ ] Merge only after CI passes on the exact PR head.
- [ ] Deploy Worker/D1 migration if required by the production pipeline, then verify live Settings assets and API status route.
