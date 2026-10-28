const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
test('pending, terminal-empty and successful phone results remain distinct after refresh',()=>{
 const contact={id:'contact',phone_number:null,phone_status:'pending'};
 for(const status of ['processing','pending_phone'])assert.equal(D.phoneLookupState(contact,[{contact_id:'contact',status}]),'pending_phone');
 for(const status of ['not_found','verified'])assert.equal(D.phoneLookupState(contact,[{contact_id:'contact',status}]),'not_found');
 assert.equal(D.phoneLookupState({...contact,phone_number:'+12025550142',phone_status:'Verified'},[{contact_id:'contact',status:'not_found'}]),'verified');
 assert.equal(D.phoneLookupState(contact,[{contact_id:'other',person_provider_id:'other',status:'not_found'}],'person'),'pending_phone');
});
test('Buyer Agent phone trace and request identifiers survive workspace and CRM save/reload',()=>{
 const trace={contactId:'contact',status:'pending',checkedAt:new Date().toISOString(),events:[{provider:'treg',status:'not_found',reason:'No number'},{provider:'apollo',status:'requested',reason:'pending_phone',requestId:'request-1'}]},candidate={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerDiscovery:{phoneEnrichment:trace},people:[]};
 const restored=D.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0];assert.equal(restored.buyerDiscovery.phoneEnrichment.status,'pending');assert.equal(restored.buyerDiscovery.phoneEnrichment.events[1].requestId,'request-1');
 const mapped=CRM.mapDiscoveryCandidateToCrm(restored);assert.equal(mapped.intelligence.research_snapshot.buyerResearch.discovery.phoneEnrichment.events[1].status,'requested');
});
test('actual phone Refresh reads CRM once and reports a completed empty result without requesting enrichment',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');let reads=0,toast='';
 const person={id:'apollo-fixture',name:'Alex Buyer'},context={LeadIntelDiscovery:D,discovery:{candidates:[{domain:'example.com',people:[person]}]},crmAuthenticated:()=>true,crmCompanyByDomain:()=>({id:'company'}),personKey:()=>person.id,enrichmentPending:new Set(),enrichmentResults:new Map(),renderCandidates(){},showToast:v=>toast=v,bridge:()=>({getCrmCompany:async()=>{reads++;return {ok:true,contacts:[{id:'contact',external_person_id:person.id,phone_number:null,phone_status:'Not found'}],phoneRequests:[{contact_id:'contact',status:'not_found'}]};}})};
 vm.createContext(context);const start=source.indexOf('async function refreshEnrichedContact('),end=source.indexOf('\n',start);vm.runInContext(source.slice(start,end),context);
 assert.equal(await context.refreshEnrichedContact(0,0),false);assert.equal(reads,1);assert.equal(context.enrichmentResults.get(person.id).request.status,'not_found');assert.match(toast,/finished without a valid number/);
});
