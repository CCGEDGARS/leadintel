const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function mount(){
 const w=new JSDOM(read('index.html'),{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 w.eval(read('personal-linkedin.js'));
 w.LeadIntelServerBridge={session:{authenticated:false},workspace:{id:'first',role:'owner'}};
 w.eval(read('ai-settings.js').replace(/^import .*;\s*$/gm,'')+'\nwindow.probe={checkApolloStatus,refreshIntegrationStatus,items:activeToolItems,set:s=>{integrationStatus=s;},get:()=>integrationStatus};');
 w.LeadIntelServerBridge.session.authenticated=true;
 return w;
}
function response(payload){return {ok:true,json:async()=>payload};}
test('legacy managed Apollo is unavailable under customer-only billing',async()=>{
 const w=mount();try{
  w.fetch=async input=>response(new URL(input).pathname.endsWith('/enrichment-policy')?{configured:true,usage:{}}:{providers:[{provider:'apollo',configured:false,source:'managed',state:'good'}]});
  const status=await w.probe.checkApolloStatus();assert.equal(status.source,'none');assert.equal(status.label,'Not connected');
  w.probe.set({apollo:status});assert.equal(w.probe.items(null).length,0);
 }finally{w.close();}
});
test('a retained customer Apollo connection stays out of the settings summary',async()=>{
 const w=mount();try{
  w.fetch=async input=>response(new URL(input).pathname.endsWith('/enrichment-policy')?{configured:true,usage:{}}:{providers:[{provider:'apollo',configured:true,source:'customer',state:'good'}]});
  const status=await w.probe.checkApolloStatus();assert.equal(status.source,'customer');assert.match(status.detail,/Your Apollo key/);assert.doesNotMatch(status.detail,/Platform managed/);
  w.probe.set({apollo:status});assert.equal(w.probe.items(null).length,0);
 }finally{w.close();}
});
test('legacy managed Firecrawl cannot appear as an active tool',()=>{
 const w=mount();try{w.probe.set({firecrawl:{source:'managed',state:'warn',label:'Credits unverified'}});assert.equal(w.probe.items(null).length,0);}finally{w.close();}
});
test('fresh integration results immediately refresh the active tools summary',async()=>{
 const w=mount();try{
  w.document.getElementById('ai-settings-drawer').hidden=false;
  w.fetch=async input=>response(new URL(input).pathname.endsWith('/enrichment-policy')?{configured:true,usage:{}}:{providers:[{provider:'apollo',configured:true,source:'customer',state:'good'},{provider:'firecrawl',configured:true,source:'customer',state:'good',metadata:{remaining_credits:321}}]});
  await w.probe.refreshIntegrationStatus();const summary=w.document.getElementById('ai-engine-summary').textContent;assert.doesNotMatch(summary,/Apollo|Hunter/);assert.match(summary,/Firecrawl/);assert.match(summary,/READY/);assert.match(summary,/your connection/);
 }finally{w.close();}
});
test('diagnostic summary refresh preserves an unsaved AI key being entered',async()=>{
 const w=mount();try{
  w.document.getElementById('ai-settings-drawer').hidden=false;
  const grid=w.document.getElementById('ai-provider-grid');grid.innerHTML='<input data-ai-key="openai" value="transient-test-key">';const input=grid.firstChild;
  w.fetch=async()=>response({providers:[]});await w.probe.refreshIntegrationStatus();
  assert.equal(grid.firstChild,input);assert.equal(input.value,'transient-test-key');
 }finally{w.close();}
});
test('an in-flight status response from a previous workspace cannot populate the next workspace',async()=>{
 const w=mount();try{
  let resolve;const gate=new Promise(r=>{resolve=r;});w.fetch=async()=>{await gate;return response({configured:true,providers:[{provider:'apollo',configured:true,source:'customer',state:'good'}]});};
  const old=w.probe.refreshIntegrationStatus();w.LeadIntelServerBridge.workspace={id:'second',role:'owner'};w.LeadIntelServerBridge.session.authenticated=false;
  w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));resolve();await old;
  assert.equal(w.probe.get().apollo,null);assert.equal(w.probe.get().firecrawl,null);
 }finally{w.close();}
});
