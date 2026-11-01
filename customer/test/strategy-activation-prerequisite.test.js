const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../market-engine.js');
const ready=()=>({website:'https://seller.example',targetMarkets:['Sweden'],profile:{},approved:true});
test('switch prerequisites identify the exact earlier task without changing state',()=>{
 const cases=[[{...ready(),website:''},true,'company-website',1],[{...ready(),targetMarkets:[]},true,'custom-target-market',1],[{...ready(),profile:null},true,'analyze-company',2],[ready(),false,'confirm-targeting',2],[{...ready(),approved:false},true,'approve-profile',3]];
 for(const [s,confirmed,id,step] of cases){const before=JSON.stringify(s),r=M.strategyActivationRequirement(s,confirmed);assert.equal(r.id,id);assert.equal(r.step,step);assert.equal(r.available,false);assert.equal(JSON.stringify(s),before);}
 assert.equal(M.strategyActivationRequirement(ready(),true),null);
});
const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const part=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
test('actual signal switch stays off and points to the unfinished earlier step',()=>{
 const handler=app.match(/\$\("signal-designer"\)\.addEventListener\("change",event=>\{(.+)\}\);/)[1];
 const toggle={checked:true},state={...ready(),approved:false};let pointed,reads=0;
 vm.runInNewContext('(function(){'+handler+'})()',{event:{target:{closest:()=>toggle}},state,LeadIntelMarket:M,LeadIntelTargeting:{isConfirmed:()=>true},pointToStrategyRequirement:r=>pointed=r,readMarketEdits:()=>reads++,renderIcps(){},renderSignalDesigner(){},renderResearchControls(){},renderMonitoringControls(){}});
 assert.equal(toggle.checked,false);assert.equal(reads,0);assert.equal(pointed.id,'approve-profile');
});
test('upstream ICP gate focuses the prerequisite and saves no On or later automatic activation',()=>{
 const dom=new JSDOM('<input type="checkbox" data-icp-field="active" data-index="0" checked>');
 const state={...ready(),approved:false,market:{icps:[{id:'core',type:'core',active:false,requestedActive:false}],signals:[]}};let pointed;
 const scope={state,document:dom.window.document,window:{},LeadIntelMarket:M,LeadIntelTargeting:{isConfirmed:()=>true,focusControl:(_,task)=>pointed=task},readMarketEdits:()=>{},saveState:()=>{},renderIcps:()=>{}};
 vm.createContext(scope);vm.runInContext(part('function icpActivationRequirement(','function enforceIcpActivationRequirements(){')+part('function pointToStrategyRequirement(','function renderSignalDesigner(){'),scope);
 scope.requestIcpActivation('core');assert.equal(state.market.icps[0].requestedActive,false);assert.equal(state.market.icps[0].active,false);assert.equal(pointed.id,'approve-profile');assert.equal(dom.window.document.querySelector('input').checked,false);
});
test('one ready reference forces Lookalike on even when its old preference was off, and is stable after reload',()=>{
 const state={market:{icps:[{id:'icp-reference-lookalike',type:'lookalike-led',active:false,requestedActive:false}]}};
 const scope={state,saveState(){},icpActivationRequirement:()=>({available:true})};vm.createContext(scope);vm.runInContext(part('function enforceIcpActivationRequirements(){','function readMarketEdits('),scope);
 scope.enforceIcpActivationRequirements();assert.equal(state.market.icps[0].active,true);assert.equal(state.market.icps[0].requestedActive,true);
 scope.state=JSON.parse(JSON.stringify(state));scope.enforceIcpActivationRequirements();assert.equal(scope.state.market.icps[0].active,true);
 scope.icpActivationRequirement=()=>({available:false});scope.enforceIcpActivationRequirements();assert.equal(scope.state.market.icps[0].active,false);assert.equal(scope.state.market.icps[0].requestedActive,false);
});
test('reference activation requires at least one company, never an empty active wrapper',()=>{
 const L=require('../lookalike-discovery.js');
 assert.equal(L.syncReferenceLookalikeIcp([],{}, {active:true,dna:{active:true,activeCount:0}})[0].active,false);
 for(const name of ['Medical services','Industrial equipment']){
  const model={active:true,dna:{active:true,activeCount:1,referenceProfiles:[{companyName:name}]}};
  const lens=L.syncReferenceLookalikeIcp([{id:'icp-reference-lookalike',active:false,requestedActive:false}],{},model)[0];assert.equal(lens.active,true);assert.equal(lens.referenceCount,1);
 }
});
