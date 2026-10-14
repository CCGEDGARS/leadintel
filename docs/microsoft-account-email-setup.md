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

## Customer connection help

Settings keeps one primary Microsoft sign-in or mailbox connection action on each card. Clicking a sign-in, account-switch or configured mailbox-connect action opens concise guidance with a Continue to Microsoft button. Troubleshooting is collapsed under Trouble signing in?. Cancel or Escape returns focus without redirecting; only explicit Continue starts the requested Microsoft operation. An account/workspace change blocks stale continuation. Unavailable mailbox connections stay disabled. The popup separates normal account consent, organisation administrator approval and AADSTS700016 configuration failures. Customers use their own accounts; they do not create app registrations or supply client secrets.

For AADSTS700016, LeadIntel support must verify the Worker client ID against the existing Entra app registration, the supported account types and registration availability. The customer's administrator may need to approve the enterprise application. The help popup does not repair or prove the external registration. Capture the error code, timestamp, Request ID and Correlation ID; never collect passwords or tokens.

Regression coverage: `node --test customer/test/mailbox-settings-controls.test.js customer/test/ai-settings.test.js customer/test/settings-tool-links.test.js`. Checks cover popup access, no authentication side effects, Escape dismissal, focus return, unchanged mailbox actions and Settings reopen behavior.

The connection popup now includes four action-specific steps and the expected Selected/Connected result. Collapsed troubleshooting explains Request approval when the organisation enables it, supplies a selectable IT request, and gives the AADSTS700016 evidence collection and support handoff. The support email link opens a draft to Edgars at CCGROUP with placeholders; the customer adds details and sends it. LeadIntel does not submit approval requests or send support emails automatically. Microsoft reference: https://learn.microsoft.com/en-gb/entra/identity/enterprise-apps/user-admin-consent-overview.

The complete popup includes six workspace sign-in steps and three mailbox steps (1–9), with the current action shown first and the other flow expandable. Official personal/work password recovery links open in a new tab. Work-account recovery is conditional on organisation self-service settings; company approval cannot be bypassed. References: https://support.microsoft.com/en-us/accounts-billing/manage/reset-a-forgotten-microsoft-account-password and https://learn.microsoft.com/en-us/troubleshoot/microsoft-365/admin/sign-in/forgot-sign-in-password.
