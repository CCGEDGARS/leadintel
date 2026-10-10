# Clear message composer — 10 October 2026

The user supplied a screenshot showing an oversized sender summary, disabled actions for an absent default, ambiguous Default/Flow labels and two consecutive message-preparation notices. The message itself was pushed below this setup.

## Changes

- Compact sender summary: name, company, booking link and meeting platform. Optional contact fields remain in the canonical Sender & settings controls. The duplicate header edit action appears only when required sender details are missing. Sender and Languages panels retain matching styling.
- Automatic outreach default stays visible. An empty default offers Choose template, opening the library without touching the working draft. A saved default shows its name, purpose and explicit Use template / Edit template actions.
- Explicit Add to library, Set default and Add to flow labels; library precedes default in the toolbar. Already saved drafts disable redundant Save. Default selection requires a saved working draft and a library template.
- One update notice replaces Message preparation plus the separate readiness panel. Completed setup stays quiet. Sync, generation, missing sender and profile errors remain visible. Applying a prepared update is disabled during manual editing, saving or assistant work.
- Missing-placeholder advice names the actual marker and gives an Edit action. Assistant and save errors take priority over readiness advice.
- Shorter helper text and selected-style caption bring the subject and message higher. Style buttons retain their existing design.

## Root causes and prevention

Readiness incorrectly compared a deliberately edited working subject with the original selected subject and labelled the mismatch a changed source selection. Remove that comparison: actual style/trigger changes and stored prepared proposals remain pending; manual edits keep their own save/review boundary. Regression checks cover custom subjects, real source changes, pending proposals and downstream flow readiness.

The update action was disabled by generation readiness only, allowing it to remain active during manual editing. Include editor activity guards. Tests verify writable manual text survives rendering while the apply action is disabled.

The production smoke contract still expected the obsolete Add template label. Update the contract to require the new explicit action labels and useful default-library navigation.

## Verification

Run the complete customer suite, static build and exact-SHA CI/release proof on the final revision. Regression coverage includes empty-default navigation without draft replacement, default save/library gates, one notice, sync visibility, manual edit protection, actionable placeholder guidance and custom-subject flow readiness. No core template wording, persistence schema or sending behavior changes.

Authenticated visual verification remains unconfirmed: the existing LKAB tab was not reloaded. Local Chromium installation was attempted for an isolated render; the available network returned a non-ZIP download, so no visual render is claimed. The uploaded screenshot supplies the before-state evidence.
