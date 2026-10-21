# Buyers: Refresh, Save, Remove

User confirmed the revised semantics on 21 October 2026. These replace the original save-before-deselect implementation.

- **Refresh** updates buyer identities and contact research through the existing research flow.
- **Save** explicitly saves company/buyer research to CRM. **Saved ✓** is shown after successful save and workspace sync; changed research makes Save available again. Verified contact records retain their separate verification path.
- **Remove** permanently deletes the company, buyers, research, message packages and activity history from this workspace and CRM. It never saves or creates a CRM record first. The existing owner-only deletion API remains authoritative. A styled, cancel-first confirmation names the company and states that deletion cannot be undone.

Removal clears the exact company domain from selections, candidate lists, pipeline, known targets, saved buyer drafts, recipient handoffs and delivery activity. Seller configuration, reusable message templates, other companies and other workspaces remain intact. Working-record cleanup is synced before irreversible CRM deletion. On sync/deletion failure the working records are restored without overwriting unrelated concurrent edits. Account changes, active research and duplicate actions are guarded. In-flight CRM reads are invalidated so stale responses cannot reintroduce the company. Mounted CRM, Messages and Delivery views update after cleanup. Pipeline’s separate Remove from Pipeline action continues to preserve history.

Tests: buyer-company-remove.test.js covers real delegated button clicks, Save state, confirmation/cancellation, owner restrictions, no implicit CRM save, complete cleanup, failure restoration and scope changes. buyer-company-records.test.js covers exact-domain cleanup, normalized reload and saved-signature invalidation. The backend CRM test verifies actual SQLite cascade deletion and cross-workspace isolation. Production smoke checks require the three-action code, cleanup helpers and cache versions. No backend API/schema change is required.
