# Step 2 Commercial Intelligence Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed Step 2 questionnaire with a safe, evidence-first Commercial Intelligence Brief that powers targeting, buying signals, and Campaign Studio.

**Architecture:** Keep the existing browser-first state and runtime patch architecture, but establish ten canonical Step 2 field IDs across the base profile engine, readiness patch, research engine, and UI. Add a schema-versioned, idempotent migration that preserves retired values outside the visible questionnaire, then map the approved brief into Company Intelligence Profile and Campaign Studio without inventing claims.

**Tech Stack:** Static HTML/CSS, browser JavaScript modules, Node.js built-in test runner, Vercel static deployment.

**Spec:** `docs/superpowers/specs/2026-09-16-step2-commercial-intelligence-brief-design.md`

## Global Constraints

- Canonical visible fields are exactly `priority_offers`, `ideal_customer`, `buyer_roles`, `exclusions`, `buying_outcomes`, `buying_triggers`, `value_proposition`, `differentiation`, `proof_points`, and `objections`.
- Existing `accepted` and `user` content must never be overwritten by research or migration.
- `growth_markets`, `opportunity_value`, and `success_outcome` remain preserved in dedicated legacy/advanced state; `lookalike_customers` remains owned by Reference Customers.
- Evidence drafts and AI hypotheses must remain visibly distinct.
- Tone, language, and call to action remain Campaign Studio controls.
- Campaign Studio may not create unsupported proof, numbers, customer names, certifications, guarantees, or claims.
- All migration operations must be schema-versioned and idempotent.
- Do not stage or commit unrelated dirty-worktree changes.

---

## File Structure

- `customer/step2-brief-schema.js`: canonical field IDs, groups, migration, and downstream-safe value helpers.
- `customer/profile-engine.js`: base profile normalization and canonical profile output.
- `customer/step2-readiness-engine.js`: runtime readiness, statuses, profile/research patches, and field quality rules.
- `customer/company-research-engine.js`: evidence and hypothesis draft contract and AI prompt.
- `customer/company-research-ui.js`: review-state rendering and rerun preservation.
- `customer/index.html`: grouped Step 2 cards and module loading.
- `customer/company-research.css`: section layout and progress presentation.
- `customer/outreach-engine.js`: Core Outreach Scenario and fingerprint consumption.
- `customer/test/step2-commercial-brief.test.js`: schema, migration, grouping, and profile contract tests.
- Existing Step 2, research, profile, campaign, localization, and workspace tests: regression coverage.

---

### Task 1: Canonical schema and lossless migration

**Files:**
- Create: `customer/step2-brief-schema.js`
- Create: `customer/test/step2-commercial-brief.test.js`
- Modify: `customer/index.html`
- Modify: `customer/profile-engine.js`
- Modify: `customer/step2-readiness-engine.js`

**Interfaces:**
- Produces: `LeadIntelStep2Brief.FIELD_IDS`, `GROUPS`, `SCHEMA_VERSION`, `migrateState(state)`, and `profileFields(answers)`.
- Consumes: legacy `state.answers`, `state.answerStatus`, `state.profile`, and `state.referenceCustomers`.

- [ ] **Step 1: Write failing schema and migration tests**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const Brief=require('../step2-brief-schema.js');

test('Commercial Intelligence Brief exposes ten fields in three groups',()=>{
  assert.deepEqual(Brief.GROUPS.map(group=>[group.id,group.fields.length]),[
    ['targeting',4],['signals',2],['message',4]
  ]);
  assert.deepEqual(Brief.FIELD_IDS,[
    'priority_offers','ideal_customer','buyer_roles','exclusions',
    'buying_outcomes','buying_triggers','value_proposition',
    'differentiation','proof_points','objections'
  ]);
});

