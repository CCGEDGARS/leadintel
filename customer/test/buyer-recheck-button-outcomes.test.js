const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const {runtime}=require('./helpers/buyer-controls-runtime.cjs');
function setup(r,{available=false}={}){
 const old=new Date(Date.now()-40*86400000).toISOString(),url='https://example.com/team',oldPhone='+371 2211 0000',newPhone='+371 2211 9999';
 const prior={url,markdown:`Avery Buyer — Procurement Director at Example. Phone ${oldPhone}`,sourceRead:true,extractedAt:old};r.candidate.people=[r.person];Object.assign(r.person,D.matchPublicBuyerDetails([r.person],[prior],'example.com','Example')[0]);r.candidate.__leadIntelBuyerSources=[prior];
 const reads=[],queries=[];let paid=0;
 r.c.LeadIntelCompanyDossierUi={research:async()=>({}),evidenceRows:()=>[{...prior,extractedAt:undefined}]};
 r.c.searchBuyerPublicPages=async query=>{queries.push(query);return [];};r.c.groundedGeminiPersonSearch=async()=>({status:'not_configured',results:[]});
 r.c.fetchFirecrawlBuyerResearch=async(_kind,body)=>{reads.push(body.url);if(!available)return {ok:false,json:async()=>({error:'Controlled source unavailable'})};return {ok:true,json:async()=>({data:{url:body.url,markdown:body.url===url?`Avery Buyer — Procurement Director at Example. Phone ${newPhone}`:'Example official business website'}})};};
 r.c.fetch=async()=>({ok:false,json:async()=>({error:'Controlled fallback unavailable'})});r.c.reviewBuyerPublicEvidence=async()=>({status:'unavailable',reason:'Controlled offline review unavailable'});r.c.LeadIntelAdditionalContacts={auto:async()=>{paid++;}};
 r.b.saveCrmContacts=async()=>({ok:true});r.b.saveCrmCompany=async()=>({ok:true,company:{id:'company',workspace_id:'w',normalized_domain:'example.com'}});
 return {old,url,oldPhone,newPhone,reads,queries,paid:()=>paid};
}
test('actual Recheck outage cannot refresh historical phone or mark coverage complete',async()=>{
 const r=runtime();try{const f=setup(r),prior=structuredClone(r.person.publicPhoneEvidence);await r.c.recheckBuyerContact('example.com',0,{personId:r.person.id});
 assert.ok(f.reads.includes(f.url));assert.ok(f.queries.length>=9);assert.deepEqual(JSON.parse(JSON.stringify(r.person.publicPhoneEvidence)),prior);assert.equal(D.confirmedBuyerPhone(r.candidate,r.person),'');assert.equal(r.candidate.publicContactStatus,'error');assert.equal(r.candidate.publicResearch.accountability.status,'partial');assert.equal(f.paid(),0);
 }finally{r.close();}
});
test('actual Recheck can update a source-confirmed phone while email and Proceed remain independent',async()=>{
 const r=runtime();try{const f=setup(r,{available:true});await r.c.recheckBuyerContact('example.com',0,{personId:r.person.id});
 assert.ok(f.reads.includes(f.url));assert.ok(f.queries.length>=9);assert.equal(r.person.publicPhone,f.newPhone);assert.equal(D.confirmedBuyerPhone(r.candidate,r.person),f.newPhone);assert.equal(f.paid(),0);
 const node=r.dom.window.document.createElement('div');node.innerHTML=r.c.prospectContactControls(r.candidate,r.person);assert.equal(node.querySelector('[data-prospect-enrich-phone]').getAttribute('aria-pressed'),'true');assert.equal(node.querySelector('[data-prospect-enrich-email]').getAttribute('aria-pressed'),'false');assert.equal(node.querySelector('[data-keep-buyer]').disabled,true);
 }finally{r.close();}
});
