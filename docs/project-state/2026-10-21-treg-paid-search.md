# Treg paid search

User-approved scope: replace the Setup additional-email-research accordion with one paid-search toggle beside Save settings. Preserve independent approval of sending. Treg handles buyer work-email finding and verification; Firecrawl and connected AI providers retain company and buyer research.

## Connected behavior

- Workspace owner connects a Treg team token in Settings. Existing encrypted workspace-service storage holds it; no platform token or customer-specific default is used. Saving a token performs only a free balance check and does not activate paid research.
- Activate paid search records owner consent, provider Treg, one buyer/company and the displayed daily/monthly lookup limits. Its confirmation discloses the estimate, variable outcomes and a $0.075 combined finder/verifier request ceiling. Deactivation prevents subsequent automatic paid calls, including verification after a revoked lookup. Calls already submitted may finish.
- The saved policy drives manual Find email and the server-approved workflow. Public/saved accepted evidence is reused first. Treg accepts a qualified, individually researched buyer without requiring four other researched buyers. Shared official-page evidence, current company qualification, exact identity, employer, role and mandatory per-person checks still apply. The server also requires AI review of the chosen buyer.
- Automatic companies remain ranked and must pass the existing 80+ company qualification gates. The strongest missing-email buyer is attempted first. Only an attributable exact-domain work email with positive, non-catch-all verification enters CRM and downstream message/delivery eligibility. Unknown, pending, conflicting and personal-address outcomes remain unconfirmed.
- Finder and verification calls share a durable workspace/company/person/month lookup key. Idempotency and phase receipts recover interrupted calls without repurchasing completed phases. Actual Treg call IDs and settled micro-USD cost are retained. BounceBan async verification uses only the free status endpoint, bounded to ten polls and five minutes. The attempt, actual provider outcome and costs survive CRM research snapshots/reload.
- Delivery uses the existing approved template, mailbox, schedule, suppression, reply-stop and duplicate-recipient controls. The new button never activates sending. Legacy Apollo/Hunter routes retain their original explicit gates and stored data, but the Treg path never silently falls back to them.

## Estimate meaning

UI: approximately $0.30 per researched email **plus AI and additional company research**, not a guaranteed total. Firecrawl Hobby monthly example: $19/5,000 credits, six searches with ten basic webpage scrapes each = 72 credits = $0.2736 of the plan allowance. Earlier Treg Stegra test averaged $0.01611975 across four verified contacts. Subscription allowance allocation is not a surcharge added on top of that same subscription. Fixed mailbox/hosting costs are separate; unsuccessful research and later retries can change actual unit economics.

Sources: https://www.firecrawl.dev/pricing ; https://docs.firecrawl.dev/features/search ; https://treg.to/integrate.md . The app does not claim a complete AI/Firecrawl cost ledger or a fixed all-in email price.

## Verification scope

Regression coverage includes owner-only activation, save/reload, deactivation, per-workspace credentials, exact identity/domain rejection, catch-all/pending rejection, idempotency and interrupted verification recovery, plus the automatic buyer → CRM → message → delivery verification path with controlled provider responses. Real contact yield and actual sending are separate customer acceptance outcomes. Production status requires exact-SHA release proof.
