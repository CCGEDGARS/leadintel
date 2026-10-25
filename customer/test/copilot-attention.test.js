import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// B4 (CTO, 2026-10-25): the assistant reminds by itself — a count on the Ask LeadIntel button, a "since you were here"
// line when the drawer opens, and after an answer up to three "what to add" suggestions that lead to the right step.
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const loader=read('copilot-loader.js'),source=read('copilot-ui.js'),css=read('copilot.css'),html=read('index.html');

test('the launcher asks for the attention count after the workspace is ready, through the first-party API, without eager reasoning',()=>{
  assert.match(loader,/leadintel:server-ready/);
  assert.match(loader,/\/api\/copilot\/attention\?workspace_id=/);
  assert.match(loader,/credentials:'include'/);
  assert.doesNotMatch(loader,/MutationObserver|document\.body|sendCopilotMessage|bootstrapCopilot\s*\(/);
  assert.match(css,/\.copilot-add-chip\{/);
  assert.match(html,/copilot-loader\.js\?v=[^"]*attention=\d{8}-v\d+/);
});

test('badge: the count appears when the attention answer has something, stays empty when it has nothing or fails',async()=>{
  const {JSDOM}=await import('jsdom');const dom=new JSDOM('<div class="progress-panel"><div class="steps"></div></div>');
  const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
  try{
    const calls=[];let answer={status:200,json:async()=>({important:2,reminders_due:1,total:3})};
    dom.window.fetch=async(url,options)=>{calls.push({url:String(url),credentials:options?.credentials});return answer;};
    dom.window.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'w1'}};
    await import(`data:text/javascript;base64,${Buffer.from(loader+'\n//attention-test-'+Math.random()).toString('base64')}`);
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:server-ready',{detail:dom.window.LeadIntelServerBridge}));
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(calls,[{url:'/api/copilot/attention?workspace_id=w1',credentials:'include'}]);
    const badge=dom.window.document.querySelector('[data-copilot-badge]');
    assert.equal(badge.textContent,'3');assert.equal(badge.hidden,false);
    assert.match(badge.getAttribute('title')||'',/2 important checks/);assert.match(badge.getAttribute('title')||'',/1 reminder due/);
    answer={status:200,json:async()=>({important:0,reminders_due:0,total:0})};
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:server-ready',{detail:dom.window.LeadIntelServerBridge}));
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(badge.textContent,'');assert.equal(badge.hidden,true);
    answer={status:500,json:async()=>{throw new Error('boom');}};
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:server-ready',{detail:dom.window.LeadIntelServerBridge}));
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(badge.textContent,'','a failed count leaves the badge empty, never an error text');
  }finally{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}
});

async function mount({boot,answer}){
  const {JSDOM}=await import('jsdom');const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>');
  const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
  dom.window.LeadIntelServerBridge={workspace:{id:'w1'}};dom.window.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};
  const steps=[];dom.window.LeadIntelCustomerNavigation={setStep:step=>{steps.push(step);return true;}};
  const mod=await import(`data:text/javascript;base64,${Buffer.from(source+'\n//digest-test-'+Math.random()).toString('base64')}`);
  const apiStub={bootstrapCopilot:async()=>boot,listCopilotConversations:async()=>({conversations:[]}),getCopilotConversation:async()=>({messages:[]}),listCopilotMemories:async()=>({memories:[],reminders_due:[]}),forgetCopilotMemory:async()=>({archived:true}),sendCopilotMessage:async()=>answer};
  const panel=await mod.openCopilot({context:{currentCopilotScreenContext:()=>({step:1})},api:apiStub});
  await new Promise(resolve=>setImmediate(resolve));
  return {dom,panel,steps,restore:()=>{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}};
}

test('opening tells the person what happened since they were here: important checks, reminders due, workspace changes',async()=>{
  const {panel,restore}=await mount({boot:{ai:{configured:true},latestConversation:{id:'c1',title:'Older',updated_at:'2026-10-25 19:04:00'},memories:[{id:'m1',kind:'reminder',value:'Call the dairy plant.',due:'2026-01-01'}],reminders_due:[{id:'m1',kind:'reminder',value:'Call the dairy plant.',due:'2026-01-01'}],since:{last_conversation_at:'2026-10-25 19:04:00',workspace_updated_at:'2026-10-25 20:40:00',important:2}},answer:{answer:'ok',sources:[]}});
  try{
    const status=panel.querySelector('[data-copilot-status]').textContent;
    assert.match(status,/^Since 2026-10-25 19:04:/);
    assert.match(status,/2 important checks/);assert.match(status,/1 reminder due: Call the dairy plant\./);assert.match(status,/workspace changed 2026-10-25 20:40/);
  }finally{restore();}
});

test('quiet workspace: no digest noise, just the empty status',async()=>{
  const {panel,restore}=await mount({boot:{ai:{configured:true},latestConversation:null,memories:[],reminders_due:[],since:{last_conversation_at:'',workspace_updated_at:'2026-10-25 20:40:00',important:0}},answer:{answer:'ok',sources:[]}});
  try{assert.equal(panel.querySelector('[data-copilot-status]').textContent,'');}finally{restore();}
});

test('after an answer, known checks become up to three suggestions with our own words and a step; unknown titles never render; the step opens and the drawer stays',async()=>{
  const diagnostics=[
    {category:'completeness',severity:'important',fingerprint:'completeness:website_missing',title:'Hidden server title'},
    {category:'readiness',severity:'important',fingerprint:'readiness:target_market_missing',title:'Hidden too'},
    {category:'completeness',severity:'improve',fingerprint:'completeness:buyer_roles_missing',title:'Hidden three'},
    {category:'quality',severity:'improve',fingerprint:'quality:icp_missing',title:'Fourth is cut'},
    {category:'quality',severity:'improve',fingerprint:'quality:unknown_check',title:'Hidden chat check'}
  ];
  const {dom,panel,steps,restore}=await mount({boot:{ai:{configured:true},latestConversation:null,memories:[],reminders_due:[],since:{}},answer:{conversation_id:'c9',answer:'Here is my advice.',sources:[],diagnostics}});
  try{
    panel.querySelector('textarea').value='What should I add?';panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
    const chips=[...panel.querySelectorAll('.copilot-message.is-assistant .copilot-add-chip')];
    assert.deepEqual(chips.map(chip=>chip.querySelector('.copilot-add-text').textContent),['Add your company website','Choose at least one target market','Name the buyer roles who decide']);
    assert.deepEqual(chips.map(chip=>chip.querySelector('[data-copilot-go-step]').textContent),['Open Setup','Open Setup','Open Profile']);
    assert.doesNotMatch(panel.textContent,/Hidden server title|Hidden too|Hidden three|Fourth is cut|Hidden chat check/);
    chips[2].querySelector('[data-copilot-go-step]').click();
    assert.deepEqual(steps,[2]);assert.equal(panel.hidden,false,'the drawer stays beside the step');
  }finally{restore();}
});
