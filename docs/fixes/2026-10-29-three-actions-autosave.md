# Writing Assistant: three actions and automatic saving

User approved the revised layout: Reload script, Clear draft and Save as template above the customer draft, without More or a separate Save draft. Continue to delivery saves changed content then closes and returns focus to the existing main delivery action. Exact confirmed saved copies skip another write. Nothing is approved, sent or added to a flow by this action.

Continue stays clickable and explains empty text, in-progress AI, unapplied previews, upstream conflicts and unavailable saves. It is disabled while a save operation is running. Existing sender, workspace, recipient and context checks remain enforced. Failed saves preserve the working copy and show a retryable error. Customer Reload confirms replacement of edited work, loads the latest main message, retains Undo, and rejects late confirmations in another context. General writing retains its independent saved-script picker and Save & close.

Implementation: writing-assistant-ui.js owns the controls and save/return sequence; outreach-ui.js supplies exact saved-draft detection including HTML, provenance and general-record scope. Persisted-source and runtime race guards remain in place. Updated regression tests exercise the revised footer and reload behavior, confirmed-save skipping and real adapter save detection. Updated release assertions check the new labels.

Plan: observed failing behavior tests → implement controls and saved detection → update superseded UI assertions → run focused and full customer tests, syntax and build → review → publish and exact-SHA release verification. Native execution; existing source is git-backed.

Review found a reload edge case after save → reopen → Undo: the historical original was not the saved baseline. A failing regression reproduced the lost-confirmation path. Reload now compares against the current main source (or incoming/latest loaded baseline), and successful draft saves advance the local baseline. Cancellation preserves the Undo result.
