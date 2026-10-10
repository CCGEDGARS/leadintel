# Message restoration and five visible subjects — 10 October 2026

## Problem and resulting behavior

The inline action had two label owners: Workspace painted Update while Outreach later overwrote it with Apply updated facts. Subjects required a dropdown and had repeated explanatory headings. Selecting a subject also called automatic body preparation, potentially staging an unrelated update on saved messages.

One label owner now presents Update message. The explicit action deterministically restores the saved default snapshot when configured, otherwise the selected controlled template, with confirmed context and existing field-validation/evidence gates. It never treats a pending whole message as canonical wording. Saved default snapshots survive later library edits. Previous exact subject/body are preserved in persistent templateUpdateUndo and bounded history; manual changes invalidate that Undo to avoid overwriting later edits. Restore clears durable-save readiness, including when text is identical, and needs Save again. Protected masters and the first tailored original remain immutable.

Five visible radio choices delegate to the canonical subject selection handlers. Unknown evidence keeps a choice disabled; AI Generated choices also use this visible selector. Subject selection keeps the body exact, records its context scope, and does not stage a body update on reopen. Subject/source changes still invalidate prepared-field context appropriately.

Add to flow is the sole top-right action. Saved/Unsaved is small text beside Your email. Set as default replaces Choose as default. Existing save, Profile, booking, recipient, placeholder and workspace-isolation gates remain.

## Validation scope

Regression coverage exercises all four protected core patterns, default snapshot restoration, tampered proposals, manual subjects, explicit-save boundary, persistent Undo through CRM save/reopen, later edit rejection, repeated radio rendering, handler delegation, source-change guards and initial automatic personalization. Production verification must use the exact merged SHA. No authenticated customer-tab reload or sending was performed.
