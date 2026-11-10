# Product delivery and acceptance

The owner delegated LeadIntel product implementation and content decisions on 10 November. Preserve the existing stack and protected content/evidence rules. Prioritize a coherent seller-to-prospect-to-buyer-to-message workflow and verify outcomes rather than expanding a feature inventory. No promise of background work after a chat turn or unverified whole-product completion is implied.

## Completed implementation batches

- Resumed Buyer AI reviews receive a sufficiently long scheduler slice; queued execution, contact coverage and AI review coverage are distinct (PR 929).
- Profile monitoring reads its authoritative saved configuration, saves off drafts, applies current Strategy gates and shares bounded search capacity with entered websites (PR 930).
- The monitoring continuation batch preserves intent through explicit Profile/Strategy approval and returns to the original setup without starting unrelated company discovery. Acceptance includes cancel, stale/replaced contexts, acknowledged saves, the actual wrapper and the normal Companies path. The root cause was destination ownership: the monitoring entry reused a Companies-only approval handoff, and Profile review discarded the originating task. The fix binds that destination to the same account, workspace, seller and markets and consumes it only after acknowledged approval.

Local verification: the full customer suite passed (5,904 passed, two skipped, zero failures); the final focused suite passed all 77 tests. Both mandatory real HTTP/SQL browser monitoring cases passed: an already approved Profile and a reviewed Profile requiring explicit approval. Both returned to monitoring without company research, then verified selected-site manual execution, registered scheduler execution with the browser closed, persisted/deduplicated alerts, reopen, mobile layout and pause. Production release remains a separate exact-SHA gate.

## Product acceptance criteria

| Journey | Evidence required before claiming customer completion |
| --- | --- |
| Setup and Profile | Correct seller, source-backed context, reviewed targeting, preserved unknowns and acknowledged save/reopen |
| Strategy | Deliberate customer/signal choices, clear destination, current approval, no unexpected paid/research side effect |
| Companies | Bounded useful acquisition, separate checked/strong-fit/intent states, saved unfinished work before broader searches |
| Buyers | Current identities/roles, receipt-backed source and contact coverage, AI review, usable recipients; saved checks alone are insufficient |
| Messages and CRM | Preserved approved masters, selected recipient identity, supported factual slots, exact save/reopen and source provenance |
| Delivery | Explicit recipient/channel controls, verified sending behavior in controlled tests, no unsolicited live outreach |
| Monitoring | Saved sites/signals/cadence, explicit activation, real public-source run, persisted history, browser-independent due execution and pause |
| Account and commercial readiness | Workspace isolation, roles, reliable sign-in/recovery, clear provider connection states and separately proven billing behavior |

The repository's mandatory CI journeys and exact-SHA release proof establish implementation/release state. They do not establish that real customer contacts were obtained, emails were sent, payment was collected or a real monitoring alert was generated.

## Current customer acceptance boundary

The shared session confirmed the intended seller/market and saved Jobindex, Daily, Quick, score 80 while monitoring stayed off. Reload retained the same settings. Profile and Strategy were unapproved, so manual and scheduled research remained gated; no real monitoring run was observed.

Automatic approval review rejected exporting detailed private Profile, ICP, signal, exclusion and evidence data to Firecrawl. It also rejected persistent browser-profile changes. Authorized monitoring metadata was inspected and the saved settings were verified; no workaround, private contact export or credential/session persistence was used. A full customer Profile review and monitoring activation remain open until that destination-specific data access is permitted. Continue unaffected implementation and controlled acceptance without treating this boundary as a whole-product completion.

Browser verification correction: Firecrawl's default page evaluation can use an isolated JavaScript realm. Undefined application globals there do not prove that the user is signed out. Check the authenticated session response's `authenticated` field, or use a narrowly scoped main-world CDP check. An HTTP 200 alone also does not establish authentication. Never extract session tokens or credentials to diagnose this.
