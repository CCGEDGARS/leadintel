import test, {afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {webcrypto} from 'node:crypto';
import {installGeneralFileAnalysis} from '../copilot-general-file-analysis.js';
import * as transport from '../copilot-api.js';
import {readFileSync} from 'node:fs';

const extraction={format:'csv',title:'source.csv',blocks:[{locator:'row:1',table:[['Revenue','12']]}],evidenceIndex:{'row:1':{label:'Revenue',locator:'row:1'}},warnings:[],coverage:{complete:true,omitted:[]},counts:{characters:15,nonEmptyCells:2,csvRows:1}};
const result={title:'<img src=x onerror=alert(1)>',executive_summary:'Summary',sections:[{heading:'Commercial',content:'Details',tables:[[['Metric','Value'],['Revenue','12']]],evidence:[{locator:'row:1',label:'Revenue'}]}],findings:['Fact'],recommendations:['Act'],risks:['Risk'],assumptions:['Assumption'],data_gaps:['Missing'],warnings:['Caution']};
const analysis={id:'a1',file_id:'f1',workspace_id:'w1',request:'Review revenue',status:'completed',retained:false,result,source_coverage:{warnings:['Context selection warning'],coverage:{complete:false,omitted:['row:8 omitted from model context']}}};
const file=()=>new File(['Revenue,12'],'source.csv',{type:'text/csv'});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
let dom,controller;
const originalFetch=globalThis.fetch;
afterEach(()=>{controller?.destroy();dom?.window.close();delete globalThis.window;delete globalThis.document;delete globalThis.Event;delete globalThis.CustomEvent;globalThis.fetch=originalFetch;});
function setup(overrides={},extractFile=async()=>structuredClone(extraction)){
  dom=new JSDOM('<!doctype html><aside id="leadintel-copilot-drawer"><section data-copilot-general-file-host></section><form class="copilot-composer"><button type="button">Attach Excel / CSV</button></form></aside>',{url:'https://leadintel.test'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.Event=dom.window.Event;globalThis.CustomEvent=dom.window.CustomEvent;
  window.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'w1'}};
  const calls=[];
  const api={uploadCopilotFile:async(payload)=>{calls.push(['upload',payload]);return {file_id:'f1'};},analyzeCopilotFile:async(payload)=>{calls.push(['analyze',payload]);return {analysis:structuredClone(analysis)};},continueCopilotFileAnalysis:async()=>({analysis:structuredClone(analysis)}),listCopilotFileAnalyses:async()=>({analyses:[{id:'a1',title:'Saved review',retained:true}]}),getCopilotFileAnalysis:async()=>({analysis:{...structuredClone(analysis),retained:true,messages:[{role:'user',content:'Earlier question'}]}}),saveCopilotFileAnalysis:async()=>({retained:true}),deleteCopilotFileAnalysis:async()=>({deleted:true}),...overrides};
  controller=installGeneralFileAnalysis({api,extractFile,crypto:webcrypto});
  return {calls,api,root:controller.root};
}
const button=name=>[...document.querySelectorAll('button')].find(el=>el.textContent===name);
const status=()=>controller.root.querySelector('[role=status]').textContent;
const field=name=>controller.root.querySelector(`[aria-label="${name}"]`);
const settle=async()=>{for(let i=0;i<15;i++)await new Promise(resolve=>setTimeout(resolve,0));};
async function choose(files=[file()]){const input=controller.root.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:files,configurable:true});input.dispatchEvent(new window.Event('change',{bubbles:true}));await settle();}
async function ready(){await choose();field('File analysis request').value='Review revenue';button('Analyze File').click();await settle();}

