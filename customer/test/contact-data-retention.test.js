const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),P=require('../crm-presentation.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
test('retained paid data rehydrates without an aggregate research timestamp and survives browser normalization',()=>{
 const person={id:'klas',name:'Klas Nilsson',title:'Head of Procurement'},candidate={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[person]};
 const data={version:1,domain:'example.com',personId:'klas',identityName:'Klas Nilsson',checkedAt:'2026-10-21T18:00:00Z',status:'updated',profile:{status:'provider_reported',title:'Head of Procurement',city:'Stockholm'},phone:{status:'not_requested'},costMicro:14500,callIds:['saved-call']};
 const ctx={Date,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain};
 require('./helpers/crm-hydration-context.cjs')(ctx);
 vm.runInNewContext(source.slice(source.indexOf('function restoreNewerBuyerResearch('),source.indexOf('function hydrateLocalPipelineFromCrm(')),ctx);
 const detail={company:{id:'company',workspace_id:'hydration-workspace',normalized_domain:'example.com'},contactData:[data],intelligence:{research_snapshot:{buyerResearch:{buyers:[]}}}};
 assert.equal(ctx.restoreNewerBuyerResearch(candidate,detail),true);
 assert.equal(candidate.people[0],person,'company context restore must retain the active buyer owner reference');
 const stored=JSON.parse(JSON.stringify(D.normalizeDiscoveryState({selectedProspects:[candidate]}))),restored=D.normalizeDiscoveryState(stored).selectedProspects[0].people[0];
 assert.equal(restored.contactData.profile.city,'Stockholm');assert.equal(restored.contactData.status,'updated');assert.equal(restored.contactData.callIds[0],'saved-call');
 const wrong={...candidate,people:[{...person,name:'Someone Else',contactData:null}]};ctx.restoreNewerBuyerResearch(wrong,detail);assert.equal(wrong.people[0].contactData,null);
 ctx.restoreNewerBuyerResearch({...candidate,domain:'other.example',people:[{...person,contactData:null}]},detail);assert.equal(person.contactData.domain,'example.com');
});
test('retained CRM profiles stay visible even if the current public buyer roster is empty',()=>{
 const html=P.intelligenceHtml({research_snapshot:{buyerResearch:{buyers:[]}},contactData:[{version:1,identityName:'Klas Nilsson',status:'updated',checkedAt:'2026-10-21T18:00:00Z',profile:{status:'provider_reported',city:'Stockholm'},phone:{status:'not_requested'}}]});
 assert.match(html,/Retained contact profiles/);assert.match(html,/Klas Nilsson/);assert.match(html,/Stockholm/);
});

test('phone failure diagnostics survive normalized save and reload alongside retained number',()=>{const person={id:'buyer',name:'Anna Buyer',title:'Director',contactData:{version:1,domain:'example.com',personId:'buyer',identityName:'Anna Buyer',phone:{status:'provider_listed',number:'+37120000001'},lastAttempt:{status:'partial',phone:'error',phoneReason:'Treg usage limit reached'}}};const value=D.normalizeDiscoveryState({selectedProspects:[{domain:'example.com',company:'Example',buyerSearchMode:'user_selected_target',people:[person]}]});const restored=D.normalizeDiscoveryState(JSON.parse(JSON.stringify(value))).selectedProspects[0].people[0];assert.equal(restored.contactData.phone.number,'+37120000001');assert.equal(restored.contactData.lastAttempt.phoneReason,'Treg usage limit reached');});
