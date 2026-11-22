const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const Attention=require('../attention-centre-model.js');
const KEY='leadintel_customer_v2_background_tasks_v1';
const settle=()=>new Promise(resolve=>setTimeout(resolve,90));
const task=(id,status,extra={})=>({id,type:'buyer-research',title:'Buyer research · Kitron',stage:'Research saved · Buyer Agent: needs review',status,startedAt:1000,updatedAt:1000,finishedAt:1000,metadata:{domain:'kitron.example'},...extra});
const other=(id,status,extra={})=>task(id,status,{title:'Buyer research · Beumer Group A/S',stage:'Observation stopped · reopen saved research progress',metadata:{domain:'beumer.example'},...extra});
const stageModel=[{id:4,active:true,name:'Companies',steps:[{id:'verify',label:'Companies found and verified',complete:false,optional:false,action:'Find and verify matching companies'}]}];

test('a stopped task card names the task it can dismiss; a stalled task and an unfinished step name none',()=>{
  const now=Date.parse('2026-11-22T20:00:00Z');
  const items=Attention.buildAttentionItems({now,workspaceStarted:true,model:stageModel,tasks:[
    task('stopped','interrupted',{updatedAt:now-1000}),
    other('stalled','running',{updatedAt:now-200000})
  ]});
  const byId=Object.fromEntries(items.map(item=>[item.id,item]));
  assert.deepEqual(byId['task-stopped'].taskIds,['stopped']);
  assert.equal(byId['task-stalled'].taskIds,undefined);
  assert.equal(byId['stage-4-verify'].taskIds,undefined);
});

test('the card of a job that was tried several times names every stopped attempt of that job and no finished one',()=>{
  const items=Attention.buildAttentionItems({workspaceStarted:false,tasks:[
    task('first','error',{startedAt:1000}),
    task('done','complete',{startedAt:1500}),
    task('second','partial',{startedAt:2000}),
    task('latest','interrupted',{startedAt:3000}),
    other('elsewhere','error',{startedAt:2500})
  ]});
  const card=items.find(item=>item.id==='task-latest');
  assert.deepEqual([...card.taskIds].sort(),['first','latest','second']);
  assert.deepEqual(items.find(item=>item.id==='task-elsewhere').taskIds,['elsewhere']);
  assert.deepEqual(items.map(item=>item.id).sort(),['task-elsewhere','task-latest']);
});

async function mount(tasks,{stage=false}={}){
  const w=new JSDOM('<button id="workspace-attention"><em data-attention-summary></em><b data-attention-count></b></button>',{url:'https://app.example',runScripts:'outside-only'}).window;
  w.setInterval=()=>0;w.fetch=async()=>({ok:true,json:async()=>({providers:[]})});
  w.localStorage.setItem(KEY,JSON.stringify(tasks));
  if(stage){w.LeadIntelWorkspacePersistence={hasUnsavedChanges:()=>false,hasMeaningfulWorkspaceData:()=>true};w.LeadIntelJourney={getModel:()=>stageModel};}
  for(const name of ['attention-centre-model.js','background-task-centre.js','attention-centre.js'])w.eval(read(name));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
  w.document.getElementById('workspace-attention').click();await settle();
  const d=w.document;
  return {w,
    cards:()=>[...d.querySelectorAll('.attention-list .attention-item')],
    titles:()=>[...d.querySelectorAll('.attention-list .attention-item strong')].map(node=>node.textContent),
    stored:()=>JSON.parse(w.localStorage.getItem(KEY)||'[]').map(item=>item.id).sort(),
    count:()=>d.querySelector('[data-attention-count]'),
    clear:()=>d.querySelector('#workspace-attention-drawer [data-clear-finished]')};
}

test('each stopped task card has Dismiss next to Review task; pressing it removes that task and its card only',async()=>{
  const page=await mount([task('kitron','interrupted'),other('beumer','error')],{stage:true});
  assert.deepEqual(page.titles().sort(),['Buyer research · Beumer Group A/S','Buyer research · Kitron','Companies found and verified']);
  assert.equal(page.count().textContent,'3');
  const kitron=page.cards().find(card=>card.textContent.includes('Kitron'));
  assert.deepEqual([...kitron.querySelectorAll('button')].map(button=>button.textContent),['Review task','Dismiss']);
  const step=page.cards().find(card=>card.textContent.includes('Companies found and verified'));
  assert.deepEqual([...step.querySelectorAll('button')].map(button=>button.textContent),['Open stage']);
  kitron.querySelector('.attention-dismiss').click();await settle();
  assert.deepEqual(page.titles().sort(),['Buyer research · Beumer Group A/S','Companies found and verified']);
  assert.deepEqual(page.stored(),['beumer']);
  assert.equal(page.count().textContent,'2');
  assert.equal(page.w.document.getElementById('workspace-attention-drawer').hidden,false);
});

test('dismissing a card does not bring back an older stopped attempt of the same job, and keeps its finished attempt',async()=>{
  const page=await mount([task('latest','interrupted',{startedAt:3000,updatedAt:3000}),task('older','error',{startedAt:1000,updatedAt:1000}),task('done','complete',{startedAt:2000,updatedAt:2000,stage:'Complete'})]);
  assert.deepEqual(page.titles(),['Buyer research · Kitron']);
  page.cards()[0].querySelector('.attention-dismiss').click();await settle();
  assert.deepEqual(page.titles(),[]);
  assert.deepEqual(page.stored(),['done']);
});

test('Clear finished tasks at the top of the panel removes the whole task history in one press and then hides',async()=>{
  const page=await mount([task('kitron','interrupted'),other('beumer','error'),other('done','complete',{title:'Market research',metadata:{}})],{stage:true});
  const clear=page.clear();
  assert.ok(clear,'the panel has a clear button above the cards');
  assert.equal(clear.textContent,'Clear finished tasks');
  assert.equal(clear.hidden,false);
  const list=page.w.document.querySelector('#workspace-attention-drawer .attention-list');
  assert.ok(clear.compareDocumentPosition(list)&page.w.Node.DOCUMENT_POSITION_FOLLOWING,'the button comes before the cards');
  clear.click();await settle();
  assert.deepEqual(page.stored(),[]);
  assert.deepEqual(page.titles(),['Companies found and verified']);
  assert.equal(page.clear().hidden,true);
  assert.equal(page.count().textContent,'1');
});

test('with no task history the clear button stays hidden and no card offers Dismiss',async()=>{
  const page=await mount([],{stage:true});
  assert.equal(page.clear().hidden,true);
  assert.equal(page.w.document.querySelectorAll('.attention-dismiss').length,0);
  const healthy=await mount([]);
  assert.equal(healthy.clear().hidden,true);
  assert.match(healthy.w.document.querySelector('.attention-list').textContent,/Workspace healthy/);
});
