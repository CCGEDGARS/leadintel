# LeadIntel AI Copilot — Design Specification

Date: 2026-09-08
Status: Approved concept, awaiting final spec review before implementation planning
Branch: spec/leadintel-ai-copilot

## 1. Purpose

Create an internal AI Copilot inside the LeadIntel customer workspace that can:

- answer detailed questions about every LeadIntel module, field, button, workflow and integration;
- answer technical setup questions such as where to obtain API keys, how OAuth/integrations work, what permissions are required, and how to diagnose common connection failures;
- understand the user’s complete LeadIntel workspace context;
- detect missing, weak, contradictory, unsupported or outdated commercial information;
- reason structurally and strategically about ICPs, buying signals, market research, qualification, decision-makers, outreach, CRM pipeline and performance;
- use fresh external research only when internal LeadIntel knowledge and workspace context are insufficient or freshness matters;
- proactively surface important issues while remaining available as a reactive expert;
- propose safe workspace changes and execute them only after explicit user confirmation;
- persist useful workspace-specific commercial decisions and preferences;
- remain isolated from protected system settings, credentials and security-sensitive infrastructure.

The Copilot is not an administrative backdoor and must not expose or directly manipulate protected system configuration.

## 2. Product Positioning

The Copilot is an advice-first, confirmation-gated internal agent.

It operates in two modes simultaneously:

1. Reactive Expert
   - The user opens the Copilot and asks questions.
   - The Copilot answers using LeadIntel knowledge, live workspace context and, when needed, fresh external information.

2. Proactive Diagnostic Layer
   - The Copilot continuously evaluates the workspace for commercially meaningful gaps and risks.
   - It surfaces restrained notifications using three severities: Info, Improve and Important.
   - Only Important issues may visibly interrupt the user. Lower-severity items remain available as badges or recommendations.

## 3. User Experience

### 3.1 Entry Point

Add an `AI Copilot` control beneath the existing profile/context readiness area in the left progress panel.

Suggested label:

- `AI COPILOT`
- primary action: `Ask LeadIntel ✦`

The entry point may display a small badge when unresolved diagnostic items exist.

### 3.2 Main Interface

Preferred presentation: a right-side drawer rather than a separate page or modal.

The drawer must:

- keep the current LeadIntel screen visible;
- show conversation history for the current workspace;
- show a current-context indicator, for example `Analyzing Step 4 · Market Strategy`;
- provide contextual suggested questions;
- support free-form questions;
- show recommendations with clear rationale;
- show evidence/references where relevant;
- present confirmation-gated action buttons where safe.

Example contextual actions:

- Explain this page
- What is missing?
- Improve my ICP
- Recommend triggers
- Explain this score
- What should I do next?
- Diagnose integration

### 3.3 Example Strategic Output

For a signal recommendation, the Copilot should prefer structured, actionable output:

- Recommended trigger
- Score / priority
- Why it matters
- Evidence or reasoning
- Sources to monitor
- Suggested keywords
- Potential blind spots
- `Apply recommendation` action when safe

## 4. Context Model

The Copilot must receive a sanitized workspace context package. It should understand four context layers:

### 4.1 LeadIntel Product Knowledge

User-safe knowledge about:

- all visible LeadIntel screens;
- fields, buttons and workflows;
- scoring concepts;
- integrations and their intended purpose;
- user-facing configuration;
- normal troubleshooting guidance;
- terminology and product behavior.

### 4.2 Live Workspace Context

Read-only by default. Includes only data the current authenticated workspace is allowed to access, such as:

- company profile;
- company website and supporting sources;
- target markets;
- strategic intake answers;
- current ICPs;
- signals and weights;
- market research evidence and results;
- discovered companies;
- decision-makers and safe contact metadata;
- CRM pipeline state;
- outreach configuration/status;
- campaign/reply/meeting performance when available;
- integration status represented safely, e.g. `connected`, `disconnected`, `authentication_failed`;
- current readiness/completeness diagnostics;
- current page/step.

