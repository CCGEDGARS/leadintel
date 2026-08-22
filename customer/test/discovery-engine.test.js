const test = require('node:test');
const assert = require('node:assert/strict');
const Discovery = require('../discovery-engine.js');

const profile={
  companyName:'Acme Industrial',priorityOffers:'industrial automation; custom machinery',
  idealCustomer:'manufacturers with 50–500 employees',decisionMakers:'COO; Procurement Director; Plant Manager',
  targetMarkets:'Sweden; Finland',buyingTriggers:'new facility; capacity expansion; equipment modernization; tender',
  opportunityValue:'€50,000–€250,000 per project',exclusions:'projects below €20,000',completeness:96
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

test('buildDiscoveryQueries requires active strategy and respects four-query guard',()=>{
  assert.deepEqual(Discovery.buildDiscoveryQueries(profile,{...market,strategyApproved:false},4),[]);
  const queries=Discovery.buildDiscoveryQueries(profile,market,4);
  assert.ok(queries.length>0&&queries.length<=4);
  assert.equal(new Set(queries.map(x=>x.id)).size,queries.length);
  assert.ok(queries.some(x=>/Sweden/i.test(x.query)));
  assert.ok(queries.some(x=>/industrial automation/i.test(x.query)));
  assert.ok(queries.every(x=>x.market&&x.query));
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

test('mergeCompanyCandidates deduplicates domains and builds transparent five-part scores',()=>{
  const raw=[
    {queryId:'q1',market:'Sweden',url:'https://nordicmachines.se/about',domain:'nordicmachines.se',company:'Nordic Machines',title:'Industrial Automation',description:'manufacturer',text:'manufacturer industrial automation new facility capacity expansion procurement',date:'2026-08-20'},
    {queryId:'q2',market:'Sweden',url:'https://nordicmachines.se/news',domain:'nordicmachines.se',company:'Nordic Machines',title:'Expansion',description:'new factory',text:'new factory automation investment',date:'2026-08-21'},
    {queryId:'q3',market:'Finland',url:'https://finnfab.fi/',domain:'finnfab.fi',company:'FinnFab',title:'FinnFab manufacturing',description:'production systems',text:'manufacturing equipment',date:''}
  ];
  const candidates=Discovery.mergeCompanyCandidates(raw,profile,market);
  assert.equal(candidates.length,2);
  const nordic=candidates.find(x=>x.domain==='nordicmachines.se');
  assert.equal(nordic.evidence.length,2);
  assert.ok(nordic.matchedSignals.some(x=>x.id==='facility-expansion'));
  for(const key of ['fit','signal','evidence','timing','value'])assert.ok(nordic.score[key]>=0,`${key} missing`);
  assert.equal(nordic.score.total,nordic.score.fit+nordic.score.signal+nordic.score.evidence+nordic.score.timing+nordic.score.value);
  assert.ok(nordic.score.total<=100);
  assert.ok(['High','Medium','Low'].includes(nordic.confidence));
});

test('signal score only uses evidence text, not query metadata',()=>{
  const raw=[{queryId:'q1',market:'Sweden',query:'new facility capacity expansion',url:'https://plainco.se/',domain:'plainco.se',company:'PlainCo',title:'PlainCo',description:'manufacturer',text:'manufacturer serving industrial clients',date:''}];
  const [candidate]=Discovery.mergeCompanyCandidates(raw,profile,market);
  assert.equal(candidate.matchedSignals.length,0);
});

test('buildApolloPeopleSearchPayload uses exact domain and approved roles with safe cap',()=>{
  const payload=Discovery.buildApolloPeopleSearchPayload({domain:'nordicmachines.se'},profile);
  assert.deepEqual(payload.q_organization_domains_list,['nordicmachines.se']);
  assert.ok(payload.person_titles.includes('COO'));
  assert.equal(payload.include_similar_titles,true);
  assert.deepEqual(payload.person_seniorities,['c_suite','vp','head','director','manager']);
  assert.equal(payload.per_page,5);
  assert.equal(payload.page,1);
});

test('normalizeApolloPeople returns names and titles but strips emails and phones',()=>{
  const people=Discovery.normalizeApolloPeople({people:[
    {id:'p1',first_name:'Anna',last_name:'Andersson',title:'Procurement Director',email:'anna@example.com',phone_numbers:[{sanitized_number:'+123'}],organization:{name:'Nordic Machines'}},
    {id:'p2',name:'Erik Svensson',title:'COO'}
  ]});
  assert.equal(people.length,2);
  assert.equal(people[0].name,'Anna Andersson');
  assert.equal(people[0].title,'Procurement Director');
  assert.equal('email' in people[0],false);
  assert.equal('phone' in people[0],false);
});

test('upsertPipelineItem deduplicates by domain and preserves later stage',()=>{
  const candidate={id:'c1',company:'Nordic Machines',domain:'nordicmachines.se',website:'https://nordicmachines.se/',market:'Sweden',score:{total:88},confidence:'High',matchedSignals:[],evidence:[],people:[]};
  const first=Discovery.upsertPipelineItem([],candidate);
  assert.equal(first.length,1);assert.equal(first[0].stage,'Discovered');
  first[0].stage='Qualified';
  const updated=Discovery.upsertPipelineItem(first,{...candidate,score:{total:92},people:[{id:'p1',name:'Anna',title:'COO'}]});
  assert.equal(updated.length,1);assert.equal(updated[0].stage,'Qualified');assert.equal(updated[0].score.total,92);assert.equal(updated[0].people.length,1);
});

test('normalizeDiscoveryState caps candidates, pipeline and people and validates stages',()=>{
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
  assert.ok(state.candidates.every(x=>x.people.length<=5));
  assert.equal(state.pipeline[0].stage,'Discovered');
});
