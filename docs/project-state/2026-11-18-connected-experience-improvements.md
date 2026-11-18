# Connected experience review and improvements — 18 November 2026

## Outcome and preservation boundary

Owner authorized an app-wide review and improvements while preserving the working business process. Starting revision: `cf100596` (including the independently merged reviewed research-task work). Storage/Stripe remains paused. This pass addresses shared navigation, workflow switching, recovery and mobile clarity. It does not change qualification, research depth, paid permissions, canonical scripts, message approval, sending, saved workflow contents or customer data schemas.

The intended outcome is a responsive, predictable Setup → Profile → Strategy → Companies → Buyers → Messages → Delivery experience: navigation stays clickable during background updates, saved workflow names/status remain available without redundant requests, and the actual next action takes precedence over static instructions. Authoritative state remains in the existing workspace, CRM, research jobs and saved-flow records. No new cache becomes an authority for opening or modifying a workflow.

## Review of the recurring problems

| Area | Existing repair / authority reviewed | Acceptance retained |
| --- | --- | --- |
| Company research and public contacts | Verification before contact handoff; saved evidence and stable company identities | Company-list and website-contact HTTP/browser journeys |
| Priority buyers and paid buttons | Exact-person accepted channels, bounded free checks, independent paid channels and saved spending permission | Buyers, paid-action and buyer-evidence journeys; no real paid lookup in this review |
| Proceed | Acknowledged exact recipient handoff opens Messages directly | Accepted-email, Messages/CRM reopen and unsent Delivery acceptance |
| Market research | Independent source checkpoints and explicit interruption reasons | Three-mode research and peer-timeout retention journeys |
| Events and follow-ups | Event audience and participation context, reviewed messages, separate delivery | Event preparation and delivery/follow-up regression suites |
| Saved workflows | Protected settings/scripts, separate working progress, shared credentials/CRM | Version → duplicate → edit → reload → return to original |
| Books / Writing Assistant | Resumable source status, saved skill ownership, cancellation and visible errors | Published Books/Assistant regressions remain unchanged |
| Shared shell | Rebuilt controls, duplicate GETs, static duplicate guidance and mobile whitespace | New measured full-app acceptance plus all-seven-stage navigation/save/reload |

The recurring pattern is independent event handlers rebuilding or fetching the same view, and guidance becoming detached from the saved state. The previous fixes are preserved rather than replaced with a new orchestration system.

## Confirmed defects and changes

1. **Navigation controls were destroyed during harmless status updates.** An unchanged status burst replaced most step controls. A refresh between pointer-down and pointer-up could therefore remove the intended click target. Unchanged nodes now remain attached; changed status still replaces the relevant controls and restores keyboard focus. Status notifications are coalesced into one queued render. Explicit navigation and current-state reads retain their synchronous semantics. Storage changes for all journey sections now refresh the guide, not only changes to the main profile.
2. **Overlapping workflow-summary reads made duplicate server calls.** Concurrent reads now share one account/workspace-scoped request. Focus reuses a summary for at most 30 seconds only while the acknowledged workspace revision is unchanged. Explicit opening/refresh still reads the server. A save during an older read triggers one follow-up, so coalescing cannot strand an old workflow status. Switching workflows obtains the small selector response instead of loading every flow's payload and performance queries. Existing server revision checks still govern the actual switch.
3. **An unresponsive response reader could hold workflow UI busy indefinitely.** The existing 20-second abort was advisory. A deadline now bounds the complete request/body read and releases the caller even when a transport ignores abort. Late reads cannot repopulate another account or workspace. A timed-out mutation is not claimed canceled; its message directs the owner to refresh and check the saved result.
4. **Static instructions contradicted retained progress.** A Buyers screen with saved people still said to find decision-makers. When the live journey guide is available, duplicate introductory banners are hidden. The fallback remains if the guide is unavailable; Profile's research/customer shortcuts remain available. No readiness or quality gate is weakened.
5. **Mobile navigation hid the current stage and inherited the tallest offscreen card's height.** At 390px the sidebar was 454px high while the active Buyers card was offscreen. Compact cards keep details behind Show steps, including channel buttons, and reveal the active stage horizontally on stage/viewport change without scrolling the working page. Desktop layout remains unchanged.

## Measurements and acceptance

Controlled full-app browser baseline and final evidence are under `/tmp/leadintel-connected-experience-before/` and `/tmp/leadintel-connected-experience/` for this execution. These are synthetic workload measurements, not a claim of global provider latency or sales conversion improvement.

| Repeated workload | Before | After |
| --- | ---: | ---: |
| Model reads during 20 status notifications | 21 | 2 (one navigation render plus one independent Workspace Status assessment) |
| Navigation DOM mutation records in that burst | 580 | 21 |
| Existing step links remaining attached | 6 / 38 | 38 / 38 |
| GET requests for 10 concurrent workflow-summary refreshes | 10 | 1 |
| Collapsed sidebar height at 390px | 454px | 243px |

Regressions fail on the original implementation for unchanged control retention, concurrent refresh deduplication, focus reuse and lightweight switching. Focused tests also cover changed revisions, a save arriving during an old read, account changes, ignored aborts, actual status changes and guidance fallback. The full browser acceptance verifies a real pointer-down → background refresh → pointer-up navigation, retained recipient identity, no horizontal page overflow, active mobile stage visibility and no page errors.

The existing authenticated HTTP/SQLite journey traverses all seven stages without a workspace PUT, then saves a genuine edit and verifies it after reload. The protected-workflow Chromium journey saves a version, duplicates, edits/reloads the copy, and returns to the exact original settings and script. External providers are controlled; these checks do not establish live-provider availability or the yield of a private customer search. The new connected-experience check is required in customer CI and produces screenshots and machine-readable evidence. Four release smoke checks cover the changed assets; exact-SHA production proof is a separate mandatory gate.

## Prioritized continuation backlog

| Priority | Next evidence needed | Decision boundary |
| --- | --- | --- |
| P1 | An authenticated real-customer research trace: qualified companies, evidenced buyers, accepted channels, actual provider failures and costs | Do not equate passing fixtures/smoke checks with contact yield. Reuse existing receipts; no blind repeat of paid lookups. |
| P1 | Startup profile/readiness timing under deliberately slow assets | Prior work found fixture normalization races. Diagnose the combined lifecycle before changing canonical context or broadening research permissions. |
| P2 | Cold/warm startup and navigation timings with representative large workspaces | The controlled startup loaded 250 resources. Consolidate only measured duplicate work; preserve lazy feature boundaries and account verification. |
| P2 | Real research phase duration and successful-result reuse rates | Tune concurrency/deadlines only with cost, provider-limit and evidence-quality measurements. Existing bounded research depth stays authoritative. |
| P2 | Delivery/reply/follow-up outcomes with a connected customer mailbox | Retain explicit sending approval, reply/opt-out suppression and exact sent-message history. No test outreach authorized by this review. |
| Paused | Storage allocation, pricing and Stripe products | Resume only when the owner resumes the separate project. |

This backlog is saved work, not an unattended background agent or a claim that every production customer outcome is proven. Future shared-shell changes must test a real user interaction during status updates, not only final DOM text.
