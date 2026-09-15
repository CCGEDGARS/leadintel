# Task 4 status report

Status: COMPLETE.

Starting branch head: `0b9c26988b4e7ef5d4267501ae1ca762040023fe`
Implementation head before this report commit: `cdbbdb639ba3971307b64f94f6427f0d25361a05`

## Remote commits

1. `4d41a9c5f683746139858bd579badf9536230159` — RED contract tests
2. `a1ba1ec6f502702e5aedec771adec0e665208074` — workspace-scoped brand asset bridge, safe workspace serialization, optional mail bodies
3. `2200214ec83209652929012b654e533ebe99509a` — best-effort observable reset cleanup
4. `f5431a436dfb6ba84938aa5d3deb879055919626` — VM-safe value assertions without weakening the contract
5. `50952ee802e40059a9215df51b730541f228ce91` — RED tests for all Task 4 review findings
6. `27a12d5b187f180241493bdaffc83f174baef79f` — transactional asset replacement, cleanup retry queue, strict identity serialization, and cache version
7. `23615ce2861b630805fa1498349a56b4f866904c` — consistent observable reset cleanup when deletion is unavailable
8. `bc46b770a04e79550ab564d9f342bda031af2d96` — Task 4 process-map cache keys
9. `07a98d5d37a743ce0e72b0f34109508c83892daf` — Task 4 page cache keys
10. `f34916d5f6a077a1ee85810fdf21dfdd39e11cc7` — hardened review contracts and serialization-safe VM assertions
11. `64917708221ffdfca158a4a848b467e203e69aa0` — updated cache regression contract
12. `e02696b5208d01d0e76e684c77b55be2a31b3e09` — RED tests for stale identity, state PUT races, cleanup storage failure, and reset accounting
13. `c405e28dd769cb066be03d6b8abd2d8ea075b769` — latest-state asset mutations and shared per-workspace save serialization
14. `20def51594451928150068af651e180c8bd1162f` — mutation-only UI-to-bridge asset intents
15. `6f9e4b98e79b3b7ec0499c701b0d7fe41c103fb1` — distinct queued reset cleanup accounting
16. `2898bf2e18f723e82fb3555d929a33f03a116673` — reviewed Task 4 process-map cache references
17. `933fda458d01f5e59d692f9fd28df8c736f992f4` — reviewed Task 4 page cache references
18. `4264f785c37657a988dfeea4f34c67ef17522e15` — final Task 4 state-coordination regression contracts
19. `047e353ffb23906cdf57d0a21190b56aa88d39ac` — Brand Identity bundle regression update
20. `52f9793c94d9b4e37466570cb886989502c4e794` — process-map bundle regression update
21. `c0df679f8dcad4f6d179ce39342ef65ee0e0a6d0` — RED production-composition tests for persistence-wrapper, rollback, and reset lifecycle findings
22. `f81056e66f86e68da7859678ce45b5e24201c930` — asset save intent, explicit `saved:false` failure, and mutation-only rollback
23. `87d4c43caae7adf7ce13b472c817fdb26e94fb91` — explicit server-reset marker naming
24. `5ed27410fa71901fed383601ff91d37f94a0eab5` — independent reset asset-cleanup record and cleanup-only deletion
25. `340bb0aab34458ec47cbb746421f8e7b9e5991be` — production persistence bundle cache update
26. `6c23b0e44c2a8a34d543f5c38003750cc52b3dbf` — page entry cache update
27. `fe10b2bd36c18641f78b15340d16408449474036` — production-composition regression contracts
28. `3155709d9d19ca4950c7208d16b815b2ca0bb964` — process bundle regression contract
29. `be01c4972970e40a6798869a09260b42b327e309` — corrected mutation-only rollback assertions
30. `c14478dab01182f8754d1e876d53b2b75672e9f5` — RED tests for overlapping save intent and reload cleanup recovery
31. `6851ab0a7267a805995d1f16acee75aef3faeda8` — per-operation queued save intent and cleanup-only retry queue
32. `72ef1acfeb345f069b85b3512cf86f2c01dc39ba` — success-only explicit-save state and request-scoped persistence intent
33. `4152f8708c587b6a5e30a0077e2bdd93afd044ca` — direct reload cleanup recovery when server reset is complete
34. `55992f95ab9e98d59647889ddf315714cfd8f60c` — final Task 4 process bundle cache update
35. `16b8002a8457afa9469763209807ab2e06032bc4` — final Task 4 page cache update
36. `2d1704addaf8d1129d773134355087814a1971fd` — final save-intent and reload-recovery regression contracts
37. `b1f02b589f1d573c8b19e1e4583c3858de85b7fb` — explicit-save timeout regression contract
38. `cea6142fe15cc801581112fd2c2688329e8106ac` — RED production-composition tests for edits made after a workspace PUT begins
39. `4a28d79cca6d2facf30ef649b378fa1acd10919b` — persisted-payload comparison and dirty-marker rebasing in the bridge
40. `6bd067b9a51fa6cb12d7ac98e9a98c701df3b8a8` — exact persisted snapshots with PUT-start local-state comparison
41. `9e1bfeb6ad64c53b6a24d5de0c7e14921d98b7aa` — page entry cache refresh for the dirty-state fix
42. `a00d074413e14fb020ba7a44f18f1a379d49a287` — process-map cache refresh for the dirty-state fix
43. `2ea36f913fca0ab3d8663b75f971da83474d2e30` — Task 4 race coverage cache contract
44. `61267ee862640b291220d7c5e6e879a233245962` — spinner regression cache contract
45. `f92352f825e4fd4c3f16a4afde6bcc26b95d30b9` — RED production-composition test for reset versus in-flight upload
46. `8a5a2d547af42f871649abc1eb6cafb8d428b062` — per-workspace reset generations and cancelled asset cleanup
47. `e0be39c1921e5dbb7ec7026966669d1e42a03345` — reset invalidation before identity clearing and reset persistence
48. `5a35cadcbc58e3156cd7b11cf1a754c82e5899ff` — page entry cache refresh for reset-race handling
49. `c5aa19bedac1a6044ff2069f5febc4bc1c04beb8` — process-map cache refresh for reset-race handling
50. `20efabfa3f3306d5b3bf0087ebb56681c95ee104` — upload and import reset-race regression contracts
51. `cdbbdb639ba3971307b64f94f6427f0d25361a05` — spinner regression cache contract for runtime v7

