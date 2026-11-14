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


## Preview authority and provider side effects

A controlled mounted reproduction found that opening a different research mode changed saved settings and revoked current Strategy/research authority even when cancelled. Two preview observers also performed live source discovery before Start; one mounted case attempted six provider requests. Use a pending plan draft until explicit Start, and discard it on Close/Escape without saving or changing authority. Display only saved/explicit URLs before Start; defer all live source discovery to the confirmed run. Preserve explicit source/instruction edits and existing run/context guards. Mounted observer regressions cover native button events, mode labels, cancellation, no writes and no provider requests.

A single authenticated Quick Overview completed and cloud-saved 54 total sources (14 new), four reports, with quality passed and current research scope. Its receipts contain 13 operations; billed per-run cost is unknown. The global Firecrawl balance changed from the previously displayed 59,214 to 59,183; that global delta cannot be attributed exclusively to this run. Do not repeat this completed research for acceptance. The latest exported recovery preserves both cloud and older local versions. Subsequent native QuotaExceededError recurred with approximately 25 archived records / 50.9 MB against a reported 10.7 GB origin quota. Smaller writes alone are insufficient evidence of a complete fix; archived recovery lifecycle remains under investigation.

Local SQL/browser journey launch on this runtime was blocked before application startup by Chromium socket() Operation not permitted. This is unavailable local browser evidence, not a failed customer assertion. Required GitHub browser/SQL CI and actual authenticated browser acceptance remain separate mandatory evidence. Do not weaken browser security settings to run this fixture.


## Recovery ownership and retained assessment churn

The existing inline sync-recovery owner overwrites a single recovery key while retaining its immutable original local/server pair and latest local/server pair. Overflow publication instead allocated a new UUID envelope on every update and retained all intermediate latest versions. A controlled 20-publication reproduction produced 20 rows with zero eligible acknowledged baselines and no collection. Absolute fixture bytes are not customer storage measurements. Retire only strict known older envelopes from the same original/workspace lineage under an active, committed newer sync-recovery pointer. Referenced/pinned rows, unknown schemas, other lineages and immutable originals remain protected. This follows the existing single-latest owner contract; it does not promise an intermediate-envelope history. Frame and pointer comparisons remain transaction guarded.

A separate controlled real-module reload reproduction found that unchanged retained buyer qualification regenerated assessedAt, then CRM hydration saved it and emitted workspace-dirty. Ranking alone did not mutate the input; the retention/hydration assignment persisted the clock. Recompute all qualification gates, preserving the prior valid assessment clock only when the entire derived result other than that clock is identical for the same identity. Real rechecks continue to generate fresh assessment timestamps. Changed roles, source evidence, review gaps and freshness results must continue to invalidate the derived assessment. This reduces avoidable save/conflict/recovery churn without suppressing actual edits.


## Packed references and collector fencing

Pre-release review found that the generic reference walk sees tagged arrays/key dictionaries inside the sync-recovery codec rather than restored pointer objects. The same risk applies to whole-snapshot LZW envelopes. Decode known owner codecs before reference traversal; unavailable, invalid or unsupported codecs keep collection closed. A new proof consumer must invalidate indices created before this decoded-reference check.

Migration opens archive database version 3 without dropping stores/records, rotates the context ticket, and closes prior connections via versionchange. Explicit version-2 reopen then fails, preventing a paused older collector from running its old reference rules. Mixed legacy raw/gzip payloads remain readable; no server or customer-record migration occurs. Rollback must retain the version-3-compatible reader, ticket fencing and decoded reference protection; disable collection if needed, rather than reverting to a version-2-only reader. Exact release and authenticated recovery acceptance remain separate.

The decoded-reference proof uses index version 3 and consumer leadintel-account-archive-v3-decoded-references-v3. Older proof metadata cannot authorize collection until references are re-derived under the current codec rules. A controlled real-codec reproduction established the bug: an object pointer inside packed recovery original was missed and its baseline collected; the unpacked control retained it. This was a pre-release controlled fixture, not observed deletion of customer data.

The retained-buyer regression also covers partial duplicate pool checkpoints: merge/identity normalization can discard earlier qualification fields before retention. Carry only the exact matched owner's prior assessment through that boundary, then recompute every fresh field. A read-only replay of the private exported recovery retained all seven known prior assessment clocks and ten buyers; repeated load/CRM hydration produced byte-identical state with zero qualification differences and zero workspace-dirty events. This establishes the offline owner pipeline, not native browser or production acceptance.

