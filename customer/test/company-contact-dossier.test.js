const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),C=require('../crm-engine.js');
const {company,staff,registry}=require('./fixtures/company-contact-reference.cjs');
test('company dossier matches the reference report while keeping contactability separate from buying role',()=>{
 const contacts=D.discoverCompanyContacts([staff,registry],company);
 assert.equal(contacts.length,7);
 const johnny=contacts.find(p=>p.name==='Johnny Spång'),catrin=contacts.find(p=>p.name==='Catrin Haglund');
 assert.equal(johnny.publicEmail,'johnny@wernedal-co.se');assert.equal(catrin.publicEmail,'catrin@wernedal-co.se');
 assert.equal(johnny.publicEmailUrl,staff.url);assert.equal(johnny.publicPhone.replace(/\D/g,''),'0850103724');
 const ceo=contacts.find(p=>p.name==='Nils Bo Lennart Larsson');assert.equal(ceo.title,'Verkställande direktör');assert.equal(ceo.publicNameUrl,registry.url);assert.equal(ceo.publicEmail||'','');assert.equal(ceo.publicPhone||'','');
 const profile={decisionMakers:'Executive leadership; Operations; Design Engineer'};
 const shortlist=D.rankedBuyerShortlist(contacts,profile,company);assert.ok(shortlist.priorityIds.includes(ceo.id));
 assert.ok(!shortlist.people.some(p=>p.name==='Johnny Spång'||p.name==='Catrin Haglund'));
 assert.ok(!contacts.some(p=>p.name==='Mats Olov Johansson'));
});
test('dossier survives normalization and CRM persistence without promoting routing contacts',()=>{
 const contacts=D.discoverCompanyContacts([staff,registry],company);
 const candidate={...company,buyerSearchMode:'user_selected_target',people:[],buyerDiscovery:{companyContacts:contacts}};
 const restored=D.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0];
 assert.equal(restored.buyerDiscovery.companyContacts.length,7);
 const crm=C.mapDiscoveryCandidateToCrm(restored);assert.equal(crm.intelligence.research_snapshot.buyerResearch.discovery.companyContacts.length,7);
 assert.equal(crm.contacts.length,7);assert.equal(crm.contacts.find(p=>p.name==='Catrin Haglund').work_email,'catrin@wernedal-co.se');
 assert.equal(restored.people.length,0);
});
test('renaming the company/domain preserves discovery and unrelated company registries cannot supply a CEO',()=>{
 const renamed={company:'Different Fabrication',domain:'different.example',market:'Sweden'};
 const official={...staff,url:'https://different.example/contact',markdown:staff.markdown.replaceAll('wernedal-co.se','different.example')};
 assert.equal(D.discoverCompanyContacts([official,registry],renamed).length,6);
 assert.equal(D.discoverCompanyContacts([{...staff,url:'https://unrelated.example/contact'},registry],renamed).length,0);
 assert.equal(D.discoverCompanyContacts([{...registry,sourceRead:false}],company).length,0);
});
test('Apollo company discovery starts broad and offers a verified-domain keyword fallback',()=>{
 const p=D.buildApolloPeopleSearchPayload(company,{decisionMakers:'CEO; Procurement Director; Engineering Manager'});
 assert.deepEqual(p.person_titles,[]);assert.deepEqual(p.person_seniorities,[]);
 const fallback=D.buildApolloPeopleSearchPayload(company,{}, {companyNameFallback:true});
 assert.equal(fallback.q_keywords,'Wernedal & CO');assert.deepEqual(fallback.q_organization_domains_list,['wernedal-co.se']);
});
test('registry birth-year annotations cannot hide the published CEO identity',()=>{
 const annotated={...registry,markdown:registry.markdown.replace('Larsson]','Larsson]').replace('](https://www.allabolag.se/person/example) |','](https://www.allabolag.se/person/example) (f 1949) |')};
 const contacts=D.discoverCompanyContacts([staff,annotated],company);assert.ok(contacts.some(p=>p.name==='Nils Bo Lennart Larsson'));assert.ok(!JSON.stringify(contacts).includes('1949'));
});
test('the company record exposes all sourced people and published emails without calling them confirmed buyers',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');const start=source.indexOf('function companyContactDossierHtml(');assert.ok(start>=0,'company contact record must be rendered');const end=source.indexOf('\nfunction ',start+10),context={LeadIntelDiscovery:D,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')};vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nthis.render=companyContactDossierHtml;',context);
 const html=context.render({...company,people:[],buyerDiscovery:{companyContacts:D.discoverCompanyContacts([staff,registry],company)}});assert.match(html,/7 staff records/);assert.match(html,/johnny@wernedal-co.se/);assert.match(html,/catrin@wernedal-co.se/);assert.match(html,/Additional company contact/);assert.doesNotMatch(html,/confirmed decision-maker/i);
});
test('software and professional-service staff are retained without manufacturing-specific titles',()=>{
 const target={company:'Independent Advisory',domain:'advisory.example',market:'United Kingdom'};
 const source={url:'https://advisory.example/team',sourceRead:true,markdown:'## Our team\n**Anna Andersson**\nSenior Consultant\n\n**Bertil Berg**\nPeople Partner\n\n**Clara Clark**\nCEO\n\n**Diana Davis**\nSoftware Engineer'};
 const contacts=D.discoverCompanyContacts([source],target);assert.deepEqual(contacts.map(p=>p.name).sort(),['Anna Andersson','Bertil Berg','Clara Clark','Diana Davis']);assert.ok(contacts.every(p=>p.organization===target.company));
});
test('service page titles are never company contacts and old unvalidated dossier entries are removed',()=>{
 const servicePages=[{url:'https://www.wernedal-co.se/',sourceRead:true,title:'Mekanisk verkstad Stockholm | Wernedal & CO',markdown:'## Svetsning, stansning och legotillverkning\nWernedal & CO erbjuder tillverkning.'},{url:'https://www.wernedal-co.se/cad/',sourceRead:true,title:'CAD Program | 3D CAD ritning | Wernedal & CO',markdown:'Wernedal & CO hjälper med CAD.'}];
 const stale=[{name:'CAD Program',publicName:'CAD Program',title:'3D CAD ritning',organization:company.company,publicNameUrl:servicePages[1].url}];
 const contacts=D.discoverCompanyContacts([...servicePages,staff,registry],company,stale);
 assert.equal(contacts.length,7);assert.ok(contacts.every(p=>p.companyContactSource));
 const restored=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',buyerDiscovery:{companyContacts:[...contacts,...stale]}}]}).selectedProspects[0];
 assert.equal(restored.buyerDiscovery.companyContacts.length,7);
 assert.equal(C.mapDiscoveryCandidateToCrm(restored).contacts.length,7);
});
test('merging contact research preserves validated provenance and published details',()=>{
 const contacts=D.discoverCompanyContacts([staff,registry],company),person=contacts.find(p=>p.name==='Johnny Spång');
 const merged=D.mergeCompanyContacts(contacts,[{...person,companyContactSource:'',publicEmail:''}],company);
 assert.equal(merged.length,7);assert.equal(merged.find(p=>p.name===person.name).companyContactSource,'official_staff');assert.equal(merged.find(p=>p.name===person.name).publicEmail,person.publicEmail);
});
test('registered executive identity and priority survive selected-target reload, including repair of stripped source fields',()=>{
 const contacts=D.discoverCompanyContacts([staff,registry],company),ceo=contacts.find(p=>p.corporateRoleEvidence),profile={decisionMakers:'Executive leadership; Operations; Design Engineer'};
 for(const person of [ceo,{...ceo,publicName:'',publicNameUrl:''}]){
  const restored=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[person],buyerDiscovery:{companyContacts:contacts}}]}).selectedProspects[0];
  assert.equal(restored.people[0].publicNameUrl,registry.url);assert.equal(D.qualifyBuyer(restored.people[0],profile,restored).eligible,true);assert.ok(D.rankedBuyerShortlist(restored.people,profile,restored).priorityIds.includes(ceo.id));
 }
 const unrelated={...ceo,corporateRoleEvidence:{...ceo.corporateRoleEvidence,company:'Different Company'}};
 const restored=D.normalizeDiscoveryState({selectedProspects:[{...company,buyerSearchMode:'user_selected_target',people:[unrelated]}]}).selectedProspects[0];assert.equal(restored.people[0].publicNameUrl,'');
});