## Implemented

- `uploadBrandAsset`, `importBrandAsset`, and `deleteBrandAsset`
- authenticated requests with selected `workspace_id`
- multipart upload without forcing a JSON Content-Type
- transactional upload/import plus identity persistence
- failed persistence restores only the failed asset mutation against the latest identity and deletes the new object best-effort
- concurrent identity edits survive failed replacement and failed removal rollbacks
- a pre-mutation local write failure preserves the original Ready identity byte-for-byte
- failed cleanup is recorded in an observable retry queue and retried during bridge initialization
- successful replacement deletes the previous object best-effort and queues observable retry on failure
- explicit upload/import failures cannot mutate previously saved metadata
- `textBody` / `htmlBody` mapping to `text_body` / `html_body`
- legacy `body` retained
- brand identity serialization whitelists published fields and strips raw bytes and data-image values, including malformed whitespace/casing variants
- ordinary prose that merely mentions `data:image` remains intact
- reset captures managed asset references, clears local identity, retries cleanup, and emits an observable result
- failed reset deletions remain pending for retry; unavailable deletion also emits a consistent cleanup event
- upload, import, and delete encode reserved characters in workspace identifiers
- `server-bridge.js`, `workspace-reset-hygiene.js`, `workspace-persistence.js`, `process-map.js`, the page entry point, and cache regression tests use `20260916-brand-assets-v7`

## Transaction re-review

- the UI sends only an explicit asset mutation; it never supplies a full identity snapshot for the bridge to commit
- inside the per-workspace lock, the bridge re-reads and normalizes the latest local identity, applies only the asset mutation plus Draft status, and persists that result
- unrelated edits made while upload is in flight are preserved
- every workspace state PUT, including autosave, manual save, asset replacement, and asset removal, uses one per-workspace save queue
- asset transactions enter the save queue without the save path entering the asset queue, avoiding lock-order deadlocks while preserving conflict handling
- upload, import, replacement, and removal transactions remain serialized by workspace
- a failed earlier transaction cannot restore stale metadata over a later successful transaction
- cleanup retry-storage failure after a committed save is non-fatal: the committed identity is returned and adopted, and a warning event/result is emitted
- removal persists an asset-less Draft identity before deleting the old managed object; failed persistence leaves the old metadata and object intact
- reset reports deleted, queued, and failed cleanup outcomes separately
- asset state saves set the production persistence save intent and produce exactly one backend workspace PUT
- an HTTP 200 response containing `saved:false` remains unsaved and cannot retire the old managed asset
- rollback changes only the matching asset field; current Draft status and newer identity fields remain intact
- server-reset state and asset-cleanup work use separate records, each cleared only after its own operation completes
- reset performs one workspace PUT followed by direct workspace-scoped asset deletion
- save intent is carried by each queued operation and fetch request; no shared session save-intent flag remains
- an overlapping asset save and explicit save produce two ordered backend PUTs, with the explicit PUT containing the latest edit
- explicit-save state and snapshots are created only after a successful persisted response; failed explicit saves remain unsaved
- reload recovery directly resumes asset cleanup when the server-reset marker is already gone
- reload recovery with both records saves once with explicit intent before cleanup
- failed reload cleanup transfers to the observable brand-asset retry queue and clears the completed reset-cleanup record
- Task 4 browser cache references now use `20260916-brand-assets-v7`

