# Workspace sync capacity — 9 October 2026

The reported warning is the application's 500 KB per-workspace-state save ceiling, not a Cloudflare storage quota. Buying storage does not change this code limit.

## Root cause and changes

The previous lossless reference encoding covered only Discovery. Repeated profile reports and approved message histories could therefore exceed the cap even after source-text compaction. Regression fixtures reproduced an 806 KB combined save and a 924 KB profile save, both rejected by the previous implementation. Main, Outreach and Delivery now use a separate tagged, lossless section format only when needed. All original business fields, approved messages, source links, history, companies and buyers remain in the restored records. Existing extracted-source-body compaction is unchanged. CRM remains a separate workspace-scoped D1 system of record under the approved Master CRM architecture; this patch creates no new CRM data in workflow state and does not enlarge the 500 KB ceiling.

The backend validates and decodes references before original-script authorization and before consumers read workspace records. Malformed stored state now fails rather than silently returning an empty workspace. Restoration bounds, including legacy references and trace dictionaries, limit expansion. CAS revisions and membership gates remain active. The new frontend encoding waits for the authenticated state endpoint's `workspace-sections-v1` capability so a frontend-first rollout cannot send unknown encodings to the previous backend. Backend CI now watches the shared state codec.

Save preparation and request failures now end the top saving indicator with an error while retaining the dirty local state. An empty latest company search explicitly acknowledges retained saved companies without claiming they passed new qualification.

## Verification

Observed failing tests before each production behavior change. Regression covers round-trip record equality, repeated preparation, actual persistence save/reload and clean baselines, non-destructive overflow, malformed/cyclic references, expansion bounds, protected-original authorization, rollout capability and both preparation/request error feedback. Full suites, static build, deployment contract and Worker dry-run are required before publication. Exact-SHA CI, frontend manifest, backend release SHA and mandatory smoke checks establish release status separately.

The isolated browser is signed out. Its local LKAB view showed the retained four priority buyers and six other candidates, but the customer's authenticated workspace save cannot be claimed verified from that view. No data deletion, workspace reset, new research or outreach is part of this repair.
