# Customer-Owned AI Provider Settings — Design

## Goal

Allow every LeadIntel customer workspace to supply, pay for and control its own AI provider account. A workspace may configure OpenAI, Anthropic or Google Gemini, choose one active provider/model, validate the credential from LeadIntel, and use the active provider through one server-side generation interface.

## Product contract

LeadIntel supports exactly three first-class AI choices in Customer V2:

1. **OpenAI** — default model `gpt-5.6`.
2. **Anthropic** — default model `claude-sonnet-4-6`.
3. **Google Gemini** — default model `gemini-3.7-flash`.

The model field remains editable so a customer can use another model available to their own account without a LeadIntel release.

A workspace may store credentials for more than one provider, but exactly one configured provider is active at a time. Switching provider never exposes or copies credentials between providers.

## Security

- API keys are accepted only by authenticated backend routes.
- Only workspace owners may save, replace, activate or disconnect provider credentials.
- API keys are never written to localStorage, customer workspace JSON, browser logs, audit metadata or API responses.
- API keys are encrypted server-side with AES-GCM before D1 persistence, using the existing production encryption root (`OAUTH_TOKEN_ENCRYPTION_KEY`) so no new production secret is required for this release.
- D1 stores only the encrypted envelope plus a non-secret key hint (last four characters), provider, model, status timestamps and verification metadata.
- A provider credential is verified with a minimal real provider request before it is saved.
- Disconnect deletes the encrypted credential row.
- Generation requests decrypt only the active workspace credential in Worker memory and immediately call that provider.

## Backend data model

Create `workspace_ai_integrations` keyed by `(workspace_id, provider)` with:

- `workspace_id`
- `provider` (`openai`, `anthropic`, `gemini`)
- `encrypted_api_key`
- `key_hint`
- `model`
- `active` integer boolean
- `verified_at`
- `last_used_at`
- `created_at`
- `updated_at`

A partial unique index guarantees no more than one active provider per workspace.

## Provider adapter

Create a focused `backend/src/ai-provider.js` module. It owns provider normalization, defaults, connection testing, generation request construction and response extraction.

Unified server interface:

```js
await generateText({provider, apiKey, model, system, prompt, maxOutputTokens, fetchImpl})
```

Return shape:

```js
{
  provider,
  model,
  text,
  usage: {input_tokens, output_tokens}
}
```

Provider implementations:

- OpenAI: `POST https://api.openai.com/v1/responses`, Bearer key, `store:false`.
- Anthropic: `POST https://api.anthropic.com/v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01`.
- Gemini: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, `x-goog-api-key`.

Connection validation uses a small prompt requesting exactly `OK`; any successful non-empty text response verifies the credential/model.

## API routes

All routes require an authenticated workspace member. Mutation routes require workspace owner unless stated otherwise.

### `GET /api/integrations/ai/status?workspace_id=...`

Returns the three providers with `configured`, `active`, `model`, `key_hint`, `verified_at` and `last_used_at`. Never returns the encrypted envelope or raw key.

### `PUT /api/integrations/ai/provider?workspace_id=...`

Owner only. Body: `{provider, api_key, model, make_active}`. Validate provider/model/key, perform a minimal live provider request, encrypt key, save configuration, optionally make active, and audit the change.

### `POST /api/integrations/ai/activate?workspace_id=...`

Owner only. Body: `{provider}`. Provider must already be configured. Atomically deactivate all other rows then activate the selected provider.

### `DELETE /api/integrations/ai/provider?workspace_id=...`

Owner only. Body: `{provider}`. Delete credential/configuration. If active, workspace returns to no-active-provider state.

### `POST /api/ai/generate?workspace_id=...`

Owner, researcher or sales role. Body: `{system, prompt, max_output_tokens}`. Resolve active provider, decrypt key, call unified adapter, update `last_used_at`, return text/provider/model/usage. If no active provider exists, return HTTP 409.

## Customer V2 UX

Add a **Settings** button to the top bar and a right-side settings drawer.

The drawer contains an `AI provider` section with three clearly separated provider cards. Each card contains:

- provider name and ownership statement (`Your API key · billed by provider`)
- configured/verified/active status
- password-style API key field
- editable model field
- `Test & save` button
- `Use this provider` button for configured inactive providers
- `Disconnect` button

All buttons receive a clear 1px individual boundary, hover/focus state and disabled treatment.

Saving a provider must not write the key to browser persistence. After success, clear the API key input immediately and refresh status from the backend.

The active provider is shown at the top of the drawer as `AI engine: {provider} · {model}`.

## Browser/server client

Create `customer/ai-settings.js`. It reads the current authenticated workspace from the existing server bridge, fetches status, renders the three cards and performs save/activate/disconnect actions with `credentials:'include'`.

The module also exports a browser event `leadintel:ai-provider-changed` after successful activation so later profile/script modules can react without knowing provider-specific APIs.

No provider key is ever stored in `leadintel_customer_v2_state` or `leadintel_customer_v2_discovery`.

## Failure handling

- Invalid provider/model/key: HTTP 400.
- Not authenticated: HTTP 401.
- Not workspace owner for credential mutation: HTTP 403.
- Provider credential/model rejected: HTTP 422 with a short sanitized message; never echo provider response bodies that may contain account metadata.
- No active provider for generation: HTTP 409.
- Provider timeout/upstream failure: HTTP 502.

The UI keeps the existing configuration intact if a replacement key fails validation.

## Verification requirements

Tests must prove:

1. provider normalization/defaults for all three choices;
2. request headers/body and response extraction for OpenAI, Anthropic and Gemini;
3. provider errors are sanitized;
4. migration defines encrypted per-workspace credential storage and one-active-provider invariant;
5. status route cannot return raw/encrypted keys;
6. owner-only mutation route contract is present;
7. generation route resolves the active workspace provider;
8. Customer V2 renders exactly the three provider choices;
9. browser code never writes API keys to localStorage/sessionStorage;
10. Settings buttons have individual bordered/focus styling;
11. full backend and Customer V2 regression suites remain green;
12. JavaScript syntax checks include every new module.

## Out of scope for this sub-project

Firecrawl, Scrapling and Apollo BYO-key migration are separate integration adapters. This design deliberately establishes the secure workspace-owned credential pattern they can reuse next; it does not leave AI provider selection partially implemented.