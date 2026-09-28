const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../market-engine.js');

const profile={targetMarkets:'Sweden',priorityOffers:'industrial engineering',idealCustomer:'manufacturers',marketFocus:'outsourced production'};
const signals=[{name:'Expansion',active:true,weight:9,keywords:'expansion;new facility'}];
const counts=plan=>plan.reduce((out,item)=>(out[item.researchCategory]=(out[item.researchCategory]||0)+1,out),{});

test('Market Research prioritizes buyer events while keeping bounded market context',()=>{
  const plan=engine.buildResearchPlan(profile,signals,{mode:'deep',sourceTypes:['news','investments','company','registries']});
  assert.equal(plan.length,12);
  assert.deepEqual(counts(plan),{direction:2,competition:1,funding:1,commercial:8});
  assert.ok(plan.every(item=>item.query.includes('Sweden')));
  assert.equal(new Set(plan.map(item=>item.query)).size,12);
});

test('a news-only selection does not silently plan other source categories',()=>{
  const plan=engine.buildResearchPlan(profile,signals,{mode:'deep',sourceTypes:['news']});
  assert.ok(plan.every(item=>item.sourceType==='news'));
});

test('industrial offer plans short, distinct buyer-signal searches rather than repeating an entire profile',()=>{
  const industrial={targetMarkets:'Sweden',priorityOffers:'Full-service industrial project delivery; custom manufacturing and installation of metal structures and equipment; serial production from prototypes to large volumes',idealCustomer:'Industrial and manufacturing companies in Sweden seeking an international partner for engineered metalwork, serial or custom production, installation, or qualified project workforce.'};
  const active=[{name:'New industrial project or production contract',active:true,weight:9},{name:'Facility expansion or new site',active:true,weight:9},{name:'Capital investment or modernization',active:true,weight:9}];
  const plan=engine.buildResearchPlan(industrial,active,{mode:'deep',sourceTypes:['news','jobs','investments','company']});
  assert.equal(plan.length,12);
  assert.ok(plan.every(item=>item.query.length<190));
  assert.ok(plan.every(item=>!item.query.includes('seeking an international partner')));
  assert.ok(plan.filter(item=>item.researchCategory==='commercial').some(item=>/production contract/i.test(item.query)));
  assert.ok(plan.filter(item=>item.researchCategory==='commercial').some(item=>/facility expansion/i.test(item.query)));
  assert.ok(new Set(plan.map(item=>item.sourceType)).size>=4);
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