test('migration preserves canonical and retired commercial data without reinterpretation',()=>{
  const current={answers:{
    ideal_customer:'Approved manufacturers',growth_markets:'Furniture distributors',
    opportunity_value:'€20,000+',success_outcome:'20 qualified leads',
    differentiation:'Certified installation'
  },answerStatus:{ideal_customer:'accepted',differentiation:'user'}};
  const once=Brief.migrateState(current);
  const twice=Brief.migrateState(once);
  assert.equal(once.answers.ideal_customer,'Approved manufacturers');
  assert.equal(once.answerStatus.ideal_customer,'accepted');
  assert.equal(once.answers.differentiation,'Certified installation');
  assert.equal(once.legacyStrategyContext.growthMarkets,'Furniture distributors');
  assert.equal(once.advancedScoring.opportunityValue,'€20,000+');
  assert.equal(once.workspaceGoals.successOutcome,'20 qualified leads');
  assert.deepEqual(twice,once);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test customer/test/step2-commercial-brief.test.js`

Expected: FAIL because `customer/step2-brief-schema.js` does not exist.

- [ ] **Step 3: Implement the canonical schema and migration**

```js
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LeadIntelStep2Brief=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA_VERSION=3;
  const GROUPS=Object.freeze([
    {id:'targeting',label:'Targeting',fields:['priority_offers','ideal_customer','buyer_roles','exclusions']},
    {id:'signals',label:'Buying Signals',fields:['buying_outcomes','buying_triggers']},
    {id:'message',label:'Commercial Message',fields:['value_proposition','differentiation','proof_points','objections']}
  ]);
  const FIELD_IDS=Object.freeze(GROUPS.flatMap(group=>group.fields));
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  function migrateState(input={}){
    const state={...input,answers:{...(input.answers||{})},answerStatus:{...(input.answerStatus||{})}};
    state.legacyStrategyContext={...(input.legacyStrategyContext||{}),growthMarkets:clean(input.legacyStrategyContext?.growthMarkets||state.answers.growth_markets)};
    state.advancedScoring={...(input.advancedScoring||{}),opportunityValue:clean(input.advancedScoring?.opportunityValue||state.answers.opportunity_value)};
    state.workspaceGoals={...(input.workspaceGoals||{}),successOutcome:clean(input.workspaceGoals?.successOutcome||state.answers.success_outcome)};
    const answers={};const answerStatus={};
    for(const id of FIELD_IDS){answers[id]=clean(state.answers[id]);answerStatus[id]=answers[id]?String(state.answerStatus[id]||'user'):'missing';}
    state.answers=answers;state.answerStatus=answerStatus;state.step2BriefSchemaVersion=SCHEMA_VERSION;
    return state;
  }
  function profileFields(answers={}){
    return {
      priorityOffers:clean(answers.priority_offers),idealCustomer:clean(answers.ideal_customer),decisionMakers:clean(answers.buyer_roles),
      exclusions:clean(answers.exclusions),customerPainPoints:clean(answers.buying_outcomes),buyingOutcomes:clean(answers.buying_outcomes),
      buyingTriggers:clean(answers.buying_triggers),valueProposition:clean(answers.value_proposition),differentiation:clean(answers.differentiation),
      proofPoints:clean(answers.proof_points),commonObjections:clean(answers.objections)
    };
  }
  return {SCHEMA_VERSION,GROUPS,FIELD_IDS,migrateState,profileFields};
});
```

- [ ] **Step 4: Load the schema before readiness/profile initialization and adopt it**

Add a versioned script before `step2-readiness-engine.js` in `customer/index.html`:

```html
<script src="./step2-brief-schema.js?v=20260916-commercial-brief-v1"></script>
```

Replace duplicated field lists with `LeadIntelStep2Brief.FIELD_IDS` where browser load order permits and the identical CommonJS export in tests. Normalize saved state by calling `LeadIntelStep2Brief.migrateState(normalized)` after base normalization.

- [ ] **Step 5: Run focused schema/profile tests**

Run: `node --test customer/test/step2-commercial-brief.test.js customer/test/profile-engine.test.js customer/test/step2-readiness.test.js`

Expected: PASS.

- [ ] **Step 6: Commit only Task 1 files**

```bash
git add customer/step2-brief-schema.js customer/test/step2-commercial-brief.test.js customer/index.html customer/profile-engine.js customer/step2-readiness-engine.js
git commit -m "Add Step 2 commercial brief schema"
```

---

### Task 2: Evidence drafts, hypotheses, and protected reruns

**Files:**
- Modify: `customer/company-research-engine.js`
- Modify: `customer/step2-readiness-engine.js`
- Modify: `customer/company-research-ui.js`
- Modify: `customer/test/company-research-engine.test.js`
- Modify: `customer/test/step2-readiness.test.js`
- Modify: `customer/test/step2-research-handoff.test.js`

**Interfaces:**
- Consumes: canonical `FIELD_IDS`, research sources, current answers, and prior field metadata.
- Produces: field metadata with `origin: evidence_draft | hypothesis_draft | needs-input | user`, `draftValue`, `confidence`, `sourceIds`, `rationale`, and `reviewed`.

- [ ] **Step 1: Write failing research-state tests**

```js
test('research distinguishes cited evidence from uncited hypotheses',()=>{
  const parsed=Research.parseAiDraft(JSON.stringify({fields:{
    proof_points:{value:'ISO 9001 certified',confidence:'high',source_ids:['S1'],rationale:'Certification page'},
    objections:{value:'Concern about implementation time',confidence:'low',source_ids:[],rationale:'Likely buyer concern'}
  }}),['S1']);
  assert.equal(parsed.proof_points.draftType,'evidence');
  assert.equal(parsed.objections.draftType,'hypothesis');
});

