const test = require('node:test');
const assert = require('node:assert/strict');
const Discovery = require('../discovery-engine.js');

test('candidate explanation is generated in selected Latvian without changing identity or scores',()=>{
  const narrative=Discovery.buildCandidateNarrative({company:'Nordic Factory AB',score:{total:82},confidence:'High',matchedSignals:[{name:'Ražošanas modernizācija'}],evidence:[{url:'https://nordic.example/news'}]},'lv');
  assert.match(narrative,/Nordic Factory AB/);
  assert.match(narrative,/82\/100/);
  assert.match(narrative,/Ražošanas modernizācija/);
  assert.doesNotMatch(narrative,/\b(?:ranked|evidence|signal)\b/i);
});

const profile={
  companyName:'Acme Industrial',website:'https://acme.example/',priorityOffers:'industrial automation; custom machinery',
  idealCustomer:'manufacturers with 50–500 employees',decisionMakers:'COO; Procurement Director; Plant Manager',
  targetMarkets:'Sweden; Finland',buyingTriggers:'new facility; capacity expansion; equipment modernization; tender',
  opportunityValue:'€50,000–€250,000 per project',exclusions:'projects below €20,000',completeness:96,
  customerPainPoints:'Poor production flow creates downtime. How it can make work easier: simplify production planning.'
};
const market={
  strategyApproved:true,
  icps:[{id:'icp-core',type:'core',name:'Core ICP',description:'manufacturers with 50–500 employees',targetMarkets:'Sweden; Finland',offers:'industrial automation',active:true}],
  signals:[
    {id:'facility-expansion',name:'Facility expansion',active:true,weight:10,keywords:'new factory; new facility; capacity expansion'},
    {id:'modernization',name:'Equipment modernization',active:true,weight:9,keywords:'modernization; automation investment; equipment upgrade'},
    {id:'tender',name:'Tender',active:true,weight:8,keywords:'tender; procurement'}
  ],
  opportunities:[
    {id:'opp-sweden',market:'Sweden',active:true,score:{total:86}},
    {id:'opp-finland',market:'Finland',active:true,score:{total:72}}
  ]
};

test('buildDiscoveryQueries supports provisional website-only strategy and respects four-query guard',()=>{
  const provisional=Discovery.buildDiscoveryQueries(profile,{...market,strategyApproved:false},4);
  assert.ok(provisional.length>0&&provisional.length<=4);
  const queries=Discovery.buildDiscoveryQueries(profile,market,4);
  assert.ok(queries.length>0&&queries.length<=4);
  assert.equal(new Set(queries.map(x=>x.id)).size,queries.length);
  assert.ok(queries.some(x=>/Sweden/i.test(x.query)));
  assert.ok(queries.some(x=>x.offer==='industrial automation'),'seller offer remains metadata for scoring but not a search term');
  assert.ok(queries.every(x=>!/industrial automation/i.test(x.query)),'seller offer must not bias discovery toward competitors');
  assert.ok(queries.some(x=>/downtime/i.test(x.query)),'pain-point terms must inform discovery research');
  assert.ok(queries.every(x=>x.market&&x.query));
  assert.deepEqual(Discovery.buildDiscoveryQueries({}, {}, 4),[],'discovery still needs a company website or profile context');
});

test('adaptive discovery follow-ups add bounded, relevant queries without repeating attempted searches',()=>{
  const initial=Discovery.buildDiscoveryQueries(profile,market,4);
  const followUps=Discovery.buildDiscoveryFollowUpQueries(profile,market,initial,4);
  assert.equal(followUps.length,4);
  assert.equal(new Set(followUps.map(item=>item.query)).size,followUps.length);
  assert.ok(followUps.every(item=>item.market&&item.query));
  assert.ok(followUps.every(item=>!initial.some(query=>query.query===item.query)));
  assert.ok(followUps.some(item=>/Sweden/i.test(item.query)));
  assert.ok(followUps.some(item=>/factory|facility|capacity|modernization|investment/i.test(item.query)));
  assert.ok(followUps.every(item=>!/industrial automation/i.test(item.query)), 'the seller offer must not bias the prospect search');
  assert.deepEqual(Discovery.buildDiscoveryFollowUpQueries({},market,[],4),[]);
});

