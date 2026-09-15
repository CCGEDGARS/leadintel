# Brand & Email Identity — Design Specification

Date: 2026-09-15  
Status: Proposed for implementation  
Scope: LeadIntel Customer, Step 1 and outreach delivery

## 1. Outcome

Add a **Brand & Email Identity** module to Step 1 so each workspace can define how its outbound emails look and who they appear to come from. The same approved identity must be used by preview, Gmail delivery, Microsoft 365 delivery, and future automated delivery.

This is sender identity, not recipient personalization. Company-specific outreach copy, evidence, recipient name, role, and buying signals continue to be generated per prospect.

## 2. User experience

Place the module immediately after **Main company website** in Step 1. It is optional and must not block research or plain-text sending.

### Collapsed state

- Title: **Brand & Email Identity**
- Description: “Add your logo and sender details so outreach emails look consistent and personal.”
- Status: `Not configured`, `Draft`, or `Ready`
- Primary action: **Set up email identity** or **Edit identity**

### Expanded state

Fields:

- Company display name
- Sender name
- Sender job title
- Company website
- Phone number
- LinkedIn URL
- Primary brand colour
- Plain-text signature
- Optional legal/footer text and postal address
- Logo upload
- Optional sender headshot upload
- Optional promotional banner upload, disabled by default

Actions:

- **Extract from website** — proposes company name, logo candidate, colour, website, and public contact details from existing website evidence
- **Upload logo / image** — lets the user replace extracted assets
- **Preview email** — desktop, mobile, and plain-text tabs
- **Save brand identity** — validates and activates the identity

Website extraction is suggestion-only. It never activates an image or field without user approval. Remote images are copied into LeadIntel-managed storage before they can be used in sent email; the system must not hotlink a third-party website image.

## 3. Email presentation

The default branded email remains deliberately light to protect readability and deliverability:

1. Small logo, maximum display size 140 × 48 px
2. Editable personalized message body
3. Sender name and title
4. Company name and optional phone, website, and LinkedIn link
5. Optional small headshot
6. Optional legal/footer text and unsubscribe language where required

The promotional banner is opt-in and appears after the message body, never as a large hero above the message. The renderer uses a 600 px table-based layout, inline styles, system fonts, accessible alt text, and a fully equivalent plain-text part. Missing or blocked images must not make the message unreadable.

## 4. Data contract

Store identity metadata inside the existing `main` workspace state so it participates in the current optimistic-concurrency and workspace-isolation behavior. Do not store image bytes or base64 data in the 500 KB state payload.

```js
main.brandIdentity = {
  schemaVersion: 1,
  status: "draft" | "ready",
  revision: 1,
  companyDisplayName: "",
  senderName: "",
  senderTitle: "",
  website: "",
  phone: "",
  linkedinUrl: "",
  primaryColor: "#0f6557",
  signatureText: "",
  legalFooter: "",
  postalAddress: "",
  options: {
    includeLogo: true,
    includeHeadshot: false,
    includeBanner: false
  },
  assets: {
    logo: null,
    headshot: null,
    banner: null
  },
  updatedAt: "ISO-8601 timestamp"
}
```

Each asset reference contains only `{ id, url, mimeType, width, height, altText, updatedAt }`. The opaque URL must not expose a workspace name, user email, or original filename.

Version 1 supports one active identity per workspace. The object boundary allows multiple identities later without adding multi-brand UI now.

## 5. Asset storage and API

Add a private Cloudflare R2 bucket binding named `BRAND_ASSETS` to the Worker. D1/customer state stores metadata; R2 stores bytes. Serve approved assets through an opaque, read-only public route with immutable caching.

Endpoints:

- `POST /api/customer/brand-assets?workspace_id=...` — authenticated multipart upload
- `POST /api/customer/brand-assets/import?workspace_id=...` — authenticated server-side import of an approved website candidate
- `GET /api/customer/brand-assets/:asset_id` — public opaque asset response used by email clients
- `DELETE /api/customer/brand-assets/:asset_id?workspace_id=...` — owner/researcher replacement or removal

Upload requirements:

- Allow PNG, JPEG, and WebP only; reject SVG and executable/polyglot content
- Validate declared MIME type and magic bytes
- Logo maximum 2 MB; headshot/banner maximum 5 MB
- Reject dimensions above 6000 × 6000
- Generate opaque random IDs and workspace-scoped object keys
- Set `X-Content-Type-Options: nosniff`, a strict content type, and immutable cache headers
- Verify workspace membership for upload, import, and delete
- Public GET reveals only the approved image, never workspace metadata
- Replaced assets are deleted after the new state revision saves successfully; failed replacement leaves the previous asset intact
- Workspace reset deletes referenced assets and records an audit event

