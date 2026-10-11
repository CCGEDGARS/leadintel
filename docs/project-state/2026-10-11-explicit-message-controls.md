# Explicit message creation and controls — 11 October 2026

## Cause and agreed behavior

The style handler returned early on repeat clicks, leaving edited text behind. New-message opening also filled blank drafts in the background. Core buttons could use an active personal override, while AI Generated changed the selection without generating. Update could silently choose an unrelated automatic default. A pending-update hint could hide a genuine sync blocker.

New recipient drafts now stay empty until an explicit style click or Update. Reopening preserves exact working/saved text. Core clicks always restore their own canonical frame with current supported facts; personal revisions remain stored. Each AI Generated click requests a fresh original. Update uses the selected pattern, with existing separate event update and applied-default snapshot behavior preserved. Style switching aborts superseded AI requests. Late AI responses also compare current draft/facts/readiness before application. Errors stay visible across renders.

The header has green Update message beside Add to flow and “Choose the style and update your message.” The lower row has Edit, Save, Reset, Add to templates and Set as default. Visible Undo and the duplicate Save warning are removed; recovery history and explicit durable Save gates remain. The existing sync resolver retains both versions and requires a deliberate version choice. No outreach is sent or flow activated.

## Verification

Regression coverage exercises assembled controls, blank new-recipient handoff, repeated clicks on all four references, master preservation, saved-draft reopen, CRM serialization/Reset, active personal override, repeated AI generation, visible failure, and late results after style/body/facts/sync changes. Existing seller isolation, body ceilings, five-subject readiness, evidence, translation, event, Save and flow guards remain covered by the customer suite. Release status requires exact-SHA CI, manifest, health, every mandatory smoke and PROVEN release-proof.json. Authenticated customer evidence is reported separately from those checks.
