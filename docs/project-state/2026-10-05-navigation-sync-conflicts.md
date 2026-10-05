# Navigation-only sync conflicts — 5 October 2026

## Reproduced cause

The three-way merge treated `main.step`, `meta.discovery.visibleStep`, and
`meta.discovery.activeJourneyStage` as business fields. Two sessions opening
different stages therefore caused a whole-workspace conflict, even with safely
mergeable remote buyer research. These values describe the viewed page, not
approval, research completion, or sales progress.

## Repair and diagnostics

Simultaneous edits to only those three navigation paths retain the current
tab's value. Commercial data still uses the existing baseline and conflict
rules. Competing selected recipients, message drafts, source evidence, profile
answers, deletions versus edits, and missing trusted baselines still require
review. No automatic whole-workspace overwrite was introduced.

Genuine overlapping conflicts now expose the exact field paths in the sync
status tooltip and preserve a recovery copy immediately. The recovery record includes
the reason and version numbers, enabling diagnosis without choosing a side
first. Storage failure still blocks overwriting either live version.

## Validation and limits

Regression tests reproduced navigation collisions before the fix. Coverage
includes safe 409 retry, preservation of remote buyer research, reload, a clean
saved baseline, competing recipient/profile edits, and immediate recovery
diagnostics. All 1,741 customer tests and the static build passed locally.

The authenticated verification browser initially showed unsaved changes and
then synced automatically. It did not reproduce the customer's reported banner.
Navigation is a confirmed remaining failure path, not an asserted diagnosis
of the customer's separate browser. Exact-SHA production proof and browser
save/reload evidence must be reported separately.

## Toolbar correction

The first diagnostic banner printed full record paths inline, pushing recovery
controls outside the viewport. Keep the banner short, retain exact paths in its
tooltip and recovery JSON, and bound/wrap the account controls. This restores
access to Download recovery copy without choosing either conflicting version.

## Resolved-state toolbar

After customer recovery, show Download recovery copy only during an active
conflict and only for the matching workspace. Keep the stored recovery JSON
intact; resolving sync hides the control without deleting either backup.
Regression coverage exercises visibility during conflict and after resolution.
