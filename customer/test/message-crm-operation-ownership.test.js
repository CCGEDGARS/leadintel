const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js'),E=require('../message-editor.js'),O=require('../outreach-engine.js');
function deferred(){let resolve;return {promise:new Promise(r=>resolve=r),resolve};}
async function fixture(){
 const h=mounted({runtimeSetup:'window.fixtureCancelFact=()=>{messageFactResearchRequest++;messageFactResearchController?.abort();messageFactResearchBusy=false;};'}),b=h.w.LeadIntelServerBridge;h.w.scrollTo=()=>{};h.w.LeadIntelCrm=require('../crm-engine.js');b.session.user.id='u1';const company={id:'crm1',normalized_domain:'buyer.example'},contact={id:'c1',company_id:'crm1',external_person_id:'p1',name:'Alex Buyer',title:'Operations Director',work_email:'alex@buyer.example',email_status:'verified',verification_provider:'Apollo'};let activities=0,creates=0,moves=0,reads=0;
 b.listCrmCompanies=async()=>({ok:true,companies:[company]});b.getCrmCompany=async()=>{reads++;return {ok:true,company,contacts:[contact],activities:[]};};b.saveCrmCompany=async()=>{creates++;return {ok:true,company};};b.recordCrmActivity=async()=>{activities++;return {ok:true};};b.addCrmToPipeline=async()=>{moves++;return {ok:true,company};};
 const key='leadintel_customer_v2_discovery_meta',meta=JSON.parse(h.w.localStorage.getItem(key));Object.assign(meta.scriptBuyer,{contactId:'c1',email:'alex@buyer.example'});h.w.localStorage.setItem(key,JSON.stringify(meta));assert.equal(await h.w.openBuyerScripts(meta.scriptBuyer),true);
 h.w.upsertItem(E.apply(h.item(),{subject:'Manual subject',message:'Exact unsaved manual body'},{origin:'manual'}));h.w.renderAll();
 return {h,b,company,contact,get activities(){return activities;},get creates(){return creates;},get moves(){return moves;},get reads(){return reads;}};
}
function change(f,kind){const w=f.h.w;if(kind==='user')f.b.session.user.id='u2';if(kind==='bridge')w.LeadIntelServerBridge={...f.b};if(kind==='auth')f.b.session.authenticated=false;if(kind==='conflict')f.b.conflict=true;if(kind==='account')w.localStorage.setItem('leadintel_account_context_v1','new-account-ticket');if(kind==='recipient'){const key='leadintel_customer_v2_discovery_meta',meta=JSON.parse(w.localStorage.getItem(key));meta.scriptBuyer={...meta.scriptBuyer,contactId:'replacement'};w.localStorage.setItem(key,JSON.stringify(meta));}}
test('mounted Save cannot write a captured body after same-workspace user, bridge, account or recipient changes during CRM lookup',{timeout:15000},async()=>{
 for(const kind of ['user','bridge','auth','conflict','account','recipient']){const f=await fixture();try{const gate=deferred(),started=deferred();f.b.listCrmCompanies=()=>{started.resolve();return gate.promise;};const before=f.h.item().messageStudioDraft.scriptSavedAt,pending=f.h.w.saveScriptPackage();await started.promise;change(f,kind);gate.resolve({ok:true,companies:[f.company]});await pending;assert.equal(f.activities,0,kind);assert.equal(f.creates,0,kind);assert.equal(f.h.item().messageStudioDraft.scriptSavedAt,before,kind);assert.equal(f.h.item().drafts.emailBody,'Exact unsaved manual body');}finally{f.h.w.close();}}
});
test('mounted Save never records an activity after account replacement while CRM company creation settles',{timeout:15000},async()=>{
 const f=await fixture();try{const gate=deferred(),started=deferred();f.b.listCrmCompanies=async()=>({ok:true,companies:[]});f.b.saveCrmCompany=()=>{started.resolve();return gate.promise;};const before=f.h.item().messageStudioDraft.scriptSavedAt,pending=f.h.w.saveScriptPackage();await started.promise;change(f,'user');gate.resolve({ok:true,company:f.company});await pending;assert.equal(f.activities,0);assert.equal(f.h.item().messageStudioDraft.scriptSavedAt,before);}finally{f.h.w.close();}
});
test('mounted Save cannot acknowledge or dispatch a late activity result to a replacement user',{timeout:15000},async()=>{
 const f=await fixture();try{const gate=deferred(),started=deferred();let events=0;f.h.w.addEventListener('leadintel:crm-changed',()=>events++);f.b.recordCrmActivity=()=>{started.resolve();return gate.promise;};const before=f.h.item().messageStudioDraft.scriptSavedAt,pending=f.h.w.saveScriptPackage();await started.promise;change(f,'user');gate.resolve({ok:true});await pending;assert.equal(f.h.item().messageStudioDraft.scriptSavedAt,before);assert.equal(events,0);assert.equal(f.h.item().drafts.emailBody,'Exact unsaved manual body');}finally{f.h.w.close();}
});
test('mounted CRM sync cannot move pipeline stage after its captured user changed during activity persistence',{timeout:15000},async()=>{
 const f=await fixture();try{const gate=deferred(),started=deferred();f.b.recordCrmActivity=()=>{started.resolve();return gate.promise;};const pending=f.h.w.syncCrmActivity(f.h.w.selectedCandidate(),{activity:{type:'dossier.built'},stage:'Contacted'});await started.promise;change(f,'user');gate.resolve({ok:true});await pending;assert.equal(f.moves,0);}finally{f.h.w.close();}
});
test('mounted explicit Reopen rejects a same-workspace user change during CRM company lookup',{timeout:15000},async()=>{
 const f=await fixture();try{const gate=deferred(),started=deferred();f.b.listCrmCompanies=()=>{started.resolve();return gate.promise;};const before=f.h.item().drafts.emailBody,reads=f.reads,pending=f.h.w.restoreScriptPackage();await started.promise;change(f,'user');gate.resolve({ok:true,companies:[f.company]});await pending;assert.equal(f.reads,reads);assert.equal(f.h.item().drafts.emailBody,before);}finally{f.h.w.close();}
});

