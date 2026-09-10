const test=require('node:test');
const assert=require('node:assert/strict');
const Market=require('../market-engine.js');
const Lookalike=require('../lookalike-discovery.js');

const profile={
  targetMarkets:'Latvia',
  decisionMakers:'Company leaders',
  priorityOffers:'Sales training',
  opportunityValue:'High',
  exclusions:'Public tenders'
};

function model(fingerprint='rc-abc'){
  return {
    active:true,
    fingerprint,
    activeRows:[{id:'r1'},{id:'r2'},{id:'r3'},{id:'r4'}],
    activeSegments:[{id:'s1',name:'Best customers'}],
    dna:{active:true,activeCount:4,confidence:'high',fingerprint,dimensions:[{key:'industry',values:['B2B services']}]},
    published:true,
    updatedAt:'2026-09-10T05:00:00.000Z'
  };
}

test('Step 4 always contains one Reference Customer Lookalike lens',()=>{
  const synced=Market.syncReferenceLookalikeIcp([],profile,null,'en');
  assert.equal(synced.length,1);
  assert.equal(synced[0].id,'icp-reference-lookalike');
  assert.equal(synced[0].type,'lookalike-led');
  assert.equal(synced[0].name,'Reference Customer Lookalike');
  assert.equal(synced[0].active,false);
  assert.equal(synced[0].referenceModelAvailable,false);
});

test('an activated Reference Customer model automatically turns Lookalike-led on',()=>{
  const active=model();
  const synced=Market.syncReferenceLookalikeIcp([],profile,active,'en',{draftDirty:true});
  const lens=synced[0];
  assert.equal(lens.active,true);
  assert.equal(lens.referenceModelAvailable,true);
  assert.equal(lens.referenceFingerprint,'rc-abc');
  assert.equal(lens.referenceCount,4);
  assert.equal(lens.referenceConfidence,'high');
  assert.equal(lens.referenceDraftDirty,true);
  assert.match(lens.description,/proven customers/i);
});

test('user may switch off the same published Lookalike model without it turning itself back on',()=>{
  const active=model();
  const existing={id:'icp-reference-lookalike',type:'lookalike-led',active:false,referenceFingerprint:'rc-abc'};
  const [lens]=Market.syncReferenceLookalikeIcp([existing],profile,active,'en');
  assert.equal(lens.active,false);
});

test('publishing a new Lookalike model automatically activates the refreshed lens',()=>{
  const existing={id:'icp-reference-lookalike',type:'lookalike-led',active:false,referenceFingerprint:'rc-old'};
  const [lens]=Market.syncReferenceLookalikeIcp([existing],profile,model('rc-new'),'en');
  assert.equal(lens.active,true);
  assert.equal(lens.referenceFingerprint,'rc-new');
});

test('Discovery honors an explicit Lookalike-led switch-off',()=>{
  assert.equal(Lookalike.isLookalikeStrategyEnabled({icps:[]}),true,'legacy workspaces remain enabled');
  assert.equal(Lookalike.isLookalikeStrategyEnabled({icps:[{id:'icp-reference-lookalike',active:true}]}),true);
  assert.equal(Lookalike.isLookalikeStrategyEnabled({icps:[{id:'icp-reference-lookalike',active:false}]}),false);
});
