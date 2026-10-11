# Workspace sync capacity recovery — 11 October 2026

## Confirmed cause
The authenticated customer workspace failed before sending PUT: 562 KB after existing compaction against the 500 KB wire ceiling. Content-free sizes were main 88 KB, discovery 221 KB, outreach 209 KB, delivery 1 KB, meta 45 KB. Research repeated across discovery and message dossiers was encoded independently; the aggregate exceeded capacity even though individual sections fit. Retrying unchanged data could not fix this.

## Correction
A capability-gated workspace bundle dictionary shares equal copies across all five namespaces. The original business structure is restored before hydration, authorization, flow context hashing and downstream reads. Explicit Save metadata is overlaid separately to survive both persistence boundaries without replacing recipient metadata. Existing namespace/section formats remain readable. Clients write the new bundle only when the backend advertises workspace-bundle-v1, preserving rollout compatibility.

My Flows encoding also uses bundle sharing. Brand asset reference checks, monitoring and approved buyer execution decode state before reading it. Invalid references, cycles, ambiguous sibling namespaces and oversized restored sections fail closed. The 500 KB wire ceiling and original-script ownership rules remain enforced. No CRM record, message, approval, recipient or audit history is deleted by bundle sharing. Growing canonical CRM data remains in dedicated workspace-scoped D1 CRM storage; this does not expand the workspace into an unlimited CRM archive.

## Regression evidence
A 603 KB combined fixture reproduces the old failure. Tests cover exact field restoration, stable repeated packing, explicit Save through the real fetch boundary and fresh-browser hydration, CAS/backend persistence and original-script authorization, saved-flow encoding, retained buyer priority, monitoring markets and asset reference protection. Malformed references and decompression bounds are rejected. Production acceptance requires exact release proof plus authenticated Save/reload; passing tests alone do not establish acceptance.
