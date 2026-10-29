# Writing Assistant toolbar and delivery handoff

User approved the proposed layout on 29 October 2026.

Put Load script and secondary Save draft at the top of the directly editable draft. More contains Save as template, Restore original and Clear draft (and Copy for general writing). Keep Close in the dialog header and Improve draft by the instructions. Consolidate revision Undo/Redo into the rich editor toolbar, retaining typing, formatting, AI revision and provenance recovery. Remove the redundant Edit action.

The single primary footer action is **Save & continue to delivery →** for customer email. Save the exact subject/body/HTML through the existing validated CRM save path, then close and scroll/highlight the main Continue to Delivery control without clicking it. Missing information may keep that main action disabled; focus its readiness explanation instead. Failed, local-only, stale-context and close/reopen saves must not close a newer dialog or navigate. General writing and manual channels use **Save & close** rather than promising email delivery. The footer stays outside the scrolling content on narrow screens.

Approaches: merely moving the existing controls would preserve the duplicate Undo mechanisms; introducing a new delivery flow would risk approval/send boundaries. Reuse the current save path, centralize editor history, and return focus to the existing main action. No template wording, approval, sending, paid lookup or backend behavior changes.
