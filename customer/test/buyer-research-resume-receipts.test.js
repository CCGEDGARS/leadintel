const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
test('the public UI runner carries source-read receipts into a resumed mandatory pass but resets them for a forced refresh',async()=>{
 for(const force of [false,true]){
  const receipt={url:'https://example.com/team',sourceRead:true,checkedAt:new Date().toISOString()},report={...D.createBuyerResearchAccountability(),officialPageReads:[receipt]};
  const owner={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:[{id:'ada',name:'Ada Andersson',title:'Procurement Director',organization:'Example'}],publicResearch:{accountability:report}};
  D.recordBuyerResearchTool(report,{provider:'direct',status:'succeeded',results:1});D.recordBuyerResearchTool(report,{provider:'direct',status:'succeeded',results:1});D.recordBuyerResearchTool(report,{provider:'direct',status:'failed',reason:'Earlier blocked page'});
  const currentReport=D.createBuyerResearchAccountability();D.recordBuyerResearchTool(currentReport,{provider:'direct',status:'succeeded',results:1});
  let incoming;
  const context={LeadIntelDiscovery:{...D,runMandatoryBuyerResearch:async(candidate,options)=>{incoming=JSON.parse(JSON.stringify(options.accountability));return D.runMandatoryBuyerResearch(candidate,options);}},canonicalDomain:D.canonicalDomain,Date,URL,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,PUBLIC_NAME_CHECK_VERSION:'test',
   discovery:{selectedProspects:[owner]},mainState:()=>({}),bridge:()=>({workspace:{id:'workspace'}}),confirmResearchedPublicEmails:async()=>{},crmAuthenticated:()=>false,saveDiscovery:()=>{},renderPipeline:()=>{},renderCandidates:()=>{},showToast:()=>{},searchBuyerPublicPages:async()=>[],fetchFirecrawlBuyerResearch:async()=>({ok:true,json:async()=>({data:{markdown:'Example official company website'}})}),reviewBuyerPublicEvidence:async()=>({status:'complete',conflicts:[]})};
  require('./helpers/dossier-boundary.cjs')(context);vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function runPublicProspectContacts('),source.indexOf('function scheduleSavedBuyerPublicChecks(')),context);
  await context.runPublicProspectContacts(owner.domain,{force,accountability:currentReport});assert.ok(incoming,'mandatory pass executes');
  assert.deepEqual(incoming.officialPageReads,force?[]:[receipt]);assert.equal(incoming.tools.find(row=>row.provider==='direct').succeeded,3,'retained actual calls and new phase calls are counted once');assert.equal(incoming.tools.find(row=>row.provider==='direct').failed,1);
  const saved=D.normalizeDiscoveryState({selectedProspects:[{...owner,buyerSearchMode:'user_selected_target'}]}).selectedProspects[0];assert.equal(saved.publicResearch.accountability.tools.find(row=>row.provider==='direct').succeeded,3);
  await context.runPublicProspectContacts(owner.domain,{force,accountability:currentReport});assert.equal(incoming.tools.find(row=>row.provider==='direct').succeeded,3,'sharing the already-merged report cannot add prior counts twice');
 }
});
