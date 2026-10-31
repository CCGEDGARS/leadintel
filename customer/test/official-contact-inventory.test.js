const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),C=require('../crm-engine.js');
const company={company:'Atlas Copco',domain:'atlascopcogroup.com',market:'Sweden',buyerSearchMode:'user_selected_target',people:[]};
const page=(path,markdown)=>({url:'https://www.atlascopcogroup.com/en/'+path,markdown,sourceRead:true});
const pages=[
 page('investors/investor-contacts','## Contact us\nVice President Investor Relations\n### Daniel Althoff\n- [ir@atlascopco.com](mailto:ir@atlascopco.com)\n- [+46 (0) 768 99 95 97](tel:+46(0)768999597)\n- [Connect with Daniel on LinkedIn](https://www.linkedin.com/in/daniel-althoff-729b401?trk=test)\nInvestor Relations Officer\n### Linnea Grönwall\n- [ir@atlascopco.com](mailto:ir@atlascopco.com)\n- [+46 72 737 8115](tel:+46727378115)\n- [Connect with Linnea on LinkedIn](https://www.linkedin.com/in/linneagronwall/)\nInvestor Relations Officer\n### Sofia Seiplax\n- [ir@atlascopco.com](mailto:ir@atlascopco.com)\n- [+46 72 145 41 56](tel:+46721454156)\n- [Connect with Sofia on LinkedIn](https://www.linkedin.com/in/sofiaseiplax/)'),
 page('media/press-contact','Media Relations Manager\n### Christina Malmberg Hägerstrand\n- [media@atlascopco.com](mailto:media@atlascopco.com)\n- [+46 72 855 93 29](tel:+46728559329)\n- [Connect with Christina on LinkedIn](https://www.linkedin.com/in/christina-malmberg-h%C3%A4gerstrand-36113538/)'),
 page('sustainability/sustainability-contact-and-organization','Vice President Sustainability\n### Anna Sjörén\n- [sustainability@atlascopco.com](mailto:sustainability@atlascopco.com)\n- [Connect with Anna on LinkedIn](https://www.linkedin.com/in/annasjoren)'),
 page('investors/corporate-governance/management-and-remuneration','## Meet our Group management\n### Vagner Rego\nPresident and CEO\nVagner Rego joined the company in 1996.\n### Cecilia Sandberg\nSenior Vice President, Chief Human Resources Officer')
];
test('official inventory recovers named cards, phones, profiles and cross-domain departmental inboxes',()=>{
 const inventory=D.officialCompanyContactInventory(pages,company);
 assert.equal(inventory.contacts.length,7);assert.deepEqual(inventory.channels.filter(c=>c.kind==='email').map(c=>c.value).sort(),['ir@atlascopco.com','media@atlascopco.com','sustainability@atlascopco.com']);
 const daniel=inventory.contacts.find(p=>p.name==='Daniel Althoff');assert.equal(daniel.title,'Vice President Investor Relations');assert.equal(daniel.publicPhone.replace(/\D/g,''),'46768999597');assert.equal(daniel.publicLinkedinUrl,'https://www.linkedin.com/in/daniel-althoff-729b401');assert.equal(daniel.publicEmail||'','');assert.equal(daniel.companyChannels[0].value,'ir@atlascopco.com');
 assert.ok(inventory.channels.every(c=>c.status==='published_listing'));assert.ok(inventory.contacts.filter(p=>p.publicPhone).length===4);assert.equal(inventory.contacts.find(p=>p.name==='Vagner Rego').title,'President and CEO');
});
test('foreign pages, model summaries and external mentions cannot supply official company contact evidence',()=>{
 const rows=[{...pages[0],url:'https://unrelated.example/contact'},{...pages[1],sourceRead:false},{...pages[2],evidenceKind:'model_summary'},page('about','Our supplier uses [vendor@outside.example](mailto:vendor@outside.example).')];
 const inventory=D.officialCompanyContactInventory(rows,company);assert.equal(inventory.contacts.length,0);assert.equal(inventory.channels.length,0);
});
test('official inventory survives workspace and CRM snapshots without promoting shared inboxes to buyer emails',()=>{
 const candidate={...company,buyerDiscovery:{officialContactInventory:D.officialCompanyContactInventory(pages,company)}};
 const restored=D.normalizeDiscoveryState({selectedProspects:[candidate]}).selectedProspects[0],inventory=restored.buyerDiscovery.officialContactInventory;
 assert.equal(inventory.contacts.length,7);assert.equal(inventory.channels.filter(c=>c.kind==='email').length,3);
 const crm=C.mapDiscoveryCandidateToCrm(restored);assert.deepEqual(crm.intelligence.research_snapshot.buyerResearch.discovery.officialContactInventory,inventory);assert.equal(crm.contacts.some(p=>p.work_email==='ir@atlascopco.com'),false);assert.equal(restored.people.length,0);
});
test('shared bounded official scan discovers official sections and actually reads sources',async()=>{
 const candidate={...company},queries=[],read=[];let active=0,maximum=0;
 const result=await D.runOfficialContactResearch(candidate,{rows:[],search:async q=>{queries.push(q);return pages.map(p=>({url:p.url}));},readPage:async url=>{active++;maximum=Math.max(maximum,active);await new Promise(r=>setImmediate(r));read.push(url);active--;return pages.find(p=>p.url===url)||{markdown:'Atlas Copco official website. [Contact](/en/investors/investor-contacts)'};}});
 assert.equal(queries.length,D.OFFICIAL_CONTACT_RESEARCH_POLICY.queries);assert.ok(read.length<=12);assert.ok(maximum<=3);assert.ok(result.rows.every(p=>p.sourceRead===true));assert.equal(candidate.buyerDiscovery.officialContactInventory.channels.filter(c=>c.kind==='email').length,3);assert.equal(candidate.buyerDiscovery.officialContactInventory.research.status,'complete');
});
test('canceled and replaced research cannot overwrite company evidence with late results',async()=>{
 const candidate={...company},controller=new AbortController();let resolve;const task=D.runOfficialContactResearch(candidate,{signal:controller.signal,search:()=>new Promise(r=>resolve=r),readPage:async()=>pages[0]});controller.abort();await task;resolve?.(pages);await new Promise(r=>setImmediate(r));assert.equal(candidate.buyerDiscovery,undefined);
});
module.exports={company,pages};

