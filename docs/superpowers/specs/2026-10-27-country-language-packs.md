# Country-triggered language packs and English-first translation

User-approved scope: discussion of 27 October, followed by explicit instruction to implement all updates. English remains primary. Country selection starts preparation, never translation or replacement of drafts.

## Architecture
Use shared public, versioned language packs with 3–5 actually fetched reputable sources, source dates, extraction receipts and AI checks; no workspace/customer facts in the shared pack. Authenticated country selection queues durable preparation; cron and waitUntil process it with leases and bounded retries. Unknown/multilingual markets require language choice; Turkey and China support Turkish and Simplified/Traditional Chinese. Baseline guidance remains usable with honest status when research is unavailable. Workspace glossary/voice references remain workspace scoped and derive from existing approved language references, never cross-customer data.

Existing AI translation remains default. Google Cloud Translation is a separately configured, encrypted workspace API connection and optional second provider; never relabel Gemini as Cloud Translation. Missing configuration must be visible and cannot silently route to another provider. Translate exact saved English subject/body, preserve formatting and protected identities/numbers/links/paragraphs. Follow with existing AI editorial review using the selected pack. Only executed checks appear in provenance.

Country changes show a top translation shortcut without changing the English script or explicit buyer/flow language choice. Translation creates a preview. Apply updates only the working version; Save is explicit; Cancel preserves the editor; Undo returns the exact prior working version and retains English. Existing language version/history/CRM serialization are reused. Stale English or changed workspace/contact/channel discards pending results. English is accessible and required; no target-to-target chaining. No automatic approve/send.

## Choices
Selected: reusable source-backed public language packs + private approved references, explicit per-message translation and optional Google provider. Rejected: generating an unverified skill per customer, translating on country change, or automatically rewriting saved text. Native review is a distinct state, never inferred from AI checks. Packs are internal language guidance, not part of the 30 book-derived skills quota.

## Acceptance
Sweden selection queues Swedish preparation; Turkey/China resolve correct choices; unknown/ambiguous selections stay explicit. Research failures remain visible/retryable; 3–5 sources means 3–5 successful reads, not search snippets. English stays visible until Translate and Apply; Save/reopen and Undo retain originals/history. Unconfigured Google is disabled with connection guidance. Test workspace isolation, idempotency, leases, abort/races, hostile source content, protected facts, rich text and old saved translations. Run complete frontend/backend suites, build and exact-SHA release proof. Separately report authenticated live-provider verification.