test('rerun preserves accepted and user answers while replacing unreviewed drafts',()=>{
  const merged=Research.mergeDraft(
    {proof_points:'Approved proof',objections:'Old hypothesis',value_proposition:'User value'},
    {proof_points:{value:'New proof'},objections:{value:'New hypothesis'},value_proposition:{value:'AI value'}},
    {proof_points:{origin:'evidence_draft',reviewed:true},objections:{origin:'hypothesis_draft',reviewed:false},value_proposition:{origin:'user',reviewed:true}}
  );
  assert.equal(merged.answers.proof_points,'Approved proof');
  assert.equal(merged.answers.objections,'New hypothesis');
  assert.equal(merged.answers.value_proposition,'User value');
});
```

- [ ] **Step 2: Run research tests and verify RED**

Run: `node --test customer/test/company-research-engine.test.js customer/test/step2-readiness.test.js customer/test/step2-research-handoff.test.js`

Expected: FAIL because new fields and draft types are absent.

- [ ] **Step 3: Update the AI schema and prompt**

Use the canonical ten fields and require an explicit `draft_type`:

```js
const shape={fields:Object.fromEntries(FIELD_IDS.map(id=>[id,{
  value:'',confidence:'high|medium|low',draft_type:'evidence|hypothesis',source_ids:['S1'],rationale:'brief reason'
}]))};
```

The prompt must state:

```text
Use draft_type "evidence" only when source_ids directly support the returned claim. Use "hypothesis" for useful inferred buying triggers or objections with no direct support. Never infer exclusions. Never invent customer names, certifications, numerical outcomes, prices, guarantees, or proof. Leave unsupported factual fields empty.
```

- [ ] **Step 4: Implement draft origin and merge protection**

Map cited evidence to `evidence_draft`, uncited allowed inference to `hypothesis_draft`, and empty values to `needs-input`. Preserve rows where the previous metadata is `reviewed` or the origin is `user`; replace only unreviewed draft origins.

```js
const replaceDraft=['evidence_draft','hypothesis_draft','research'].includes(previous?.origin)&&!previous?.reviewed;
const origin=row.draftType==='hypothesis'?'hypothesis_draft':'evidence_draft';
```

- [ ] **Step 5: Update review rendering and status derivation**

Render separate badges:

```js
const label=row.origin==='hypothesis_draft'?'AI hypothesis':'Evidence-backed draft';
```

Both draft types require Accept. `accepted` and `user` content must survive reload, synchronization, and rerun.

- [ ] **Step 6: Run focused research tests**

Run: `node --test customer/test/company-research-engine.test.js customer/test/company-research-security.test.js customer/test/company-research-structure.test.js customer/test/step2-readiness.test.js customer/test/step2-research-handoff.test.js`

Expected: PASS.

- [ ] **Step 7: Commit only Task 2 files**

```bash
git add customer/company-research-engine.js customer/step2-readiness-engine.js customer/company-research-ui.js customer/test/company-research-engine.test.js customer/test/step2-readiness.test.js customer/test/step2-research-handoff.test.js customer/test/company-research-structure.test.js
git commit -m "Add evidence states to Step 2 research"
```

---

### Task 3: Grouped Step 2 interface and readiness progress

**Files:**
- Modify: `customer/index.html`
- Modify: `customer/company-research.css`
- Modify: `customer/step2-readiness-engine.js`
- Modify: `customer/test/company-research-structure.test.js`
- Modify: `customer/test/premium-ux-redesign.test.js`
- Modify: `customer/test/ux-upgrade.test.js`

**Interfaces:**
- Consumes: `LeadIntelStep2Brief.GROUPS` and current answer statuses.
- Produces: three visible brief sections and `x/n reviewed` progress labels.

- [ ] **Step 1: Write failing structure tests**

```js
test('Step 2 is grouped as a Commercial Intelligence Brief',()=>{
  assert.match(html,/Build your Commercial Intelligence Brief/);
  assert.match(html,/data-brief-group="targeting"/);
  assert.match(html,/data-brief-group="signals"/);
  assert.match(html,/data-brief-group="message"/);
  for(const id of Brief.FIELD_IDS)assert.match(html,new RegExp(`data-question="${id}"`));
  for(const retired of ['growth_markets','lookalike_customers','opportunity_value','success_outcome'])assert.doesNotMatch(html,new RegExp(`data-question="${retired}"`));
});
```

- [ ] **Step 2: Run structure tests and verify RED**

Run: `node --test customer/test/company-research-structure.test.js customer/test/premium-ux-redesign.test.js customer/test/ux-upgrade.test.js`

Expected: FAIL on the old hero, retired fields, and missing groups.

- [ ] **Step 3: Replace the Step 2 HTML with the approved groups and copy**

Use three `<section class="brief-question-group" data-brief-group="…">` blocks. Each header contains a title, short purpose, and progress node such as:

```html
<header class="brief-group-header">
  <div><span class="eyebrow">Targeting</span><h2>Define who LeadIntel should find.</h2></div>
  <strong data-brief-progress="targeting">0/4 reviewed</strong>
