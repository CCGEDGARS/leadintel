# Compact event invitation panel

The Messages event panel now belongs to the same editor column as the message card above it, so desktop alignment follows the existing responsive layout rather than a separate calculated offset. It starts collapsed. Its native details/summary control supports clicking the whole header and keyboard activation; refreshes and event activation do not force it open or closed.

The header retains the active event name, readable dates and a status derived from the existing recipient's event draft. Saved is shown only for a matching event version and unchanged visible preview. Unsaved previews remain marked for review. The expanded panel has one introductory sentence and optional How it works instructions. Collapsing does not recreate inputs, discard previews, generate content or save anything.

Existing event, recipient, source and approval guards still own context changes. Event and business drafts retain their existing storage and recovery paths. No invitation wording, core master, research rule or sending permission changes.

Acceptance includes existing event tests, disclosure/input/preview preservation, saved-status changes, and the authenticated HTTP/SQL event journey. Browser checks exercise keyboard activation, refresh stability and editor alignment at 1440, 390 and 320 pixels, then continue through the existing template save and fresh reopen flow. Provider and mailbox interactions in this harness are controlled fixtures; actual customer-session acceptance is separate. Exact-SHA production proof remains required for deployment claims.
