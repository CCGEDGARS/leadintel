const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../company-research-engine.js');
const code=fs.readFileSync(require.resolve('../company-research-ui.js'),'utf8').replace(/^import .*?;\s*/gm,'')+'\nglobalThis.hooks={bind,prepareProfileAnswers};';
function runtime(){
  const storage=new Map(),listeners=new Map(),calls=[];const website='https://sample.example/';
  storage.set('leadintel_customer_v2_state',JSON.stringify({step:1,profile:null,website,targetMarkets:['Germany'],answers:{priority_offers:'Confirmed software offer'},scrapedSources:[],documents:[]}));
  const document={readyState:'loading',activeElement:null,addEventListener(type,fn){listeners.set(type,fn);},querySelectorAll(){return [];},querySelector(){return {};},getElementById(){return null;}};
  const window={LeadIntelCompanyResearch:engine,LeadIntelWebsiteActivation:{isCurrentWebsiteActive:()=>true},LeadIntelFirstPartyResearch:{selectInternalLinks:()=>[]},LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'w1'},saveNow:async()=>({})},addEventListener(){},dispatchEvent(){}};
  const context={document,window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},URL,URLSearchParams,AbortController,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout:()=>1,clearTimeout(){},location:{reload(){}},console,fetch:async(url)=>{calls.push(url);if(url.includes('/api/ai/generate'))return {ok:true,status:200,json:async()=>({text:JSON.stringify({fields:{}})})};if(url.includes('scrape'))return {ok:true,json:async()=>({data:{markdown:'Sample company page.',metadata:{title:'Sample'}}})};return {ok:true,json:async()=>({data:[]})};}};
  vm.runInNewContext(code,context);context.hooks.bind();
  return {calls,click(element){let prevented=false;listeners.get('click')?.({target:element,preventDefault(){prevented=true;},stopImmediatePropagation(){}});return prevented;}};
}
async function flush(){for(let i=0;i<40;i++)await Promise.resolve();}
// Elements that match only the stage-navigation selectors (stepper circle, sidebar "Show Profile steps", process map).
function navigationElement(attribute){const element={dataset:{[attribute]:'2'},closest(selector){if(selector.includes('[data-step-marker="2"]')||selector.includes('[data-process-step="2"]'))return element;return null;}};return element;}
function continueButton(){const element={id:'to-questionnaire',dataset:{},closest(selector){return selector.includes('#to-questionnaire')?element:null;}};return element;}
test('stage navigation clicks never start paid company research',async()=>{
  for(const attribute of ['stepMarker','processStep']){
    const r=runtime();assert.equal(r.click(navigationElement(attribute)),false);await flush();
    assert.equal(r.calls.length,0,`${attribute} click must not call providers`);
  }
});
test('the explicit Continue button still prepares website answers',async()=>{
  const r=runtime();assert.equal(r.click(continueButton()),true);await flush();
  assert.ok(r.calls.some(url=>url.includes('scrape')||url.includes('/api/ai/generate')));
});
