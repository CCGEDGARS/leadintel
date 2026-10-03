# Workspace status — 3 October 2026

User replenished Firecrawl credits and requested red only for provider billing issues, with yellow for other attention items. Sidebar and drawer are now Workspace status, replacing generic error-count language.

Red: confirmed provider credit exhaustion, payment/billing limits, or a managed proxy HTTP 402. Yellow: failed/partial/stalled work, runtime problems, unsaved data, required unfinished steps, broken configured connections and unavailable status checks. Optional unconfigured tools remain neutral; missing Hunter becomes yellow when automatic delivery requires it. Summary counts billing issues separately from other attention items. Green means no current detected issues, not a claim of completed research or successful sending.

Recheck tools forces a service status verification despite the normal polling cooldown. Firecrawl's positive verified credit balance records recovery; zero records exhaustion; missing/unknown balance cannot clear a billing failure. Authentication success alone does not establish credits for providers without a balance check. Successful subsequent provider requests continue to clear their own audit-backed credit alerts. Historical saved search HTTP 402 entries do not reintroduce a red alert after current provider status is available. Failed checks retain confirmed billing alerts and add yellow status-unavailable guidance. Cross-workspace provider alerts are scoped and reset.

Yellow items remain actionable and can still block the affected task. Replenished credit does not complete previously failed research; retry unfinished checks separately. No real provider recheck, billing change, research, workflow activation or outreach was performed on the user's behalf in this change.

Regression coverage: billing vs transient rate limits; task, runtime and required-step severity; optional missing vs required/broken tools; managed billing; recovered billing with retained historical failure; forced recheck and workspace isolation; verified balance known/unknown/zero behavior. Production requires exact-SHA CI, deployment, health and smoke proof plus changed asset parity.