</header>
```

Add one card for each canonical question in the order established by the spec. Do not add CTA, tone, or email-language controls to Step 2.

- [ ] **Step 4: Add responsive group styling**

```css
.brief-question-group{margin-top:28px;padding:24px;border:1px solid var(--line);border-radius:24px;background:var(--surface)}
.brief-group-header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px}
.brief-group-header [data-brief-progress]{white-space:nowrap;font:700 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
@media(max-width:760px){.brief-question-group{padding:18px}.brief-group-header{align-items:flex-start;flex-direction:column;gap:8px}}
```

- [ ] **Step 5: Render reviewed counts from status state**

Count `accepted` and `user` answers as reviewed; drafts and missing fields remain unreviewed.

```js
for(const group of LeadIntelStep2Brief.GROUPS){
  const reviewed=group.fields.filter(id=>['accepted','user'].includes(statuses[id])).length;
  const node=root.document.querySelector(`[data-brief-progress="${group.id}"]`);
  if(node)node.textContent=`${reviewed}/${group.fields.length} reviewed`;
}
```

- [ ] **Step 6: Run UI tests**

Run: `node --test customer/test/company-research-structure.test.js customer/test/premium-ux-redesign.test.js customer/test/ux-upgrade.test.js customer/test/step2-readiness.test.js`

Expected: PASS.

- [ ] **Step 7: Commit only Task 3 files**

```bash
git add customer/index.html customer/company-research.css customer/step2-readiness-engine.js customer/test/company-research-structure.test.js customer/test/premium-ux-redesign.test.js customer/test/ux-upgrade.test.js
git commit -m "Redesign Step 2 as a grouped brief"
```

---

### Task 4: Connect the brief to profile, signals, and Campaign Studio

**Files:**
- Modify: `customer/profile-engine.js`
- Modify: `customer/step2-readiness-engine.js`
- Modify: `customer/outreach-engine.js`
- Modify: `customer/test/profile-engine.test.js`
- Modify: `customer/test/campaign-studio.test.js`
- Modify: `customer/test/outreach-engine.test.js`
- Modify: `customer/test/content-language.test.js`

**Interfaces:**
- Consumes: the canonical profile fields produced by `LeadIntelStep2Brief.profileFields(answers)`.
- Produces: targeting-ready profile, signal context, Core Outreach Scenario context, and approval fingerprint invalidation.

- [ ] **Step 1: Write failing downstream-contract tests**

```js
test('approved brief fields enter the Company Intelligence Profile',()=>{
  const profile=Profile.buildCompanyIntelligenceProfile({website:'https://example.com',targetMarkets:['Sweden'],answers:{
    priority_offers:'Installation',ideal_customer:'Manufacturers',buyer_roles:'Operations Director',exclusions:'Private consumers',
    buying_outcomes:'Reduce downtime',buying_triggers:'New production line',value_proposition:'Fast installation with limited disruption',
    differentiation:'Certified specialists',proof_points:'ISO 9001; 120 completed projects',objections:'Implementation downtime'
  }});
  assert.equal(profile.valueProposition,'Fast installation with limited disruption');
  assert.equal(profile.proofPoints,'ISO 9001; 120 completed projects');
  assert.equal(profile.commonObjections,'Implementation downtime');
});

test('Core Outreach Scenario uses value proposition and fingerprint covers proof and objections',()=>{
  const profile={idealCustomer:'Manufacturers',priorityOffers:'Installation',decisionMakers:'Operations Director',buyingTriggers:'New line',valueProposition:'Fast installation',proofPoints:'ISO 9001',commonObjections:'Downtime'};
  const scenario=Outreach.buildCoreScenario(profile,'en');
  assert.equal(scenario.valueProposition,'Fast installation');
  const changed=Outreach.normalizeCampaignStudio({coreScenario:{...scenario,status:'approved'}},{...profile,proofPoints:'ISO 9001; 120 projects'},'en');
  assert.equal(changed.coreScenario.status,'needs_review');
});
```

- [ ] **Step 2: Run downstream tests and verify RED**

Run: `node --test customer/test/profile-engine.test.js customer/test/campaign-studio.test.js customer/test/outreach-engine.test.js customer/test/content-language.test.js`

Expected: FAIL because the new profile properties are not fully mapped or fingerprinted.

- [ ] **Step 3: Map canonical fields into the profile**

Apply `profileFields(verified.answers)` in the readiness patch and base engine. Retain advanced/legacy fields in state but keep them outside visible Step 2 completeness.

```js
Object.assign(profile,LeadIntelStep2Brief.profileFields(verified.answers));
profile.marketFocus=verified.answers.ideal_customer;
```

- [ ] **Step 4: Update Campaign Studio defaults and invalidation fingerprint**

Use `profile.valueProposition || profile.differentiation` for the default value proposition. Include `customerPainPoints`, `valueProposition`, `proofPoints`, and `commonObjections` in `profileFingerprint` so material changes mark an approved scenario `needs_review`.

Do not automatically place proof or objections into outbound copy. They are controlled context for the script generator and must remain evidence-safe.

- [ ] **Step 5: Preserve localization safety**

Extend protected content validation so verified numbers, names, URLs, certification identifiers, and product IDs from `proofPoints` remain unchanged during non-English localization. A failed validation blocks approval.

- [ ] **Step 6: Run downstream and localization tests**

Run: `node --test customer/test/profile-engine.test.js customer/test/campaign-studio.test.js customer/test/outreach-engine.test.js customer/test/content-language.test.js customer/test/market-strategy-activation.test.js`

Expected: PASS.

- [ ] **Step 7: Commit only Task 4 files**

```bash
git add customer/profile-engine.js customer/step2-readiness-engine.js customer/outreach-engine.js customer/test/profile-engine.test.js customer/test/campaign-studio.test.js customer/test/outreach-engine.test.js customer/test/content-language.test.js
git commit -m "Connect commercial brief to LeadIntel workflow"
```

---

### Task 5: Cache integrity, full verification, and production release

**Files:**
- Modify: `customer/index.html`
- Modify: version constants/imports in `customer/app.js`, `customer/process-map.js`, `customer/company-research-ui.js`, and dependent modules only where the changed asset chain requires it.
- Modify: cache-version assertions in affected tests.
- Verify: `.github/workflows/customer-ci.yml`

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: one consistent production asset version and verified deployment.

- [ ] **Step 1: Write/update cache-chain assertions**

Assert that all Step 2 entry points reference `20260916-commercial-brief-v1` and no changed Step 2 asset remains behind an older query string.

```js
assert.match(html,/step2-brief-schema\.js\?v=20260916-commercial-brief-v1/);
assert.match(html,/step2-readiness-engine\.js\?v=20260916-commercial-brief-v1/);
assert.match(researchUi,/company-research-engine\.js\?v=20260916-commercial-brief-v1/);
```

- [ ] **Step 2: Run the focused feature suite**

Run:

```bash
node --test \
  customer/test/step2-commercial-brief.test.js \
  customer/test/company-research-engine.test.js \
  customer/test/company-research-security.test.js \
  customer/test/company-research-structure.test.js \
  customer/test/step2-readiness.test.js \
  customer/test/step2-research-handoff.test.js \
  customer/test/profile-engine.test.js \
  customer/test/campaign-studio.test.js \
  customer/test/outreach-engine.test.js \
  customer/test/content-language.test.js
```

Expected: PASS with zero skipped feature tests.

- [ ] **Step 3: Run syntax and diff checks**

```bash
node --check customer/step2-brief-schema.js
node --check customer/profile-engine.js
node --check customer/step2-readiness-engine.js
node --check customer/company-research-engine.js
node --check customer/company-research-ui.js
node --check customer/outreach-engine.js
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Run the full Customer suite**

Run: `node --test customer/test/*.test.js customer/workspace-isolation.test.js`

Expected: all tests pass.

- [ ] **Step 5: Run the production build**

Run: `npm run build`

Expected: exit 0 and discovery deployment integrity reports PASS.

- [ ] **Step 6: Verify the final diff contains only intended feature files**

```bash
git diff --name-only HEAD~4..HEAD
git status --short
```

Compare against the task file lists. Preserve unrelated pre-existing changes without staging them.

- [ ] **Step 7: Commit cache/version changes**

```bash
git add customer/index.html customer/app.js customer/process-map.js customer/company-research-ui.js customer/test/step2-commercial-brief.test.js customer/test/company-research-structure.test.js
git commit -m "Release Step 2 commercial intelligence brief"
```

- [ ] **Step 8: Push and verify production**

Push the feature commits to the authorized production branch. Confirm the Vercel deployment is READY, `https://leadintel.ccgroup.lv/customer/` returns HTTP 200, the live HTML references `20260916-commercial-brief-v1`, and the browser shows all three groups with no application-origin console errors.

