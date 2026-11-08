# Connected workflow audit — 8 November 2026

## Scope and evidence

Owner request: audit opening, saving, transitions, research speed/depth, language, buttons, free/paid research, Gmail discovery and recurring failures across Profile → Companies → Buyers → Messages → CRM.

Starting source: `17ead6152325376c08b58e0bb16bedca78caf95a`.
This document describes code review and controlled acceptance, not a new research result for any customer's company. No signed-in production customer browser was attached. No private customer workspace, current paid-provider configuration, contact yield, live provider latency or saved library completeness was inspected. No outreach or real paid contact purchase was performed by this audit. Controlled provider fixtures exercise the actual HTTP routes, SQLite persistence, browser UI and scheduler wrapper.

## Defects reproduced and fixed

### Queued buyer action did not settle when canceled

When one local buyer observation owned the client, a second person's Recheck awaited its promise directly. Canceling the waiting action did not release its caller until the first observation ended. Workspace departure had the same delayed-settlement risk. This could leave the waiting action looking busy without doing useful work.

The waiting action now observes its own cancellation and exact workspace/user/company/person context. It settles without stopping the existing buyer's research and without posting a replacement lookup. The separate server-owned-job polling wait uses the same cancellation boundary. Queue cleanup removes its listeners and interval.

Regression: cancellation must settle within a short test deadline before the first promise resolves; workspace departure must settle similarly; neither case may post a lookup. Existing queued-success tests still require only the intended selected person to start next.

### Unchanged polls repeated the full retained-evidence merge

The client calculated whether job ID/revision/status were unchanged but called `mergeRetainedBuyerResearch` before using that result. Every repeated status poll traversed the retained research again even though no new snapshot was being applied.

Unchanged checkpoints now skip that merge. Timing, connection state and progress still update. Changed revisions, terminal transitions and explicit retained-evidence recovery still take the merge path. Local edits and accepted channels retain their existing protection.

Regression: five status responses (four identical running checkpoints, one terminal revision) produce five progress updates but only two evidence merges. This is a measured reduction in duplicate client work, not a claim about internet/provider speed.

## Agreement-by-agreement assessment