test('mounted fact research discards a source response after the same-workspace user changes',{timeout:15000},async()=>{
 const f=await fixture();try{
  f.h.w.fixtureCancelFact();const gate=deferred(),started=deferred();f.h.w.fetch=()=>{started.resolve();return gate.promise;};const before=JSON.stringify(f.h.item().dossier.evidence),pending=f.h.w.refreshMessageFacts();await started.promise;change(f,'user');gate.resolve({ok:true,json:async()=>({data:[{url:'https://buyer.example/new',markdown:'Buyer is investing in a new manufacturing plant at Newport.'}]})});await pending;assert.equal(JSON.stringify(f.h.item().dossier.evidence),before);assert.equal(f.h.item().drafts.emailBody,'Exact unsaved manual body');
 }finally{f.h.w.close();}
});
test('mounted Add to flow cannot mutate the replacement account after Delivery module loading',{timeout:15000},async()=>{
 const f=await fixture();try{
  const item=f.h.item();item.approved=true;item.approvedAt='2026-10-31T10:00:00Z';item.messageStudioDraft.savedDraft=E.workingDraft(item);item.messageStudioDraft.scriptSavedAt='2026-10-31T10:00:00Z';f.h.w.upsertItem(item);f.h.w.renderAll();const before=JSON.stringify(f.h.item()),gate=deferred(),started=deferred();let flows=0;f.h.w.addEventListener('leadintel:message-flow-ready',()=>flows++);f.h.w.loadDeliveryModules=()=>{started.resolve();return gate.promise;};const pending=f.h.w.addCurrentMessageToFlow();await started.promise;change(f,'user');gate.resolve();await pending;assert.equal(JSON.stringify(f.h.item()),before);assert.equal(flows,0);assert.equal(f.activities,0);
 }finally{f.h.w.close();}
});
