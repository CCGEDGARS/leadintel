# LeadIntel Multi-Provider AI Routing — Design

Date: 2026-09-03
Status: Approved product direction; implementation pending

## Goal

Allow a LeadIntel workspace to connect multiple AI providers at the same time and choose how LeadIntel routes normal generation requests without duplicating spend.

Supported providers remain OpenAI, Anthropic and Google Gemini. Credentials remain workspace-owned, encrypted server-side, masked in the browser and billed by the provider.

## Current State

LeadIntel already stores one credential per workspace/provider, but the database and API currently treat exactly one provider as `active`. `/api/ai/generate` decrypts only that active provider and sends the request to it. This prevents true multi-provider operation.

## Routing Modes

### 1. Automatic — recommended

All configured and enabled providers are eligible. LeadIntel selects one provider for the request based on `task_type` and a deterministic routing policy. It calls only one provider initially.

If the selected provider fails with a retryable upstream failure, timeout, rate-limit/server condition, or returns no usable text, LeadIntel may try the next eligible provider once. Validation/authentication failures and user/input errors do not trigger fallback.

Default task policy:

- `strategy`, `qualification`, `reasoning`, `general`: OpenAI → Anthropic → Gemini
- `content`, `copywriting`: Anthropic → OpenAI → Gemini
- `summary`, `extraction`, `classification`: Gemini → OpenAI → Anthropic
- unknown/missing task type: workspace preferred provider first when configured; otherwise OpenAI → Anthropic → Gemini

Provider availability always overrides the ideal order. LeadIntel never calls an unconfigured or disabled provider.

### 2. Preferred provider + fallback

The owner selects a preferred provider. LeadIntel sends normal requests to that provider. If it has a retryable failure, LeadIntel tries the configured fallback provider once. No other provider is called.

### 3. Single provider

Only the selected provider may be used. There is no cross-provider fallback.

## High-Value Second-Model Verification

Normal routing never calls two providers in parallel.

A request may explicitly set `verification: "second_model"` only for high-value workflows. LeadIntel then:

1. generates the primary answer through the selected routing mode;
2. selects a different eligible provider;
3. asks it to review the primary answer for material errors, unsupported assumptions and missed risks;
4. returns the primary answer plus a compact verification result.

If no second provider is available, the primary answer still succeeds and the response reports `verification.status = "unavailable"`.

This feature is opt-in per request; it is not the default for ordinary generation.

## Data Model

Add `workspace_ai_routing_settings`:

- `workspace_id` primary key / workspace foreign key
- `mode` = `automatic | preferred | single`
- `preferred_provider` nullable
- `fallback_provider` nullable
- `updated_at`

Add `enabled` to `workspace_ai_integrations`, defaulting to `1` for existing configured providers.

Keep the legacy `active` column and one-active index temporarily for backward compatibility with older frontend code. On migration, the current active provider becomes `preferred_provider` and the routing mode becomes `preferred`. New routing logic does not rely on `active` as the sole source of truth.

## Backend API

Extend `GET /api/integrations/ai/status` with:

- `routing.mode`
- `routing.preferred_provider`
- `routing.fallback_provider`
- each provider's `enabled` state

Add owner-only:

- `PUT /api/integrations/ai/routing`
  - validates mode/provider combinations
  - only configured providers may be selected as preferred/fallback/single
- `POST /api/integrations/ai/provider-enabled`
  - enables/disables a configured provider without deleting its encrypted key

Keep existing provider save/delete endpoints. Saving a new provider does not deactivate other providers.

`POST /api/ai/generate` accepts:

- `task_type` optional
- `verification` optional: `none | second_model`

Response adds routing metadata:

- `provider`
- `model`
- `routing.mode`
- `routing.attempted_providers`
- `routing.fallback_used`
- `verification` when requested

No plaintext credential is ever returned.

## Retry / Fallback Rules

Fallback is allowed for provider-side conditions such as rate limits, transient 5xx failures, network failures/timeouts and unusable empty output.

Fallback is not allowed for invalid prompt/input, unsupported provider/model configuration, authentication/credential rejection, workspace permission failure or other deterministic customer configuration errors. These must surface clearly so the customer fixes the configuration instead of silently spending against another provider.

At most two normal provider attempts are allowed per generation request.

## Web Search

`/api/ai/web-search` remains OpenAI-specific in this release because the current implementation depends on OpenAI Responses API web-search tooling and source extraction. It is not routed through Gemini/Anthropic until equivalent source-backed search adapters exist and are separately tested.

This prevents the generic router from falsely implying capability parity.

## Settings UX

Replace the single `Active` provider concept with:

### AI routing

- Automatic — Recommended
- Preferred + fallback
- Single provider

When Automatic is selected, show a short explanation: `LeadIntel selects one connected AI for each task and uses another only if the first provider has a retryable failure.`

Provider cards show:

- Connected / Not connected
- Enabled toggle
- model
- masked key hint
- verified / last-used time
- Test & save / Replace key
- Disconnect

Preferred mode additionally exposes Preferred Provider and Fallback Provider selectors.

Single mode exposes one Provider selector.

A compact status line should state the effective behavior, for example:

`Automatic · OpenAI, Gemini enabled · one provider per request`

or

`Preferred · OpenAI → Gemini fallback`

## Audit / Usage

Audit each generation with:

- selected provider/model
- task type
- routing mode
- attempted providers
- whether fallback occurred
- token usage per attempt when available
- verification provider when used

Update `last_used_at` only for providers actually called.

Do not log API keys, prompts or generated answer bodies in routing audit metadata.

## Compatibility

- Existing one-provider workspaces continue working.
- Existing active provider becomes the preferred provider during migration.
- Existing `/api/ai/generate` callers that do not send `task_type` continue to work.
- Existing provider credential encryption and owner-only editing remain unchanged.
- Apollo, Firecrawl, Google/Gmail and CRM behavior are out of scope.

## Testing

Test-first implementation must cover:

1. migration preserves existing provider credentials and maps the old active provider to preferred routing;
2. multiple configured providers remain simultaneously enabled;
3. automatic task routing selects the expected eligible provider;
4. preferred mode uses only preferred + configured fallback;
5. single mode never falls back;
6. retryable provider failure triggers one fallback;
7. credential/config/input failure does not trigger fallback;
8. second-model verification uses a different provider and is opt-in;
9. no second provider reports verification unavailable without failing the primary answer;
10. status/routing endpoints enforce workspace ownership for writes;
11. no plaintext key appears in status/routing responses or browser storage;
12. existing web search remains OpenAI-specific;
13. frontend Settings renders and saves all three routing modes;
14. full Customer V2 and Backend suites remain green;
15. exact-SHA deployment, D1 migration, Vercel production and Release Integrity proof are green before completion.

## Non-Goals

- Dynamic price scraping or live per-token cost optimisation.
- Calling all providers and choosing the nicest answer.
- Automatic cross-provider consensus on every request.
- Routing OpenAI web search to other providers without equivalent source-backed adapters.
- Exposing provider secrets to the browser.
