const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const engine=require('../company-research-engine.js');
const source=fs.readFileSync(path.join(__dirname,'..','company-research-ui.js'),'utf8')
  .replace(/^import .*?;\s*/m,'')
  +'\nglobalThis.__researchUi={renderResearchReview,runAiSynthesis:typeof runAiSynthesis==="function"?runAiSynthesis:null};';

function createRuntime({fetchImpl}={}){
  const saved=new Map();
  const events=[];
  const fetchCalls=[];
  const controls=new Map();
  const listeners=new Map();
  let saves=0;
  const initialAnswers=Object.fromEntries(engine.QUESTION_IDS.map(id=>[id,`Existing ${id}`]));
  initialAnswers.priority_offers='Customer-confirmed offer';
  initialAnswers.ideal_customer='Manufacturing';
  const state={website:'https://www.ercon.lv',targetMarkets:['Sweden'],answers:initialAnswers,documents:[],scrapedSources:[
    {type:'website',url:'https://www.ercon.lv/services',title:'Services',text:'Custom industrial engineering and metalworking services.',status:'ready',role:'primary',pageCategory:'offers'},
    {type:'link',url:'https://www.ercon.lv/projects',title:'Projects',text:'Production capacity for manufacturing customers.',status:'ready',role:'primary',pageCategory:'proof'},
    {type:'link',url:'https://www.ercon.lv/blog',title:'Blog',text:'SUPPORTING ONLY: unrelated market commentary.',status:'ready',role:'supporting',pageCategory:'company'}
  ]};
  const fields=Object.fromEntries(engine.QUESTION_IDS.map(id=>[id,id==='priority_offers'
    ?{origin:'user',reviewed:true,draftValue:'Customer-confirmed offer',sourceIds:[],rationale:'Confirmed by customer.'}
    :{origin:'evidence_draft',reviewed:false,draftValue:initialAnswers[id],sourceIds:['S1'],rationale:'Existing draft.'}]));
  const meta={website:state.website,generatedAt:'2026-09-24T10:00:00.000Z',mode:'evidence',reason:'No active AI provider configured.',sourceCount:3,quality:{coverage:{minimumMet:true,categories:['company','offers','proof'],total:5}},fields};
  saved.set('leadintel_customer_v2_state',JSON.stringify(state));
  saved.set('leadintel_customer_v2_research_meta_v1',JSON.stringify(meta));
  const settingsButton={clicks:0,click(){this.clicks++;}};
  controls.set('#open-ai-settings-from-research',{});
  const summary={innerHTML:'',classList:{add(){},remove(){},toggle(){}},querySelector(selector){return controls.get(selector)||null;}};
  const makeControl=()=>({listener:null,addEventListener(type,listener){if(type==='click')this.listener=listener;}});
  controls.set('#open-ai-settings-from-research',makeControl());
  controls.set('#synthesize-company-research',makeControl());
  controls.set('#refresh-company-research',makeControl());
  const document={
    getElementById(id){if(id==='research-summary')return summary;if(id==='open-settings')return settingsButton;return null;},
    querySelectorAll(){return [];},
    querySelector(){return null;},
    createElement(){return {dataset:{}};},
    head:{appendChild(){}}
  };
  const bridge={session:{authenticated:true},workspace:{id:'workspace-1'},async saveNow(){saves++;return {ok:true};}};
  const window={
    LeadIntelCompanyResearch:engine,LeadIntelServerBridge:bridge,
    addEventListener(type,listener){const entries=listeners.get(type)||[];entries.push(listener);listeners.set(type,entries);},
    dispatchEvent(event){events.push(event.type);for(const listener of listeners.get(event.type)||[])listener(event);}
  };
  const context={
    window,document,localStorage:{getItem(key){return saved.get(key)||null;},setItem(key,value){saved.set(key,value);}},
    fetch:async(...args)=>{fetchCalls.push(args);return fetchImpl?fetchImpl(...args):{ok:false,status:409,async json(){return {error:'No active AI provider is configured for this workspace'};}};},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    URL,URLSearchParams,AbortController,Event,Map,Date,JSON,String,Boolean,Array,Number,Math,Promise,
    setTimeout,clearTimeout,console
  };
  vm.runInNewContext(source,context,{filename:'company-research-ui.js'});
  return {
    hooks:context.__researchUi,
    saved,
    summary,
    settingsButton,
    events,
    fetchCalls,
    dispatch(type){window.dispatchEvent(new context.CustomEvent(type));},
    get saves(){return saves;},
    getState(){return JSON.parse(saved.get('leadintel_customer_v2_state'));},
    getMeta(){return JSON.parse(saved.get('leadintel_customer_v2_research_meta_v1'));}
  };
}

