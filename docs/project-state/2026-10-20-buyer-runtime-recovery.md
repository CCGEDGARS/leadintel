# Buyer research and workspace runtime recovery — 20 October 2026

The customer reported buyer research stuck after its query phase, a page component crash, and workspace saving that never settled. The signed-in customer session reproduced the Profile `innerHTML` exception and a preserved sync conflict after buyer research.

## Root causes and changes

- The canonical Profile renderer removes the legacy information-gaps section. Legacy app rendering still wrote to that removed element on initialization and navigation. The canonical renderer now owns that layout. Canonical edit events also update only their owned in-memory fields, preventing later app saves from restoring stale Profile answers.
- Buyer tasks did not report progress after their initial checkpoint. The overall deadline ended before contact research, and providers that ignored abort could leave pending operations alive. Phase/query/contact checkpoints now remain current, the outer deadline covers the whole buyer run, and standalone contact research has its own bounded lifecycle. Cancellation settles ignored awaits and prevents late results from changing another workspace or a replacement run.
- Public contact operations shared promises by domain across workspaces and retries. Entries now belong to the workspace and exact run, and canceled entries detach without deleting a replacement. CRM operations recheck ownership after asynchronous boundaries.
- Pipeline progress normalization cloned active candidate objects, overwriting contact evidence and invalidating active owners. Progress now preserves active and unrelated pipeline owner identity. The outer buyer run passes its exact contact-research owner, so a hidden duplicate in the shortlist or candidates cannot redirect contact checks. Integrated regressions verify evidence after reload and safe replacement of shared operations.
- Revision-only server contention during research was deferred forever. A retry is now allowed only when a trusted original baseline proves that the server business payload is unchanged. Retries are bounded and retain the original baseline, so genuine remote edits still require reconciliation and both versions remain recoverable.
- Successful new buyer attempts did not supersede old metadata-free task warnings. Only strictly generated company-domain task IDs from the verified current account/workspace are matched to new attempts. History, genuine current failures, unrelated workspaces, and runtime errors remain visible.
- Changed runtime assets have an explicit entry-point cache version. Six mandatory release checks cover these fixes in the exact-SHA production proof.

## Completion evidence

Local verification: all 3,171 customer tests passed, including 23 new buyer lifecycle regressions and five actual Profile DOM regressions. The production build, changed JavaScript syntax checks, and diff checks passed. Independent review found no remaining findings after reproducing and correcting the pipeline and late-write races.

Exact-SHA release proof and signed-in customer research/save/reload acceptance remain release gates at this source checkpoint. Preserve customer evidence gates: a missing confirmed email remains missing, and provider failures must finish as an honest partial/error state rather than an invented successful result.
