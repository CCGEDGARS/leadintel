# LeadIntel backend

Cloudflare Worker + D1 backend for authenticated workspace persistence.

## Security model

- Credentials are Worker secrets, never committed or sent to the public app bundle.
- Sessions use random opaque tokens; only SHA-256 token hashes are stored in D1.
- Session cookies are `HttpOnly`, `Secure`, and restricted to cross-origin HTTPS use.
- CORS permits only the configured LeadIntel application origin.
- Workspace membership and roles are checked server-side.
- Snapshot writes and authentication activity are recorded in an audit log.

## First deployment

1. Install dependencies: `npm install`
2. Authenticate: `npx wrangler login`
3. Create D1: `npx wrangler d1 create leadintel`
4. Put the returned database ID into `wrangler.toml`.
5. Apply migrations: `npm run db:remote`
6. Store `ADMIN_EMAIL` and `ADMIN_PASSWORD` using `npx wrangler secret put`.
7. Deploy: `npm run deploy`

Do not commit `.dev.vars`, Wrangler state, passwords, session tokens, Make webhooks, or provider API keys.
