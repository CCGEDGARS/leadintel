const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const {JSDOM}=require('jsdom');
const StoryUI=require('../storyselling-ui.js');
const AssistantUI=require('../writing-assistant-ui.js');

test('Storyselling is the fifth native style and preserves Undo without a bank',()=>{
 const h=mounted();try{const buttons=[...h.w.document.querySelectorAll('#mw-style-options [data-writing-style]')];assert.deepEqual(buttons.map(b=>b.dataset.writingStyle),['professional','curiosity','friendly','brutal','storyselling']);buttons.at(-1).click();assert.equal(h.q('message-mode').value,'storyselling');assert.equal(h.q('mw-applied-style').textContent,'Style: Storyselling');assert.match(h.item().drafts.emailBody,/Suppose/);assert.ok(h.item().messageStudioDraft.previousDrafts.length);assert.equal(h.w.document.querySelector('[data-story-style]'),null);}finally{h.w.close();}
});

test('a saved Storyselling message keeps its label and source receipt after CRM reopen',()=>{
 const h=mounted();try{
  const E=require('../message-editor.js'),O=require('../outreach-engine.js'),before=h.item();
  before.messageStudioDraft.writingAssistant={workspaceId:'w1',storyRef:{id:'s1',revision:2,previewToken:'receipt'}};
  before.messageStudioDraft.writingAssistantDraft=E.workingDraft(before);
  h.w.upsertItem(before);h.w.renderAll();
  assert.equal(h.q('mw-applied-style').textContent,'Style: Storyselling');
  assert.equal(h.w.document.querySelector('[data-writing-style="storyselling"]').getAttribute('aria-pressed'),'true');
  const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item()),'buyer.example');
  assert.equal(restored.messageStudioDraft.writingAssistant.storyRef.previewToken,'receipt');
  const snapshot=JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach'));
  const reopened=mounted({outreachSnapshot:snapshot});try{assert.equal(reopened.q('mw-applied-style').textContent,'Style: Storyselling');}finally{reopened.w.close();}
  h.w.document.querySelector('[data-writing-style="friendly"]').click();
  assert.equal(h.q('mw-applied-style').textContent,'Style: Friendly');
 }finally{h.w.close();}
});

test('ordinary Writing Assistant has books and no separate Storyselling controls',()=>{
 const dom=new JSDOM('<section id="mw-writing-assistant"></section>',{url:'https://app.test',pretendToBeVisual:true}),d=dom.window.document;
 dom.window.LeadIntelStorysellingUI=StoryUI;
 const controller={state:()=>({messages:[],busy:false,instruction:'',working:{subject:'',message:''},scope:'w1:p1'}),syncContext(){},cancel(){}};
 const ui=AssistantUI.mountWritingAssistant(d,controller,{usable:()=>true});try{ui.open();assert.equal(d.querySelector('[data-story-style]'),null);assert.equal(d.querySelector('.story-bank'),null);assert.ok(d.querySelector('[data-wa-instruction]'));}finally{ui.destroy();dom.window.close();}
});
