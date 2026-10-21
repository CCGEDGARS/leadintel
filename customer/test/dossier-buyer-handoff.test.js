const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../company-dossier.js'),Discovery=require('../discovery-engine.js');
const url='https://example.com/news/project-organisation';
const quote='Project delivery areas are changing. Area Directors will have full authority and report directly to the CEO. '+('Delivery work continues. '.repeat(30))+'The appointed Area Directors are Ada Morgan for Green Steel, Bela Novak for Green Iron and Chris Vale for Balance of Plant.';
const person={name:'Ada Morgan',title:'Area Director, Green Steel',status:'current',sourceUrl:url,quote};
const pass=D.validatePass({provider:'openai',webSearch:true,people:[person]},[{url,text:quote}],{company:'Example',domain:'example.com'});
const dossier=D.reconcile([pass,{...pass,provider:'gemini'}],{company:'Example',domain:'example.com'});
const candidate={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerDiscovery:{companyDossier:dossier}};
const rows=[{url,markdown:quote,sourceRead:true}];
test('shared dossier authority and role survive contact validation and workspace reload',()=>{
  const buyer=D.buyers(dossier,'Example')[0];assert.ok(quote.indexOf(buyer.name)>800);
  const checked=Discovery.matchBuyerRoleEvidence(buyer,rows,candidate,{complete:true});
  assert.equal(checked.roleReview?.status,'supported');
  const saved=Discovery.normalizeDiscoveryState({selectedProspects:[{...candidate,people:[checked]}]}).selectedProspects[0];
  assert.equal(Discovery.isExecutiveBuyer(saved.people[0]),true);
  assert.equal(Discovery.qualifyBuyer(saved.people[0],{decisionMakers:'Executive leadership'},saved).eligible,true);
});
test('dossier role support requires matching identity, title, underlying text and no hold',()=>{
  const buyer=D.buyers(dossier,'Example')[0];
  for(const [p,r,c] of [
    [{...buyer,title:'CEO'},rows,candidate],
    [{...buyer,name:'Other Person',publicName:'Other Person'},rows,candidate],
    [buyer,[{url,description:quote,evidenceKind:'model_summary'}],candidate],
    [buyer,[{url,markdown:'Different source content.',sourceRead:true}],candidate],
    [buyer,rows,{...candidate,buyerDiscovery:{companyDossier:{...dossier,conflicts:[{name:buyer.name}]}}}],
    [buyer,rows,{...candidate,buyerDiscovery:{companyDossier:{...dossier,people:[{...person,status:'departed'}]}}}],
    [buyer,rows,{...candidate,buyerDiscovery:{companyDossier:{...dossier,people:[{...person,status:'incoming',date:'2030-01-01'}]}}}]
  ])assert.notEqual(Discovery.matchBuyerRoleEvidence(p,r,c,{complete:true}).roleReview?.status,'supported');
});
test('navigation fragments cannot become job titles or survive in an existing buyer pool',()=>{
  const broken={name:'Marta Lane',title:'com/point/en/example/mediaassets) ## Management ### Alex Smith #### CEO ### L',organization:'Example',publicNameUrl:url};
  const profile={companyDomain:'example.com',decisionMakers:'CEO; Director, Operations / Engineering'};
  const trace=Discovery.tracePublicBuyers([{url,title:broken.name+' | '+broken.title+' | Example',description:'Example management'}],'Example',profile);
  assert.equal(trace.people.length,0);
  const valid={name:'Alex Smith',title:'Director, Operations / Engineering',organization:'Example',publicNameUrl:url};
  const pool=Discovery.mergeBuyerPool([broken],[valid],profile);
  assert.equal(pool.some(p=>p.name===broken.name),false);assert.equal(pool.some(p=>p.name===valid.name),true);
  const persisted={...broken,companyContactSource:'public_identity'};
  assert.equal(Discovery.mergeCompanyContacts([persisted],[],candidate).length,0);
  assert.equal(Discovery.qualifyBuyer(persisted,profile,candidate).eligible,false);
  const retained={...valid,id:'kept-person',kept:true,companyContactSource:'official_staff',publicEmail:'alex@example.com'};
  const malformedUpdate={...retained,title:broken.title};
  const mergedPool=Discovery.mergeBuyerPool([retained],[malformedUpdate],profile);
  assert.equal(mergedPool.length,1);assert.equal(mergedPool[0].title,retained.title);assert.equal(mergedPool[0].kept,true);
  const mergedContacts=Discovery.mergeCompanyContacts([retained],[malformedUpdate],candidate);
  assert.equal(mergedContacts.length,1);assert.equal(mergedContacts[0].title,retained.title);assert.equal(mergedContacts[0].publicEmail,retained.publicEmail);
});
