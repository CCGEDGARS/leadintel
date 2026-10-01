# LeadIntel Repository Operating Rules

## Market intelligence research is governed

For any work involving market research, market intelligence, buying-signal discovery, source selection, source diversification, evidence validation, opportunity scoring, adaptive follow-up research, or the behavior of Market Scan / Market Research / Market Intelligence, use `.agents/skills/leadintel-market-intelligence/SKILL.md`.

Do not claim that a research provider, scraper, enrichment source, LinkedIn access path, or fallback tool was used unless the repository/runtime actually contains and executed that verified path. Preserve the research state model: **Known -> Planned -> Researched -> Verified**.

## Release integrity is mandatory

For any work involving deployment status, production freshness, release links, or whether a fix is actually live, use `.agents/skills/release-integrity/SKILL.md` and the repository release-integrity system.

Never describe a build or URL as latest, current, live, deployed, fixed in production, production ready, or **PROVEN PRODUCTION** unless `release-proof.json` for the exact intended Git SHA and environment has verdict `PROVEN` and all mandatory gates are satisfied.

The required production chain is:

`exact Git SHA -> required CI success for the same SHA -> live release.json same SHA -> backend health -> mandatory smoke checks -> release-proof.json verdict PROVEN`

Never silently substitute an older deployment or old file when the newest intended revision is unproven. An older verified version may only be identified as **LAST KNOWN WORKING**, with the unresolved gate for the newer revision stated explicitly.

Use the fixed release labels defined by the release-integrity skill: **LATEST CODE**, **VERIFIED PREVIEW**, **PROVEN PRODUCTION**, and **LAST KNOWN WORKING**.

## Cooperation and completion rules

The user agreements recorded in `docs/project-state/2026-09-30-leadintel-checkpoint.md` govern continuing work. Own the connected Profile → Companies → Buyers → Triggers → Scripts → CRM workflow. For recurring bugs, record the root cause, inspect related paths, add meaningful regression coverage, and verify save/reload/downstream behavior. Report separately what tests prove, what the exact production release proves, and what authenticated customer evidence proves. Do not substitute a build passing for customer acceptance, ask the customer to repeatedly diagnose basic controls, or claim background work is continuing after the turn. Script generation and approval do not authorize sending outreach.

## Customer portability is mandatory

LeadIntel is a multi-customer SaaS. Ercon and CCGROUP are test fixtures, never runtime defaults or special-case routing. All research plans, signal candidates, preview themes, company matching, buyer qualification and message context must derive from the active workspace\u2019s seller profile, confirmed offers, selected markets and activated reference models. Reference customers are separate from the seller identity. Do not copy one customer\u2019s industries, sales signals, buyer roles or scripts into another workspace. Unknown context must stay unknown or request input. Add cross-industry and name-invariance regression checks for changes in shared personalization logic. Protect workspace isolation and retain evidence gates.

## Report lifecycle and prevention checks

Apply the recurring-error controls in `docs/project-state/2026-10-01-report-deletion-and-prevention.md`. Authorized fixes require action, not acknowledgement-only responses. For saved artifacts inspect view, save/reload, export/print, individual/bulk deletion, cancellation and empty-state behavior. Deleting snapshots must preserve downstream source evidence and must not be undone by initialization or migration.
