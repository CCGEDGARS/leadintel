const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Editor=require('../message-editor.js'),Outreach=require('../outreach-engine.js');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
const item=()=>({domain:'buyer.example',company:'Buyer',selectedPersonId:'p1',channel:'email',dossier:{},drafts:{emailSubject:'Subject',emailBody:'My exact body'},messageStudioDraft:{scriptSavedAt:'2026-10-09',savedDraft:{subject:'Subject',message:'My exact body'}}});
function saveHarness(sync){let active=item();const bridge={workspace:{id:'w1'}},ctx={LeadIntelMessageEditor:Editor,LeadIntelOutreach:Outreach,crmBridge:()=>bridge,currentItem:()=>active,readDraftEdits:()=>active,selectedCandidate:()=>({domain:active.domain}),upsertItem:x=>{active=x},outreach:{selectedDomain:active.domain},crmActivityId:()=> 'save-id',syncCrmActivity:sync,toast(){},q:()=>({textContent:''})};vm.createContext(ctx);require('./helpers/message-crm-authority.cjs')(ctx);vm.runInContext(source.slice(source.indexOf('async function saveScriptPackage('),source.indexOf('async function restoreScriptPackage(')),ctx);return {ctx,bridge,get active(){return active},set active(x){active=x}};}
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
function flowHarness({automatic=false,save=true}={}){let active=item(),queued=0,approved=0;const events=[];const bridge={workspace:{id:'w1'},getOutreachAutomationPolicy:async()=>({policy:{mode:automatic?'automatic':'manual',enabled:automatic,automaticDelivery:'enabled'}}),enqueueOutreachAutomation:async payload=>{queued++;return {ok:true,sequence:{id:'q1'}}},saveNow:async()=>({saved:true})};
 const ctx={LeadIntelMessageEditor:Editor,LeadIntelOutreach:{renderApprovedEmail:i=>({subject:i.drafts.emailSubject,textBody:i.drafts.emailBody})},crmBridge:()=>bridge,messageWorkspaceUsable:()=>true,messageEditor:{state:()=>({})},editorDraft:()=>Editor.workingDraft(active),currentItem:()=>active,upsertItem:i=>{active=i},q:()=>({focus(){},disabled:false}),approveOutreach:async()=>{approved++;active={...active,approved:true,approvedAt:'2026-10-09T10:00:00Z'};return {ok:true,item:active}},saveScriptPackage:async next=>{active=next;return {ok:save}},handoffContact:{contact:{work_email:'alex@buyer.example'}},selectedContact:()=>({email:'alex@buyer.example'}),renderAll(){},renderMessageWorkspace(){},toast(){}};
 ctx.window={dispatchEvent:event=>events.push(event)};ctx.CustomEvent=class{constructor(type,{detail}){this.type=type;this.detail=detail;}};
 ctx.loadDeliveryModules=async()=>{};
 vm.createContext(ctx);require('./helpers/message-crm-authority.cjs')(ctx);vm.runInContext(source.slice(source.indexOf('function messageInFlow('),source.indexOf('async function markCurrentTemplateDefault(')),ctx);vm.runInContext(source.slice(source.indexOf('let messageFlowBusy=false;'),source.indexOf('function openFlowScheduler(')),ctx);
 return {ctx,bridge,events,get active(){return active},set active(x){active=x},get queued(){return queued},get approved(){return approved}};
}
test('Add to flow opens Delivery with the durable saved recipient and never activates sending',async()=>{
 const unsaved=flowHarness();unsaved.active.drafts.emailBody='Unsaved';await unsaved.ctx.addCurrentMessageToFlow();assert.equal(unsaved.approved,0);assert.equal(unsaved.queued,0);
 for(const automatic of [false,true]){const h=flowHarness({automatic});await h.ctx.addCurrentMessageToFlow();assert.equal(h.ctx.messageInFlow(h.active),true);assert.equal(h.active.messageStudioDraft.flowMembership.mode,'manual');assert.equal(h.active.messageStudioDraft.flowMembership.recipient,'alex@buyer.example');assert.equal(h.active.messageStudioDraft.flowMembership.workspaceId,'w1');assert.equal(h.queued,0);assert.equal(h.events.at(-1)?.type,'leadintel:message-flow-ready');assert.equal(h.events.at(-1)?.detail.domain,'buyer.example');await h.ctx.addCurrentMessageToFlow();assert.equal(h.approved,1);assert.equal(h.events.length,2);assert.equal(h.queued,0);}
});
test('failed flow persistence remains retryable and a buyer switch during approval never queues',async()=>{
 const failed=flowHarness({save:false,automatic:true});await failed.ctx.addCurrentMessageToFlow();assert.equal(failed.queued,0);assert.equal(failed.ctx.messageInFlow(failed.active),false);
 assert.equal(failed.events.length,0);
 const changed=flowHarness({automatic:true});let finish;changed.ctx.approveOutreach=()=>new Promise(r=>finish=r);const pending=changed.ctx.addCurrentMessageToFlow();await new Promise(resolve=>setImmediate(resolve));changed.active={...item(),selectedPersonId:'p2'};finish({ok:true});await pending;assert.equal(changed.queued,0);assert.equal(changed.active.messageStudioDraft.flowMembership,undefined);
});
test('Add to flow waits for Delivery initialization and rejects a context switch while loading',async()=>{
 for(const switched of [false,true]){const h=flowHarness();let finish;h.ctx.loadDeliveryModules=()=>new Promise(resolve=>finish=resolve);const pending=h.ctx.addCurrentMessageToFlow();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.events.length,0);assert.equal(h.approved,0);if(switched)h.bridge.workspace.id='other';finish();await pending;assert.equal(h.events.length,switched?0:1);assert.equal(h.approved,switched?0:1);}
});
test('approval invalidated during Delivery loading is rechecked even when message text is unchanged',async()=>{
 const h=flowHarness();h.active={...h.active,approved:true,approvedAt:'old'};let finish;h.ctx.loadDeliveryModules=()=>new Promise(resolve=>finish=resolve);
 const pending=h.ctx.addCurrentMessageToFlow();h.active={...h.active,approved:false,approvedAt:''};finish();await pending;assert.equal(h.approved,1);assert.equal(h.events.length,1);assert.equal(h.active.messageStudioDraft.flowMembership.approvedAt,'2026-10-09T10:00:00Z');
});
for(const boundary of ['approval','persistence'])test('invalidating approval during '+boundary+' cannot complete the handoff',async()=>{
 const h=flowHarness();let finish;
 if(boundary==='approval')h.ctx.approveOutreach=()=>{h.active={...h.active,approved:true,approvedAt:'captured'};const captured=h.active;return new Promise(resolve=>finish=()=>resolve({ok:true,item:captured}));};
 else h.ctx.saveScriptPackage=next=>{h.active=next;return new Promise(resolve=>finish=()=>resolve({ok:true}));};
 const pending=h.ctx.addCurrentMessageToFlow();await new Promise(resolve=>setImmediate(resolve));h.active={...h.active,approved:false,approvedAt:''};finish();await pending;
 assert.equal(h.events.length,0);assert.equal(h.ctx.messageInFlow(h.active),false);
});

test('a changed recipient identity cannot save the visible old message into CRM',async()=>{
 let writes=0;const h=saveHarness(async()=>{writes++;return {ok:true};});h.ctx.messageRecipientReady=()=>false;
 const before=JSON.stringify(h.active),result=await h.ctx.saveScriptPackage();
 assert.equal(writes,0);assert.equal(result.ok,false);assert.equal(JSON.stringify(h.active),before);
});
test('saving keeps the original recipient identity in both local and CRM draft snapshots',async()=>{
 let metadata;const h=saveHarness(async(candidate,payload)=>{metadata=payload.activity.metadata;return {ok:true};});const identity={version:1,name:'Alex Buyer',personId:'p1',companyDomain:'buyer.example'};h.ctx.DISCOVERY_META_KEY='meta';h.ctx.readJson=()=>({scriptBuyer:{recipientIdentity:identity}});h.ctx.messageRecipientReady=()=>true;
 await h.ctx.saveScriptPackage();assert.deepEqual(metadata.script_package.item.messageStudioDraft.recipientIdentity,identity);assert.deepEqual(h.active.messageStudioDraft.recipientIdentity,identity);
});