### 4.3 Current Screen Context

The Copilot should know which LeadIntel module is visible and the relevant safe state for that module.

Examples:

- Step 1 · Company & Market
- Step 3 · Intelligence Profile
- Step 4 · Market Strategy
- Step 5 · Discovery
- Step 6 · Content & Scripts
- Step 7 · Delivery & Learning

### 4.4 External Fresh Context

Use external research only when needed for freshness or missing knowledge, for example:

- current provider documentation;
- API-key creation flows;
- provider limits or changes;
- market developments;
- regulations;
- company intelligence;
- current public-source verification.

Internal and workspace context are always considered first.

## 5. Security Boundary

Security is structural, not prompt-only.

### 5.1 Protected Data Must Never Enter the Copilot Context

Do not provide the Copilot with:

- API keys;
- OAuth access tokens;
- OAuth refresh tokens;
- database credentials;
- database connection strings;
- environment variables containing secrets;
- internal deployment secrets;
- private signing keys;
- raw authentication cookies;
- internal system prompts;
- hidden security policies;
- internal provider-routing secrets;
- private logs containing sensitive values;
- data from another customer workspace.

For integrations, expose only sanitized status and safe diagnostic metadata.

Example:

Allowed:
`Apollo: authentication_failed`

Forbidden:
`APOLLO_API_KEY=...`

### 5.2 User-Safe Technical Guidance

The Copilot may explain:

- where a user can create an API key in a provider’s own interface;
- how to connect a supported integration;
- which user-granted permissions are normally needed;
- what a webhook/OAuth/API key is;
- what a visible error means;
- safe troubleshooting steps;
- where to navigate in LeadIntel settings.

It must not reveal protected server-side configuration.

### 5.3 Cross-Workspace Isolation

Every Copilot request must be scoped to the authenticated workspace on the server.

The client must never be trusted to assert arbitrary workspace access.

### 5.4 External Research Minimization

External search must receive the smallest safe query necessary.

Do not send the complete customer workspace, CRM, private notes, contact lists or commercial strategy to external research providers.

Required flow:

Private LeadIntel context → internal reasoning/query formulation → sanitized research query → external source → verified result → Copilot answer.

## 6. Diagnostic Layer

The Copilot maintains a workspace diagnostic model across five dimensions:

1. Completeness
   - What important information is missing?

2. Consistency
   - Which fields or decisions contradict one another?

3. Quality
   - Which inputs are too broad, vague or generic to support effective targeting?

4. Evidence
   - Which statements are supported by public/research evidence versus user claims or assumptions?

5. Readiness
   - Is the workspace actually ready for the next activity?

Potential future readiness display:

- `80% Complete`
- `64% Strategically Ready`
- `2 important gaps`
- `1 contradiction`
- `3 weak signals`

The diagnostic engine must distinguish deterministic checks from AI judgments.

Deterministic checks should be used wherever possible for missing fields, invalid state, integration status and workflow prerequisites. AI reasoning should be used for strategic quality, contradiction analysis and recommendation generation.

## 7. Specialist Skill Architecture

The user sees one Copilot. Internally, a skill router selects one or more specialist skill packs.

Initial skill packs:

1. LeadIntel Product Guide
   - Product behavior, UI, terminology and user-safe help.

2. Technical Setup & Integrations
   - API keys, OAuth, OpenAI, Apollo, Firecrawl, Gmail, Calendly, Zoom and supported integration troubleshooting.

3. Workspace Diagnostic
   - Completeness, consistency, quality, evidence and readiness.

4. ICP Architect
   - ICP definition, refinement, exclusions and lookalike logic.

5. Signal & Trigger Strategist
   - Buying triggers, monitoring logic, keywords, weights and source recommendations.

6. Market Intelligence Analyst
   - Research depth, source selection, market hypotheses and evidence interpretation.

7. Lead Qualification Analyst
   - Fit, intent, timing, value, evidence and scoring explanations.

