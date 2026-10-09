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

test('copilot introduces itself before workspace checks',()=>{
  assert.match(source,/Your support and insights assistant\./);
  assert.match(source,/understands your LeadIntel workspace/i);
  assert.match(source,/Support is read-only/i);
  const introIndex=source.indexOf('copilot-intro');
  const diagnosticsIndex=source.indexOf('copilot-diagnostics');
  assert.ok(introIndex>=0&&diagnosticsIndex>=0&&introIndex<diagnosticsIndex,'intro must be created before diagnostics');
});

test('composer is a full-width vertical layout with send below the textarea',()=>{
  assert.match(css,/\.copilot-composer\{[^}]*grid-template-columns\s*:\s*1fr[^}]*\}/s);
  assert.match(css,/\.copilot-composer textarea\{[^}]*min-height\s*:\s*(1[12][0-9]|1[3-9][0-9]|[2-9][0-9]{2})px/s);
  assert.match(css,/\.copilot-send\{[^}]*justify-self\s*:\s*end/s);
});

test('sidebar entry is a premium branded copilot control',()=>{
  assert.match(loader,/Support & Insights/);
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*border-radius\s*:\s*(1[4-9]|[2-9][0-9])px/s);
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*background\s*:\s*(linear-gradient|radial-gradient)/s);
  assert.match(css,/\.leadintel-copilot-entry\{[^}]*box-shadow/s);
});

test('support never renders or invokes configuration actions',()=>{
 assert.doesNotMatch(source,/Confirm change|confirmCopilotAction|rejectCopilotAction|location\.reload/);
 assert.match(source,/Attachments are disabled/);
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
  const ui=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  let mutations=0;
  const panel=await ui.openCopilot({context:{currentCopilotScreenContext:()=>({step:6})},api:{sendCopilotMessage:async()=>({answer:'Safe help',sources:[{title:'Billing',url:'https://platform.openai.com/settings/organization/billing/overview'},{title:'Bad',url:'javascript:alert(1)'}],action_proposals:[{id:'evil',action_type:'signal.update'}]}),confirmCopilotAction:async()=>{mutations++;}}});
  assert.equal(panel.querySelector('input[type=file]'),null);
  const event=new dom.window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{files:[{name:'secret.csv'}]}});panel.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
  panel.querySelector('textarea').value='Help with credits';panel.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(mutations,0);assert.equal(panel.querySelector('.copilot-confirm'),null);assert.equal(panel.querySelectorAll('.copilot-source').length,1);assert.equal(panel.querySelector('.copilot-source').rel,'noopener noreferrer');
 }finally{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}
});
