const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
function fixture(){
 const h=mounted({selected:'professional',runtimeSetup:`handoffContact=null;window.recipientReady=messageRecipientReady;window.beginManualEdit=()=>{handoffContact={domain:'buyer.example',personId:'p1',channel:'email',contact:{}};renderAll();messageEditor.edit();handoffContact.current=()=>false;};`});h.w.scrollTo=()=>{};
 const key='leadintel_customer_v2_discovery_meta',meta=JSON.parse(h.w.localStorage.getItem(key));Object.assign(meta.scriptBuyer,{contactId:'c1',email:'alex@buyer.example'});meta.visibleStep=6;h.w.localStorage.setItem(key,JSON.stringify(meta));
 const b=h.w.LeadIntelServerBridge;let reads=0;
 b.getCrmCompany=async()=>{reads++;return {ok:true,company:{id:'crm1',normalized_domain:'buyer.example',lifecycle_status:'prospect'},contacts:[{id:'c1',company_id:'crm1',external_person_id:'p1',name:'Alex Buyer',title:'Operations Director',work_email:'alex@buyer.example',email_status:'verified',verification_provider:'Apollo'}],activities:[]};};
 b.listCrmCompanies=async()=>({ok:true,companies:[{id:'crm1',normalized_domain:'buyer.example'}]});
 return {h,b,choice:meta.scriptBuyer,reads:()=>reads};
}
const settle=async()=>{for(let n=0;n<15;n++)await new Promise(r=>setImmediate(r));};
test('saved recipient recovers when workspace synchronization settles',async()=>{
 const {h,b,choice}=fixture();try{const before=h.item().drafts;b.resolvingSync=true;assert.equal(await h.w.openBuyerScripts(choice),false);assert.equal(h.w.recipientReady(),false);b.resolvingSync=false;h.w.dispatchEvent(new h.w.Event('leadintel:sync-settled'));await settle();assert.equal(h.w.recipientReady(),true);assert.deepEqual(h.item().drafts,before);}finally{h.w.close();}
});
test('server hydration restores a missing handoff, without repeatedly reading CRM after recovery',async()=>{
 const {h,reads}=fixture();try{h.w.dispatchEvent(new h.w.Event('leadintel:server-synced'));await settle();assert.equal(h.w.recipientReady(),true);const count=reads();for(let n=0;n<5;n++)h.w.dispatchEvent(new h.w.Event('leadintel:server-synced'));await settle();assert.equal(reads(),count);}finally{h.w.close();}
});
test('recovery preserves active manual edits and never accepts mismatched CRM identity',async()=>{
 for(const scenario of ['editing','wrong-contact']){const {h,b,reads}=fixture();try{
  if(scenario==='editing'){h.w.beginManualEdit();h.q('outreach-email-body').value='Keep my active edit';h.q('outreach-email-body').dispatchEvent(new h.w.Event('input',{bubbles:true}));}
  else b.getCrmCompany=async()=>({ok:true,company:{id:'crm1',normalized_domain:'buyer.example'},contacts:[{id:'c1',company_id:'crm1',name:'Someone Else',work_email:'alex@buyer.example',email_status:'verified',verification_provider:'Apollo'}]});
  h.w.dispatchEvent(new h.w.Event('leadintel:server-synced'));await settle();assert.equal(h.w.recipientReady(),false,scenario);
  if(scenario==='editing'){assert.equal(h.q('outreach-email-body').value,'Keep my active edit');assert.equal(reads(),0);}
 }finally{h.w.close();}}
});
test('duplicate sync notifications share one pending CRM validation',async()=>{
 const {h,b}=fixture();let release,reads=0;try{
  const get=b.getCrmCompany;b.getCrmCompany=async()=>{reads++;await new Promise(r=>release=r);return get();};
  for(let n=0;n<5;n++)h.w.dispatchEvent(new h.w.Event('leadintel:server-synced'));await settle();assert.equal(reads,1);release();await settle();assert.equal(h.w.recipientReady(),true);
 }finally{release?.();h.w.close();}
});
