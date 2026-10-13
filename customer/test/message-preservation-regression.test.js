const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const E=require('../message-editor.js'),S=require('../message-studio.js'),O=require('../outreach-engine.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const origin of ['tailored','rewrite'])test(`saved ${origin} subject remains exact when reopening and rendering legacy data`,()=>{
 const h=mounted({selected:'professional'});try{
  const before={subject:'Historical reviewed subject '+ 'Northport '.repeat(8),message:h.before.message};
  const item=E.apply(h.item(),before,{origin,style:'professional',essentials:h.w.studioState().essentials});
  item.messageStudioDraft.scriptSavedAt='2026-10-11';item.messageStudioDraft.savedDraft=before;
  h.w.upsertItem(item);h.w.renderAll();
  assert.deepEqual(E.workingDraft(h.item()),before);assert.equal(E.savedDraft(h.item()),true);
  const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item()),'buyer.example');
  assert.deepEqual(E.workingDraft(restored),before);
 }finally{h.w.close();}
});
test('rewritten invalid subjects are never repaired implicitly',()=>{
 const studio=S.normalize({mode:'professional',essentials:{sender:'Robin Lane',company:'North Works',offer:'steel installation'}});
 const before=E.apply({channel:'email',drafts:{}},{subject:'Historical '+ 'subject '.repeat(12),message:'Explicitly rewritten text'},{origin:'rewrite',style:'professional',essentials:studio.essentials});
 assert.equal(E.repairSubject(before,studio,{buyerCompany:'Buyer'}),before);
});
test('Reset after failed style creation restores the original style and exact draft together',async()=>{
 const h=mounted({selected:'professional'});try{
  h.w.document.querySelector('[data-writing-style="original"]').click();
  h.requests.find(row=>row.url.includes('/api/ai/generate')).resolve({ok:false,json:async()=>({error:'Provider unavailable'})});await settle();
  assert.equal(h.w.studioState().mode,'original');
  h.q('mw-restore-original').click();
  assert.deepEqual(E.workingDraft(h.item()),h.before);
  assert.equal(h.item().messageStudioDraft.mode,'professional');
  assert.equal(h.w.studioState().mode,'professional');
  assert.equal(h.q('mw-applied-style').textContent,'Style: Professional');
 }finally{h.w.close();}
});
test('edited Professional drafts show working-copy provenance without claiming a different style',()=>{
 const h=mounted({selected:'professional'});try{
  const item=E.apply(h.item(),{subject:h.before.subject,message:'My deliberately edited Professional copy'},{origin:'rewrite',style:'professional'});
  h.w.upsertItem(item);h.w.renderAll();
  assert.equal(h.q('mw-applied-style').textContent,'Style: Professional');
  assert.equal(h.q('mw-draft-provenance').hidden,false);
  assert.equal(h.q('mw-draft-provenance').textContent,'Working copy · approved template available');
  h.w.document.querySelector('[data-writing-style="professional"]').click();
  assert.equal(h.q('mw-draft-provenance').textContent,'Personalized template');
 }finally{h.w.close();}
});
test('Reset clears saved readiness even when the restored original text is identical',()=>{
 const h=mounted({selected:'professional'});try{
  assert.equal(E.savedDraft(h.item()),true);
  h.q('mw-restore-original').click();
  assert.deepEqual(E.workingDraft(h.item()),h.before);
  assert.equal(E.savedDraft(h.item()),false);
  assert.equal(h.q('mw-draft-badge').textContent,'Unsaved changes');
 }finally{h.w.close();}
});
test('LinkedIn Reset restores its original mode and preserves the separate email default',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
 const studio=S.normalize({mode:'friendly',linkedinMode:'original',defaultSelection:{email:'email-snapshot',linkedin:'linkedin-snapshot'}});
 const original={subject:'',message:'Hi Alex, Robin Lane from North Works. A relevant LinkedIn introduction.'};
 let item=E.apply({domain:'buyer.example',selectedPersonId:'p1',channel:'linkedin',drafts:{}},original,{original:true,key:'first-linkedin',style:'curiosity',essentials:studio.essentials});
 item=E.apply(item,{subject:'',message:'Edited LinkedIn copy'},{origin:'manual',style:'curiosity'});
 let persisted;
 const ctx={LeadIntelMessageEditor:E,LeadIntelMessageStudio:S,messageWorkspaceUsable:()=>true,messageEditor:{state:()=>({}),cancelEdit(){},cancelPreview(){}},currentItem:()=>item,studioState:()=>studio,studioMessageContext:()=>({channel:'linkedin'}),selectedCandidate:()=>({domain:'buyer.example'}),crmBridge:()=>({workspace:{id:'w1'}}),cancelPendingScriptGeneration(){},persistStudio:value=>persisted=JSON.parse(JSON.stringify(value)),upsertItem:value=>item=value,renderAll(){},toast(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function restorePrePersonalizationDraft('),source.indexOf('let messageEditor=null;')),ctx);
 ctx.restorePrePersonalizationDraft();
 assert.equal(item.drafts.linkedinMessage,original.message);assert.equal(item.messageStudioDraft.mode,'curiosity');
 assert.equal(persisted.linkedinMode,'curiosity');assert.equal(persisted.mode,'friendly');
 assert.equal(persisted.defaultSelection.email,'email-snapshot');assert.equal(persisted.defaultSelection.linkedin,undefined);
});
