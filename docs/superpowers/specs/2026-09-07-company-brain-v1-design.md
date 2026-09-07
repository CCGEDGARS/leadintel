# Company Brain v1 Design

## Purpose

Upgrade LeadIntel Step 3 from keyword/template inference into an evidence-grounded company understanding layer that produces commercially coherent company identity, customer pains, frameworks and buying signals before Market Research starts.

## Problem statement

The current Step 3 pipeline can generate false commercial conclusions from isolated keywords and generic defaults. The observed CCGROUP case demonstrates three concrete failures:

1. The Latvian phrase meaning "digital tools" contains the token `instrument`, which matches warehouse/tool-storage regexes and creates warehouse pain points that do not fit a sales-training/consulting company.
2. Facility expansion, capital investment, tender/procurement and market-entry are injected as default signals even when the source evidence does not justify them.
3. Golden Circle/FAB sections are assembled from deterministic templates before the business model has been semantically classified, so one bad heuristic can contaminate multiple outputs.

There is also a presentation issue: generated output can mix Latvian and English because source text, UI language and generated template language are not normalized through one presentation layer.

## Goals

Company Brain v1 must:

- classify the company before generating commercial inferences;
- separate evidence-backed facts from AI/heuristic inferences and unknowns;
- stop generic B2B signals from appearing as recommendations without evidence;
- make customer pains and commercial frameworks depend on company type and evidence, not isolated keyword hits;
- support automatic discovery of relevant first-party pages beyond the homepage;
- keep all generated presentation text in the selected UI language while preserving evidence excerpts in their original language;
- preserve current Step 3 UI structure where possible so this is an intelligence-layer upgrade, not a visual redesign.

## Non-goals for v1

- Rebuilding the entire Market Research subsystem.
- Adding Apollo enrichment to Step 3.
- Replacing Firecrawl.
- Introducing a new database schema.
- Making inferred claims appear as confirmed facts.

## Architecture

### 1. Source collection

Input remains:

- primary website;
- automatically discovered first-party pages;
- manually supplied additional URLs;
- uploaded PDFs;
- questionnaire answers;
- selected target markets.

For the primary website, LeadIntel should discover and prioritize internal pages representing these source roles when available:

- company/about;
- offers/services/products;
- proof/case studies/clients;
- delivery/method/how-we-work;
- contact/team.

The crawler must remain bounded. v1 should add at most 8 automatically discovered first-party pages and deduplicate canonical URLs.

### 2. Business classification

Before commercial inference, create a deterministic `CompanyClassification` object:

```js
{
  businessType: "professional-services" | "software" | "manufacturer" | "distributor" | "retail" | "other",
  industries: string[],
  offerCategories: string[],
  likelyBuyerFunctions: string[],
  evidence: EvidenceRef[],
  confidence: "high" | "medium" | "low"
}
```

Classification must use contextual phrases and positive evidence. A single broad noun such as `instrument`, `tool`, `office`, or `training` must never be sufficient on its own to classify the company.

### 3. Claim model

Every generated commercial conclusion should be representable as:

```js
{
  value: string,
  status: "confirmed" | "inferred" | "unknown",
  confidence: "high" | "medium" | "low",
  evidenceIds: string[]
}
```

User-entered questionnaire facts are `confirmed`. Direct first-party source claims can be `confirmed` when the statement is a factual company attribute. Commercial interpretations are `inferred` unless explicitly supplied by the user. Missing information is `unknown`.

### 4. Customer pain generation

Pain generation must first branch by `businessType` and `offerCategories`. Generic cross-industry heuristics may only add a pain when there is strong contextual evidence.

For professional services / training / coaching / consulting, supported pain families include:

- inconsistent sales or leadership execution;
- capability gaps across sales/management/communication;
- weak onboarding or adoption of sales methodology;
- fragmented/inefficient commercial processes;
- need to integrate AI into sales/business workflows;
- weak prospecting, conversion or market-entry execution when supported.

Warehouse/storage pains require explicit warehouse/storage/workshop context and cannot be triggered by the token `instrument` alone.

### 5. Signal recommendation engine

Remove unconditional signal defaults.

Signals are recommended when either:

- questionnaire buying-trigger input explicitly supports them; or
- source/classification evidence reaches a minimum relevance threshold.

Each signal stores a reason that references the evidence or business logic that caused it to be recommended. Tenders/procurement are excluded unless explicitly evidenced or enabled by the user.

For professional-services/sales-training companies, candidate signals may include:

- new Sales/Commercial Director;
- rapid sales-team hiring;
- sales transformation/restructuring;
- CRM/AI/sales-tech implementation;
- new-market expansion;
- product/service launch requiring enablement;
- merger/acquisition integration;
- leadership-development initiative.

These are candidates, not defaults; they appear only when the company classification makes them relevant.

### 6. Commercial frameworks

Golden Circle, FAB and Value Proposition must consume the Company Brain claim model rather than raw regex output.

- `Why` uses confirmed desired outcomes or company-type-aware inferred customer outcomes.
- `How` uses confirmed differentiation, method and proof.
- `What` uses confirmed priority offers / service categories.
- FAB Features = offers/capabilities.
- FAB Advantages = differentiators/method/proof.
- FAB Benefits = customer outcomes.

If a field lacks support, show a clear unknown/review-needed value rather than inventing specificity.

### 7. Language consistency

Generated presentation text must always use `contentLanguage()` / selected UI language. Evidence excerpts remain source-language text and are visibly evidence, not generated copy.

The Company Brain stores language-neutral structural fields where practical and localizes labels/copy at render time.

## Data flow

```text
Website + questionnaire + PDFs
        ↓
Source discovery + scrape
        ↓
Evidence normalization / page-role classification
        ↓
Company classification
        ↓
Company Brain claims
        ↓
Customer pains + signals + Golden Circle/FAB/value proposition
        ↓
User review / edit / confirm
        ↓
Approved company profile
        ↓
Market Scan / Market Research / Market Intelligence
```

## Compatibility

- Existing saved workspaces must continue to load.
- Existing `profile` fields remain available for current Step 4 consumers.
- New classification/claim metadata is additive.
- Existing Firecrawl proxy remains the source-collection transport.

## Error handling

- If automatic internal-page discovery fails, continue with the homepage and manually supplied sources.
- If classification confidence is low, do not invent a specific business type; use `other` and mark relevant conclusions for review.
- If source text is contradictory, prefer user-confirmed questionnaire inputs and surface the conflict as an intelligence gap.
- If no evidence supports a signal, omit it rather than returning a generic default.

## Acceptance criteria

1. A CCGROUP-style professional-services site containing the phrase `digital tools` must not produce warehouse/storage customer pains.
2. Generic facility-expansion/capex/tender signals must not be present by default.
3. Tender appears only when procurement/tender evidence or explicit user input supports it.
4. Professional-services classification can produce professional-services-appropriate pain and signal families.
5. Golden Circle/FAB use business classification plus confirmed/inferred claim state rather than raw keyword-only inference.
6. All generated Step 3 presentation copy follows the selected UI language.
7. Homepage failure does not crash Step 3; analysis degrades gracefully.
8. Existing saved workspaces load without migration failure.
9. Customer CI and JavaScript syntax checks pass.
