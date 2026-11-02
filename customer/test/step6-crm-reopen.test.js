const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const O=require('../outreach-engine.js'),E=require('../message-editor.js');
function fixture(h,{page=false}={}){
 h.w.scrollTo=()=>{};
 const key='leadintel_customer_v2_discovery_meta',meta=JSON.parse(h.w.localStorage.getItem(key));meta.scriptBuyer.contactId='c1';meta.scriptBuyer.email='alex@buyer.example';h.w.localStorage.setItem(key,JSON.stringify(meta));
 const local=h.item();local.messageStudioDraft.scriptSavedAt='2026-10-01T09:00:00.000Z';h.w.upsertItem(local);
 const next={...local,drafts:{...local.drafts,emailSubject:'Newer CRM subject',emailBody:'Newer exact CRM body'},messageStudioDraft:{...local.messageStudioDraft,scriptSavedAt:'2026-10-02T09:00:00.000Z',savedDraft:{subject:'Newer CRM subject',message:'Newer exact CRM body'}}};
 const activity={id:'new-save',occurred_at:'2026-10-02T09:00:00.000Z',metadata:{script_package:O.buildCrmScriptSnapshot(next)}};
 const detail={ok:true,company:{id:'crm1',normalized_domain:'buyer.example',lifecycle_status:'prospect'},contacts:[{company_id:'crm1',title:'Operations Director',verification_provider:'Apollo',id:'c1',external_person_id:'p1',name:'Alex Buyer',work_email:'alex@buyer.example',email_status:'verified'}],activities:page?[]:[activity],activity_next_cursor:page?'next':null};
 let reads=0;Object.assign(h.w.LeadIntelServerBridge,{listCrmCompanies:async()=>({ok:true,companies:[detail.company]}),getCrmCompany:async()=>{reads++;return detail;},getCrmActivities:async()=>({ok:true,activities:[activity],next_cursor:null})});
 return {choice:meta.scriptBuyer,activity,next,reads:()=>reads};
}
test('fresh hydration reconciles an older acknowledged workspace copy with the exact newer CRM save',async()=>{
 const h=mounted({selected:'professional'});try{const f=fixture(h);assert.equal(await h.w.openBuyerScripts(f.choice),true);assert.equal(f.reads(),1);assert.equal(h.item().drafts.emailSubject,'Newer CRM subject');assert.equal(h.q('outreach-email-body').value,'Newer exact CRM body');assert.equal(E.savedDraft(h.item()),true);assert.equal(h.item().approved,false);}finally{h.w.close();}
});
test('reopening preserves a newer unsaved local edit instead of replacing it with a CRM version',async()=>{
 const h=mounted({selected:'professional'});try{const f=fixture(h);h.w.upsertItem(E.apply(h.item(),{subject:'Working subject',message:'My unsaved customer edit'},{origin:'manual'}));assert.equal(await h.w.openBuyerScripts(f.choice),true);assert.equal(h.q('outreach-email-body').value,'My unsaved customer edit');assert.equal(E.savedDraft(h.item()),false);}finally{h.w.close();}
});
test('a late paginated CRM read cannot overwrite an edit made while reopening',async()=>{
 const h=mounted({selected:'professional'});try{const f=fixture(h,{page:true});let release,started;const began=new Promise(r=>started=r);h.w.LeadIntelServerBridge.getCrmActivities=()=>{started();return new Promise(r=>release=r);};const opening=h.w.openBuyerScripts(f.choice);await began;h.w.upsertItem(E.apply(h.item(),{subject:'Latest edit',message:'Typed during CRM read'},{origin:'manual'}));release({ok:true,activities:[f.activity],next_cursor:null});assert.equal(await opening,true);assert.equal(h.q('outreach-email-body').value,'Typed during CRM read');assert.equal(E.savedDraft(h.item()),false);}finally{h.w.close();}
});
