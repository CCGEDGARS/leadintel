# Profile research preservation and direct review

## Observed and reproduced failure

The two owner-supplied recordings show a completed Profile with partial market research, followed by a seller-research refresh, an incomplete Profile, and no market reports. The Market Research footer still claimed research was saved. Its prerequisite Review your Profile control closed the modal and focused a second review control.

Controlled execution confirmed that both successful company research and AI-only synthesis assigned `profile: null`, `approved: false`, and `market: {}`. Target-market edits also discarded the market object. A second saved-evidence Profile builder also cleared Strategy. It now delegates to the main guarded review path, with a preservation fallback for older callers. Seller research receipts lived only in a separate browser key, so cloud reopening could offer initial research despite an existing Profile. The recordings do not establish deletion from every recovery snapshot, and no private customer workspace was accessed during this fix.

## Authoritative ownership and changes

- `main.researchMeta` owns company-research history, field provenance and execution receipts. Existing workspace persistence, conflict handling, quotas and pinned Flow snapshots carry it. The former browser key remains a compatibility cache. A valid same-website legacy cache migrates on normal state loading; an explicit empty durable value prevents deleted history returning. Website replacement clears it; normalization rejects another seller's metadata.
- Successful refresh and AI-only synthesis preserve Profile, market evidence, report copies, selected/deleted signals, ICPs, opportunities and reference selections. Changed answer content or source content requires Profile/Strategy review; unchanged content keeps approval. Failure and cancellation keep business data and save honest diagnostics.
- Target-market changes retain evidence and selections, while clearing affected approvals and marking evidence for review. Explicit Reset research remains destructive by the user's selected reset action.
- Profile review reuses already readable sources. Both Market Research review controls enter the actual review directly, with normal validation and a separate approval action. They do not create a fictitious research link when no market evidence exists.
- Empty, running, partial, failed and report-only market states have distinct footer text. Seller AI draft readiness is separate from source coverage. A legacy saved Profile with missing receipts offers an optional refresh without inventing execution history.

## Compatibility and rollback

No database migration or provider configuration change. Existing `main` JSON accepts the additive metadata. Rolling back restores the old behavior and may drop metadata on client normalization, so the prevention checks should accompany any rollback. No automatic research, new retries, paid contacts or delivery actions are added. Research still has its existing explicit start, bounded stages and context/cancellation guards.

## Acceptance evidence

Focused behavior tests cover successful refresh, saved-evidence synthesis, unchanged approvals, changed answers, cancellation, provider failure, stale workspace responses, citation retention, metadata normalization and empty/history status. The authenticated Chromium journey uses real HTTP/session authorization and SQLite workspace persistence with explicitly controlled external providers. It covers empty-modal direct review, seller refresh after saved market research, mobile layout, cold-browser recovery, separate approval, Strategy handoff and foreign-workspace denial. No customer provider credits or outreach are used.

Exact-release production proof and customer-specific acceptance remain separate. The test demonstrates preservation going forward and recovery from saved evidence; it does not reconstruct evidence already absent from the customer's saved workspace.
