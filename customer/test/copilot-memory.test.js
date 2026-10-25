import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// B3 (CTO, 2026-10-25): what the assistant remembers is visible and forgettable in the drawer; due reminders greet the person.
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const source=read('copilot-ui.js'),api=read('copilot-api.js'),css=read('copilot.css');

test('the API module lists memories and forgets one, workspace scoped like every copilot call',()=>{
  assert.match(api,/export function listCopilotMemories\(\)\{return requestCopilot\('\/api\/copilot\/memories'/);
  assert.match(api,/export function forgetCopilotMemory\(id\)\{return requestCopilot\(`\/api\/copilot\/memories\/\$\{encodeURIComponent\(id\)\}\/archive`,\{method:'POST'/);
  assert.match(css,/\.copilot-memory-chip\{/);assert.match(css,/\.copilot-memories\{[^}]*position:absolute/s);
});

const MEMORIES=[
  {id:'m-pref',kind:'preference',value:'Prefers expansion signals over tenders.',due:'',updated_at:'2026-10-20 10:00:00'},
  {id:'m-due',kind:'reminder',value:'Ask Edgars for the pilot decision.',due:'2026-10-24',updated_at:'2026-10-24 10:00:00'}
];
async function mount({memories=MEMORIES,remindersDue=[MEMORIES[1]],answerMemories=[]}={}){
  const {JSDOM}=await import('jsdom');const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>');
  const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
  dom.window.LeadIntelServerBridge={workspace:{id:'w1'}};dom.window.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};
  const mod=await import(`data:text/javascript;base64,${Buffer.from(source+'\n//memory-test-'+Math.random()).toString('base64')}`);
  const state={memories:[...memories],remindersDue:[...remindersDue]};const forgotten=[];
  const apiStub={
    bootstrapCopilot:async()=>({ai:{configured:true},latestConversation:null,memories:state.memories,reminders_due:state.remindersDue}),
    listCopilotMemories:async()=>({memories:state.memories,reminders_due:state.remindersDue}),
    forgetCopilotMemory:async id=>{forgotten.push(id);state.memories=state.memories.filter(item=>item.id!==id);state.remindersDue=state.remindersDue.filter(item=>item.id!==id);return {archived:true,id};},
    listCopilotConversations:async()=>({conversations:[]}),getCopilotConversation:async()=>({messages:[]}),
    sendCopilotMessage:async()=>({conversation_id:'c1',answer:'Noted, Jonathan.',sources:[],memory_candidates:answerMemories})
  };
  const panel=await mod.openCopilot({context:{currentCopilotScreenContext:()=>({step:4})},api:apiStub});
  await new Promise(resolve=>setImmediate(resolve));
  return {dom,panel,forgotten,state,restore:()=>{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}};
}

test('opening shows the Remembers count, a due reminder in the status line, and the panel lists memories by kind with Forget',async()=>{
  const {dom,panel,forgotten,restore}=await mount();
  try{
    const btn=panel.querySelector('[data-copilot-action="memories"]');
    assert.equal(btn.textContent,'Remembers 2');
    assert.match(panel.querySelector('[data-copilot-status]').textContent,/1 reminder due: Ask Edgars for the pilot decision\./);
    const list=panel.querySelector('[data-copilot-memories]');assert.equal(list.hidden,true);
    btn.click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(list.hidden,false);
    const rows=[...list.querySelectorAll('[data-copilot-memory-id]')];
    assert.deepEqual(rows.map(row=>row.dataset.copilotMemoryId),['m-due','m-pref'],'due reminders first');
    assert.match(rows[0].textContent,/Reminder · due 2026-10-24/);assert.match(rows[1].textContent,/Preference/);
    rows[1].querySelector('[data-copilot-forget]').click();await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(forgotten,['m-pref']);
    assert.deepEqual([...list.querySelectorAll('[data-copilot-memory-id]')].map(row=>row.dataset.copilotMemoryId),['m-due']);
    assert.equal(btn.textContent,'Remembers 1');
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));
    assert.equal(list.hidden,true,'Escape closes the panel first');assert.equal(panel.hidden,false);
  }finally{restore();}
});

test('after an answer the new memories appear as chips under it, each forgettable, and the count grows',async()=>{
  const {dom,panel,forgotten,restore}=await mount({memories:[],remindersDue:[],answerMemories:[{id:'m-new',kind:'decision',value:'Target dairy processors first.',due:''},{id:'m-rem',kind:'reminder',value:'Follow up on the pilot.',due:'2026-11-03'}]});
  try{
    assert.equal(panel.querySelector('[data-copilot-action="memories"]').textContent,'Remembers 0');
    panel.querySelector('textarea').value='Dairy first, remind me about the pilot on 3 November.';
    panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
    const chips=[...panel.querySelectorAll('.copilot-message.is-assistant .copilot-memory-chip')];
    assert.deepEqual(chips.map(chip=>chip.querySelector('.copilot-memory-chip-text').textContent),['Remembered: Target dairy processors first.','Reminder 2026-11-03: Follow up on the pilot.']);
    assert.deepEqual(chips.map(chip=>chip.querySelector('[data-copilot-forget]').textContent),['Forget','Forget']);
    assert.equal(panel.querySelector('[data-copilot-action="memories"]').textContent,'Remembers 2');
    chips[0].querySelector('[data-copilot-forget]').click();await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(forgotten,['m-new']);assert.equal(panel.querySelectorAll('.copilot-memory-chip').length,1);
    assert.equal(panel.querySelector('[data-copilot-action="memories"]').textContent,'Remembers 1');
  }finally{restore();}
});
