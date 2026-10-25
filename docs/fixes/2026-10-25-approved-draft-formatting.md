# Formatting controls missing after Edit

The customer's screenshot and authenticated DOM showed Edit mode active, Save draft available, but the subject and email textarea still disabled. The rich editor correctly hid its toolbar and made the visible body read-only because it mirrors both `disabled` and `readOnly` from the canonical textarea.

`renderDossier` disables approved draft fields. The explicit message editor later changed only `readOnly`, leaving the approval lock on `disabled` behind. The workspace renderer now clears that inherited lock only when its own explicit Edit state and existing readiness, authentication, conflict, pending, generation, assistant and saving gates permit editing. Leaving Edit restores read-only behavior. No draft, approval, master, save or send data changes as part of rendering.

Regression coverage begins with disabled subject/email/LinkedIn fields, renders explicit Edit on an approved draft, checks enabled typography and list controls, applies bold to an actual selection without changing wording, and verifies that leaving Edit hides controls while preserving formatting. Saving and blocked states remain read-only. Existing rich-text flow tests cover formatting persistence through CRM snapshots, reload and approval; assistant UI tests cover formatting handoff.

Prevention: editor integration tests must begin with the field states produced by the preceding dossier renderer, including approved records. Testing a fresh enabled textarea alone misses this interaction.
