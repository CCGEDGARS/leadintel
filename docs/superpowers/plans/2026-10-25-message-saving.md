# Message saving and recovery

User approved Save draft, Save as template, and Version history.

- Save draft writes the exact subject, body, safe formatting and sender context to the existing immutable CRM script-package activity. A failure must remain visibly unsaved.
- Save as template is a separate top action. It creates a named reusable personal copy through the existing script library, preserving protected masters.
- Version history combines recipient/channel/language-scoped browser recovery checkpoints with CRM saved copies, offers a preview, and restores only working text and sender/style context. It never restores approval or sends.
- Capture live edits synchronously in a bounded local recovery journal. Keep displaced working copies before replacements and sender updates. Local-only recovery is labelled honestly; cloud history comes from CRM saves.
- Release checks show an update notice and require explicit Update now. Before an update, checkpoint live edits; block navigation if this fails. Never silently reload a clean-looking page while a draft exists only in the editor.

Verification: journal reload/isolation/quota handling, exact HTML and whitespace, pagination and context races, guarded restore/undo, separate save actions, failed save status, explicit refresh, full customer/backend suites, build, independent review, exact-SHA CI and release proof, authenticated UI checks without sending.
