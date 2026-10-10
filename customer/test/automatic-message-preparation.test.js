const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../message-studio.js'),E=require('../message-editor.js'),O=require('../outreach-engine.js'),F=require('../message-facts.js'),A=require('../approved-reference-scripts.js'),W=require('../message-workspace.js');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
const e={sender:'Robin Lane',company:'North Works',offer:'steel and installation',target:'industrial teams',problem:'supplier handoffs',value:'simplify project delivery',difference:'Our team supports industrial projects.',approach:'Project delivery',proof:'',meetingValue:'relevant project lessons',nextAction:'Choose a suitable time here: {{calendly}}',calendly:'https://calendly.com/north/intro',language:'en'};
function harness(){
 let item={domain:'buyer.example',company:'Buyer',channel:'email',selectedPersonId:'sam',drafts:{emailSubject:'',emailBody:'',linkedinMessage:'Other channel preserved'},dossier:{domain:'buyer.example',company:'Buyer',selectedTrigger:null,people:[{id:'sam',name:'Sam Buyer',title:'Operations Director'}],evidence:[{url:'https://buyer.example/news',title:'Buyer announces a major new sorting plant investment',text:'Buyer is investing in a new sorting plant at the Northport mine.'}]}};
 let studio=S.normalize({mode:'professional',essentials:e}),workspace='w1',requests=[],renders=0,usable=true;
 const nodes=new Map(),q=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false});return nodes.get(id);};
 const c={URL,AbortController,setTimeout,clearTimeout,LeadIntelMessageStudio:S,LeadIntelMessageEditor:E,LeadIntelOutreach:O,LeadIntelMessageFacts:F,LeadIntelMessageWorkspace:W,LeadIntelTriggerPreview:require('../trigger-preview.js'),scriptGenerationRequest:0,studioGenerationBusy:false,messageTranslationBusy:false,messageFactResearchBusy:false,studioGenerationError:false,approvedFieldController:null,messageEditor:null,
 DISCOVERY_META_KEY:'meta',handoffContact:{domain:'buyer.example',personId:'sam',channel:'email'},readJson:()=>({scriptBuyer:{workspaceId:workspace,domain:'buyer.example',personId:'sam',channel:'email'}}),currentItem:()=>item,readDraftEdits:()=>item,upsertItem:v=>{item=O.normalizeOutreachState({items:[v]}).items[0];},selectedCandidate:()=>({domain:item.domain,company:'Buyer'}),selectedContact:()=>item.dossier.people[0],readStudio:()=>studio,persistStudio:value=>{studio=value;},studioState:()=>studio,renderMessageStudio(){},mainState:()=>({answers:{},answerStatus:{}}),crmBridge:()=>({workspace:{id:workspace}}),crmAuthenticated:()=>true,messageWorkspaceUsable:()=>usable,rankedBuyingTriggers:()=>F.candidates(item.dossier.evidence,{domain:item.domain,company:'Buyer'}),editorDraft:()=>E.workingDraft(item),renderAll:()=>renders++,renderMessageWorkspace(){},ensureSelection(){},previewSelectedTrigger(){},cancelPendingScriptGeneration:()=>{c.scriptGenerationRequest++;c.approvedFieldController?.abort();},pendingMessageSelections:()=>false,q,toast(){},fetch:async(url,opts)=>new Promise(resolve=>requests.push({url,opts,resolve}))};
 vm.createContext(c);
 for(const [start,end] of [['function sourceBackedTrigger','// Prior drafts'],['async function chooseBuyingTrigger','function restorePreviousTriggerDraft'],['function studioMessageContext','function senderLinkedInFooter'],['function workingSuggestedSubject','function stripEmailSubjectHeader'],['function seedMandatoryEmail','function personalSlots'],['function updateMessageFromTemplate','function pendingMessageSelections']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),c);
 return {c,q,requests,get item(){return item;},set item(v){item=v;},get studio(){return studio;},set studio(v){studio=v;},set workspace(v){workspace=v;},set usable(v){usable=v;},get renders(){return renders;},finish(fields){requests.at(-1).resolve({ok:true,json:async()=>({text:JSON.stringify(fields),provider:'test-provider'})});}};
}
test('opening Messages selects evidence before rendering and automatically prepares every approved style and its factual subjects',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal']){
  const h=harness();h.studio=S.normalize({mode,essentials:e});let onOpen;
  h.c.window={addEventListener:(name,fn)=>{assert.equal(name,'leadintel:module-opened');onOpen=fn;}};
  vm.runInContext(source.split('\n').find(line=>line.includes('window.addEventListener("leadintel:module-opened"')),h.c);
  const rendered=[];h.c.renderAll=()=>rendered.push(h.item.dossier.selectedTrigger?.url);
  onOpen({detail:{step:5}});assert.equal(rendered.length,0);onOpen({detail:{step:6}});
  assert.equal(rendered[0],'https://buyer.example/news');assert.match(h.item.drafts.emailBody,/Hi Sam/);assert.match(h.item.drafts.emailBody,/Northport/);assert.match(h.item.drafts.emailBody,/Robin Lane/);E.validateFrame(h.item.drafts.emailBody,mode);
  const subjects=S.subjectsFor(mode).map(option=>h.c.workingSuggestedSubject(S.chooseSubject(h.studio,mode,option.id),h.item,h.c.selectedCandidate(),true)).filter(Boolean);
  assert.ok(subjects.some(subject=>/Northport/.test(subject)),mode);assert.ok(subjects.every(subject=>S.validSubject(subject)&&!/LKAB|ERCON/.test(subject)));assert.equal(h.item.approved,false);assert.equal(h.item.messageStudioDraft.scriptSavedAt,undefined);
  const before=JSON.stringify(h.item);onOpen({detail:{step:6}});assert.equal(JSON.stringify(h.item),before);assert.equal(h.requests.length,0);
 }
});
test('opening Messages renders the selected trigger even when Profile confirmation blocks text preparation',()=>{
 const h=harness();h.c.LeadIntelStep2Brief={confirmationMissing:()=>['offer']};assert.equal(h.c.prepareMessageOnOpen(),false);
 assert.equal(h.item.dossier.selectedTrigger.url,'https://buyer.example/news');assert.equal(h.renders,1);assert.equal(h.item.drafts.emailBody,'');assert.equal(h.requests.length,0);
 h.c.LeadIntelStep2Brief.confirmationMissing=()=>[];h.c.prepareMessageOnOpen();assert.match(h.item.drafts.emailBody,/Northport/);
});
test('reopening refreshes automatic evidence choices while preserving reviewed choices and saved drafts',()=>{
 const h=harness();h.c.prepareMessageOnOpen();h.item.messageStudioDraft.scriptSavedAt='today';const before=E.workingDraft(h.item);
 const url='https://buyer.example/riverport';h.item.dossier.evidence.push({url,title:'Buyer announces a new manufacturing plant at Riverport',text:'Buyer is investing in a new manufacturing plant at Riverport.'});
 const rows=F.candidates(h.item.dossier.evidence,{domain:h.item.domain,company:h.item.company});h.c.rankedBuyingTriggers=()=>[rows.find(row=>row.url===url),...rows.filter(row=>row.url!==url)];h.c.prepareMessageOnOpen();
 assert.equal(h.item.dossier.selectedTrigger.url,url);assert.deepEqual(E.workingDraft(h.item),before);assert.match(h.item.messageStudioDraft.pendingTemplateUpdate.draft.message,/Riverport/);
 h.item.dossier.selectedTrigger.verification='user_reviewed';h.c.rankedBuyingTriggers=()=>rows;h.c.prepareMessageOnOpen();assert.equal(h.item.dossier.selectedTrigger.url,url);
});
test('trigger ranking and message context use the current kept buyer and workspace seller instead of cached recipient details',()=>{
 const h=harness();vm.runInContext(source.slice(source.indexOf('function selectedContact'),source.indexOf('async function regenerateDrafts')),h.c);
 h.c.messageFactCandidates=()=>F.candidates(h.item.dossier.evidence,{domain:h.item.domain,company:h.item.company});vm.runInContext(source.slice(source.indexOf('function rankedBuyingTriggers'),source.indexOf('function sourceBackedTrigger')),h.c);
 let candidate={domain:'buyer.example',company:'Buyer',people:[{id:'sam',name:'Taylor Current',title:'Manufacturing Director',kept:true,email:'unverified@other.example'}]};h.c.selectedCandidate=()=>candidate;h.item.dossier.people[0].email='verified@buyer.example';assert.equal(h.c.selectedContact(h.item).email,'verified@buyer.example');
 h.item.dossier.evidence=[{url:'https://buyer.example/a',text:'Buyer is investing in a new sorting plant at Northport.'},{url:'https://buyer.example/b',text:'Buyer is investing in a new manufacturing plant at Riverport.'}];
 h.studio=S.normalize({mode:'professional',essentials:{...e,offer:'manufacturing services'}});h.c.prepareMessageOnOpen();assert.equal(h.item.dossier.selectedTrigger.url,'https://buyer.example/b');assert.match(h.item.drafts.emailBody,/Hi Taylor/);assert.match(h.item.drafts.emailBody,/Riverport/);assert.doesNotMatch(h.item.drafts.emailBody,/Hi Sam/);
 candidate={domain:'other.example',company:'Other',people:[{id:'sam',name:'Wrong Workspace',title:'Other',kept:true}]};assert.equal(h.c.selectedContact(h.item).name,'Sam Buyer');
 candidate={domain:'buyer.example',people:[{id:'sam',name:'Unconfirmed',kept:false}]};assert.equal(h.c.selectedContact(h.item).name,'Sam Buyer');
});
test('opening another confirmed buyer uses that recipient and seller context without carrying previous message facts',()=>{
 const h=harness();h.c.prepareMessageOnOpen();
 h.item={domain:'clinic.example',company:'Clinic',channel:'email',selectedPersonId:'alex',drafts:{},dossier:{domain:'clinic.example',company:'Clinic',people:[{id:'alex',name:'Alex Health',title:'Clinical Director'}],evidence:[{url:'https://clinic.example/news',text:'Clinic is opening a new diagnostic centre at Eastport.'}]}};
 h.c.handoffContact={domain:'clinic.example',personId:'alex',channel:'email'};h.c.readJson=()=>({scriptBuyer:{workspaceId:'w1',domain:'clinic.example',personId:'alex',channel:'email'}});h.c.selectedCandidate=()=>({domain:'clinic.example',company:'Clinic'});h.c.rankedBuyingTriggers=()=>F.candidates(h.item.dossier.evidence,{domain:h.item.domain,company:'Clinic'});
 h.studio=S.normalize({mode:'friendly',essentials:{...e,sender:'Morgan Health',company:'Health Systems',offer:'diagnostic equipment',difference:'Our team supports healthcare projects.'}});h.c.prepareMessageOnOpen();
 assert.match(h.item.drafts.emailBody,/Hi Alex/);assert.match(h.item.drafts.emailBody,/Morgan Health/);assert.match(h.item.drafts.emailBody,/Eastport/);assert.doesNotMatch(h.item.drafts.emailBody,/Northport|Robin Lane|North Works|Sam Buyer/);E.validateFrame(h.item.drafts.emailBody,'friendly');
});
test('Update message preserves an applied event invitation and refreshes current saved event details within its own frame',()=>{
 const h=harness(),Events=require('../event-campaigns.js'),campaign={id:'expo',name:'Industry Forum',startDate:'2099-10-10',endDate:'2099-10-12',location:'Berlin',stand:'B12',visitValue:'Compare our industrial services.'};
 h.c.LeadIntelEventCampaigns=Events;h.item.messageStudioDraft={eventSnapshot:campaign,eventStyle:'friendly',mode:'professional'};h.item.drafts.emailBody='My edited event invitation';
 h.studio=S.markDefault(S.saveMyTemplate(h.studio,'template-1',{name:'Business default',subject:'Business',body:'A regular business message'}),'template-1');
 const current=Events.save({}, {...campaign,name:'Updated Industry Forum',stand:'C30',location:'Hamburg',startDate:'2099-11-01',endDate:'2099-11-03'});
 h.c.mainState=()=>({eventCampaigns:current,brandIdentity:{email:'robin@north.example',phone:'+371 12345678'}});
 h.c.updateMessageFromTemplate();
 const updated=h.item;assert.match(updated.drafts.emailBody,/Updated Industry Forum/);assert.match(updated.drafts.emailBody,/C30/);assert.match(updated.drafts.emailBody,/Hamburg/);assert.match(updated.drafts.emailBody,/2099-11-01/);assert.match(updated.drafts.emailBody,/If you’re planning/);assert.match(updated.drafts.emailBody,/Hi Sam/);assert.match(updated.drafts.emailBody,/robin@north.example/);assert.doesNotMatch(updated.drafts.emailBody,/B12|Berlin|regular business message/);
 assert.equal(updated.messageStudioDraft.eventSnapshot.stand,'C30');assert.equal(updated.messageStudioDraft.eventStyle,'friendly');assert.equal(updated.drafts.emailSubject,'Meet at Updated Industry Forum');assert.equal(E.savedDraft(updated),false);assert.equal(updated.approved,false);assert.equal(h.requests.length,0);Events.validateDraft(updated.messageStudioDraft.eventSnapshot,E.workingDraft(updated),e);
 const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(updated),'buyer.example'),undone=E.undoTemplateUpdate(restored);assert.equal(undone.drafts.emailBody,'My edited event invitation');assert.equal(undone.messageStudioDraft.eventSnapshot.stand,'B12');
});
test('an expired or archived event fails closed and preserves the entire working invitation',()=>{
 for(const patch of [{endDate:'2020-01-01'},{archived:true}]){
  const h=harness(),Events=require('../event-campaigns.js'),campaign={id:'expo',name:'Industry Forum',startDate:'2099-10-10',endDate:'2099-10-12',location:'Berlin',stand:'B12',visitValue:'Compare services.'};h.c.LeadIntelEventCampaigns=Events;
  h.item.messageStudioDraft={eventSnapshot:campaign,eventStyle:'professional'};h.item.drafts.emailBody='Keep my exact invitation';const before=JSON.stringify(h.item);
  h.c.mainState=()=>({eventCampaigns:{campaigns:[{...campaign,...patch}]}});h.c.updateMessageFromTemplate();assert.equal(JSON.stringify(h.item),before);
 }
});
test('Update message uses a newly confirmed buying event and tailors matching subjects for every protected style',async()=>{
 for(const mode of ['professional','curiosity','friendly','brutal']){
  const h=harness();h.studio=S.normalize({mode,essentials:e});h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();
  h.item.messageStudioDraft.scriptSavedAt='today';h.item.drafts.emailBody='Saved manual message';h.item.messageStudioDraft.editorOrigin='manual';
  const url='https://buyer.example/new-factory';h.item.dossier.evidence.push({url,title:'Buyer announces a new manufacturing plant at Riverport',text:'Buyer is investing in a new manufacturing plant at Riverport.'});await h.c.chooseBuyingTrigger(url);
  assert.equal(h.item.drafts.emailBody,'Saved manual message');h.c.updateMessageFromTemplate();assert.match(h.item.drafts.emailBody,/Riverport/);assert.doesNotMatch(h.item.drafts.emailBody,/Northport/);assert.equal(h.item.messageStudioDraft.triggerSourceUrl,url);E.validateFrame(h.item.drafts.emailBody,mode);
  const ctx=h.c.studioMessageContext(h.item);for(const option of S.subjectsFor(mode)){const selected=S.chooseSubject(h.studio,mode,option.id),subject=S.resolveApprovedSubject(selected,{...ctx,strictSubjectChoice:true},e);if(subject){assert.ok(S.validSubject(subject));assert.doesNotMatch(subject,/Northport|LKAB|ERCON/);}}
 }
});
test('Update message repairs modified core wording deterministically and preserves immutable originals plus durable Undo',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal']){
  const h=harness();h.studio=S.normalize({mode,essentials:e});h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();
  const first=JSON.parse(JSON.stringify(h.item.messageStudioDraft.tailoredOriginal)),master=A.originalText(mode),expected=h.item.drafts.emailBody;
  h.item.drafts.emailBody='Wrong wording\n\nWrong order';h.item.messageStudioDraft.editorOrigin='manual';h.item.messageStudioDraft.scriptSavedAt='2026-10-10';h.item.messageStudioDraft.savedDraft=E.workingDraft(h.item);
  const before=E.workingDraft(h.item);h.c.updateMessageFromTemplate();
  assert.equal(h.item.drafts.emailBody,expected);assert.equal(A.originalText(mode),master);assert.deepEqual(h.item.messageStudioDraft.tailoredOriginal,first);assert.equal(E.savedDraft(h.item),false);assert.equal(h.item.approved,false);assert.equal(h.requests.length,0);
  const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item),'buyer.example');assert.deepEqual(E.updateUndo(restored),before);assert.deepEqual(E.workingDraft(E.undoTemplateUpdate(restored)),before);
  const changed={...restored,drafts:{...restored.drafts,emailBody:'Later manual edit'}};assert.throws(()=>E.undoTemplateUpdate(changed),/changed/);
 }
});
test('Update message restores the exact saved default snapshot even after library edits and a different style selection',()=>{
 const h=harness();let studio=S.saveMyTemplate(h.studio,'template-1',{name:'Default invitation',subject:'For {{buyerCompany}}',body:'Hi {{firstName}},\n\nOur approved service: {{offer}}\n\n{{calendly}}'});
 studio=S.markDefault(studio,'template-1');studio=S.saveMyTemplate(studio,'template-1',{name:'Later edit',subject:'Other',body:'Wrong newer library version'},true);studio.mode='friendly';h.studio=studio;
 h.item.drafts.emailBody='My working draft';h.c.updateMessageFromTemplate();
 assert.equal(h.studio.mode,'template-1');assert.equal(h.item.drafts.emailBody,'Hi Sam,\n\nOur approved service: steel and installation\n\nhttps://calendly.com/north/intro');assert.equal(h.item.drafts.emailSubject,'For Buyer');assert.equal(E.updateUndo(h.item).message,'My working draft');assert.equal(E.savedDraft(h.item),false);
});
test('a tampered pending message cannot redefine the approved template on explicit Update message',()=>{
 const h=harness();h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();const expected=h.item.drafts.emailBody;
 h.item.messageStudioDraft.pendingTemplateUpdate={draft:{subject:'Invented',message:'Tampered proposal'},key:'invalid'};h.item.drafts.emailBody='My edit';h.c.updateMessageFromTemplate();
 assert.equal(h.item.drafts.emailBody,expected);assert.equal(h.item.messageStudioDraft.pendingTemplateUpdate,undefined);assert.equal(E.updateUndo(h.item).message,'My edit');
});
test('explicit Update preserves a deliberate custom subject and first original while refreshing the body',()=>{
 const h=harness();h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();const first=JSON.stringify(h.item.messageStudioDraft.tailoredOriginal);
 h.item.drafts.emailSubject='My own valid subject';h.item.drafts.emailBody='Changed body';h.q('message-subject-choice').value='custom';h.c.updateMessageFromTemplate();
 assert.equal(h.item.drafts.emailSubject,'My own valid subject');assert.match(h.item.drafts.emailBody,/Northport/);assert.equal(JSON.stringify(h.item.messageStudioDraft.tailoredOriginal),first);
});
test('Update with identical compliant text still requires an explicit Save and respects editor/session guards',()=>{
 const h=harness();h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();const before=JSON.stringify(h.item.drafts);
 h.item.messageStudioDraft.scriptSavedAt='today';h.item.messageStudioDraft.savedDraft=E.workingDraft(h.item);h.c.updateMessageFromTemplate();assert.equal(JSON.stringify(h.item.drafts),before);assert.equal(E.savedDraft(h.item),false);
 h.c.messageEditor={state:()=>({editing:true})};assert.equal(h.c.updateMessageFromTemplate(),false);assert.equal(JSON.stringify(h.item.drafts),before);
 h.c.messageEditor=null;h.usable=false;assert.equal(h.c.updateMessageFromTemplate(),false);
});
test('canonical subject selection changes no body and does not create a pending body update on reopen',()=>{
 const h=harness();h.c.automaticallySelectBuyingTrigger();h.c.automaticallyPrepareMessage();h.item.messageStudioDraft.scriptSavedAt='today';const before=h.item.drafts.emailBody;
 const line=source.split('\n').find(line=>line.includes("q('message-subject-choice').onchange="));vm.runInContext(line,h.c);
 h.q('message-subject-choice').value='relevance';h.q('message-subject-choice').onchange();
 assert.equal(h.item.drafts.emailBody,before);assert.match(h.item.drafts.emailSubject,/Northport/);assert.equal(h.requests.length,0);assert.equal(h.c.automaticallyPrepareMessage(),false);assert.equal(h.item.messageStudioDraft.pendingTemplateUpdate,undefined);
});
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

