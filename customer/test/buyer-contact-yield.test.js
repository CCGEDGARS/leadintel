const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');

test('a saved contact timeout has no live searching markers and resumes only unfinished queries',async t=>{
 const candidate={domain:'forge.example',company:'Forge Industries',buyerRoles:['Head of Procurement'],people:[{id:'alex',name:'Alex Smith',publicName:'Alex Smith',title:'Head of Procurement',organization:'Forge Industries',publicNameUrl:'https://forge.example/team'}]},queries=[];
 const rows=[{url:'https://forge.example/team',markdown:'Alex Smith — Head of Procurement — Forge Industries',sourceRead:true,extractedAt:new Date().toISOString()}];
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 await D.runMandatoryBuyerResearch(candidate,{rows,maxDurationMs:1000,search:async query=>{queries.push(query);if(query.includes('"alex.smith@gmail.com"'))now+=1001;return [];}});
 assert.equal(candidate.publicResearch.accountability.stopReason,'time_budget');const partial=candidate.people[0];
 assert.equal(partial.emailResearch.status,'partial');
 for(const check of Object.values(partial.contactResearch.checks)){
  assert.notEqual(check.status,'running','A returned checkpoint cannot claim the provider is still searching');
  for(const entry of check.queryLog||[]){assert.notEqual(entry.status,'running');assert.notEqual(entry.searchStatus,'running');}
 }
 const completed=queries.slice(0,-1);await D.runMandatoryBuyerResearch(candidate,{rows,search:async query=>{queries.push(query);return [];}});
 assert.equal(candidate.publicResearch.accountability.status,'complete');
 for(const query of completed)assert.equal(queries.filter(value=>value===query).length,1,'Successful work is reused on resume');
});

test('reusing a successful legacy query receipt preserves its completed search state',async()=>{
 const candidate={domain:'forge.example',company:'Forge Industries',buyerRoles:['Head of Procurement'],people:[{id:'alex',name:'Alex Smith',title:'Head of Procurement',organization:'Forge Industries',publicNameUrl:'https://forge.example/team'}]},rows=[{url:'https://forge.example/team',markdown:'Alex Smith — Head of Procurement — Forge Industries',sourceRead:true,extractedAt:new Date().toISOString()}];
 await D.runMandatoryBuyerResearch(candidate,{rows,search:async()=>[]});
 const check=candidate.people[0].contactResearch.checks.gmail;check.status='partial';for(const entry of check.queryLog)delete entry.searchStatus;
 await D.runMandatoryBuyerResearch(candidate,{rows,search:async()=>assert.fail('Successful legacy queries must not be repeated')});
 assert.equal(candidate.publicResearch.accountability.status,'complete');assert.ok(D.buyerResearchCoveragePassed(candidate),'Reused accepted receipts and the paid/quality gate must agree that the search completed');
 assert.ok(candidate.people[0].contactResearch.checks.gmail.queryLog.every(entry=>entry.searchStatus==='complete'));
});
