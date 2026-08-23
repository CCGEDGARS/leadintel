# LeadIntel Customer V2 Production SaaS Design

## Goal
Turn the existing Customer V2 prototype into a production-oriented multi-tenant SaaS foundation without rewriting the proven customer workflow or modifying legacy `/v2`.

## Approved architecture
Use the existing Cloudflare Worker + D1 backend as the system of record. Extend the existing `users`, `sessions`, `workspaces`, `workspace_members`, audit and workspace-scoped API patterns rather than introducing a second auth/database stack.

The customer browser remains modular. Existing localStorage modules continue to operate as a fast client cache, but authenticated sessions hydrate from and persist to versioned D1 workspace state. Server state is authoritative when authenticated.

Google identity and Gmail authorization are separate concerns:
- Google sign-in authenticates the LeadIntel user and creates/upserts a default company workspace when needed.
- Gmail connection is an explicit workspace-scoped integration, requested separately with Gmail scopes and offline access.
- No Gmail token is exposed to or stored in browser storage.

## Non-goals
- Do not rewrite Customer V2 Steps 1–7.
- Do not modify legacy `/v2/**` files.
- Do not add autonomous/silent email sending.
- Do not claim Gmail is live until required Google OAuth credentials and Worker secrets are configured and the Worker is deployed.
- Do not migrate to Supabase/Postgres or another auth provider in this milestone.

## 1. Identity and tenancy

### Existing model retained
`users`, `sessions`, `workspaces`, and `workspace_members` remain the authorization spine.

Every authenticated customer API operation must resolve:
1. current session user;
2. requested `workspace_id`;
3. matching `workspace_members` row;
4. role authorization for the requested operation.

### Google sign-in
New endpoints:
- `GET /api/auth/google/start?return_to=<customer-url>`
- `GET /api/auth/google/callback?code=...&state=...`

Start endpoint generates a cryptographically random nonce, stores only its SHA-256 hash plus return URL and expiry, and redirects to Google OAuth authorization.

Callback exchanges the code server-side, retrieves the Google identity, upserts the user by verified Google email, creates a LeadIntel session, and ensures the user owns at least one workspace. New users receive one default workspace derived from their display/company name. The browser receives only the HttpOnly session cookie.

The existing owner password login remains available for the current operator/admin workflow.

### Workspace bootstrap
New endpoint:
- `GET /api/workspaces`

Returns only workspaces where the current session user is a member, including membership role. Customer UI selects the first workspace by default unless a previously selected accessible workspace exists.

## 2. Persistent Customer V2 state

### D1 table
Create `customer_workspace_state`:
- `workspace_id` primary key and FK to `workspaces`
- `schema_version` integer
- `version` integer optimistic-lock counter
- `payload_json` valid JSON
- `updated_by` user FK
- `updated_at`

Payload stores a bundle of the current Customer V2 namespaces:
- `main`
- `discovery`
- `outreach`
- `delivery`
- optional metadata required by the existing browser workflow

### API
- `GET /api/customer/state?workspace_id=...`
- `PUT /api/customer/state?workspace_id=...`

GET returns `{workspace_id, schema_version, version, payload, updated_at}`. Missing state returns a valid empty state at version 0.

PUT accepts `{schema_version, version, payload}`. Only `owner`, `researcher`, or `sales` roles may write. Payload size is capped at 1 MB. Server rejects invalid/non-object JSON. Optimistic concurrency requires client version to match server version; conflicts return HTTP 409 with current server version/state so the client can rehydrate rather than overwrite newer data.

Every successful write increments version and creates an audit event.

### Browser bridge
Add a production bridge module loaded before the customer workflow finishes initializing.

Behavior:
- Call `/api/session` with credentials.
- If unauthenticated, keep the current local-only prototype fully usable and show `Local workspace · Sign in to sync`.
- If authenticated, fetch accessible workspaces and current workspace state.
- Server payload wins during initial authenticated hydration.
- Hydrate the existing localStorage keys before dependent modules render server-backed data.
- Observe changes to Customer V2 storage keys and debounce persistence to D1.
- Use version returned by the server for optimistic PUT.
- On 409, stop autosave, fetch server state, rehydrate, and show a visible conflict/reload notice rather than silently overwriting.
- UI status becomes `Synced to LeadIntel` only after successful server persistence.

## 3. Gmail connection

### Separate OAuth state
Gmail uses a separate OAuth state record from Google sign-in and is tied to a workspace and initiating user.

New endpoints:
- `GET /api/integrations/gmail/status?workspace_id=...`
- `GET /api/integrations/gmail/start?workspace_id=...&return_to=<customer-url>`
- `GET /api/integrations/gmail/callback?code=...&state=...`
- `POST /api/integrations/gmail/disconnect?workspace_id=...`

