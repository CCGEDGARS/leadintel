const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js');
const {JSDOM}=require('jsdom');
const StoryUI=require('../storyselling-ui.js');
const AssistantUI=require('../writing-assistant-ui.js');

test('Storyselling is the fifth message style and opens its tools without replacing the saved email',async()=>{
 const h=mounted();
 try{
  let selected='';h.w.document.addEventListener('leadintel:storyselling-open',()=>selected='storyselling');
  const buttons=[...h.w.document.querySelectorAll('#mw-style-options [data-writing-style]')];
  assert.deepEqual(buttons.map(b=>b.dataset.writingStyle),['professional','curiosity','friendly','brutal','storyselling']);
  h.w.eval(require('node:fs').readFileSync(require.resolve('../channel-scripts.js'),'utf8'));h.w.installChannelScripts();
  h.w.LeadIntelWritingAssistant=require('../writing-assistant.js');h.w.LeadIntelWritingAssistantUI=AssistantUI;h.w.LeadIntelStorysellingUI=StoryUI;h.w.installWritingAssistant();
  h.w.document.querySelector('[data-writing-style=storyselling]').click();assert.equal(selected,'storyselling');
  await new Promise(r=>setImmediate(r));
  assert.equal(h.w.document.querySelector('#wa-writing-dialog').hasAttribute('open'),true);
  assert.equal(h.w.document.querySelector('[data-story-style]').value,'storyselling');
  assert.deepEqual(require('../message-editor.js').workingDraft(h.item()),h.before);
  assert.equal(h.q('message-mode').value,'curiosity');
 }finally{h.w.close();}
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

test('Storyselling entry opens the assistant, activates the story bank and forwards preview selection',async()=>{
 const dom=new JSDOM('<section id="mw-writing-assistant"></section>',{url:'https://app.test',pretendToBeVisual:true}),d=dom.window.document;
 dom.window.LeadIntelStorysellingUI=StoryUI;
 dom.window.fetch=async()=>({ok:true,json:async()=>({cards:[]})});
 let request=null,instruction='';const draft={subject:'Saved subject',message:'Keep my saved draft'};
 const controller={state:()=>({messages:[],busy:false,instruction,working:draft,scope:'w1:p1'}),setInstruction:v=>instruction=v,syncContext(){},ask:async(value,options)=>request={value,options},applyPreview(){},discardPreview(){},cancel(){}};
 const ui=AssistantUI.mountWritingAssistant(d,controller,{currentWorkspace:()=> 'w1',assistantContext:()=>({writingContext:'customer',channel:'email'}),usable:()=>true});
 try{
  assert.equal(await ui.openStoryselling(),true);
  assert.equal(d.querySelector('dialog').hasAttribute('open'),true);
  assert.equal(d.querySelector('[data-story-style]').value,'storyselling');
  assert.equal(d.querySelector('[data-story-options]').hidden,false);
  assert.match(d.querySelector('[data-wa-instruction]').value,/Storyselling/);
  assert.equal(d.querySelector('[data-wa-generate]').disabled,false);
  d.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(r=>setImmediate(r));
  assert.equal(request.options.intent,'preview');
  assert.deepEqual(request.options.storyselling,{type:'',cardId:'',objection:''});
  assert.deepEqual(draft,{subject:'Saved subject',message:'Keep my saved draft'});
 }finally{ui.destroy();dom.window.close();}
});

test('programmatic Storyselling activation stays unavailable for general writing and InMail',()=>{
 for(const context of [{writingContext:'general',channel:'general'},{writingContext:'customer',mode:'inmail',channel:'linkedin'}]){
  const dom=new JSDOM('<section><form></form></section>'),d=dom.window.document;
  const ui=StoryUI.mount(d,d.querySelector('form'),{workspace:()=> 'w1',context:()=>context});
  assert.equal(ui.activate(),false);assert.equal(ui.selection(),null);ui.destroy();dom.window.close();
 }
});
