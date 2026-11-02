const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js'),O=require('../outreach-engine.js'),E=require('../message-editor.js');

function fixture({paginated=false}={}){
 const h=mounted({selected:'professional',runtimeSetup:'window.step6EditorState=()=>messageEditor.state();window.step6BeginEdit=()=>messageEditor.edit();'});h.w.scrollTo=()=>{};
 const key='leadintel_customer_v2_discovery_meta',meta=JSON.parse(h.w.localStorage.getItem(key));meta.scriptBuyer.contactId='c1';meta.scriptBuyer.email='alex@buyer.example';h.w.localStorage.setItem(key,JSON.stringify(meta));
 const local=h.item();local.messageStudioDraft={...local.messageStudioDraft,editorOrigin:'manual',scriptSavedAt:'2026-10-01T09:00:00.000Z'};h.w.upsertItem(local);
 const remote={...local,drafts:{...local.drafts,emailSubject:'Newer CRM subject',emailBody:'Newer acknowledged CRM body'},messageStudioDraft:{...local.messageStudioDraft,scriptSavedAt:'2026-10-02T09:00:00.000Z',savedDraft:{subject:'Newer CRM subject',message:'Newer acknowledged CRM body'}}};
 const activity={id:'newer-crm-save',occurred_at:'2026-10-02T09:00:00.000Z',metadata:{script_package:O.buildCrmScriptSnapshot(remote)}},detail={ok:true,company:{id:'crm1',normalized_domain:'buyer.example',lifecycle_status:'prospect'},contacts:[{company_id:'crm1',title:'Operations Director',verification_provider:'Apollo',id:'c1',external_person_id:'p1',name:'Alex Buyer',work_email:'alex@buyer.example',email_status:'verified'}],activities:paginated?[]:[activity],activity_next_cursor:paginated?'older-page':null};
 let companyReads=0,release,started;const began=new Promise(resolve=>started=resolve);
 Object.assign(h.w.LeadIntelServerBridge,{listCrmCompanies:async()=>({ok:true,companies:[detail.company]}),getCrmCompany:async()=>{companyReads++;return detail;},getCrmActivities:async()=>{started();return new Promise(resolve=>release=resolve);}});
 return {h,choice:meta.scriptBuyer,began,reads:()=>companyReads,release:()=>release?.({ok:true,activities:[activity],next_cursor:null})};
}

function type(h,message){h.q('outreach-email-body').value=message;h.q('outreach-email-body').dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(h.w.step6EditorState().editing,true);assert.notEqual(h.item().drafts.emailBody,message,'the active editor buffer is distinct from the acknowledged item');assert.equal(E.savedDraft(h.item()),true,'the stored item still has its earlier acknowledgement');}

test('reopening the same buyer defers while an active manual editor buffer contains unsaved text',async()=>{
 const f=fixture(),{h}=f;try{
  h.q('mw-edit-message').click();type(h,'My unsaved manual editor buffer.\n\nKeep this exact text.');const before=h.item();assert.equal(O.canReconcileSavedBuyerDraft(before),true,'an item-only check cannot see the active DOM edit');
  const opened=await h.w.openBuyerScripts(f.choice);
  assert.equal(h.q('outreach-email-body').value,'My unsaved manual editor buffer.\n\nKeep this exact text.');assert.equal(h.w.step6EditorState().editing,true);assert.deepEqual(h.item(),before);assert.equal(opened,false);assert.equal(f.reads(),0,'a deferred handoff does not start CRM reconciliation');
 }finally{h.w.close();}
});

test('an editor buffer started during paginated CRM hydration prevents the late handoff from committing',async()=>{
 const f=fixture({paginated:true}),{h}=f;let opening;try{
  opening=h.w.openBuyerScripts(f.choice);await Promise.race([f.began,opening.then(()=>{throw Error('Handoff ended before the controlled CRM history page');})]);
  assert.equal(h.w.step6BeginEdit(),true,'the real editor controller enters edit mode in the same authenticated context');type(h,'Text entered while the CRM page was pending.');const before=h.item();
  f.release();const opened=await opening;
  assert.equal(h.q('outreach-email-body').value,'Text entered while the CRM page was pending.');assert.equal(h.w.step6EditorState().editing,true);assert.deepEqual(h.item(),before);assert.equal(opened,false);
 }finally{f.release();await opening;h.w.close();}
});
