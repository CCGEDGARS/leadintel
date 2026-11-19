# Save and export the existing Companies search

The Companies result screen previously offered no way to save its complete inventory as a named list or export it. The separate signal-based Company lists feature only exported lists built through its own research flow. The owner requested Save list and Export list beside the existing search controls, with a successful save required before export.

## Result and ownership

- Save list stores an immutable copy of every row in the existing cumulative ranking, including collapsed results, selected-only companies and unfinished reviews. It uses the same deduplicated ranking as the screen. Previous and missing scores retain their labels; buying intent remains unconfirmed.
- The copy is saved directly to the existing workspace-scoped `company_lists` table. This saves a list, not a new CRM qualification. Search snapshots cannot invoke its research, CRM batch-save or buyer actions. No additional provider operation is started.
- Export list supports CSV and Excel and uses the acknowledged server copy. Export checks the list still exists. Changed rows require another save; earlier saved copies remain accessible in Company lists, including through the CRM shortcut.
- Content-derived identifiers make retry after a lost response idempotent. A failed save cannot enable export. Workspace identity and current-content guards reject late responses, including a stale empty read that arrives after a successful save.
- Deleting a copy uses the existing in-app confirmation and leaves source research and CRM companies intact. It releases the table's existing quota-accounted bytes. Automatic opening does not recreate deleted copies.
- Existing signal-list research, qualification, paid research permissions, recipient selection and messaging are unchanged. Storage pricing, Stripe and workflow architecture remain outside this task.

## Bounds and compatibility

No database migration is needed. Search copies carry `criteria.kind=search_snapshot` and separate review/export fields; existing signal-list records keep their original representation and controls. The existing 50-list workspace limit and storage quota apply. A copy supports up to 1,000 companies with bounded public evidence excerpts and a 1 MiB request limit; an oversized or full-storage request reports failure without acknowledging export. No full contact dossiers or private buyer details are copied into the company export.

The new controls only project the current company inventory when it changes or the workspace refreshes; painting button state does not repeat company assessments. Returning browsers receive versioned assets. Removing the feature would leave the original company research and CRM untouched; saved copies should be exported before a code rollback that lacks their display support.

## Acceptance evidence

- Shared model tests: all 31 deduplicated results, current/previous/absent scores, source evidence, no research mutation, formula-safe CSV and Excel, malformed input.
- Authenticated HTTP/SQL tests: idempotent save, fresh read, cross-workspace and role isolation, no research wake or CRM writes, blocked inappropriate actions, deletion, quota release, failed save and 50-list cap.
- UI race tests: save pending, changed rows during save, workspace replacement and late empty read.
- Actual Chromium/HTTP/SQLite journey: 31 companies including collapsed rows; storage-full failure keeps export disabled; successful CSV and Excel downloads contain the last company and its evidence; a fresh browser can export and reopen through CRM → Company lists; Cancel preserves the list; Delete preserves company research; a later added company requires another save; desktop and 390px mobile controls fit.
- Browser artifacts: `/tmp/leadintel-company-search-list/`. Existing signal-list browser journey also runs. The fixture uses controlled customer data; no real customer account, paid contact credits or outreach was used. Existing background language-pack reads are separately accounted for by the browser fixture.
- Mandatory release checks cover the buttons, export labels, asset versions and backend feature marker. Production status requires the exact main SHA's release proof to be PROVEN; local tests alone do not establish deployment.