test('normalizeCompanySearchResults rejects obvious non-company hosts and keeps direct company domains',()=>{
  const meta={id:'dq-1',market:'Sweden',query:'Sweden manufacturers'};
  const results=Discovery.normalizeCompanySearchResults({data:[
    {url:'https://news.example.com/story',title:'Industrial news',description:'News article'},
    {url:'https://www.linkedin.com/company/acme',title:'Acme LinkedIn'},
    {url:'https://nordicmachines.se/about',title:'Nordic Machines | Industrial Automation',description:'Swedish manufacturer investing in automation',markdown:'Nordic Machines builds production equipment and is expanding capacity.',publishedDate:'2026-08-10'}
  ]},meta);
  assert.equal(results.length,2,'unknown domains may remain candidates, LinkedIn must be filtered');
  assert.ok(results.every(x=>x.domain));
  assert.equal(results.find(x=>x.domain==='nordicmachines.se').market,'Sweden');
  assert.match(results.find(x=>x.domain==='nordicmachines.se').text,/expanding capacity/i);
});

test('buildCandidateVerificationQueries creates bounded company-domain checks and rejects known market conflicts',()=>{
  const raw=[
    {url:'https://nordicfood.se/about',domain:'nordicfood.se',company:'Nordic Food AB',market:'Sweden',title:'Nordic Food',description:'Food producer'},
    {url:'https://nordicfood.se/products',domain:'nordicfood.se',company:'Nordic Food AB',market:'Sweden',title:'Products',description:'Food products'},
    {url:'https://latvianmetal.lv/',domain:'latvianmetal.lv',company:'Latvian Metal',market:'Sweden',title:'Latvian Metal',description:'Metal producer'},
    {url:'https://acme.example/news',domain:'acme.example',company:'Acme',market:'Sweden',title:'Acme',description:'Own company'}
  ];

  const checks=Discovery.buildCandidateVerificationQueries(raw,profile,market,3);

  assert.equal(checks.length,1);
  assert.equal(checks[0].domain,'nordicfood.se');
  assert.match(checks[0].query,/site:nordicfood\.se/i);
  assert.match(checks[0].query,/new factory/i);
  assert.doesNotMatch(checks[0].query,/industrial automation/i,'seller offer must not be used to verify buyers');
});

test('domain verification keeps evidence only from the company being checked',()=>{
  const results=Discovery.normalizeCompanySearchResults({data:[
    {url:'https://nordicfood.se/news/new-factory',title:'Nordic Food expansion',description:'New factory in Sweden'},
    {url:'https://unrelated.se/news/new-factory',title:'Unrelated expansion',description:'New factory in Sweden'}
  ]},{id:'verify-nordicfood-se',kind:'verification',domain:'nordicfood.se',market:'Sweden',query:'site:nordicfood.se new factory'});

  assert.deepEqual(results.map(item=>item.domain),['nordicfood.se']);
});

test('mergeCompanyCandidates deduplicates domains and builds transparent five-part scores',()=>{
  const raw=[
    {queryId:'q1',market:'Sweden',url:'https://nordicmachines.se/about',domain:'nordicmachines.se',company:'Nordic Machines',title:'Industrial Automation',description:'manufacturer',text:'manufacturer industrial automation new facility capacity expansion procurement',date:'2026-08-20'},
    {queryId:'q2',market:'Sweden',url:'https://nordicmachines.se/news',domain:'nordicmachines.se',company:'Nordic Machines',title:'Expansion',description:'new factory',text:'new factory automation investment',date:'2026-08-21'},
    {queryId:'q3',market:'Finland',url:'https://finnfab.fi/',domain:'finnfab.fi',company:'FinnFab',title:'FinnFab manufacturing',description:'production systems',text:'manufacturing equipment',date:''}
  ];
  const candidates=Discovery.mergeCompanyCandidates(raw,profile,market);
  assert.equal(candidates.length,1);
  const nordic=candidates.find(x=>x.domain==='nordicmachines.se');
  assert.equal(nordic.evidence.length,2);
  assert.ok(nordic.matchedSignals.some(x=>x.id==='facility-expansion'));
  for(const key of ['fit','signal','evidence','timing','value'])assert.ok(nordic.score[key]>=0,`${key} missing`);
  assert.equal(nordic.score.total,nordic.score.fit+nordic.score.signal+nordic.score.evidence+nordic.score.timing+nordic.score.value);
  assert.ok(nordic.score.total<=100);
  assert.ok(['High','Medium','Low'].includes(nordic.confidence));
  assert.equal(candidates.some(x=>x.domain==='finnfab.fi'),false,'zero-signal companies are not actionable candidates');
});

