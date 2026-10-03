const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../discovery-engine.js');
const profile={decisionMakers:'Procurement Manager; Project Manager; Engineering Manager'};
test('Swedish search aliases also match returned Swedish job titles',()=>{
 const trace=D.tracePublicBuyers([{title:'Anna Andersson | Inköpschef | LKAB',url:'https://linkedin.com/in/anna'},{title:'Erik Svensson | Teknisk projektledare | LKAB',url:'https://linkedin.com/in/erik'}],'LKAB',profile);
 assert.equal(trace.people.length,2);assert.ok(trace.diagnostics.every(row=>row.accepted));
});
test('public result trace distinguishes parsing, company, former-role and role rejection',()=>{
 const trace=D.tracePublicBuyers([{title:'LKAB careers'},{title:'Anna Andersson | Procurement Manager | LKAB supplier'},{title:'Anna Andersson | Former Procurement Manager at LKAB'},{title:'Anna Andersson | Marketing Manager | LKAB'}],'LKAB',profile);
 assert.equal(trace.diagnostics.length,4);assert.equal(trace.diagnostics[0].parsing,'rejected');assert.equal(trace.diagnostics[2].companyVerification,'rejected');assert.equal(trace.diagnostics[3].roleMatching,'rejected');
});
test('past employment elsewhere does not reject explicit current target employment',()=>{
 assert.equal(D.tracePublicBuyers([{title:'Anna Andersson | Inköpschef | LKAB',description:'Previously worked at Volvo.'}],'LKAB',profile).people.length,1);
});
test('identity trace accounts for all ten rows including unmatched and missing organizations',()=>{
 const people=Array.from({length:10},(_,i)=>({name:'Person '+['Andersson','Svensson','Karlsson','Nilsson','Berg','Lind','Ek','Sund','Lund','Holm'][i],title:i===3?'Marketing Manager':'Inköpschef',organization:{name:i===1?'Other Company':i===2?'':'LKAB AB'}}));
 const result=D.traceIdentityBuyers({people},{company:'LKAB'},profile);
 assert.equal(result.diagnostics.length,10);assert.equal(result.people.length,7);
 assert.match(result.diagnostics[1].rejectionReason,/does not match/);assert.match(result.diagnostics[2].rejectionReason,/employment evidence/);assert.equal(result.diagnostics[3].roleMatching,'rejected');
});
test('empty identity rows remain traceable rather than silently disappearing',()=>{
 const result=D.traceIdentityBuyers({people:[{}]},{company:'LKAB'},profile);assert.equal(result.diagnostics.length,1);assert.equal(result.diagnostics[0].parsing,'rejected');
});
test('normalization retains exact per-result stage and rejection reason',()=>{
 const trace=D.traceIdentityBuyers({people:[{name:'Anna Andersson',title:'Marketing Manager',organization:{name:'LKAB'}}]},{company:'LKAB'},profile);
 const state=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates:[{company:'LKAB',domain:'lkab.com',website:'https://lkab.com/',qualified:true,marketVerified:true,buyerVerified:true,matchedSignals:[{name:'Investment',evidence:[{url:'https://lkab.com/news',date:'2026-09-01'}]}],evidence:[{url:'https://lkab.com/news',title:'Investment',description:'LKAB investment project',text:'LKAB investment project evidence',verifiedAt:'2026-10-03T10:00:00Z'}],buyerDiscovery:{resultDiagnostics:trace.diagnostics}}]});
 const row=state.candidates[0].buyerDiscovery.resultDiagnostics[0];assert.equal(row.roleMatching,'rejected');assert.equal(row.rejectionReason,'Identity title does not match any requested buying function');assert.equal(row.parsedCompany,'LKAB');
});
test('obfuscated Apollo surname stays pending and stable without invented last name',()=>{
 const result=D.traceIdentityBuyers({people:[{id:'apollo-123',first_name:'Anna',last_name_obfuscated:'A****',title:'Inköpschef',organization:{name:'LKAB'}}]},{company:'LKAB'},profile);
 assert.equal(result.people.length,1);assert.equal(result.people[0].name,'Anna');assert.equal(result.people[0].identityStatus,'pending');
 const pool=D.mergeBuyerPool([],result.people,profile);assert.equal(pool.length,1);assert.equal(pool[0].id,'apollo-123');assert.equal(D.recommendedBuyers(pool,profile).length,0);
});

test('a subsidiary is not silently treated as the exact target employer',()=>{const t=D.traceIdentityBuyers({people:[{name:'Anna Andersson',title:'Procurement Manager',organization_name:'LKAB Minerals'}]},{company:'LKAB'},profile);assert.equal(t.people.length,0);assert.equal(t.diagnostics[0].companyVerification,'rejected');});
