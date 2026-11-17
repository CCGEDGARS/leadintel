# Proceed must open Messages — 17 November 2026

The owner reported an accepted company email and green checked Proceed control which did not open the next step. The screenshot establishes the visible selection state; it does not identify the complete customer runtime state.

Source and regression reproduction found that `saveBuyerAndProceed` explicitly passed `selectOnly: true`. That mode persisted the recipient, kept Step 5 active and expected a second click on the footer. The per-card action now invokes the existing Messages handoff directly, retaining the reviewed email/contact identity through CRM lookup and acknowledged workspace save.

The full browser reproduction exposed a second failure on a repeated Proceed after reopening. `buyer-handoff-recovery` legitimately consumes the pending retry marker during the save acknowledgement when an existing draft is present. The handoff treated that removal as a lost selection owner and stopped before navigation. Ownership now permits consumption of that transient marker while continuing to require the exact selected recipient, stage, workspace, operation and reviewed email. Replacing the marker with another choice still blocks.

Tests explicitly exercise direct Step 6 navigation, an already-selected buyer, acknowledged marker removal versus replacement, failed Messages loading and retry, changed CRM/cached email, card reorder and identity races. Browser journeys no longer hide the per-card defect by additionally clicking Continue to Messages. The accepted-listing journey includes incomplete public research, real HTTP/SQLite persistence, desktop/mobile navigation, fresh Messages reopen, repeat Proceed, exact recipient/draft, and separately approved unsent Delivery.

This changes navigation only. Existing contact evidence, qualification, synchronization, message approval, research permissions and send boundaries remain authoritative. Private customer workspace acceptance and production release proof remain separate from controlled test evidence.
