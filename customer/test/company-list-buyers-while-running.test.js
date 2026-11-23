const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

// A list of fifty companies runs for hours. While it runs, "Find buyers →" and "Save list to CRM" are switched off
// (the server answers "Pause research before saving, deleting or selecting companies"), and the page gave no reason:
// on 23 Nov 2026 the button of a company found an hour earlier simply did not react.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{for(let i=0;i<8;i++)await tick();};
const options=M.options({targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},market:{icps:[{id:'core',type:'core',active:true}],signals:[]}});
const criteria=M.configuration({profileIds:['core'],signalMode:'off',count:10,markets:['Denmark']},options);
function list(status){
 const results=[['Zinc',80],['Amber',60]].map(([company,score])=>({company,domain:company.toLowerCase()+'.example',website:'https://'+company.toLowerCase()+'.example/',score,fitScore:score,signalBonus:0,matches:[{name:'Core',kind:'profile',strength:score,score,url:'https://source.example/'}],checkedAt:'2026-11-19T12:00:00Z'}));
 return {id:'one',name:'Manufacturers',criteria,status,revision:1,results,receipts:[],progress:{count:2,target:10,checked:2,operations:8,allowance:100}};
}
async function open(t,status){
 const w=new JSDOM('<main id="step-5"><section class="discovery-panel"><div id="company-search-context"></div></section></main>',{runScripts:'outside-only',url:'https://app.example/'}).window;
 t.after(()=>w.close());
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;w.MutationObserver=class{observe(){}};w.setTimeout=()=>1;w.clearTimeout=()=>{};
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 w.fetch=async url=>{const params=new URL(url).searchParams,body=params.has('options')?{options}:params.get('id')?{list:list(status)}:{lists:[list(status)]};return {ok:true,json:async()=>body};};
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
 w.document.querySelector('[data-cl="lists"]').click();await settle();
 w.document.querySelector('[data-cl="open"]').click();await settle();
 return w.document;
}
const reason='Find buyers and Save list to CRM are switched off while this research runs. They are available when it finishes, or at once after Pause research; a paused list can be resumed.';

test('while a list is researched the page says why Find buyers is off and how to use it now',async t=>{
 const document=await open(t,'running'),buttons=[...document.querySelectorAll('[data-cl="buyer"]')];
 assert.equal(buttons.length,2);
 assert.ok(buttons.every(button=>button.disabled));
 assert.ok(buttons.every(button=>button.title===reason),'the reason is on each switched-off button');
 const note=document.querySelector('.cl-buyers-wait');
 assert.equal(note.textContent,reason);
 assert.ok(note.compareDocumentPosition(document.querySelector('.cl-table-wrap'))&document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING,'above the table');
 assert.ok(document.querySelector('[data-cl="pause"]'),'Pause research is offered on the same panel');
});

test('a queued list between two slices is treated the same',async t=>{
 const document=await open(t,'queued');
 assert.equal(document.querySelector('.cl-buyers-wait').textContent,reason);
});

test('a finished or paused list has working buttons and no such line',async t=>{
 for(const status of ['complete','incomplete','canceled']){
  const document=await open(t,status),buttons=[...document.querySelectorAll('[data-cl="buyer"]')];
  assert.equal(buttons.length,2,status);
  assert.ok(buttons.every(button=>!button.disabled&&!button.title),status);
  assert.equal(document.querySelector('.cl-buyers-wait'),null,status);
 }
});