test('signal score only uses evidence text, not query metadata',()=>{
  const raw=[{queryId:'q1',market:'Sweden',query:'new facility capacity expansion',url:'https://plainco.se/',domain:'plainco.se',company:'PlainCo',title:'PlainCo',description:'manufacturer',text:'manufacturer serving industrial clients',date:''}];
  const candidates=Discovery.mergeCompanyCandidates(raw,profile,market);
  assert.deepEqual(candidates,[],'query words alone cannot qualify a company without evidence');
});

test('potential company matches show missing proof but can never become actionable leads',()=>{
  const possible=[
    {url:'https://northstar.com/news/factory',domain:'northstar.com',company:'Northstar',market:'Sweden',title:'Northstar plans a new factory',description:'Northstar plans a new factory and expands production capacity.',text:'Northstar plans a new factory and expands production capacity.'},
    {url:'https://plainbuyer.se/about',domain:'plainbuyer.se',company:'Plain Buyer',market:'Sweden',title:'Plain Buyer',description:'Swedish industrial manufacturer',text:'Plain Buyer is a Swedish industrial manufacturer serving regional clients.'},
    {url:'https://acme.example/about',domain:'acme.example',company:'Acme Industrial',market:'Sweden',title:'Acme expands',description:'New factory and capacity expansion',text:'Acme expands with a new factory and capacity expansion.'}
  ];
  const potential=Discovery.buildPotentialCompanyCandidates(possible,profile,market,[]);
  assert.deepEqual(potential.map(item=>item.domain).sort(),['northstar.com','plainbuyer.se']);
  const northstar=potential.find(item=>item.domain==='northstar.com');
  const plainbuyer=potential.find(item=>item.domain==='plainbuyer.se');
  assert.ok(northstar.qualificationGaps.includes('Target market evidence is missing'));
  assert.ok(plainbuyer.qualificationGaps.includes('No active buying signal was confirmed'));
  assert.equal(northstar.marketVerified,false);
  assert.equal(plainbuyer.marketVerified,true,'potential matches retain the checks they did pass');
  assert.ok(potential.every(item=>item.qualified===false&&item.buyerVerified===false));
  assert.ok(potential.every(item=>!Discovery.isActionableCandidate(item)));
  assert.deepEqual(Discovery.buildPotentialCompanyCandidates(possible,profile,market,[{domain:'northstar.com'}]).map(item=>item.domain),['plainbuyer.se']);
});

test('zero-result guidance recommends a deeper research mode only after a quick overview',()=>{
  const quick=Discovery.zeroResultGuidance({researchMode:'quick',evidenceCount:20,activeSignalCount:3,targetCount:10,adaptiveFollowUpSearches:4});
  const marketResearch=Discovery.zeroResultGuidance({researchMode:'deep',evidenceCount:80,activeSignalCount:4,targetCount:10,adaptiveFollowUpSearches:4});
  assert.equal(quick.primaryAction,'review_research');
  assert.equal(quick.primaryLabel,'Review Market Research');
  assert.ok(quick.steps.some(step=>/smaller market evidence set/i.test(step)));
  assert.ok(quick.steps.some(step=>/broadened the search/i.test(step)));
  assert.equal(marketResearch.primaryAction,'review_strategy');
  assert.equal(marketResearch.primaryLabel,'Review Strategy');
  assert.ok(!marketResearch.steps.some(step=>/smaller market evidence set/i.test(step)));
  assert.match(marketResearch.summary,/valid finding/i);
});

