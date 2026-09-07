# Market Research Source Discovery UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three market research depths visibly distinct, remove pre-research pseudo-findings/scores, and replace static source suggestions with live evidence-backed source discovery for Market Research and Market Intelligence.

**Architecture:** Add a focused browser module `customer/market-research-ux.js` that augments the existing Step 4 market-research UI and exposes pure helpers for tests. Reuse the existing authenticated `/api/ai/web-search` endpoint and existing custom-source controls rather than changing backend credentials or saved-state contracts. Load the module through `customer/evidence-view.js`, following the current Company Brain dynamic-import pattern.

**Tech Stack:** Vanilla JavaScript, DOM APIs, existing LeadIntel market runtime, Node `node:test`, GitHub Actions Customer V2 CI, Release Integrity workflow.

**Spec:** `docs/superpowers/specs/2026-09-07-market-research-source-discovery-ux-design.md`

## Global Constraints

- Preserve research mode IDs exactly: `quick`, `deep`, `intelligence`.
- Preserve existing query/result caps: quick `4/5/20`, deep `12/8/80`, intelligence `24/10/200`.
- Market Scan must not show a specific-site recommendation list before running.
- Market Research source discovery is capped at 8 unique site origins.
- Market Intelligence source discovery is capped at 15 unique site origins and grouped into a Source Intelligence Map.
- Do not present the static Latvia catalog as AI-recommended sources.
- Do not show a numeric opportunity score before live market research.
- Tender/procurement remains excluded unless an active tender signal enables it.
- Source discovery must use authenticated workspace web search; no credential is exposed to browser code.
- Source discovery failure must show an explicit unavailable state, not invented fallback recommendations.
- Saved custom sources, monitoring, history and existing workspace compatibility must remain intact.

---

### Task 1: Lock the approved UX rules with RED tests

**Files:**
- Create: `customer/test/market-research-source-discovery-ux.test.js`

**Interfaces:**
- Consumes: future `require('../market-research-ux.js')`.
- Produces: behavioral contract for `MODE_COPY`, `sourceDiscoveryPolicy`, `buildSourceDiscoveryQueries`, `normalizeDiscoveredSources`, `classifySource`, `marketCardView`.

- [ ] **Step 1: Create failing tests for mode copy and policies**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const ux=require('../market-research-ux.js');

test('idle market research labels contain no Review prefix and each has distinct readable copy',()=>{
  assert.equal(ux.MODE_COPY.quick.label,'Market Scan');
  assert.equal(ux.MODE_COPY.deep.label,'Market Research');
  assert.equal(ux.MODE_COPY.intelligence.label,'Market Intelligence');
  assert.match(ux.MODE_COPY.quick.description,/Fast validation/i);
  assert.match(ux.MODE_COPY.deep.description,/Deeper research/i);
  assert.match(ux.MODE_COPY.intelligence.description,/Comprehensive investigation/i);
});

test('source discovery policy differs by research depth',()=>{
  assert.deepEqual(ux.sourceDiscoveryPolicy('quick'),{mode:'automatic',maxSites:0,grouped:false});
  assert.deepEqual(ux.sourceDiscoveryPolicy('deep'),{mode:'discover-before-run',maxSites:8,grouped:false});
  assert.deepEqual(ux.sourceDiscoveryPolicy('intelligence'),{mode:'discover-before-run',maxSites:15,grouped:true});
});
```

- [ ] **Step 2: Add tests for source-discovery queries and deduplication**

```js
test('source discovery is built from market and company context rather than a country source catalog',()=>{
  const profile={targetMarkets:'Latvia',priorityOffers:'Sales training; AI integration',idealCustomer:'B2B sales teams',marketFocus:'sales performance'};
  const state={signals:[{name:'New Sales Director',active:true,keywords:'sales director appointment'}]};
  const queries=ux.buildSourceDiscoveryQueries(profile,state,'deep');
  assert.ok(queries.length>=3);
  assert.ok(queries.every(q=>/Latvia/i.test(q)));
  assert.ok(queries.some(q=>/hiring|leadership|sales director/i.test(q)));
  assert.ok(queries.every(q=>!/^https?:\/\/(?:www\.)?(?:lsm|db)\.lv/i.test(q)));
});

