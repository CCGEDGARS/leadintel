# Workspace sync conflict repair — 4 October 2026

## Cause and scope

Two sessions can update the same workspace. Previous hydration and save logic treated every version mismatch as a whole-workspace conflict, including identical data or non-overlapping changes such as local navigation and newly saved remote buyer research. The conflict banner intentionally protected both sides, but required a whole-version choice unnecessarily.

## Repair

- Record workspace ID and exact server version on saved snapshots. Only a matching trusted baseline enables automatic three-way reconciliation. Legacy snapshots and unknown workspace history require review.
- Compare JSON structurally; property order and persistence metadata do not constitute business edits.
- Merge non-overlapping object fields. Arrays (buyer lists, source evidence, messages) are atomic. Competing array edits or same-field edits remain conflicts. Deletions are preserved, and deletion versus modification requires review.
- Preserve both versions in the existing recovery record before applying a safe merge. Storage failure blocks reconciliation. No automatic keep-local replacement is allowed.
- On 409, retry at most once against the returned version. A second race stays a review conflict. Reload after a completed merge to refresh in-memory application state.
- Mark recovery in progress and disable both choice buttons until completion. Failed or skipped recovery retains the conflict and local draft; explain the actual failure instead of silently losing the review gate.
- Invalidate app, persistence and bridge entry versions; load the shared reconciliation helper before the bridge.

## Evidence and limits

Regression coverage exercises direct merge semantics and the real first-party persistence/bridge boundary: 409 retry, simultaneous edits, missing/wrong-workspace baseline, storage quota, hydration/reload, identical newer versions, skipped recovery, and existing explicit recovery controls.

Exact merged-SHA release proof and authenticated workspace inspection are separate gates. The user's local browser cache cannot be changed through the verification browser. An existing genuine or legacy conflict still needs one explicit version choice; both versions are retained before that choice is applied.
