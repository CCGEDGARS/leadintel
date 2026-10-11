# Workspace sync contention recovery

The workspace review block can occur without competing business edits. The save bridge previously reconciled only the first HTTP 409; a second harmless collision entered permanent conflict. Saves were serialized only inside each tab. Temporary message style and viewed-company choices were also classified as competing business fields.

Each 409 now uses the latest acknowledged baseline and reconciles safely. Up to three writes run per save cycle; continued safe contention preserves local changes, acknowledges the latest remote baseline and schedules another automatic attempt. Persistence displays pending changes rather than a failed save. Same-origin tabs coordinate writes through a workspace-specific native Web Lock, with the existing per-tab queue and safe reconciliation retained when Web Locks are unavailable.

Concurrent outreach view choices retain the local choice. Actual drafts, saved defaults, selected recipients, seller facts and overlapping evidence edits keep their existing conflict protection. Missing baselines, recovery-storage failures, workspace mismatch and genuine competing edits still preserve both versions and require review. Existing style-only conflicts are safely reconciled on reload.

Regression cases reproduce the old failures and verify repeated safe collisions, continued contention, a genuine conflict after an earlier safe merge, reload recovery, automatic retry scheduling and shared-storage tab coordination. The screenshot demonstrates the customer symptom; these regressions establish the faulty code paths, not the precise contents of the customer's signed-in browser.