Known local-section LZW values require the same treatment: account archives capture raw localStorage strings before the transparent getter. Extract a pure bounded StateBudget restoreLocalStorageValue helper, reuse it in the existing getter, and use it for reference inspection. Preserve exact legacy/current decoded content and existing 8/32 MB section limits. Missing, invalid, unsupported or over-budget codecs remain incomplete; incomplete proof metadata is re-derived when decoder availability changes.

Final focused verification before release: 37 archive-retention regressions pass, including packed original/object pointers, local-section pointers, deep/unknown/missing codec holds, DB1/DB2 fencing, concurrent CAS, protected-prefix rotation and a >64 MB legacy-gzip migration with large proof rewrites forced to fail with quota errors. Twenty large recovery publications retain bounded envelope rows and exact original/latest pairs. Independent local decoder/persistence checks pass 24/24. The retained-buyer startup suite passes 17/17; broader buyer checks pass 1,016 with two browser-gated skips. Full final CI, exact production proof and native customer acceptance are reported separately.

The final full suite caught an additional cache-chain mismatch: app.js still imported the previous StateBudget URL and could replace the classic bootstrap decoder. Align both exact URLs under the existing workspace-codec-loader regression and require the new decoder marker in the app release smoke. The deferred shell loader does not import StateBudget and remains unchanged.


## Exact-release and native acceptance correction after f857d22d

PR958 merged as f857d22dadba7bf3b7c100f8217fc3bea3c39683, exact tree 038c272e8e0596686849f8d720b36fd91d2f584d. Final local full suite: 6,126 tests / 6,122 pass / zero failures / four deliberate browser-gated skips. PR and exact-main required CI and backend deployment passed. Actual release-proof verdict is BLOCKED_SMOKE_CHECK: one of 739 checks rejects the reordered discovery-ui offer-evidence-priority URL prefix. Preserve that prefix, and add a proof test against the real customer HTML rather than only the synthetic entry fixture. Do not label this revision PROVEN PRODUCTION.

Native access changed before this revision: tab8 became unavailable and tab11 displayed the same signed-in workspace under old release7413, with seven rows/about15.2MB and Saved/Synced. The cause of that browser/storage change is unavailable; it cannot be attributed to PR958. On f857, migration/reference diagnostics are complete and saves succeed, but natural budget/navigation writes increased archive records11→14/about28.6MB, with two strict acknowledged baselines, one referenced snapshot, zero pins and zero recovery candidates visited. No renewed native quota rejection was observed at that point. This does not demonstrate bounded storage growth.

Controlled actual WorkspacePersistence GET-boundary replay then established a separate owner defect: unchanged backend version1, zero PUTs, repeated GETs allocate a new overflow snapshot each time. Twenty real captures across fresh VM reopens retain all20rows; when richer local research metadata is retained, strict acknowledged-baseline eligibility stays zero. Keep that predicate strict. The inline snapshot owner overwrites one latest snapshot; its overflow path needs idempotent unchanged reads and explicit committed replacement ownership. Preserve legacy unique snapshots and manual data outside that known replacement.

Native read-only acceptance on f857 confirms Quick Overview complete with54sources/fourreports. Opening Market Research then Close, and Deep Analysis then Escape, retain modequick, all54sources/fourreports, Saved/Synced and unchanged14archive rows. No additional research was started. The effective company request limit was set to20 and saved; reopen/handoff confirmation remains pending.


## Final workspace-snapshot owner correction

The remaining growth is reproducible through the real fetch boundary, including richer local research metadata and fresh VM reopens. Reuse the previous acknowledged snapshot only for the same workspace/integer revision and exact local data plus exact server payload; saved_at alone is not a new business state. Keep explicit-save and dirty accounting unchanged. For changed snapshots, the normal inline owner retains one latest snapshot. Overflow publication must retire only its exact previously active known owner frame after the new frame and pointer are committed, with complete references, no pins/archived holds, current pointer/new frame proof and old-frame CAS. Do not infer ownership of legacy orphan history or weaken isAcknowledgedBaseline.

This publication semantic change migrates archive DB3→DB4 and rotates the context ticket to fence paused older same-version publishers. Proof index3 and its decoded-reference consumer remain unchanged because reference semantics are unchanged. Mixed raw/gzip data remains readable. Rollback must retain the DB4 reader/fencing and current owner/reference guards, or disable collection while preserving compatible reads. A same-version snapshot with an older saved_at must not overwrite a newer committed snapshot.

