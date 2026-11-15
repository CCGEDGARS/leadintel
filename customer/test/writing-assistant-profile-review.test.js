const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Editor=require('../message-editor.js'),Outreach=require('../outreach-engine.js'),Context=require('../writing-assistant-context.js');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
const helpers=source.slice(source.indexOf('async function useAssistantDraft('),source.indexOf('function installWritingAssistant('));
const clone=value=>JSON.parse(JSON.stringify(value));

function fixture(){
 const draft={subject:'Supplier evaluation contact',message:'Hi Alex,\n\nRobin represents North Works. Could you point me to your supplier evaluation contact?\n\nRobin Lane'};
 const essentials={sender:'Robin Lane',company:'North Works',language:'en'};
 const assistant={workspaceId:'w1',referenceRevision:2,sourceRefs:[],skillRefs:[{id:'writing-guide',revision:3}]};
 const original={key:'original',draft:{subject:'Original subject',message:'Original text'}};
 const event={campaign:{id:'future-event'},draft:{subject:'Separate invitation',message:'Separate saved event text'}};
 let item={domain:'buyer.example',company:'Buyer',channel:'email',selectedPersonId:'alex',contextNeedsRefresh:true,reapprovalRequired:true,error:'Old approval is invalid',approvalAuthority:{version:2,contextKey:'old-approval'},approvalBrandMode:'branded',brandRevision:4,
  dossier:{domain:'buyer.example',company:'Buyer',people:[{id:'alex',name:'Alex Buyer',title:'Operations Director',email:'alex@buyer.example'}],evidence:[]},
  drafts:{emailSubject:draft.subject,emailBody:draft.message},campaignScenario:{language:'en',resolvedLanguage:'en'},localizationStatus:'complete',localizationProvenance:{provider:'manual-review',model:'explicit-working-copy-v1',language:'en',selectionSource:'manual'},
  messageStudioDraft:{mode:'original',essentials,reviewedMessageScope:'current-profile',scriptSavedAt:'2026-11-01T10:00:00Z',savedDraft:draft,writingAssistant:assistant,writingAssistantDraft:draft,tailoredOriginal:original,eventWritingDrafts:[event]}};
 let usable=true,messageScope='current-profile',sourceAuthority={profileApproved:true,strategyApproved:true},saves=0,saved;
 const capture=()=>({scope:'w1:alex',messageScope,sourceAuthority,usable,context:{channel:'email',language:'en',seller:{sender:essentials.sender},currentDraft:draft}});
 const run=new Function('captureWritingAssistantContext','currentItem','studioState','LeadIntelMessageEditor','LeadIntelMessageStudio','upsertItem','renderAll','saveScriptPackage','globalThis',"const writingContextMode='customer';"+helpers+';return {use:useAssistantDraft,isSaved:isAssistantDraftSaved};')(
  capture,()=>item,()=>({mode:'original',essentials}),Editor,{missing:()=>[]},next=>item=next,()=>{},async next=>{saves++;saved=Outreach.restoreCrmScriptSnapshot(Outreach.buildCrmScriptSnapshot(next),next.domain);return {ok:true};},{LeadIntelWritingAssistantContext:Context,LeadIntelOutreach:Outreach});
 return {run,draft,assistant,original,event,item:()=>item,saved:()=>saved,saves:()=>saves,setUsable:value=>usable=value,setMessageScope:value=>messageScope=value,setAuthority:value=>sourceAuthority=value};
}

