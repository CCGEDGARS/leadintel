const test=require('node:test'),assert=require('node:assert/strict');
let R;try{R=require('../message-delivery-review.js');}catch{R={};}
const item=()=>({domain:'buyer.example',selectedPersonId:'p1',channel:'email',drafts:{emailSubject:'Hello',emailBody:'Exact message'},messageStudioDraft:{editorOrigin:'tailored',tailoredOriginal:{key:'original',draft:{subject:'Original',message:'Protected original'}}}});
const draft={subject:'Hello',message:'Exact message'},context={workspaceId:'w1',userId:'u1',domain:'buyer.example',personId:'p1',contextKey:'current'};
test('Continue records deliberate current-text review without changing text, origin, originals or approval',()=>{
 assert.equal(typeof R.capture,'function');const source=item(),before=JSON.stringify(source),next=R.capture(source,draft,context);assert.equal(JSON.stringify(source),before);assert.equal(next.drafts.emailBody,source.drafts.emailBody);assert.equal(next.messageStudioDraft.editorOrigin,'tailored');assert.deepEqual(next.messageStudioDraft.tailoredOriginal,source.messageStudioDraft.tailoredOriginal);assert.equal(next.approved,undefined);assert.equal(R.accepted(next,draft,context),true);
});
test('delivery review cannot transfer to another user, workspace, buyer, text, language or context',()=>{
 assert.equal(typeof R.capture,'function');const next=R.capture(item(),draft,context);
 for(const change of [{workspaceId:'w2'},{userId:'u2'},{domain:'other.example'},{personId:'p2'},{contextKey:'new-language'}])assert.equal(R.accepted(next,draft,{...context,...change}),false);
 for(const change of [{subject:'Changed'},{message:'Changed'},{messageHtml:'<p>Changed</p>'}])assert.equal(R.accepted(next,{...draft,...change},context),false);
 assert.throws(()=>R.capture({...item(),selectedPersonId:'p2'},draft,context),/recipient/i);assert.throws(()=>R.capture(item(),{subject:'',message:''},context),/message/i);
});

test('review of the displayed draft survives real workspace normalization and does not apply another template',async()=>{
 const {mounted}=require('./helpers/message-runtime.js'),h=mounted({selected:'friendly',runtimeSetup:"saveScriptPackage=async next=>{upsertItem(next);return {ok:true};};globalThis.autoPrepare=automaticallyPrepareMessage;globalThis.reviewVisible=reviewCurrentDeliveryDraft;globalThis.reviewAccepted=()=>currentDeliveryReview();"});
 try{const before=JSON.stringify(h.item().drafts),origin=h.item().messageStudioDraft.editorOrigin,original=JSON.stringify(h.item().messageStudioDraft.tailoredOriginal);await h.w.reviewVisible();assert.equal(h.w.reviewAccepted(),true);assert.equal(h.w.autoPrepare(),false);assert.equal(JSON.stringify(h.item().drafts),before);assert.equal(h.item().messageStudioDraft.editorOrigin,origin);assert.equal(JSON.stringify(h.item().messageStudioDraft.tailoredOriginal),original);assert.ok(h.item().messageStudioDraft.deliveryReview);assert.equal(h.requests.some(r=>/send|enqueue/.test(r.url)),false);}finally{h.w.close();}
});

test('Continue cannot reuse another buyer’s original even when a package is accidentally retargeted',()=>{
 const source=item();source.messageStudioDraft.tailoredOriginal.key=JSON.stringify(['w1','buyer.example','original-buyer','email']);assert.throws(()=>R.capture(source,draft,context),/recipient/i);
 const reviewed=R.capture(item(),draft,context),retargeted={...reviewed,selectedPersonId:'p2'};assert.throws(()=>R.capture(retargeted,draft,{...context,personId:'p2'}),/recipient/i);
});


test('real Messages quality permits direct Delivery review while retaining real missing requirements',async()=>{
 const {mounted}=require('./helpers/message-runtime.js'),Q=require('../page-quality.js');
 const h=mounted({selected:'friendly',runtimeSetup:"globalThis.qualityContext=messageQualityContext;syncCrmActivity=async()=>({ok:true});globalThis.reviewVisible=reviewCurrentDeliveryDraft;globalThis.setQualityDraft=text=>{const item=currentItem();upsertItem({...item,drafts:{...item.drafts,emailBody:text}});q('outreach-email-body').value=text;};"});
 try{
  h.w.LeadIntelStep2Brief={confirmationMissing:()=>[]};h.w.LeadIntelPageQuality=Q;
  h.w.setQualityDraft(h.before.message.replaceAll('[Add verified cost basis]','A confirmed cost basis').replaceAll('[link]','https://north.example/projects'));
  const report=()=>Q.inspect('messages',{...h.w.qualityContext(),session:{ready:true,authenticated:true,workspaceId:'w1'}});
  assert.equal(Q.allowed(report(),'delivery'),true);assert.equal(Q.allowed(report(),'flow'),false);
  await h.w.reviewVisible();assert.equal(Q.allowed(report(),'delivery'),true);assert.equal(Q.allowed(report(),'flow'),true);
  h.w.setQualityDraft('Missing {{sender}}');assert.equal(Q.allowed(report(),'delivery'),false);
  h.w.setQualityDraft(h.before.message);h.w.LeadIntelServerBridge.conflict=true;
  assert.equal(Q.allowed(Q.inspect('messages',{...h.w.qualityContext(),session:{ready:true,authenticated:true,workspaceId:'w1',conflict:true}}),'delivery'),false);
 }finally{h.w.close();}
});


