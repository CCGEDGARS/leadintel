const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('legacy commercial context layout remains available for migration reference',()=>{
  const layout=require('../commercial-context-layout.js');
  assert.deepEqual(layout.COMMERCIAL_CONTEXT_PAIRS,[['marketFocus','customerPainPoints'],['buyingTriggers','commercialObjective']]);
  assert.ok(layout.CARD_GROUPS);
});

test('canonical intelligence profile replaces the legacy commercial context grouping',()=>{
  const ui=require('../intelligence-profile-ui.js');
  assert.deepEqual(ui.CORE_FIELDS,['priorityOffers','idealCustomer','targetMarkets','customerPainPoints','buyingTriggers','decisionMakers','differentiation','commercialObjective']);
  assert.equal(ui.CORE_FIELDS.includes('marketFocus'),false);
});

test('legacy commercial context layout is no longer loaded by the customer shell',()=>{
  const evidenceView=read('evidence-view.js');
  assert.doesNotMatch(evidenceView,/commercial-context-layout\.js/);
  assert.match(evidenceView,/intelligence-profile-runtime\.js\?v=20260923-reference-interface-v1/);
});

test('new intelligence profile CSS owns responsive primary-card layout',()=>{
  const css=read('intelligence-profile.css');
  assert.match(css,/\.intel-core-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:800px\)[^{]*\{[^}]*\.intel-core-grid/s);
});
