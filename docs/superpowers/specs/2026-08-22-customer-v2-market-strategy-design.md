# LeadIntel Customer V2 Market Strategy Design

## Goal
Turn an approved Company Intelligence Profile into an evidence-backed commercial strategy layer that defines target ICPs, researches priority markets, ranks market opportunity hypotheses, and lets the customer configure the signals LeadIntel should monitor.

## Scope
This milestone adds Step 4 to `/customer/`. It does not yet discover named target companies or send outreach. It prepares the strategic operating configuration that the later Discovery Engine will consume.

## Customer flow
1. Approve Company Intelligence Profile.
2. Continue to Market Strategy.
3. Review AI-generated ICP candidates.
4. Review/edit the Signal Designer.
5. Run live market research through the existing Firecrawl proxy.
6. Review evidence-backed market opportunity hypotheses.
7. Activate the strategy as the current source of truth for discovery.

## Market Opportunity Engine
- Use no more than four Firecrawl search requests per manual research run.
- Queries are derived from approved target markets, priority offers, ICP language and active signals.
- Public search failures must not block the strategy; they reduce Evidence score and remain visible.
- Normalize returned sources into title, URL, description/text and optional date.
- Produce market-level hypotheses, not fabricated company leads.
- Score every hypothesis on five transparent 0–20 dimensions: Fit, Intent, Timing, Value and Evidence. Total score is 0–100.
- Opportunity cards show rationale, score components, evidence count, source links and confidence.

## ICP Engine
Generate up to three editable ICP candidates:
1. Core ICP — direct interpretation of ideal-customer, buyer-role, market, value and exclusion inputs.
2. Lookalike ICP — generated only when lookalike customers are supplied.
3. Trigger-led ICP — focuses on organizations showing declared or recommended buying signals.
Each ICP has an active flag and explains why it was created.

## Signal Designer
- Seed from the Company Intelligence Profile recommended signals.
- Each signal has id, name, active flag, priority, weight 1–10, keywords and reason.
- User can activate/deactivate, edit weight/keywords/name, and add custom signals.
- Duplicate custom signals are rejected by normalized name.
- Strategy activation stores the signal configuration used by later discovery.

## State
Add a separate `market` object to customer browser state so the existing onboarding normalizer remains stable. Persist:
- `icps`
- `signals`
- `researchQueries`
- `researchResults`
- `opportunities`
- `researchStatus`
- `lastResearchAt`
- `strategyApproved`
- `strategyApprovedAt`

## Research cost guard
A single click may issue at most four searches with at most five results each. Reruns require another explicit user click. No background polling is introduced in this milestone.

## Safety and evidence rules
- Never invent a market fact, source, company or event.
- Profile-only hypotheses must be labeled as such when live evidence is unavailable.
- Public search evidence may support a hypothesis but does not prove a named prospect is qualified.
- Strategic questionnaire answers remain authoritative over inferred public positioning.
- No personal contact data is collected in this milestone.

## UI
Step 4 contains four sections in this order:
1. Strategy summary and activation state.
2. ICP Engine.
3. Signal Designer.
4. Market Opportunity Engine with Run/Rerun research control and evidence-backed opportunity cards.
The left progress rail changes from “Next modules” to show Market Strategy as the active fourth stage and Discovery & CRM as the next future module.

## Verification
- Pure market-engine functions have Node tests.
- Structural tests verify Step 4, ICP, Signal Designer, research controls and strategy activation.
- Existing onboarding tests continue to pass.
- JavaScript syntax checks include `market-engine.js`.
- Legacy `/v2/` files remain untouched.