test('one file is validated, extracted and uploaded unchanged before the explicit request produces a cited result',async()=>{
  const upload=deferred(),ai=deferred();const {root,calls}=setup({uploadCopilotFile:async p=>{calls.push(['upload',p]);return upload.promise;},analyzeCopilotFile:async p=>{calls.push(['analyze',p]);return ai.promise;}});
  assert.equal(root.dataset.state,'empty');assert.equal(root.querySelectorAll('input[type=file]').length,1);
  assert.equal(root.querySelector('input').accept,'.pdf,.docx,.xlsx,.xls,.csv,.pptx');assert.equal(root.querySelector('input').multiple,false);
  assert.equal(field('File analysis request').maxLength,8000);assert.equal(root.querySelector('[role=status]').getAttribute('aria-live'),'polite');
  await choose();assert.equal(root.dataset.state,'uploading');assert.match(status(),/Uploading/);assert.equal(calls[0][1].file.name,'source.csv');assert.match(calls[0][1].sha256,/^[a-f0-9]{64}$/);
  upload.resolve({file_id:'f1'});await settle();assert.equal(root.dataset.state,'extracted');
  field('File analysis request').value='Review revenue';button('Analyze File').click();await settle();assert.equal(root.dataset.state,'analyzing');assert.match(status(),/Analyzing/);
  assert.deepEqual(calls[1][1],{file_id:'f1',request:'Review revenue',partial_confirmed:false});
  ai.resolve({analysis});await settle();assert.equal(root.dataset.state,'ready');assert.match(status(),/Ready.*not saved/i);
  assert.match(root.textContent,/row:1/);assert.match(root.textContent,/row:8 omitted/);assert.equal(root.querySelector('img'),null);
  for(const heading of ['Executive summary','Findings','Recommendations','Risks','Assumptions','Data gaps','Warnings','Source coverage'])assert.ok([...root.querySelectorAll('h4')].some(el=>el.textContent===heading));
  assert.equal(root.querySelector('table').rows[1].cells[1].textContent,'12');assert.ok(button('Attach Excel / CSV'));
});

test('validation rejects legacy, oversized, mismatched signature and multiple files before extraction or upload',async()=>{
  let extracted=0;const {calls,root}=setup({},async()=>{extracted++;return extraction;});
  for(const files of [[new File(['abc'],'old.doc')],[{name:'huge.pdf',size:15728641,type:'application/pdf',arrayBuffer(){throw Error('must not read');}}],[new File(['bad'],'fake.pdf',{type:'application/pdf'})],[file(),file()]]){
    await choose(files);assert.equal(root.dataset.state,'rejected');assert.equal(extracted,0);assert.equal(calls.length,0);assert.equal(button('Analyze File').disabled,true);
  }
  assert.match(status(),/one file/i);
});

test('partial extraction requires explicit confirmation and displays omissions',async()=>{
  const {root,calls}=setup({},async()=>({...extraction,warnings:['Unreadable page'],coverage:{complete:false,omitted:['page:2 image only']}}));
  await choose();assert.equal(root.dataset.state,'confirmation-required');assert.match(root.textContent,/page:2 image only/);
  field('File analysis request').value='Review';button('Analyze File').click();await settle();assert.equal(calls.filter(c=>c[0]==='analyze').length,0);
  field('Proceed with partial extraction').click();button('Analyze File').click();await settle();assert.equal(root.dataset.state,'ready');assert.equal(calls.at(-1)[1].partial_confirmed,true);
});

test('extraction error and empty extraction never upload or show ready',async()=>{
  const {root,calls}=setup({},async()=>{throw Error('Password-protected file');});await choose();assert.equal(root.dataset.state,'error');assert.match(status(),/Password-protected/);assert.equal(calls.length,0);
  controller.destroy();setup({},async()=>({...extraction,blocks:[]}));await choose();assert.equal(controller.root.dataset.state,'error');assert.match(status(),/usable content/i);
});

test('upload retry reuses the same digest and AI retry reuses the uploaded file',async()=>{
  let uploads=0,analyses=0;const digests=[];const {root}=setup({uploadCopilotFile:async p=>{uploads++;digests.push(p.sha256);if(uploads===1)throw Error('Connection interrupted');return {file_id:'f1'};},analyzeCopilotFile:async()=>{analyses++;if(analyses===1)throw Error('Provider timed out');return {analysis};}});
  await choose();assert.equal(root.dataset.state,'error');button('Retry').click();await settle();assert.equal(root.dataset.state,'extracted');assert.equal(digests[0],digests[1]);
  field('File analysis request').value='Review';button('Analyze File').click();await settle();assert.equal(root.dataset.state,'error');assert.match(status(),/Provider timed out/);
  button('Retry').click();await settle();assert.equal(root.dataset.state,'ready');assert.equal(uploads,2);assert.equal(analyses,2);
});

