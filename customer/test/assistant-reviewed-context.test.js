const test=require('node:test'),assert=require('node:assert/strict'),{mounted}=require('./helpers/message-runtime.js');
test('a reviewed working copy stays current across refreshes and a later settings change still requests review',()=>{
 const h=mounted({selected:'professional'});try{
  h.w.eval(`{const item=currentItem(),studio=studioState(),key=LeadIntelMessageEditor.scope('w1',item,studio,{...studioMessageContext(item,selectedCandidate()),eventCampaign:null});upsertItem({...item,drafts:{...item.drafts,emailBody:'Hi Alex, this is our deliberately reviewed working copy.'},messageStudioDraft:{...item.messageStudioDraft,editorOrigin:'manual',essentials:studio.essentials,triggerSourceUrl:item.dossier?.selectedTrigger?.url||'',pendingTemplateUpdate:undefined,reviewedMessageScope:key,tailoredOriginal:{...item.messageStudioDraft.tailoredOriginal,key:'earlier-context'}}});renderAll();}`);
  assert.equal(h.w.eval('automaticallyPrepareMessage()'),false);
  assert.equal(h.item().messageStudioDraft.pendingTemplateUpdate,undefined);
  const fresh=mounted({selected:'professional',outreachSnapshot:JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach'))});try{assert.equal(fresh.w.eval('automaticallyPrepareMessage()'),false);assert.equal(fresh.item().messageStudioDraft.pendingTemplateUpdate,undefined);}finally{fresh.w.close();}
  h.q('message-calendly').value='https://calendly.com/north/new-discussion';h.q('message-calendly').dispatchEvent(new h.w.Event('input',{bubbles:true}));
  assert.equal(h.w.eval('automaticallyPrepareMessage()'),true,'new settings still need a fresh review');
  assert.ok(h.item().messageStudioDraft.pendingTemplateUpdate);
  assert.equal(h.item().drafts.emailBody,'Hi Alex, this is our deliberately reviewed working copy.');
 }finally{h.w.close();}
});
