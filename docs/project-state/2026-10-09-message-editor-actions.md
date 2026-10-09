# Save, Edit, Rewrite and Restore original

The working message now has Save, Edit and Rewrite controls above the text. Save stores the displayed subject and message verbatim in the existing CRM script package; it does not run AI, approve or send. Edit unlocks the fields and supports cancellation. Rewrite requests a different complete body as a preview, with Use this version, Try another and Cancel. Accepting a preview changes the working draft; Save remains explicit. Repeated alternatives and stale responses from another buyer, workspace, context or working text are rejected.

Approved template drafts are tailored deterministically when initialized or selected, using current seller identity, buyer and reviewed trigger evidence. Fixed template wording and protected master records remain unchanged. Missing evidence blocks are omitted without importing example customer claims. AI rewriting is explicit. Restore original loads the initial tailored subject/body snapshot for the current buyer, template and settings, rather than the most recent edit or the master sample. The snapshot persists through local normalization and CRM save/reload. Existing saved drafts are retained when attaching a restore snapshot.

Manual changes and accepted rewrites clear prior approval. Approval is blocked during edit, rewrite and save. A failed CRM save retains the local draft and reports failure. Pending editor text is retained during same-context renders. No outreach was sent.

## Validation

- 19 focused controller and mounted DOM tests pass, including verbatim persistence, manual cancel, preview acceptance/cancel, restore, duplicate rejection, stale request rejection and workspace isolation.
- Static JavaScript syntax and git diff whitespace checks pass.
- Vercel static build passes, including standalone discovery bootstrap checks.
- Broad customer suite before the final two focused tests: 1,972 tests, 1,845 passed, 127 failed. Baseline at 7f300f1bf85a712d32bf16855ddef85b43d66172: 1,955 tests, 1,827 passed, 128 failed. No newly failing test names relative to baseline; one prior failure resolved. Existing suite failures prevent a successful release-integrity CI gate.
- Authenticated customer CRM/AI acceptance has not been independently observed in this implementation turn. Release status must follow the exact-SHA release-integrity proof, not build success alone.