test('buildApolloPeopleSearchPayload uses exact domain and approved roles with safe discovery depth',()=>{
  const payload=Discovery.buildApolloPeopleSearchPayload({domain:'nordicmachines.se'},profile);
  assert.deepEqual(payload.q_organization_domains_list,['nordicmachines.se']);
  assert.ok(payload.person_titles.includes('COO'));
  assert.equal(payload.include_similar_titles,true);
  assert.deepEqual(payload.person_seniorities,['owner','founder','c_suite','partner','vp','head','director','manager']);
  assert.equal(payload.per_page,10);
  assert.equal(payload.page,1);
});

test('normalizeApolloPeople returns names and titles but strips emails and phones',()=>{
  const people=Discovery.normalizeApolloPeople({people:[
    {id:'p1',first_name:'Anna',last_name:'Andersson',title:'Procurement Director',email:'anna@example.com',phone_numbers:[{sanitized_number:'+123'}],organization:{name:'Nordic Machines'},linkedin_url:'https://www.linkedin.com/in/anna-andersson/?trk=profile'},
    {id:'p2',name:'Erik Svensson',title:'COO'}
  ]});
  assert.equal(people.length,2);
  assert.equal(people[0].name,'Anna Andersson');
  assert.equal(people[0].title,'Procurement Director');
  assert.equal(people[0].linkedin_url,'https://www.linkedin.com/in/anna-andersson');
  assert.equal('email' in people[0],false);
  assert.equal('phone' in people[0],false);
});
test('normalizeApolloPeople keeps only public LinkedIn profile identity links',()=>{
  const people=Discovery.normalizeApolloPeople({people:[
    {id:'p1',first_name:'Anna',last_name:'Andersson',title:'Procurement Director',linkedin_url:'https://www.linkedin.com/in/anna-andersson/?trk=profile'},
    {id:'p2',first_name:'Ben',last_name:'Blocked',title:'Sales Director',linkedin_url:'https://www.linkedin.com/search/results/people/?keywords=ben'}
  ]});
  assert.equal(people[0].linkedin_url,'https://www.linkedin.com/in/anna-andersson');
  assert.equal(people[1].linkedin_url,'');
});

test('selectDecisionMakers returns no more than four role-relevant people in priority order',()=>{
  assert.equal(typeof Discovery.selectDecisionMakers,'function');
  if(typeof Discovery.selectDecisionMakers!=='function')return;
  const people=[
    {id:'p1',name:'A',title:'Procurement Director',seniority:'director'},
    {id:'p2',name:'B',title:'Chief Operating Officer',seniority:'c_suite'},
    {id:'p3',name:'C',title:'Plant Manager',seniority:'manager'},
    {id:'p4',name:'D',title:'Head of Procurement',seniority:'head'},
    {id:'p5',name:'E',title:'Procurement Specialist',seniority:'senior'},
    {id:'p6',name:'F',title:'Marketing Director',seniority:'director'},
    {id:'p7',name:'G',title:'Intern',seniority:'intern'}
  ];
  const selected=Discovery.selectDecisionMakers(people,profile,4);
  assert.equal(selected.length,4);
  assert.deepEqual(selected.map(person=>person.id),['p2','p1','p4','p3']);
  assert.ok(selected.every(person=>!['p6','p7'].includes(person.id)));
});

test('selectDecisionMakers reports a real shortage by returning fewer people instead of filling with unrelated roles',()=>{
  assert.equal(typeof Discovery.selectDecisionMakers,'function');
  if(typeof Discovery.selectDecisionMakers!=='function')return;
  const selected=Discovery.selectDecisionMakers([
    {id:'p1',name:'A',title:'COO',seniority:'c_suite'},
    {id:'p2',name:'B',title:'Marketing Director',seniority:'director'}
  ],profile,4);
  assert.deepEqual(selected.map(person=>person.id),['p1']);
});