test('failed save preserves result as unsaved; successful save and history reload retain it',async()=>{
  let saves=0;const {root}=setup({saveCopilotFileAnalysis:async()=>{if(++saves===1)throw Error('Save unavailable');return {retained:true};}});await ready();
  button('Save to workspace').click();await settle();assert.match(status(),/not saved/i);assert.match(root.textContent,/Summary/);assert.equal(button('Save to workspace').disabled,false);
  button('Save to workspace').click();await settle();assert.match(status(),/Saved to workspace/);
  button('Start new analysis').click();assert.equal(root.dataset.state,'empty');button('Saved review').click();await settle();assert.equal(root.dataset.state,'ready');assert.match(root.textContent,/Earlier question/);assert.equal(field('File analysis request').value,'Review revenue');
});

test('deletion needs confirmation and failed deletion stays deleting until idempotent retry',async()=>{
  let deletes=0;const {root}=setup({deleteCopilotFileAnalysis:async()=>{if(++deletes===1)throw Error('Temporary storage failure');return {deleted:true};}});await ready();
  button('Delete analysis').click();assert.equal(deletes,0);assert.equal(button('Confirm deletion').hidden,false);
  button('Cancel deletion').click();assert.equal(deletes,0);button('Delete analysis').click();button('Confirm deletion').click();await settle();
  assert.equal(root.dataset.state,'deleting');assert.match(status(),/retry/i);assert.equal(button('Save to workspace').disabled,true);button('Retry').click();await settle();assert.equal(root.dataset.state,'empty');assert.match(status(),/Deleted/);assert.equal(deletes,2);
});

test('new file clears request and result and cancellation ignores late extraction results',async()=>{
  const {root}=setup();await ready();await choose();assert.equal(field('File analysis request').value,'');assert.equal(root.querySelector('[data-file-result]').textContent,'');
  controller.destroy();const pending=deferred();const next=setup({},async()=>pending.promise);await choose();assert.equal(next.root.dataset.state,'extracting');
  button('Start new analysis').click();pending.resolve(extraction);await settle();assert.equal(next.root.dataset.state,'empty');assert.equal(next.calls.length,0);
});

test('follow-up 409 preserves the draft and requires reload before another question',async()=>{
  let sends=0;const {root}=setup({continueCopilotFileAnalysis:async()=>{sends++;throw Object.assign(Error('Analysis changed; reload'),{status:409});}});await ready();
  field('Question about this file').value='Why?';button('Ask about file').click();await settle();assert.equal(root.dataset.state,'stale');assert.equal(field('Question about this file').value,'Why?');assert.equal(button('Ask about file').disabled,true);
  button('Reload analysis').click();await settle();assert.equal(root.dataset.state,'ready');assert.equal(field('Question about this file').value,'Why?');assert.equal(sends,1);
});

test('workspace switches clear private results and cannot upload the old workspace file',async()=>{
  const pending=deferred();const {root,calls}=setup({},async()=>pending.promise);await choose();window.LeadIntelServerBridge.workspace.id='w2';pending.resolve(extraction);await settle();assert.equal(root.dataset.state,'empty');assert.equal(calls.length,0);assert.match(status(),/Workspace changed/);
});

test('multipart and JSON API requests enforce credentials, workspace, endpoint payloads and expose 409',async()=>{
  setup();const requests=[];globalThis.fetch=async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({analysis}),{status:200});};
  await transport.uploadCopilotFile({file:file(),extraction,sha256:'a'.repeat(64),extractorVersion:'web-1'});
  const upload=requests.at(-1);assert.equal(upload.options.credentials,'include');assert.equal(new URL(upload.url).searchParams.get('workspace_id'),'w1');assert.equal(upload.options.headers['Content-Type'],undefined);
  assert.deepEqual([...upload.options.body.keys()],['file','extraction_json','sha256','extractor_version']);assert.equal(upload.options.body.get('extraction_json'),JSON.stringify(extraction));
  await transport.analyzeCopilotFile({file_id:'f1',request:'Review',partial_confirmed:true});assert.equal(new URL(requests.at(-1).url).pathname,'/api/copilot/file-analyses');
  await transport.continueCopilotFileAnalysis('a/b','Question');assert.equal(new URL(requests.at(-1).url).pathname,'/api/copilot/file-analyses/a%2Fb/messages');assert.deepEqual(JSON.parse(requests.at(-1).options.body),{message:'Question'});
  await transport.getCopilotFileAnalysis('a1');await transport.listCopilotFileAnalyses();await transport.saveCopilotFileAnalysis('a1');await transport.deleteCopilotFileAnalysis('a1');assert.equal(requests.at(-1).options.method,'DELETE');
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'stale'}),{status:409});await assert.rejects(transport.continueCopilotFileAnalysis('a1','Q'),error=>error.status===409);
});

