# Companies navigation responsiveness

Authenticated acceptance on release bc1762ed reproduced a Companies sidebar click timing out while dispatching the mouse event. The control eventually opened Companies; the user's separate Profile redirect report has a deterministic matching code path: `persistMainStep(5)` called the shared `setStep`, whose targeting gate redirected any unconfirmed context to Profile, including requests only to view saved Companies.

Companies/Buyers quality receipts also included the entire parsed seller main state plus its market, then recursively sorted, serialized and hashed it on every refresh and serialized it again for operation-ticket identity. Main state contains unrelated source text/documents. Navigation, module-opened, focus-changed, save and render events repeat these checks. A synthetic 8.1 MB input spent 1,137 ms in ten receipt inspections alone, excluding state loading, scoring, rendering and persistence.

The receipt now uses a bounded runtime revision of the exact main storage string and workspace/user scope. Any saved main edit changes the revision; a change back also creates a new revision. Company candidates, selected recipients and metadata remain in the inputs, preserving unsaved evidence/selection race checks. Fresh checks and action guards still execute. No research, source documents, company data or verification rules are removed.

Saved Companies/Buyers navigation explicitly requests review mode. Only module 5 with an existing seller profile/website can use that mode. Normal advancement, Strategy, Messages and research retain targeting approval requirements. Entry script cache markers change for both edited runtimes.

Verification: regression tests failed before changes on oversized page-check inputs and the Profile redirect. They pass afterward and cover saved evidence, in-memory company evidence, workspace switching and the actual review-mode caller. All 3,214 customer tests in the full run pass; the expanded navigation file passes all three tests separately. JavaScript syntax, production build and diff whitespace checks pass. Exact release proof and authenticated post-release navigation are separate acceptance gates.


## Authenticated follow-up: selection reads scored the full pool

The first release passed exact-SHA checks but live navigation still exceeded the browser's three-second input deadline. Startup tracing put Companies rendering at 14–136 ms, pointing outside card rendering. `buyerSelectionRows`, called repeatedly by focus/navigation/readiness, synchronously qualified all candidates merely to decide whether the selected companies still belonged in Buyers. A regression reproduced 50 checks for one selected company. Selection reads now filter by selected domains before qualification and return immediately for no selections. Selected companies still undergo current qualification, stale-evidence and CRM suppression checks. Unselected search results cannot affect the selected Buyers list. This keeps the membership policy while removing redundant synchronous scoring from navigation.


## Run each navigation transition once

The authenticated follow-up still exceeded the input deadline. `showDiscoveryStep` rendered focus, refreshed journey, reconciled strategy and rendered cards, while `persistMainStep` synchronously dispatched `module-opened` and ran those same checks/rendering plus CRM refresh again. The opening function now saves the desired focus before entering shared navigation. Its module-opened listener owns the refresh; a revision counter detects standalone mounts that still need a fallback. The redundant deferred Buyers focus reset is removed, so an old navigation callback cannot override a newer Companies click. A regression reproduced two renders/CRM refreshes/public-check schedules for one transition and requires exactly one.
