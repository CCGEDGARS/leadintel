const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const S=require('../message-studio.js'),E=require('../message-editor.js'),O=require('../outreach-engine.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));

for(const style of ['professional','curiosity','friendly','brutal'])test(`rescue mounted ${style} applies actual canonical renderer and five subjects`,()=>{
 const h=mounted({selected:style});try{
  const before=h.item().messageStudioDraft.tailoredOriginal;
  h.w.document.querySelector(`[data-writing-style="${style}"]`).click();
  const item=h.item(),studio=h.w.studioState(),context=h.w.studioMessageContext();
  assert.equal(item.messageStudioDraft.mode,style);
  assert.equal(item.messageStudioDraft.editorOrigin,'tailored');
  assert.equal(item.drafts.emailBody,E.tailor(studio,context).message);
  assert.equal(h.q('outreach-email-body').value,item.drafts.emailBody);
  assert.equal(S.subjectAudit(studio,context).ready,5);
  E.validateCoreDraft(studio,context,E.workingDraft(item));
  assert.ok(item.messageStudioDraft.tailoredOriginal);
  assert.ok(JSON.stringify(item.messageStudioDraft).includes(before.draft.message.replace(/\n/g,'\\n')));
  assert.equal(E.savedDraft(item),false);
  assert.equal(h.requests.filter(row=>/delivery|send|sequence|writing-assistant/.test(row.url)).length,0);
 }finally{h.w.close();}
});

for(const handler of ['regenerateDrafts','confirmOutreachLanguage','applyCampaignToCurrent','buildDossier'])test(`rescue ${handler} cannot overwrite approved-frame first contact with generic legacy copy`,async()=>{
 const h=mounted({selected:'professional'});try{
  // These stubs isolate the real mounted handler from providers/localization.
  h.w.eval('prepareLocalizedItem=async item=>item;officialScrape=async()=>[];dossierSearch=async()=>[];syncCrmActivity=async()=>({ok:true});');
  const seeded=h.item();seeded.drafts.linkedinMessage='Separate saved LinkedIn working copy';h.w.upsertItem(seeded);h.w.renderAll();
  h.q('outreach-email-language').value='en';
  const before=h.item(),draft=E.workingDraft(before);
  await h.w[handler]();await settle();
  const after=h.item();assert.deepEqual(E.workingDraft(after),draft);
  assert.deepEqual(after.messageStudioDraft.tailoredOriginal,before.messageStudioDraft.tailoredOriginal);
  assert.equal(after.messageStudioDraft.editorOrigin,before.messageStudioDraft.editorOrigin);
  assert.equal(after.drafts.linkedinMessage,before.drafts.linkedinMessage);
  assert.equal(h.q('outreach-email-body').value,draft.message);
 }finally{h.w.close();}
});

test('rescue legacy auxiliary refresh leaves a new email empty until explicit creation',async()=>{
 const h=mounted({selected:'professional'});try{
  const item=h.item();item.drafts={};item.messageStudioDraft={};h.w.upsertItem(item);h.w.renderAll();
  h.w.eval('prepareLocalizedItem=async item=>item;');
  await h.w.regenerateDrafts();
  assert.equal(h.item().drafts.emailBody||'','');assert.equal(h.item().drafts.emailSubject||'','');
  assert.equal(h.q('outreach-email-body').value,'');
 }finally{h.w.close();}
});

for(const handler of ['regenerateDrafts','confirmOutreachLanguage','applyCampaignToCurrent'])test(`rescue ${handler} retains unsaved typed editor text`,async()=>{
 const h=mounted({selected:'professional'});try{
  h.w.eval('prepareLocalizedItem=async item=>item;');h.q('outreach-email-language').value='en';
  h.q('mw-edit-message').click();
  h.q('outreach-email-body').value='Unsaved typed working message\n\nExact spacing.';
  h.q('outreach-email-body').dispatchEvent(new h.w.Event('input',{bubbles:true}));
  await h.w[handler]();
  assert.equal(h.q('outreach-email-body').value,'Unsaved typed working message\n\nExact spacing.');
 }finally{h.w.close();}
});

test('rescue opening saved or historical automatically generated copy never rewrites it or spends generation credits',()=>{
 const seed=mounted({selected:'professional'});const snapshot=JSON.parse(seed.w.localStorage.getItem('leadintel_customer_v2_outreach'));seed.w.close();
 snapshot.items[0].drafts.emailBody='Historical automatically generated short message';
 snapshot.items[0].messageStudioDraft.editorOrigin='manual';
 snapshot.items[0].messageStudioDraft.savedDraft=E.workingDraft(snapshot.items[0]);
 const h=mounted({outreachSnapshot:snapshot});try{
  const before=E.workingDraft(h.item());h.w.renderAll();h.w.renderAll();
  assert.deepEqual(E.workingDraft(h.item()),before);assert.equal(h.q('outreach-email-body').value,before.message);
  assert.equal(h.requests.filter(row=>/ai\/generate|writing-assistant|send|sequence/.test(row.url)).length,0);
  const crm=O.buildCrmScriptSnapshot(h.item());assert.ok(JSON.stringify(crm).includes(before.message));
 }finally{h.w.close();}
});

test('rescue mounted control IDs stay unique through repeated render',()=>{
 const h=mounted();try{
  h.w.renderAll();h.w.renderAll();
  for(const id of ['outreach-email-body','outreach-email-subject','mw-save-message','mw-restore-original','mw-add-flow','message-generate','mw-subject-picker'])assert.equal(h.w.document.querySelectorAll(`[id="${id}"]`).length,1,id);
 }finally{h.w.close();}
});

test('rescue explicit core click disables personal override without deleting its source, and exact Save reopens',async()=>{
 const h=mounted({selected:'professional'});let reopened;
 try{
  h.w.persistStudio(S.savePersonalStyle(h.w.studioState(),'professional',{subject:'My reusable subject',body:'My stored personal writing pattern'}));
  h.w.renderAll();
  h.w.document.querySelector('[data-writing-style="professional"]').click();
  const applied=h.item(),studio=h.w.studioState();
  assert.equal(studio.personalStyles.professional.active,false);
  assert.equal(studio.personalStyles.professional.body,'My stored personal writing pattern');
  assert.equal(applied.drafts.emailBody,E.tailor(studio,h.w.studioMessageContext()).message);
  h.w.eval('syncCrmActivity=async()=>({ok:true});');
  assert.equal((await h.w.saveScriptPackage(applied)).ok,true);
  assert.equal(E.savedDraft(h.item()),true);
  const snapshot=JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach'));
  const crm=O.buildCrmScriptSnapshot(h.item()),restored=O.restoreCrmScriptSnapshot(crm,applied.domain);
  assert.deepEqual(E.workingDraft(restored),E.workingDraft(applied));
  assert.deepEqual(restored.messageStudioDraft.tailoredOriginal,applied.messageStudioDraft.tailoredOriginal);
  reopened=mounted({outreachSnapshot:snapshot});
  assert.equal(reopened.q('outreach-email-body').value,applied.drafts.emailBody);
  assert.equal(E.savedDraft(reopened.item()),true);
  const original=reopened.item().messageStudioDraft.tailoredOriginal.draft;
  reopened.w.upsertItem(E.apply(reopened.item(),{subject:'Changed subject',message:'Changed working copy'},{origin:'manual'}));reopened.w.renderAll();
  reopened.q('mw-restore-original').click();
  assert.deepEqual(E.workingDraft(reopened.item()),original);
 }finally{reopened?.w.close();h.w.close();}
});
