import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEEP_RESEARCH_LIMITS,
  buildDeepResearchPlan,
  publicDeepResearchUrl,
  classifySource,
  mergeDeepEvidence,
  nextDeepResearchAction,
  applyDeepResearchActionResult
} from '../src/deep-research.js';

const context={
  profile:{
    companyName:'AJ Produkti',
    priorityOffers:'office furniture; warehouse equipment; ergonomic desks and seating',
    idealCustomer:'businesses and public or educational institutions fitting out offices, warehouses, workshops or educational facilities',
    marketFocus:'Latvia',
    targetMarkets:'Latvia',
    buyingTriggers:'office relocation; layout redesign; warehouse expansion; facility fit-out; ergonomic workstation upgrades; new employee hiring',
    commercialObjective:'Find qualified B2B opportunities in Latvia'
  },
  icps:[{id:'core',active:true,targetMarkets:'Latvia',description:'Businesses and institutions'}],
  signals:[
    {id:'expansion',active:true,weight:10,name:'Facility expansion',keywords:'warehouse expansion; new facility'},
    {id:'hiring',active:true,weight:9,name:'Hiring growth',keywords:'hiring; new employees'},
    {id:'tender',active:true,weight:8,name:'Tender activity',keywords:'tender; procurement'}
  ]
};

test('deep research budgets are centralized and bounded',()=>{
  assert.equal(DEEP_RESEARCH_LIMITS.maxPasses,3);
  assert.equal(DEEP_RESEARCH_LIMITS.maxSearchRequests,30);
  assert.equal(DEEP_RESEARCH_LIMITS.maxPages,60);
  assert.equal(DEEP_RESEARCH_LIMITS.maxPagesPerDomain,8);
  assert.ok(DEEP_RESEARCH_LIMITS.maxThemes<=12);
});

test('planner selects several relevant commercial themes without blindly enabling every theme',()=>{
  const plan=buildDeepResearchPlan(context);
  assert.ok(plan.themes.length>=4);
  assert.ok(plan.themes.length<=12);
  const ids=new Set(plan.themes.map(theme=>theme.id));
  assert.ok(ids.has('demand'));
  assert.ok(ids.has('expansion'));
  assert.ok(ids.has('hiring'));
  assert.ok(ids.has('procurement'));
  assert.equal(ids.has('regulation'),false,'unrelated regulation theme should not be forced into this profile');
  assert.ok(plan.themes.every(theme=>theme.queries.length>=1));
  assert.ok(plan.themes.flatMap(theme=>theme.queries).every(query=>query.length<=4000));
});

test('public URL guard rejects local/private targets before extraction',()=>{
  for(const value of [
    'http://127.0.0.1/x','http://localhost:8787/x','http://10.1.2.3/x','http://192.168.1.10/x','http://172.16.4.2/x','http://169.254.1.1/x','http://[::1]/x','http://service.local/x','file:///tmp/x','javascript:alert(1)'
  ]) assert.equal(publicDeepResearchUrl(value),null,value);
  const publicUrl=publicDeepResearchUrl('https://Example.com/news/expansion#section');
  assert.equal(publicUrl.hostname,'example.com');
  assert.equal(publicUrl.hash,'');
});

test('source classification recognizes official/public-primary sources conservatively',()=>{
  assert.deepEqual(classifySource('https://www.gov.lv/lv/iepirkums','Public procurement notice','Official tender'),{sourceType:'official',sourceQuality:4});
  assert.deepEqual(classifySource('https://company.lv/news/new-factory','Company opens a new facility','Official company announcement'),{sourceType:'official',sourceQuality:4});
  assert.equal(classifySource('https://random-directory.example/list','Supplier list','Directory').sourceQuality<=2,true);
});

test('evidence merge deduplicates canonical URLs and preserves provider provenance without fake corroboration',()=>{
  const merged=mergeDeepEvidence(
    [{themeId:'expansion',claimKey:'acme-expansion',market:'Latvia',url:'https://acme.lv/news/plant/',title:'Plant expansion',text:'New production building',sourceProviders:['openai']}],
    [{themeId:'expansion',claimKey:'acme-expansion',market:'Latvia',url:'https://ACME.lv/news/plant#details',title:'Plant expansion',text:'Verified body',sourceProviders:['firecrawl']}]
  );
  assert.equal(merged.length,1);
  assert.deepEqual(merged[0].sourceProviders,['openai','firecrawl']);
  assert.equal(merged[0].corroborationCount,1,'two providers finding the same page is not independent corroboration');
});

