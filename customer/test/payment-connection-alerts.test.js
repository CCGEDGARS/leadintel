const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,35));
async function mount({hunterPayment=false,connection=false,aiPayment=false,saveError=''}={}){
 const w=new JSDOM('<div class="top-actions"></div><div id="toast"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 const observers=[],Native=w.MutationObserver,close=w.close.bind(w);w.MutationObserver=class extends Native{constructor(fn){super(fn);observers.push(this);}};w.close=()=>{observers.forEach(o=>o.disconnect());close();};
 w.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'w1',role:'owner'},microsoftMail:{configured:true,connected:false}};
 w.LeadIntelSenderIdentity={get:()=>({})};let payment=hunterPayment;
 w.fetch=async(input,options={})=>{const route=new URL(input).pathname;let payload={role:'owner',providers:[]};
  if(options.method==='PUT'&&saveError)return {ok:false,json:async()=>({error:saveError})};
  if(route.endsWith('/ai/status'))payload={role:'owner',providers:[{provider:'openai',name:'OpenAI',configured:true,active:true,...(aiPayment?{credit_issue:{code:'credits_exhausted',source:'customer'}}:{})}]};
  if(route.endsWith('/services/status'))payload={role:'owner',providers:[{provider:'apollo',configured:true,source:'customer',state:connection?'bad':'good',metadata:{error:'API key rejected'}},{provider:'firecrawl',configured:true,source:'customer',state:connection?'bad':'good',metadata:{remaining_credits:100,error:'Connection failed'}},{provider:'hunter',configured:true,source:'customer',state:payment?'bad':connection?'bad':'good',label:payment?'Credits exhausted':'Connection error',metadata:{remaining_verifications:payment?0:100},...(payment?{credit_issue:{code:'credits_exhausted',source:'customer'}}:{})}]};
  if(route==='/api/enrichment-policy')payload={configured:true,usage:{daily:0,monthly:0},policy:{daily_credit_limit:10,monthly_credit_limit:100}};
  if(route.endsWith('/gmail/status'))payload={connected:false,configured:false};
  return {ok:true,json:async()=>payload};};
 w.eval(read('personal-linkedin.js'));w.eval(read('tool-account-links.js'));w.eval(read('ai-settings.js').replace(/^import .*;\s*$/gm,''));
 w.eval('(function(){'+read('service-settings-extension.js').replace(/^import .*;\s*$/gm,'').replace(/^export .*;\s*$/gm,'window.refreshServicesForTest=refreshServiceStatus;')+'})()');
 w.document.getElementById('open-settings').click();await settle();return {w,recover:()=>{payment=false;}};
}
test('Hunter payment appears red in its card and summary through refresh and reopen, then clears on recovery',async()=>{
 const {w,recover}=await mount({hunterPayment:true,connection:true});try{
  const check=()=>{assert.ok(w.document.querySelector('[data-integration="hunter"] .integration-status.bad'));assert.ok(w.document.querySelector('#integration-health-summary.credit-alert'));assert.match(w.document.querySelector('.integration-summary-copy strong').textContent,/Payment alert: Hunter/);assert.ok(w.document.querySelector('[data-integration="firecrawl"] .integration-status.warn'));};check();
  await w.refreshServicesForTest();await settle();check();w.document.getElementById('close-settings').click();w.document.getElementById('open-settings').click();await settle();check();
  recover();await w.refreshServicesForTest();await settle();assert.equal(w.document.querySelector('#integration-health-summary.credit-alert'),null);assert.ok(w.document.querySelector('[data-integration="hunter"] .integration-status.warn'));
 }finally{w.close();}
});
test('connection-only failures are yellow throughout integration cards and summary',async()=>{
 const {w}=await mount({connection:true});try{for(const provider of ['apollo','firecrawl','hunter','gmail','microsoft-mail'])assert.ok(w.document.querySelector(`[data-integration="${provider}"] .integration-status.warn`),provider);
  assert.equal(w.document.querySelector('.integration-status.bad'),null);assert.ok(w.document.querySelector('#integration-health-summary.connection-alert'));assert.equal(w.document.querySelector('#integration-health-summary.credit-alert'),null);
 }finally{w.close();}
});
test('AI credit alerts stay red while unrelated connections are yellow',async()=>{
 const {w}=await mount({aiPayment:true,connection:true});try{assert.ok(w.document.querySelector('[data-provider-card="openai"] .ai-provider-status.credit-alert'));assert.match(w.document.querySelector('.integration-summary-copy strong').textContent,/Payment alert: OpenAI/);assert.ok(w.document.querySelector('[data-integration="apollo"] .integration-status.warn'));}finally{w.close();}
});
for(const [error,payment] of [['API key rejected',false],['Hunter credits exhausted or payment required',true],['rate_limit_exceeded',false]])test(`inline provider error classifies ${error}`,async()=>{
 const {w}=await mount({saveError:error});try{
  for(const [input,button,output] of [['[data-ai-key="openai"]','[data-ai-action="save"][data-provider="openai"]','[data-ai-error="openai"]'],['[data-service-key="hunter"]','[data-service-action="save"][data-provider="hunter"]','[data-service-error="hunter"]']]){
   w.document.querySelector(input).value='test-key';w.document.querySelector(button).click();await settle();const node=w.document.querySelector(output);assert.equal(node.hidden,false);assert.equal(node.dataset.paymentError,String(payment));assert.equal(w.document.querySelector(input).value,'test-key');
  }
 }finally{w.close();}
});
