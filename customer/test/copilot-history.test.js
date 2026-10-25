import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Ask LeadIntel B1 (CTO, 2026-10-25 evening): the composer stays put under the description and only the conversation
// scrolls; the description can be folded; conversations that are already in D1 are shown again (history, new chat);
// answers can be copied and a conversation printed or saved as PDF through the browser.
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const source=read('copilot-ui.js'),css=read('copilot.css'),api=read('copilot-api.js'),loader=read('copilot-loader.js'),html=read('index.html');

test('the API module can list conversations and load one, both scoped to the workspace like every copilot call',()=>{
  assert.match(api,/export function listCopilotConversations\(\)\{return requestCopilot\('\/api\/copilot\/conversations'/);
  assert.match(api,/export function getCopilotConversation\(id\)\{return requestCopilot\(`\/api\/copilot\/conversations\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(api,/listCopilotConversations,getCopilotConversation/);
  assert.doesNotMatch(api,/localStorage|sessionStorage/);
});

test('layout: the body does not scroll, the conversation pane is the only scroll region, the composer stays static under the description',()=>{
  assert.match(css,/\.copilot-body\{[^}]*overflow:hidden/s);
  assert.match(css,/\.copilot-messages\{[^}]*flex:1 1 auto[^}]*overflow:auto/s);
  assert.doesNotMatch(css,/\.copilot-composer\{[^}]*(position:sticky|margin:auto)/s);
  assert.match(css,/\.copilot-intro\.is-collapsed \.copilot-intro-block\{display:none\}/);
  assert.match(css,/\.copilot-history\{[^}]*position:absolute/s);
  assert.match(css,/\.copilot-header\{position:relative;top:auto\}/,'the header anchors the history list without inheriting the old sticky offset');
  assert.match(css,/\.copilot-conversation-bar\{/);
  assert.match(css,/\.copilot-print-dialog\{/);
});

test('cache tokens advance together: loader imports, stylesheet and the workspace page',()=>{
  assert.match(loader,/copilot-ui\.js\?v=[^'"]*history=\d{8}-v\d+/);
  assert.match(loader,/copilot-api\.js\?v=[^'"]*history=\d{8}-v\d+/);
  assert.match(loader,/copilot\.css\?v=[^'"]*history=\d{8}-v\d+/);
  assert.match(source,/copilot\.css\?v=[^'"]*history=\d{8}-v\d+/);
  assert.match(html,/copilot-loader\.js\?v=[^"]*history=\d{8}-v\d+/);
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

const CONVERSATIONS=[
  {id:'c-new',title:'Which signals should I monitor?',created_at:'2026-10-25 19:00:00',updated_at:'2026-10-25 19:04:00'},
  {id:'c-old',title:'What is missing from my setup?',created_at:'2026-10-19 07:40:00',updated_at:'2026-10-19 07:58:00'}
];
const MESSAGES={
  'c-new':[{id:'m1',role:'user',content:'Which signals should I monitor?',metadata:{},created_at:'2026-10-25 19:00:00'},{id:'m2',role:'assistant',content:'Watch hiring and expansion. <b>Not HTML</b> [1]',metadata:{sources:[{title:'Official page',url:'https://company.example/news',date:'2026-10-20'}]},created_at:'2026-10-25 19:04:00'}],
  'c-old':[{id:'m3',role:'user',content:'What is missing from my setup?',metadata:{},created_at:'2026-10-19 07:40:00'},{id:'m4',role:'assistant',content:'Your website is missing.',metadata:{},created_at:'2026-10-19 07:58:00'}]
};
async function mount({latest='c-new',sent=[]}={}){
  const {JSDOM}=await import('jsdom');const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>');
  const prior={window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator};globalThis.window=dom.window;globalThis.document=dom.window.document;
  const copied=[];Object.defineProperty(dom.window.navigator,'clipboard',{value:{writeText:async text=>{copied.push(text);}},configurable:true});
  dom.window.LeadIntelServerBridge={workspace:{id:'w1'}};dom.window.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};
  const mod=await import(`data:text/javascript;base64,${Buffer.from(source+'\n//history-test-'+Math.random()).toString('base64')}`);
  const calls={list:0,get:[]};
  const apiStub={
    bootstrapCopilot:async()=>({ai:{configured:true},latestConversation:latest?CONVERSATIONS.find(c=>c.id===latest):null}),
    listCopilotConversations:async()=>{calls.list++;return {conversations:CONVERSATIONS};},
    getCopilotConversation:async id=>{calls.get.push(id);return {conversation:CONVERSATIONS.find(c=>c.id===id),messages:MESSAGES[id]||[]};},
    sendCopilotMessage:async payload=>{sent.push(payload);return {conversation_id:payload.conversation_id||'c-created',answer:'Fresh answer.',sources:[]};}
  };
  const panel=await mod.openCopilot({context:{currentCopilotScreenContext:()=>({step:4})},api:apiStub});
  await new Promise(resolve=>setImmediate(resolve));
  const restore=()=>{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();};
  return {dom,panel,calls,copied,sent,restore,mod};
}

test('opening the assistant brings the latest conversation back from the server and folds the description; nothing is wiped',async()=>{
  const {dom,panel,calls,restore}=await mount();
  try{
    assert.deepEqual(calls.get,['c-new'],'the latest conversation is loaded once');
    const rows=[...panel.querySelectorAll('.copilot-message')];
    assert.equal(rows.length,2);
    assert.equal(rows[1].querySelector('.copilot-message-text').textContent,'Watch hiring and expansion. <b>Not HTML</b> [1]','model text is text, never markup');
    assert.equal(rows[1].querySelector('b'),null);
    assert.equal(panel.querySelector('.copilot-source').textContent,'[1] Official page');
    const intro=panel.querySelector('[data-copilot-intro]');
    assert.equal(intro.hidden,false);assert.ok(intro.classList.contains('is-collapsed'),'with a conversation present the description folds');
    assert.equal(intro.querySelector('[data-copilot-intro-toggle]').textContent,'More');
    intro.querySelector('[data-copilot-intro-toggle]').click();assert.ok(!intro.classList.contains('is-collapsed'));assert.equal(intro.querySelector('[data-copilot-intro-toggle]').textContent,'Less');
    const bar=panel.querySelector('[data-copilot-conversation-bar]');
    assert.equal(bar.hidden,false);assert.match(bar.textContent,/2 messages/);
    const body=panel.querySelector('[data-copilot-body]');
    assert.deepEqual([...body.children].map(el=>el.className.split(' ')[0]),['copilot-intro','copilot-composer','copilot-status','copilot-conversation-bar','copilot-messages','copilot-proposals']);
    assert.ok(panel.querySelector('form').compareDocumentPosition(rows[0])&dom.window.Node.DOCUMENT_POSITION_FOLLOWING,'the conversation is below the composer');
  }finally{restore();}
});

test('an empty workspace opens with the description unfolded and no conversation bar',async()=>{
  const {panel,calls,restore}=await mount({latest:null});
  try{
    assert.deepEqual(calls.get,[]);
    assert.ok(!panel.querySelector('[data-copilot-intro]').classList.contains('is-collapsed'));
    assert.equal(panel.querySelector('[data-copilot-conversation-bar]').hidden,true);
  }finally{restore();}
});

test('History lists the workspace conversations newest first, opens one, and New starts a conversation that is sent without an id',async()=>{
  const sent=[];const {dom,panel,calls,restore}=await mount({sent});
  try{
    const historyBtn=panel.querySelector('[data-copilot-action="history"]'),history=panel.querySelector('[data-copilot-history]');
    assert.equal(history.hidden,true);historyBtn.click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(history.hidden,false);assert.equal(calls.list,1);
    const items=[...history.querySelectorAll('[data-copilot-conversation-id]')];
    assert.deepEqual(items.map(el=>el.dataset.copilotConversationId),['c-new','c-old']);
    assert.match(items[0].textContent,/Which signals should I monitor\?/);assert.match(items[0].textContent,/2026-10-25/);
    assert.ok(items[0].getAttribute('aria-current')==='true','the open conversation is marked');
    items[1].click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(history.hidden,true,'choosing a conversation closes the list');
    assert.deepEqual(calls.get,['c-new','c-old']);
    assert.equal(panel.querySelector('.copilot-message.is-assistant .copilot-message-text').textContent,'Your website is missing.');
    panel.querySelector('textarea').value='Follow-up';panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sent.at(-1).conversation_id,'c-old','a follow-up continues the opened conversation');
    panel.querySelector('[data-copilot-action="new"]').click();
    assert.equal(panel.querySelectorAll('.copilot-message').length,0);assert.equal(panel.querySelector('[data-copilot-conversation-bar]').hidden,true);
    panel.querySelector('textarea').value='Brand new';panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sent.at(-1).conversation_id,undefined,'a new conversation is sent without an id');
    assert.equal(panel.querySelectorAll('.copilot-message').length,2);
    historyBtn.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(history.hidden,false);
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));
    assert.equal(history.hidden,true,'Escape closes the list first');assert.equal(panel.hidden,false,'…and leaves the drawer open');
  }finally{restore();}
});

test('Copy puts one answer or the whole conversation on the clipboard as readable text with its sources',async()=>{
  const {panel,copied,restore}=await mount();
  try{
    panel.querySelector('.copilot-message.is-assistant [data-copilot-copy]').click();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(copied[0],'Watch hiring and expansion. <b>Not HTML</b> [1]\n\nSources:\n[1] Official page — https://company.example/news (2026-10-20)');
    panel.querySelector('[data-copilot-action="copy-all"]').click();await new Promise(resolve=>setImmediate(resolve));
    assert.match(copied[1],/^Ask LeadIntel · Which signals should I monitor\?\n/);
    assert.match(copied[1],/You: Which signals should I monitor\?\n\nLeadIntel: Watch hiring and expansion\./);
    assert.match(copied[1],/\[1\] Official page — https:\/\/company\.example\/news/);
    assert.match(panel.querySelector('[data-copilot-status]').textContent,/copied/i);
  }finally{restore();}
});

test('Save as PDF opens an in-page print preview of the conversation with escaped text, numbered sources and a print action',async()=>{
  const {dom,panel,restore}=await mount();
  try{
    panel.querySelector('[data-copilot-action="print"]').click();await new Promise(resolve=>setImmediate(resolve));
    const dialog=dom.window.document.getElementById('copilot-print-dialog');
    assert.ok(dialog,'the preview dialog exists');assert.equal(dialog.open,true);
    const doc=dialog.querySelector('iframe').getAttribute('srcdoc');
    assert.match(doc,/<title>Ask LeadIntel · Which signals should I monitor\?<\/title>/);
    assert.match(doc,/@page\{size:A4/);
    assert.match(doc,/Watch hiring and expansion\. &lt;b&gt;Not HTML&lt;\/b&gt; \[1\]/,'model text is escaped in the print document');
    assert.doesNotMatch(doc,/<b>Not HTML<\/b>/);
    assert.match(doc,/\[1\] Official page/);assert.match(doc,/https:\/\/company\.example\/news/);
    assert.ok(dialog.querySelector('[data-copilot-print-run]'));assert.ok(dialog.querySelector('[data-copilot-print-close]'));
    dialog.querySelector('[data-copilot-print-close]').click();assert.equal(dialog.open,false);
  }finally{restore();}
});
