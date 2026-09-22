const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../market-engine.js');

const profile={targetMarkets:'Sweden',priorityOffers:'industrial engineering',idealCustomer:'manufacturers',marketFocus:'outsourced production'};
const signals=[{name:'Expansion',active:true,weight:9,keywords:'expansion;new facility'}];
const counts=plan=>plan.reduce((out,item)=>(out[item.researchCategory]=(out[item.researchCategory]||0)+1,out),{});

test('Market Research reserves every market-condition category',()=>{
  const plan=engine.buildResearchPlan(profile,signals,{mode:'deep',sourceTypes:['news','investments','company','registries']});
  assert.equal(plan.length,12);
  assert.deepEqual(counts(plan),{direction:3,competition:2,funding:2,pricing:1,commercial:4});
  assert.ok(plan.every(item=>item.query.includes('Sweden')));
  assert.equal(new Set(plan.map(item=>item.query)).size,12);
});

test('Deep Analysis reserves wider market-condition coverage',()=>{
  const plan=engine.buildResearchPlan(profile,signals,{mode:'intelligence',sourceTypes:['news','jobs','investments','company','registries']});
  assert.equal(plan.length,24);
  assert.deepEqual(counts(plan),{direction:5,competition:4,funding:4,pricing:3,commercial:8});
  assert.ok(plan.filter(item=>item.researchCategory==='funding').some(item=>/EU Funding|European Commission/i.test(item.query)));
});

test('Quick Overview keeps the existing four-query behavior',()=>{
  const plan=engine.buildResearchPlan(profile,signals,{mode:'quick',sourceTypes:['news']});
  assert.equal(plan.length,4);
  assert.ok(plan.every(item=>item.researchCategory==='commercial'));
});
