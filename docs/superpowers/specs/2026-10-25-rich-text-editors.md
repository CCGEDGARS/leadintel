# Shared message formatting

Approved by Edgars on 25 October 2026 in the product discussion.

Provide the same compact toolbar in Your email (while Edit is active) and the Writing Assistant working draft: bold, italic, underline, bullet/numbered lists, links, undo/redo, clear formatting, plus More formatting with Arial/Tahoma/Verdana/Georgia and Small/Normal/Large/Extra large. Default Arial/Normal/left aligned. Remember typography for new text in the account-scoped browser cache. Subject stays plain text. No text colour requested.

Keep canonical text and optional sanitized matching HTML together. Do not mutate protected master scripts. Formatting changes require Save/review just as wording changes do; cancellation, Undo, original recovery and recipient/workspace guards retain both. Carry formatting through assistant handoff, CRM normalization, personal/general templates, translation versions, approved frozen payloads, preview, rich clipboard and MIME delivery. Never let stale HTML override newer plain text. Existing plain drafts stay compatible. AI revisions retain paragraph/list structure and surviving inline emphasis; changed text must not accidentally inherit unrelated links.

Use a shared editor and bounded HTML allowlist; no external assets, scripts, events, arbitrary styles or unsafe links. Email backend must accept only the required additional semantic tags. Test actual editor input/selection, paste, saved/reloaded drafts, formatting-only changes, stale HTML, unsafe HTML, undo/cancel, disabled state and isolation. Test email construction without sending mail. Release only with exact-SHA CI and release-integrity evidence; distinguish browser fixture evidence from signed-in production acceptance.

Approaches: selected a shared rich editor with backward-compatible text bridges and safe HTML; rejected independent toolbars (drift), Markdown controls (no visual editing), and a full document editor (unnecessary complexity).
