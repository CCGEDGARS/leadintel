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
 const person={id:'apollo-fixture',name:'Alex Buyer'},context={LeadIntelDiscovery:D,discovery:{candidates:[{domain:'example.com',people:[person]}]},crmAuthenticated:()=>true,crmCompanyByDomain:()=>({id:'company'}),personKey:()=>person.id,enrichmentPending:new Set(),enrichmentResults:new Map(),renderCandidates(){},showToast:v=>toast=v,bridge:()=>({getCrmCompany:async()=>{reads++;return {ok:true,contacts:[{id:'contact',name:person.name,external_person_id:person.id,phone_number:null,phone_status:'Not found'}],phoneRequests:[{contact_id:'contact',status:'not_found'}]};}})};
 const stable=context.bridge();context.bridge=()=>stable;require('./helpers/buyer-action-context.cjs').prepare(context,context.discovery.candidates[0]);vm.createContext(context);const start=source.indexOf('async function refreshEnrichedContact('),end=source.indexOf('async function saveCandidate(',start);vm.runInContext(require('./helpers/buyer-action-context.cjs').source+source.slice(start,end),context);
 assert.equal(await context.refreshEnrichedContact(0,0),false);assert.equal(reads,1);assert.equal(context.enrichmentResults.get(person.id).request.status,'not_found');assert.match(toast,/finished without a valid number/);
});
test('explicit phone linkage restores a public buyer without matching a different namesake',()=>{
 const person={id:'public-alex',name:'Alex Buyer',linkedin_url:'https://linkedin.com/in/alex-a'},detail={contacts:[{id:'contact',external_person_id:'apollo-alex',name:'Alex Buyer',phone_number:'+12025550142'}],intelligence:{research_snapshot:{buyerResearch:{discovery:{phoneEnrichment:{contactId:'contact',personId:'public-alex',identityName:'Alex Buyer',identityLinkedinUrl:person.linkedin_url,events:[]}}}}}};
 assert.equal(D.buyerPhoneContact(detail,person).phone_number,'+12025550142');assert.equal(D.buyerPhoneContact(detail,{...person,linkedin_url:'https://linkedin.com/in/alex-b'}),null);assert.equal(D.buyerPhoneContact(detail,{...person,id:'another-buyer'}),null);
});
test('callback trace refreshes even when the underlying company research timestamp is unchanged',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),now=new Date().toISOString(),old={contactId:'contact',status:'pending',checkedAt:now,events:[{provider:'apollo',status:'requested',requestId:'request'}]},candidate={domain:'example.com',people:[],buyerDiscovery:{checkedAt:now,phoneEnrichment:old}},detail={company:{id:'company',workspace_id:'hydration-workspace',normalized_domain:'example.com'},intelligence:{research_snapshot:{buyerResearch:{checkedAt:now,buyers:[],discovery:{phoneEnrichment:{...old,status:'available',events:[{provider:'apollo',status:'available',requestId:'request'}]}}}}}};
 const context={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain};require('./helpers/crm-hydration-context.cjs')(context);vm.createContext(context);const start=source.indexOf('function restoreNewerBuyerResearch('),end=source.indexOf('async function refreshCrmState(',start);vm.runInContext(source.slice(start,end),context);assert.equal(context.restoreNewerBuyerResearch(candidate,detail),true);assert.equal(candidate.buyerDiscovery.phoneEnrichment.status,'available');
});
test('email-only contacts never manufacture a pending Apollo phone request',()=>{
 for(const contact of [null,{id:'email-only',phone_status:'Not requested'},{id:'email-only',phone_status:'Unknown'}])assert.equal(D.phoneLookupState(contact,[]),'not_requested');
 assert.equal(D.phoneLookupState({id:'c'},[{contact_id:'c',status:'failed'}]),'failed');
});
test('phone card distinguishes public research from a pending or failed paid lookup',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 const context={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,esc:v=>String(v),emailPatternCandidates:()=>[]};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function buyerContactRows('),source.indexOf('function emailPatternCandidates(')),context);
 const person={id:'alex',name:'Alex Buyer',contactResearch:{channels:{phone:{status:'complete'}}}},candidate={domain:'example.com'};
 const pending=context.buyerContactRows(person,candidate,{request:{status:'pending_phone'}});
 assert.match(pending,/Phone lookup pending/);assert.doesNotMatch(pending,/No direct phone found in completed searches/);
 assert.match(pending,/Public-source searches completed without a direct phone/);
 const failed=context.buyerContactRows(person,candidate,{request:{status:'failed'}});assert.match(failed,/Phone lookup failed/);assert.doesNotMatch(failed,/data-contact-channel="phone" data-contact-status="not_found"/);
 const empty=context.buyerContactRows(person,candidate,{request:{status:'not_found'}});assert.match(empty,/Apollo completed without a usable direct phone/);assert.doesNotMatch(empty,/Phone lookup pending/);
});
test('Confirm phone with an existing pending Apollo request refreshes its ledger before Treg routing',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');let reads=0,paid=0;
 const person={id:'alex-public',name:'Alex Buyer'},candidate={domain:'example.com',people:[person]},results=new Map([['alex-public',{request:{status:'pending_phone'}}]]),b={workspace:{id:'workspace'},getCrmCompany:async()=>{reads++;return {ok:true,contacts:[{id:'crm',name:person.name,external_person_id:person.id}],phoneRequests:[{contact_id:'crm',status:'not_found'}]};}};
 const context={LeadIntelDiscovery:D,crmAuthenticated:()=>true,bridge:()=>b,crmCompanyByDomain:()=>({id:'company'}),personKey:()=>person.id,enrichmentResults:results,enrichmentPending:new Set(),renderAll(){},showToast(){},window:{LeadIntelAdditionalContacts:{policy:()=>({provider:'treg'}),confirm:()=>{paid++;}}}};
 require('./helpers/buyer-action-context.cjs').prepare(context,candidate);vm.createContext(context);vm.runInContext(require('./helpers/buyer-action-context.cjs').source+source.slice(source.indexOf('async function confirmBuyerContact('),source.indexOf('async function refreshEnrichedContact(')),context);
 assert.equal(await context.confirmBuyerContact(candidate,0,{kind:'phone'}),true);assert.equal(reads,1);assert.equal(paid,0);assert.equal(results.get(person.id).request.status,'not_found');
});
