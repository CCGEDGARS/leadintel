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

test('Ercon preview themes come from the actual industrial plan, never static sales examples',()=>{
  const Market=require('../market-engine.js'),Ux=require('../market-research-review-ux.js');
  const signals=[{name:'Industrial project announcements',active:true,weight:3},{name:'Production facility expansion',active:true,weight:2},{name:'Capital investment',active:true,weight:1}];
  const profile={priorityOffers:'Industrial engineering and installation',idealCustomer:'Industrial manufacturers',targetMarkets:'Sweden'};
  for(const mode of ['quick','deep','intelligence']){
    const plan=Market.buildResearchPlan(profile,signals,{mode,sourceTypes:['news']});
    const themes=Ux.themesFromPlan(plan.map(item=>item.signalName||item.researchCategory));
    assert.ok(themes.includes('Industrial project announcements'));
    assert.doesNotMatch(themes.join(' '),/sales.team|leadership|team growth/i);
    assert.doesNotMatch(plan.map(item=>item.query).join(' '),/sales.team/i);
  }
  assert.deepEqual(Ux.themesFromPlan(['Sales team hiring','Sales team hiring']),['Sales team hiring'],'a real selected sales signal remains valid for a sales seller');
  assert.deepEqual(Ux.themesFromPlan([]),[],'no invented themes when no plan exists');
});
