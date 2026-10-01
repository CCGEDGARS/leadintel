# LeadIntel — 1 October 2026 checkpoint

## Delivered source changes
- Added an explicit company source review before connecting an event to the selected buyer's script package. Monitoring alerts remain unreviewed company associations until the user checks the source.
- Preserved source date, detection timestamp and review timestamp separately; unknown publication dates stay unknown. Modification timestamps no longer masquerade as publication dates.
- Removed unsupported “recent public activity” fallback wording.
- Stored complete normalized script/dossier/buyer/trigger snapshots in workspace-scoped CRM activity metadata, with explicit save/reopen controls. Reopen searches paginated history and never creates a company merely to read history.
- Protected CRM reads and subsequent writes against workspace changes.
- Fixed monitoring completion refresh: the busy flag previously prevented its forced reload from fetching alerts/history.
- Refreshed all affected asset loading boundaries, including the Outreach loader and CSS.

## Repeating pattern and lesson
An operation completing is not evidence that its UI refresh or downstream persistence completed. Test the real completion callback while its loading flag is still set. A CRM activity count is not a saved usable script package: reopen the complete connection, including older history and workspace changes. Distinguish publication dates from detection and page modification dates.

## Acceptance boundary
The full customer regression suite and exact-SHA release gates must pass before describing this release as PROVEN PRODUCTION. Authenticated customer workflow acceptance remains unverified: the available cloud browser opened a signed-out local workspace, not Edgars's existing session. Confirm Ercon reference activation, five Swedish targets, buyer relevance, reviewed trigger selection, script save/reopen and CRM continuity in the actual signed-in workspace. Do not claim these results from fixtures, source inspection or public release smoke tests. Scheduled monitoring already exists but a real workspace run and schedule are not demonstrated in this checkpoint. No outreach was sent.
