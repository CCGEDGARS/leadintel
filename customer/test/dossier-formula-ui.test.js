const {test}=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const D=require('../company-dossier.js'),UI=require('../company-dossier-ui.js'),Discovery=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
const context={formulas:['"Example" procurement','"Example" expansion']},company={company:'Example',domain:'example.com',...context},plan=D.researchPlan(company),stamp=new Date().toISOString();
function pass(provider,failed=false){return {provider,webSearch:true,status:failed?'partial':'complete',planSignature:plan.signature,sources:['https://example.com/team'],searchFamilies:plan.families.map((f,i)=>({...f,query:f.formula?'Context\nSearch formula: '+f.formula+'\nEnd':f.kind==='contacts'?'CONTACT ROUTES Example':'CURRENT LEADERSHIP AND PROJECT DOSSIER Example',status:failed&&i===3?'failed':'complete',attempts:1,startedAt:stamp,completedAt:stamp,results:[{url:'https://example.com/team'}],reason:failed&&i===3?'Search unavailable':''})),people:[{name:'Alex Smith',title:'Procurement Director',sourceUrl:'https://example.com/team',quote:'Alex Smith is Procurement Director',status:'current'}],facts:[],channels:[],gaps:[]};}
function dossier(failed=false){return D.reconcile([pass('openai'),pass('gemini',failed)],company);}
test('formula progress renders actual per-provider queries and remains escaped',()=>{
 const value=dossier(true);value.passes[1].searchFamilies[0].query+=' <img src=x onerror=alert(1)>';
 const dom=new JSDOM(UI.render({company:company.company,domain:company.domain,buyerDiscovery:{companyDossier:value}})),doc=dom.window.document;
 assert.match(doc.body.textContent,/Search plan and progress/);assert.match(doc.body.textContent,/OpenAI.*4\/4/);assert.match(doc.body.textContent,/Gemini.*3\/4/);assert.match(doc.body.textContent,/1 failed/);assert.match(doc.body.textContent,/<img src=x/);assert.equal(doc.querySelector('img'),null);dom.window.close();
});
test('failed refresh keeps prior sourced people and saves latest formula coverage through CRM reload',async()=>{
 const prior=dossier(),candidate={company:company.company,domain:company.domain,buyerSearchMode:'user_selected_target',buyerDiscovery:{companyDossier:prior}};let saves=0;
 await assert.rejects(UI.research(candidate,context,{force:true,persist:()=>saves++,request:async()=>dossier(true)}),/incomplete/);
 assert.equal(candidate.buyerDiscovery.companyDossier.people[0].name,'Alex Smith');assert.equal(saves,1);
 const normalized=Discovery.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0];
 const stored=CRM.mapDiscoveryCandidateToCrm(normalized).intelligence.research_snapshot.buyerResearch.discovery.companyDossier;
 assert.equal(stored.lastAttempt.research.coverage.providers.find(p=>p.provider==='gemini').completed,3);
 assert.match(UI.render(normalized),/3\/4/);
});
test('legacy completed flags never skip remote research for an unrecorded formula plan',async()=>{
 const prior=dossier();delete prior.plan;delete prior.coverage;
 const candidate={company:company.company,domain:company.domain,buyerSearchMode:'user_selected_target',buyerDiscovery:{companyDossier:prior}};let calls=0;
 await UI.research(candidate,context,{request:async()=>{calls++;return dossier();}});assert.equal(calls,1);
});
test('source diagnostics distinguish cached evidence from actual extractor failures',()=>{
 const value=dossier(true);value.passes[1].sourceReads=[{url:'https://example.com/team',checkedAt:stamp,status:'failed',reused:true,researchTrace:[{provider:'scrapling',operation:'extract',status:'failed',results:0,failureKind:'authentication',code:'SCRAPLING_AUTH_FAILED',httpStatus:401,elapsedMs:100,timeoutMs:15000}]}];
 const dom=new JSDOM(UI.render({domain:company.domain,buyerDiscovery:{companyDossier:value}}));assert.match(dom.window.document.body.textContent,/Source extraction details/);assert.match(dom.window.document.body.textContent,/Reused source/);assert.match(dom.window.document.body.textContent,/Scrapling.*401/);dom.window.close();
});
test('refresh retries resume a matching incomplete plan instead of discarding successful searches',async()=>{
 for(const existing of [dossier(true),{...dossier(),lastAttempt:{reason:'incomplete',research:dossier(true)}}]){
  const candidate={company:company.company,domain:company.domain,buyerDiscovery:{companyDossier:existing}};let sent;
  await UI.research(candidate,context,{force:true,request:async body=>{sent=body;return dossier();}});assert.equal(sent.force,false);
 }
});
test('explicit refresh restarts an exhausted partial plan when no URLs or supported evidence were found',async()=>{
 for(const emptyResults of [true,false]){
  const existing=dossier(true);for(const p of existing.passes){p.status='partial';p.people=[];p.facts=[];p.channels=[];p.sources=[];p.extractedSources=emptyResults?[]:['https://example.com/team'];for(const f of p.searchFamilies){f.status='complete';f.results=emptyResults?[]:[{url:'https://example.com/team'}];}}
  const candidate={company:company.company,domain:company.domain,buyerDiscovery:{companyDossier:existing}};let sent;
  await UI.research(candidate,context,{force:true,request:async body=>{sent=body;return dossier();}});assert.equal(sent.force,true);
 }
});
