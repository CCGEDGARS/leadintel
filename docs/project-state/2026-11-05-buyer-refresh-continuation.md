# Buyer Refresh continuation

Observed: customer screenshot shows Stage 2 after 394 seconds, no useful finish estimate. This alone cannot establish worker liveness.

Reproduced defects: company Refresh passed force=true; a new generation stripped client execution claims without restoring server-owned full-roster evidence. Dossier accumulated time was exempt from its configured processing budget.

Change: company Refresh resumes rather than forces; new continuation generations restore matching server-owned full-roster evidence within the same workspace, domain, seller context and roles. Completed dossier work is skipped. At six minutes accumulated dossier processing, continue buyer checks with explicit gaps and retained evidence. This is a processing cap, not a promise about total wall-clock completion or provider availability. Per-person deeper Recheck remains separate.

Acceptance: SQLite-backed tests verify retained buyers/dossier after a selected-person job, zero provider calls for a completed dossier, and progression after its exhausted budget. DOM test verifies stale activity is visible outside collapsed details. Production and current authenticated customer acceptance require separate evidence.
