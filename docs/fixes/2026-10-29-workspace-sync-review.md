# Workspace sync review and duplicate header recovery controls

User screenshot showed legacy Use server version / Keep my local changes / Download recovery copy alongside the topbar's second Keep my local changes action and Needs attention status.

Root cause: app-shell hid old account/status elements but omitted conflict/recovery controls. Topbar copied the save button label and invoked it immediately, while the persistence layer interprets a save during conflict as an explicit keep-local choice. The Workspace status sync alert also invoked that save path. This made a general review action choose a version without showing the alternative.

Fix: one Review sync action opens the existing Workspace status drawer. Both existing version handlers and recovery download remain available there; legacy header controls hide only after their replacements mount. Review never writes. Sync alerts and any save card also review a conflict instead of choosing. Duplicate unsaved warnings are suppressed when the sync alert already explains them. Resolving state disables choices and updates the header; Escape returns focus to the visible opener. Failures retain the conflict and both versions. The merge engine, workspace ownership, backup-before-overwrite, and cloud acknowledgement gates remain unchanged.

Regression coverage: real DOM integration checks hidden legacy controls, no writes on review, independent version/backup actions, busy state, success state, and focus restoration. Existing sync recovery tests exercise actual save/reload, overlapping and disjoint changes, concurrent tabs, missing baseline, storage quota, durable backup and failure retry. The provider polling test now uses a real DOM instead of a partial element mock that returned the same object for every selector.

Isolated Chromium fixture checks at 1440px and 390px confirm recovery choices stay in the viewport, no duplicate header controls, review causes no write, and Escape closes; no page exceptions observed. This is not authenticated customer-account acceptance. The screenshot's three individual attention items cannot be identified from the cropped header alone. A real unresolved data conflict still requires its owner's choice; no local/server record was silently discarded.

Release acceptance: require exact-SHA CI and production release-proof verdict PROVEN, including new sync-review smoke checks. Customer browser save/reopen remains separate from release verification.

Final local validation: 4,063 customer tests passed; JavaScript syntax, diff whitespace check and static build passed. The release watch fixture now includes the actual topbar entry so the new mandatory entry check remains enforced. Browser fixture validation passed at both documented widths.
