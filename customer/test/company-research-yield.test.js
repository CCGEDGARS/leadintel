const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),Progress=require('../company-search-progress.js');

test('a missing operating-country fact uses a country query without a recent-news filter',()=>{
 for(const [market,expected] of [['Denmark',/Denmark|Danmark/],['Sweden',/Sweden|Sverige/]]){
  const q=D.buildCandidateVerificationQueries([{company:'Nordic Equipment',domain:'nordic-equipment.example',market,verificationFocus:'market'}],{priorityOffers:'engineering services',targetMarkets:market},{},1)[0];
  assert.match(q.query,expected);assert.doesNotMatch(q.query,/after:|\bnews\b/i);assert.match(q.query,/location|contact|operation/i);
 }
});
test('a strong-fit goal cannot be satisfied by adjacent manual checks',()=>{
 const result=Progress.outcome({goal:'strong_fit',targetCount:2,checked:[{qualification:{score:81}},{qualification:{score:69}}],status:'complete'});
 assert.equal(result.checkedCount,2);assert.equal(result.strongFitCount,1);assert.equal(result.targetMet,false);assert.equal(result.goalCount,1);assert.equal(result.state,'partial');
});
test('operation receipts survive state normalization without retaining query bodies or secrets',()=>{
 const d=D.normalizeDiscoveryState({researchAudit:{version:1,requestId:'run-1',entries:[{id:'op-1',operation:'search',phase:'market',key:'hash-1',outcome:'succeeded',durationMs:15,resultCount:3,authorization:'secret',query:'private query',url:'https://private.example/'}]}});
 assert.equal(d.researchAudit?.entries.length,1);assert.equal(d.researchAudit.entries[0].resultCount,3);assert.equal(d.researchAudit.entries[0].authorization,undefined);assert.equal(d.researchAudit.entries[0].query,undefined);assert.equal(d.researchAudit.entries[0].url,undefined);
});

test('the receipt summary distinguishes actual requests, cached reuse, retry and missing credit prices',()=>{
 const entries=[{id:'op-1',operation:'search',phase:'market',key:'a',outcome:'failed',credits:2},{id:'op-2',operation:'search',phase:'market',key:'a',outcome:'succeeded'},{id:'op-3',operation:'search',phase:'market',key:'a',outcome:'reused'},{id:'op-4',operation:'page',phase:'market-presence',key:'b',outcome:'succeeded',credits:1}];
 const saved=JSON.parse(JSON.stringify(D.normalizeDiscoveryState({researchAudit:{version:1,requestId:'run-test',entries}})));
 const result=D.companyResearchAuditSummary(saved.researchAudit);assert.equal(result.requests,3);assert.equal(result.searches,2);assert.equal(result.pageReads,1);assert.equal(result.reused,1);assert.equal(result.retries,1);assert.equal(result.failures,1);assert.equal(result.knownCredits,3);assert.equal(result.unpricedRequests,1);assert.deepEqual(result.phases,{'market':2,'market-presence':1});assert.equal(D.companyResearchAuditSummary(null).available,false);
});
test('operating evidence planning is independent of seller names and follows the supplied industry',()=>{
 for(const offers of ['business accounting services','warehouse automation']){
  const queries=['Ercon','Other Name'].map(name=>D.buildCandidateVerificationQueries([{company:name,domain:'buyer.example',market:'Sweden',verificationFocus:'operations'}],{companyName:name,priorityOffers:offers,targetMarkets:'Sweden'},{},1)[0].query);
  assert.equal(queries[0],queries[1]);assert.doesNotMatch(queries[0],/Ercon|metal|Latvia|Denmark/);assert.match(queries[0],/Sweden|Sverige/);
 }
});

test('journey startup can request company progress before discovery has loaded',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),start=source.indexOf('function companySearchOutcome(){'),end=source.indexOf('function companyCandidateCardHtml(',start),context={discovery:null};vm.createContext(context);vm.runInContext(source.slice(start,end),context);assert.equal(context.companySearchOutcome(),null);
});

test('bounded receipts retain the full request allowance alongside repeated cache hits',()=>{
 const entries=Array.from({length:600},(_,i)=>({id:'op-'+i,operation:'search',phase:'market',key:'key-'+i,outcome:i<200?'succeeded':'reused'}));
 const audit=D.normalizeDiscoveryState({researchAudit:{version:1,requestId:'three-pass-run',entries}}).researchAudit,result=D.companyResearchAuditSummary(audit);assert.equal(result.requests,200);assert.equal(result.reused,400);assert.equal(audit.entries.length,600);
});