Final owner regressions execute the real fetch interceptor, codecs, archive and fresh VM reopen: twenty unchanged GET acknowledgements allocate exactly one row and keep the same pointer, with zero PUTs, for both clean and richer local snapshots. Twenty actual HTTP acknowledgement writes advance cloud revision1→21 while keeping one current owned frame; latest manual notes, draft, contact, evidence and research metadata survive fresh reopen. The former richer-local reproduction retained20rows. Strict baseline eligibility remains false for that richer-local case.

Malformed/null/array/opaque known-section strings, noncanonical snapshot dates, unknown schemas, archive references and pins preserve their prior frames. Wrong-family pointer encoding is rejected before publication, retaining the old pointer and the new pending snapshot. Same-version older async snapshots fail without replacing the newer committed owner. Cleanup failure preserves both the committed new snapshot and retained old frame, with deferred/incomplete diagnostics rather than converting a successful save into failure.

Final follow-up local checks: 53 owner/cache/real persistence cases pass, 50 codec/startup/release-boundary checks pass, syntax/diff checks pass and static build passes. The full local run exercised6,142 cases; its two source-extraction/documented-import fixture failures were corrected and the affected50-case suite rerun successfully. Exact final-commit CI must establish the full final suite and browser/SQL acceptance before release proof.

## Authenticated owner correction and newly exposed save boundary

Exact main43107853777c26d678d606973676f78781930f1a passed required CI, matching production manifest, backend health and740 mandatory smoke checks; its actual release artifact verdict is PROVEN. This establishes release integrity, not customer acceptance.

In the authenticated workspace, the first save retired its exact prior owned snapshot. Later observations remained15 records/about30.9MB, complete decoded references and zero pending pins. Profile approval,54 research sources/four reports, four approved Strategy checks and a20-request company cap survived reopening. One Companies run entered through the actual Strategy handoff, checked four sites and executed nine web requests (six search/three reads); it stopped after2:27 because saving failed, not because the20-request cap was exhausted. No additional broad run is authorized by this acceptance record; reuse completed evidence.

The displayed sync conflict preserved both sides. Export comparison established that the current server revision contained an earlier checkpoint of the same run (same request identity/start/context, zero audit entries) and the local copy contained nine executed receipts. Main, outreach and delivery were unchanged. All server source URLs and company identities remained in local data. Run counters, queries and checked-domain lists legitimately differed; this does not prove every historical cloud field was byte-identical. Both recovery sides were separately backed up before choosing any conflict preference.

Actual browser console evidence identifies a native QuotaExceededError while writing the discovery localStorage section. This is distinct from whole-origin IndexedDB allowance and from the corrected snapshot-owner growth. A controlled real fetch/archive/persistence reproduction independently establishes another failure class: a committed PUT followed by archive-publication failure leaves the remembered baseline behind, so the next paid-progress save conflicts with its own earlier checkpoint. The actual first exception that lost this native run's acknowledgement is not proven by the recovery export. Keep this distinction; do not attribute all failures to provider quality, strategy changes or exhausted credit.

Customer acceptance remains open until discovery evidence can save, reopen and reach Buyers with the retained selection and identities. A zero qualified-company result and incomplete contact research must remain labelled honestly.

## Save acknowledgement and cost-safe recovery

The fetch boundary now retains an account/workspace-bound receipt before awaiting the full browser snapshot. It contains only the exact committed revision and SHA256 of all restored transmitted payload fields. Failed local publication remains a visible failed save. On a later GET/409, only an exact current revision+digest match permits advancing the compare-and-swap revision without applying server data or blessing the old snapshot. Changed payloads, other accounts/workspaces, pending reset and revision regression retain the existing conflict gate. Memory protects the current tab if both small receipt writes fail; a browser close in that case cannot claim automatic receipt recovery. Rollback may ignore the optional receipt but must preserve the full snapshots and conflict originals; no business-data migration or deletion is involved.

Failed Companies persistence installs a save-only Retry, including when metadata itself is at quota. It preserves the run's evidence and partial outcome, checks exact run/start/workspace ownership before and after acknowledgement, and never invokes research providers. A committed task identifier restores this action after reopening. Older failed-save tasks can recover only a unique company-discovery task whose immutable ID matches the saved run number and a bounded five-second start window; ambiguous or mismatched tasks remain closed. This does not infer the missing server acknowledgement or bypass explicit workspace conflict recovery. Never fall back to a broad provider retry.

