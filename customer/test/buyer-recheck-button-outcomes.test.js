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

test('Recheck explicitly explains a sync conflict without launching research',async()=>{
 const r=runtime();try{r.candidate.people=[r.person];r.b.conflict=true;const messages=[];r.c.showToast=message=>messages.push(message);let requests=0;r.c.findPublicProspectContacts=async()=>{requests++;};
 assert.equal(await r.c.recheckBuyerContact('example.com',0,{personId:r.person.id}),false);assert.equal(requests,0);assert.match(messages.join(' '),/sync conflict/i);
 }finally{r.close();}
});

test('durable Recheck acknowledges a delayed command immediately and prevents duplicate clicks',async()=>{
 const r=runtime();try{
  let finish,requests=0;r.c.LeadIntelBuyerResearchJobs={};
  r.c.findPublicProspectContacts=async()=>{requests++;return new Promise(resolve=>finish=resolve);};
  const work=r.c.recheckBuyerContact('example.com',0,{personId:r.person.id});
  const node=r.dom.window.document.createElement('div');node.innerHTML=r.c.prospectContactControls(r.candidate,r.person);
  assert.equal(node.querySelector('[data-recheck-buyer]').disabled,true);
  assert.equal(node.querySelector('[data-recheck-buyer]').textContent,'Rechecking…');
  assert.equal(await r.c.recheckBuyerContact('example.com',0,{personId:r.person.id}),false);
  assert.equal(requests,1);finish(true);assert.equal(await work,true);
  node.innerHTML=r.c.prospectContactControls(r.candidate,r.person);assert.equal(node.querySelector('[data-recheck-buyer]').disabled,false);
 }finally{r.close();}
});
test('durable Recheck exposes startup failures and releases its pending state',async()=>{
 const r=runtime();try{
  r.c.LeadIntelBuyerResearchJobs={};r.c.findPublicProspectContacts=async()=>{throw Error('Research service unavailable');};
  assert.equal(await r.c.recheckBuyerContact('example.com',0,{personId:r.person.id}),false);
  assert.ok(r.calls.includes('Research service unavailable'));
  const node=r.dom.window.document.createElement('div');node.innerHTML=r.c.prospectContactControls(r.candidate,r.person);assert.equal(node.querySelector('[data-recheck-buyer]').disabled,false);
 }finally{r.close();}
});


test('durable selected recheck marks only that buyer busy and preserves other ready controls',()=>{
 const r=runtime();try{
  const other={...r.person,id:'other',name:'Other Buyer'};r.candidate.people=[r.person,other];r.candidate.peopleStatus='loading';r.candidate.publicContactStatus='loading';r.candidate.buyerResearchJob={id:'selected-job',status:'running',personIds:[String(r.person.id)],startedAt:new Date(Date.now()-40000).toISOString()};r.candidate.buyerResearchProgress={startedAt:r.candidate.buyerResearchJob.startedAt,label:'Reading official contact page',timing:{estimate:{samples:8,lowerSeconds:60,upperSeconds:180}}};
  r.c.verifiedBuyerEmail=()=> 'confirmed@example.com';
  const node=r.dom.window.document.createElement('div');node.innerHTML=r.c.prospectContactControls(r.candidate,r.person);
  assert.equal(node.querySelector('[data-recheck-buyer]').textContent,'Rechecking…');assert.match(node.querySelector('[data-buyer-contact-progress]').textContent,/Reading official contact page.*40s elapsed.*1–3 min remaining/);
  node.innerHTML=r.c.prospectContactControls(r.candidate,other);assert.equal(node.querySelector('[data-buyer-contact-progress]'),null);assert.equal(node.querySelector('[data-recheck-buyer]').textContent,'Recheck');assert.equal(node.querySelector('[data-prospect-enrich-email]').disabled,false);assert.equal(node.querySelector('[data-keep-buyer]').disabled,false);assert.match(node.textContent,/another buyer/);
 }finally{r.close();}
});
test('contact progress reports unknown estimates honestly and queue waits explicitly',()=>{
 const r=runtime();try{r.candidate.buyerResearchProgress={startedAt:new Date(Date.now()-10000).toISOString(),executionStatus:'queued',label:'Contact evidence',timing:{estimate:{samples:1,lowerSeconds:30,upperSeconds:60}}};assert.match(r.c.buyerContactProgressText(r.candidate),/Waiting to continue.*10s elapsed.*Time estimate not available yet/);}finally{r.close();}
});
