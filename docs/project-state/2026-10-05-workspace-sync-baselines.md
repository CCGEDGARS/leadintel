# Recurring workspace sync conflicts — 5 October 2026

## Reproduced causes

1. A successful compacted research save retained full browser data as its supposedly exact cloud baseline. A later cloud read could look like a competing research change even when only another buyer had been updated.
2. Three-way merge treated all buyer/company record arrays as indivisible. Independent contact updates, a deletion plus a different addition, or two different company updates required manual conflict resolution.
3. Customer state PUT acknowledged a subsequent database SELECT. Another writer could commit before that SELECT, causing the first save to report the second writer's version and payload. The browser then paired the wrong payload with that version.
4. A tab retained its in-memory version even after another tab acknowledged a newer shared snapshot. Late GET/PUT responses could also move the effective version or baseline backward.
5. Autosave could finish waiting for sign-in after session authentication but before workspace hydration, replacing a trusted cloud snapshot with a browser-only snapshot.

## Permanent controls

Saved snapshots now retain both the exact compact cloud payload and full local representation. Merge compares each side with its own baseline. Legacy saved snapshots reconstruct their deterministic cloud representation without deleting local evidence. Older responses cannot replace a newer acknowledged snapshot or hydrate stale data over it; remembered versions are monotonic and saves adopt a matching newer shared acknowledgement.

Record lists merge only when each object has a unique stable ID or company domain. Deletions remain deletions when the other side did not edit that record. Duplicate/missing identities, a deletion versus a competing edit, and different edits to the same meaningful field still require review. Buyer identity and contact/source groups are atomic so verification provenance cannot be synthesized from different concurrent checks. Conflicting derived buyer qualifications are discarded for recalculation from the retained source evidence. Exact selected recipient metadata remains atomic.

Backend compare-and-swap remains in place. A successful PUT returns only its own committed revision and payload. No last-writer-wins overwrite was introduced. Existing local/server recovery copies and explicit resolution remain available.

Authenticated startup now waits for workspace readiness. If startup has not finished, save reports a retryable error while preserving the cloud baseline. New asset query versions invalidate the changed sync and persistence entry boundaries.

## Validation

Regression tests first reproduced baseline drift, independent-buyer collisions, late acknowledgements/hydration, second-tab versions and premature startup saves. Tests cover full evidence retention, save/reload, legacy migration, deletions, conflicting source tuples, duplicate identities, cross-workspace recovery protection, bounded retry and storage quota failure. Production verification and authenticated browser save/reload must be reported separately; a public release proof cannot establish another browser's local conflict has been cleared.
