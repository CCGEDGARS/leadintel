const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

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
  assert.equal(items[0].severity,'error');
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
  assert.ok(items.every(item=>item.severity==='error'));
});

test('attention model includes unsaved work and bounded runtime failures',()=>{
  const items=Attention.buildAttentionItems({unsaved:true,runtimeErrors:[
    {id:'runtime-1',message:'Component failed'},
    {id:'runtime-2',message:'api_key=secret must not leak'}
  ]});
  assert.equal(items[0].id,'runtime-runtime-1');
  assert.doesNotMatch(items.map(item=>item.detail).join(' '),/secret/);
  const unsaved=items.find(item=>item.id==='unsaved-workspace');
  assert.equal(unsaved.severity,'recommendation');
});

test('customer shell exposes an automatic Attention control and drawer runtime',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/id="workspace-attention"/);
  assert.match(html,/data-attention-count/);
  assert.match(html,/attention-centre-model\.js\?v=/);
  assert.match(html,/attention-centre\.js\?v=/);
  assert.match(html,/attention-centre-model\.js\?v=20260924-openai-credit-health-v1/);
  assert.match(html,/attention-centre\.js\?v=20260924-openai-credit-health-v1/);
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


test('workspace health uses red for errors, orange for recommendations and green for healthy state',()=>{
  const runtime=fs.readFileSync(path.join(root,'attention-centre.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'attention-centre.css'),'utf8');
  assert.match(runtime,/severity==='error'/);
  assert.match(runtime,/severity==='recommendation'/);
  assert.match(runtime,/attention-empty is-healthy/);
  assert.match(runtime,/actionableItems/);
  assert.match(css,/\.attention-item\.is-error[^}]*#c2413b/);
  assert.match(css,/\.attention-item\.is-recommendation[^}]*#f59e0b/);
  assert.match(css,/\.attention-empty\.is-healthy[^}]*#2f7d5c/);
});

test('workspace health identifies exhausted OpenAI API credits and clears after successful synthesis',()=>{
  const state={website:'https://www.ercon.lv/'};
  const failed={website:'https://www.ercon.lv',generatedAt:'2026-09-24T16:00:00.000Z',mode:'evidence',sourceCount:13,reason:'OpenAI request failed (429) · code: credit_balance_exhausted'};
  const issue=Attention.aiProviderIssueFromResearch({state,researchMeta:failed});
  assert.deepEqual(issue,{provider:'openai',code:'credit_balance_exhausted',sourceCount:13});

  const items=Attention.buildAttentionItems({workspaceStarted:false,aiProviderIssue:issue});
  assert.equal(items.length,1);
  assert.equal(items[0].severity,'error');
  assert.equal(items[0].title,'OpenAI API credits exhausted');
  assert.match(items[0].detail,/13 saved company research sources/i);
  assert.equal(items[0].target.type,'ai-billing');

  const success={...failed,mode:'ai',reason:''};
  assert.equal(Attention.aiProviderIssueFromResearch({state,researchMeta:success}),null);
  assert.deepEqual(Attention.buildAttentionItems({workspaceStarted:false,aiProviderIssue:null}),[]);
});

test('workspace health ignores an OpenAI credit error for a different active company',()=>{
  const issue=Attention.aiProviderIssueFromResearch({
    state:{website:'https://other-company.example'},
    researchMeta:{website:'https://www.ercon.lv',generatedAt:'2026-09-24T16:00:00.000Z',mode:'evidence',reason:'OpenAI request failed (429) · code: credit_balance_exhausted'}
  });
  assert.equal(issue,null);
});

test('workspace health sends the credit warning action to OpenAI billing',()=>{
  const runtime=fs.readFileSync(path.join(root,'attention-centre.js'),'utf8');
  assert.match(runtime,/Open OpenAI billing/);
  assert.match(runtime,/https:\/\/platform\.openai\.com\/settings\/organization\/billing\/overview/);
  assert.match(runtime,/leadintel_customer_v2_research_meta_v1/);
});

test('workspace health renders the saved credit failure, opens billing and clears after synthesis succeeds',()=>{
  const runtimeSource=fs.readFileSync(path.join(root,'attention-centre.js'),'utf8');
  const local=new Map([
    ['leadintel_customer_v2_state',JSON.stringify({website:'https://www.ercon.lv/'})],
    ['leadintel_customer_v2_research_meta_v1',JSON.stringify({website:'https://www.ercon.lv',generatedAt:'2026-09-24T16:00:00.000Z',mode:'evidence',sourceCount:13,reason:'OpenAI request failed (429) · code: credit_balance_exhausted'})]
  ]);
  const makeElement=()=>({children:[],handlers:{},dataset:{},hidden:false,textContent:'',classList:{add(){},remove(){}},setAttribute(){},focus(){},append(...children){this.children.push(...children);},appendChild(child){this.children.push(child);},replaceChildren(...children){this.children=children;},addEventListener(type,handler){this.handlers[type]=handler;},querySelector(selector){return this.queries?.[selector]||null;}});
  const trigger=makeElement(),count=makeElement(),summary=makeElement(),list=makeElement(),closeButton=makeElement();
  trigger.queries={'[data-attention-count]':count,'[data-attention-summary]':summary};
  const ids=new Map([['workspace-attention',trigger]]);
  const document={
    readyState:'complete',
    documentElement:{appendChild(element){if(element.id)ids.set(element.id,element);}},
    getElementById(id){return ids.get(id)||null;},
    createElement(){const element=makeElement();element.queries={'.attention-list':list,'.attention-close':closeButton};return element;},
    querySelector(){return null;},
    addEventListener(){}
  };
  const opened=[];
  const window={
    document,localStorage:{getItem(key){return local.get(key)||null;}},LeadIntelAttentionModel:Attention,
    LeadIntelWorkspacePersistence:{hasMeaningfulWorkspaceData(){return false;},hasUnsavedChanges(){return false;}},
    LeadIntelJourney:{getModel(){return []; }},LeadIntelTaskCentre:{list(){return []; }},
    handlers:{},addEventListener(type,handler){this.handlers[type]=handler;},setInterval(){},open(...args){opened.push(args);},location:{reload(){assert.fail('billing action must not reload the workspace');}}
  };
  vm.runInNewContext(runtimeSource,{window,setTimeout,clearTimeout});

  assert.equal(window.LeadIntelAttention.list()[0].id,'ai-openai-credit-balance');
  assert.equal(count.textContent,'1');
  trigger.handlers.click();
  const billingAction=list.children[0].children[1];
  assert.equal(billingAction.textContent,'Open OpenAI billing');
  billingAction.handlers.click();
  assert.deepEqual(opened[0],['https://platform.openai.com/settings/organization/billing/overview','_blank','noopener,noreferrer']);

  local.set('leadintel_customer_v2_research_meta_v1',JSON.stringify({website:'https://www.ercon.lv',generatedAt:'2026-09-24T16:10:00.000Z',mode:'ai',sourceCount:13,reason:''}));
  window.LeadIntelAttention.refresh();
  assert.deepEqual(window.LeadIntelAttention.list(),[]);
  assert.equal(count.hidden,true);
  assert.equal(summary.textContent,'Workspace healthy');
});
