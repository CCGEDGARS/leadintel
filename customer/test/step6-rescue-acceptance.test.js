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

for(const style of ['professional','curiosity','friendly','brutal'])test(`rescue explicit approved ${style} recovery archives a corrupted original and fixes Reset without reopening mutation`,()=>{
 const h=mounted({selected:style});try{
  h.w.document.querySelector(`[data-writing-style="${style}"]`).click();
  const canonical=E.workingDraft(h.item()),item=h.item(),legacy={subject:canonical.subject,message:'Legacy automatically generated shortened copy\n\nUnchanged historical spacing.'};
  // Same scope, corrupt original: ordinary original:true must not silently repair it.
  item.drafts.emailBody=legacy.message;item.messageStudioDraft.tailoredOriginal.draft=legacy;
  item.messageStudioDraft.editorOrigin='manual';item.messageStudioDraft.scriptSavedAt='historical';item.messageStudioDraft.savedDraft=legacy;
  h.w.upsertItem(item);h.w.renderAll();h.w.renderAll();
  assert.deepEqual(E.workingDraft(h.item()),legacy);
  assert.equal(h.q('mw-approved-recovery').hidden,false);
  assert.match(h.q('mw-draft-provenance').textContent,/Working copy/);
  assert.doesNotMatch(h.q('mw-draft-provenance').textContent,/Edited/);
  assert.match(h.q('mw-restore-approved').textContent,/Restore approved/);
  h.q('mw-restore-approved').click();
  const restored=h.item();assert.deepEqual(E.workingDraft(restored),canonical);
  assert.deepEqual(E.updateUndo(restored),legacy);
  assert.deepEqual(restored.messageStudioDraft.tailoredOriginal.draft,canonical);
  assert.ok(restored.messageStudioDraft.originalHistory.some(row=>row.draft.message===legacy.message));
  assert.equal(E.savedDraft(restored),false);assert.equal(h.q('mw-approved-recovery').hidden,true);
  h.w.upsertItem(E.apply(restored,{subject:'Different subject',message:'Different working copy'},{origin:'manual'}));h.w.renderAll();h.w.restorePrePersonalizationDraft();
  assert.deepEqual(E.workingDraft(h.item()),canonical);
 }finally{h.w.close();}
});

test('rescue recovery stays unavailable for event, LinkedIn and translated copies',()=>{
 const h=mounted({selected:'professional'});try{
  const studio=h.w.studioState(),context=h.w.studioMessageContext(),item=h.item();
  for(const copy of [{...item,channel:'linkedin'},{...item,messageStudioDraft:{...item.messageStudioDraft,eventSnapshot:{id:'event'}}},{...item,messageStudioDraft:{...item.messageStudioDraft,languageVersions:{activeLanguage:'lv'}}}])assert.equal(E.coreWorkingStatus(copy,studio,context).applicable,false);
 }finally{h.w.close();}
});

test('rescue core status cannot treat an active personal copy as canonical and never mutates saved defaults',()=>{
 const h=mounted({selected:'professional'});try{
  let studio=S.savePersonalStyle(h.w.studioState(),'professional',{subject:'Saved subject',body:'Saved shortened personal copy'});
  studio=S.saveMyTemplate(studio,'template-1',{name:'Saved default',subject:'Default subject',body:'Saved default body'});
  studio=S.markDefault(studio,'template-1','email');studio=S.applyDefault(studio,'email');
  const item=h.item();item.messageStudioDraft.mode='professional';item.drafts.emailBody='Saved shortened personal copy';
  const before=JSON.stringify(studio),status=E.coreWorkingStatus(item,studio,h.w.studioMessageContext());
  assert.equal(status.matches,false);assert.equal(JSON.stringify(studio),before);
  h.w.persistStudio(studio);h.w.upsertItem(item);h.w.renderAll();
  assert.equal(h.q('mw-approved-recovery').hidden,false);
 }finally{h.w.close();}
});
