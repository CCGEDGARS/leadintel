const test = require('node:test');
const assert = require('node:assert/strict');
const Market = require('../market-engine.js');

const profile = {
  companyName:'Acme Industrial',
  priorityOffers:'industrial automation; custom machinery',
  idealCustomer:'manufacturers with 50–500 employees',
  lookalikeCustomers:'ABB; Valmet',
  decisionMakers:'COO; Procurement Director',
  currentMarkets:['Latvia','Lithuania'],
  targetMarkets:'Nordics; Germany',
  researchMarkets:['Sweden','Finland','Norway','Denmark','Iceland','Germany'],
  marketFocus:'industrial manufacturing; logistics',
  differentiation:'fast engineering and custom delivery',
  buyingTriggers:'new facility; capacity expansion; equipment modernization; tender',
  exclusions:'projects below €20,000',
  opportunityValue:'€50,000–€250,000 per project',
  commercialObjective:'Build a €2M qualified pipeline',
  completeness:96,
  recommendedSignals:[
    {id:'facility-expansion',name:'Facility expansion or new site',priority:'High',reason:'Matches a declared buying trigger.'},
    {id:'capital-investment',name:'Capital investment or modernization',priority:'High',reason:'Matches a declared buying trigger.'},
    {id:'tender',name:'Tender or procurement activity',priority:'High',reason:'Matches a declared buying trigger.'}
  ]
};

test('buildIcpCandidates creates core, lookalike and trigger-led ICPs from approved profile',()=>{
  const icps=Market.buildIcpCandidates(profile);
  assert.equal(icps.length,3);
  assert.deepEqual(icps.map(x=>x.type),['core','lookalike','trigger-led']);
  assert.equal(icps.every(x=>x.active),true);
  assert.match(icps[0].targetMarkets,/Nordics/);
  assert.match(icps[0].buyerRoles,/Procurement Director/);
  assert.match(icps[1].rationale,/ABB/);
  assert.match(icps[2].rationale,/new facility/i);
});

test('buildIcpCandidates omits lookalike ICP when no anchors are supplied',()=>{
  const icps=Market.buildIcpCandidates({...profile,lookalikeCustomers:''});
  assert.deepEqual(icps.map(x=>x.type),['core','trigger-led']);
});

test('normalizeSignals seeds recommended signals and preserves customer edits',()=>{
  const saved=[{id:'facility-expansion',name:'Expansion trigger',active:false,priority:'High',weight:4,keywords:'factory; new site',reason:'edited'}];
  const signals=Market.normalizeSignals(profile.recommendedSignals,saved);
  const expansion=signals.find(x=>x.id==='facility-expansion');
  assert.equal(expansion.name,'Expansion trigger');
  assert.equal(expansion.active,false);
  assert.equal(expansion.weight,4);
  assert.equal(expansion.keywords,'factory; new site');
  assert.equal(signals.find(x=>x.id==='tender').weight,9);
});

test('addCustomSignal creates a bounded custom signal and rejects normalized duplicates',()=>{
  const seeded=Market.normalizeSignals(profile.recommendedSignals,[]);
  const added=Market.addCustomSignal(seeded,{name:'Distributor Search',priority:'Medium',weight:12,keywords:'distributor; reseller'});
  assert.equal(added.added,true);
  assert.equal(added.signals.at(-1).weight,10);
  assert.match(added.signals.at(-1).id,/^custom-distributor-search-/);
  const duplicate=Market.addCustomSignal(added.signals,{name:' distributor   search ',weight:5,keywords:'partner'});
  assert.equal(duplicate.added,false);
  assert.equal(duplicate.signals.length,added.signals.length);
});

test('buildResearchQueries respects the four-query cost guard and uses expanded region countries plus market focus',()=>{
  const signals=Market.normalizeSignals(profile.recommendedSignals,[]);
  const queries=Market.buildResearchQueries(profile,signals,4);
  assert.ok(queries.length>0&&queries.length<=4);
  assert.equal(new Set(queries.map(x=>x.id)).size,queries.length);
  assert.ok(queries.some(x=>x.market==='Sweden'));
  assert.ok(queries.some(x=>/industrial automation/i.test(x.query)));
  assert.ok(queries.some(x=>/industrial manufacturing/i.test(x.query)));
  assert.equal(queries.every(x=>x.market&&x.query),true);
  assert.equal(queries.some(x=>x.market==='Nordics'),false);
});

test('normalizeSearchResults accepts Firecrawl search payload and keeps source evidence',()=>{
  const meta={id:'q-1',market:'Sweden',query:'Sweden automation investment'};
  const results=Market.normalizeSearchResults({data:[
    {url:'https://example.com/a',title:'Factory expansion',description:'A manufacturer expands capacity',markdown:'Investment in new automation lines',publishedDate:'2026-08-20'},
    {url:'https://example.com/b',title:'Tender notice',description:'Automation tender'}
  ]},meta);
  assert.equal(results.length,2);
  assert.equal(results[0].market,'Sweden');
  assert.equal(results[0].queryId,'q-1');
  assert.equal(results[0].url,'https://example.com/a');
  assert.match(results[0].text,/automation lines/i);
});

