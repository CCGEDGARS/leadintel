const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../company-research-engine.js');
const code=fs.readFileSync(require.resolve('../company-research-ui.js'),'utf8').replace(/^import .*?;\s*/gm,'')+'\nglobalThis.hooks={bind,runCompanyResearch};';
function runtime({completed=false,active=true,markets=['Germany'],aiFailure=false,step=1,profile=null,hangAi=false}={}){
  const storage=new Map(),listeners=new Map(),calls=[],timers=[];let reloads=0;
  const website='https://sample.example/';
  storage.set('leadintel_customer_v2_state',JSON.stringify({step,profile,website,targetMarkets:markets,answers:{priority_offers:'Confirmed software offer'},scrapedSources:[],documents:[]}));
  if(completed)storage.set('leadintel_customer_v2_research_meta_v1',JSON.stringify({website,generatedAt:'2026-10-12',fields:{}}));
  const document={readyState:'loading',activeElement:null,addEventListener(type,fn){listeners.set(type,fn);},querySelectorAll(){return [];},querySelector(){return {};},getElementById(){return null;}};
  const window={LeadIntelCompanyResearch:engine,LeadIntelWebsiteActivation:{isCurrentWebsiteActive:()=>active},LeadIntelFirstPartyResearch:{selectInternalLinks:()=>[]},LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'w1'},saveNow:async()=>({})},addEventListener(){},dispatchEvent(){}};
  const context={document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,AbortController,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},location:{reload(){reloads++;}},console,fetch:async(url)=>{
    calls.push(url);if(hangAi&&url.includes('/api/ai/generate'))return new Promise(()=>{});
    if(url.includes('/api/ai/generate'))return {ok:!aiFailure,status:aiFailure?409:200,json:async()=>aiFailure?{error:'No AI provider'}:{text:JSON.stringify({fields:{value_proposition:{value:'Help operations teams streamline inventory work',confidence:'medium',draft_type:'hypothesis',source_ids:[],rationale:'Review this proposed benefit.'},delivery_approach:{value:'Online onboarding',confidence:'medium',draft_type:'evidence',source_ids:['S1'],rationale:'Website states online onboarding.'}}})}};
    if(url.includes('scrape'))return {ok:true,json:async()=>({data:{markdown:'We provide inventory software for manufacturing customers with online onboarding.',metadata:{title:'Sample Software'}}})};
    return {ok:true,json:async()=>({data:[]})};
  }};
  vm.runInNewContext(code,context);context.hooks.bind();
  return {calls,storage,context,timers,get reloads(){return reloads;},click(){let prevented=false;const target={id:'to-questionnaire',dataset:{},closest:()=>target};const event={target,preventDefault(){prevented=true;},stopImmediatePropagation(){}};listeners.get('click')?.(event);return prevented;},state:()=>JSON.parse(storage.get('leadintel_customer_v2_state'))};
}
async function flush(){await new Promise(resolve=>setImmediate(resolve));}
test('Continue prepares website answers before opening a fresh commercial brief',async()=>{const r=runtime();assert.equal(r.click(),true);await flush();assert.ok(r.calls.some(url=>url.includes('/api/ai/generate')));assert.equal(r.state().answers.value_proposition,'Help operations teams streamline inventory work');assert.equal(r.state().answers.delivery_approach,'Online onboarding');assert.equal(r.state().answers.priority_offers,'Confirmed software offer');assert.equal(r.state().step,2);const meta=JSON.parse(r.storage.get('leadintel_customer_v2_research_meta_v1'));assert.equal(meta.fields.value_proposition.origin,'hypothesis_draft');assert.equal(meta.fields.value_proposition.reviewed,false);});
test('completed research opens without repeating provider calls',()=>{const r=runtime({completed:true});assert.equal(r.click(),false);assert.equal(r.calls.length,0);});
test('unactivated websites and missing markets keep Setup navigation validation',()=>{for(const options of [{active:false},{markets:[]}]){const r=runtime(options);assert.equal(r.click(),false);assert.equal(r.calls.length,0);}});
test('double Continue clicks start only one run',async()=>{const r=runtime();r.click();r.click();await flush();assert.equal(r.calls.filter(url=>url.includes('/api/ai/generate')).length,1);});
test('AI failure saves evidence and its reason without inventing commercial answers',async()=>{const r=runtime({aiFailure:true});r.click();await flush();assert.equal(r.state().answers.value_proposition,'');assert.equal(r.state().scrapedSources.length,1);const meta=JSON.parse(r.storage.get('leadintel_customer_v2_research_meta_v1'));assert.equal(meta.mode,'evidence');assert.ok(meta.reason);});

