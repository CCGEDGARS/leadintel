# LeadIntel Repository Operating Rules

## Core message templates are governed

For any AI work involving core outreach templates, factual field preparation, subjects, translation, rewriting or message length/spacing, read `docs/policies/core-template-ai-rules.md`. The approved text in `customer/approved-reference-scripts.js` is the canonical source, not a copywriting suggestion. Preserve every literal outside the declared slots, each style's own sequence and spacing, and its measured body word ceiling. Core AI may prepare designated fields only. Explicit Rewrite is a separate working alternative and cannot redefine the master or first tailored original. Unknown evidence permits only a declared omission/fallback; it never permits guessed facts or a new sentence. Personal templates, AI Original, LinkedIn and translated copies have separate authority. Changes to approved wording or new variable/omission permissions require explicit user approval; do not reinterpret a request to improve personalization as that approval. Verify master preservation, invalid AI responses, save/reload and context-race protection when changing these paths.

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

Mandatory user rule (20 October 2026): finish delegated tasks completely and provide a clear completion confirmation. Carry authorized work through implementation, regression checks, release when required, and verification against the requested acceptance criteria. Do not end with a plan, partial result or defect inventory when the authorized fix remains feasible. Resolve discovered defects within the delegated flow before handing it back. Completion claims must be backed by evidence; a genuine external blocker must be disclosed rather than concealed with a false 100% claim.

The user agreements recorded in `docs/project-state/2026-09-30-leadintel-checkpoint.md` govern continuing work. Own the connected Profile → Companies → Buyers → Triggers → Scripts → CRM workflow. For recurring bugs, record the root cause, inspect related paths, add meaningful regression coverage, and verify save/reload/downstream behavior. Report separately what tests prove, what the exact production release proves, and what authenticated customer evidence proves. Do not substitute a build passing for customer acceptance, ask the customer to repeatedly diagnose basic controls, or claim background work is continuing after the turn. Script generation and approval do not authorize sending outreach.

## Mandatory Buyers research depth and accountability

For Step 5 contact research, follow `docs/policies/buyer-research-depth.md`. For the four visible buyer controls, follow the owner-approved `docs/policies/buyer-contact-button-contract.md`: initial/free research and Recheck do not spend paid contact credits; E-mail and Phone independently request their paid channel, with confirmed data reused. Manual and automatic flows must use the shared adaptive-depth policy in `customer/discovery-engine.js`. Preserve evidence, per-tool execution outcomes and incomplete checks through workspace/CRM save and reload. A configured provider is never evidence that it ran. Paid Apollo and Hunter contact actions retain separate approval gates.

User instruction, 21 October 2026: deeper direct-email discovery is mandatory, including original/transliterated names and formats learned from official named colleagues. Complete the three-query Gmail business-contact research plan for every retained full identity. Show source-backed possible matches and name-based patterns separately, explicitly unconfirmed, with actual execution receipts preserved. Gmail candidates never satisfy the confirmed company-email gate. Use policy `20261021-adaptive-depth-v3`; older aggregate completion is insufficient.

## Customer portability is mandatory

LeadIntel is a multi-customer SaaS. Ercon and CCGROUP are test fixtures, never runtime defaults or special-case routing. All research plans, signal candidates, preview themes, company matching, buyer qualification and message context must derive from the active workspace\u2019s seller profile, confirmed offers, selected markets and activated reference models. Reference customers are separate from the seller identity. Do not copy one customer\u2019s industries, sales signals, buyer roles or scripts into another workspace. Unknown context must stay unknown or request input. Add cross-industry and name-invariance regression checks for changes in shared personalization logic. Protect workspace isolation and retain evidence gates.

## Report lifecycle and prevention checks

Apply the recurring-error controls in `docs/project-state/2026-10-01-report-deletion-and-prevention.md`. Authorized fixes require action, not acknowledgement-only responses. For saved artifacts inspect view, save/reload, export/print, individual/bulk deletion, cancellation and empty-state behavior. Deleting snapshots must preserve downstream source evidence and must not be undone by initialization or migration.

## In-app confirmations

Use `LeadIntelDialogs.confirm` for customer confirmations. Never introduce native browser `confirm`, `alert` or `prompt` popups or monkey-patch their synchronous APIs. Await the result before changing data, spending credits, activating automation or sending. Keep Cancel, Escape, focus restoration and context/race guards. Book deletion uses the explicit Delete book action. The runtime regression scan in `customer/test/confirmation-dialog.test.js` protects this standard.

## Step 5 is the current product priority

User instruction, 21 October 2026: Buyers research, qualification, confirmed company emails and usable downstream recipients are the top priority. Use `docs/policies/buyer-quality-supervisor.md`. Test completion and production freshness prove implementation state; they do not prove the requested contacts were obtained. Report research coverage, AI review coverage and usable contact outcomes separately. Never mark the whole step complete while its explicit quality requirements remain unmet.

## Shared research brief is mandatory

User instruction, 22 October 2026: Buyers and Messages must use one source-backed company research brief. Follow `docs/policies/shared-research-brief.md`. Show its compact summary above buyer cards; carry the same verified facts, source quotes, dates, selected-buyer role status, commercial hypotheses and evidence gaps into message personalization and CRM snapshots. Do not substitute an unsupported model summary for evidence or repeat completed research without a meaningful gap/freshness reason. Missing milestone/year fields must not erase other usable buyer context: use the expressly approved bounded factual opening variation. Preserve canonical masters and all saved/manual work; explicit replacement retains Undo. Verify the actual Buyers → Messages → CRM → reopen flow and cross-company isolation.

## Multilingual research and outreach

For language selection, Russian/Kazakh outreach, Kazakhstan research, translation or language persistence, use `.agents/skills/leadintel-multilingual-outreach/SKILL.md`. Preserve the protected core-template and release-integrity rules.

## Ask LeadIntel is advisory only

User instruction, 27 October 2026: Ask LeadIntel explains every journey step, diagnoses missing information and connections, checks quality, creates drafts and recommends solutions as a business mentor. It must never change code, interface elements, settings, workflows, processes, CRM records, approved templates or operational data, even when requested in chat. It must never send, approve, activate or execute. Use dedicated app controls for operational changes; chat history, memories and explicitly managed skills remain separate. Public website reads and research are permitted; retain actual execution receipts, sources, access gaps and uncertainty. Do not advertise book-created skills or paid contact enrichment inside Ask LeadIntel until those capabilities are genuinely connected and verified.

## Book-derived workspace skills

User-approved 27 October 2026: Content Library → Books and Skills. Up to three source books and thirty independent saved skills per workspace; zero to three relevant skills per answer. Turn to skill requires completed book analysis and confirmation. Skills must cover all readable source sections, retain honest coverage, survive book deletion and export as self-contained SKILL.md/reference packages. Never retrain or claim retraining of the underlying model. Workspace isolation, owner-only management, quota accounting, revision/lease guards, explicit deletion and protected master/advisory boundaries apply. Temporary source text is removed after successful generation. Skills used must come from validated supplied skill IDs, not model-invented attribution.