| Area | Required behavior and audited evidence | Remaining limit |
| --- | --- | --- |
| Open/reopen | Authenticated browser + real SQL journeys restore Setup, selected Buyers, Messages and CRM; cross-workspace isolation and competing revisions are covered. | Production customer session not inspected. |
| Company history | Ten companies per page; chosen company expands, older companies remain collapsed and open on click. Tests cover 23 companies, pagination after removal, saved focus and reselection without losing people. | Ten is a page size, not a storage quota. |
| Save/Remove | Save status follows successful persistence. Failed save/delete restores recoverable selection; Save to CRM and permanent Remove have separate behavior. Concurrent edits and workspace changes are guarded. | No real customer records deleted in this audit. |
| Buyers → Messages | Stable company/person IDs and accepted email gate; four retained cards, mixed channels, large snapshots and fresh reopen tested in Chromium. LinkedIn-only preparation has its separate route. | A confirmed LinkedIn profile does not make an email ready. |
| Research button | Header owns Find / Resume / Refresh / Check status according to state. Duplicate company Resume controls removed; selected-person Resume and Stop have separate scope. | Disabled controls can be correct when an operation or prerequisite blocks their action. |
| Other controls | Mounted/runtime tests cover Save, Remove, Recheck, channel E-mail/Phone, Proceed, style selection, Edit, Save draft, Reset, Undo, translation and retry. Focus, cancellation and stale context are covered. | This is not a literal visual inspection of every control in production. |
| Research order | Official sources → independent company dossier → people → contact evidence → evidence review → explicitly enabled paid channels. Actual HTTP/scheduled tests cover saved checkpoints, task registration and continuation. | Completing a search does not guarantee a contact was found. |
| Depth | Up to ten retained full identities; two people at once; base official/public/direct-email/phone/LinkedIn/Gmail plan; deeper email work for up to four unresolved priorities. Published PDF/industry sources and transliterations are covered. | Source availability and public disclosure vary. |
| Speed/budgets | Bounded phase execution, shared source reuse, query receipt reuse, independent phase budgets and 30-minute explicit-run pause. Resume retains completed checks; read-only reopen cannot restart paused work. | No measured live-provider completion SLA. |
| Failure recovery | Slow/failed providers, late completion, canceled requests, status outage, concurrent state changes and partial checkpoints are covered. UI must distinguish stopped observation from stopped server research. | A timeout must remain visible; it cannot be relabeled as a successful no-result search. |
| Gmail discovery | Three dedicated public business-contact queries per retained identity, actual receipts, partial-query retry and matching-plan reuse. Possible source-backed matches and generated patterns remain distinct. | A Gmail candidate never satisfies confirmed company-email readiness; no private Gmail inbox search. |
| Free Recheck | Selected-person scope only; completed compatible checks reused, bounded alternatives for gaps, Gmail plan rechecked. Actual browser/HTTP/scheduler journey retains other people and makes no paid calls. | “Free” means no paid contact enrichment; connected search/AI providers can bill their own API usage. |
| Paid E-mail/Phone | Separate channel requests, stable identity, accepted-channel reuse, current permission/budget guards, durable ledger and pending-result recovery. | Real provider availability and current customer budget were not inspected. |
| Automatic paid | Saved explicit 1–4-person allowance; default one; priority group selected before skipping confirmed people. Coverage/qualification/review gates and revocation checks remain. Controlled browser journeys verify one and four. | No automatic increase in permission or spending made. |
| Language | English reading view for company brief, original source excerpts/URLs/dates retained; failures expose retry. Translation cannot replace original evidence. Workspace/message language persistence and translation controls tested. | Controlled translation acceptance does not prove real provider semantic quality for every source. |
| Facts and trigger | Seller website, readable PDF, accepted/user answers and selected buyer source evidence feed bounded factual fields. Full selected article/allowed PDF reads and source provenance are tested. Snippets, unread pages and conflicting claims cannot silently become verified facts. | Missing real project/year/reference details require evidence or remain marked. |
| Prior “2 years” error | Tests exclude cookie retention, warranty duration, project age and conflicting durations from company experience. Team experience remains attributed to the team. | No new claim about the customer's actual corporate age is made here. |
| Scripts and styles | Canonical literals preserved outside declared slots; all three channels and five styles tested; missing fields highlighted; explicit alternative rewriting cannot redefine masters. | Actual private saved library revisions were not read in this audit. |
| Character limits | Each script uses its own reference ceiling, including signature/URLs/spaces and normalized Unicode. Core NLP email has an explicit maximum of 1,074 characters. Over-limit drafts preserved and blocked from approval, never silently cut. | This is not one identical limit for all scripts. |
| Editor/save/history | Chromium journey saves rich text to real CRM, reopens, recovers failed saves, separates two buyers and preserves drafts/history. Undo restores source and character contract. | No actual message sent. |
| Books/skills | Tests cover three-book quota, independent saved skills, workspace isolation, deletion and lease/revision races, analysis coverage and protected-template boundaries. | No customer's uploaded book was processed by this audit. |
| Delivery boundary | Controlled browser journey checks exact approved copy, idempotent send, reopen and isolated outcomes/replies using fixtures. | Draft preparation is not authorization to send real outreach. |

## Validation and recurrence controls

- Starting backend suite: **1,887 passed, zero failed/skipped**, including authenticated browser/real-database journeys.
- New client regressions were observed failing before the patch and passing afterward. Existing client suite remains covered.
- Full customer suite, post-change Buyers browser journeys, build and exact-release CI are required before final release confirmation. Their final results belong in the attached audit evidence/release proof rather than being predicted here.
- Browser cache key bumped for the changed research client.
- Mandatory release smoke added for the new client boundary; this establishes artifact propagation only. Runtime regressions establish behavior.
- No master-template, paid-policy, research-depth, storage-schema or customer-data migration was introduced.
- Rollback is the prior exact source revision; no data rollback is required.

Prevention rule: every asynchronous queue needs its own cancellation/context boundary; every polling path must separate cheap progress updates from changed-evidence reconciliation. Do not infer either property merely from an AbortController or an `unchanged` variable existing elsewhere.

## Acceptance still requiring production evidence

The audit does not establish the current LKAB/Viscaria research outcome, the exact number of usable contacts, actual paid charges, live research duration or the completeness of the customer's saved script library. Those require authenticated production receipts. Exact-SHA CI and a PROVEN release establish implementation/deployment status, not these customer outcomes.
