const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Journey=require('../journey-progress.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../process-map.js'),'utf8');
const availabilityFunction=source.slice(source.indexOf('function stageAvailability(){'),source.indexOf('function currentProcessStep(){'));
function availability(main,previous=false){const context={readProcessState:()=>main,contextReady:()=>true,window:{LeadIntelWorkspaceIsolation:{hasPreviousDiscovery:()=>previous}},localStorage:{},hasPipelineOpportunity:()=>false,hasOutreachContent:()=>false};vm.createContext(context);return vm.runInContext(availabilityFunction+'stageAvailability()',context);}
test('saved target research remains reachable before profile approval',()=>{
  const result=availability({profile:{},approved:false,targetCompanies:[{companyName:'Sandvik'}]});
  assert.equal(result[4],true);assert.equal(result[5],true);assert.equal(result[6],false);assert.equal(result[7],false);
  assert.equal(availability({profile:{},approved:false},true)[5],true);
});
test('selected target enables Buyers without falsely qualifying the company',()=>{
  const model=Journey.buildJourneyModel({currentStep:3,availability:{5:true},discovery:{selectedProspects:[{domain:'home.sandvik'}]}});
  assert.equal(model.find(stage=>stage.id===5).available,true);
  assert.equal(model.find(stage=>stage.id===6).available,false);
});