test('discovered sources are canonicalized to site origins, deduplicated and capped',()=>{
  const payloads=[{results:[
    {url:'https://example.com/news/a',title:'A',description:'growth'},
    {url:'https://example.com/news/b',title:'B',description:'leadership'},
    {url:'https://jobs.example.org/role',title:'Jobs',description:'hiring'}
  ]}];
  const deep=ux.normalizeDiscoveredSources(payloads,'deep');
  assert.equal(deep.length,2);
  assert.equal(deep[0].url,'https://example.com/');
  assert.ok(deep.every(item=>item.url.startsWith('https://')));
});
```

- [ ] **Step 3: Add tests for intelligence grouping and pre-research market view**

```js
test('source intelligence classification supports the required map groups',()=>{
  assert.equal(ux.classifySource('https://www.cv.lv/','CV.lv','jobs vacancies'),'hiring');
  assert.equal(ux.classifySource('https://info.ur.gov.lv/','Register','company registry'),'registries-data');
  assert.equal(ux.classifySource('https://example.com/','Industry Association','trade association'),'industry');
});

test('profile-only market view hides score and separates geography, focus and customers',()=>{
  const view=ux.marketCardView({market:'Latvia',profileOnly:true,score:{total:0}}, {priorityOffers:'Sales training; AI integration',idealCustomer:'B2B sales teams'});
  assert.equal(view.market,'Latvia');
  assert.equal(view.showScore,false);
  assert.match(view.commercialFocus,/Sales training/);
  assert.match(view.targetCustomers,/B2B sales teams/);
});
```

- [ ] **Step 4: Run the focused test and confirm RED**

Run: `node --test customer/test/market-research-source-discovery-ux.test.js`

Expected: FAIL because `customer/market-research-ux.js` does not exist.

- [ ] **Step 5: Commit the RED contract**

```bash
git add customer/test/market-research-source-discovery-ux.test.js
git commit -m "test: define market research source discovery UX"
```

---

### Task 2: Implement the pure source-discovery and market-view engine

**Files:**
- Create: `customer/market-research-ux.js`
- Test: `customer/test/market-research-source-discovery-ux.test.js`

**Interfaces:**
- Consumes: profile fields `targetMarkets`, `priorityOffers`, `marketFocus`, `idealCustomer`; market `signals`.
- Produces: `MODE_COPY`, `sourceDiscoveryPolicy(mode)`, `buildSourceDiscoveryQueries(profile,market,mode)`, `classifySource(url,title,snippet)`, `normalizeDiscoveredSources(payloads,mode)`, `marketCardView(opportunity,profile)`.

- [ ] **Step 1: Implement exact mode copy and policy**

```js
const MODE_COPY=Object.freeze({
  quick:Object.freeze({
    label:'Market Scan',
    description:'Fast validation of the strongest buying signals and opportunities in your selected market.'
  }),
  deep:Object.freeze({
    label:'Market Research',
    description:'Deeper research across companies, market activity, news, hiring, expansion and other relevant sources.'
  }),
  intelligence:Object.freeze({
    label:'Market Intelligence',
    description:'Comprehensive investigation across multiple source types to uncover opportunities, patterns, competitors and hidden signals.'
  })
});

