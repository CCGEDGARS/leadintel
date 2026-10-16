const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
test('application work waits for successful verification and runs once against the current context',()=>{
 const w=new JSDOM('',{url:'https://leadintel.example/customer/',runScripts:'outside-only'}).window;
 try{
  w.eval(read('account-cache.js'));w.LeadIntelServerBridge={ready:false};let app=0,support=0;
  w.LeadIntelAccountCache.afterVerification(()=>app++);w.LeadIntelAccountCache.afterVerification(()=>support++);
  assert.equal(app,0);assert.equal(support,0);
  w.dispatchEvent(new w.Event('leadintel:server-ready'));assert.equal(app,0,'failure readiness events must not open the app');
  w.LeadIntelServerBridge.ready=true;w.dispatchEvent(new w.Event('leadintel:server-ready'));
  assert.equal(app,1);assert.equal(support,1);
  w.dispatchEvent(new w.Event('leadintel:server-ready'));assert.equal(app,1);assert.equal(support,1);
  w.LeadIntelAccountCache.afterVerification(()=>app++);assert.equal(app,2,'already verified applications start immediately');
  w.localStorage.setItem(w.LeadIntelAccountCache.CONTEXT_KEY,'another-context');
  w.LeadIntelAccountCache.afterVerification(()=>app++);assert.equal(app,2,'a stale tab must not mount');
 }finally{w.close();}
});
test('entrypoints defer saved-state loading, application mounting and optional imports until verification',()=>{
 const app=read('app.js'),support=read('shell-support-loader.js');
 assert.doesNotMatch(app,/let state=loadState\(\)/,'normalization must not run against an unverified cache');
 assert.match(app,/function init\(\)\{\s*state=loadState\(\);/);
 assert.match(app,/LeadIntelAccountCache\.afterVerification\(init\)/);
 assert.match(support,/LeadIntelAccountCache\.afterVerification\(loadSupportModules\)/);
});

test('the real application can initialize its public API behind verification without reading or changing saved state',async()=>{
 const w=new JSDOM('',{url:'https://leadintel.example/customer/',runScripts:'outside-only'}).window;
 try{
  const key='leadintel_customer_v2_state',value=JSON.stringify({website:'https://saved.example',step:6});
  w.localStorage.setItem(key,value);w.eval(read('account-cache.js'));w.LeadIntelServerBridge={ready:false};
  w.eval(read('app.js').replace(/^import .*$/gm,''));
  assert.equal(w.LeadIntelCustomerNavigation.setStep(1),false);
  assert.equal(await w.LeadIntelCustomerNavigation.openModule(6),false);
  assert.match(w.LeadIntelPageProcedures.strategyBlockers()[0],/verification.*loading/);
  w.dispatchEvent(new w.Event('leadintel:server-ready'));
  assert.equal(w.localStorage.getItem(key),value);
 }finally{w.close();}
});

test('saved-message startup cannot mount Discovery or the process map before verification',()=>{
 const w=new JSDOM('<main class="content"></main><div id="commercial-process-map"></div>',{url:'https://leadintel.example/customer/',runScripts:'outside-only'}).window;
 try{
  w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({step:6,website:'https://saved.example'}));
  w.eval(read('account-cache.js'));w.LeadIntelServerBridge={ready:false};
  let dependencyPolls=0;w.setTimeout=(fn,ms)=>{if(ms===25)dependencyPolls++;return 0;};
  w.eval(read('discovery-ui.js'));w.eval(read('process-map.js'));
  assert.equal(dependencyPolls,0,'Discovery dependency polling must wait for verification');
  assert.equal(w.LeadIntelDiscoveryUI,undefined);assert.equal(w.LeadIntelJourney,undefined);
  assert.equal(w.document.getElementById('step-5'),null);
  w.dispatchEvent(new w.Event('leadintel:server-ready'));
  assert.equal(w.LeadIntelDiscoveryUI,undefined);assert.equal(w.LeadIntelJourney,undefined);
 }finally{w.close();}
});

test('the pure CRM migration mapper is available before optional support mounting',()=>{
 const source=read('shell-support-loader.js');
 assert.match(source,/^import '\.\/crm-engine\.js\?/m);
 assert.ok(source.indexOf("import './crm-engine.js?")<source.indexOf('async function loadSupportModules'));
 const engine=require('../crm-engine.js');assert.equal(typeof engine.mapLocalPipelineItemToCrm,'function');
});
test('profile controls retired before verification do not abort binding the remaining app',()=>{
 const w=new JSDOM(read('index.html'),{url:'https://leadintel.example/customer/',runScripts:'outside-only'}).window;
 try{
  w.LeadIntelAccountCache={afterVerification(){}};
  w.eval(read('app.js').replace(/^import .*$/gm,'')+'\nwindow.__bindApp=bind;');
  w.document.getElementById('improve-profile').remove();
  const next=w.document.getElementById('back-to-profile'),add=next.addEventListener.bind(next);let bound=0;
  next.addEventListener=(name,...args)=>{if(name==='click')bound++;return add(name,...args);};
  assert.doesNotThrow(()=>w.__bindApp());assert.equal(bound,1);
 }finally{w.close();}
});