Scopes for the first production version:
- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`

Authorization requests use `access_type=offline` and `prompt=consent` for initial connection so a refresh token is available.

### Token storage
Create `gmail_connections` keyed by workspace. Store:
- workspace/user identifiers
- connected Google email
- encrypted refresh token
- granted scopes
- status
- optional latest Gmail history ID
- connected/refreshed/disconnected timestamps

Refresh tokens use AES-GCM with a server-only 256-bit key from `OAUTH_TOKEN_ENCRYPTION_KEY`. Ciphertext includes version, IV and ciphertext/tag; no plaintext token is logged or returned.

Only workspace owner may connect or disconnect Gmail in this milestone. Sales/research roles may use an already connected workspace Gmail send/sync path if their membership role permits the related CRM write.

## 4. Gmail send

### Endpoint
`POST /api/integrations/gmail/send?workspace_id=...`

Request:
```json
{
  "idempotency_key": "client-generated-16+-char-key",
  "domain": "target.example",
  "recipient": "buyer@target.example",
  "subject": "Approved subject",
  "body": "Approved body"
}
```

Requirements:
- authenticated member with `owner` or `sales` role;
- active Gmail connection;
- valid recipient email;
- non-empty subject/body within bounded sizes;
- valid idempotency key.

Server refreshes the Gmail access token, creates RFC 2822 MIME, base64url encodes it, and calls Gmail `users.messages.send`.

### Duplicate-send protection
Create `gmail_messages` with a unique `(workspace_id, idempotency_key)` constraint. Repeated send calls with the same key return the existing send record and never call Gmail again.

Persist:
- Gmail message id
- thread id
- recipient
- subject
- related target domain
- sent timestamp
- status
- initiating LeadIntel user

Audit every accepted send without storing message body in audit metadata.

## 5. Gmail reply sync

### Endpoint
`POST /api/integrations/gmail/sync?workspace_id=...`

The endpoint examines tracked sent Gmail threads, retrieves thread data via Gmail API, and normalizes inbound messages occurring after LeadIntel's sent message.

Create `gmail_replies` with unique Gmail message ID per workspace. Persist only normalized CRM-useful fields:
- workspace/domain
- Gmail message/thread ids
- sender email
- received timestamp
- normalized text body capped to a safe size
- deterministic reply category

Use the same conservative categories already implemented in Customer V2:
- meeting_request
- positive
- objection
- not_now
- referral
- unsubscribe
- out_of_office
- neutral

Sync is idempotent: known Gmail message IDs are skipped.

The API returns newly normalized replies. Customer UI feeds these replies through the existing delivery state functions so the local/server Customer state and pipeline move to Replied/Meeting using the same non-regression rules already tested.

No background cron/push subscription is required in this milestone; sync is explicit via UI. Architecture leaves room for Gmail push/watch later.

## 6. Customer Gmail UI

Step 7 changes from the current permanent manual bridge to a capability-aware connector:

Unauthenticated/local:
- current Gmail Compose manual-confirmation flow remains available.

Authenticated but Gmail disconnected:
- show `Connect Gmail`.
- manual Gmail Compose remains available as fallback.

Authenticated + Gmail connected:
- show connected mailbox.
- approved outreach can use `Send with Gmail` after an explicit confirmation click.
- send button never triggers without user action.
- show `Sync replies` button.
- returned replies are classified/recorded and the pipeline is updated.
- disconnect is available to workspace owner.

The existing manual confirmation buttons remain a fallback and are clearly labelled.

## 7. Security

Required controls:
- HttpOnly Secure SameSite=None LeadIntel session cookie retained because app and API are cross-origin.
- CORS allow-list remains explicit.
- OAuth state is random, hashed at rest, single-use and expires in 10 minutes.
- Google callback rejects missing/expired/used state.
- Return URLs are limited to configured LeadIntel customer origins/paths; arbitrary external redirect URLs are rejected.
- Workspace membership checked on every state/Gmail operation.
- Google verified email required for login.
- Refresh tokens encrypted with AES-GCM server-side.
- Token plaintext never returned, logged or audited.
- Gmail send is idempotent.
- Message and state request sizes are bounded.
- Gmail reply text is capped before persistence.
- Terminal CRM stages never regress in browser state.

## 8. Configuration

Worker secrets/vars required for live Google/Gmail:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GMAIL_OAUTH_REDIRECT_URI`
- `OAUTH_TOKEN_ENCRYPTION_KEY`
- `CUSTOMER_APP_URL` (for safe return URL validation)

The repository must not contain real secret values. `wrangler.toml` documents non-secret defaults/placeholders only where appropriate.

## 9. Testing

Backend tests must cover pure helpers for:
- OAuth state/return URL validation
- token encryption/decryption round trip and tamper rejection
- Gmail MIME/base64url generation
- reply body extraction/classification
- workspace-state validation/size/version semantics
- idempotency normalization

Customer tests must cover:
- production bridge module loading
- explicit local vs synced status
- server-state hydration/persistence API paths
- Gmail connector states
- explicit user-controlled Gmail send
- reply sync handling
- fallback manual compose remains available

Full existing Customer V2 test suite remains mandatory.

## 10. Deployment and definition of done

A code-complete milestone requires:
- D1 migration added;
- backend and customer modules implemented;
- backend tests green;
- Customer V2 tests green;
- syntax checks green;
- no `/v2/**` changes;
- PR mergeable and merged only after green CI.

A live-integrated milestone additionally requires externally configured Google OAuth credentials, encryption secret, D1 migration application and Worker deployment. If those deployment credentials/secrets are unavailable through the connected environment, the repository will be deploy-ready but the response must explicitly label Google/Gmail live activation as pending external secret configuration rather than claiming it is live.
