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

Initial access observation (superseded by the authenticated observations below): private inspection was blocked: originating Browser connection is unavailable; shared browser reaches LeadIntel sign-in; secure method choice selected Google, but automatic approval review rejected continuing that authentication flow. Do not bypass the rejection. Explicit authorization is needed before resuming Google sign-in. No private approval reactivation, new private company research, paid contacts or outreach has been executed in this audit. Customer acceptance remains open until the signed-in saved state and original companies are inspected.

No data migration is needed. Existing records remain authoritative; old stale approvals are not automatically approved. Rollback is a source revert with its own exact-release verification. Do not delete/rebuild private work or start another broad research run to test deterministic fixes.


## Authenticated customer observation and second connected boundary

Google sign-in completed after a fresh OAuth session; an earlier expired state was rejected rather than bypassed. The existing Companies -> Buyers control reopened the retained selected company with ten buyers and its accepted contact evidence. Updating to fb74957 preserved those records. The saved-review list contained 31 unique domain records; the 12 candidate records overlap that review set, so counts must not be added to claim 43 companies. The misleading zero-result conclusion is gone in the updated page. No company research or paid-contact action was pressed during this inspection.

The real Strategy recovery click revealed another boundary missed by isolated click tests: page-quality-ui intercepted the button that merely OPENS review as if it performed APPROVAL, then focused the same blocked control. Route the review opening as safe preparation; final confirm/advance and all approval/research blockers remain enforced. A capture-phase DOM regression fails before repair and verifies recovery can open while final approval remains blocked.

Research used a second raw-JSON digest, independent from Companies and Strategy's canonical content digest. New research fingerprints now sort object keys. Historical research hashes migrate only after reproducing their exact legacy serialization or the already governed completed Opportunity-led derived-switch proof. Unknown hashes remain stale; no private historical approval is silently blessed.

A real save failure subsequently became visible in the customer workspace. Existing persistence UI discarded all status/code/name detail, preventing diagnosis. Add bounded DOM-readable structured error metadata (HTTP status, enum-shaped code and known error name); never render raw messages, URLs, payloads or causes. The diagnostic is not itself a repair of the underlying failed request. Customer save/reopen acceptance and any unresolved stale research remain open until verified after this release.


## Measured rendering hotspot

The actual signed-in browser exposed multi-second control delays. A separate controlled fixture (31 companies, 40 research pages and eight source pages, 1.44 MB main state) reproduced a lower-bound 6.28–6.56 second synchronous hotspot for three company-currentness sweeps: 186 full evidence digests. Presentation-scoped fingerprint reuse and status.signature reuse reduced the same controlled operation to 41–43 ms and one digest. This measurement does not identify every private-browser delay.

Cache lifetime is only an outer synchronous qualification presentation frame, cleared in finally. Raw main content, relevant rules, event search context and function dependencies invalidate the entry within a frame. Actions and async continuations recompute. Eleven behavior regressions cover reuse and invalidation; freshness tests remain independent of timing thresholds.


## Browser recovery and release acceptance follow-up

The actual storage meter showed 96.99 MB of the included 100 MB logical-record allowance. That observation alone does not establish the save failure. Real SQLite replacement checks at 96,990,334 / 100,000,000 bytes replaced a 3.5 MB active snapshot with only 3.01 MB free and preserved identical metered usage; an active saved-flow replacement also succeeded with zero headroom. No double-headroom or transient quota defect was reproduced; no storage quota was changed.

After a failed explicit save prevented Update now, reloading with browser recovery retained reached the fail-closed account recovery screen. The captured application warning identified browser_archive_unavailable at the IndexedDB transaction abort/error boundary. Underlying error name/reason had been discarded. Preserve bounded native error names, operation phase and classified failure category in account recovery; never expose original messages, keys, values, serialized snapshots or credentials. Do not clear browser data to make startup pass. Actual cause and save/reopen acceptance remain unresolved pending this diagnostic.

The first main CI run for 80de392 failed the controlled company-search persistence fixture before Companies initialized. A pure real-module reproduction showed that the fixture had signed Strategy after editing authoritative exclusions while leaving contradictory canonical Profile exclusions. Real normalization correctly revoked that approval. Correct the fixture to confirm canonical Profile before signing Strategy and assert two repeated reloads remain current. This corrects controlled acceptance setup; production guards and timeouts remain unchanged. Passing prior PR CI alone did not establish valid setup.


## Confirmed native quota failure and recovery storage migration

The f94ac5d recovery screen identified the real browser failure as QuotaExceededError / archive_write_transaction / quota. This is browser recovery storage, separate from the server's 100 MB logical-record allowance. The application export preserved both versions before further recovery: discovery, outreach and delivery are identical; remaining differences are navigation, derived ICP display fields and persistence metadata. No company research or paid-contact control was started. The exported research context cannot reconstruct its saved historical hash, so stale research authority remains open.

Recovery snapshots previously allocated a new UUID record on every overflow save without a release/collection path. Correct this internal cache lifecycle with guarded pointer publication/read locking, pending publication pins, strict acknowledged-baseline proof and complete reference inventory. Preserve active/local/session/account-archive pointers, all unknown schemas, unsynced drafts and conflict originals. A native quota error does not authorize clearing browser data. Lossless compression may replace an existing value only under the same key after an exact decoded-byte check and a transaction-time compare; abort retains the original.

Migration: open archive schema v2, rotate the same-account context ticket before collection to fence paused older readers/writers, keep all active keys and existing records, and support legacy raw and new compressed values. Existing connections close on versionchange. No server or customer-record migration is needed. Rollback must retain the v2-compatible archive reader and fencing; reverting to a cached v1-only reader is not a safe rollback. Disable collection/publication optimization while keeping the compatible reader if recovery is needed. Missing reliable locking means collection is skipped.

Acceptance still requires the exact new release proof plus actual authenticated save, reload, retained company/buyer evidence and downstream use. Unit/controlled persistence success alone cannot establish that the native browser quota recovered.


## Native recovery and corrected quota interpretation

On 7413d677 the real browser completed conflict recovery and showed Saved automatically to LeadIntel / Synced to LeadIntel. Companies -> Buyers reopened the retained company with all ten saved buyers; a further reload retained them and the saved status. This does not establish completion of their unfinished contact research. No paid contact control was used.

Correct an earlier interpretation: the native rejection was QuotaExceededError on the archive write, but after compression the origin estimate reported about 27 MB used against 10.76 GB capacity. Whole-origin exhaustion is therefore unproven. The demonstrated repair is successful smaller lossless backup writes; the exact browser rejection boundary is not known. Native diagnostic inventory had 14 records, including 13 gzip values, zero pending pins and no unknown records.

Native retention remained disabled by incomplete_refs. Offline inspection of the app-exported recovery showed only freeform source text that begins with a bracket/brace and is not valid JSON: 584 parse failures, no snapshot-key prefix, no traversal-depth or node-budget failure. Such non-parsable text without an archive key is not an operational JSON pointer. Keep malformed text containing an archive-key prefix conservative, and retain valid serialized/deep references. Version and retrofit the proof index under the existing bounded cursor; old incomplete proof metadata must not remain permanently authoritative after this correction. Preserve compressed content exactly during same-key reindexing.
