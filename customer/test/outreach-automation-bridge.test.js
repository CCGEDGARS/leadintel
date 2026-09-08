const test=require('node:test');
const assert=require('node:assert/strict');

const path=require('node:path');
const modulePath=path.join(__dirname,'..','outreach-automation-bridge.js');

test('automation bridge exposes policy status save and enqueue methods with workspace credentials',async()=>{
  const calls=[];
  const root={
    LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'w1'}},
    fetch:async(url,options={})=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({policy:{mode:'manual'}})};},
    addEventListener(){}
  };
  delete require.cache[require.resolve(modulePath)];
  const api=require(modulePath);api.attach(root);
  const bridge=root.LeadIntelServerBridge;
  for(const name of ['getOutreachAutomationPolicy','saveOutreachAutomationPolicy','getOutreachAutomationStatus','enqueueOutreachAutomation'])assert.equal(typeof bridge[name],'function');
  await bridge.getOutreachAutomationPolicy();
  await bridge.saveOutreachAutomationPolicy({mode:'automatic',enabled:true});
  await bridge.getOutreachAutomationStatus();
  await bridge.enqueueOutreachAutomation({approved:true,domain:'example.com'});
  assert.equal(calls.length,4);
  assert.match(calls[0].url,/\/api\/outreach-automation\/policy\?workspace_id=w1$/);
  assert.equal(calls[1].options.method,'PUT');assert.equal(calls[1].options.credentials,'include');
  assert.match(calls[2].url,/\/api\/outreach-automation\/status\?workspace_id=w1$/);
  assert.match(calls[3].url,/\/api\/outreach-automation\/sequences\?workspace_id=w1$/);assert.equal(calls[3].options.method,'POST');
});

test('automation bridge fails closed when not signed in or no workspace is selected',async()=>{
  const root={LeadIntelServerBridge:{session:{authenticated:false},workspace:null},fetch:async()=>{throw new Error('must not fetch');},addEventListener(){}};
  delete require.cache[require.resolve(modulePath)];const api=require(modulePath);api.attach(root);
  const result=await root.LeadIntelServerBridge.getOutreachAutomationPolicy();assert.equal(result.ok,false);assert.equal(result.status,401);
});
