const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const isolation=require('../workspace-isolation.js');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const discovery=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

function readSite(original,entered){
  const source=app.match(/function readSources\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source,'readSources exists');
  const state={website:original,profile:{companyName:'Ercon'},approved:true,market:{strategyApproved:true}};
  const calls={clear:0,invalidate:0,save:0};
  const context={state,localStorage:{},LeadIntelProfile:{normalizeUrl:isolation.normalizeUrl},window:{LeadIntelWorkspaceIsolation:{...isolation,clearDerivedWorkspaceData(){calls.clear++;}}},$:(id)=>id==='company-website'?{value:entered}:{value:''},saveState(){calls.save++;},invalidateStrategicOutputs(){calls.invalidate++;state.profile=null;state.approved=false;}};
  vm.runInNewContext(`${source}\nreadSources();`,context);
  return {state,calls};
}

test('sidebar reads Ercon URL variants without erasing profile, strategy or discovery',()=>{
  const {state,calls}=readSite('https://www.ercon.lv/','ercon.lv');
  assert.equal(state.website,'https://www.ercon.lv/');
  assert.equal(state.approved,true);
  assert.equal(state.market.strategyApproved,true);
  assert.equal(calls.clear,0);
  assert.equal(calls.invalidate,0);
  assert.equal(calls.save,1);
});

test('a deliberate change to a different business website still clears prior business intelligence',()=>{
  const {state,calls}=readSite('https://www.ercon.lv/','other-company.se');
  assert.equal(state.website,'https://other-company.se/');
  assert.equal(calls.clear,1);
  assert.equal(calls.invalidate,1);
});

test('editing an approved company website waits for a committed change before updating the workspace',()=>{
  assert.match(app,/if\(state\.profile&&window\.LeadIntelWorkspaceIsolation\?\.canonicalDomain\(state\.website\)!==window\.LeadIntelWorkspaceIsolation\?\.canonicalDomain\(\$\("company-website"\)\.value\)\)return;/);
  assert.match(app,/\$\("company-website"\)\.addEventListener\("change",readSources\)/);
});

test('old discovery fingerprint with equivalent website does not invalidate search results',()=>{
  const source=discovery.match(/function sameStrategyFingerprint\(previous,current\)\{[^\n]+\}/)?.[0];
  assert.ok(source);
  const context={canonicalDomain:isolation.canonicalDomain};
  vm.runInNewContext(source,context);
  const before=JSON.stringify({company:'Ercon',website:'https://www.ercon.lv/',approved:'approved',icps:[],signals:[],opps:[]});
  const same=JSON.stringify({company:'Ercon',website:'ercon.lv',approved:'approved',icps:[],signals:[],opps:[]});
  assert.equal(context.sameStrategyFingerprint(before,same),true);
  assert.equal(context.sameStrategyFingerprint(before,JSON.stringify({...JSON.parse(same),approved:'changed'})),false);
});