function sourceDiscoveryPolicy(mode){
  if(mode==='intelligence')return {mode:'discover-before-run',maxSites:15,grouped:true};
  if(mode==='deep')return {mode:'discover-before-run',maxSites:8,grouped:false};
  return {mode:'automatic',maxSites:0,grouped:false};
}
```

- [ ] **Step 2: Implement source-discovery query construction**

Construct 3 queries for deep and 6 for intelligence using target market + commercial focus + ICP + active signal terms. Required intent groups:

```js
const intents=[
  'business news company announcements leadership changes',
  'jobs hiring sales leadership recruitment growth',
  'official company registry industry association expansion investment'
];
```

For intelligence append:

```js
[
  'industry publications trade associations specialist market sources',
  'technology CRM AI transformation company signals',
  'funding merger acquisition expansion executive appointments'
]
```

Quick returns `[]` because specific-source discovery is intentionally skipped.

- [ ] **Step 3: Implement evidence-backed result normalization**

Support result arrays found at `payload.results`, `payload.data`, `payload.web`, `payload.sources`; accept `url || link`; convert every URL to `new URL(url).origin + '/'`; deduplicate by origin; retain title/snippet/reason; classify category; cap by `sourceDiscoveryPolicy(mode).maxSites`.

Do not seed LSM, Dienas Bizness or any country-specific static site.

- [ ] **Step 4: Implement source classification**

Return one of:
- `official-company`
- `hiring`
- `news-media`
- `registries-data`
- `industry`
- `technology`
- `growth-investment`
- `other`

Use URL/title/snippet keyword signals only; this affects grouping, not factual claims.

- [ ] **Step 5: Implement market-card view helper**

`marketCardView(opportunity, profile)` must return:

```js
{
  market: opportunity.marketLabel || opportunity.market || 'Selected market',
  commercialFocus: profile.marketFocus || profile.priorityOffers || '',
  targetCustomers: profile.idealCustomer || '',
  status: opportunity.profileOnly ? 'Not researched yet' : 'Researched',
  showScore: !opportunity.profileOnly
}
```

- [ ] **Step 6: Run focused tests**

Run: `node --test customer/test/market-research-source-discovery-ux.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the pure engine**

```bash
git add customer/market-research-ux.js customer/test/market-research-source-discovery-ux.test.js
git commit -m "feat: add evidence-backed market source discovery UX engine"
```

---

### Task 3: Install the browser UX without expanding app.js

**Files:**
- Modify: `customer/market-research-ux.js`
- Modify: `customer/evidence-view.js`
- Test: `customer/test/market-research-source-discovery-ux.test.js`

**Interfaces:**
- Consumes: DOM IDs `run-market-research`, `run-detailed-research`, `run-market-intelligence`, `research-run-preview`, `research-suggested-sources`, `add-suggested-sources`; global `LeadIntelServerBridge`; localStorage key `leadintel_customer_v2_state`.
- Produces: runtime `install(root)` behavior and source-discovery rendering.

- [ ] **Step 1: Add a browser-safe installer**

`install(root)` must:
- add per-button description elements once;
- set idle button labels to the exact mode names;
- use a `MutationObserver` to reapply idle labels after `app.js` writes `Review ...` while preserving `Researching…` when the run is active;
- inject focused CSS for the three mode cards/descriptions and Source Intelligence Map;
- observe Step 4 rendering so profile-only cards are cleaned after each re-render.

- [ ] **Step 2: Clean pre-research market cards**

For each `.opportunity-card.unresearched`:
- remove/hide `.opportunity-total`;
- replace the long title with geographic market from saved state/profile target markets;
- insert separate `Commercial focus` and `Target customers` rows from saved `state.profile`;
- leave `Not researched yet` visible.

Do not alter researched opportunity cards.

- [ ] **Step 3: Implement live source discovery on preview open**

Observe `#research-run-preview[hidden]`. When it becomes visible:
- read saved `state.market.researchMode`;
- `quick`: hide `.research-suggested-block` and display an automatic-source note; make no web-search requests;
- `deep`/`intelligence`: show the block in loading state, call authenticated `/api/ai/web-search?workspace_id=<workspace>` sequentially/with a small concurrency cap for the source-discovery queries, normalize results, and render checkboxes with `data-suggested-source` so the existing Add selected sites handler remains valid;
- intelligence: group rendered items by `classifySource` category;
- failure/unavailable: render `Source discovery unavailable. LeadIntel will use the selected source categories; no specific sites have been pre-recommended.`

- [ ] **Step 4: Add structural tests for installer behavior**

