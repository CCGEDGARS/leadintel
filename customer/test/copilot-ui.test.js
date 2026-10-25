import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../copilot-ui.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../copilot.css',import.meta.url),'utf8');
const loader=fs.readFileSync(new URL('../copilot-loader.js',import.meta.url),'utf8');

test('copilot renders as a non-blocking right-side drawer with close and escape handling',()=>{
  assert.match(source,/leadintel-copilot-drawer/);
  assert.match(source,/role\s*=\s*['"]dialog['"]|setAttribute\(['"]role['"],['"]dialog['"]\)/);
  assert.match(source,/aria-modal[^\n]*false|aria-modal['"],['"]false['"]/);
  assert.match(source,/copilot-close/);
  assert.match(source,/Escape/);
  assert.match(css,/position\s*:\s*fixed/);
  assert.match(css,/right\s*:\s*0/);
  assert.doesNotMatch(css,/pointer-events\s*:\s*none[^}]*body|overflow\s*:\s*hidden[^}]*body/i);
});

test('model-controlled content is rendered as text and evidence links are hardened',()=>{
  assert.match(source,/textContent/);
  assert.doesNotMatch(source,/insertAdjacentHTML|\.innerHTML\s*=\s*[^'"`]/);
  assert.match(source,/^|\Whttps?:/m);
  assert.match(source,/noopener/);
  assert.match(source,/noreferrer/);
  assert.match(source,/_blank/);
});

test('chat uses safe screen context without preset prompt chips',()=>{
  assert.match(source,/currentCopilotScreenContext/);
  assert.match(source,/sendCopilotMessage/);
  assert.doesNotMatch(source,/contextualPromptSuggestions|copilot-prompts|copilot-prompt/);
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('copilot introduces itself before the conversation',()=>{
  assert.match(source,/Your AI business assistant\./);
  assert.match(source,/research public sources/i);
  assert.match(source,/help you decide your next step/i);
  const introIndex=source.indexOf('copilot-intro');
  const messagesIndex=source.indexOf('copilot-messages');
  assert.ok(introIndex>=0&&messagesIndex>=0&&introIndex<messagesIndex,'intro must be created before messages');
});

test('composer is a full-width vertical layout with send below the textarea',()=>{
  assert.match(css,/\.copilot-composer\{[^}]*grid-template-columns\s*:\s*1fr[^}]*\}/s);
  assert.match(css,/\.copilot-composer textarea\{[^}]*min-height\s*:\s*(1[12][0-9]|1[3-9][0-9]|[2-9][0-9]{2})px/s);
  assert.match(css,/\.copilot-send\{[^}]*justify-self\s*:\s*end/s);
});

test('the launcher is a free-standing branded mascot, not a boxed control',()=>{
  // 2026-10-25: the mascot stands on its own (no circle or card around it); the shadow follows its silhouette.
  assert.match(loader,/Business & Research/);
  assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/copilot-entry-subtitle">Business & Research/);
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*border\s*:\s*0[^}]*background\s*:\s*transparent/s);
  assert.match(css,/\.copilot-mascot\{[^}]*filter\s*:\s*drop-shadow\(/s);
  assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/copilot-mascot-skin[^>]*>[\s\S]*?<stop/);
});

test('support never renders or invokes configuration actions',()=>{
 assert.doesNotMatch(source,/Confirm change|confirmCopilotAction|rejectCopilotAction|location\.reload/);
 assert.doesNotMatch(source,/attachments are disabled/i);
 assert.match(source,/event\.preventDefault/);
});

test('copilot CSS is responsive without taking over the main workspace',()=>{
  assert.match(css,/width\s*:\s*min\(/);
  assert.match(css,/@media\s*\(max-width/);
  assert.match(css,/z-index/);
});

test('support drawer blocks file paste and ignores malicious action proposals at runtime',async()=>{
 const {JSDOM}=await import('jsdom');
 const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>');
 const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
 try{
  dom.window.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};
  const ui=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  let mutations=0;
  const panel=await ui.openCopilot({context:{currentCopilotScreenContext:()=>({step:6})},api:{bootstrapCopilot:async()=>({ai:{configured:true},diagnostics:[{severity:'important',title:'Hidden workspace check'}],unreadImportant:1}),sendCopilotMessage:async()=>({diagnostics:[{severity:'important',title:'Hidden chat check'}],answer:'Safe help',sources:[{title:'Billing',url:'https://platform.openai.com/settings/organization/billing/overview'},{title:'Bad',url:'javascript:alert(1)'}],action_proposals:[{id:'evil',action_type:'signal.update'}]}),confirmCopilotAction:async()=>{mutations++;}}});
  assert.equal(panel.querySelector('input[type=file]'),null);
  assert.equal(panel.querySelector('[data-copilot-diagnostics]'),null);assert.doesNotMatch(panel.textContent,/Hidden workspace check|attachments are disabled/i);
  const event=new dom.window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{files:[{name:'secret.csv'}]}});panel.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
  panel.querySelector('textarea').value='Help with credits';panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.doesNotMatch(panel.textContent,/Hidden chat check|attachments are disabled/i);
  assert.equal(mutations,0);assert.equal(panel.querySelector('.copilot-confirm'),null);assert.equal(panel.querySelectorAll('.copilot-source').length,1);assert.equal(panel.querySelector('.copilot-source').rel,'noopener noreferrer');
 }finally{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}
});

test('actual drawer displays research progress, prevents duplicate requests and renders dated evidence',async()=>{
 const {JSDOM}=await import('jsdom');const dom=new JSDOM('<button id="leadintel-copilot-entry"></button>');const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
 try{
  dom.window.LeadIntelServerBridge={workspace:{id:'w1'}};dom.window.LeadIntelWorkspacePersistence={isExplicitlySaved:()=>true,hasUnsavedChanges:()=>false};const ui=await import(`data:text/javascript;base64,${Buffer.from(source+'\n//progress-test').toString('base64')}`);let finish,calls=0;
  const panel=await ui.openCopilot({context:{currentCopilotScreenContext:()=>({step:6})},api:{bootstrapCopilot:async()=>({ai:{configured:true}}),sendCopilotMessage:async(payload,{onProgress})=>{calls++;onProgress({phase:'researching'});return new Promise(resolve=>finish=resolve);}}});const submit=()=>panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));panel.querySelector('textarea').value='Research LKAB';submit();assert.equal(panel.querySelector('[data-copilot-status]').textContent,'Researching public sources…');assert.equal(panel.querySelector('.copilot-send').disabled,true);panel.querySelector('textarea').value='duplicate';submit();assert.equal(calls,1);
  finish({answer:'**Fact** [1](https://company.example/project).\n\nPractical implication. [fake](https://invented.example)',sources:[{title:'Official project',url:'https://company.example/project',date:'2026-10-11'}],research_used:true,research_status:'complete'});await new Promise(resolve=>setImmediate(resolve));assert.match(panel.querySelector('.copilot-message.is-assistant').textContent,/Fact \[1\].\n\n/);assert.doesNotMatch(panel.querySelector('.copilot-message.is-assistant .copilot-message-text').textContent,/invented|\*\*/);assert.equal(panel.querySelector('.copilot-source').textContent,'[1] Official project');assert.match(panel.querySelector('.copilot-source-date').textContent,/2026-10-11/);assert.equal(panel.querySelector('.copilot-send').disabled,false);
 }finally{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}
});
