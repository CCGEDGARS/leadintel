const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
function fixture(){
 const h=mounted({selected:'professional',runtimeSetup:'window.recipientReady=messageRecipientReady;window.recipientQuality=messageQualityContext;'});h.w.scrollTo=()=>{};
 const key='leadintel_customer_v2_discovery_meta',meta=JSON.parse(h.w.localStorage.getItem(key));
 Object.assign(meta.scriptBuyer,{contactId:'c1',email:'alex@buyer.example'});h.w.localStorage.setItem(key,JSON.stringify(meta));
 const company={id:'crm1',normalized_domain:'buyer.example',lifecycle_status:'prospect'},contact={id:'c1',company_id:'crm1',external_person_id:'p1',name:'Alex Buyer',title:'Operations Director',work_email:'alex@buyer.example',email_status:'verified',verification_provider:'Apollo'};
 Object.assign(h.w.LeadIntelServerBridge,{listCrmCompanies:async()=>({ok:true,companies:[company]}),getCrmCompany:async()=>({ok:true,company,contacts:[contact],activities:[]})});
 return {h,choice:meta.scriptBuyer,updateConflict(personId){const k='leadintel_customer_v2_discovery',d=JSON.parse(h.w.localStorage.getItem(k));d.pipeline[0].publicResearch={conflicts:[{person_id:personId,reason:'Current role needs verification'}]};h.w.localStorage.setItem(k,JSON.stringify(d));}};
}
test('another buyer role review cannot invalidate the selected Messages recipient',async()=>{
 const f=fixture();try{
 assert.equal(await f.h.w.openBuyerScripts(f.choice),true);assert.equal(f.h.w.recipientReady(),true);
 const before=f.h.item();f.updateConflict('other-buyer');
 assert.equal(f.h.w.recipientReady(),true);assert.deepEqual(f.h.item(),before);
 }finally{f.h.w.close();}
});
test('a role conflict on the selected buyer still invalidates the Messages recipient',async()=>{
 const f=fixture();try{assert.equal(await f.h.w.openBuyerScripts(f.choice),true);f.updateConflict('p1');assert.equal(f.h.w.recipientReady(),false);assert.equal(await f.h.w.openBuyerScripts(f.choice),false);}finally{f.h.w.close();}
});

test('pending CRM handoff reports progress and refreshes readiness when it finishes',async()=>{
 const f=fixture();let release;try{
 const get=f.h.w.LeadIntelServerBridge.getCrmCompany;let refreshed=0;
 f.h.w.LeadIntelPageQuality={check:require('../page-quality.js').check,getReport(){return null;},refresh(){refreshed++;}};
 f.h.w.LeadIntelServerBridge.getCrmCompany=()=>new Promise(resolve=>release=async()=>resolve(await get()));
 const opening=f.h.w.openBuyerScripts(f.choice);await new Promise(resolve=>setImmediate(resolve));
 const check=f.h.w.recipientQuality().checks.find(row=>row.id==='recipient-confirmed');
 assert.equal(check.status,'pending');assert.equal(check.state,'preparing');assert.match(check.message,/Checking the selected recipient/);assert.equal(check.target,null);
 await release();assert.equal(await opening,true);assert.ok(refreshed>0);
 assert.equal(f.h.w.recipientQuality().checks.find(row=>row.id==='recipient-confirmed').status,'pass');
 }finally{await release?.();f.h.w.close();}
});
