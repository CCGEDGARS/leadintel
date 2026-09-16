# Step 2 Commercial Intelligence Brief Design

## Decision

Step 2 becomes the **Commercial Intelligence Brief**: one reviewable set of commercial decisions used by Targeting, Buying Signals, and Campaign Studio.

It remains an evidence-first enrichment step. LeadIntel drafts what it can support, labels hypotheses separately, and leaves unsupported decisions open for the user. A user may edit or replace every answer. Existing user-authored text is never silently overwritten.

## Information architecture

The ten questions are grouped by their downstream purpose instead of appearing as an undifferentiated questionnaire.

### Targeting · four decisions

1. **What product or service is the current commercial priority?**  
   Field: `priority_offers`  
   Used by: offer selection, Discovery queries, scoring, Campaign Studio.

2. **What does the best-fit customer look like?**  
   Field: `ideal_customer`  
   Guidance covers industries, company types, size, geography, maturity, and priority segments inside the Step 1 markets.  
   Used by: ICP, Discovery, scoring, campaign segment.

3. **Who makes or strongly influences the buying decision?**  
   Field: `buyer_roles`  
   Used by: contact search, recipient selection, message framing.

4. **What makes a prospect unsuitable or impossible to serve?**  
   Field: `exclusions`  
   Used by: negative ICP rules, filtering, suppression, scoring.

### Buying Signals · two decisions

5. **What problem or desired result creates demand for this offer?**  
   Field: `buying_outcomes`  
   Used by: need-state interpretation, signal relevance, campaign problem/outcome language.

6. **What observable event indicates that this demand may exist now?**  
   Field: `buying_triggers`  
   Used by: Signal Designer, monitoring, Why Now evidence, outreach hooks.

### Commercial Message · four decisions

7. **How does the offer help the customer solve that problem or achieve that result?**  
   Field: `value_proposition`  
   Used by: Core Outreach Scenario and message body.

8. **Why should the customer choose this company instead of an alternative?**  
   Field: `differentiation`  
   Used by: positioning, comparison, objection handling.

9. **What evidence may LeadIntel safely mention?**  
   Field: `proof_points`  
   Guidance covers named cases only when public or user-approved, certifications, quantified results, delivery record, expertise, and verified references.  
   Used by: credibility statements and proof-led follow-ups.

10. **What objections or concerns commonly prevent the customer from proceeding?**  
    Field: `objections`  
    Used by: objection responses, follow-ups, and call preparation.

Tone, email language, and call to action remain in Campaign Studio because they may change by campaign, segment, market, and channel.

## Evidence and review states

Each field has one of four explicit states:

- `evidence_draft`: supported by cited first-party or authoritative evidence;
- `hypothesis_draft`: useful AI inference that must not be represented as fact;
- `accepted`: reviewed and approved by the user;
- `user`: entered or materially edited by the user.

An empty unsupported field remains blank and displays concise guidance. The interface must not show a populated textarea while simultaneously describing it as unanswered.

Research may normally produce evidence drafts for offers, customer types, buyer roles, outcomes, value proposition, differentiation, and proof. Triggers and objections may be hypotheses unless explicitly supported. Exclusions require direct evidence or user input; LeadIntel must not invent disqualifiers.

## Downstream contract

The approved Company Intelligence Profile exposes these canonical values:

- `priorityOffers`
- `idealCustomer`
- `decisionMakers`
- `exclusions`
- `customerPainPoints`
- `buyingTriggers`
- `valueProposition`
- `differentiation`
- `proofPoints`
- `commonObjections`

Targeting consumes offer, customer, roles, exclusions, outcomes, and differentiation. Signal Designer consumes customer, exclusions, outcomes, and triggers. Campaign Studio consumes offer, segment, buyer role, trigger, outcome, value proposition, differentiation, proof, and objections.

Campaign Studio may adapt approved facts to a selected channel and language, but it may not create unsupported proof, numerical results, customer names, certifications, guarantees, or claims.

## Migration and preservation

Existing workspace data is migrated without destructive reinterpretation:

- `priority_offers`, `ideal_customer`, `buyer_roles`, `exclusions`, `buying_triggers`, and `differentiation` keep their current values and review status.
- Any existing `buying_outcomes` value becomes the new Question 5 answer.
- `growth_markets` is preserved as legacy strategy context. It may supplement an empty `ideal_customer` draft for review, but it must not silently overwrite an accepted or user-authored ideal customer.
- `lookalike_customers` remains handled by Reference Customers and is not returned to Step 2.
- `opportunity_value` moves to advanced opportunity-scoring settings.
- `success_outcome` moves to workspace goals.
- New `value_proposition`, `proof_points`, and `objections` fields begin as research drafts, hypotheses, or blank fields. Existing differentiation must not be copied into them as if it answered a different question.

The migration is idempotent and schema-versioned. Loading the same workspace repeatedly must not duplicate text, change acceptance state, or erase legacy data.

## User experience

The Step 2 hero reads **Build your Commercial Intelligence Brief** and explains that one approved brief powers targeting, signals, and campaigns.

The page shows three section headers with progress counts:

- Targeting · `x/4 reviewed`
- Buying Signals · `x/2 reviewed`
- Commercial Message · `x/4 reviewed`

Research completion and source coverage remain visible above the sections. Each card retains evidence, confidence, source links, Accept, and Clear controls. The final action becomes **Build / refresh intelligence profile**.

Step 2 remains skippable as optional enrichment. Missing answers reduce readiness and produce visible gaps, but do not trap the user. Campaign approval remains stricter: the mandatory Core Outreach Scenario must be complete and reviewed before delivery.

## Error and safety behavior

- A failed research request preserves all current answers and statuses.
- Rerunning research never overwrites `accepted` or `user` content.
- Evidence drafts retain their source references through reload and workspace synchronization.
- Hypotheses are never presented as verified evidence.
- Removing or materially changing an approved answer invalidates dependent Campaign Studio approval and marks the Core Outreach Scenario `needs_review`.
- Delivery remains blocked until the resulting campaign package is explicitly approved.

## Verification

Tests must prove:

1. the ten visible questions and three groups match this design;
2. all canonical field IDs persist through save, reload, and server synchronization;
3. migration preserves every legacy value without overwriting user content;
4. research distinguishes evidence drafts from hypotheses and blanks;
5. Targeting, Signal Designer, Company Intelligence Profile, and Campaign Studio consume the new fields correctly;
6. profile changes invalidate dependent campaign approval;
7. localization preserves facts, proof, numbers, names, URLs, and placeholders;
8. the full Customer test suite and production build pass.

