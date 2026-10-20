# Mandatory buyer depth and accountability

Root cause: manual research and unattended workflows used different person-search sequences. Aggregate result counts and a configured extractor did not establish which tool executed, and no shared check governed deeper follow-up or incomplete completion claims.

Implemented the approved adaptive-depth standard in `docs/policies/buyer-research-depth.md`, a shared public contact runner, exact extractor provenance, persisted accountability and a compact Buyers report. The standard limits escalation to missing fields, preserves explicit provider approval, reuses completed checks and supports cancellation/late-result isolation. Existing source-confirmed company email buttons remain eligible independently of whether every other identity has completed research.

The shared confirmation policy also now interprets SQLite UTC timestamps as UTC. Regression execution under a non-UTC host exposed otherwise-valid public confirmations being rejected as future-dated.

Validation covers deeper-source discovery, query/domain invariance, all-ten coverage, four-person escalation, cache/force refresh, actual extractor fallback ordering, skipped versus failed and zero-result calls, source ownership, workspace and CRM persistence, cancellation, time budgets, existing green-email handoff and separately approved services. Exact production status is governed by the release proof, not this document.
