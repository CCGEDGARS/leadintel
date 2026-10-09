const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../message-studio.js'),E=require('../message-editor.js'),O=require('../outreach-engine.js'),F=require('../message-facts.js'),A=require('../approved-reference-scripts.js'),W=require('../message-workspace.js');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
const e={sender:'Robin Lane',company:'North Works',offer:'steel and installation',target:'industrial teams',problem:'supplier handoffs',value:'simplify project delivery',difference:'Our team supports industrial projects.',approach:'Project delivery',proof:'',meetingValue:'relevant project lessons',nextAction:'Choose a suitable time here: {{calendly}}',calendly:'https://calendly.com/north/intro',language:'en'};
function harness(){
 let item={domain:'buyer.example',company:'Buyer',channel:'email',selectedPersonId:'sam',drafts:{emailSubject:'',emailBody:'',linkedinMessage:'Other channel preserved'},dossier:{domain:'buyer.example',company:'Buyer',selectedTrigger:null,people:[{id:'sam',name:'Sam Buyer',title:'Operations Director'}],evidence:[{url:'https://buyer.example/news',title:'Buyer announces a major new sorting plant investment',text:'Buyer is investing in a new sorting plant at the Northport mine.'}]}};
 let studio=S.normalize({mode:'professional',essentials:e}),workspace='w1',requests=[],renders=0,usable=true;
 const nodes=new Map(),q=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false});return nodes.get(id);};
 const c={URL,AbortController,setTimeout,clearTimeout,LeadIntelMessageStudio:S,LeadIntelMessageEditor:E,LeadIntelOutreach:O,LeadIntelMessageFacts:F,LeadIntelMessageWorkspace:W,scriptGenerationRequest:0,studioGenerationBusy:false,messageTranslationBusy:false,messageFactResearchBusy:false,studioGenerationError:false,approvedFieldController:null,messageEditor:null,
 DISCOVERY_META_KEY:'meta',handoffContact:{domain:'buyer.example',personId:'sam',channel:'email'},readJson:()=>({scriptBuyer:{workspaceId:workspace,domain:'buyer.example',personId:'sam',channel:'email'}}),currentItem:()=>item,readDraftEdits:()=>item,upsertItem:v=>{item=O.normalizeOutreachState({items:[v]}).items[0];},selectedCandidate:()=>({domain:item.domain,company:'Buyer'}),selectedContact:()=>item.dossier.people[0],readStudio:()=>studio,studioState:()=>studio,mainState:()=>({answers:{},answerStatus:{}}),crmBridge:()=>({workspace:{id:workspace}}),crmAuthenticated:()=>true,messageWorkspaceUsable:()=>usable,rankedBuyingTriggers:()=>F.candidates(item.dossier.evidence,{domain:item.domain,company:'Buyer'}),editorDraft:()=>E.workingDraft(item),renderAll:()=>renders++,renderMessageWorkspace(){},previewSelectedTrigger(){},cancelPendingScriptGeneration:()=>{c.scriptGenerationRequest++;c.approvedFieldController?.abort();},pendingMessageSelections:()=>false,q,toast(){},fetch:async(url,opts)=>new Promise(resolve=>requests.push({url,opts,resolve}))};
 vm.createContext(c);
 for(const [start,end] of [['function sourceBackedTrigger','// Prior drafts'],['async function chooseBuyingTrigger','function restorePreviousTriggerDraft'],['function studioMessageContext','function senderLinkedInFooter'],['function seedMandatoryEmail','function personalSlots']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),c);
 return {c,q,requests,get item(){return item;},set item(v){item=v;},get studio(){return studio;},set studio(v){studio=v;},set workspace(v){workspace=v;},set usable(v){usable=v;},get renders(){return renders;},finish(fields){requests.at(-1).resolve({ok:true,json:async()=>({text:JSON.stringify(fields),provider:'test-provider'})});}};
}
test('selecting a verified official signal automatically prepares subject/body and does not save or send',async()=>{
 const h=harness();await h.c.chooseBuyingTrigger('https://buyer.example/news');
 assert.equal(h.requests.length,0);assert.equal(h.item.messageStudioDraft.editorOrigin,'tailored');assert.equal(h.item.messageStudioDraft.triggerSourceUrl,'https://buyer.example/news');assert.match(h.item.drafts.emailBody,/Northport/);assert.match(h.item.drafts.emailBody,/20-minute Zoom/);assert.equal(h.item.drafts.linkedinMessage,'Other channel preserved');assert.equal(h.item.approved,false);assert.equal(h.item.messageStudioDraft.scriptSavedAt,undefined);
 const before=JSON.stringify(h.item);assert.equal(h.c.automaticallyPrepareMessage(),false);assert.equal(JSON.stringify(h.item),before);
});
test('third-party evidence requires review and cannot automatically enter a draft',async()=>{
 const h=harness();h.item.dossier.evidence[0].url='https://press.example/news';h.q('mw-trigger-review').open=false;
 await h.c.chooseBuyingTrigger('https://press.example/news');assert.equal(h.item.drafts.emailBody,'');assert.equal(h.item.dossier.selectedTrigger,null);assert.equal(h.q('mw-trigger-review').open,true);
});
test('all approved styles use the same compact verified project without changing originals or importing source paragraphs',()=>{
 const h=harness();h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();
 for(const mode of ['professional','curiosity','friendly','brutal']){
  const before=A.originalText(mode);h.studio=S.normalize({mode,essentials:e});h.c.automaticallyPrepareMessage();
  assert.equal(h.item.messageStudioDraft.mode,mode);assert.match(h.item.drafts.emailBody,/Northport/);assert.match(h.item.drafts.emailBody,/20-minute/);assert.equal(A.originalText(mode),before);E.validateFrame(h.item.drafts.emailBody,mode);
  const ctx=h.c.studioMessageContext(h.item);const ids=mode==='curiosity'?['project','success']:mode==='friendly'?['hello']:mode==='brutal'?['project']:['relevance','development','benefit'];
  for(const id of ids){const subject=S.resolvedSubject(S.chooseSubject(h.studio,mode,id),{...ctx,strictSubjectChoice:true},e);assert.ok(S.validSubject(subject),mode+'/'+id);assert.match(subject,/Northport/);assert.doesNotMatch(subject,/investing|mine\./);}
 }
});
test('manual, saved, approved and rewritten messages survive automatic preparation exactly and proposals persist through CRM reload',()=>{
 for(const protection of ['manual','saved','approved','rewrite']){
  const h=harness();h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();const original=h.item.messageStudioDraft.tailoredOriginal;
  if(protection==='manual'||protection==='rewrite'){h.item.drafts.emailBody='  My exact\n\nworking text.\n';h.item.messageStudioDraft.editorOrigin=protection;}
  if(protection==='saved')h.item.messageStudioDraft.scriptSavedAt='2026-10-09';if(protection==='approved')h.item.approved=true;
  const before=JSON.stringify(h.item.drafts);h.studio=S.normalize({mode:'curiosity',essentials:e});h.c.automaticallyPrepareMessage();
  assert.equal(JSON.stringify(h.item.drafts),before);assert.equal(h.item.approved,false);assert.equal(h.item.localizationApprovalBlocked,true);assert.ok(h.item.messageStudioDraft.pendingTemplateUpdate);assert.deepEqual(h.item.messageStudioDraft.tailoredOriginal,original);
  const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item),'buyer.example');assert.equal(JSON.stringify(restored.drafts),before);
  assert.deepEqual(restored.messageStudioDraft.pendingTemplateUpdate,h.item.messageStudioDraft.pendingTemplateUpdate);
  const key=E.scope('w1',restored,h.studio,{...h.c.studioMessageContext(restored),eventCampaign:null});const accepted=E.acceptUpdate(restored,key);assert.match(accepted.drafts.emailBody,/Northport/);assert.equal(accepted.messageStudioDraft.pendingTemplateUpdate,undefined);assert.equal(accepted.messageStudioDraft.previousDrafts.at(-1).emailBody,restored.drafts.emailBody);assert.ok(accepted.messageStudioDraft.originalHistory.length);
 }
});
test('proposal acceptance rejects later manual edits, changed source and another workspace',()=>{
 const h=harness();h.c.automaticallySelectBuyingTrigger();h.item.drafts.emailBody='Keep my edit';h.c.automaticallyPrepareMessage();const proposal=h.item.messageStudioDraft.pendingTemplateUpdate;
 assert.throws(()=>E.acceptUpdate(h.item,proposal.key+'other'),/changed/);h.item.drafts.emailBody='A later edit';assert.throws(()=>E.acceptUpdate(h.item,proposal.key),/changed/);
 const key=E.scope('other-workspace',h.item,h.studio,h.c.studioMessageContext(h.item));assert.throws(()=>E.acceptUpdate(h.item,key),/changed/);
});
test('bounded field preparation cannot overwrite a changed draft, source, workspace or cancelled request',async()=>{
 for(const change of ['draft','source','workspace','cancel']){
  const h=harness();h.c.automaticallySelectBuyingTrigger();h.studio=S.normalize({mode:'professional',essentials:{...e,offer:'steel manufacturing and installation '.repeat(8)}});const ctx=h.c.studioMessageContext(h.item),key=E.scope('w1',h.item,h.studio,{...ctx,eventCampaign:null});
  const pending=h.c.prepareApprovedTemplateFields(h.studio,ctx,key,{automatic:true});assert.equal(h.requests.length,1);
  if(change==='draft')h.item.drafts.emailBody='New manual text';if(change==='source')h.item.dossier.selectedTrigger=null;if(change==='workspace')h.workspace='other';if(change==='cancel')h.c.cancelPendingScriptGeneration();
  h.finish({triggerSummary:'the new sorting plant at Northport',offer:'steel and installation',value:e.value,difference:e.difference,approach:e.approach,meetingValue:e.meetingValue});await pending;
  assert.equal(h.item.messageStudioDraft?.pendingTemplateUpdate,undefined);assert.equal(h.item.messageStudioDraft?.tailoredOriginal,undefined);assert.equal(h.item.drafts.emailBody,change==='draft'?'New manual text':'');
 }
});
test('unknown seller context and blocked workspace cannot run automatic preparation',()=>{
 const h=harness();h.usable=false;assert.equal(h.c.automaticallyPrepareMessage(),false);assert.equal(h.requests.length,0);h.usable=true;h.studio=S.normalize({mode:'professional',essentials:{...e,sender:''}});assert.equal(h.c.automaticallyPrepareMessage(),false);assert.equal(h.item.drafts.emailBody,'');
});

