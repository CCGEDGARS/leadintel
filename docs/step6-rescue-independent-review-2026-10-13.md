# Step 6 rescue: independent review

## Confirmed cause and recovery

The baseline had four live handlers (`buildDossier`, `regenerateDrafts`, `confirmOutreachLanguage`, `applyCampaignToCurrent`) that replaced first-contact text with `LeadIntelOutreach.buildOutreachDrafts` generic copy while retaining `messageStudioDraft` metadata. Mounted tests reproduced the noncanonical Professional result. The historical `manual` or `rewrite` origin badge is not evidence that a user edited the text; metadata could survive automatic generation, and the customer explicitly identified automatic generation.

The repaired handlers preserve first-contact email and LinkedIn working copies, including unsaved typed text. New email content stays empty. Only explicit core selection/Update prepares protected core wording. All four mounted style controls emit deterministic canonical bodies and five supported subjects in the fixture.

Historical content must not be silently overwritten on reopening. The visible **Restore approved [style]** recovery action compares the displayed English core working copy against the real deterministic renderer. It does not infer manual activity from metadata. Its explicit action disables the saved personal override without deleting it, restores protected wording using current supported facts, preserves the exact previous working draft through persistent Undo/history, and requires Save. If the same-scope original snapshot is itself noncanonical, explicit recovery archives it before establishing the correct canonical Reset baseline. Events, LinkedIn and translated copies do not receive this core recovery action.

The October 13 10:05 screenshot proves the new layout and a noncanonical working body coexist. It does not establish that the new style/Update action produced that body. Restoring a historical working copy is deliberately preserved; the previous UI failed to explain this or offer an unmistakable approved-template recovery.

## Scope of evidence

`customer/test/step6-rescue-acceptance.test.js` uses the real mounted UI and actual editor/studio/CRM serialization modules. Provider, localization and CRM writes are mocked. It covers core styles, generic-generator bypass prevention, exact working text and original preservation, empty creation, unsaved editing, repeated-render control uniqueness, personal override retention, explicit Save/reopen, recovery/archive/Undo/Reset, and event/channel/language separation.

Existing blank-preparation tests cover read-only blank loading, failure restoration and stale response rejection. Existing layout tests cover mounted controls and resolved stylesheet breakpoints; these are not pixel measurements in an authenticated browser.

No private customer account was mutated and no outreach was sent. These checks do not prove deployment freshness or authenticated customer acceptance; exact-SHA release integrity remains a separate gate.