test('upsertPipelineItem deduplicates by domain and preserves later stage',()=>{
  const candidate={id:'c1',company:'Nordic Machines',domain:'nordicmachines.se',website:'https://nordicmachines.se/',market:'Sweden',score:{total:88},confidence:'High',matchedSignals:[],evidence:[],people:[]};
  const first=Discovery.upsertPipelineItem([],candidate);
  assert.equal(first.length,1);assert.equal(first[0].stage,'Discovered');
  first[0].stage='Qualified';
  const updated=Discovery.upsertPipelineItem(first,{...candidate,score:{total:92},people:[{id:'p1',name:'Anna',title:'COO'}]});
  assert.equal(updated.length,1);assert.equal(updated[0].stage,'Qualified');assert.equal(updated[0].score.total,92);assert.equal(updated[0].people.length,1);
});

test('normalizeDiscoveryState caps candidates, pipeline and selected decision-makers and validates stages',()=>{
  const state=Discovery.normalizeDiscoveryState({
    status:'complete',
    rawResults:Array.from({length:40},(_,i)=>({url:`https://c${i}.com`,domain:`c${i}.com`})),
    candidates:Array.from({length:20},(_,i)=>({id:`c${i}`,company:`C${i}`,domain:`c${i}.com`,website:`https://c${i}.com`,people:Array.from({length:9},(_,j)=>({id:`p${j}`,name:`P${j}`,title:'Director'}))})),
    pipeline:Array.from({length:70},(_,i)=>({id:`p${i}`,company:`P${i}`,domain:`p${i}.com`,website:`https://p${i}.com`,stage:i===0?'INVALID':'Qualified'})),
    lastRunAt:'2026-08-22T10:00:00.000Z'
  });
  assert.ok(state.rawResults.length<=20);
  assert.ok(state.candidates.length<=12);
  assert.ok(state.pipeline.length<=50);
  assert.ok(state.candidates.every(x=>x.people.length<=4));
  assert.equal(state.pipeline[0].stage,'Discovered');
});

test('normalizeDiscoveryState persists the search funnel and keeps potential matches separate and non-actionable',()=>{
  const state=Discovery.normalizeDiscoveryState({
    funnel:{marketSearchesCompleted:8,marketSearchesTotal:8,evidencePages:17,companiesIdentified:4,officialDomainsResolved:3,companySitesChecked:2,verifiedCompanies:1,qualifiedCompanies:0,adaptiveFollowUpSearches:4},
    potentialMatches:[{company:'Northstar',domain:'northstar.com',website:'https://northstar.com/',qualified:true,buyerVerified:true,marketVerified:true,matchedSignals:[{id:'expansion',name:'Expansion'}],qualificationGaps:['Target market evidence is missing'],evidence:[{url:'https://northstar.com/news',title:'Expansion'}]}]
  });
  assert.equal(state.funnel.marketSearchesCompleted,8);
  assert.equal(state.funnel.evidencePages,17);
  assert.equal(state.funnel.adaptiveFollowUpSearches,4);
  assert.equal(state.potentialMatches.length,1);
  assert.equal(state.potentialMatches[0].qualified,false);
  assert.equal(state.potentialMatches[0].buyerVerified,false);
  assert.equal(state.potentialMatches[0].marketVerified,true);
  assert.equal(Discovery.isActionableCandidate(state.potentialMatches[0]),false);
});


test('discovery limits start at ten and support bounded custom targets',()=>{
  assert.deepEqual(Discovery.discoveryLimits(),{targetCount:10,queryCount:4,resultsPerQuery:5});
  assert.deepEqual(Discovery.discoveryLimits(25),{targetCount:25,queryCount:8,resultsPerQuery:5});
  assert.deepEqual(Discovery.discoveryLimits(37),{targetCount:37,queryCount:10,resultsPerQuery:5});
  assert.equal(Discovery.discoveryLimits(0).targetCount,10);
  assert.equal(Discovery.discoveryLimits(500).targetCount,50);
});
