# LeadIntel Customer V2 Production SaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Customer V2 from browser-only prototype state to a multi-tenant D1-backed SaaS foundation with Google identity, separately connected Gmail OAuth, controlled Gmail send, reply sync and server-authoritative workspace persistence.

**Architecture:** Extend the existing Cloudflare Worker/D1 authorization spine. Add focused backend modules for workspace state, OAuth/token crypto and Gmail. Add a customer production bridge that hydrates/persists the existing localStorage namespaces rather than rewriting Steps 1–7. Gmail remains explicitly user-controlled and falls back to manual Compose when disconnected.

**Tech Stack:** Cloudflare Workers, D1, Web Crypto AES-GCM, Google OAuth 2.0, Gmail REST API, HTML/CSS/vanilla JavaScript, Node built-in test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-23-customer-v2-production-saas-design.md`

## Global Constraints
- Do not modify legacy `/v2/**` application files.
- Existing Customer V2 behavior must remain usable without authentication.
- Authenticated server state is authoritative at initial hydration.
- All customer/Gmail API access is workspace-membership scoped.
- No automatic/silent email sending.
- Gmail OAuth tokens never enter browser storage.
- Gmail send must be idempotent.
- Learning/reply classification remains conservative and CRM stages never regress.
- Do not commit Google secrets or encryption keys.

---

### Task 1: D1 production schema

**Files:**
- Create: `backend/migrations/0009_customer_saas.sql`
- Test: `backend/test/customer-saas-schema.test.mjs`

**Interfaces:**
- Produces D1 tables consumed by later backend tasks: `oauth_states`, `customer_workspace_state`, `gmail_connections`, `gmail_messages`, `gmail_replies`.

- [ ] **Step 1: Write a failing schema contract test**
  - Read the migration file and assert each required table, primary/unique constraints, workspace foreign keys and JSON check exist.
- [ ] **Step 2: Run `cd backend && npm test` and verify the new test fails because migration 0009 is absent.**
- [ ] **Step 3: Add `0009_customer_saas.sql`** with:
  - `oauth_states(id_hash PRIMARY KEY, purpose CHECK login|gmail, user_id nullable, workspace_id nullable, return_to, created_at, expires_at, consumed_at)`;
  - `customer_workspace_state(workspace_id PRIMARY KEY, schema_version, version, payload_json CHECK json_valid, updated_by, updated_at)`;
  - `gmail_connections(workspace_id PRIMARY KEY, user_id, google_email, encrypted_refresh_token, scopes, status CHECK connected|disconnected|error, history_id, connected_at, updated_at, disconnected_at)`;
  - `gmail_messages(id PRIMARY KEY, workspace_id, idempotency_key, domain, recipient, subject, gmail_message_id, gmail_thread_id, sent_by, sent_at, status)` with unique workspace/idempotency key;
  - `gmail_replies(id PRIMARY KEY, workspace_id, domain, gmail_message_id, gmail_thread_id, sender_email, received_at, body_text, category, created_at)` with unique workspace/Gmail message id;
  - indexes on workspace/thread/date fields used for sync.
- [ ] **Step 4: Run backend tests and verify schema contract passes.**
- [ ] **Step 5: Commit.**

### Task 2: OAuth and token-crypto helpers

**Files:**
- Create: `backend/src/oauth.js`
- Create: `backend/test/oauth.test.mjs`
- Modify: `backend/src/security.js`

**Interfaces:**
- Produces:
  - `safeReturnUrl(value, configuredCustomerUrl)`
  - `buildGoogleAuthorizationUrl(config)`
  - `exchangeGoogleCode(code, config, fetchImpl=fetch)`
  - `fetchGoogleIdentity(accessToken, fetchImpl=fetch)`
  - `importAesKey(base64Key)`
  - `encryptSecret(plaintext, key)`
  - `decryptSecret(envelope, key)`
  - `createOAuthState(env,{purpose,userId,workspaceId,returnTo})`
  - `consumeOAuthState(env,{rawState,purpose})`

- [ ] **Step 1: Write failing tests** for safe LeadIntel return URLs, external redirect rejection, Google authorize URL parameters, token exchange normalization, AES-GCM round trip and tamper rejection.
- [ ] **Step 2: Run backend tests and verify failure because helpers do not exist.**
- [ ] **Step 3: Implement OAuth URL/exchange/identity helpers and AES-GCM envelope** `{v:1,iv:<base64url>,ct:<base64url>}` using Web Crypto.
- [ ] **Step 4: Implement state persistence** using random 32-byte state returned to browser, SHA-256 hash stored in D1, 10-minute expiry and single-use consume update.
- [ ] **Step 5: Run tests and verify pass.**
- [ ] **Step 6: Commit.**

### Task 3: Persistent customer workspace state service

**Files:**
- Create: `backend/src/customer-state.js`
- Create: `backend/test/customer-state.test.mjs`

**Interfaces:**
- Produces:
  - `MAX_CUSTOMER_STATE_BYTES = 1048576`
  - `normalizeCustomerPayload(payload)`
  - `customerStateSize(payload)`
  - `emptyCustomerState(workspaceId)`
  - `getCustomerState(env,workspaceId)`
  - `putCustomerState(env,{workspaceId,userId,expectedVersion,schemaVersion,payload})`

- [ ] **Step 1: Write failing pure validation tests** for object-only payload, allowed top-level namespaces (`main`, `discovery`, `outreach`, `delivery`, `meta`), 1 MB cap and empty-state envelope.
- [ ] **Step 2: Add testable D1 service behavior** with a small fake DB adapter proving version 0 create, version increment, and conflict response data.
- [ ] **Step 3: Run tests and verify failure.**
- [ ] **Step 4: Implement service** with optimistic compare/update semantics and bounded JSON serialization.
- [ ] **Step 5: Run tests and verify pass.**
- [ ] **Step 6: Commit.**

### Task 4: Gmail API service

**Files:**
- Create: `backend/src/gmail.js`
- Create: `backend/test/gmail.test.mjs`

**Interfaces:**
- Produces:
  - `normalizeEmail(value)`
  - `buildMimeMessage({from,to,subject,body})`
  - `base64UrlEncode(value)` / `base64UrlDecode(value)`
  - `refreshGoogleAccessToken(refreshToken,config,fetchImpl=fetch)`
  - `sendGmailMessage(accessToken,message,fetchImpl=fetch)`
  - `fetchGmailThread(accessToken,threadId,fetchImpl=fetch)`
  - `extractMessageText(message)`
  - `normalizeInboundReplies(thread,{sentMessageId,sentAt,connectedEmail})`
  - `classifyReply(text)`

- [ ] **Step 1: Write failing tests** for MIME CRLF formatting/encoding, header-injection rejection, Gmail send request shape, refresh request shape, multipart/base64 body extraction and deterministic reply classification.
- [ ] **Step 2: Run backend tests and verify failure.**
- [ ] **Step 3: Implement minimal Gmail helpers** with bounded subject/body, no browser token exposure and injectable fetch.
- [ ] **Step 4: Run tests and verify pass.**
- [ ] **Step 5: Commit.**

### Task 5: Backend routes — Google identity and workspaces

**Files:**
- Modify: `backend/src/index.js`
- Test: extend `backend/test/oauth.test.mjs` and add structural route assertions in `backend/test/routes.test.mjs`

**Interfaces:**
- Adds routes:
  - `GET /api/auth/google/start`
  - `GET /api/auth/google/callback`
  - `GET /api/workspaces`

- [ ] **Step 1: Add failing route-structure tests** asserting route literals, OAuth helper use and session-cookie creation are present.
- [ ] **Step 2: Implement Google start before auth gate** using safe return URL and state creation.
- [ ] **Step 3: Implement callback before auth gate**: consume state, exchange code, require verified email, upsert user, ensure default workspace+owner membership, issue HttpOnly LeadIntel session, redirect safely back to customer app with `auth=success`.
- [ ] **Step 4: Implement authenticated `/api/workspaces`** listing memberships only for current user.
- [ ] **Step 5: Run backend tests and syntax check `node --check backend/src/index.js`.**
- [ ] **Step 6: Commit.**

### Task 6: Backend routes — persistent Customer V2 state

**Files:**
- Modify: `backend/src/index.js`
- Test: extend `backend/test/routes.test.mjs`

**Interfaces:**
- Adds:
  - `GET /api/customer/state?workspace_id=...`
  - `PUT /api/customer/state?workspace_id=...`

- [ ] **Step 1: Add failing route tests** asserting membership gate, writer-role restriction, GET/PUT literals and 409 conflict handling.
- [ ] **Step 2: Implement GET** using `getCustomerState` after membership resolution.
- [ ] **Step 3: Implement PUT** accepting `{schema_version,version,payload}`, rejecting oversized/invalid state, permitting owner/researcher/sales, returning HTTP 409 with current state on version mismatch, and auditing successful writes.
- [ ] **Step 4: Run backend tests and syntax checks.**
- [ ] **Step 5: Commit.**

### Task 7: Backend routes — Gmail connect, send, sync, disconnect

**Files:**
- Modify: `backend/src/index.js`
- Test: extend `backend/test/routes.test.mjs`

**Interfaces:**
- Adds:
  - `GET /api/integrations/gmail/status`
  - `GET /api/integrations/gmail/start`
  - `GET /api/integrations/gmail/callback`
  - `POST /api/integrations/gmail/send`
  - `POST /api/integrations/gmail/sync`
  - `POST /api/integrations/gmail/disconnect`

- [ ] **Step 1: Add failing structural/security tests** for all route literals, owner-only connect/disconnect, explicit send role, idempotency key, encrypted refresh token helpers and no token return fields.
- [ ] **Step 2: Implement status/start/callback** with separate Gmail OAuth purpose and scopes; callback verifies initiating workspace membership and owner role from state, encrypts refresh token and upserts connection.
- [ ] **Step 3: Implement send**: validate membership/role, fetch/decrypt connection, return existing record on duplicate idempotency key, refresh access token, send Gmail MIME, persist Gmail IDs and audit.
- [ ] **Step 4: Implement sync**: fetch active tracked threads, normalize unseen inbound replies, persist unique messages, return only newly stored normalized replies.
- [ ] **Step 5: Implement disconnect**: owner-only, clear encrypted token/status; optionally call Google's revoke endpoint best-effort without failing local disconnect.
- [ ] **Step 6: Run backend tests and syntax checks.**
- [ ] **Step 7: Commit.**

### Task 8: Customer server-state bridge and sign-in UX

**Files:**
- Create: `customer/server-bridge.js`
- Create: `customer/server.css`
- Modify: `customer/index.html`
- Create: `customer/test/server-bridge.test.js`
- Modify: `customer/test/structure.test.js`

**Interfaces:**
- Server bridge consumes existing localStorage keys and produces authenticated hydration/persistence.
- Exposes `window.LeadIntelServerBridge` with `session`, `workspace`, `stateVersion`, `gmail`, `saveNow()`, `syncReplies()`.

- [ ] **Step 1: Write failing structural/pure tests** for API base, local keys, sign-in button, sync status, GET/PUT state paths, version conflict branch and no token storage.
- [ ] **Step 2: Add compact topbar account UI**: `Sign in with Google`, account/workspace status, sync status. Preserve `Start over`.
- [ ] **Step 3: Implement unauthenticated mode** preserving current local behavior and changing copy to `Local workspace · Sign in to sync`.
- [ ] **Step 4: Implement authenticated hydration**: `/api/session`, `/api/workspaces`, `/api/customer/state`; server payload overwrites existing Customer V2 local keys before firing a `leadintel:server-hydrated` event/reload once.
- [ ] **Step 5: Implement debounced persistence** by wrapping/listening to storage writes on known keys; PUT versioned bundle with credentials; on 409 stop autosave, rehydrate server state and surface a conflict notice.
- [ ] **Step 6: Run all customer tests and syntax check.**
- [ ] **Step 7: Commit.**

### Task 9: Customer Gmail production connector

**Files:**
- Modify: `customer/delivery-ui.js`
- Modify: `customer/delivery.css`
- Create: `customer/test/gmail-production.test.js`

**Interfaces:**
- Uses `LeadIntelServerBridge.gmail` and backend integration routes while retaining `LeadIntelDelivery.buildGmailComposeUrl` fallback.

- [ ] **Step 1: Write failing tests** for Connect Gmail, Connected mailbox, Send with Gmail, Sync replies, Disconnect, explicit confirmation, manual Compose fallback and absence of browser OAuth/token fields.
- [ ] **Step 2: Render connector state** based on authenticated bridge + Gmail status.
- [ ] **Step 3: Implement Connect/Disconnect actions** by navigating/calling backend routes; never handle refresh/access tokens client-side.
- [ ] **Step 4: Implement explicit Send with Gmail** using approved package + valid recipient + generated idempotency key; only on button click. On success feed existing delivery state via `confirmSend`, update pipeline to Contacted and persist through bridge.
- [ ] **Step 5: Implement Sync replies**: call backend sync, feed each new reply through `LeadIntelDelivery.recordReply`, update pipeline using existing stage guards, then persist.
- [ ] **Step 6: Preserve manual Gmail Compose + Confirm Sent fallback** for disconnected/local mode.
- [ ] **Step 7: Run customer tests and syntax checks.**
- [ ] **Step 8: Commit.**

### Task 10: CI and deploy-ready configuration

**Files:**
- Create: `.github/workflows/backend-ci.yml`
- Modify: `.github/workflows/customer-ci.yml`
- Modify: `backend/wrangler.toml`
- Create: `backend/.dev.vars.example`

**Interfaces:**
- CI verifies backend and customer independently; config documents required non-secret variables.

- [ ] **Step 1: Add backend CI** triggered by `backend/**` and backend workflow changes: `npm ci`, `npm test`, syntax checks for all backend modules.
- [ ] **Step 2: Extend customer CI syntax checks** for `server-bridge.js` and existing modified delivery UI.
- [ ] **Step 3: Add non-secret `CUSTOMER_APP_URL` var** and comments/documentation for required secrets; create `.dev.vars.example` containing names only, never values.
- [ ] **Step 4: Run/inspect GitHub CI on PR.**
- [ ] **Step 5: Commit.**

### Task 11: Integration verification and merge

**Files:** No production changes unless verification reveals a defect.

- [ ] **Step 1: Open PR** with explicit distinction between code-complete and live Google/Gmail activation.
- [ ] **Step 2: Confirm changed-file list contains no `v2/**`.**
- [ ] **Step 3: Confirm Customer V2 CI and backend CI are green on final PR head.**
- [ ] **Step 4: Confirm PR is mergeable and merge.**
- [ ] **Step 5: Confirm new backend migration/modules/customer bridge are present on `main` and legacy `v2/app.js` blob remains unchanged.**
- [ ] **Step 6: If connected environment exposes Cloudflare deploy credentials and Google OAuth secrets, apply migration/deploy and verify `/api/health`; otherwise stop at deploy-ready and explicitly report required external secrets/deploy commands without claiming live Gmail.**