test('adjacent role-before-name cards retain each person role',()=>{
 const result=D.officialCompanyContactInventory([page('team','Chief Executive Officer\n### Jane Smith\nChief Financial Officer\n### John Jones')],company);
 assert.deepEqual(result.contacts.map(p=>[p.name,p.title]),[['Jane Smith','Chief Executive Officer'],['John Jones','Chief Financial Officer']]);
});
test('unrelated sections and reception links cannot become personal contact evidence',()=>{
 const result=D.officialCompanyContactInventory([page('team','### Jane Smith\nChief Executive Officer\nJane leads the company.\n[Meet recruiter](https://linkedin.com/in/john-jones)\n## Footer\nContact reception: +46 8 123 456 78\n[Meet recruiter](https://linkedin.com/in/john-jones)')],company);
 assert.equal(result.contacts.length,1);assert.equal(result.contacts[0].publicPhone,'');assert.equal(result.contacts[0].publicLinkedinUrl,'');
});
test('CRM inventory adds evidence without overwriting an enriched selected buyer',()=>{
 const inventory=D.officialCompanyContactInventory(pages,company),buyer={...inventory.contacts[0],id:'apollo-daniel',email:'daniel@atlascopcogroup.com',email_status:'verified'};
 const sparse={...inventory.contacts[0],publicPhone:'',publicLinkedinUrl:''};
 const result=C.mapDiscoveryCandidateToCrm({...company,people:[buyer],buyerDiscovery:{officialContactInventory:{...inventory,contacts:[sparse]}}});
 assert.equal(result.contacts[0].external_person_id,'apollo-daniel');assert.equal(result.contacts[0].work_email,buyer.email);assert.equal(result.contacts[0].email_status,'verified');assert.equal(result.contacts[0].linkedin_url,buyer.publicLinkedinUrl);
});

