const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const modelPath=path.join(root,'attention-centre-model.js');
const Attention=fs.existsSync(modelPath)?require(modelPath):{};

test('attention model prioritizes current required gaps and ignores optional gaps',()=>{
  assert.equal(typeof Attention.buildAttentionItems,'function');
  const items=Attention.buildAttentionItems({workspaceStarted:true,model:[{
    id:1,status:'current',name:'Company & Market',steps:[
      {id:'website',label:'Website activated',complete:false,optional:false,action:'Activate website'},
      {id:'markets',label:'Target markets selected',complete:true,optional:false},
      {id:'brand',label:'Brand configured',complete:false,optional:true}
    ]
  }]});
  assert.deepEqual(items.map(item=>item.id),['stage-1-website']);
  assert.equal(items[0].severity,'important');
  assert.equal(items[0].target.type,'stage');
});

test('a pristine reset workspace is all clear until the user starts working',()=>{
  const items=Attention.buildAttentionItems({workspaceStarted:false,unsaved:false,model:[{
    id:1,status:'current',name:'Company & Market',steps:[
      {id:'website',label:'Website activated',complete:false,optional:false},
      {id:'markets',label:'Target markets selected',complete:false,optional:false}
    ]
  }]});
  assert.deepEqual(items,[]);
});

test('attention model surfaces failed and stalled work automatically',()=>{
  const now=Date.parse('2026-09-17T12:00:00Z');
  const items=Attention.buildAttentionItems({now,tasks:[
    {id:'failed',title:'Market research',status:'error',stage:'Needs attention',error:'Request failed',updatedAt:now-1000},
    {id:'stalled',title:'Company discovery',status:'running',stage:'Searching',updatedAt:now-181000},
    {id:'healthy',title:'Enrichment',status:'running',stage:'Checking',updatedAt:now-1000}
  ]});
  assert.deepEqual(items.map(item=>item.id),['task-failed','task-stalled']);
  assert.ok(items.every(item=>item.target.type==='tasks'));
});

test('attention model includes unsaved work and bounded runtime failures',()=>{
  const items=Attention.buildAttentionItems({unsaved:true,runtimeErrors:[
    {id:'runtime-1',message:'Component failed'},
    {id:'runtime-2',message:'api_key=secret must not leak'}
  ]});
  assert.equal(items[0].id,'runtime-runtime-1');
  assert.doesNotMatch(items.map(item=>item.detail).join(' '),/secret/);
  assert.ok(items.some(item=>item.id==='unsaved-workspace'));
});

test('customer shell exposes an automatic Attention control and drawer runtime',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/id="workspace-attention"/);
  assert.match(html,/data-attention-count/);
  assert.match(html,/attention-centre-model\.js\?v=/);
  assert.match(html,/attention-centre\.js\?v=/);
});

test('confirmed reset refreshes Attention and clears transient runtime errors',()=>{
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const runtime=fs.readFileSync(path.join(root,'attention-centre.js'),'utf8');
  assert.match(app,/leadintel:workspace-reset/);
  assert.match(runtime,/leadintel:workspace-reset/);
  assert.match(runtime,/runtimeErrors\s*=\s*\[\]/);
  assert.match(runtime,/workspace-reset[\s\S]*LeadIntelJourney\?\.refresh/);
});

test('a zero Attention count is visually hidden even when badge layout uses display grid',()=>{
  const css=fs.readFileSync(path.join(root,'attention-centre.css'),'utf8');
  assert.match(css,/\.attention-trigger>b\[hidden\]\s*\{\s*display:none/);
});
