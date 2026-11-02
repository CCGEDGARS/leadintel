const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../company-dossier.js'),Discovery=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
const plan=D.researchPlan({});
const pass={planSignature:plan.signature,searchFamilies:[{name:'leadership',kind:'leadership',query:'CURRENT LEADERSHIP AND PROJECT DOSSIER',status:'complete',attempts:1,completedAt:'2026-10-21T12:00:00Z'},{name:'contacts',kind:'contacts',query:'CONTACT ROUTES',status:'complete',attempts:1,completedAt:'2026-10-21T12:00:00Z'}],provider:'openai',webSearch:true,status:'complete',people:[{name:'Alex Smith',title:'Procurement Director',sourceUrl:'https://example.com/team',quote:'Alex Smith is Procurement Director',status:'current'}],facts:[],channels:[],sources:['https://example.com/team'],gaps:[]};
const dossier=D.reconcile([pass,{...pass,provider:'gemini'}],{company:'Example',domain:'example.com'});
test('workspace and CRM snapshots retain independent research and conflict evidence',()=>{const candidate={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerDiscovery:{companyDossier:dossier}};const n=Discovery.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0];assert.equal(n.buyerDiscovery.companyDossier.status,'complete');assert.equal(CRM.mapDiscoveryCandidateToCrm(n).intelligence.research_snapshot.buyerResearch.discovery.companyDossier.passes.length,2);});
test('dossier UI renders above buyers without elevating departmental email to buyer',()=>{const UI=require('../company-dossier-ui.js');const html=UI.render({domain:'example.com',company:'Example',buyerDiscovery:{companyDossier:dossier}});assert.match(html,/Company dossier/);assert.match(html,/OpenAI/);assert.match(html,/Gemini/);assert.doesNotMatch(html,/Email confirmed/);});
test('late results cannot mutate a replaced workspace and failed refresh preserves prior',async()=>{const UI=require('../company-dossier-ui.js'),candidate={company:'Example',domain:'example.com',buyerDiscovery:{companyDossier:dossier}};let current=true;await assert.rejects(UI.research(candidate,{},{isCurrent:()=>current,request:async()=>{current=false;return dossier},force:true}));assert.equal(candidate.buyerDiscovery.companyDossier,dossier);await assert.rejects(UI.research(candidate,{},{isCurrent:()=>true,request:async()=>{throw Error('Provider unavailable')},force:true}));assert.equal(candidate.buyerDiscovery.companyDossier.people[0].name,'Alex Smith');assert.equal(candidate.buyerDiscovery.companyDossier.lastAttempt.status,'failed');});
test('research settings offer all three providers and an automatic second selection',()=>{const UI=require('../company-dossier-ui.js');const html=UI.settingsHtml(['openai','anthropic','gemini'].map(provider=>({provider,configured:true})),{});for(const p of ['openai','anthropic','gemini'])assert.ok(html.includes('value="'+p+'"'));assert.match(html,/Second researcher/);assert.match(html,/Automatic/);});
test('HTTP success with incomplete research preserves the last successful dossier',async()=>{const UI=require('../company-dossier-ui.js'),candidate={company:'Example',domain:'example.com',buyerDiscovery:{companyDossier:dossier}};const partial=D.reconcile([],{company:'Example',domain:'example.com'});await assert.rejects(UI.research(candidate,{},{isCurrent:()=>true,request:async()=>partial,force:true}));assert.equal(candidate.buyerDiscovery.companyDossier.people[0].name,'Alex Smith');assert.equal(candidate.buyerDiscovery.companyDossier.lastAttempt.status,'failed');});
test('formula receipts and failed latest coverage survive workspace normalization and CRM save/reload',()=>{
 const company={company:'Example',domain:'example.com',seller:{offer:'Training'},formulas:['"Example" learning programme','"Example" supplier registration']},plan=D.researchPlan(company);
 const families=[...pass.searchFamilies,{name:'formula-1',kind:'formula',query:'Independent grounded search\nSearch formula: "Example" learning programme\nReturn actual source URLs.',status:'complete',attempts:1,completedAt:'2026-10-21T12:00:00Z',results:[{url:'https://example.com/team'}]},{name:'formula-2',kind:'formula',query:'Independent grounded search\nSearch formula: "Example" supplier registration\nReturn actual source URLs.',status:'failed',attempts:2,completedAt:'2026-10-21T12:00:00Z',reason:'web_search: provider HTTP 429',results:[{url:'javascript:alert(1)'},{url:'https://example.com/suppliers'}]}];
 const partial=D.reconcile(['openai','gemini'].map(provider=>({...pass,provider,status:'partial',planSignature:plan.signature,searchFamilies:families,extractedSources:['https://example.com/team']})),company);
 const retained={...dossier,lastAttempt:{status:'failed',checkedAt:partial.checkedAt,reason:'Required searches incomplete',research:partial}};
 const normalized=Discovery.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',buyerDiscovery:{companyDossier:retained}}]}).selectedProspects[0];
 const crm=JSON.parse(JSON.stringify(CRM.mapDiscoveryCandidateToCrm(normalized))),saved=crm.intelligence.research_snapshot.buyerResearch.discovery.companyDossier,last=saved.lastAttempt.research;
 assert.equal(saved.people[0].name,'Alex Smith');assert.equal(last.status,'partial');assert.equal(last.plan.formulas.length,2);assert.equal(last.coverage.providers[0].completed,3);assert.equal(last.coverage.providers[0].failed,1);assert.equal(last.passes[0].searchFamilies[3].attempts,2);assert.deepEqual(last.passes[0].searchFamilies[3].results,[{url:'https://example.com/suppliers'}]);assert.equal(last.passes[0].extractedSources[0],'https://example.com/team');
});
test('browser continues checkpointed provider requests automatically without forcing a repeated pass',async()=>{
 const candidate={company:'Example',domain:'example.com'},company={company:'Example',domain:'example.com',seller:{},roles:[],opportunity:'',formulas:[]};let calls=0;const requests=[];
 const D=require('../company-dossier.js'),UI=require('../company-dossier-ui.js');
 const partial=D.reconcile([] ,company);partial.contextKey=D.contextKey(company);
 await assert.rejects(UI.research(candidate,{}, {request:async body=>{requests.push(body);calls++;return {...partial,continuation:calls===1};}}),/incomplete/);
 assert.equal(calls,2);assert.equal(requests[0].incremental,true);assert.equal(requests[1].force,false);assert.ok(candidate.buyerDiscovery.companyDossier.lastAttempt);
});
test('incremental refresh preserves a completed dossier at every save when the next provider request fails',async()=>{
 const UI=require('../company-dossier-ui.js'),partial=D.reconcile([pass],{company:'Example',domain:'example.com'});
 for(const fromServer of [false,true]){
  const candidate={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerDiscovery:{companyDossier:fromServer?partial:dossier}},saved=[];let calls=0;
  await assert.rejects(UI.research(candidate,{}, {force:true,persist:()=>saved.push(JSON.parse(JSON.stringify(candidate))),request:async()=>{if(++calls===2)throw Error('Second provider unavailable');return {...partial,continuation:true,...(fromServer?{previousSuccessful:dossier}:{})};}}),/Second provider unavailable/);
  assert.equal(calls,2);assert.ok(saved.length>=2);
  for(const snapshot of [...saved,candidate]){
   const restored=Discovery.normalizeDiscoveryState({selectedProspects:[snapshot]}).selectedProspects[0];
   assert.equal(restored.buyerDiscovery.companyDossier.status,'complete');
   assert.equal(restored.buyerDiscovery.companyDossier.passes.length,2);
   assert.equal(restored.buyerDiscovery.companyDossier.people[0].name,'Alex Smith');
   assert.equal(restored.buyerDiscovery.companyDossier.lastAttempt.research.passes[0].provider,'openai');
   const crm=CRM.mapDiscoveryCandidateToCrm(restored).intelligence.research_snapshot.buyerResearch.discovery.companyDossier;
   assert.equal(crm.passes.length,2);assert.equal(crm.lastAttempt.research.passes[0].provider,'openai');
  }
 }
});
test('a completed continuation replaces retained evidence and clears the incomplete attempt',async()=>{
 const UI=require('../company-dossier-ui.js'),company={company:'Example',domain:'example.com'},candidate={...company,buyerDiscovery:{companyDossier:dossier}};
 const revised={...pass,people:[{...pass.people[0],name:'Jamie Buyer',quote:'Jamie Buyer is Procurement Director'}]},partial=D.reconcile([revised],company),complete=D.reconcile([revised,{...revised,provider:'gemini'}],company),saved=[];let calls=0;
 const result=await UI.research(candidate,{}, {force:true,persist:()=>saved.push(JSON.parse(JSON.stringify(candidate.buyerDiscovery.companyDossier))),request:async()=>++calls===1?{...partial,continuation:true}:complete});
 assert.equal(saved[0].people[0].name,'Alex Smith');assert.ok(saved[0].lastAttempt);
 assert.equal(calls,2);assert.equal(result.status,'complete');assert.equal(candidate.buyerDiscovery.companyDossier.people[0].name,'Jamie Buyer');assert.equal(candidate.buyerDiscovery.companyDossier.lastAttempt,null);
});
test('a continuation cannot restore a previous successful dossier from another seller context',async()=>{
 const UI=require('../company-dossier-ui.js'),context={seller:{offer:'Different offer'}},partial=D.reconcile([pass],{company:'Example',domain:'example.com',...context}),candidate={company:'Example',domain:'example.com'};let calls=0;
 await assert.rejects(UI.research(candidate,context,{request:async()=>{if(++calls===2)throw Error('Second provider unavailable');return {...partial,previousSuccessful:dossier,continuation:true};}}),/Second provider unavailable/);
 assert.equal(candidate.buyerDiscovery.companyDossier.contextKey,partial.contextKey);assert.equal(candidate.buyerDiscovery.companyDossier.status,'partial');assert.equal(candidate.buyerDiscovery.companyDossier.passes.length,1);
});