function readyContinue(padding=''){
 const {mounted}=require('./helpers/message-runtime.js'),Q=require('../page-quality.js');
 const h=mounted({selected:'friendly',runtimeSetup:"globalThis.qualityContext=messageQualityContext;syncCrmActivity=async()=>({ok:true});globalThis.pauseDeliverySave=fn=>syncCrmActivity=fn;globalThis.changeDeliveryContext=()=>{const s=readStudio();persistStudio({...s,essentials:{...s.essentials,calendly:'https://calendly.com/north/changed'}});};updatePipelineStage=()=>{};loadDeliveryModules=async()=>{};globalThis.continueDelivery=addCurrentMessageToFlow;toast=message=>{globalThis.lastToast=(globalThis.lastToast||'')+' | '+message;};"});
  h.w.LeadIntelStep2Brief={confirmationMissing:()=>[]};
  h.w.eval("const readyItem=currentItem(),body="+JSON.stringify(padding)+"+readyItem.drafts.emailBody.replaceAll('[Add verified cost basis]','A confirmed cost basis').replaceAll('[link]','https://north.example/projects')+"+JSON.stringify(padding)+";upsertItem({...readyItem,localizationApprovalBlocked:false,localizationStatus:'native',campaignScenario:{id:'core',language:'en',resolvedLanguage:'en'},localizationProvenance:{language:'en',provider:'approved-template',model:'verbatim-facts-v7',selectionSource:'manual'},drafts:{...readyItem.drafts,emailBody:body,emailSubject:'  '+readyItem.drafts.emailSubject+'  '}});document.getElementById('outreach-email-subject').value=currentItem().drafts.emailSubject;document.getElementById('outreach-email-body').value=body;");
  const exact=h.q('outreach-email-body').value,coordinator=Q.createCoordinator({session:()=>({ready:true,authenticated:true,workspaceId:'w1'})});
  coordinator.register('messages',{read:()=>h.w.qualityContext()});h.w.LeadIntelPageQuality={...Q,...coordinator};
  let opened=0;h.w.addEventListener('leadintel:message-flow-ready',()=>opened++);
  return {...h,exact,get opened(){return opened;}};
}
for(const padding of ['', '  \n'])test('one Continue preserves exact working text including '+JSON.stringify(padding),async()=>{
 const h=readyContinue(padding);try{
  assert.equal(await h.w.continueDelivery(),true,h.w.lastToast);assert.equal(h.opened,1);assert.equal(h.item().drafts.emailBody,h.exact);assert.equal(h.item().approved,true);
  const O=require('../outreach-engine.js'),snapshot=JSON.parse(JSON.stringify(O.buildCrmScriptSnapshot(h.item()))),restored=O.restoreCrmScriptSnapshot(snapshot,'buyer.example');
  for(const copy of [h.item(),restored]){const payload=O.buildApprovedSendPayload(copy);assert.equal(copy.approvedSource.emailBody,h.exact);assert.equal(copy.approvedSource.emailSubject,h.q('outreach-email-subject').value);assert.equal(payload.textBody,h.exact);assert.equal(payload.subject,copy.drafts.emailSubject);const compose=new URL(require('../delivery-engine.js').buildGmailComposeUrl(copy,'alex@buyer.example'));assert.equal(compose.searchParams.get('su'),payload.subject);assert.equal(compose.searchParams.get('body'),payload.textBody);}
  assert.equal(h.item().messageStudioDraft.flowMembership.message,h.exact);assert.equal(h.item().messageStudioDraft.flowMembership.mode,'manual');assert.equal(h.requests.some(r=>/send|enqueue/.test(r.url)),false);
 }finally{h.w.close();}
});
for(const boundary of [3,4])test('changing meeting settings during '+(boundary===3?'approval':'final save')+' prevents Delivery navigation',async()=>{
 const h=readyContinue();let finish,calls=0;
 h.w.pauseDeliverySave(()=>++calls===boundary?new Promise(resolve=>finish=resolve):Promise.resolve({ok:true}));
 try{
  const pending=h.w.continueDelivery();for(let i=0;i<30&&!finish;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof finish,'function');h.w.changeDeliveryContext();finish({ok:true});
  assert.equal(await pending,false);assert.equal(h.opened,0);assert.equal(h.item().drafts.emailBody,h.exact);assert.equal(h.requests.some(r=>/send|enqueue/.test(r.url)),false);
 }finally{h.w.close();}
});
