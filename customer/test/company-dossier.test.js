const {test}=require('node:test');const assert=require('node:assert/strict');
const D=require('../company-dossier.js');
const url='https://example.com/news/organization';
const text='Area Directors have full authority and report directly to the CEO. Rodrigo Scarpelli leads Green Steel. Register suppliers at https://survey.typeform.com/to/example. Email press@example.com for media.';
const pages=[{url,text}];
const plan=D.researchPlan({});
const pass={planSignature:plan.signature,searchFamilies:[{name:'leadership',kind:'leadership',query:'CURRENT LEADERSHIP AND PROJECT DOSSIER',status:'complete',attempts:1,completedAt:'2026-10-21T12:00:00Z'},{name:'contacts',kind:'contacts',query:'CONTACT ROUTES',status:'complete',attempts:1,completedAt:'2026-10-21T12:00:00Z'}],provider:'openai',webSearch:true,people:[{name:'Rodrigo Scarpelli',title:'Area Director, Green Steel',sourceUrl:url,quote:'Area Directors have full authority and report directly to the CEO. Rodrigo Scarpelli leads Green Steel.',date:'2026-10-06'}],facts:[{kind:'change',text:'New delivery leadership',sourceUrl:url,quote:'Area Directors have full authority and report directly to the CEO.'}],channels:[{kind:'email',value:'press@example.com',purpose:'media',sourceUrl:url,quote:'Email press@example.com for media.'}],gaps:[]};
test('underlying source quotes support prose identities without HTML staff headings',()=>{const p=D.validatePass(pass,pages);assert.equal(p.people[0].name,'Rodrigo Scarpelli');assert.equal(p.channels[0].status,'published_listing');assert.equal(D.buyers({people:p.people},'Example')[0].publicEmail,undefined);});
test('rejects fabricated sources, quotes and name headings',()=>{const p=D.validatePass({...pass,people:[{...pass.people[0],name:'Meet Niklas Malmström'},{...pass.people[0],quote:'not on source'}],channels:[{...pass.channels[0],value:'buyer@example.com'}]},pages);assert.equal(p.people.length,0);assert.equal(p.channels.length,0);});
test('two independent providers are mandatory and conflicts survive JSON roundtrip',()=>{const a={...D.validatePass(pass,pages),planSignature:plan.signature,searchFamilies:pass.searchFamilies},b={...D.validatePass({...pass,provider:'gemini',people:[{...pass.people[0],title:'Director, Green Steel'}]},pages),planSignature:plan.signature,searchFamilies:pass.searchFamilies};const result=D.reconcile([a,b],{company:'Example',domain:'example.com',contextKey:'ctx'});assert.equal(result.status,'complete');assert.equal(result.conflicts.length,1);assert.equal(D.safe(JSON.parse(JSON.stringify(result)),'example.com').conflicts.length,1);assert.equal(D.reconcile([a,a],{domain:'example.com'}).status,'partial');});
test('company context and current offers change reuse fingerprint',()=>{assert.notEqual(D.contextKey({company:'Example',domain:'example.com',seller:{offer:'steel'}}),D.contextKey({company:'Example',domain:'example.com',seller:{offer:'insurance'}}));});
test('a name match does not permit an invented job title',()=>{assert.equal(D.validatePass({...pass,people:[{...pass.people[0],title:'Chief Financial Officer'}]},pages).people.length,0);});
test('incoming people with unknown or future effective dates do not enter current buyer selection',()=>{assert.equal(D.buyers({people:[{...pass.people[0],status:'incoming',date:''}]},'Example').length,0);assert.equal(D.buyers({people:[{...pass.people[0],status:'incoming',date:'2099-01-01'}]},'Example').length,0);});
test('explicit delivery authority permits an area leader to qualify without inventing procurement authority',()=>{const E=require('../discovery-engine.js'),base={id:'r',name:'Rodrigo Scarpelli',publicName:'Rodrigo Scarpelli',title:'Area Director, Green Steel',organization:'Example',publicNameUrl:url,identityEvidenceDate:new Date().toISOString(),identityStatus:'confirmed',nameVerification:'confirmed'};const profile={decisionMakers:'Project Director; Operations'},candidate={company:'Example',domain:'example.com'};assert.equal(E.qualifyBuyer(base,profile,candidate).eligible,false);const person={...base,decisionEvidence:[{url,quote:'Area Directors for each delivery area have full authority and report directly to the CEO. Rodrigo Scarpelli leads Green Steel.',date:new Date().toISOString()}]};const result=E.qualifyBuyer(person,profile,candidate);assert.equal(result.eligible,true);assert.ok(result.gaps.includes('Actual purchasing authority unconfirmed'));});
test('another person’s job and an invented effective date cannot be attributed to the named person',()=>{const quote='Alex Smith is Operations Director. Jane Doe is Procurement Director.',p=[{url,text:quote}];assert.equal(D.validatePass({provider:'openai',webSearch:true,people:[{name:'Alex Smith',title:'Procurement Director',quote,sourceUrl:url,date:'2099-01-01'}]},p).people.length,0);const valid=D.validatePass({provider:'openai',webSearch:true,people:[{name:'Alex Smith',title:'Operations Director',quote,sourceUrl:url,date:'2099-01-01'}]},p);assert.equal(valid.people[0].date,'');});
test('future appointments preserve the current role and retain both assignments through normalization',()=>{const current={...pass.people[0],date:'2026-01-01',status:'current',quote:'Rodrigo Scarpelli is Area Director, Green Steel from 2026-01-01.'},future={...current,title:'Operations Director',date:'2099-01-01',status:'incoming',quote:'Rodrigo Scarpelli becomes Operations Director from 2099-01-01.'};const r=D.reconcile([{...pass,sources:[url],status:'complete',people:[current]},{...pass,sources:[url],status:'complete',provider:'gemini',people:[future]}],{company:'Example',domain:'example.com'});assert.equal(r.people[0].title,current.title);assert.equal(D.safe(r,'example.com').assignments.length,2);});
test('a conflicting Apollo identity cannot bypass dossier evidence through a different identifier',()=>{const E=require('../discovery-engine.js'),a={...pass,status:'complete',people:[{name:'Alex Smith',title:'Procurement Director',status:'current',sourceUrl:url,quote:'Alex Smith is Procurement Director'}]},b={...a,provider:'gemini',people:[{...a.people[0],title:'Operations Director'}]},d=D.reconcile([a,b],{company:'Example',domain:'example.com'}),candidate={company:'Example',domain:'example.com',buyerDiscovery:{companyDossier:d}},profile={decisionMakers:'Procurement Director; Operations Director'},apollo=E.traceIdentityBuyers({people:[{id:'external-alex',name:'Alex Smith',title:'Operations Director',organization:{name:'Example'},linkedin_url:'https://www.linkedin.com/in/alex-smith'}]},candidate,profile).people,pool=E.mergeBuyerPool(D.buyers(d,'Example'),apollo,profile);assert.equal(E.rankedBuyerShortlist(pool,profile,candidate).people.length,0);});
test('a role directly before the full name remains attributable to that person',()=>{const quote='The Operations Director is Alex Smith.',r=D.validatePass({provider:'openai',webSearch:true,people:[{name:'Alex Smith',title:'Operations Director',quote,sourceUrl:url}]},[{url,text:quote}]);assert.equal(r.people.length,1);});
test('roles in separate clauses remain bound to their own person',()=>{const quote='Alex Smith is Operations Director and Jane Doe is Procurement Director.',r=D.validatePass({provider:'openai',webSearch:true,people:[{name:'Alex Smith',title:'Procurement Director',quote,sourceUrl:url}]},[{url,text:quote}]);assert.equal(r.people.length,0);});
test('an announced future departure does not remove the incumbent before its effective date',()=>{const quote='Alex Smith is CEO until 2099-01-01, then becomes an adviser.',p=D.validatePass({provider:'openai',webSearch:true,people:[{name:'Alex Smith',title:'CEO',status:'departed',date:'2099-01-01',quote,sourceUrl:url}]},[{url,text:quote}]);assert.equal(p.people[0].status,'current');assert.equal(p.people[0].departureDate,'2099-01-01');});
test('a long source passage cannot transfer another person’s preceding title',()=>{const quote='Jane Doe, Procurement Director, introduced Alex Smith, Operations Director.',p=D.validatePass({provider:'openai',webSearch:true,people:[{name:'Alex Smith',title:'Procurement Director',quote,sourceUrl:url}]},[{url,text:quote}]);assert.equal(p.people.length,0);});
test('future departure evidence survives either provider order for the same current title',()=>{const a={...pass,status:'complete',people:[{...pass.people[0],name:'Alex Smith',title:'CEO',status:'current',date:''}]},b={...a,provider:'gemini',people:[{...a.people[0],departureDate:'2099-01-01',date:'2099-01-01'}]};for(const passes of [[a,b],[b,a]])assert.equal(D.reconcile(passes,{company:'Example',domain:'example.com'}).people[0].departureDate,'2099-01-01');});

