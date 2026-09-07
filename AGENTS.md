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
