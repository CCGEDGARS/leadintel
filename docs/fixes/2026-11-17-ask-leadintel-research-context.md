# Ask LeadIntel: reference research and operational context

## User outcome and cause

The request “suggest buying signals for the reference companies that i added” previously executed no searches or page reads. `signal_trigger` also selected `workspace_diagnostic`, which bypassed the optional planning call. The durable-job trigger required other verbs or an explicit URL. The answer model could see reference labels but the reader could not see their websites. Reference projection also omitted the canonical `companyName` field.

The fix routes reference research into the existing saved public-research worker, including requests from older clients without `research_mode`. The server resolves the selected reference list from authoritative workspace state. Public names, safe websites, saved country and request-time market/list/version are captured; notes, deal values and contact credentials are excluded. Changing the list creates a different research identity. Follow-ups retain the captured list, while an explicit new website or a newer queued/researched target supersedes it. Queue metadata captures the reference scope immediately; a queued target is a boundary even before its worker has planned sources.

## Research behavior

- All captured homepages enter the queue before discovered links. Each reference gets a scoped public search. After source reads, a bounded planning pass may add up to four targeted follow-ups across relevant source classes.
- Existing limits remain: fourteen searches, twelve reads, two attempts per operation and fifteen minutes per explicit run. At most ten distinct saved references enter one run; omissions and unread websites are visible. Empty lists do not invent targets or dispatch providers.
- The answer uses actual extracts and receipts, names missing evidence, and distinguishes observed events, commercial hypotheses and verified buying signals. Suggested weights are advisory. A domain suffix does not establish operating geography or eligibility for the target market.
- Saved checks survive close/reopen. Continue retries failed tasks without repeating completed reads. No contact-discovery calls are added to reference-signal research. No paid reveals, CRM changes, settings changes or outreach are authorized by chat.
- Bare public domains also enter the existing explicit-website research path. Public URL guards and extraction redirect checks remain in force.

## Adviser context

The adviser receives up to forty visible button labels and disabled states, a bounded click trail and up to twelve same-workspace browser operation receipts. It never reads input values, message bodies or hidden views for this purpose. Control clicks are observations, not successful execution. Activity is cleared when the workspace/account changes.

The server supplies bounded workspace-scoped operation outcomes and saved chat-research states. Raw errors, provider bodies and foreign-workspace records are excluded. Missing diagnostic access is explicitly unavailable. The integration summary includes configured AI and service providers, rather than only the last saved service. Failure receipts establish an outcome and support reference; the adviser must keep root-cause hypotheses separate. Specific source-reader failures retain allowlisted codes instead of collapsing every failure into a generic unavailable caption.

## Verification and limits

Regression coverage includes the exact request through authenticated HTTP, registered `app.scheduled`, real SQL persistence, the actual answer pipeline and a fresh Chromium browser. Controlled providers supply five reference pages; the reopened result shows 5/5 websites read. Coverage also exercises blocked reads, bounded retries, empty/over-limit lists, changed lists, workspace isolation, no-browse requests, no operational writes, no contact-enrichment calls, browser redaction and backend diagnostic scope.

These tests establish the implementation with controlled sources, not the factual quality of a customer's real-provider result. Production deployment and authenticated customer acceptance require their separate exact-release and real-workspace evidence gates. No such success is asserted by this document.

Final focused validation: 145 backend Copilot tests passed with Chromium required and zero skips; 69 customer Copilot tests passed. Three targeted release tests passed, including rejection of stale reference-coverage/control assets. The static build and Wrangler worker dry-run both passed.

Broad regression verification after the initial corrections: 6,376 customer tests passed (13 skipped, no failures), and all 2,097 backend tests passed with Chromium required (zero skips). The backend run includes the controlled authenticated HTTP/scheduler/browser-reopen journey. Final CI and production release evidence are tracked separately for the published revision.

Rollback is a code rollback: the worker uses the existing job schema and additive optional JSON scope fields. There is no data migration or rewriting of operational records. Do not roll back a worker while scoped jobs are active; stop or finish those jobs first so an older worker cannot interpret them as single-target contact research.
