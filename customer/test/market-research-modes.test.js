const test=require('node:test');
const assert=require('node:assert/strict');
const market=require('../market-engine.js');

const profile={
  targetMarkets:'Latvia',
  priorityOffers:'Office furniture; Warehouse equipment',
  idealCustomer:'Companies opening or modernising workplaces',
  marketFocus:'B2B workplace equipment',
  buyingTriggers:'new office; warehouse expansion'
};
const signals=[
  {id:'s1',name:'New office',active:true,weight:10,keywords:'new office; relocation'},
  {id:'s2',name:'Warehouse expansion',active:true,weight:9,keywords:'warehouse expansion; new warehouse'},
  {id:'s3',name:'Public procurement',active:true,weight:8,keywords:'tender; procurement'},
  {id:'s4',name:'Hiring growth',active:true,weight:7,keywords:'hiring; vacancies'}
];

test('quick and deep research modes have explicit, bounded cost controls',()=>{
  assert.deepEqual(market.RESEARCH_MODES.quick,{maxQueries:4,resultsPerQuery:5,maxStoredResults:20});
  assert.deepEqual(market.RESEARCH_MODES.deep,{maxQueries:12,resultsPerQuery:8,maxStoredResults:80});
});

test('deep research creates source-category queries beyond the quick snapshot',()=>{
  const quick=market.buildResearchQueries(profile,signals,{mode:'quick'});
  const deep=market.buildResearchQueries(profile,signals,{mode:'deep',sourceTypes:['news','tenders','jobs','investments']});
  assert.equal(quick.length,4);
  assert.equal(deep.length,12);
  assert.ok(deep.some(item=>item.sourceType==='tenders'&&/tender|procurement/i.test(item.query)));
  assert.ok(deep.some(item=>item.sourceType==='jobs'&&/hiring|vacanc/i.test(item.query)));
  assert.ok(deep.some(item=>item.sourceType==='investments'&&/investment|expansion/i.test(item.query)));
});

test('market state preserves research history and monitoring preferences',()=>{
  const state=market.normalizeMarketState({
    researchMode:'deep',
    researchHistory:[{id:'run-1',mode:'deep',status:'complete',sourceCount:17,completedAt:'2026-09-06T10:00:00Z'}],
    monitoring:{enabled:true,frequency:'weekly',minimumScore:70,sourceTypes:['news','tenders'],signalIds:['s1']}
  });
  assert.equal(state.researchMode,'deep');
  assert.equal(state.researchHistory.length,1);
  assert.deepEqual(state.monitoring.sourceTypes,['news','tenders']);
  assert.equal(state.monitoring.minimumScore,70);
});

test('research history is append-only and bounded',()=>{
  let history=[];
  for(let i=0;i<25;i++)history=market.appendResearchHistory(history,{id:`run-${i}`,mode:'quick',status:'complete',sourceCount:i,completedAt:new Date(2026,0,i+1).toISOString()});
  assert.equal(history.length,20);
  assert.equal(history[0].id,'run-24');
  assert.equal(history.at(-1).id,'run-5');
});