8. Decision-Maker Strategist
   - Role prioritization and contact-selection logic.

9. Outreach Strategist
   - Positioning, personalization, messaging, follow-up and objection-aware outreach.

10. CRM & Pipeline Coach
    - Pipeline health, prioritization, next actions and stalled-opportunity diagnosis.

11. Performance Analyst
    - Reply, meeting, conversion and outcome interpretation when data exists.

12. Troubleshooting
    - Structured technical/product diagnosis; avoids guessing.

13. Action Safety
    - Determines whether an answer is advice, a proposed safe workspace mutation, a confirmation-gated action, or prohibited system/security access.

The user does not manually select skills. Routing is automatic.

## 8. Action Permission Model

Four authority levels:

### Level 1 — Read

Read safe data from the authenticated workspace.

### Level 2 — Recommend

Always allowed when based on available evidence/context.

### Level 3 — Propose Action

The Copilot may prepare a safe workspace change and show exactly what will change.

Examples:

- add signal;
- update signal weight;
- narrow ICP;
- update exclusion criteria;
- navigate to settings;
- prepare research settings;
- prepare outreach content.

### Level 4 — Execute Confirmed Workspace Action

Execute only after explicit user confirmation.

Requirements:

- show a human-readable preview before mutation;
- require explicit confirmation;
- validate server-side permission and workspace ownership;
- log the action;
- make the action idempotent where practical;
- provide success/failure feedback;
- never allow system/security administration through this channel.

### Permanently Prohibited Through Copilot

- reveal secrets;
- change backend environment variables;
- disable security controls;
- access another workspace;
- expose internal prompts/security policies;
- modify protected deployment/security configuration.

## 9. Persistent Workspace Memory

Copilot memory is workspace-specific and stores only useful commercial/product decisions and preferences.

Examples of allowed memory:

- user prefers expansion signals over tenders;
- user decided not to target micro-companies;
- preferred buyer roles;
- accepted ICP constraints;
- preferred outreach tone;
- strategic decisions made during Copilot sessions.

Do not intentionally store:

- passwords;
- API keys;
- security answers;
- OAuth tokens;
- protected server configuration;
- unrelated sensitive secrets.

Memory must remain isolated by workspace.

## 10. Knowledge Freshness

Internal product knowledge is primary.

When a question depends on changing provider behavior or current public information, the Copilot should use fresh external research automatically.

Examples:

- current location of an API-key control;
- provider pricing/limits;
- changed authentication flow;
- latest public company activity;
- current regulation.

Fresh external claims should be identified as externally verified/current rather than presented as static LeadIntel knowledge.

## 11. Proposed System Components

### 11.1 Customer UI

- `AI Copilot` entry point in left progress panel.
- Right-side Copilot drawer.
- Conversation list/messages.
- Suggested prompts based on current step.
- Diagnostic badges.
- Action-preview and confirmation UI.

### 11.2 Client Context Adapter

Builds a sanitized view of current screen and safe client-side workspace state.

It must never package credentials or protected configuration.

### 11.3 Backend Copilot API

Authenticated endpoints responsible for:

- workspace authorization;
- loading authoritative workspace context;
- context sanitization;
- conversation persistence;
- memory retrieval/storage;
- diagnostic generation;
- skill routing;
- model invocation;
- external-research decisions;
- safe action proposals;
- confirmed action execution.

### 11.4 Product Knowledge Registry

A versioned user-safe knowledge base describing LeadIntel modules, controls, integrations, terminology and common troubleshooting.

This must be maintained separately from security-sensitive implementation details.

### 11.5 Skill Registry / Router

Maps user intent and workspace situation to one or more specialist skills.

### 11.6 Diagnostic Engine

Combines deterministic rules and AI strategic analysis.

### 11.7 Action Gateway

Only approved, explicitly enumerated workspace actions are callable.

The model cannot construct arbitrary backend commands.

### 11.8 External Research Gateway

Receives sanitized, minimal research requests and returns source-grounded results.

