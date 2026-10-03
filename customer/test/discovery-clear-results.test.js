const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../discovery-engine.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../discovery-ui.js'),'utf8');
const handler=source.slice(source.indexOf('function clearCompanySearchResults(){'),source.indexOf('function moduleReady()'));
function fixture(confirm=true,status='complete'){
 const original={status,candidates:[{company:'Old'}],potentialMatches:[{company:'Rejected'}],selectedProspects:[{company:'Selected'}],rawResults:[{url:'https://old.example'}],pipeline:[{company:'Saved',domain:'saved.example',website:'https://saved.example',stage:'Qualified'}],lastRunAt:'2026-10-03'};
 const c={discovery:original,LeadIntelDiscovery:engine,window:{confirm:()=>confirm},showToast:()=>{},loadMeta:()=>({targetCount:5,fingerprint:'keep',lastCompanyRun:{}}),saveMeta:m=>c.meta=m,saveDiscovery:()=>c.saved=JSON.parse(JSON.stringify(c.discovery)),renderAll:()=>{},enrichmentResults:new Map(),enrichmentPending:new Set(),selectedBuyerEnrichment:new Set(),automaticPublicChecks:new Set()};
 vm.createContext(c);vm.runInContext(handler,c);return c;
}
test('clear removes research and unsaved selections, preserves CRM pipeline and settings across reload',()=>{
 const c=fixture();assert.equal(c.clearCompanySearchResults(),true);
 const reloaded=engine.normalizeDiscoveryState(c.saved);
 for(const key of ['candidates','potentialMatches','selectedProspects','rawResults','queries'])assert.equal(reloaded[key].length,0);
 assert.equal(reloaded.pipeline[0].domain,'saved.example');assert.equal(reloaded.lastRunAt,'');assert.equal(reloaded.needsRefresh,false);
 assert.equal(c.meta.targetCount,5);assert.equal(c.meta.fingerprint,'keep');assert.equal(c.meta.lastCompanyRun,undefined);
});
test('cancel and active company search leave state untouched',()=>{
 for(const c of [fixture(false),fixture(true,'running')]){const original=c.discovery;assert.equal(c.clearCompanySearchResults(),false);assert.equal(c.discovery,original);assert.equal(c.saved,undefined);}
});
test('clear button is present and bound',()=>{assert.match(source,/id="clear-company-results">Clear search results/);assert.match(source,/"clear-company-results"\)\?\.addEventListener\("click",clearCompanySearchResults\)/);});
