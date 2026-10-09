const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Editor=require('../message-editor.js'),Outreach=require('../outreach-engine.js');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
const item=()=>({domain:'buyer.example',company:'Buyer',selectedPersonId:'p1',channel:'email',dossier:{},drafts:{emailSubject:'Subject',emailBody:'My exact body'},messageStudioDraft:{scriptSavedAt:'2026-10-09',savedDraft:{subject:'Subject',message:'My exact body'}}});
function saveHarness(sync){let active=item();const bridge={workspace:{id:'w1'}},ctx={LeadIntelMessageEditor:Editor,LeadIntelOutreach:Outreach,crmBridge:()=>bridge,currentItem:()=>active,readDraftEdits:()=>active,selectedCandidate:()=>({domain:active.domain}),upsertItem:x=>{active=x},outreach:{selectedDomain:active.domain},crmActivityId:()=> 'save-id',syncCrmActivity:sync,toast(){},q:()=>({textContent:''})};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function saveScriptPackage('),source.indexOf('async function restoreScriptPackage(')),ctx);return {ctx,bridge,get active(){return active},set active(x){active=x}};}
test('failed, local-only and throwing CRM saves clear pending and never mark edited content saved',async()=>{
 for(const sync of [async()=>({ok:false}),async()=>({ok:true,localOnly:true}),async()=>{throw Error('offline')}]){const h=saveHarness(sync);h.active.drafts.emailBody='Edited';await h.ctx.saveScriptPackage();assert.equal(h.active.messageStudioDraft.savePending,false);assert.equal(h.active.drafts.emailBody,'Edited');assert.equal(Editor.savedDraft(h.active),false);}
});
test('a late save acknowledges only captured text and cannot replace a newer edit or another buyer',async()=>{
 for(const change of ['edit','buyer','workspace']){let finish;const h=saveHarness(()=>new Promise(r=>finish=r));h.active.drafts.emailBody='Captured';const pending=h.ctx.saveScriptPackage();
  if(change==='edit')h.active={...h.active,drafts:{...h.active.drafts,emailBody:'Newer edit'}};
  if(change==='buyer')h.active={...item(),selectedPersonId:'p2'};
  if(change==='workspace')h.bridge.workspace.id='w2';
  finish({ok:true});await pending;
  if(change==='edit'){assert.equal(h.active.drafts.emailBody,'Newer edit');assert.equal(h.active.messageStudioDraft.savedDraft.message,'Captured');assert.equal(Editor.savedDraft(h.active),false);}
  if(change==='buyer'){assert.equal(h.active.selectedPersonId,'p2');assert.equal(h.active.messageStudioDraft.savedDraft.message,'My exact body');}
 }
});
function flowHarness({automatic=false,save=true}={}){let active=item(),queued=0,approved=0;const bridge={workspace:{id:'w1'},getOutreachAutomationPolicy:async()=>({policy:{mode:automatic?'automatic':'manual',enabled:automatic,automaticDelivery:'enabled'}}),enqueueOutreachAutomation:async payload=>{queued++;assert.equal(payload.subject,'Subject');assert.equal(payload.body,'My exact body');return {ok:true,sequence:{id:'q1'}}},saveNow:async()=>({saved:true})};
 const ctx={LeadIntelMessageEditor:Editor,LeadIntelOutreach:{renderApprovedEmail:i=>({subject:i.drafts.emailSubject,textBody:i.drafts.emailBody})},crmBridge:()=>bridge,messageWorkspaceUsable:()=>true,messageEditor:{state:()=>({})},editorDraft:()=>Editor.workingDraft(active),currentItem:()=>active,upsertItem:i=>{active=i},q:()=>({focus(){},disabled:false}),approveOutreach:async()=>{approved++;active={...active,approved:true,approvedAt:'2026-10-09T10:00:00Z'};return {ok:true,item:active}},saveScriptPackage:async next=>{active=next;return {ok:save}},handoffContact:{contact:{work_email:'alex@buyer.example'}},selectedContact:()=>({email:'alex@buyer.example'}),renderAll(){},renderMessageWorkspace(){},toast(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function messageInFlow('),source.indexOf('async function markCurrentTemplateDefault(')),ctx);vm.runInContext(source.slice(source.indexOf('let messageFlowBusy=false;'),source.indexOf('function openFlowScheduler(')),ctx);
 return {ctx,bridge,get active(){return active},set active(x){active=x},get queued(){return queued},get approved(){return approved}};
}
test('Add to flow requires saved text, is idempotent, and only queues when automatic delivery is enabled',async()=>{
 const unsaved=flowHarness();unsaved.active.drafts.emailBody='Unsaved';await unsaved.ctx.addCurrentMessageToFlow();assert.equal(unsaved.approved,0);assert.equal(unsaved.queued,0);
 for(const automatic of [false,true]){const h=flowHarness({automatic});await h.ctx.addCurrentMessageToFlow();assert.equal(h.ctx.messageInFlow(h.active),true);assert.equal(h.active.messageStudioDraft.flowMembership.mode,automatic?'automatic':'manual');assert.equal(h.queued,automatic?1:0);await h.ctx.addCurrentMessageToFlow();assert.equal(h.approved,1);assert.equal(h.queued,automatic?1:0);}
});
test('failed flow persistence remains retryable and a buyer switch during approval never queues',async()=>{
 const failed=flowHarness({save:false,automatic:true});await failed.ctx.addCurrentMessageToFlow();assert.equal(failed.queued,0);assert.equal(failed.ctx.messageInFlow(failed.active),false);
 const changed=flowHarness({automatic:true});let finish;changed.ctx.approveOutreach=()=>new Promise(r=>finish=r);const pending=changed.ctx.addCurrentMessageToFlow();changed.active={...item(),selectedPersonId:'p2'};finish({ok:true});await pending;assert.equal(changed.queued,0);assert.equal(changed.active.messageStudioDraft.flowMembership,undefined);
});