test('an official event beyond the first 900 characters selects its exact event rather than page background',()=>{
 const h=harness(),event=h.item.dossier.evidence[0].text;h.item.dossier.evidence[0].text='Buyer serves industrial clients internationally. '.repeat(30)+event;
 assert.equal(h.c.automaticallySelectBuyingTrigger(),true);assert.equal(h.item.dossier.selectedTrigger.excerpt,event);h.c.automaticallyPrepareMessage();assert.match(h.item.drafts.emailBody,/Northport/);assert.doesNotMatch(h.item.drafts.emailBody,/serves industrial clients/);
});
test('a confirmed handoff is required and changing its recipient invalidates in-flight preparation',async()=>{
 const h=harness();h.c.handoffContact.personId='other';assert.equal(h.c.automaticallyPrepareMessage(),false);assert.equal(h.requests.length,0);
 h.c.handoffContact.personId='sam';h.c.automaticallySelectBuyingTrigger();h.studio=S.normalize({mode:'professional',essentials:{...e,offer:e.offer.repeat(20)}});const ctx=h.c.studioMessageContext(h.item),key=E.scope('w1',h.item,h.studio,{...ctx,eventCampaign:null});
 const pending=h.c.prepareApprovedTemplateFields(h.studio,ctx,key,{automatic:true});h.c.handoffContact.personId='other';h.finish({triggerSummary:'the new sorting plant at Northport',offer:e.offer,value:e.value,difference:e.difference,approach:e.approach,meetingValue:e.meetingValue});await pending;assert.equal(h.item.messageStudioDraft?.tailoredOriginal,undefined);
});