## 6. Rendering and approval integrity

Create one deterministic renderer shared conceptually by preview and delivery:

```js
renderBrandedEmail({ subject, bodyText, brandSnapshot, recipientContext })
// => { subject, textBody, htmlBody }
```

The editable source remains plain text. HTML is generated from escaped text and validated identity fields; users cannot enter arbitrary HTML, CSS, scripts, tracking pixels, or remote image URLs.

When an outreach draft is approved, save an immutable `brandSnapshot` containing the active identity revision and resolved asset references. Preview and send use this snapshot. Later edits to Step 1 branding do not silently modify already approved drafts. The user must regenerate or explicitly refresh and reapprove a draft to use a newer identity revision.

If no ready identity exists, or if an approved legacy draft has no snapshot, send the existing plain-text email unchanged.

## 7. Gmail and Microsoft 365 delivery

Extend both manual send requests with backward-compatible optional fields:

```js
{
  domain,
  recipient,
  subject,
  body,          // existing canonical plain text
  text_body,     // optional rendered text
  html_body,     // optional sanitized rendered HTML
  idempotency_key
}
```

- Gmail: change `buildMimeMessage` to emit `multipart/alternative` when `html_body` is present; retain the current text-only message when it is absent.
- Microsoft Graph: send `contentType: "HTML"` with `html_body` when present, otherwise retain `contentType: "Text"`.
- Backend validation enforces size limits and rejects unsafe HTML even though the frontend renderer is trusted.
- Existing idempotency, auditing, daily limits, CRM activity, and reply tracking remain unchanged.
- Automated Gmail delivery must use the stored approved snapshot before branded automation is enabled. Until its queue schema carries that snapshot, it continues to send the existing plain-text body rather than rebuilding from mutable workspace state.

## 8. Validation and error handling

`Ready` requires company display name and sender name. All other fields are optional.

- Invalid website, LinkedIn, phone, colour, or image shows an inline field error and cannot be activated.
- Upload/import failure keeps the last saved image and identity.
- Preview states clearly identify blocked/missing images.
- Send failure never falls back from a branded approved draft to different content without telling the user. A safe retry reuses the same idempotency key and snapshot.
- All text is escaped before HTML generation; URLs are restricted to `https:` except validated phone links.

## 9. Accessibility and responsive behavior

- Labels are persistent and associated with controls.
- Upload controls work by keyboard and expose accepted type/size.
- Colour selection includes a text hex input and contrast warning.
- Preview tabs have correct selected state and keyboard operation.
- Mobile stacks fields and actions into one column; preview never creates horizontal page scrolling.
- Status is communicated by text and icon, not colour alone.

## 10. Test and release gates

Frontend tests:

- Module placement and collapsed/expanded behavior
- Draft/ready validation and state persistence
- Website extraction remains suggestion-only
- Upload replacement preserves the previous asset on failure
- Desktop/mobile/plain-text preview parity
- HTML escaping and unsafe URL rejection
- Approved draft snapshots remain unchanged after identity edits
- Legacy drafts continue to send plain text
- Cache/version contracts and mobile layout

Backend tests:

- Workspace authorization and asset isolation
- MIME/type/magic-byte/size/dimension checks
- Opaque asset serving and safe headers
- R2 cleanup after replacement/reset
- Gmail multipart/alternative construction
- Microsoft HTML and text fallback payloads
- HTML sanitization and payload limits
- Idempotency and audit behavior remain intact
- Automation stays plain text until snapshot support is added

Release verification:

- Full customer and backend suites pass
- Exact source SHA is deployed
- Production smoke test uploads a logo, saves identity, previews all three modes, sends one Gmail test and one Microsoft 365 test, and confirms both contain equivalent text
- Production proof must verify the deployed SHA before the feature is called live

## 11. Delivery sequence

1. Add state normalization, renderer, and tests
2. Add R2 binding, asset routes, validation, cleanup, and tests
3. Add Step 1 module, extraction suggestions, upload flow, and previews
4. Snapshot identity on outreach approval
5. Extend Gmail and Microsoft manual delivery
6. Run production UI review, CI, deployment, and exact-SHA proof

## 12. Explicit non-goals for version 1

- Multiple active brands
- Free-form HTML template editor
- Tracking pixels or open tracking
- Arbitrary remote images
- Automatic activation of website-extracted branding
- Rebranding already approved drafts without reapproval
- Enabling branded automatic Gmail delivery before the automation queue persists an approved identity snapshot
