# Buyer contact handoff and source-proof preservation — 2026-11-02

The reported Viscaria run showed four retained priority buyers but stalled at 656 seconds in source research, displayed 44/24, and lost the acceptance of Robert Åkerlind's published email.

A sparse subsequent identity record could erase an already-read same-address/same-source email receipt during pool merge. Restore only fresh version-2 read proof for that exact binding; changed addresses, changed sources and explicit failed source checks cannot inherit acceptance.

The person-check handoff now reuses the current parent discovery generation's in-memory dossier and actual source bodies. It does not repeat company discovery in the same run. Explicit forced checks and independent later checks still acquire their required sources. Incomplete inherited dossiers remain partial. The source counter distinguishes new page requests, capped at 24, from all available bodies. Actual read receipts update accountability before slow person queries finish. CRM source association runs after person checks without repeating missing-source acquisition.

Preserve the parent task ID during handoff and register a cancellable task for independent public checks. Parent-generation replacement prevents stale writes. Cancellation settles the wrapper even when a provider ignores abort; saved evidence survives.

Regression coverage includes the actual procurement-page fixture, same-binding proof across merge/reload, rejection for changed bindings/failed checks, bounded new-request counters, early source receipts, one-pass handoff, task cancellation and generation ownership. Full customer/backend suites and build must pass before publishing; exact-SHA production proof must pass before claiming deployment.

No authenticated workspace rerun or result import was performed. Public source extraction and automated regressions do not establish the final count or completed research in the user's signed-in workspace. Existing open tabs and in-flight JavaScript require the new assets on the next page load.
