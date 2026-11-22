const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),receipts=require('./helpers/buyer-research-receipts.cjs'),{runtime}=require('./helpers/buyer-controls-runtime.cjs');
test('actual UI reload and channel rendering retain all four researched people through sparse directory merges',()=>{
 const r=runtime();try{
  r.c.LeadIntelDiscovery=D;
  const candidate={...r.candidate,people:['Anna Buyer','Bob Buyer','Cara Buyer','Dana Buyer'].map((name,i)=>({...r.person,id:'local-'+i,name,publicName:name,title:'Procurement Director'}))};
  receipts(candidate);for(const p of candidate.people){p.emailResearch={status:'complete',checkedAt:new Date().toISOString(),searches:3,failed:0};p.contactResearch.channels=Object.fromEntries(['company','phone','linkedin','gmail'].map(k=>[k,{status:'complete'}]));}
  candidate.buyerDiscovery={pool:candidate.people.map(p=>({...p,contactResearch:null,emailResearch:{status:'not_searched'}})),companyContacts:candidate.people.map(p=>({...p,id:p.id,contactResearch:null,emailResearch:{status:'not_searched'}}))};
  r.storage.set(r.eval('DISCOVERY_STORAGE_KEY'),JSON.stringify({selectedProspects:[candidate]}));
  const loaded=r.c.loadDiscovery().selectedProspects[0];assert.equal(loaded.people.length,4);
  for(const person of loaded.people){
   assert.equal(person.emailResearch.status,'complete',person.name);
   for(const key of D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.equal(D.buyerResearchCheckPassed(loaded,person,key),true,person.name+': '+key);
   const html=r.c.buyerContactRows(person,loaded,{});assert.doesNotMatch(html,/Not checked/);assert.match(html,/Not found/);
  }
 }finally{r.close();}
});
// 22 Nov live: after the engine stopped keeping a saved person whose job title is the description of a
// publication, the Buyers step still showed that person. The reload put back every saved person the rebuilt
// roster had left out, as long as the name was a full name.
test('a reload does not put back a saved person whose job title is the description of a publication',()=>{
 const r=runtime();try{
  r.c.LeadIntelDiscovery=D;
  const people=[{...r.person,id:'local-0',name:'Anna Buyer',publicName:'Anna Buyer',title:'LinkedIn post about production leadership'},{...r.person,id:'local-1',name:'Bob Buyer',publicName:'Bob Buyer',title:'Procurement Director'},{...r.person,id:'local-2',name:'Cara Buyer',publicName:'Cara Buyer',title:'Public LinkedIn profile describes her as team lead for operational purchasing'}];
  const candidate={...r.candidate,people};receipts(candidate);
  candidate.buyerDiscovery={pool:people.map(person=>({...person})),companyContacts:[]};
  r.storage.set(r.eval('DISCOVERY_STORAGE_KEY'),JSON.stringify({selectedProspects:[candidate]}));
  const loaded=r.c.loadDiscovery().selectedProspects[0];
  assert.deepEqual(Array.from(loaded.people,person=>person.title),['Procurement Director']);
 }finally{r.close();}
});