test('an evidence-only result shows the saved AI failure reason and routes to settings',async()=>{
  const runtime=createRuntime();
  runtime.hooks.renderResearchReview();

  assert.match(runtime.summary.innerHTML,/AI synthesis did not complete/);
  assert.match(runtime.summary.innerHTML,/No active AI provider configured/);
  assert.match(runtime.summary.innerHTML,/Synthesize saved evidence/);
  assert.match(runtime.summary.innerHTML,/Open AI settings/);
  runtime.summary.querySelector('#open-ai-settings-from-research').listener();
  assert.equal(runtime.settingsButton.clicks,1);
  runtime.dispatch('leadintel:ai-provider-changed');
  assert.match(runtime.summary.innerHTML,/AI provider settings changed/);
  await runtime.summary.querySelector('#synthesize-company-research').listener();
  assert.equal(runtime.getMeta().reason,'No active AI provider configured.');
  assert.match(runtime.summary.innerHTML,/No active AI provider configured/);
  assert.equal(runtime.getState().scrapedSources.length,3);
  assert.equal(runtime.getState().answers.ideal_customer,'Manufacturing');
  assert.equal(runtime.fetchCalls.length,1);
});

test('AI retry synthesizes saved primary evidence without rerunning web research or overwriting customer-confirmed answers',async()=>{
  const runtime=createRuntime({fetchImpl:async(url,options)=>({
    ok:true,status:200,
    async json(){return {provider:'openai',model:'gpt-5.6',text:JSON.stringify({fields:{
      ideal_customer:{value:'Swedish industrial manufacturers buying custom engineered metal systems',confidence:'medium',draft_type:'evidence',source_ids:['S1','S2'],rationale:'Offer and project pages support this fit.'},
      priority_offers:{value:'Generated offer must not replace the customer-confirmed answer',confidence:'high',draft_type:'evidence',source_ids:['S1'],rationale:'Evidence found.'}
    }})};}
  })});

  await runtime.hooks.runAiSynthesis();

  assert.equal(runtime.fetchCalls.length,1);
  assert.match(runtime.fetchCalls[0][0],/\/api\/ai\/generate\?/);
  assert.match(JSON.parse(runtime.fetchCalls[0][1].body).prompt,/\[S1\] Services/);
  assert.match(JSON.parse(runtime.fetchCalls[0][1].body).prompt,/\[S2\] Projects/);
  assert.doesNotMatch(JSON.parse(runtime.fetchCalls[0][1].body).prompt,/SUPPORTING ONLY/);
  assert.equal(runtime.getState().answers.priority_offers,'Customer-confirmed offer');
  assert.equal(runtime.getState().answers.ideal_customer,'Swedish industrial manufacturers buying custom engineered metal systems');
  assert.equal(runtime.getMeta().mode,'ai');
  assert.equal(runtime.getMeta().reason,'');
  assert.equal(runtime.getMeta().provider,'OpenAI');
  assert.equal(runtime.getMeta().sourceCount,3);
  assert.equal(runtime.saves,1);
  assert.ok(runtime.events.includes('leadintel:company-research-updated'));
});

test('credit exhaustion is retained as the workspace health reason until synthesis succeeds',async()=>{
  const runtime=createRuntime({fetchImpl:async()=>({
    ok:false,status:502,
    async json(){return {error:'OpenAI request failed (429) · code: credit_balance_exhausted'};}
  })});

  assert.equal(await runtime.hooks.runAiSynthesis(),false);
  assert.equal(runtime.getMeta().reason,'OpenAI request failed (429) · code: credit_balance_exhausted');
  assert.ok(runtime.events.includes('leadintel:company-research-updated'));
  runtime.dispatch('leadintel:ai-provider-changed');
  assert.equal(runtime.getMeta().reason,'OpenAI request failed (429) · code: credit_balance_exhausted');
  assert.equal(runtime.getState().scrapedSources.length,3);
  assert.equal(runtime.getState().answers.ideal_customer,'Manufacturing');
});
