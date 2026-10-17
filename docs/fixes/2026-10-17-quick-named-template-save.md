# Direct named-template save — 17 October 2026

The user requested Edit → edit the message → Save → enter a name → save a reusable personal template, without visiting Writing Assistant or the advanced library editor.

## Behavior

Saving in manual Edit mode for email or direct LinkedIn opens a compact accessible dialog with one required name field. No write occurs until the user submits the name. It saves a personal script through the existing authenticated workspace/user library, then saves the exact recipient draft to CRM with the personal template source association. Protected masters, first tailored originals, primary preferences, delivery approval and sending remain unchanged. Ordinary Save outside manual Edit mode retains the direct CRM save behavior. InMail and phone retain their dedicated editors.

The template copy uses the existing deterministic reusable-field conversion; it does not call AI or rewrite surrounding wording. Known identities, links and supplied fields are parameterized. Other literal project facts remain literal and should be reviewed when reusing the template with another recipient. The current recipient draft retains the exact edited subject/body.

Cancel/Escape returns to the message editor with edits preserved and no false save error. Empty names cannot submit. Save failures keep the name and draft available for retry. A template saved before a CRM failure is retried using the same ID/revision. Buyer, workspace, channel, style and draft changes are checked before writes and after asynchronous work. Successful association suppresses the obsolete-core warning for the personal copy. Template success feedback identifies the chosen name.

## Verification

Seven focused tests cover the real main-editor handoff, personal endpoint and reusable payload, exact recipient text, no AI/send actions, empty name, Cancel, Escape, template/CRM retry, and changed-customer guards. Full frontend suite: 2,837 passing. Production claims require the exact revision's PROVEN release proof and browser check of Edit → Save → name dialog → Cancel, preserving the user's existing draft.
