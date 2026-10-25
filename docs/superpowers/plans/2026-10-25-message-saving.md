# Message saving and recovery

User approved Save draft, Save as template, and Version history.

- Save draft writes the exact subject, body, safe formatting and sender context to the existing immutable CRM script-package activity. A failure must remain visibly unsaved.
- Save as template is a separate top action. It creates a named reusable personal copy through the existing script library, preserving protected masters.
- Version history combines recipient/channel/language-scoped browser recovery checkpoints with CRM saved copies, offers a preview, and restores only working text and sender/style context. It never restores approval or sends.
- Capture live edits synchronously in a bounded local recovery journal. Keep displaced working copies before replacements and sender updates. Local-only recovery is labelled honestly; cloud history comes from CRM saves.
- Release checks show an update notice and require explicit Update now. Before an update, checkpoint live edits; block navigation if this fails. Never silently reload a clean-looking page while a draft exists only in the editor.

Verification: journal reload/isolation/quota handling, exact HTML and whitespace, pagination and context races, guarded restore/undo, separate save actions, failed save status, explicit refresh, full customer/backend suites, build, independent review, exact-SHA CI and release proof, authenticated UI checks without sending.

## Root cause and prevention

While the email editor was in Edit mode, input updated only the manual-origin marker; the actual subject/body remained in the DOM until Save. Release freshness could reload a workspace considered clean once focus left a field. The combination could discard live editor text. Save also opened the template-name flow, obscuring the distinction between an exact recipient draft and a reusable pattern.

Input now writes immediate recovery checkpoints independently of workspace synchronization. CRM saves remain the durable cross-device versions. History restores clear saved/approval authority, preserve the historical sender through ordinary rerenders and select the historical style. Explicit sender changes retain their normal behavior while checkpointing the displaced copy. A quota failure blocks replacements, but an explicit CRM save stays available. Pagination and late-response tests verify that older versions cannot cross recipients.

Independent review found and resolved quota-failure replacement and restored-style mismatches. Final merged validation: 3,795 customer tests, 919 backend tests and the static production build passed. Nine focused history checks cover storage/reload, safe previews, context changes, quota, sender/style and paginated saved copies. No outreach or test email was sent.