test('opening or restoring Profile never starts paid research automatically',async()=>{const r=runtime({step:2});await flush();assert.equal(r.calls.length,0);});

test("an existing saved profile opens without rerunning research when browser research metadata is missing",async()=>{const r=runtime({profile:{website:"https://sample.example/",companyName:"Saved company"},step:2});assert.equal(r.click(),false);await flush();assert.equal(r.calls.length,0);assert.equal(r.state().profile.companyName,"Saved company");});

for(const [label,change] of [
  ['documents',state=>{state.documents=[{name:'new.pdf',text:'Newly uploaded customer document'}];}],
  ['target markets',state=>{state.targetMarkets=['France'];}],
  ['answers',state=>{state.answers.priority_offers='New customer-confirmed offer';}]
])test(`research does not commit or navigate after ${label} change during the request`,async()=>{
  const r=runtime();r.click();const next=r.state();change(next);r.storage.set('leadintel_customer_v2_state',JSON.stringify(next));await flush();
  assert.deepEqual(r.state(),next);assert.equal(r.storage.has('leadintel_customer_v2_research_meta_v1'),false);
});
test('research preserves unrelated live workspace changes rather than restoring its old snapshot',async()=>{
  const r=runtime();r.click();const next=r.state();next.brandIdentity={companyName:'Customer branding edited during research'};r.storage.set('leadintel_customer_v2_state',JSON.stringify(next));await flush();
  assert.deepEqual(r.state().brandIdentity,next.brandIdentity);assert.equal(r.state().step,2);
});
test('a late result cannot write into another workspace researching the same website',async()=>{
  const r=runtime();r.click();r.context.window.LeadIntelServerBridge.workspace={id:'w2'};const next=r.state();r.storage.set('leadintel_account_context_v1','new-account-context');await flush();
  assert.deepEqual(r.state(),next);assert.equal(r.storage.has('leadintel_customer_v2_research_meta_v1'),false);
});

 test('collected evidence is checkpointed before a stalled AI request',async()=>{const r=runtime({hangAi:true});r.click();await flush();assert.ok(r.calls.some(url=>url.includes('/api/ai/generate')));assert.equal(r.state().scrapedSources.length,1);assert.ok(JSON.parse(r.storage.get('leadintel_customer_v2_research_meta_v1')).generatedAt);});
 test('AI deadline settles even when a provider ignores abort and never reloads',async()=>{const r=runtime({hangAi:true});r.click();await flush();for(const timer of [...r.timers].filter(t=>t.ms>=60000))timer.fn();await flush();const meta=JSON.parse(r.storage.get('leadintel_customer_v2_research_meta_v1')||'{}');assert.equal(meta.mode,'evidence');assert.match(meta.reason,/60 seconds|timed out/i);for(const timer of r.timers.filter(t=>t.ms===180))timer.fn();assert.equal(r.reloads,0);});
 test('successful research updates the page without reloading',async()=>{const r=runtime();r.click();await flush();for(const timer of r.timers.filter(t=>t.ms===180))timer.fn();assert.equal(r.reloads,0);});

test('background market normalization does not discard valid company research',async()=>{
  const r=runtime();r.click();const next=r.state();next.market={researchResults:[],status:'idle',updatedAt:'background-refresh'};r.storage.set('leadintel_customer_v2_state',JSON.stringify(next));await flush();
  assert.equal(r.state().answers.delivery_approach,'Online onboarding');assert.ok(JSON.parse(r.storage.get('leadintel_customer_v2_research_meta_v1')||'{}').generatedAt);
});

test('background answer-status normalization does not discard unchanged answer content',async()=>{
  const r=runtime();r.click();const next=r.state();next.answerStatus={priority_offers:'user'};r.storage.set('leadintel_customer_v2_state',JSON.stringify(next));await flush();assert.equal(r.state().answers.delivery_approach,'Online onboarding');
});

test('metadata-only synchronization does not discard unchanged company evidence and answers',async()=>{
 const r=runtime();r.click();r.storage.set('leadintel_customer_v2_research_meta_v1',JSON.stringify({fields:{},reason:'Background status refreshed'}));await flush();assert.equal(r.state().answers.delivery_approach,'Online onboarding');
});
