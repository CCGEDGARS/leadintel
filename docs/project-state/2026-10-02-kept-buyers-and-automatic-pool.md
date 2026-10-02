# Saved buyers, refresh protection and automatic research — 2026-10-02

## Root causes
Refresh rebuilt recommendations without a user-controlled keep state or durable wider-pool details. Automatic execution used an independent Apollo-first route. An already-open browser tab can still run its previously loaded code; screenshots with the older Apollo/Gmail wording were customer evidence of an old runtime, not proof of accepting the new public research release.

## Implemented behavior
- Shared buyerResearchPlan, discoverPublicBuyers, mergeBuyerPool and recommendedBuyers govern manual and automatic research. Firecrawl role searches plus optional grounded OpenAI use workspace-specific roles, source evidence and public URLs. The pool remains capped at twenty, and the display at six. First-name-only unpinned leads are excluded from recommendations.
- Refresh is above buyer roles/cards. Refresh merges current and previous candidates, deduplicates identities, retains sourced emails/phones/profiles and preserves up to six kept people even when their role is no longer eligible. Saved is not a qualification override.
- Keep candidate writes the contact to workspace CRM and explicitly syncs the keep state to the server. Save failures restore previous flags and do not show Saved. Unsave removes the preference, preserving CRM records/history. The selection survives reload and server hydration. Concurrent duplicate keep actions are guarded.
- Approved automatic buyers perform the same public research, load saved preferences from that workspace, prefer eligible kept verified CRM buyers, and otherwise enrich only uniquely matched recommended public identities with Apollo if enrichment is approved. Each company proceeds with one verified business-email contact. Unknown/unverified buyers remain in a review list displayed in run history. Company threshold, final approval, pause/takeover and downstream suppression remain intact. No outreach was sent while implementing this change.
- Gmail presentation/search remains as implemented previously: sourced address or Not found; guesses never become findings.

## Tests and release
Meaningful regression coverage includes twenty/six bounds, refresh merging and detail retention, keep/save/reload/unsave, failed CRM save, role-ineligible pinned buyers, cross-industry behavior, server public discovery, workspace-scoped preference and no enrichment when not approved. Full customer/backend suites and exact-SHA deployment proof are required. Runtime cache keys change for discovery and workflow UI.

Authenticated Polestar acceptance remains separate from mocked provider tests, database-backed automatic-flow tests and public deployment/asset checks. Twenty is a target, not guaranteed qualified contacts. Provider gaps are retained in diagnostics.
