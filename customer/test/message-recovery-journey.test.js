const {settleFactResearch}=require('./helpers/message-runtime.js');
const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const O=require('../outreach-engine.js'),E=require('../message-editor.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function crmFixture(h,{activities=[],page=[]}={}){
 h.w.scrollTo=()=>{};
 const key='leadintel_customer_v2_discovery_meta',meta=JSON.parse(h.w.localStorage.getItem(key));meta.scriptBuyer.contactId='c1';meta.scriptBuyer.email='alex@buyer.example';h.w.localStorage.setItem(key,JSON.stringify(meta));
 const detail={ok:true,company:{id:'crm1',normalized_domain:'buyer.example',lifecycle_status:'prospect'},contacts:[{company_id:'crm1',title:'Operations Director',verification_provider:'Apollo',id:'c1',external_person_id:meta.scriptBuyer.personId,name:'Alex Buyer',work_email:'alex@buyer.example',email_status:'verified'}],activities,activity_next_cursor:page.length?'next':''};
 Object.assign(h.w.LeadIntelServerBridge,{listCrmCompanies:async()=>({ok:true,companies:[detail.company]}),getCrmCompany:async()=>detail,getCrmActivities:async()=>({ok:true,activities:page,next_cursor:''})});
 return {choice:meta.scriptBuyer,detail};
}
function clearLocalMessages(h){const key='leadintel_customer_v2_outreach',state=JSON.parse(h.w.localStorage.getItem(key));state.items=[];state.buyerDrafts={};h.w.localStorage.setItem(key,JSON.stringify(state));h.w.dispatchEvent(new h.w.Event('leadintel:commercial-context-changed'));}
function saved(h,{person='p1',channel='email',mode='friendly',message='Saved message for Alex'}={}){
 const item=JSON.parse(JSON.stringify(h.item()));item.selectedPersonId=person;item.channel=channel;
 item.drafts={...item.drafts,...(channel==='email'?{emailSubject:'Saved subject',emailBody:message}:{linkedinMessage:message})};
 item.messageStudioDraft={...item.messageStudioDraft,mode,savePending:false,scriptSavedAt:'2026-10-11',savedDraft:{subject:channel==='email'?'Saved subject':'',message}};
 return {metadata:{script_package:O.buildCrmScriptSnapshot(item)},occurred_at:'2026-10-11'};
}
test('email reopening recovers the exact buyer/channel CRM draft when local message data is empty',async()=>{
 const h=mounted();try{
  const activity=saved(h),{choice}=crmFixture(h,{activities:[saved(h,{person:'p2'}),saved(h,{channel:'linkedin'}),activity]});
  clearLocalMessages(h);
  assert.equal(await h.w.openBuyerScripts(choice),true);
  assert.equal(h.item().drafts.emailBody,'Saved message for Alex');assert.equal(h.item().messageStudioDraft.mode,'friendly');
  assert.equal(h.q('outreach-email-body').value,'Saved message for Alex');assert.equal(h.q('mw-applied-style').textContent,'Style: Friendly');
  assert.equal(h.w.studioState().mode,'friendly');assert.equal(E.savedDraft(h.item()),true);
 }finally{h.w.close();}
});
test('CRM recovery continues past unrelated snapshots to an older page for this recipient',async()=>{
 const h=mounted();try{
  const {choice}=crmFixture(h,{activities:[saved(h,{person:'p2'})],page:[saved(h)]});
  clearLocalMessages(h);await h.w.openBuyerScripts(choice);
  assert.equal(h.item().drafts.emailBody,'Saved message for Alex');assert.equal(h.item().selectedPersonId,'p1');
 }finally{h.w.close();}
});
test('reopening preserves an unsaved local draft ahead of older CRM text',async()=>{
 const h=mounted();try{
  const {choice}=crmFixture(h,{activities:[saved(h)]});
  h.w.upsertItem(E.apply(h.item(),{subject:'Local subject',message:'Unsaved local text'},{origin:'manual'}));await h.w.openBuyerScripts(choice);
  assert.equal(h.item().drafts.emailBody,'Unsaved local text');assert.equal(E.savedDraft(h.item()),false);
 }finally{h.w.close();}
});
test('explicit CRM reopen never installs a different recipient or channel and updates the visible editor',async()=>{
 const h=mounted();try{
  crmFixture(h,{activities:[saved(h,{person:'p2',message:'Wrong buyer'}),saved(h,{channel:'linkedin',message:'Wrong channel'}),saved(h)]});
  await h.w.restoreScriptPackage();assert.equal(h.item().selectedPersonId,'p1');assert.equal(h.item().channel,'email');
  assert.equal(h.item().drafts.emailBody,'Saved message for Alex');assert.equal(h.q('outreach-email-body').value,'Saved message for Alex');assert.equal(h.w.studioState().mode,'friendly');
 }finally{h.w.close();}
});
test('a late CRM reopen cannot overwrite a new manual edit',async()=>{
 const h=mounted();try{
  const {detail}=crmFixture(h,{activities:[saved(h)]});let finish;h.w.LeadIntelServerBridge.getCrmCompany=()=>new Promise(resolve=>finish=resolve);
  const pending=h.w.restoreScriptPackage();await settle();
  h.w.upsertItem(E.apply(h.item(),{subject:'New subject',message:'New manual text'},{origin:'manual'}));h.w.renderAll();finish(detail);await pending;
  assert.equal(h.item().drafts.emailBody,'New manual text');assert.equal(h.q('outreach-email-body').value,'New manual text');
 }finally{h.w.close();}
});
test('failed style preparation preserves its retry selection while labelling the previous applied draft',async()=>{
 const h=mounted();try{
  h.q('message-mode').value='original';h.q('message-mode').dispatchEvent(new h.w.Event('change',{bubbles:true}));await settleFactResearch(h);h.requests.find(row=>row.url.includes('/api/ai/generate')).resolve({ok:false,json:async()=>({error:'Provider unavailable'})});await settle();
  assert.equal(h.w.studioState().mode,'original');assert.equal(h.q('message-mode').value,'original');
  assert.equal(h.w.document.querySelector('[data-writing-style="original"]'),null);
  assert.equal(h.q('mw-applied-style').textContent,'Style: Professional');assert.deepEqual(E.workingDraft(h.item()),h.before);
  assert.match(h.q('message-generation-status').textContent,/Provider unavailable/);
 }finally{h.w.close();}
});
test('fact research blocks edit, save and rewrite until its source update completes',async()=>{
 const h=mounted();try{
  h.w.fetch=async()=>{throw Error('Research unavailable');};
  const pending=h.w.refreshMessageFacts();
  for(const id of ['mw-edit-message','mw-save-message','mw-shorten-message','mw-rewrite-message','message-generate'])assert.equal(h.q(id).disabled,true,id+' must wait for research');
  await pending;assert.equal(h.q('mw-edit-message').disabled,false);
 }finally{h.w.close();}
});
test('unavailable CRM history cannot create a false empty recovery or erase local content',async()=>{
 const h=mounted();try{
  const {choice}=crmFixture(h,{activities:[saved(h,{person:'p2'})],page:[saved(h)]});
  h.w.LeadIntelServerBridge.getCrmActivities=async()=>({ok:false});clearLocalMessages(h);
  await assert.rejects(h.w.openBuyerScripts(choice),/CRM history could not load/);
  assert.equal(h.item(),undefined);assert.equal(h.w.localStorage.getItem('leadintel_customer_v2_outreach').includes('Wrong buyer'),false);
 }finally{h.w.close();}
});
test('a newer buyer handoff owns recovery and a late CRM response cannot install the old recipient',async()=>{
 const h=mounted();try{
  const {choice,detail}=crmFixture(h,{activities:[saved(h)]});clearLocalMessages(h);let finish;let calls=0;
  h.w.LeadIntelServerBridge.getCrmCompany=()=>++calls===1?new Promise(resolve=>finish=resolve):Promise.resolve(detail);
  const first=h.w.openBuyerScripts(choice);await settle();
  const second=h.w.openBuyerScripts(choice);assert.equal(await second,true);finish({...detail,activities:[saved(h,{message:'Late obsolete text'})]});assert.equal(await first,false);
  assert.equal(h.item().drafts.emailBody,'Saved message for Alex');
 }finally{h.w.close();}
});
test('cached buyer drafts reopen with their applied style rather than the previous buyer selection',async()=>{
 const h=mounted();try{
  const {choice}=crmFixture(h),cached=saved(h).metadata.script_package.item;
  const key='leadintel_customer_v2_outreach',state=JSON.parse(h.w.localStorage.getItem(key));state.items=[];state.buyerDrafts={[O.buyerDraftKey('buyer.example','p1','email')]:cached};h.w.localStorage.setItem(key,JSON.stringify(state));h.w.dispatchEvent(new h.w.Event('leadintel:commercial-context-changed'));
  await h.w.openBuyerScripts(choice);assert.equal(h.w.studioState().mode,'friendly');assert.equal(h.q('outreach-email-body').value,'Saved message for Alex');
 }finally{h.w.close();}
});

test('explicit CRM reopen rejects a same-ID snapshot belonging to a replaced person',async()=>{
 const h=mounted();try{
  const wrong=saved(h,{message:'Wrong replacement message'});wrong.metadata.script_package.item.dossier.people[0].name='Different Buyer';
  crmFixture(h,{activities:[wrong]});const before=h.item().drafts.emailBody;
  await h.w.restoreScriptPackage();assert.equal(h.item().drafts.emailBody,before);assert.doesNotMatch(h.q('outreach-email-body').value,/Wrong replacement/);
 }finally{h.w.close();}
});
