const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
function fixture(){
 const c={company:'Forge Industries',domain:'forge.example',buyerRoles:['Procurement Director'],people:['Alex North','Blair East','Casey West','Drew South'].map((name,i)=>({id:'p'+i,name,publicName:name,title:'Procurement Director',organization:'Forge Industries',publicNameUrl:'https://forge.example/team'}))};
 const map=new Map();for(const p of c.people)for(const [key,queries]of Object.entries(D.buyerResearchQueryPlan(c,p)))for(const query of queries)map.set(query,{id:p.id,key});
 const recheckPlans=Object.fromEntries(c.people.map(p=>[p.id,D.buyerRecheckPlan(c,p)]));for(const p of c.people)for(const query of recheckPlans[p.id].queries)map.set(query,{id:p.id,key:'followup'});
 return {c,map,recheckPlans};
}
for(const blocked of ['gmail','followup'])test('all four core contact checks run before a blocked '+blocked+' expansion',async()=>{
 const {c,map,recheckPlans}=fixture(),seen=[];
 const report=await D.runMandatoryBuyerResearch(c,{force:true,recheckPlans,maxDurationMs:1000,search:async query=>{const row=map.get(query);seen.push({...row,query});if(row?.key===blocked)return new Promise(()=>{});return [];}});
 assert.equal(report.stopReason,'time_budget');
 for(const p of c.people)for(const key of ['official','public','direct_email','phone']){
  assert.equal(p.contactResearch.checks[key]?.status,'complete',p.id+' '+key);
  for(const query of D.buyerResearchQueryPlan(c,p)[key])assert.equal(seen.filter(row=>row.query===query).length,1,'force must not replay a core query within its own run');
 }
 const firstExpansion=seen.findIndex(row=>row.key==='gmail'||row.key==='followup'),lastCore=seen.findLastIndex(row=>['official','public','direct_email','phone'].includes(row.key));assert.ok(firstExpansion>lastCore);
 assert.equal(D.buyerResearchCoveragePassed(c),false,'a bounded partial expansion never means full research completed');
 if(blocked==='followup')for(const p of c.people.slice(0,2))assert.equal(p.contactResearch.checks.gmail.queryLog.filter(row=>row.status==='complete').length,3,'all three fresh Gmail searches still precede alternatives');
});
test('resuming a partial expansion reuses core receipts without renewing their original timestamps',async()=>{
 const {c,map,recheckPlans}=fixture();await D.runMandatoryBuyerResearch(c,{recheckPlans,maxDurationMs:500,search:async query=>map.get(query)?.key==='gmail'?new Promise(()=>{}):[]});
 const original=c.people.map(p=>Object.fromEntries(['official','public','direct_email','phone'].map(key=>[key,JSON.stringify(p.contactResearch.checks[key])]))),seen=[];
 await D.runMandatoryBuyerResearch(c,{recheckPlans,search:async query=>{seen.push(map.get(query));return [];}});
 for(const [i,p]of c.people.entries()){
  for(const key of ['official','public','direct_email','phone'])assert.equal(JSON.stringify(p.contactResearch.checks[key]),original[i][key]);
  assert.equal(p.contactResearch.checks.gmail.queryLog.length,3);assert.ok(p.contactResearch.checks.gmail.queryLog.every(row=>row.status==='complete'));
 }
 assert.ok(seen.every(row=>!['official','public','direct_email','phone','linkedin'].includes(row?.key)));
});
for(const invalid of ['expired','changed_query','partial_source'])test('an early profile pause cannot promote '+invalid+' untouched core receipts',async()=>{
 const {c,map}=fixture();c.people=c.people.slice(0,1);const p=c.people[0];await D.runMandatoryBuyerResearch(c,{search:async()=>[]});
 const keys=['official','public','direct_email','phone'];
 for(const key of keys){const check=p.contactResearch.checks[key];if(invalid==='expired'){check.checkedAt=new Date(Date.now()-31*86400000).toISOString();for(const row of check.queryLog)row.checkedAt=check.checkedAt;}else if(invalid==='changed_query')check.queryLog[0].query='Old unrelated query';else check.queryLog[0].sourceReads=[{url:'https://forge.example/team',status:'partial'}];}
 p.contactResearch.checks.linkedin.profileMatchVersion=1;p.contactResearch.channels={company:{status:'not_searched'},phone:{status:'not_searched'}};
 const original=JSON.stringify(p.contactResearch.checks.phone),seen=[];
 const report=await D.runMandatoryBuyerResearch(c,{maxDurationMs:100,search:async query=>{seen.push(map.get(query));return new Promise(()=>{});}});
 assert.equal(report.stopReason,'time_budget');assert.ok(seen.every(row=>row.key==='linkedin'));assert.equal(JSON.stringify(p.contactResearch.checks.phone),original);
 assert.equal(D.buyerResearchCheckPassed(c,p,'phone'),false);assert.equal(p.contactResearch.channels.phone.status,'partial');assert.equal(p.contactResearch.channels.company.status,'partial');
});
test('a profile identity repair cannot reuse the old identity core prefix',async()=>{
 const c={company:'Södra',domain:'sodra.com',buyerSearchMode:'user_selected_target',people:[{id:'lotta',name:'Lotta',publicName:'Lotta Lyr',title:'CEO & President',publicNameUrl:'https://sodra.com/team'}]};const p=c.people[0];
 await D.runMandatoryBuyerResearch(c,{search:async()=>[]});const oldPhone=p.contactResearch.checks.phone.queryLog[0].query;
 delete p.contactResearch.checks.linkedin;const seen=[];
 await D.runMandatoryBuyerResearch(c,{search:async query=>{seen.push(query);return query.includes('site:linkedin.com/in/')?[{url:'https://se.linkedin.com/in/lottalyra',title:'Lotta Lyrå – CEO & President på Södra | LinkedIn',description:'CEO & President på Södra'},{url:'https://sodra.com/team',title:'Management',description:'Lotta Lyrå — CEO & President of Södra.'}]:[];}});
 assert.equal(p.publicName,'Lotta Lyrå');assert.equal(D.buyerResearchCheckPassed(c,p,'phone'),true);
 assert.deepEqual(p.contactResearch.checks.phone.queryLog.map(row=>row.query),D.buyerResearchQueryPlan(c,p).phone);assert.notEqual(p.contactResearch.checks.phone.queryLog[0].query,oldPhone);assert.ok(!seen.includes(oldPhone));
});
