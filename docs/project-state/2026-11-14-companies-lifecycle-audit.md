# Companies lifecycle audit — 14 November 2026

## Acceptance and authority

Every retained company must have a visible place, even when its earlier qualification is stale. Strategy approval must survive unchanged save/reopen; actual commercial/evidence changes must invalidate it. Company selection must cross acknowledged CRM identity before durable Buyer work; selections, Buyer evidence, messages and workspace isolation must survive delayed responses and reloads. Controls cannot spend provider budget merely by rendering. Qualification, explicit unverified selection and confirmed buyer/contact outcomes remain separate.

The owner's screenshots show 12 retained candidate records, 31 pending rows, zero current checked companies and stale Strategy approval. These screenshots do not establish deletion, a particular failed provider or the exact field that invalidated the private approval. Previous click/save/reopen fixture success did not prove the customer's company recovery. This audit corrects that limitation explicitly.

## Controlled root causes

1. `rankedCheckedCompanies` excluded all candidates when discovery.needsRefresh was true, but `researchReviewRows` only included individually flagged or currently ineligible candidates. A retained eligible record could disappear from both sections. Remove/clear used that same incomplete partition. Every candidate outside the actionable shortlist now enters saved review; stale qualifications remain unconfirmed. The review list initially opens when no current shortlist exists. Context-change/pending states no longer render a market-wide zero-result conclusion or promise hidden cards “below.”
2. Fingerprint comparison used object insertion order although Strategy's content digest sorts keys. Save/hydration could reorder unchanged answers and invalidate company research. Compare canonical object order while retaining every content field and ordered arrays; actual offer changes still invalidate.
3. Profile reopen dropped source receipt/claim metadata signed by Strategy. Fresh sources could acquire citation IDs only after approval. Preserve the signed fields; assign the existing citation identity convention at confirmation before signing. No digest/version change or blessing of historical signatures.
4. A reviewed multiline commercial objective was flattened by Brief/readiness migration, then treated as displaced. Preserve exact text only when the authoritative saved goal equals its user-confirmed canonical record. Genuine changed goals still invalidate. Confirmed customer problems now synchronize their downstream buying-outcome compatibility field before signing rather than on a later reload.
5. Research review Move to Buyers did not await CRM acknowledgement or honor archived-company rejection. It now shares selection ownership and CRM guards, retains the acknowledged identity, checks current workspace/retained row and catches failure before starting research. Known-target selection also retains the acknowledged CRM identity. Existing manual work and active run owners are preserved.
6. Clear-results confirmation had no originating owner and could clear a newly selected workspace. Capture and check the owner. Block clearing while company research, durable Buyer work, contact enrichment or company selection is active. The existing user-confirmed clear semantics remain unchanged: search/review and unsaved selections are removed, CRM/pipeline and preferences remain.

## Controls and evidence map

| Control/path | Verification |
| --- | --- |
| Target count/custom amount | Existing immediate repartition, persistence and no-provider tests |
| Refresh / bounded saved review | Existing queue-first, score/ranking, provider timeout, call-cap, cancellation and batch rotation tests |
| Recheck / Recheck all | Current Strategy guard; disabled stale/running controls; retained queue and retry tests |
| Retry failed / cancel | Existing phase-specific failure and registered cancellation tests |
| Saved result partition / disclosure | Failing-before eligible-stale visibility regression; preserves exact records and zero provider calls |
| Selection / known targets / review Move to Buyers | CRM acknowledgement, archived rejection, delayed response, active-owner preservation; real HTTP/SQL/browser acceptance for both qualified and saved-review entry |
| Continue to Buyers / reopen | Existing selected-context and browser scheduler/reopen journey, no duplicate start |
| Feedback / undo | Existing scoped persistence and paid-call-free display tests |
| Remove / clear review | Dedupe, stale-row removal and retained selected-buyer evidence tests |
| Clear search / cancel confirmation | Origin workspace guard, active Buyer blocking, existing clear/reload/CRM retention tests |
| Strategy / Profile navigation | Existing guarded handoff and repeated authority reload tests |

## Verification boundaries and recovery

New regressions were run failing before repair and passing after. Browser acceptance must run in required CI because local Chromium cannot launch in this environment. Browser tests use controlled sources, actual authenticated HTTP/SQL, scheduler execution and reopen; they are not research results for the owner's private workspace. Final test, CI and exact release proof outcomes belong in the PR evidence.

Private inspection is currently blocked: originating Browser connection is unavailable; shared browser reaches LeadIntel sign-in; secure method choice selected Google, but automatic approval review rejected continuing that authentication flow. Do not bypass the rejection. Explicit authorization is needed before resuming Google sign-in. No private approval reactivation, new private company research, paid contacts or outreach has been executed in this audit. Customer acceptance remains open until the signed-in saved state and original companies are inspected.

No data migration is needed. Existing records remain authoritative; old stale approvals are not automatically approved. Rollback is a source revert with its own exact-release verification. Do not delete/rebuild private work or start another broad research run to test deterministic fixes.


## Authenticated customer observation and second connected boundary

Google sign-in completed after a fresh OAuth session; an earlier expired state was rejected rather than bypassed. The existing Companies -> Buyers control reopened the retained selected company with ten buyers and its accepted contact evidence. Updating to fb74957 preserved those records. The saved-review list contained 31 unique domain records; the 12 candidate records overlap that review set, so counts must not be added to claim 43 companies. The misleading zero-result conclusion is gone in the updated page. No company research or paid-contact action was pressed during this inspection.

The real Strategy recovery click revealed another boundary missed by isolated click tests: page-quality-ui intercepted the button that merely OPENS review as if it performed APPROVAL, then focused the same blocked control. Route the review opening as safe preparation; final confirm/advance and all approval/research blockers remain enforced. A capture-phase DOM regression fails before repair and verifies recovery can open while final approval remains blocked.

Research used a second raw-JSON digest, independent from Companies and Strategy's canonical content digest. New research fingerprints now sort object keys. Historical research hashes migrate only after reproducing their exact legacy serialization or the already governed completed Opportunity-led derived-switch proof. Unknown hashes remain stale; no private historical approval is silently blessed.

A real save failure subsequently became visible in the customer workspace. Existing persistence UI discarded all status/code/name detail, preventing diagnosis. Add bounded DOM-readable structured error metadata (HTTP status, enum-shaped code and known error name); never render raw messages, URLs, payloads or causes. The diagnostic is not itself a repair of the underlying failed request. Customer save/reopen acceptance and any unresolved stale research remain open until verified after this release.


## Measured rendering hotspot

The actual signed-in browser exposed multi-second control delays. A separate controlled fixture (31 companies, 40 research pages and eight source pages, 1.44 MB main state) reproduced a lower-bound 6.28–6.56 second synchronous hotspot for three company-currentness sweeps: 186 full evidence digests. Presentation-scoped fingerprint reuse and status.signature reuse reduced the same controlled operation to 41–43 ms and one digest. This measurement does not identify every private-browser delay.

Cache lifetime is only an outer synchronous qualification presentation frame, cleared in finally. Raw main content, relevant rules, event search context and function dependencies invalidate the entry within a frame. Actions and async continuations recompute. Eleven behavior regressions cover reuse and invalidation; freshness tests remain independent of timing thresholds.
