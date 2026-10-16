# Writing Assistant book lifecycle and script handoff

## Causes and repair

The assistant recovered a local working draft by buyer/channel. Changing the selected writing style or replacing the Step 6 draft updated the context fingerprint but did not refresh that working draft. It could therefore send an older script to the AI under a different style. The controller now tracks the upstream script and style through local recovery. A clean copy follows Step 6; an edited copy is retained with an explicit Load current script / Keep assistant copy choice. Requests and saving are blocked until that conflict is resolved. Loading the current copy retains the previous edits through Undo. Saving identical text back to Step 6 acknowledges it without creating a false conflict.

Book deactivation/deletion already invalidated pending proposals through source revisions, but old conversation guidance was still forwarded to the provider. Turns now carry a reference-selection key: earlier turns remain visible, while only turns belonging to the current source revision/selection reach the provider. Existing draft text is preserved; removing a source does not undo wording already applied.

Learned methods could reach the provider without their supporting pages when the method's name and the original page used different vocabulary. Retrieval now reserves up to four passage slots for the supplied locations of selected methods, deduplicates them against lexical matches and retains the eight-passage/shared character budgets. Requested changes must explain the applied method and cite the supplied passage; an uncited proposal explicitly warns that book influence is not confirmed. Method and page availability proves input grounding, not semantic causality or the accuracy of every model output.

If object cleanup fails after deletion has already deactivated a source, the client refreshes server state before reporting the original error. The book therefore shows Deleting/inactive instead of misleadingly remaining active. Durable cleanup/retry remains with the existing backend worker.

## User flow

Open Script Assistant → Content Library (or Manage book). After analysis reaches Ready, check Use this book. Only one source is active at a time. Uncheck it to stop using it. Delete requires confirmation and removes the uploaded source, extracted text and learned guidance; current messages/templates remain intact. Failed/incomplete analysis cannot activate.

Run an assistant action or request a proposal. Review the change explanation and cited book/page, then Apply to working draft. Use in current flow saves the reviewed working copy without approving or sending. Approved mandatory masters remain unchanged.

## Verification boundaries

Regression tests exercise current-style request payloads, clean and edited handoffs, fresh recovery, visible conflict controls, source-history exclusion, supporting-page retrieval, activation → grounded provider contract → off → deletion, stale-proposal rejection, physical object cleanup, deletion cancellation and fresh-list non-resurrection. Provider outputs in these lifecycle tests are explicit fixtures; they do not claim an authenticated live model acceptance test. Full customer/backend suites, build and exact-SHA production proof are separate gates. No real customer book is deleted by the tests.
