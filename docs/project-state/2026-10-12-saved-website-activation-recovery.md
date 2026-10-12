# Saved website activation recovery

## Observed customer symptom
Signed in as the same Google account. Setup remains at 2/3 with Website not activated, while Profile (8/8), Strategy (4/4) and Buyers (1/1) still show completion. Screenshots suggest retained data and a broken navigation prerequisite; they do not independently prove every saved CRM record exists.

## Root cause
The navigation guard read only the standalone browser activation registry. Server hydration restores main state but not that registry; the saved snapshot reconstruction was not applied to active browser storage. Profile normalization also discarded explicit activation metadata, making subsequent snapshots unable to reconstruct it. A missing research metadata record could additionally trigger the new initial research handler despite an existing profile.

## Fix
Activation lookup reuses a valid matching registry or recovers its navigation proof from same-URL readable saved evidence and either explicit activation metadata or a matching saved company profile. It does not rewrite workspace state, invoke the scraper, or clear derived research. Unrelated company evidence cannot unlock navigation. Profile normalization retains validated activation metadata. Server-ready and workspace-change events refresh the visible status. Initial company research skips existing profiles even when auxiliary browser metadata is missing.

## Validation
Regression tests cover missing/stale registries, explicit activation without a profile, foreign and empty evidence, normalizer preservation, nonmutation of saved workspace data, and opening existing profiles without provider calls. Existing profile/activation/research and full customer suites, exact-SHA CI and production integrity checks apply. Actual customer browser recovery remains to be confirmed after refresh.