test('explicit current-profile Continue replaces invalid approval state while preserving exact text, sources and separate invitation',async()=>{
 const h=fixture(),before=clone(h.item());
 assert.equal(Outreach.approveOutreachItem(before,before.drafts).approved,false,'a profile edit must still invalidate untouched content');
 await h.run.use(h.draft,'original',h.assistant);
 const saved=h.saved();
 assert.equal(saved.contextNeedsRefresh,false,'Continue already validates and records this exact copy against the current profile');
 assert.equal(saved.reapprovalRequired,false);
 assert.equal(saved.approvalAuthority,null);
 assert.equal(saved.approved,false,'reviewing a working copy never approves or sends it');
 assert.equal(saved.approvedAt,'');assert.equal(saved.error,'');
 assert.equal(saved.drafts.emailSubject,h.draft.subject);assert.equal(saved.drafts.emailBody,h.draft.message);
 assert.deepEqual(saved.messageStudioDraft.writingAssistant,h.assistant);
 assert.deepEqual(saved.messageStudioDraft.tailoredOriginal,h.original);
 assert.deepEqual(saved.messageStudioDraft.eventWritingDrafts,[h.event]);
 assert.equal(saved.messageStudioDraft.reviewedMessageScope,'current-profile');
 assert.equal(Editor.updateUndo(h.item()).message,before.drafts.emailBody);
 const approved=Outreach.approveOutreachItem(saved,saved.drafts,'2026-11-15T16:00:00Z');
 assert.equal(approved.approved,true,approved.error);
 const reopened=Outreach.restoreCrmScriptSnapshot(Outreach.buildCrmScriptSnapshot(approved),approved.domain);
 const delivery=Outreach.buildApprovedSendPayload(reopened);
 assert.equal(delivery.recipient,'alex@buyer.example');assert.equal(delivery.textBody,h.draft.message);
 assert.equal(h.saves(),1);
});

test('an exact saved copy with stale-profile or legacy invalid-approval flags still needs explicit Continue',()=>{
 const h=fixture();assert.equal(h.run.isSaved(h.draft,'original',h.assistant),false);
 h.item().contextNeedsRefresh=false;assert.equal(h.run.isSaved(h.draft,'original',h.assistant),false);
 h.item().reapprovalRequired=false;assert.equal(h.run.isSaved(h.draft,'original',h.assistant),true);
 h.item().contextNeedsRefresh=true;
 const reopened=Outreach.restoreCrmScriptSnapshot(Outreach.buildCrmScriptSnapshot(h.item()),'buyer.example');
 assert.equal(reopened.contextNeedsRefresh,true,'an ordinary CRM round trip grants no current-profile review');
 assert.equal(Outreach.approveOutreachItem(reopened,reopened.drafts).approved,false);
});

test('invalid writing and unavailable current context cannot clear the profile review requirement',async()=>{
 for(const change of ['invalid-draft','unusable','missing-scope','unapproved-profile','unapproved-strategy','missing-authority']){
  const h=fixture(),before=clone(h.item());
  if(change==='unusable')h.setUsable(false);
  if(change==='missing-scope')h.setMessageScope('');
  if(change==='unapproved-profile')h.setAuthority({profileApproved:false,strategyApproved:true});
  if(change==='unapproved-strategy')h.setAuthority({profileApproved:true,strategyApproved:false});
  if(change==='missing-authority')h.setAuthority(null);
  await assert.rejects(h.run.use(change==='invalid-draft'?{subject:'',message:''}:h.draft,'original',h.assistant));
  assert.deepEqual(h.item(),before,change);assert.equal(h.saves(),0,change);
 }
});

test('explicit Continue can prepare an unchanged legacy branded approval for the new rendering policy',async()=>{
 const h=fixture();h.item().contextNeedsRefresh=false;h.item().reapprovalRequired=false;h.item().approved=true;h.item().brandSnapshot={status:'ready'};
 assert.equal(h.run.isSaved(h.draft,'original',h.assistant),false,'Continue must record an explicit new review rather than retain an older rendering approval');
 await h.run.use(h.draft,'original',h.assistant);
 assert.equal(h.saved().approved,false);assert.equal(h.saved().drafts.emailBody,h.draft.message);assert.deepEqual(h.saved().messageStudioDraft.writingAssistant,h.assistant);assert.deepEqual(h.saved().messageStudioDraft.eventWritingDrafts,[h.event]);
 const current=fixture();current.item().contextNeedsRefresh=false;current.item().reapprovalRequired=false;current.item().approved=true;current.item().brandSnapshot={emailRenderVersion:2};
 assert.equal(current.run.isSaved(current.draft,'original',current.assistant),true,'the current rendering approval is preserved');
});