test('direct HTML extraction with split headings and a footer logo keeps the final card separate',()=>{
 const result=D.officialCompanyContactInventory([page('team','Chief Executive Officer\n###\nJane Smith\n[jane.smith@legacy.example](mailto:jane.smith@legacy.example)\n[\n](https://www.atlascopcogroup.com/en)\nAtlas Copco AB\nStreet 19\n[+46 8 123 456 78](tel:+46812345678)\n##### Quick links')],company);
 assert.equal(result.contacts.length,1);assert.equal(result.contacts[0].title,'Chief Executive Officer');assert.equal(result.contacts[0].publicPhone,'');assert.equal(result.channels[0].value,'jane.smith@legacy.example');
});
test('official-only inventory restores from CRM with no buyer timestamp or selected buyers',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),candidate={...company,people:[]},inventory=D.officialCompanyContactInventory(pages,company),detail={company:{normalized_domain:company.domain},intelligence:{research_snapshot:{buyerResearch:{version:2,discovery:{officialContactInventory:inventory},buyers:[]}}}};
 const ctx={Date,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain};require('./helpers/crm-hydration-context.cjs')(ctx);vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function restoreNewerBuyerResearch('),source.indexOf('function hydrateLocalPipelineFromCrm(')),ctx);
 assert.equal(ctx.restoreNewerBuyerResearch(candidate,detail),true);assert.equal(candidate.buyerDiscovery.officialContactInventory.contacts.length,7);assert.equal(candidate.people.length,0);assert.equal(ctx.restoreNewerBuyerResearch(candidate,detail),false);
 candidate.buyerDiscovery={};detail.company.normalized_domain='other.example';assert.equal(ctx.restoreNewerBuyerResearch(candidate,detail),false);assert.equal(candidate.buyerDiscovery.officialContactInventory,undefined);
 detail.company.normalized_domain=company.domain;candidate.publicContactStatus='loading';assert.equal(ctx.restoreNewerBuyerResearch(candidate,detail),false);
});

test('a later sparse leadership page cannot clear a richer contact card',()=>{
 const rich=page('contact','### Jane Smith\nChief Executive Officer\n[+46 70 123 4567](tel:+46701234567)\n[Jane Smith](https://linkedin.com/in/jane-smith)\n[jane@legacy.example](mailto:jane@legacy.example)'),sparse=page('leadership','### Jane Smith\nChief Executive Officer');
 for(const rows of [[rich,sparse],[sparse,rich]]){const person=D.officialCompanyContactInventory(rows,company).contacts[0];assert.equal(person.publicPhone,'+46 70 123 4567');assert.equal(person.publicPhoneUrl,rich.url);assert.equal(person.publicLinkedinUrl,'https://linkedin.com/in/jane-smith');assert.equal(person.companyChannels[0].value,'jane@legacy.example');}
});
test('official contact extraction remains portable across company names and industries',()=>{
 for(const name of ['North Clinic','Cloud Software']){
  const candidate={company:name,domain:'brand.example'},result=D.officialCompanyContactInventory([{url:'https://brand.example/contact',sourceRead:true,markdown:'Medical Director\n### Maria Santos\n[office@legacy.example](mailto:office@legacy.example)'}],candidate);
  assert.equal(result.contacts[0].organization,name);assert.equal(result.contacts[0].title,'Medical Director');assert.equal(result.channels[0].value,'office@legacy.example');assert.equal(result.contacts[0].publicEmail,undefined);
 }
});

