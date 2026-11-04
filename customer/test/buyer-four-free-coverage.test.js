const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),P=require('../additional-contact-policy.js');
test('all four priority buyers finish every free channel before the hidden roster, even with an official email',async()=>{
 const names=['Alex Smith','Bo Svensson','Cecilia Berg','David Lind','Emma Wilson','Felix Turner'];
 const people=['Office Manager','Office Manager','Chief Executive Officer','Chief Operating Officer','Head of Procurement','Project Director'].map((title,i)=>({id:'p'+i,name:names[i],title,organization:'Example',publicNameUrl:'https://example.com/team'}));
 const c={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:'Chief Executive Officer; Chief Operating Officer; Head of Procurement; Project Director',people},queries=[];
 const page={url:'https://example.com/team',sourceRead:true,extractedAt:new Date().toISOString(),markdown:names.map((name,i)=>`### ${name}\n${people[i].title}\n${name.toLowerCase().replace(' ','.')}@example.com\nExample`).join('\n\n')};
 await D.runMandatoryBuyerResearch(c,{rows:[page],search:async q=>{queries.push(q);return [];},readPage:async()=>page});
 const priorities=D.mandatoryBuyerResearchPriorities(people,c,{forExecution:true});assert.deepEqual(priorities.map(p=>p.id),['p2','p3','p4','p5']);
 const hiddenStart=Math.min(...people.slice(0,2).map(p=>queries.indexOf(D.buyerResearchQueryPlan(c,p).official[0])));
 for(const p of priorities){
  assert.ok(D.acceptedOfficialBuyerEmail(c,p));
  for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks){assert.equal(D.buyerResearchCheckPassed(c,p,key),true,`${p.id}: ${key}`);for(const q of D.buyerResearchQueryPlan(c,p)[key])assert.ok(queries.indexOf(q)<hiddenStart,`${key} must precede hidden-buyer work`);}
  assert.equal(p.contactResearch.checks.gmail.queryLog.length,3);
 }
 const saved=JSON.parse(JSON.stringify(D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0]));
 for(const p of saved.people)for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.equal(D.buyerResearchCheckPassed(saved,p,key),true,`reload ${p.id}: ${key}`);
});
