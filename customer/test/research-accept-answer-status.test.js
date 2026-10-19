const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../company-research-engine.js');
const schema=require('../step2-brief-schema.js');
const code=fs.readFileSync(require.resolve('../company-research-ui.js'),'utf8').replace(/^import .*?;\s*/gm,'')+'\nglobalThis.hooks={bind,handleReviewAction};';
const KEY='leadintel_customer_v2_state',META='leadintel_customer_v2_research_meta_v1';
function runtime(){
  const storage=new Map(),events=[];const website='https://sample.example/';
  const answers={priority_offers:'Confirmed software offer',ideal_customer:'Manufacturers',buyer_roles:'CEO',exclusions:'B2C',buying_outcomes:'Less downtime',buying_triggers:'New plant',value_proposition:'Draft value',differentiation:'Draft difference',proof_points:'Draft proof',objections:'Draft objection',delivery_approach:'Draft delivery',meeting_value:'Draft meeting'};
  const answerStatus={priority_offers:'accepted',ideal_customer:'accepted',buyer_roles:'accepted',exclusions:'accepted',buying_outcomes:'user',buying_triggers:'user',value_proposition:'draft',differentiation:'draft',proof_points:'draft',objections:'draft',delivery_approach:'draft',meeting_value:'draft'};
  storage.set(KEY,JSON.stringify({step:2,website,targetMarkets:['Germany'],answers,answerStatus,scrapedSources:[],documents:[]}));
  const fields={};for(const id of Object.keys(answerStatus))fields[id]={origin:answerStatus[id]==='draft'?'evidence_draft':'user',reviewed:answerStatus[id]!=='draft',confidence:'medium',sourceIds:[],rationale:'Draft rationale'};
  storage.set(META,JSON.stringify({website,generatedAt:'2026-10-12',mode:'ai',fields}));
  const document={readyState:'loading',activeElement:null,addEventListener(){},querySelectorAll(){return [];},querySelector(){return {};},getElementById(){return null;}};
  const window={LeadIntelCompanyResearch:engine,LeadIntelWebsiteActivation:{isCurrentWebsiteActive:()=>true},LeadIntelFirstPartyResearch:{selectInternalLinks:()=>[]},LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'w1'},saveNow:async()=>({})},addEventListener(){},dispatchEvent(event){events.push(event);}};
  const context={document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,AbortController,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout:()=>1,clearTimeout(){},location:{reload(){}},console,fetch:async()=>({ok:true,json:async()=>({data:[]})})};
  vm.runInNewContext(code,context);context.hooks.bind();
  const accept=id=>{const node={dataset:{researchAccept:id}};context.hooks.handleReviewAction({target:{closest:selector=>selector==='[data-research-accept]'?node:null}});};
  return {accept,events,state:()=>JSON.parse(storage.get(KEY)),set:value=>storage.set(KEY,JSON.stringify(value)),meta:()=>JSON.parse(storage.get(META))};
}
test('accepting a research draft marks the answer accepted so Profile approval can pass',()=>{
  const r=runtime();assert.equal(schema.confirmationMissing(r.state(),'message').length,6);
  r.accept('value_proposition');
  assert.equal(r.state().answerStatus.value_proposition,'accepted');assert.equal(r.meta().fields.value_proposition.reviewed,true);
  for(const id of ['differentiation','proof_points','objections','delivery_approach','meeting_value'])r.accept(id);
  assert.deepEqual(schema.confirmationMissing(r.state(),'message'),[]);
  assert.ok(r.events.some(event=>event.type==='leadintel:company-research-updated'&&event.detail?.acceptedAnswer==='value_proposition'));
});
test('accepting keeps customer-confirmed statuses and never accepts an empty draft',()=>{
  const r=runtime();r.accept('buying_outcomes');assert.equal(r.state().answerStatus.buying_outcomes,'user');
  const state=r.state();state.answers.objections='';r.set(state);r.accept('objections');assert.equal(r.state().answerStatus.objections,'draft');
});
