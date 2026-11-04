const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),receipts=require('./helpers/buyer-research-receipts.cjs');
const stamp=()=>new Date().toISOString();
function fixture(){const p={id:'alex',name:'Alex Morgan',publicName:'Alex Morgan',title:'Head of Procurement',organization:'Acme Labs',publicNameUrl:'https://acme.example/team',publicLinkedinUrl:'https://linkedin.com/in/alex-morgan',identityStatus:'confirmed',emailResearch:{status:'complete',searches:12,failed:0,checkedAt:stamp()}},c={company:'Acme Labs',domain:'acme.example',buyerRoles:['Head of Procurement'],people:[p]};receipts(c);return {p,c,row:{url:p.publicNameUrl,markdown:'Alex Morgan is Head of Procurement at Acme Labs.',sourceRead:true,extractedAt:stamp()}};}
for(const mode of ['force','expired_receipt','different_query','different_identity','legacy_profile'])test('a '+mode+' profile must execute its current query instead of taking the resume shortcut',async()=>{
 const {p,c,row}=fixture(),expected=D.buyerResearchQueryPlan(c,p).linkedin[0],calls=[];
 if(mode==='expired_receipt')p.contactResearch.checks.linkedin.queryLog[0].checkedAt=new Date(Date.now()-31*86400000).toISOString();
 if(mode==='different_query')p.contactResearch.checks.linkedin.queryLog[0].query='Old unrelated query';
 if(mode==='different_identity')p.contactResearch.identityKey='old identity';
 if(mode==='legacy_profile')p.contactResearch.checks.linkedin.profileMatchVersion=1;
 await D.runMandatoryBuyerResearch(c,{force:mode==='force',rows:[row],currentRows:[row],search:async q=>{calls.push(q);return [];}});assert.ok(calls.includes(expected));
});
test('cached profile work cannot hide new exact-profile employer evidence from common reconciliation',async()=>{
 const {p,c,row}=fixture(),url=p.publicLinkedinUrl,calls=[];const other={url,title:'Alex Morgan – Head of Procurement – Other Business | LinkedIn',markdown:'Alex Morgan is currently Head of Procurement at Other Business.',sourceRead:true,extractedAt:stamp()};
 await D.runMandatoryBuyerResearch(c,{rows:[row,other],buyerAgentContext:D.buyerAgentContext(c),search:async q=>{calls.push(q);return [];}});
 assert.ok(!calls.some(q=>D.buyerResearchQueryPlan(c,p).linkedin.includes(q)),'Fresh exact profile queries are reused');assert.equal(D.linkedInVerification(p,c).status,'review_required');assert.equal(p.publicLinkedinUrl,url);assert.equal(D.qualifyBuyer(p,{decisionMakers:'Head of Procurement'},c).eligible,false);assert.equal(c.publicResearch.buyerAgent.people[0].identity,'conflict');
});
test('unfinished targeted Agent work runs before a completed prefix consumes a bounded pass',async t=>{
 const base=Date.now()+100;let spent=0;t.mock.method(Date,'now',()=>base+spent);
 const names=['Anna Berg','Bob Carter','Celia Davis','Daniel Evans','Emma Fisher','Fred Green','Grace Hall','Henry Irving','Ida Jones','Julia King'],c={company:'Acme Labs',domain:'acme.example',buyerRoles:['Head of Procurement'],people:names.map((name,i)=>({id:String(i),name,publicName:name,title:'Head of Procurement',organization:'Acme Labs',publicNameUrl:'https://acme.example/team',identityStatus:'confirmed',emailResearch:{status:'complete',searches:12,failed:0,checkedAt:stamp()}}))};
 receipts(c);const context=D.buyerAgentContext(c);for(const p of c.people)p.contactResearch.checks.buyer_agent={status:'complete',checkedAt:stamp(),queryLog:D.buyerAgentQueries(c,p,context).map(query=>({query,status:'complete',checkedAt:stamp(),sourceReads:[],resultCount:0}))};
 const target=c.people.at(-1);target.contactResearch.checks.buyer_agent.status='partial';target.contactResearch.checks.buyer_agent.queryLog.forEach(q=>q.status='partial');const queries=D.buyerAgentQueries(c,target,context),calls=[];
 await D.runMandatoryBuyerResearch(c,{maxDurationMs:100,buyerAgentContext:context,rows:[{url:'https://acme.example/team',markdown:names.map(name=>`${name} is Head of Procurement at Acme Labs.`).join('\n'),sourceRead:true,extractedAt:stamp()}],guard:async()=>{spent+=8;},search:async q=>{calls.push(q);return [];}});
 assert.deepEqual(calls.filter(q=>queries.includes(q)),queries);assert.equal(target.contactResearch.checks.buyer_agent.status,'complete');assert.deepEqual(c.people.map(p=>p.id),names.map((_,i)=>String(i)));
});
