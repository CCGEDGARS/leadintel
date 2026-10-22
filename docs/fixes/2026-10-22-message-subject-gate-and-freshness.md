# Message creation and safe release freshness — 22 October 2026

## Reproduction and root cause

Authenticated owner session: Klas Nilsson / Stegra / Professional. The page had a blank email with Professional marked pressed. Clicking Professional completed factual-field preparation, but `validateCoreDraft` rejected the entire working draft with `Update needs all five subjects: Needs reviewed project or location...`. Three supported subject choices were available. This incorrectly coupled creation of one email to availability of every alternative subject. Page quality already treats the aggregate five-category audit as informational; selected-subject validity/evidence remains a separate approval gate.

The blank-on-open policy is intentional (11 October agreement): opening a new recipient must not silently generate or overwrite text. The visual default incorrectly implied that a style had already been selected/applied. Saved/manual text must reopen exactly.

The loaded release meta was 605792d4127d5d28333cd09a522381f2a16f53d1 although the URL retained an older `release` query. That query is a cache buster, not a pin to an old deployment. The previous release monitor could announce a change but required manual Update even for a clean idle workspace.

## Changes

- Preserve exact approved body/frame validation and the selected-subject 60-character gate. Unavailable alternative categories remain disabled and explain their missing evidence; they do not prevent working-draft creation.
- A blank, idle, error-free composer has no pressed writing-style button. Deliberate clicks continue to create drafts; pending/failed selections and applied styles retain feedback.
- Check release freshness on opening, return/focus, workspace ready/sync, and every minute. Automatically navigate to a newer release only after persistence is available, the workspace is clean, sync is settled, and no editable field, message edit, open settings/dialog or visible busy procedure is active. Dirty work keeps the update notice/manual Save-and-update path. Hidden busy placeholders never prevent safe updating.
- Refresh the complete changed asset import/loader chain. Approved originals remain byte-for-byte unchanged. Nothing approves or sends outreach.

## Validation

Regression tests were observed failing before the fixes. Tests cover partial subjects, protected body mutation, invalid chosen subjects, truthful blank-state buttons, explicit creation, saved/new-recipient reopening, dirty/edit/dialog/busy refresh guards, hidden placeholders and synchronization-triggered refresh. Full customer suite, static build and exact-SHA production proof are required before reporting production completion. Authenticated generation and save/reopen are separate acceptance checks.
