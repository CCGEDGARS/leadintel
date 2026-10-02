# Reference list deletion and unexpected naming — 2 October 2026

## Evidence and root causes

Edgars' screenshot shows one saved active list named Customer List 2, an unsaved draft and an unusable Delete control. The screenshot does not establish that two separate lists exist or who originally saved the list.

- Both the library renderer and delete handler blocked deletion whenever any draft differed from its saved snapshot. Users could not discard an unwanted saved list without saving unwanted edits first. Existing decorated buttons also retained stale disabled state.
- A blank list-name input while saving an existing list used total saved count + 1, renaming the same list to Customer List 2 without creating a second list.
- Legacy migration checked only whether the library contained lists. An intentionally empty library with an unsaved draft was therefore treated as legacy data and silently saved on render.

## Changes

Delete remains available with unsaved edits. It opens an explicit inline confirmation; deleting the selected list discards its unsaved edits, deleting another list preserves the working draft. Active-model removal and CRM preservation are explained. Cancel makes no state change. Confirmation is tied to the workspace where it opened, and account sync success is reported only when confirmed by the shared sync helper.

Blank names retain an existing saved name. New unnamed lists receive a company-derived reference label. Existing libraries, including empty ones, bypass legacy migration. Actual legacy records still migrate once. Existing customer list names are not silently rewritten and no customer account records were deleted during this repair.

Loader cache keys were updated along the changed runtime dependency chain.

## Verification

Observed failing regressions before correction: Delete remained disabled with unsaved edits; empty-library render recreated a saved list. Runtime tests exercise actual click handlers, confirmation, cancellation, persisted reload and workspace switching. Actual save-handler tests cover blank existing names, new draft rendering and explicit save. All 1,362 customer tests pass; changed JS syntax, git diff whitespace check and the Vercel static build pass.

Exact-SHA production verification follows publication. Authenticated deletion of the user's actual list is not claimed by these tests.

## Prevention

Deletion must support intentionally discarding selected draft edits with a visible confirmation, rather than forcing a save. Normalize an explicit empty collection as an intentional state, not as missing legacy storage. Defaults may name new objects but must never implicitly rename existing objects. Test actual handlers plus reload, not only source-string assertions.
