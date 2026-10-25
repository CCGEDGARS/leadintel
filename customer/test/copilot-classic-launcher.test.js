import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 2026-10-26 (Edgars): the resident mascot goes; Ask LeadIntel is a plain fixed button again, and the drawer opens
// with a description of the assistant (what it does, typical tasks, when to open it) instead of a greeting and
// suggested questions.
const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const html=read('index.html'),css=read('copilot.css'),loader=read('copilot-loader.js'),ui=read('copilot-ui.js');
export const INTRO={
  title:'Your AI business assistant.',
  copy:'Ask about your workspace, companies, markets, sales strategy or tools. LeadIntel can research public sources, explain findings and help you decide your next step.',
  what:'It answers in your language, knows which step you are on, researches public sources when a question needs facts, and shows where each fact comes from. It gives advice only: it never changes your workspace or sends anything.',
  tasks:['Explain what the current step expects and what is still missing.','Summarise a company, market or buyer from your workspace and public sources.','Check a trigger, a message or a plan before you act on it.','Help you choose the next commercial action.'],
  when:'When a step is unclear, when you want a second opinion on evidence or a message before sending, or when something in the workspace looks wrong and you want to understand why. Changes themselves are made in the steps.'
};

test('Ask LeadIntel is a plain fixed button bottom-right: no mascot, no animation, no hover hint',()=>{
  const entry=html.match(/<button class="leadintel-copilot-entry primary-btn"[\s\S]*?<\/button>/)[0];
  assert.match(entry,/aria-controls="leadintel-copilot-drawer"/);
  assert.match(entry,/copilot-entry-title">Ask LeadIntel</);
  assert.match(entry,/copilot-entry-subtitle">Business & Research</);
  assert.doesNotMatch(entry,/<svg|copilot-pupil|copilot-entry-hint|aria-describedby/);
  assert.match(loader,/copilot-entry-title">Ask LeadIntel</);
  assert.doesNotMatch(loader,/<svg|pupil|pointermove|bindMascot|aria-describedby|document\.body|MutationObserver/);
  // Same button as everywhere else (Edgars/Jonathan 2026-10-26): the platform's .primary-btn supplies colour, radius, shadow, font and hover; copilot.css only positions it.
  assert.match(loader,/className='leadintel-copilot-entry primary-btn'/);
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*position:fixed[^}]*right:\d+px[^}]*bottom:\d+px/s);
  assert.doesNotMatch(css,/\.leadintel-copilot-entry\{[^}]*(border-radius|background|font)/s,'no own look: the platform button rule decides');
  assert.match(read('styles.css'),/\.primary-btn\{background:var\(--ink\);color:white;border-radius:10px/);
  assert.match(css,/\.copilot-entry-subtitle\{[^}]*clip:rect\(0 0 0 0\)/s,'the subtitle stays for screen readers and the release smoke check only');
  assert.doesNotMatch(css,/@keyframes|copilot-mascot|copilot-eye|copilot-pupil|copilot-entry-hint|copilot-suggestion|copilot-message-avatar|copilot-header-mascot/);
  assert.match(html,/copilot-loader\.js\?[^"]*classic-button=20261026-v4/);
  assert.match(loader,/copilot-ui\.js\?v=20261011-business-research-v2&classic-button=20261026-v4/);
  assert.match(loader,/copilot\.css\?v=20261026-classic-v4/);assert.match(ui,/copilot\.css\?v=20261026-classic-v4/);
});

test('the drawer opens with a description of the assistant instead of a greeting and suggested questions',()=>{
  for(const text of [INTRO.title,INTRO.copy,INTRO.what,INTRO.when,...INTRO.tasks])assert.ok(ui.includes(text),text);
  for(const heading of ['What it does','Typical tasks','When to open it'])assert.ok(ui.includes(`'${heading}'`),heading);
  assert.doesNotMatch(ui,/How can I help you today|copilot-suggestion|Suggested questions|mascotAvatar|copilot-greeting|copilot-subtitle/);
  assert.match(ui,/copilot-intro-list/);
  assert.match(css,/\.copilot-intro\[hidden\]\{display:none\}/);
  assert.match(css,/\.copilot-intro-heading\{/);assert.match(css,/\.copilot-intro-list\{/);
});

test('the drawer still slides in from the right and the page still makes room for it',()=>{
  assert.match(css,/\.leadintel-copilot-drawer\{[^}]*transform:translateX\(104%\)[^}]*transition:transform/s);
  assert.match(css,/\.leadintel-copilot-drawer\.is-open\{transform:none\}/);
  assert.match(css,/html\.leadintel-copilot-open body\{padding-right:min\(430px,94vw\)\}/);
  assert.match(css,/@media\(max-width:720px\)\{html\.leadintel-copilot-open body\{padding-right:0\}\}/);
  assert.match(ui,/html\.classList\.add\('leadintel-copilot-open'\)/);
  assert.match(ui,/documentElement\.classList\.remove\('leadintel-copilot-open'\)/);
});

test('the intro is visible when the drawer opens and stays while the conversation grows below the composer',async()=>{
  const {JSDOM}=await import('jsdom');const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>');const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
  try{
    dom.window.LeadIntelServerBridge={workspace:{id:'w1'}};dom.window.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};
    const mod=await import(`data:text/javascript;base64,${Buffer.from(ui+'\n//classic-launcher-test').toString('base64')}`);
    const panel=await mod.openCopilot({context:{currentCopilotScreenContext:()=>({step:6})},api:{bootstrapCopilot:async()=>({ai:{configured:true}}),sendCopilotMessage:async()=>({answer:'Advice only.',sources:[]})}});
    const intro=panel.querySelector('[data-copilot-intro]');
    assert.equal(intro.hidden,false);
    assert.equal(intro.querySelector('.copilot-intro-title').textContent,INTRO.title);
    assert.deepEqual([...intro.querySelectorAll('.copilot-intro-heading')].map(el=>el.textContent),['What it does','Typical tasks','When to open it']);
    assert.deepEqual([...intro.querySelectorAll('.copilot-intro-list li')].map(el=>el.textContent),INTRO.tasks);
    assert.equal(panel.querySelector('.copilot-suggestion'),null);assert.equal(panel.querySelector('.copilot-header svg'),null);
    panel.querySelector('textarea').value='What does this step expect?';panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(intro.hidden,false,'the description stays above the composer');
    assert.equal(panel.querySelector('.copilot-message.is-assistant .copilot-message-role').textContent,'LeadIntel');
    assert.equal(panel.querySelector('.copilot-message.is-assistant svg'),null);
  }finally{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}
});

test('reading order (Edgars, 2026-10-26): description, the composer right under it, the conversation below the composer; full-height drawer with one scrollable body',async()=>{
  assert.match(css,/\.leadintel-copilot-drawer\{[^}]*height:100dvh[^}]*overflow:hidden/s);
  assert.match(css,/\.copilot-body\{[^}]*flex:1 1 auto[^}]*overflow:auto/s);
  assert.doesNotMatch(css,/\.copilot-messages\{[^}]*margin-top:auto/s,'messages are not anchored to the bottom any more');
  assert.doesNotMatch(css,/\.copilot-composer\{[^}]*(position:sticky|margin:auto)/s);
  const {JSDOM}=await import('jsdom');const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>');const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
  try{
    dom.window.LeadIntelServerBridge={workspace:{id:'w1'}};dom.window.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};
    const mod=await import(`data:text/javascript;base64,${Buffer.from(ui+'\n//reading-order-test').toString('base64')}`);
    const panel=await mod.openCopilot({context:{currentCopilotScreenContext:()=>({step:6})},api:{bootstrapCopilot:async()=>({ai:{configured:true}}),sendCopilotMessage:async()=>({answer:'Advice only.',sources:[]})}});
    assert.deepEqual([...panel.children].map(el=>el.className.split(' ')[0]),['copilot-header','copilot-body']);
    const body=panel.querySelector('[data-copilot-body]');
    assert.deepEqual([...body.children].map(el=>el.className.split(' ')[0]),['copilot-intro','copilot-composer','copilot-status','copilot-messages','copilot-proposals']);
    panel.querySelector('textarea').value='What does this step expect?';panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
    await new Promise(resolve=>setImmediate(resolve));
    const form=panel.querySelector('form'),answer=panel.querySelector('.copilot-message.is-assistant');
    assert.ok(answer,'the answer is rendered');
    assert.ok(form.compareDocumentPosition(answer)&dom.window.Node.DOCUMENT_POSITION_FOLLOWING,'the conversation appears below the composer');
    assert.equal(panel.querySelector('[data-copilot-intro]').hidden,false,'the description stays');
    assert.equal(answer.querySelector('.copilot-message-role').textContent,'LeadIntel');
  }finally{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}
});
