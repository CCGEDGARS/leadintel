const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('research review uses compact plan with exact searches collapsed',()=>{
  const ux=read('market-research-review-ux.js');
  assert.match(ux,/Research Plan/);
  assert.match(ux,/View exact searches/);
  assert.match(ux,/research-plan-themes/);
  assert.match(ux,/planned-searches/);
  assert.match(ux,/details/);
});

test('research modes expose clear depth metadata',()=>{
  const ux=read('market-research-review-ux.js');
  assert.match(ux,/Fast/);
  assert.match(ux,/Detailed/);
  assert.match(ux,/Comprehensive/);
  assert.match(ux,/up to 20 evidence sources/i);
  assert.match(ux,/up to 80 evidence sources/i);
  assert.match(ux,/up to 200 evidence sources/i);
});

test('source discovery reports completed source count',()=>{
  const ux=read('market-research-review-ux.js');
  assert.match(ux,/relevant sources found/);
  assert.match(ux,/source-discovery-card/);
});

test('review UX module is loaded by evidence view',()=>{
  const evidence=read('evidence-view.js');
  assert.match(evidence,/market-research-review-ux\.js/);
});