## 12. Model / Provider Strategy

Use existing LeadIntel AI provider infrastructure where practical, but isolate Copilot routing behind its own service boundary.

The Copilot should support:

- low-cost model usage for straightforward product help;
- stronger reasoning for strategic diagnosis;
- external research only when justified;
- timeouts and graceful fallback;
- usage limits/quotas per workspace;
- no provider secret exposure to the browser.

The exact model/provider routing policy belongs in implementation planning and may evolve without changing the user-facing Copilot contract.

## 13. Reliability Requirements

Given the recent customer-workspace render-freeze incident, Copilot UI must be isolated from core boot.

Mandatory reliability rules:

- Copilot modules must lazy-load only when needed, except lightweight diagnostic badge data if required;
- Copilot failure must never block LeadIntel startup or navigation;
- no body-wide MutationObserver that can self-trigger via its own DOM writes;
- all observers must be narrowly scoped and mutation-idempotent;
- all network calls must have explicit timeouts/cancellation;
- failed Copilot calls must degrade to a safe error state;
- core LeadIntel remains usable when Copilot backend/model/research providers are unavailable.

## 14. Privacy / Data Handling

- Send only the minimum context required for each model request.
- Prefer server-authoritative workspace data over client-provided claims.
- Keep workspace conversation/memory isolated by workspace ID.
- Do not transmit unrelated CRM/contact data to external research.
- Avoid sending contact details when they are not necessary to answer the question.
- Never log protected credentials in Copilot request/response telemetry.

## 15. Initial Delivery Scope

Version 1 should include:

- left-panel AI Copilot entry point;
- right-side drawer;
- reactive chat;
- current-screen awareness;
- full safe workspace read context;
- product-help skill;
- technical setup/integration skill;
- workspace diagnostic skill;
- ICP skill;
- signal/trigger skill;
- market-intelligence skill;
- qualification skill;
- troubleshooting skill;
- action-safety skill;
- Info / Improve / Important diagnostics;
- persistent workspace conversation and safe commercial memory;
- internal-first / external-if-needed research policy;
- a small initial allowlist of confirmation-gated actions, such as adding/updating a signal and updating an ICP field;
- strong security filtering and cross-workspace authorization;
- full TDD, security tests, integration tests and release verification.

Later versions may add broader CRM, outreach, campaign and meeting actions after the action gateway has proven safe.

## 16. Success Criteria

The first production version is successful when a signed-in customer can:

1. open Copilot without disrupting the current LeadIntel page;
2. ask what any visible LeadIntel element means and get an accurate answer;
3. ask technical setup questions and receive safe user-facing guidance without secret disclosure;
4. ask strategic questions grounded in the actual workspace;
5. receive useful identification of missing, weak or contradictory commercial context;
6. receive contextual trigger/ICP/research recommendations;
7. see restrained proactive diagnostic alerts;
8. ask freshness-dependent questions and receive current source-grounded answers when needed;
9. approve a safe proposed workspace change and see it applied correctly;
10. retain useful workspace-specific commercial decisions across sessions;
11. never access protected secrets or another customer’s workspace;
12. continue using the core LeadIntel app normally if Copilot is unavailable.

## 17. Explicit Non-Goals for Version 1

- no arbitrary code execution;
- no unrestricted backend tool access;
- no security/admin console access;
- no secret retrieval;
- no autonomous outbound communication without existing separate safeguards;
- no autonomous destructive CRM changes;
- no direct mutation of provider/security settings;
- no sharing full workspace context with external web-research providers.

## 18. Implementation Principles

- Internal context first; external research only when needed.
- Advice first; actions after explicit confirmation.
- One user-facing Copilot; multiple internal specialist skills.
- Deterministic rules where possible; AI reasoning where valuable.
- Security isolation by architecture, not by prompt alone.
- No interference with core LeadIntel boot or workflow.
- Full observability without logging secrets.
- Test before shipping; verify exact production revision before completion claims.