test('dossier facts retain literal supporting prose instead of a model-invented claim',()=>{
 const quote='Example manufactures industrial valves and pumps.';
 const result=D.validatePass({webSearch:true,facts:[{kind:'project',text:'Example has approved a 900 million euro factory investment.',sourceUrl:'https://example.com/news',quote}]},[{url:'https://example.com/news',text:quote}],{company:'Example',domain:'example.com'});
 assert.equal(result.facts.length,1);assert.equal(result.facts[0].text,quote);assert.doesNotMatch(JSON.stringify(result),/900 million/);
});
test('third-party dossier facts and channels require a target-company association in the cited quote',()=>{
 const quote='Unrelated manufactures industrial valves. Email press@unrelated.example for media.';
 const result=D.validatePass({webSearch:true,facts:[{text:quote,quote,sourceUrl:'https://news.example/story'}],channels:[{kind:'email',value:'press@unrelated.example',quote,sourceUrl:'https://news.example/story'}]},[{url:'https://news.example/story',text:quote}],{company:'Example',domain:'example.com'});
 assert.equal(result.facts.length,0);assert.equal(result.channels.length,0);
});
test('a target-name substring on an external page cannot verify a different company employee',()=>{
 const quote='Alex Smith is Operations Director at OtherExample.';
 const result=D.validatePass({webSearch:true,people:[{name:'Alex Smith',title:'Operations Director',sourceUrl:'https://news.example/story',quote}]},[{url:'https://news.example/story',text:quote}],{company:'Example',domain:'example.com'});
 assert.equal(result.people.length,0);
});
test('official pages cannot assign an explicitly named partner employer to the target',()=>{
 const quote='Alex Smith is Operations Director at Rival Industries.';
 const result=D.validatePass({webSearch:true,people:[{name:'Alex Smith',title:'Operations Director',organization:'Example',sourceUrl:'https://example.com/partners',quote}]},[{url:'https://example.com/partners',text:quote}],{company:'Example',domain:'example.com'});
 assert.equal(result.people.length,0);
});
test('official company subdomain evidence supports company staff without requiring a name in every quote',()=>{
 const quote='Alex Smith is Operations Director.';
 const result=D.validatePass({webSearch:true,people:[{name:'Alex Smith',title:'Operations Director',sourceUrl:'https://news.example.com/team',quote}]},[{url:'https://news.example.com/team',text:quote}],{company:'Example',domain:'example.com'});
 assert.equal(result.people.length,1);
});
test('invalid calendar dates cannot become verified dossier effective dates',()=>{
 const quote='Alex Smith is Operations Director from 2026-02-31.';
 const result=D.validatePass({webSearch:true,people:[{name:'Alex Smith',title:'Operations Director',date:'2026-02-31',sourceUrl:'https://example.com/team',quote}]},[{url:'https://example.com/team',text:quote}],{company:'Example',domain:'example.com'});
 assert.equal(result.people[0].date,'');
});