Tests should verify:
- `install` exists;
- module contains no hardcoded `lsm.lv` or `db.lv` catalog;
- quick policy produces no discovery fetch plan;
- rendered source card markup contains `data-suggested-source` for valid live-discovered sources;
- `customer/evidence-view.js` imports `market-research-ux.js`.

- [ ] **Step 5: Load the module through the existing browser bootstrap**

At the top of `customer/evidence-view.js`, retain Company Brain import and add:

```js
if(typeof window!=="undefined")void import('./market-research-ux.js?v=20260907-source-discovery-ux-v1');
```

- [ ] **Step 6: Run focused and related tests**

Run:

```bash
node --test customer/test/market-research-source-discovery-ux.test.js customer/test/market-research-modes.test.js customer/test/market-engine.test.js customer/test/openai-web-search-market.test.js
node --check customer/market-research-ux.js
node --check customer/evidence-view.js
```

Expected: PASS.

- [ ] **Step 7: Commit browser integration**

```bash
git add customer/market-research-ux.js customer/evidence-view.js customer/test/market-research-source-discovery-ux.test.js
git commit -m "feat: install source discovery and pre-research UX"
```

---

### Task 4: Remove the old static recommendation contract and update product documentation

**Files:**
- Modify: `customer/test/market-research-modes.test.js`
- Modify: `docs/market-research-and-monitoring.md`

**Interfaces:**
- Consumes: new source-discovery behavior.
- Produces: tests/docs that no longer require static Latvia suggestions.

- [ ] **Step 1: Replace the obsolete static-source test**

Remove the test that requires `buildSuggestedSources()` to return LIAA/CV.lv. Replace it with a compatibility rule that the old engine may return no static suggestions and that the new UX source discovery has ownership of specific-site recommendations.

- [ ] **Step 2: Update `docs/market-research-and-monitoring.md`**

Document:
- exact button labels and descriptions;
- Known → Planned → Researched → Verified model;
- no pre-research numeric score;
- Market Scan automatic source choice;
- Market Research live source discovery (up to 8);
- Market Intelligence Source Intelligence Map (up to 15);
- no static site recommendations presented as AI findings;
- user-selected discovered sites continue into custom sources/monitoring;
- tender gating remains unchanged.

- [ ] **Step 3: Run full customer test suite and syntax checks**

Run:

```bash
node --test customer/test/*.test.js
for f in customer/*.js; do node --check "$f"; done
```

Expected: all tests and syntax checks PASS.

- [ ] **Step 4: Commit docs/test contract**

```bash
git add customer/test/market-research-modes.test.js docs/market-research-and-monitoring.md
git commit -m "docs: make source discovery the market research product rule"
```

---

### Task 5: PR, CI, production verification and saved release state

**Files:**
- No runtime files unless CI exposes an integration defect.

**Interfaces:**
- Consumes: complete feature branch.
- Produces: merged main SHA with Customer V2 CI and Release Integrity proof.

- [ ] **Step 1: Open a PR**

Title:

`Make market research modes source-aware and evidence-first`

Body must enumerate acceptance criteria, test commands, and note that no backend credential behavior changed.

- [ ] **Step 2: Wait for Customer V2 CI on PR head**

Required: customer tests PASS and JavaScript syntax PASS.

- [ ] **Step 3: Review changed files/patch**

Confirm scope is limited to:
- new focused UX module/tests;
- small bootstrap import;
- obsolete static-source test contract;
- market research documentation/spec/plan.

- [ ] **Step 4: Merge only if CI is green and PR remains mergeable**

Use expected head SHA when merging.

- [ ] **Step 5: Verify main CI**

Confirm Customer V2 CI passes on the exact merged main SHA.

- [ ] **Step 6: Verify Release Integrity**

Confirm `prove-production` completes successfully for that exact SHA and release proof is uploaded.

- [ ] **Step 7: Report exact production SHA and behavior**

Do not call the feature production-ready until the exact merged SHA has both main CI and Release Integrity success.
