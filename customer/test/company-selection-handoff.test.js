const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Journey=require('../journey-progress.js');
const Discovery=require('../discovery-engine.js');
test('journey counts an explicitly selected company and its buyers without Pipeline',()=>{
 const model=Journey.buildJourneyModel({discovery:{pipeline:[],selectedProspects:[{domain:'target.example',people:[{name:'Buyer'}]}]}});const steps=[...model[3].steps,...model[4].steps];
 assert.equal(steps.find(row=>row.id==='pipeline').complete,true);assert.equal(steps.find(row=>row.id==='people').complete,true);
});
function scriptCompanies({shared=null,state={}}={}){
 const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
 const body=source.slice(source.indexOf('function pipeline(){'),source.indexOf('\nfunction selectedCandidate'));
 return vm.runInNewContext(`${body}\npipeline()`,{window:{LeadIntelDiscoveryUI:shared},discoveryState:()=>Discovery.normalizeDiscoveryState(state)});
}
test('Scripts selector uses explicit selected companies from the shared workspace API',()=>{
 const selected=[{domain:'selected.example',company:'Selected'}];const rows=scriptCompanies({shared:{getSelectedCompanies:()=>selected,getPipeline:()=>[]}});assert.equal(rows[0].domain,'selected.example');
});
test('Scripts reload fallback retains selected companies and deduplicates Pipeline domains',()=>{
 const rows=scriptCompanies({state:{pipeline:[{domain:'existing.example'}],selectedProspects:[{domain:'existing.example',buyerSearchMode:'user_selected_target'},{domain:'selected.example',buyerSearchMode:'user_selected_target'}]}});assert.equal(rows.length,2);assert.ok(rows.some(row=>row.domain==='selected.example'));
});
