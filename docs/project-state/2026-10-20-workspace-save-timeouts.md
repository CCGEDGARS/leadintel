# Workspace save failures and page stalls — 20 October 2026

## Failure and cause

The authenticated LKAB workspace previously stopped on a conflict at `discovery.selectedProspects[company-lkab-com].buyerDiscovery.coverageFollowUp.checkedAt`. This is the time of a coverage search, not an email verification result. Two tabs advancing that clock should not prevent unrelated buyer evidence from saving. Competing research results, buyer identities, contact evidence, recipients and business fields must still require review.

The bridge and persistence boundary both prepared the same transfer payload. The second preparation ran inside the HTTP deadline. Snapshot compression also ran synchronously on the page. A local synthetic research workspace of 4,046,038 expanded bytes took about 2,338 ms to pack one recovery snapshot. Existing large conflict recovery regression data takes several seconds to pack. Those synchronous operations can prevent controls and browser automation from responding during autosave.

The cross-tab save lock had no acquisition deadline. A suspended or stalled tab could leave another tab waiting after the visible save operation had timed out.

## Repair

- Merge only valid coverage follow-up clocks by the later value. Other coverage fields and all contact/source confirmation records retain their existing conflict gates.
- Prepare transfer data once, before starting the bridge HTTP deadline. Keep internal preparation flags and the original local baseline out of the network request.
- Run transfer, large snapshot and conflict recovery packing in a same-origin worker using the established bounded codec. Keep the synchronous fallback for environments without Worker support. Encoding errors or the 30-second encoding deadline preserve working data and the previous acknowledged baseline; a subsequent attempt creates a fresh worker.
- Reuse the decoded snapshot after its durable write instead of immediately decoding the saved compressed copy on the page.
- Bound cross-tab lock acquisition to 15 seconds. An expired wait produces a retryable result and releases its place in the local save queue without writing or stealing the other tab's lock.
- Capture the local baseline before asynchronous preparation. Edits made during preparation or snapshot commit remain unsaved. Recheck the workspace before sending or installing a background snapshot, and recheck live local data after preparing a conflict recovery backup.
- Preserve both sides before applying a merge; await backup durability before replacement or reload.

## Verification and limits

Regression tests cover the observed timestamp conflict, genuine evidence conflicts, a single preparation per save, real worker save/reopen with exact research and message wording, a hung encoding job and safe retry, edits during preparation and commit, workspace switching during encoding, and a stalled cross-tab lock followed by a successful save. All customer tests, syntax checks, the static build, exact-SHA CI and the mandatory production proof are release gates.

Authenticated customer acceptance is separate from these checks. During this repair the Browser connector returned: “Browser access requires the originating browser context.” The signed-in workspace save/reload remains unverified until that connection is available. No customer workspace was reset and no research credits or outreach actions were used for this repair.

## Prevention

CPU-heavy persistence work must not run in the page's save loop. A network deadline must measure transport rather than duplicate encoding. Every asynchronous save boundary must retain the local representation that produced the acknowledged payload, and must revalidate workspace ownership before installing its result. A progress or coverage clock is not authorization to merge contact verification evidence.