test('independent domains supporting the same claim increase corroboration',()=>{
  const merged=mergeDeepEvidence(
    [{themeId:'procurement',claimKey:'school-furniture-tender',market:'Latvia',url:'https://eis.gov.lv/tender/123',title:'Furniture tender',sourceProviders:['openai'],sourceQuality:4}],
    [{themeId:'procurement',claimKey:'school-furniture-tender',market:'Latvia',url:'https://municipality.lv/news/tender-123',title:'Municipality tender notice',sourceProviders:['firecrawl'],sourceQuality:4}]
  );
  assert.equal(merged.length,2);
  assert.equal(merged.every(item=>item.corroborationCount===2),true);
});

test('state machine never schedules work past search, page, pass or elapsed-time budgets',()=>{
  const base={
    status:'running',startedAt:1,pass:1,maxPasses:3,
    pendingSearches:[{themeId:'demand',query:'Latvia office furniture demand'}],pendingExtractions:[],
    counters:{searchRequests:30,pagesExamined:0},evidence:[],newEvidenceThisPass:0,coverageReached:false
  };
  assert.deepEqual(nextDeepResearchAction(base,2),{type:'complete',reason:'budget_reached'});
  assert.deepEqual(nextDeepResearchAction({...base,counters:{searchRequests:0,pagesExamined:60}},2),{type:'complete',reason:'budget_reached'});
  assert.deepEqual(nextDeepResearchAction({...base,startedAt:1,counters:{searchRequests:0,pagesExamined:0}},DEEP_RESEARCH_LIMITS.maxElapsedMs+2),{type:'complete',reason:'elapsed_time_reached'});
  assert.deepEqual(nextDeepResearchAction({...base,pass:3,pendingSearches:[],pendingExtractions:[],counters:{searchRequests:3,pagesExamined:2},newEvidenceThisPass:2},2),{type:'complete',reason:'max_passes'});
  assert.deepEqual(nextDeepResearchAction({...base,pendingSearches:[],pendingExtractions:[],counters:{searchRequests:3,pagesExamined:2},newEvidenceThisPass:0},2),{type:'complete',reason:'no_new_evidence'});
  assert.deepEqual(nextDeepResearchAction({...base,coverageReached:true,counters:{searchRequests:3,pagesExamined:2}},2),{type:'complete',reason:'coverage_reached'});
});

test('state machine schedules bounded search/extraction actions and applies their counters',()=>{
  const searchState={status:'running',startedAt:Date.now(),pass:1,maxPasses:3,pendingSearches:[{themeId:'demand',query:'Latvia office furniture'}],pendingExtractions:[],counters:{searchRequests:0,pagesExamined:0},evidence:[],newEvidenceThisPass:0,coverageReached:false};
  const searchAction=nextDeepResearchAction(searchState,searchState.startedAt+10);
  assert.equal(searchAction.type,'search');
  const afterSearch=applyDeepResearchActionResult(searchState,{action:searchAction,evidence:[{themeId:'demand',claimKey:'x',market:'Latvia',url:'https://example.com/a',title:'A',sourceProviders:['openai']}],extractionCandidates:[{themeId:'demand',url:'https://example.com/a'}]});
  assert.equal(afterSearch.counters.searchRequests,1);
  assert.equal(afterSearch.pendingSearches.length,0);
  assert.equal(afterSearch.pendingExtractions.length,1);
  const extractionAction=nextDeepResearchAction(afterSearch,afterSearch.startedAt+20);
  assert.equal(extractionAction.type,'extract');
  const afterExtract=applyDeepResearchActionResult(afterSearch,{action:extractionAction,evidence:[{themeId:'demand',claimKey:'x',market:'Latvia',url:'https://example.com/a',title:'A',text:'Deep page text',sourceProviders:['firecrawl']}]});
  assert.equal(afterExtract.counters.pagesExamined,1);
  assert.equal(afterExtract.evidence.length,1);
  assert.deepEqual(afterExtract.evidence[0].sourceProviders,['openai','firecrawl']);
});