## Final dirty-state race fix

- every workspace PUT captures the exact sanitized workspace payload sent to the backend
- the saved snapshot is built only from that persisted request payload, never from newer local state observed after the request began
- the persistence wrapper also captures raw local workspace data at PUT start and compares it at response time, avoiding false dirty results caused only by server-payload normalization
- when a user edit occurs during an in-flight explicit or asset save, the edit remains local, `hasUnsavedChanges()` remains true, and the saved snapshot continues to represent the earlier persisted payload
- the bridge rebases the workspace-scoped dirty marker onto the newly persisted server version instead of clearing it, preventing a false reload conflict while preserving the unsent edit
- the next explicit save sends the newer edit, updates the persisted snapshot to that exact payload, and clears both dirty indicators

## Reset versus in-flight asset fix

- each workspace owns an in-memory reset generation; upload and import capture that generation before starting the external asset request
- reset invalidates the generation synchronously before recording cleanup intent, clearing `brandIdentity`, or entering the workspace save queue
- a completed upload/import is cancelled before any local identity mutation or state PUT when its generation is stale, reset remains pending, or an identity present at operation start has been cleared
- cancellation returns an explicit `{cancelled:true, reset:true}` transaction result and deletes the newly created managed object best-effort
- failed cancellation deletion uses the existing observable cleanup retry queue, without attempting a workspace state save
- old pre-reset assets continue through the independent reset-cleanup record; cancellation of the new object does not overwrite or consume that intent
- reset and asset cleanup do not acquire the workspace save queue from inside the asset transaction, avoiding lock-order deadlock
- production-composition coverage proves both upload and import cannot recreate identity, including an import that returns only after empty reset cleanup has already removed the pending marker

## Test evidence

Review RED run: 5/12 passed and 7/12 failed for the intended missing review behavior.

Focused Task 4 + server bridge run: 23/23 passed.

Relevant Brand Identity, production-mount, persistence-timeout, and cache regressions: 32/32 passed.

Latest review RED verification: 16/20 passed and 4/20 failed for exactly the four missing behaviors.

Focused bridge and UI verification after implementation: 45 passed, 0 failed.

Latest review RED verification: 1/5 passed and 4/5 failed for the intended save-intent and reload-recovery gaps.

Final dirty-state RED verification: 0/2 passed; both intended race reproductions failed before the production fix.

Final focused Task 4 verification: 31 passed, 0 failed, 0 skipped, 0 cancelled.

Final related regression verification: 87 passed, 0 failed, 0 skipped, 0 cancelled.

Reset-race RED verification: the in-flight upload reproduction failed on the missing cancellation result, and the import reproduction failed after reset cleanup had already cleared its pending marker.

Latest focused Task 4 verification: 33 passed, 0 failed, 0 skipped, 0 cancelled.

Latest related production-composition and regression verification: 89 passed, 0 failed, 0 skipped, 0 cancelled.

JavaScript syntax checks passed for the bridge, reset hygiene, Brand Identity UI, app integration, process map, and every modified regression test.

The two VM cross-realm comparisons now verify every expected field and the exact result key set individually. No behavioral assertion was removed or relaxed.

No remaining Task 4 test failures or implementation blockers are known. An additional company-research structure suite is outside Task 4 and reports missing-fixture failures in this partial checkout; none overlap the files or behavior changed here. The expected warning in the reset-cleanup test is the observable simulated partial-delete failure under test, not a failing assertion.

No Task 5+ files were changed. `main` was not changed.