test('standalone inventory accepts abbreviated executive titles',()=>{
 for(const title of ['CEO','CFO','COO','CTO']){const result=D.officialCompanyContactInventory([page('leadership','### Jane Smith\n'+title+'\n[jane@legacy.example](mailto:jane@legacy.example)')],company);assert.equal(result.contacts[0].title,title);assert.equal(result.contacts[0].companyChannels[0].value,'jane@legacy.example');}
});

test('a partial refresh retains earlier sourced contacts when only the homepage is readable',async()=>{
 const previous=D.officialCompanyContactInventory(pages,company),candidate={...company,buyerDiscovery:{officialContactInventory:previous}};
 await D.runOfficialContactResearch(candidate,{force:true,search:async()=>{throw new Error('Search unavailable');},readPage:async()=>({markdown:'Atlas Copco official homepage'})});
 const inventory=candidate.buyerDiscovery.officialContactInventory;
 assert.equal(inventory.research.status,'partial');assert.equal(inventory.research.retainedPrevious,true);assert.equal(inventory.contacts.length,7);assert.equal(inventory.channels.length,3);assert.equal(inventory.checkedAt,previous.checkedAt);assert.equal(inventory.research.queries.length,D.OFFICIAL_CONTACT_RESEARCH_POLICY.queries);
});
test('split first and last names remain one official staff heading',()=>{
 const rows=[page('management','## Group management\n### Rickard\nGustafson\nPresident and Chief Executive Officer\n### Susanne\nLarsson\nChief Financial Officer')];
 const result=D.officialCompanyContactInventory(rows,company);assert.deepEqual(result.contacts.map(p=>p.name),['Rickard Gustafson','Susanne Larsson']);
});

test('rendered portrait headings separate inline full names and titles without reading image filenames as identity',()=>{
 const result=D.officialCompanyContactInventory([page('management','## ![portrait-wrong-name](https://cdn.example/photo.png)       Rickard    Gustafson    President and Chief Executive Officer\n\n## ![portrait](https://cdn.example/photo2.png)       Susanne    Larsson    Chief Financial & Sustainability Officer and Senior Vice President Group Finance & Sustainability')],company);
 assert.deepEqual(result.contacts.map(p=>[p.name,p.title]),[['Rickard Gustafson','President and Chief Executive Officer'],['Susanne Larsson','Chief Financial & Sustainability Officer and Senior Vice President Group Finance & Sustainability']]);
});

test('a fresh cached inventory seeds buyer discovery even when raw source bodies were released',()=>{
 const inventory=D.officialCompanyContactInventory(pages,company);inventory.research={policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,status:'complete'};
 const candidate={...company,buyerDiscovery:{officialContactInventory:inventory}},contacts=D.discoverCompanyContacts([],candidate);
 assert.equal(contacts.length,7);assert.ok(contacts.some(p=>p.name==='Vagner Rego'));assert.ok(contacts.some(p=>p.name==='Daniel Althoff'));
 inventory.checkedAt=new Date(Date.now()-31*86400000).toISOString();assert.equal(D.discoverCompanyContacts([],candidate).length,0);
});

