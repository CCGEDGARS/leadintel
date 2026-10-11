const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const Editor=require('../message-editor.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const fields={triggerSummary:'Buyer is investing in a new sorting plant at Northport.',offer:'steel and installation',value:'simplify project delivery',difference:'Our team supports industrial projects.',approach:'Project delivery to EN 1090 requirements',meetingValue:'relevant project lessons'};
function longOffer(h){const key='leadintel_customer_v2_state',main=JSON.parse(h.w.localStorage.getItem(key));main.profile.priorityOffers='steel and installation '.repeat(8);h.w.localStorage.setItem(key,JSON.stringify(main));}
function blankPreparation(h,name){
 const panel=h.q('mw-preparing-editor');assert.ok(panel,'blank preparation panel exists');assert.equal(panel.hidden,false);
 assert.equal(h.q('mw-subject-options').hidden,true,'previous subjects are not displayed');
 assert.equal(h.q('step-6').querySelector('.outreach-drafts .script-grid').hidden,true,'previous body is not displayed');
 assert.equal(panel.querySelector('input').value,'');assert.equal(panel.querySelector('textarea').value,'');
 assert.equal(panel.querySelector('input').readOnly,true);assert.equal(panel.querySelector('textarea').readOnly,true);
 assert.equal(h.q('mw-copy-email').hidden,true);assert.equal(h.q('mw-draft-badge').hidden,true);
 assert.equal(h.q('mw-applied-style').textContent,`Preparing ${name}…`);
 assert.deepEqual(Editor.workingDraft(h.item()),h.before,'preparation never persists empty content');
 assert.equal(h.q('mw-save-message').disabled,true);assert.equal(h.q('mw-add-flow').disabled,true);
}
for(const [style,name] of [['professional','Professional'],['curiosity','NLP'],['friendly','Friendly'],['brutal','Brutal Honesty']])test(`${name} click displays blank fields until validated content is ready`,async()=>{
 const h=mounted();try{
  longOffer(h);h.w.document.querySelector(`[data-writing-style="${style}"]`).click();blankPreparation(h,name);
  h.w.renderAll();blankPreparation(h,name);
  const request=h.requests.find(row=>row.url.includes('/api/ai/generate'));assert.ok(request);
  request.resolve({ok:true,json:async()=>({text:JSON.stringify(style==='professional'?{...fields,value:'',difference:'',approach:'',meetingValue:''}:fields)})});await settle();
  assert.equal(h.q('mw-preparing-editor').hidden,true);assert.equal(h.q('mw-subject-options').hidden,false);
  assert.equal(h.q('step-6').querySelector('.outreach-drafts .script-grid').hidden,false);
  assert.equal(h.item().messageStudioDraft.mode,style);assert.equal(h.q('mw-applied-style').textContent,`Style: ${name}`);
  assert.equal(h.q('outreach-email-body').value,h.item().drafts.emailBody);assert.ok(h.q('outreach-email-body').value);
  assert.deepEqual(Editor.updateUndo(h.item()),h.before);assert.equal(Editor.savedDraft(h.item()),false);
 }finally{h.w.close();}
});
test('failed AI Generated preparation restores the saved message and shows its failure',async()=>{
 const h=mounted();try{
  h.w.document.querySelector('[data-writing-style="original"]').click();blankPreparation(h,'AI Generated');
  h.requests.find(row=>row.url.includes('/api/ai/generate')).resolve({ok:false,json:async()=>({error:'Provider unavailable'})});await settle();
  assert.equal(h.q('mw-preparing-editor').hidden,true);assert.equal(h.q('mw-subject-options').hidden,false);
  assert.equal(h.q('step-6').querySelector('.outreach-drafts .script-grid').hidden,false);
  assert.equal(h.q('outreach-email-body').value,h.before.message);assert.equal(h.q('outreach-email-subject').value,h.before.subject);
  assert.equal(h.q('mw-applied-style').textContent,'Style: Professional');assert.equal(h.q('mw-draft-badge').hidden,false);
  assert.match(h.q('message-generation-status').textContent,/Provider unavailable/);assert.deepEqual(Editor.workingDraft(h.item()),h.before);
 }finally{h.w.close();}
});
test('a newer style owns the blank editor and an old reply cannot reveal or replace its content',async()=>{
 const h=mounted();try{
  longOffer(h);h.w.document.querySelector('[data-writing-style="curiosity"]').click();const old=h.requests.find(row=>row.url.includes('/api/ai/generate'));
  h.w.document.querySelector('[data-writing-style="friendly"]').click();const fresh=h.requests.findLast(row=>row.url.includes('/api/ai/generate'));assert.notEqual(old,fresh);blankPreparation(h,'Friendly');
  old.resolve({ok:true,json:async()=>({text:JSON.stringify(fields)})});await settle();blankPreparation(h,'Friendly');
  fresh.resolve({ok:true,json:async()=>({text:JSON.stringify(fields)})});await settle();assert.equal(h.q('mw-preparing-editor').hidden,true);assert.equal(h.item().messageStudioDraft.mode,'friendly');
 }finally{h.w.close();}
});
test('opening a saved draft and subject-only updates keep its visible content',()=>{
 const h=mounted();try{
  assert.equal(h.q('mw-preparing-editor').hidden,true);assert.equal(h.q('outreach-email-body').value,h.before.message);
  h.w.LeadIntelMessageWorkspace.render(h.w.document,{ready:true,authenticated:true,channel:'email',hasDraft:true,selectedStyle:'professional',appliedStyle:'professional',senderIdentityReady:true,busy:true,subjectBusy:true});
  assert.equal(h.q('mw-preparing-editor').hidden,true);assert.equal(h.q('step-6').querySelector('.outreach-drafts .script-grid').hidden,false);assert.equal(h.q('outreach-email-body').value,h.before.message);
 }finally{h.w.close();}
});
test('background factual preparation preserves the visible saved message',()=>{
 const h=mounted();try{
  longOffer(h);h.w.seedMandatoryEmail('curiosity',{replace:true,automatic:true});
  assert.ok(h.requests.find(row=>row.url.includes('/api/ai/generate')));
  assert.equal(h.q('mw-preparing-editor').hidden,true);assert.equal(h.q('mw-subject-options').hidden,false);
  assert.equal(h.q('step-6').querySelector('.outreach-drafts .script-grid').hidden,false);
  assert.equal(h.q('outreach-email-body').value,h.before.message);assert.deepEqual(Editor.workingDraft(h.item()),h.before);
 }finally{h.w.close();}
});
