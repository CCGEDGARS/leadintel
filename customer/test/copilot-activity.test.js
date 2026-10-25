import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// B2 (CTO, 2026-10-25): the loader keeps a small trail of what the person does in the workspace — event names, step
// numbers and entity ids only — so the assistant can see it. No page text, no form values, no observers, no storage.
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const loader=read('copilot-loader.js'),context=read('copilot-context.js'),html=read('index.html');

test('the trail collector lives in the boot-safe loader, listens to named workspace events only and never reads text or storage',()=>{
  assert.match(loader,/LeadIntelCopilotActivity/);
  for(const name of ['leadintel:module-opened','leadintel:company-research-updated','leadintel:crm-changed','leadintel:website-activated','leadintel:outreach-approved','leadintel:open-discovery','leadintel:settings-opened','leadintel:server-synced'])assert.ok(loader.includes(name),name);
  assert.doesNotMatch(loader,/MutationObserver|document\.body|localStorage|sessionStorage|innerText|\.value\b|FormData/);
  const collector=loader.slice(loader.indexOf('function recordActivity'),loader.indexOf('export function createCopilotController'));
  assert.ok(collector.length>200);assert.doesNotMatch(collector,/textContent|innerHTML|querySelectorAll|JSON\.stringify\(detail|detail\.(?:text|summary|body|value)/,'the collector keeps event names, step numbers and ids only');
  assert.match(context,/LeadIntelCopilotActivity/);assert.match(context,/activity/);
  assert.match(loader,/copilot-context\.js\?v=20260924-friendly-workflow-labels-v1[^'"]*activity=\d{8}-v\d+/);
  assert.match(html,/copilot-loader\.js\?v=[^"]*activity=\d{8}-v\d+/);
});

async function mountLoader(){
  const {JSDOM}=await import('jsdom');const dom=new JSDOM('<div class="progress-panel"><div class="steps"></div></div><div class="step-view active" data-step="4"></div>');
  const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
  await import(`data:text/javascript;base64,${Buffer.from(loader+'\n//activity-test-'+Math.random()).toString('base64')}`);
  return {dom,restore:()=>{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}};
}

test('workspace events become trail entries with a kind, a step and an optional entity; the trail keeps the last twenty',async()=>{
  const {dom,restore}=await mountLoader();
  try{
    const api=dom.window.LeadIntelCopilotActivity;assert.ok(api,'collector exposed');assert.deepEqual(api.snapshot(),[]);
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:module-opened',{detail:{step:4,secret:'never'}}));
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:company-research-updated',{detail:{summary:'private text'}}));
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:crm-changed',{detail:{companyId:'crm-9'}}));
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:website-activated'));
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:outreach-approved'));
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:open-discovery'));
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:settings-opened'));
    dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:server-synced'));
    const trail=api.snapshot();
    assert.deepEqual(trail.map(item=>item.kind),['step','research','crm','website','outreach','discovery','settings','sync']);
    assert.equal(trail[0].step,4);assert.equal(trail[0].label,'Strategy');
    assert.equal(trail[2].entityType,'company');assert.equal(trail[2].entityId,'crm-9');
    for(const item of trail){assert.match(item.at,/^\d{4}-\d{2}-\d{2}T/);assert.deepEqual(Object.keys(item).filter(key=>!['at','kind','step','label','entityType','entityId'].includes(key)),[]);}
    assert.doesNotMatch(JSON.stringify(trail),/never|private text/);
    for(let i=0;i<30;i++)dom.window.dispatchEvent(new dom.window.CustomEvent('leadintel:module-opened',{detail:{step:(i%7)+1}}));
    assert.equal(api.snapshot().length,20);
    const copy=api.snapshot();copy.push({kind:'tampered'});assert.equal(api.snapshot().length,20,'snapshots are copies');
  }finally{restore();}
});

test('the screen context sent with a message includes the trail',async()=>{
  const {JSDOM}=await import('jsdom');const dom=new JSDOM('<div class="step-view active" data-step="5"></div>');
  const prior={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
  try{
    dom.window.LeadIntelCopilotActivity={snapshot:()=>[{at:'2026-10-25T20:00:00Z',kind:'step',step:5,label:'Companies'}]};
    const mod=await import(`data:text/javascript;base64,${Buffer.from(context+'\n//trail-test-'+Math.random()).toString('base64')}`);
    const screen=mod.currentCopilotScreenContext();
    assert.equal(screen.step,5);assert.deepEqual(screen.activity,[{at:'2026-10-25T20:00:00Z',kind:'step',step:5,label:'Companies'}]);
    delete dom.window.LeadIntelCopilotActivity;
    assert.equal('activity' in mod.currentCopilotScreenContext(),false,'without a collector nothing is added');
  }finally{globalThis.window=prior.window;globalThis.document=prior.document;dom.window.close();}
});