test('a completed empty inventory is rechecked instead of suppressing new evidence for thirty days',async()=>{
 const inventory=D.officialCompanyContactInventory([],company);inventory.research={policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,status:'complete'};const candidate={...company,buyerDiscovery:{officialContactInventory:inventory}};let searches=0;
 await D.runOfficialContactResearch(candidate,{search:async()=>{searches++;return pages.map(p=>({url:p.url}));},readPage:async url=>pages.find(p=>p.url===url)||{markdown:'Official company homepage'}});
 assert.equal(searches,D.OFFICIAL_CONTACT_RESEARCH_POLICY.queries);assert.equal(candidate.buyerDiscovery.officialContactInventory.contacts.length,7);
});
test('a supplied official page is read before the homepage and unrelated source URLs are rejected',async()=>{
 const candidate={...company},read=[];
 await D.runOfficialContactResearch(candidate,{seedUrls:['https://unrelated.example/team',pages[0].url],search:async()=>[],readPage:async url=>{read.push(url);return pages.find(p=>p.url===url)||{markdown:'Company homepage'};}});
 assert.equal(read[0],pages[0].url);assert.ok(!read.some(url=>url.includes('unrelated')));assert.equal(candidate.buyerDiscovery.officialContactInventory.contacts.length,3);
});
test('a deadline retains unfinished official URLs and resumes them before restarting the website crawl',async()=>{
 const candidate={...company};let stuck=true;const requested=[];
 await D.runOfficialContactResearch(candidate,{maxDurationMs:15,search:async()=>[{url:pages[0].url}],readPage:async url=>{if(url===pages[0].url)return new Promise(()=>{});return {markdown:'Official company website'};}});
 assert.ok(candidate.buyerDiscovery.officialContactInventory.research.pendingUrls.includes(pages[0].url));
 await D.runOfficialContactResearch(candidate,{search:async()=>[],readPage:async url=>{requested.push(url);return pages.find(p=>p.url===url)||{markdown:'Official company website'};}});
 assert.equal(requested[0],pages[0].url);assert.equal(candidate.buyerDiscovery.officialContactInventory.contacts.length,3);
});
test('official source controls reject foreign URLs before research and retain the selected page evidence',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),candidate={...company,publicContactStatus:'idle'},state={selectedProspects:[candidate]},b={workspace:{id:'w1'},session:{user:{id:'u1'}}},reads=[];
 const ctx={URL,AbortController,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,selectedProspects:()=>[candidate],discovery:state,bridge:()=>b,crmAuthenticated:()=>true,crmCompanyByDomain:()=>null,saveDiscovery:()=>{},renderAll:()=>{},showToast:()=>{},searchBuyerPublicPages:async()=>[],fetchFirecrawlBuyerResearch:async(_,body)=>{reads.push(body.url);return {ok:true,json:async()=>({data:pages.find(p=>p.url===body.url)||{markdown:'Official homepage'}})};}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function refreshOfficialCompanyContacts('),source.indexOf('function companyContactDossierHtml(')),ctx);
 for(const sourceUrl of ['https://unrelated.example/team','javascript:alert(1)','https://name:secret@atlascopcogroup.com/team'])assert.equal(await ctx.refreshOfficialCompanyContacts(company.domain,{sourceUrl}),false);
 assert.equal(reads.length,0);assert.equal(await ctx.refreshOfficialCompanyContacts(company.domain,{sourceUrl:pages[0].url}),true);assert.equal(reads[0],pages[0].url);assert.equal(candidate.buyerDiscovery.officialContactInventory.contacts.length,3);assert.equal(candidate.publicContactStatus,'idle');
});
test('manual company contact action resumes a partial current-policy queue and refreshes completed or explicitly supplied sources',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 for(const [status,sourceUrl,expectedForce]of [['partial','',false],['complete','',true],['partial','https://atlascopcogroup.com/contact',true]]){
  const candidate={...company,publicContactStatus:'idle',buyerDiscovery:{officialContactInventory:{research:{status,policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version}}}},state={selectedProspects:[candidate]},b={workspace:{id:'w1'},session:{user:{id:'u1'}}},flags=[];
  const ctx={URL,AbortController,LeadIntelDiscovery:{...D,runOfficialContactResearch:async(c,options)=>{flags.push(options.force);await options.guard();}},canonicalDomain:D.canonicalDomain,selectedProspects:()=>[candidate],discovery:state,bridge:()=>b,crmAuthenticated:()=>true,crmCompanyByDomain:()=>null,saveDiscovery(){},renderAll(){},showToast(){}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function refreshOfficialCompanyContacts('),source.indexOf('function companyContactDossierHtml(')),ctx);assert.equal(await ctx.refreshOfficialCompanyContacts(company.domain,{sourceUrl}),true);assert.deepEqual(flags,[expectedForce]);assert.equal(candidate.publicContactStatus,'idle');
 }
});