test('buildMarketOpportunities uses expanded research markets and produces transparent five-part scores',()=>{
  const icps=Market.buildIcpCandidates(profile);
  const signals=Market.normalizeSignals(profile.recommendedSignals,[]);
  const research=[
    {queryId:'q1',market:'Sweden',url:'https://example.com/1',title:'New factory expansion',description:'capacity expansion and automation investment',text:'new facility automation tender',date:'2026-08-21'},
    {queryId:'q2',market:'Finland',url:'https://example.com/2',title:'Industrial investment',description:'equipment modernization',text:'capital investment equipment modernization',date:'2026-08-01'}
  ];
  const opportunities=Market.buildMarketOpportunities(profile,icps,signals,research);
  assert.ok(opportunities.length>=2);
  assert.ok(opportunities.some(x=>x.market==='Sweden'));
  assert.equal(opportunities.some(x=>x.market==='Nordics'),false);
  opportunities.forEach(item=>{
    for(const key of ['fit','intent','timing','value','evidence'])assert.ok(item.score[key]>=0&&item.score[key]<=20,`${key} out of bounds`);
    assert.equal(item.score.total,item.score.fit+item.score.intent+item.score.timing+item.score.value+item.score.evidence);
    assert.ok(item.score.total<=100);
  });
  assert.ok(opportunities.find(x=>x.market==='Sweden').evidence.length>=1);
});

test('unresearched market hypotheses start at zero instead of receiving inferred scores',()=>{
  const icps=Market.buildIcpCandidates(profile);
  const signals=Market.normalizeSignals(profile.recommendedSignals,[]);
  const opportunity=Market.buildMarketOpportunities(profile,icps,signals,[]).find(item=>item.market==='Sweden');
  assert.ok(opportunity);
  assert.equal(opportunity.profileOnly,true);
  assert.deepEqual(opportunity.score,{fit:0,intent:0,timing:0,value:0,evidence:0,total:0});
});

test('normalizeMarketState sanitizes persisted strategy state',()=>{
  const state=Market.normalizeMarketState({
    signals:[{id:'x',name:'X',weight:99,active:true,keywords:'x'}],
    icps:[{id:'core',type:'core',name:'Core',active:true}],
    researchQueries:Array.from({length:8},(_,i)=>({id:`q${i}`,market:'M',query:'Q'})),
    researchResults:Array.from({length:40},(_,i)=>({url:`https://example.com/${i}`,market:'M',title:'T'})),
    opportunities:[{id:'o',market:'M',score:{total:88}}],
    strategyApproved:true,
    strategyApprovedAt:'2026-08-22T10:00:00.000Z'
  });
  assert.equal(state.signals[0].weight,10);
  assert.ok(state.researchQueries.length<=4);
  assert.ok(state.researchResults.length<=20);
  assert.equal(state.strategyApproved,true);
});

test('strategy narratives are generated in selected Latvian',()=>{
  const icps=Market.buildIcpCandidates(profile,'lv');
  assert.equal(icps[0].name,'Pamata ideālā klienta profils');
  assert.match(icps[0].rationale,/apstiprināto ideālā klienta profilu/i);
  assert.match(icps[1].rationale,/ABB/);
  const opportunities=Market.buildMarketOpportunities(profile,icps,Market.normalizeSignals(profile.recommendedSignals,[]),[],'lv');
  assert.match(opportunities[0].hypothesis,/Prioritizēt/);
  assert.match(opportunities[0].rationale,/Atbilstība ir balstīta/);
  assert.doesNotMatch(`${opportunities[0].hypothesis} ${opportunities[0].rationale}`,/\b(?:Prioritize|Fit is based|Intent and timing)\b/i);
});

test('localizeGeneratedState updates only generated strategy prose and preserves customer edits and evidence',()=>{
  const english=Market.normalizeMarketState({icps:Market.buildIcpCandidates(profile,'en')});
  english.icps[0].description='Customer-edited definition';
  english.opportunities=Market.buildMarketOpportunities(profile,english.icps,Market.normalizeSignals(profile.recommendedSignals,[]),[{market:'Sweden',url:'https://example.com/a',title:'Evidence'}],'en');
  const localized=Market.localizeGeneratedState(english,profile,'lv');
  assert.equal(localized.icps[0].description,'Customer-edited definition');
  assert.equal(localized.icps[0].name,'Pamata ideālā klienta profils');
  assert.match(localized.opportunities[0].hypothesis,/Prioritizēt/);
  assert.equal(localized.opportunities[0].evidence[0].url,'https://example.com/a');
  assert.equal(localized.contentVariants.opportunities[localized.opportunities[0].id].lv.title,localized.opportunities[0].title);
});