test('real combined Swedish heading and mine excerpt use the same project as the English trigger card',()=>{
 const h=harness(),raw='Nytt sovringsverk framtidssäkrar produktionen i Gällivare LKAB satsar sex miljarder på ett nytt sovringsverk vid Malmbergsgruvan – en investering för att säkra stabil och effektiv produktion.';
 h.item.dossier.evidence[0]={url:'https://buyer.example/news',title:'LKAB',text:raw};h.c.automaticallySelectBuyingTrigger();
 const ctx=h.c.studioMessageContext(h.item);assert.match(ctx.trigger.summary,/Gällivare/);assert.match(ctx.trigger.excerpt,/Malmbergsgruvan/);assert.match(ctx.trigger.subjectSummary,/Malmberget/);
 h.studio=S.normalize({mode:'curiosity',essentials:{...e,offer:'Drawing development, serial production manufacturing and installation'}});
 for(const [mode,id] of [['curiosity','project'],['curiosity','success'],['friendly','hello'],['brutal','project'],['professional','relevance']]){
 const studio=S.chooseSubject(S.normalize({mode,essentials:h.studio.essentials}),mode,id),subject=h.c.workingSuggestedSubject(studio,h.item,{company:'Buyer'},true);
 assert.match(subject,/Malmberget/,mode+'/'+id);assert.doesNotMatch(subject,/Gällivare/,mode+'/'+id);
 }
 const snapshot=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item),'buyer.example');assert.equal(h.c.studioMessageContext(snapshot).trigger.subjectSummary,ctx.trigger.subjectSummary);assert.equal(snapshot.dossier.selectedTrigger.excerpt,h.item.dossier.selectedTrigger.excerpt);
 const changed={...ctx,trigger:{...ctx.trigger,subjectSummary:'A new sorting plant at Riverport.'}};assert.notEqual(E.scope('w1',h.item,h.studio,ctx),E.scope('w1',h.item,h.studio,changed));
});
