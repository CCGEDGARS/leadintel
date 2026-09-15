# Microsoft account sign-in and email setup

LeadIntel supports Microsoft work/school accounts and personal Microsoft accounts through the Microsoft identity platform `common` tenant.

## Microsoft Entra app registration

1. Create an app registration that accepts **Accounts in any organizational directory and personal Microsoft accounts**.
2. Add these Web redirect URIs exactly:
   - `https://leadintel-api.edgars-7e7.workers.dev/api/auth/microsoft/callback`
   - `https://leadintel-api.edgars-7e7.workers.dev/api/integrations/microsoft-mail/callback`
3. Add these delegated Microsoft Graph permissions:
   - `User.Read`
   - `Mail.Send`
4. Create a client secret and store its **value** immediately. Do not commit it.

LeadIntel requests `openid`, `profile`, and `email` for sign-in. Mailbox connection separately requests `offline_access` and delegated `Mail.Send`. It does not request inbox-read permissions.

## Cloudflare Worker secrets

From `backend/`, configure the registration values as Worker secrets:

```sh
npx wrangler secret put MICROSOFT_OAUTH_CLIENT_ID
npx wrangler secret put MICROSOFT_OAUTH_CLIENT_SECRET
```

`OAUTH_TOKEN_ENCRYPTION_KEY` must also be configured as a base64-encoded 32-byte AES key. The two redirect URI variables are committed in `backend/wrangler.toml`.

## Verification checklist

1. Open `/customer/` and choose **Continue with Microsoft**.
2. Complete sign-in with both an organizational test account and a personal Microsoft test account.
3. As a workspace owner, connect Microsoft in Delivery & Learning and confirm the consent screen lists send permission but no mail-read permission.
4. Approve a tailored email, send it once, and verify Microsoft returns an accepted status.
5. Retry the same request and verify it is returned as a duplicate without a second provider request.
6. Confirm the customer activity feed identifies the provider as Microsoft and the shared Gmail/Microsoft daily remaining count decreases once.

Microsoft Graph returns `202 Accepted` for a successful `sendMail` request. This confirms acceptance for processing, not final recipient delivery.
