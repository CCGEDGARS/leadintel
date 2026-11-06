# Messages recipient recovery after synchronization

Outcome: a saved, identity-matched buyer must become usable in Messages after workspace hydration or conflict resolution, without selecting the buyer again or replacing the draft.

Reproduced lifecycle defect: `openVerifiedBuyerScripts` correctly refuses validation during `resolvingSync`. The old `sync-settled` and `server-synced` handlers only rendered the disabled workspace and never restarted validation. The warning therefore persisted even when saved buyer/CRM records matched. Startup also independently repeated validation on `server-ready`.

The shared restoration entry point now handles startup, server-ready, sync-settled and server-synced. It skips an already valid recipient, an active handoff, busy/manual editor work, foreign workspace and unresolved synchronization. Concurrent notifications share one task. Failed automatic attempts are bounded to two per selection, reset by an explicit synchronization-resolution boundary. Existing recipient identity and CRM evidence checks remain authoritative. No confirmation is fabricated, no research is restarted, and no outreach is sent.

Regression tests failed before the change for both sync-settled and server-synced restoration. Tests now verify draft preservation, duplicate request suppression, manual-buffer protection and mismatched-contact rejection. The authenticated Chromium journey uses the real application, HTTP backend and SQL persistence to interrupt validation during synchronization and verify recovery, unchanged text, save/reload, CRM reconciliation and two-buyer isolation.

Evidence boundary: this reproduces and fixes a concrete lifecycle cause of the reported warning. Controlled authenticated acceptance does not claim direct observation of the owner's browser session. Existing production read-only checks established matching persisted buyer, contact and selection records; no additional private production exports are required for this fix.
