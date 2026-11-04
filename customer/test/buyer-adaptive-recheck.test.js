const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
test('an alternative official PDF adds an attributed email without treating the search excerpt as confirmation',async()=>{
 const person={id:'ada',name:'Ada Buyer',publicName:'Ada Buyer',title:'Procurement Director',organization:'Example'},candidate={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:[person]},url='https://example.com/supplier-project.pdf';
 const plan=D.buyerRecheckPlan(candidate,person),queries=[],reads=[];
 const report=await D.runMandatoryBuyerResearch(candidate,{recheckPlans:{ada:plan},search:async q=>{queries.push(q);return q.includes('supplier OR project')?[{url,title:'Ada Buyer supplier contacts',description:'Ada Buyer at Example'}]:[];},readPage:async u=>{reads.push(u);return {url:u,markdown:u===url?'### Ada Buyer\nProcurement Director\n[ada.buyer@example.com](mailto:ada.buyer@example.com)\nExample':'Example company website',sourceRead:true};}});
 assert.ok(queries.includes(plan.queries[1]));assert.ok(reads.includes(url));assert.equal(D.acceptedOfficialBuyerEmail(candidate,person),'ada.buyer@example.com');assert.equal(person.contactResearch.checks.followup.status,'complete');assert.equal(person.contactResearch.checks.followup.queryLog.length,4);assert.ok(report.tools.every(tool=>!['apollo','hunter'].includes(tool.provider)||tool.attempted===0));
});
test('successful same-identity checks are reused on focused Recheck and keep their original dates',async()=>{
 const person={id:'ada',name:'Ada Buyer',publicName:'Ada Buyer',title:'Procurement Director',organization:'Example'},candidate={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:[person]},page={url:'https://example.com/',markdown:'Example company website',sourceRead:true,extractedAt:new Date().toISOString()};
 await D.runMandatoryBuyerResearch(candidate,{search:async()=>[],readPage:async()=>page});
 const stamp=person.contactResearch.checks.phone.checkedAt,queries=[],plan=D.buyerRecheckPlan(candidate,person);
 await D.runMandatoryBuyerResearch(candidate,{rows:[page],recheckPlans:{ada:plan},search:async q=>{queries.push(q);return [];},readPage:async()=>page});
 assert.equal(person.contactResearch.checks.phone.checkedAt,stamp);assert.ok(!queries.includes(D.buyerResearchQueryPlan(candidate,person).phone[0]));assert.deepEqual(queries,plan.queries);
});
