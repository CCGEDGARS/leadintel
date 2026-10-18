# Company research lifecycle repair — 18 October 2026

Observed: an authenticated CCGROUP Profile displayed Ready to research alongside a disabled Researching company button; research appeared to restart and linger at evidence synthesis.

Root causes in the lifecycle: company research forced location.reload on both completion and failure; support-module initialization automatically started another run for Profile without completion metadata; verified sources were not checkpointed until AI finished. AbortController alone did not guarantee settlement if a request/body reader ignored cancellation. Re-rendering rebuilt Ready status independently of the running flag.

Changes: research starts only on explicit action; successful/failed research refreshes app state and navigation through the existing event; collected verified evidence is checkpointed before AI preparation; AI retry reuses evidence; request/body settlement is bounded by abort signals; rendering derives running state consistently and restores controls in finally. Account, workspace and input context guards remain enforced.

Verification: four failures reproduced before changes (automatic start, missing checkpoint, hung-provider deadline and forced reload). Targeted tests cover these plus concurrent workspace refresh, double click, stale account/input rejection, customer answer preservation, saved-source retry and AI failure. Full customer suite passed with 2,862 tests before the additional running-render regression, which also passed separately. Production acceptance and exact-SHA proof are required before claiming a live fix.

Prevention: never force a page reload as an async research handoff; never initiate paid research merely because a page is restored; persist evidence before optional synthesis; test a provider that ignores AbortSignal, not only well-behaved fetch mocks.
