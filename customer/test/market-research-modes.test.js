const test=require('node:test');
const assert=require('node:assert/strict');
const market=require('../market-engine.js');
const ux=require('../market-research-ux.js');

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

test('three market research modes have explicit, progressively bounded cost controls',()=>{
  assert.deepEqual(market.RESEARCH_MODES.quick,{maxQueries:4,resultsPerQuery:5,maxStoredResults:20});
  assert.deepEqual(market.RESEARCH_MODES.deep,{maxQueries:12,resultsPerQuery:8,maxStoredResults:80});
  assert.deepEqual(market.RESEARCH_MODES.intelligence,{maxQueries:24,resultsPerQuery:10,maxStoredResults:200});
});

test('market intelligence creates a wider set of unique searches than market research',()=>{
  const research=market.buildResearchQueries(profile,signals,{mode:'deep',sourceTypes:['news','jobs','investments','company','registries'],language:'en'});
  const intelligence=market.buildResearchQueries(profile,signals,{mode:'intelligence',sourceTypes:['news','jobs','investments','company','registries'],language:'en'});
  assert.equal(research.length,12);
  assert.equal(intelligence.length,24);
  assert.equal(new Set(intelligence.map(item=>item.query)).size,24);
  assert.ok(new Set(intelligence.map(item=>item.sourceType)).size>=4);
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

test('deep research produces twelve unique searches when enough signals and categories exist',()=>{
  const deep=market.buildResearchQueries(profile,signals,{mode:'deep',sourceTypes:['news','jobs','investments'],language:'en'});
  assert.equal(deep.length,12);
  assert.equal(new Set(deep.map(item=>item.query)).size,12);
});

test('disabled tender signal excludes tender sources and tender queries',()=>{
  const disabled=signals.map(signal=>signal.id==='s3'?{...signal,active:false}:signal);
  assert.deepEqual(market.filterResearchSourceTypes(['news','tenders','jobs'],disabled),['news','jobs']);
  const deep=market.buildResearchQueries(profile,disabled,{mode:'deep',sourceTypes:['news','tenders','jobs'],language:'en'});
  assert.ok(deep.every(item=>item.sourceType!=='tenders'));
  assert.ok(deep.every(item=>! /tender|procurement/i.test(item.query)));
});

test('excluding the tender source also excludes tender signal terms from other categories',()=>{
  const queries=market.buildResearchQueries(profile,signals,{mode:'deep',sourceTypes:['news','jobs'],language:'en'});
  assert.ok(queries.length>0);
  assert.ok(queries.every(item=>! /tender|procurement/i.test(item.query)));
});

test('specific-site recommendations are owned by live source discovery rather than static country defaults',()=>{
  assert.deepEqual(ux.sourceDiscoveryPolicy('quick'),{mode:'automatic',maxSites:0,grouped:false});
  assert.deepEqual(ux.sourceDiscoveryPolicy('deep'),{mode:'discover-before-run',maxSites:8,grouped:false});
  assert.deepEqual(ux.sourceDiscoveryPolicy('intelligence'),{mode:'discover-before-run',maxSites:15,grouped:true});
  assert.deepEqual(ux.buildSourceDiscoveryQueries(profile,{signals},'quick'),[]);
  const liveQueries=ux.buildSourceDiscoveryQueries(profile,{signals},'deep');
  assert.equal(liveQueries.length,3);
  assert.ok(liveQueries.every(query=>/Latvia/i.test(query)));
});

test('Latvian planned searches do not inject English source terminology',()=>{
  const lvProfile={...profile,targetMarkets:'Latvija',buyingTriggers:'jauns birojs; noliktavas paplašināšana'};
  const lvSignals=[{id:'lv-1',name:'Objekta paplašināšana',active:true,weight:10,keywords:'paplašināšana; pārcelšanās'}];
  const queries=market.buildResearchQueries(lvProfile,lvSignals,{mode:'quick',sourceTypes:['news'],language:'lv'});
  assert.ok(queries.length>0);
  assert.ok(queries.every(item=>!/news announcement|relocation|modernisation/i.test(item.query)));
  assert.ok(queries.some(item=>/ziņas|paziņojum/i.test(item.query)));
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

test('market state preserves the intelligence mode and migrates existing modes safely',()=>{
  assert.equal(market.normalizeMarketState({researchMode:'intelligence'}).researchMode,'intelligence');
  assert.equal(market.normalizeMarketState({researchMode:'deep'}).researchMode,'deep');
  assert.equal(market.normalizeMarketState({researchMode:'quick'}).researchMode,'quick');
  const history=market.normalizeMarketState({researchHistory:[{id:'run-i',mode:'intelligence',status:'complete',sourceCount:42}]}).researchHistory;
  assert.equal(history[0].mode,'intelligence');
});

test('new research and monitoring configurations do not include tenders by default',()=>{
  const state=market.normalizeMarketState({});
  assert.ok(!state.researchSourceTypes.includes('tenders'));
  assert.ok(!state.monitoring.sourceTypes.includes('tenders'));
});

test('research history is append-only and bounded',()=>{
  let history=[];
  for(let i=0;i<25;i++)history=market.appendResearchHistory(history,{id:`run-${i}`,mode:'quick',status:'complete',sourceCount:i,completedAt:new Date(2026,0,i+1).toISOString()});
  assert.equal(history.length,20);
  assert.equal(history[0].id,'run-24');
  assert.equal(history.at(-1).id,'run-5');
});