test('an active saved translation is preserved and a new English template is proposed separately',()=>{
 const h=harness();h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();h.item.messageStudioDraft.languageVersions={originalLanguage:'en',activeLanguage:'sv',versions:{en:{subject:h.item.drafts.emailSubject,message:h.item.drafts.emailBody},sv:{subject:'Svenskt ämne',message:'Min svenska text'}}};
 h.item.drafts.emailSubject='Svenskt ämne';h.item.drafts.emailBody='Min svenska text';h.studio=S.normalize({mode:'friendly',essentials:e});h.c.automaticallyPrepareMessage();
 assert.equal(h.item.drafts.emailBody,'Min svenska text');assert.equal(h.item.messageStudioDraft.languageVersions.versions.sv.message,'Min svenska text');assert.match(h.item.messageStudioDraft.pendingTemplateUpdate.draft.message,/20-minute/);
});

test('failed field preparation replaces busy text with the actual error and preserves the current draft',async()=>{
 const h=harness();h.c.automaticallySelectBuyingTrigger();h.item.drafts.emailBody='My unchanged email';
 const ctx=h.c.studioMessageContext(h.item),key=E.scope('w1',h.item,h.studio,{...ctx,eventCampaign:null});
 const pending=h.c.prepareApprovedTemplateFields(h.studio,ctx,key,{automatic:true});
 h.requests.at(-1).resolve({ok:false,json:async()=>({error:'AI integration is unavailable'})});await pending;
 assert.equal(h.c.studioGenerationBusy,false);assert.equal(h.c.studioGenerationError,true);
 assert.match(h.q('message-generation-status').textContent,/AI integration is unavailable/);assert.doesNotMatch(h.q('message-generation-status').textContent,/Preparing/);
 assert.equal(h.item.drafts.emailBody,'My unchanged email');
});
