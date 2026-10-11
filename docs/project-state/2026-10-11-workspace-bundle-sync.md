# Workspace sync capacity recovery — 11 October 2026

## Confirmed cause
The authenticated customer workspace failed before sending PUT: 562 KB after existing compaction against the 500 KB wire ceiling. Content-free sizes were main 88 KB, discovery 221 KB, outreach 209 KB, delivery 1 KB, meta 45 KB. Research repeated across discovery and message dossiers was encoded independently; the aggregate exceeded capacity even though individual sections fit. Retrying unchanged data could not fix this.

## Correction
A capability-gated workspace bundle dictionary shares equal copies across all five namespaces. The original business structure is restored before hydration, authorization, flow context hashing and downstream reads. Explicit Save metadata is overlaid separately to survive both persistence boundaries without replacing recipient metadata. Existing namespace/section formats remain readable. Clients write the new bundle only when the backend advertises workspace-bundle-v1, preserving rollout compatibility.

My Flows encoding also uses bundle sharing. Brand asset reference checks, monitoring and approved buyer execution decode state before reading it. Invalid references, cycles, ambiguous sibling namespaces and oversized restored sections fail closed. The 500 KB wire ceiling and original-script ownership rules remain enforced. No CRM record, message, approval, recipient or audit history is deleted by bundle sharing. Growing canonical CRM data remains in dedicated workspace-scoped D1 CRM storage; this does not expand the workspace into an unlimited CRM archive.

## Regression evidence
A 603 KB combined fixture reproduces the old failure. Tests cover exact field restoration, stable repeated packing, explicit Save through the real fetch boundary and fresh-browser hydration, CAS/backend persistence and original-script authorization, saved-flow encoding, retained buyer priority, monitoring markets and asset reference protection. Malformed references and decompression bounds are rejected. Production acceptance requires exact release proof plus authenticated Save/reload; passing tests alone do not establish acceptance.

## Authenticated acceptance correction
Cross-section sharing alone reduced the actual customer payload from 562 KB to 550 KB; the first production acceptance correctly remained failing. The records were largely distinct, so reference sharing was insufficient. A separately negotiated workspace-lzw-v1 codec now stores the complete UTF-8 JSON using bounded fixed-width LZW byte codes and base64. Compression is attempted before disposable evidence compaction, preserving full originals when they fit. Both wire and expanded limits remain enforced; unknown formats, invalid codes/base64/UTF-8, cycles and oversized expansion fail closed. Neither dictionary sharing nor compression removes records. Old clients retain old readable formats; clients only write compressed data after backend capability advertisement.

Distinct-record regression reproduces the reference-only failure, tests exact Unicode/text restoration, dictionary saturation, bounded decompression, both Save boundaries, fresh-browser hydration and downstream readers. Final customer acceptance still requires the actual formerly failing workspace to save and remain synced after reload.