Offline replay of the actual export disproved the oversize-section hypothesis: discovery is3.50MB restored versus the32MiB bound and compresses correctly. Its five local sections occupy about3.77MB of UTF16 key/value footprint. The packed recovery export alone would occupy about6.24MB if inline. This is a capacity hypothesis, not evidence of the native current key layout. New DOM diagnostics report only aggregate raw localStorage sizes by section/recovery/snapshot/other categories; no keys, values or personal data are exposed. The native key layout remains unconfirmed; the controlled boundary below establishes a lossless capacity correction without assuming an origin-wide quota failure.


## Recovery headroom and connected controls

A controlled actual account-cache/codec/bridge replay reproduced the headroom failure: a large inline recovery fit under a static localStorage quota while consuming nearly all remaining capacity; the next discovery receipt could not save despite an empty IndexedDB archive. Publishing that exact known recovery through the existing guarded IndexedDB owner freed capacity and retained the entire decoded original and working records across fresh reopen. Synthetic regressions reproduce this without private customer fixtures or provider calls.

PreserveSyncRecovery now proactively publishes packed recovery records above64KiB through the existing expected-pointer/pin/owner transaction when IndexedDB is available. It never replaces the old pointer before durable publication; failure retains the old inline owner and pending new record, and does not fall back to filling localStorage. Small records and no-IndexedDB browsers keep existing compatibility. No section limit, evidence truncation, unknown orphan deletion or qualification weakening is introduced. Rollback may retain compatible IndexedDB recovery reads while disabling proactive placement; it must not clear either recovery copy.

Authenticated recovery on431 used the backed-up explicit Keep local preference, then a visible Retry save after a timeout. The workspace reached Saved;31 company records and nine web-operation receipts remained visible. The actual Continue to Buyers handoff opened retained Kitron with10 saved buyers/four priority cards/one accepted email. The other contact checks remain incomplete. Cancel clearing search results preserved records; reference management opened the three active reference sources; known-company management opened its separate add/import form without changing targets. These are old-release customer observations, not acceptance of the new source.

That audit exposed another real control defect: Edit settings routed to an empty My Flows list. A dedicated openSettings route now opens the workspace-owned qualification form, matching the qualification summary API. It resets a previously opened saved-flow owner, retains member restrictions and renewed approval gates, and never activates automation or sends by opening. Mounted DOM regressions exercise the actual click, changed-rule save and prior saved-flow transition.

## Exact29a customer acceptance and release-gate follow-up

The authenticated29a settings button opened the real workspace qualification form (Balanced/80), with activation disabled; no settings were changed. Legacy save-only Retry reached "Cloud sync confirmed. Workspace saved to LeadIntel" and "Retained evidence saved · research checks remain incomplete". Web usage remained exactly nine requests. Its transient generic Retry progress inherited a44-minute research ETA; the follow-up gives this save operation its own two acknowledgement stages and clears the stale ETA without invoking providers.

Native raw diagnostics after that save measured4,298,964 UTF16 bytes across20 localStorage records: five business sections3,778,432; recovery pointer426; snapshot pointer456; other app metadata519,650. The durable archive held14 records/about27.5MB, complete references, zero pending pins and one exact previous owned snapshot retired. This establishes current headroom and lossless owner operation; the original pre-failure raw key total was not captured.

One saved-company batch was then reviewed with the remaining11-request cap (the earlier run used9, total20). It finished in58 seconds, used8 searches/3 page reads, checked two sites and returned zero newly checked/strong-fit companies; five still need evidence. Provider operations reported no failed/unusable responses, which does not establish company qualification. Workspace saving succeeded. No further paid research is part of this acceptance budget. Existing31 company records, Kitron selection and retained buyers remain the useful saved outcome; the five-company qualification target is unmet.

The exact29a main release gate failed a Monitoring fresh-message reopen timeout despite equivalent PR checks passing. A controlled real-module reproduction found a stale filter-row race; see2026-11-14-monitoring-filter-race.md. Do not call29a PROVEN PRODUCTION or substitute its passing Companies evidence for the blocked exact-release gate. The next exact revision must satisfy the full release chain and final authenticated reopen/handoff checks.

The bounded review also exposed a display boundary: persisted no_results with a measured spent budget and pending company checks was titled "Search finished · no checked matches". The follow-up presents that unfinished shortfall as paused/partial with the actual0-of-5 count and measured budget reason. It does not convert an unverified company into a match, change the evidence gates, or spend another request. A genuinely completed no-results run without a pending/budget stop retains its no-results state.