test('save/reload rebuilds dossier projections from pass-bound source evidence',()=>{
 const quote='Alex Smith is Operations Director at Example.';
 const p=D.validatePass({provider:'openai',webSearch:true,people:[{name:'Alex Smith',title:'Operations Director',sourceUrl:'https://example.com/team',quote}]},[{url:'https://example.com/team',text:quote}],{company:'Example',domain:'example.com'});
 const dossier=D.reconcile([{...p,status:'complete',planSignature:plan.signature,searchFamilies:pass.searchFamilies},{...p,status:'complete',planSignature:plan.signature,searchFamilies:pass.searchFamilies,provider:'gemini'}],{company:'Example',domain:'example.com'});
 dossier.people=[{...dossier.people[0],name:'Fabricated Person'}];dossier.facts=[{text:'Invented acquisition',sourceUrl:'https://invented.example/',quote:'Invented acquisition'}];
 for(const provider of dossier.passes)provider.people.push({name:'Forged Person',title:'Procurement Director',sourceUrl:'https://invented.example/',quote:'Forged Person is Procurement Director at Example.'});
 const saved=D.safe(JSON.parse(JSON.stringify(dossier)),'example.com');
 assert.deepEqual(saved.people.map(row=>row.name),['Alex Smith']);assert.equal(saved.facts.length,0);assert.ok(saved.passes.every(row=>row.people.length===1));
});

test('extractive dossier facts retain negation around a model-selected substring',()=>{
 const quote='Example has not approved a factory investment.';
 const result=D.validatePass({webSearch:true,facts:[{kind:'project',text:'approved a factory investment',sourceUrl:'https://example.com/news',quote}]},[{url:'https://example.com/news',text:quote}],{company:'Example',domain:'example.com'});
 assert.equal(result.facts[0].text,quote);
});