test('drawer mounts a separate analyzer host, and Escape cancels pending extraction and restores entry focus',async()=>{
  setup();controller.destroy();document.querySelector('aside').remove();const entry=document.createElement('button');entry.id='leadintel-copilot-entry';document.body.append(entry);
  const ui=await import(`../copilot-ui.js?dom=${Date.now()}`);await ui.openCopilot({api:{},context:{}});
  const pending=deferred();controller=installGeneralFileAnalysis({api:{listCopilotFileAnalyses:async()=>({analyses:[]})},extractFile:()=>pending.promise,crypto:webcrypto});
  assert.ok(controller,'drawer must expose its separate analyzer mount point');assert.equal(controller.root.closest('form'),null);
  await choose();document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(controller.root.dataset.state,'empty');assert.equal(document.activeElement,entry);pending.resolve(extraction);await settle();assert.equal(controller.root.dataset.state,'empty');
});

test('request keyboard shortcut runs analysis without submitting ordinary chat; controls and tables fit a narrow drawer',async()=>{
  const {root}=setup();const style=document.createElement('style');style.textContent=readFileSync(new URL('../copilot.css',import.meta.url),'utf8');document.head.append(style);
  await choose();field('File analysis request').value='Review';field('File analysis request').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));await settle();assert.equal(root.dataset.state,'ready');
  assert.equal(parseFloat(window.getComputedStyle(field('File analysis request')).minWidth),0);assert.equal(window.getComputedStyle(button('Analyze File')).minHeight,'44px');assert.equal(window.getComputedStyle(root.querySelector('.copilot-general-table')).overflowX,'auto');
});

test('successful follow-up appends the question and answer without losing earlier discussion',async()=>{
  setup();await ready();field('Question about this file').value='Why?';button('Ask about file').click();await settle();
  assert.match(controller.root.querySelector('[aria-label="File discussion"]').textContent,/You: Why\?/);assert.match(controller.root.querySelector('[aria-label="File discussion"]').textContent,/LeadIntel: Summary/);
});

test('reloaded follow-up history renders the canonical assistant summary instead of raw JSON',async()=>{
  setup({getCopilotFileAnalysis:async()=>({analysis:{...structuredClone(analysis),retained:true,messages:[{role:'user',content:'Summarize it'},{role:'assistant',content:JSON.stringify(result)}]}})});
  await settle();button('Saved review').click();await settle();const discussion=controller.root.querySelector('[aria-label="File discussion"]').textContent;
  assert.match(discussion,/You: Summarize it/);assert.match(discussion,/LeadIntel: Summary/);assert.doesNotMatch(discussion,/executive_summary/);
});

test('cancellation clears read buffers and ignores late AI results',async()=>{
  const ai=deferred();const {root}=setup({analyzeCopilotFile:()=>ai.promise});const bytes=new TextEncoder().encode('Revenue,12');const source={name:'source.csv',type:'text/csv',size:bytes.length,arrayBuffer:async()=>bytes.buffer};
  await choose([source]);assert.ok(bytes.every(value=>value===0));field('File analysis request').value='Review';button('Analyze File').click();await settle();button('Start new analysis').click();ai.resolve({analysis});await settle();assert.equal(root.dataset.state,'empty');assert.equal(root.querySelector('[data-file-result]').textContent,'');
});

test('file bytes and extracted content are never written to browser storage',async()=>{
  setup();let writes=0;Object.defineProperty(window,'localStorage',{configurable:true,value:{setItem(){writes++;},getItem(){return null;},removeItem(){writes++;}}});
  await ready();assert.equal(writes,0);assert.equal(window.localStorage.getItem('copilot-file'),null);
});

test('lazy loader installs the analyzer beside specialized attachment without sharing its form submission',async()=>{
  setup();controller.destroy();document.querySelector('aside').remove();globalThis.fetch=async()=>new Response(JSON.stringify({analyses:[]}),{status:200});
  const loader=await import(`../copilot-loader.js?dom=${Date.now()}`);const loaded=await loader.loadCopilot();await settle();
  assert.ok(loaded?.generalFileAnalysis,'lazy loader must include the general analyzer');assert.ok(document.querySelector('[data-copilot-file-intelligence]'));assert.ok(document.querySelector('[aria-label="General file analysis"]'));assert.equal(document.querySelector('[aria-label="General file analysis"]').closest('form'),null);
});
