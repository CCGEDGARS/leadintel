const test=require('node:test');
const assert=require('node:assert/strict');
const Discovery=require('../discovery-engine.js');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

test('Buyer discovery accepts common pipe-separated current-role search results',()=>{
  const rows=[{
    url:'https://www.linkedin.com/in/anna-andersson',
    title:'Anna Andersson | Head of Procurement | LKAB',
    description:'Anna Andersson is Head of Procurement at LKAB in Sweden.'
  }];
  const people=Discovery.discoverPublicBuyers(rows,'LKAB',{decisionMakers:'Procurement Director; Procurement Manager; Strategic Sourcing Manager'});
  assert.equal(people.length,1);
  assert.equal(people[0].name,'Anna Andersson');
  assert.match(people[0].title,/Procurement/i);
});

test('Buyer diagnostics preserve timeout and exact failure context through normalization',()=>{
  const state=Discovery.normalizeDiscoveryState({qualityVersion:Discovery.DISCOVERY_QUALITY_VERSION,candidates:[{
    company:'LKAB',domain:'lkab.com',website:'https://lkab.com/',qualified:true,marketVerified:true,buyerVerified:true,
    matchedSignals:[{name:'Investment',evidence:[{url:'https://lkab.com/news',date:'2026-09-01'}]}],
    evidence:[{url:'https://lkab.com/news',title:'Investment',description:'LKAB investment project',text:'LKAB investment project evidence',verifiedAt:'2026-10-03T10:00:00Z'}],
    buyerDiscovery:{
      target:30,
      providerStatus:{firecrawl:{status:'partial',results:2,queries:12},grounded:{status:'timeout',results:0},identity:{status:'not_configured',results:0}},
      lastError:{name:'AbortError',message:'Grounded buyer discovery timed out',phase:'roles'}
    }
  }]});
  const buyer=state.candidates[0].buyerDiscovery;
  assert.equal(buyer.target,30);
  assert.equal(buyer.providerStatus.grounded.status,'timeout');
  assert.equal(buyer.lastError.message,'Grounded buyer discovery timed out');
  assert.equal(buyer.lastError.phase,'roles');
});

test('A grounded-provider timeout is non-terminal unless the parent Buyer run itself was aborted',()=>{
  const start=ui.indexOf('async function searchDecisionMakers');
  const end=ui.indexOf('async function selectTargetForBuyers',start);
  const block=ui.slice(start,end);
  assert.match(block,/if\(controller\.signal\.aborted\)throw error/);
  assert.match(block,/providerStatus\.grounded\.status=error\?\.name==="AbortError"\?"timeout":"failed"/);
});

test('Buyer failure UI shows exact cause and phase instead of a generic failure message',()=>{
  assert.match(ui,/Buyer search needs attention/);
  assert.match(ui,/buyerDiscovery\?\.lastError\?\.message/);
  assert.match(ui,/buyerDiscovery\?\.lastError\?\.phase/);
});
