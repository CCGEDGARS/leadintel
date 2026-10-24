# Messages usability and spacing

Screenshots showed competing Send Email / Open Delivery / Continue actions, repeated saved/approved banners, oversized language management rows, crowded secondary actions and weak separation between main and optional work.

Messages now has one footer Continue to Delivery action using the established exact-recipient, save/approval/CRM handoff. Sending remains in Delivery. Copy and Test sit with editing controls; Retry appears only on failure. Saved status is a compact badge, with unsaved edits taking priority over old flow membership. Sent status is explicit. Required fixes and progress remain visible.

Language settings remain collapsed initially. Their summary names the displayed and default language. Rows identify the selected translation target; Translate and language-version sync are separate. English originals, translations, removal Undo, CRM snapshots and canonical email text are preserved. CSS applies 16/24px section spacing, consistent 44px controls, readable body width, focus outlines, and one-column settings/footer on narrow screens.

Review reproduced and fixed an empty-message Copy visibility regression and an inherited unresolved-preview handoff guard gap. Mounted runtime tests exercise the new states, language selection, legacy Delivery load ordering and existing exact-recipient no-send handoff. Full test/build and release results are recorded at completion.

Browser preview of the scratch server was unavailable because the connected browser cannot reach the workspace's localhost. Do not represent DOM/CSS fixture checks as authenticated customer/browser acceptance.
