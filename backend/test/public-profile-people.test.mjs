import test from 'node:test';
import assert from 'node:assert/strict';
import '../../customer/discovery-engine.js';
import {unresolvedProfileUrls,readPublicProfilePeople,unheldProfilePeople,publicPeopleQueries,publicPeopleCountry,isPublicProfileRow,collapseSameRecords,PUBLIC_PEOPLE_MAX_QUERIES} from '../src/public-profile-people.js';

// Owner gate, 26 Nov 2026: LeadIntel itself must find the current people that a manual Perplexity search found. Three
// of them were only in public profile excerpts ("**Role**" / "**Employer**" / "March 2023 - Present"), which no reader
// used. Invented people and companies; the real-data replay is kept outside this public repository.
const target={company:'Fjord Staal A/S',domain:'fjord-staal.example',market:'Denmark'};
const profile=(slug,name,text,extra={})=>({url:`https://www.linkedin.com/in/${slug}`,title:`${name} | LinkedIn`,description:text.slice(0,300),markdown:text,lastUpdated:'2026-11-02',evidenceKind:'search_excerpt',searchProvider:'perplexity',...extra});
const header=(name,headline)=>`**${name}**\n**${headline}**\n**${headline}**\nCopenhagen, Capital Region of Denmark, Denmark\n7 followers · 6 connections\n### Experience\n`;
const projectManager=profile('ida-larsen-1','Ida Larsen',header('Ida Larsen','Projektleder')+'- **Projektleder**\n**Fjord-Staal**\nMarch 2023 - Present\nFrederiksværk, Hovedstaden, Danmark\n- **Technical Engineer**\n...');
// The dash of the entry sits on an earlier line, as in a live excerpt.
const chair=profile('mads-holm-2','Mads Holm','**Mads Holm**\n**Founder**\n**Entrepreneur**\nCopenhagen Metropolitan Area Denmark\n...\n-\n### Experience\n**Investor/Chair**\n**Fjord-Staal**\nApril 2022 - Present\nFrederiksværk, Capital Region, Denmark\nFjord Staal puts the customer in the first place.');
const former=profile('ole-berg-3','Ole Berg',header('Ole Berg','Maintenance Supervisor')+'- **maintenance supervisor**\n  **Harbour Steel A/S**\n  October 2024 - Present\n- **Projektleder**\n  **Fjord-Staal**\n  July 2021 - October 2024 · 3 years 4 months');

test('a current experience entry at the target makes a sourced person; an ended one does not',()=>{
 const {people,former:left}=readPublicProfilePeople([projectManager,chair,former],target,{now:'2026-11-26T21:00:00.000Z'});
 assert.deepEqual(people.map(p=>[p.name,p.title]),[['Ida Larsen','Projektleder'],['Mads Holm','Investor/Chair']]);
 const ida=people[0];
 // The platform's own LinkedIn identity record: this profile names this person at the target.
 assert.deepEqual(ida.linkedinIdentityEvidence,{url:'https://www.linkedin.com/in/ida-larsen-1',name:'Ida Larsen',organization:'Fjord Staal A/S',checkedAt:'2026-11-26T21:00:00.000Z'});
 assert.equal(ida.organization,'Fjord Staal A/S');
 assert.equal(ida.publicNameUrl,'https://www.linkedin.com/in/ida-larsen-1');assert.equal(ida.publicLinkedinUrl,ida.publicNameUrl);
 assert.equal(ida.companyContactSource,'public_identity');
 assert.equal(ida.identityEvidence.kind,'public_profile');assert.equal(ida.identityEvidence.provider,'perplexity');
 assert.equal(ida.identityEvidence.employer,'Fjord-Staal');assert.equal(ida.identityEvidence.since,'March 2023');
 assert.ok(projectManager.markdown.includes(ida.identityEvidence.quote),'the quote is the excerpt text itself');
 assert.match(ida.identityEvidence.quote,/Projektleder[\s\S]*Fjord-Staal[\s\S]*March 2023 - Present/);
 assert.equal(ida.identityEvidenceDate,'2026-11-02');
 assert.deepEqual(left.map(p=>p.name),['Ole Berg']);
});

test('an entry cut before its dates, a sister company and a mention in prose do not count',()=>{
 const cut=profile('karl-lund-4','Karl Lund',header('Karl Lund','Smed')+'- **Smed**\n**Fjord Staal A/S**');
 const sister=profile('eva-dahl-5','Eva Dahl',header('Eva Dahl','Coating Manager')+'- **Coating Manager**\n**Fjord Staal Coating ApS**\nJanuary 2020 - Present\nWe work closely with Fjord Staal A/S on every project.');
 const prose=profile('per-moe-6','Per Moe',header('Per Moe','Sales')+'- **Sales Manager**\n**Nordic Wing**\nFebruary 2025 - Present\nEarlier I worked at Fjord Staal A/S.');
 assert.deepEqual(readPublicProfilePeople([cut,sister,prose],target).people,[]);
});

test('spellings of the target employer match and a different name does not',()=>{
 const spelled=(slug,name,employer)=>profile(slug,name,header(name,'Projektleder')+`- **Projektleder**\n**${employer}**\nMay 2021 - Present`);
 const rows=[spelled('a-1','Anne Kjær','Fjord Stål a/s'),spelled('b-2','Bo Wind','fjord staal'),spelled('c-3','Carl Ravn','Fjord Staal A/S'),spelled('d-4','Dina Sund','Fjorrd Staal')];
 assert.deepEqual(readPublicProfilePeople(rows,target).people.map(p=>p.name),['Anne Kjær','Bo Wind','Carl Ravn']);
});

test('one person per profile, from personal profile pages with a full name only',()=>{
 const again={...projectManager,markdown:projectManager.markdown+'\n...'};
 const company=profile('x','Fjord-Staal',header('Fjord-Staal','industrial machinery')+'- **Projektleder**\n**Fjord-Staal**\nMarch 2023 - Present',{url:'https://www.linkedin.com/company/fjord-staal'});
 const site={...projectManager,url:'https://fjord-staal.example/om-os/'};
 const single=profile('ida','Ida',header('Ida','Projektleder')+'- **Projektleder**\n**Fjord-Staal**\nMarch 2023 - Present');
 assert.deepEqual(readPublicProfilePeople([projectManager,again,company,site,single],target).people.map(p=>p.name),['Ida Larsen']);
});

test('two profiles with one name and the same current role at the target make one person',()=>{
 const first=profile('rune-kolding-1','Rune Kolding',header('Rune Kolding','Managing Director')+'- **Managing Director**\n**Fjord Staal A/S**\nMay 2010 - Present');
 const second=profile('rune-kolding-2','Rune Kolding',header('Rune Kolding','Managing Director')+'- **Managing Director**\n**Fjord-Staal**\nMay 2010 - Present');
 assert.deepEqual(readPublicProfilePeople([first,second],target).people.map(p=>p.publicNameUrl),['https://www.linkedin.com/in/rune-kolding-1']);
});

test('the reader works across industries, markets and legal-form positions',()=>{
 const clinic={company:'Harbor Clinics Ltd',domain:'harbor-clinics.example',market:'United Kingdom'};
 const ops=profile('anna-walsh-7','Anna Walsh','**Anna Walsh**\n**Operations Director**\n**Operations Director at Harbor Clinics**\nLondon, England, United Kingdom\n### Experience\n- **Operations Director**\n**Harbor Clinics**\nJune 2019 - Present\n- **Practice Manager**\n**Harbor Clinics**\nMarch 2015 - May 2019 · 4 years 3 months');
 assert.deepEqual(readPublicProfilePeople([ops],clinic).people.map(p=>[p.name,p.title]),[['Anna Walsh','Operations Director']]);
 const steel={company:'SIA Ziemeļu Tērauds',domain:'ziemelu-terauds.example',market:'Latvia'};
 const board=profile('laura-ozola-8','Laura Ozola','**Laura Ozola**\n**Valdes locekle**\n**Valdes locekle**\nRīga, Latvia\n### Experience\n- **Valdes locekle**\n**Ziemeļu Tērauds**\nJune 2020 - Present');
 assert.deepEqual(readPublicProfilePeople([board],steel).people.map(p=>[p.name,p.title]),[['Laura Ozola','Valdes locekle']]);
});

test('the outcome does not depend on the person\'s name',()=>{
 const text=name=>header(name,'Projektleder')+'- **Projektleder**\n**Fjord-Staal**\nMarch 2023 - Present';
 const one=readPublicProfilePeople([profile('n-1','Sofie Nygaard',text('Sofie Nygaard'))],target).people;
 const two=readPublicProfilePeople([profile('n-2','Jonas Brix',text('Jonas Brix'))],target).people;
 assert.equal(one.length,1);assert.deepEqual(one.map(p=>p.title),two.map(p=>p.title));
});

test('a person the job already shows or pools is not added again from a profile',()=>{
 // The register named the CEO without a profile link, so the profile is a different identity with the same name.
 const ceo=profile('rasmus-dal-9','Rasmus Dal',header('Rasmus Dal','CEO')+'- **Managing Director**\n**Fjord Staal A/S**\nApril 2003 - Present');
 const shown={...target,people:[{id:'register-1',name:'Rasmus Dal',publicName:'Rasmus Dal',title:'Administrerende direktør',organization:'Fjord Staal A/S'}]};
 assert.deepEqual(unheldProfilePeople([ceo,projectManager],shown).map(p=>p.name),['Ida Larsen']);
 const pooled={...target,people:[],buyerDiscovery:{pool:[{id:'p-1',name:'Ida Larsen',title:'Projektleder',organization:'Fjord Staal A/S',publicLinkedinUrl:'https://www.linkedin.com/in/ida-larsen-1'}]}};
 assert.deepEqual(unheldProfilePeople([ceo,projectManager],pooled).map(p=>p.name),['Rasmus Dal']);
});

test('Danish buyer-role words are the local titles, one per role family',()=>{
 const queries=publicPeopleQueries(target,['Procurement Director','Procurement Manager','Operations Director','Project Manager','Workshop Manager.']);
 assert.equal(queries[2],'"Fjord Staal" indkøbschef driftschef projektleder værkfører');
});

// Live, 27 Nov 2026: one register record was saved four times (the same profile on dk. and www., twice without it),
// carried in from the browser's saved list into a job whose later phases do not merge again.
test('one identity record printed several times is saved once, richest copy first; different profiles stay',()=>{
 const rich={id:'registry-1',name:'Bent Mørk',title:'Direktør',publicLinkedinUrl:'https://dk.linkedin.com/in/bent-mork-1',contactResearch:{status:'complete'},emailResearch:{status:'complete'}};
 const list=[{id:'registry-1',name:'Bent Mørk',title:'Direktør'},{...rich},{...rich,publicLinkedinUrl:'https://www.linkedin.com/in/Bent-Mork-1'},{id:'registry-1',name:'Bent Mørk',title:'Direktør'},{id:'other',name:'Ida Larsen',title:'Projektleder'}];
 const out=collapseSameRecords(list);
 assert.deepEqual(out.map(p=>p.id),['registry-1','other']);
 assert.equal(out[0].contactResearch?.status,'complete','the richest copy is kept');
 assert.equal(out[0].publicLinkedinUrl,'https://dk.linkedin.com/in/bent-mork-1');
 const conflict=collapseSameRecords([{id:'x',name:'Bent Mørk',publicLinkedinUrl:'https://www.linkedin.com/in/bent-mork-1'},{id:'x',name:'Bent Mørk',publicLinkedinUrl:'https://www.linkedin.com/in/bent-mork-2'}]);
 assert.equal(conflict.length,2,'one id with two different profiles is left for review');
 assert.deepEqual(collapseSameRecords([{name:'No Id'},{name:'No Id'}]).length,2,'records without an id are not guessed');
});

test('the people search asks like the manual search: management, employees, buyer roles, register number, country, chair',()=>{
 const queries=publicPeopleQueries({...target,buyerDiscovery:{registerManagement:{id:'12345678'}}},['Executive leadership','Production Manager','Project Manager','Procurement Manager']);
 assert.deepEqual(queries,['Fjord Staal A/S direktør ledelse','Fjord Staal A/S LinkedIn medarbejder','"Fjord Staal" produktionschef projektleder indkøbschef','Fjord Staal A/S CVR 12345678 bestyrelse direktion','"Fjord Staal" Denmark manager','"Fjord Staal" bestyrelsesformand']);
 assert.ok(queries.length<=PUBLIC_PEOPLE_MAX_QUERIES);
 assert.ok(queries.every(q=>!/\bsite:|\sOR\s/.test(q)),'no search-engine operators');
});

test('the company\'s registered city narrows the searches for a short or common name',()=>{
 const queries=publicPeopleQueries({company:'Nord Scan A/S',domain:'nord-scan.example',market:'Denmark',buyerDiscovery:{registerManagement:{id:'19400689',city:'Hvide Sande'}}},['Project Manager']);
 assert.deepEqual(queries,['Nord Scan A/S Hvide Sande direktør ledelse','Nord Scan A/S LinkedIn medarbejder','"Nord Scan" Hvide Sande projektleder','Nord Scan A/S CVR 19400689 bestyrelse direktion','"Nord Scan" Hvide Sande Denmark manager','"Nord Scan" Hvide Sande bestyrelsesformand']);
});

// Live, 27 Nov 2026: "AS SCAN" was cut to "SCAN" (AS read as a legal form), so the searches asked for a common word.
test('a short company name keeps its legal form when cutting it would leave one short word',()=>{
 const queries=publicPeopleQueries({company:'AS SCAN',domain:'as-scan.example',market:'Denmark'},['Project Manager']);
 assert.ok(queries.includes('"AS SCAN" projektleder'),JSON.stringify(queries));
 assert.ok(queries.every(query=>!/"SCAN"/.test(query)),JSON.stringify(queries));
 assert.ok(publicPeopleQueries({company:'HRS A/S',market:'Denmark'},['Project Manager']).includes('"HRS A/S" projektleder'));
 assert.ok(publicPeopleQueries({company:'Alusteel A/S',market:'Denmark'},['Project Manager']).includes('"Alusteel" projektleder'));
});

test('other markets get English words, and a register label only with a number',()=>{
 const queries=publicPeopleQueries({company:'Harbor Clinics Ltd',domain:'harbor-clinics.example',market:'United Kingdom'},['Operations Director']);
 assert.deepEqual(queries,['Harbor Clinics Ltd CEO management team','Harbor Clinics Ltd LinkedIn employees','"Harbor Clinics" operations director','Harbor Clinics Ltd board of directors','"Harbor Clinics" United Kingdom manager','"Harbor Clinics" chairman of the board']);
 assert.deepEqual(publicPeopleQueries({market:'Denmark'},['CEO']),[]);
});

// Live, 26 Nov 2026: five queries sharing one request's 20 results drifted to a namesake company abroad and missed two
// current project managers; the same queries sent one by one with the country bias found them.
test('the search country follows the target market and is left out when unknown',()=>{
 assert.equal(publicPeopleCountry('Denmark'),'DK');assert.equal(publicPeopleCountry('United Kingdom'),'GB');
 assert.equal(publicPeopleCountry('latvia'),'LV');assert.equal(publicPeopleCountry('Atlantis'),'');assert.equal(publicPeopleCountry(''),'');
});

test('a directory person page names a current role at the target; another employer does not count',()=>{
 const org=(slug,title,text='Fjord Staal puts the customer first.')=>({url:`https://theorg.com/org/fjord-staal/org-chart/${slug}`,title,description:text.slice(0,300),markdown:text,lastUpdated:'2026-11-22',evidenceKind:'search_excerpt',searchProvider:'perplexity'});
 const {people}=readPublicProfilePeople([org('mads-holm','Mads Holm - Investor/chair at Fjord-Staal | The Org'),org('per-moe','Per Moe - CFO at Harbour Steel | The Org')],target);
 assert.deepEqual(people.map(p=>[p.name,p.title,p.publicNameUrl]),[['Mads Holm','Investor/chair','https://theorg.com/org/fjord-staal/org-chart/mads-holm']]);
 assert.equal(people[0].identityEvidence.kind,'public_directory');assert.equal(people[0].identityEvidence.quote,'Mads Holm - Investor/chair at Fjord-Staal');
 assert.equal(people[0].organization,'Fjord Staal A/S');assert.equal(people[0].linkedinIdentityEvidence,undefined,'a directory page is not a LinkedIn profile');
});

test('only personal profile and directory person pages are kept from the people search',()=>{
 assert.equal(isPublicProfileRow({url:'https://dk.linkedin.com/in/ida-larsen-1'}),true);
 assert.equal(isPublicProfileRow({url:'https://theorg.com/org/fjord-staal/org-chart/mads-holm'}),true);
 assert.equal(isPublicProfileRow({url:'https://www.linkedin.com/company/fjord-staal'}),false);
 assert.equal(isPublicProfileRow({url:'https://theorg.com/org/fjord-staal'}),false);
 assert.equal(isPublicProfileRow({url:'https://fjord-staal.example/om-os/'}),false);
});


test('a retrieved public employment history binds a dated role to the named employer',()=>{
 const url='https://dk.linkedin.com/in/ida-larsen-1';
 const hit={url,title:'Ida Larsen | LinkedIn',description:'Projektleder · Erfaring: Fjord-Staal'};
 const other={...hit,url:url+'b',title:'Signe Holm',description:'Previously at Fjord Steelworks'};
 const page={url,sourceRead:true,markdown:'# Ida Larsen\n\n## Employment History\n\n### [Fjord-Staal](https://www.linkedin.com/company/fjord-staal)\n\n- 2023-02-01 - now: Projektleder\n\n### [Supplier Ltd](https://www.linkedin.com/company/supplier)\n\n- 2021-02-01 - 2023-01-30: Designer'};
 const D=globalThis.LeadIntelDiscovery;
 assert.deepEqual(unresolvedProfileUrls([hit,hit,other],target,D),[url]);
 assert.deepEqual(readPublicProfilePeople([page],target).people.map(p=>[p.name,p.title]),[['Ida Larsen','Projektleder']]);
 assert.deepEqual(unresolvedProfileUrls([hit,page],target,D),[]);
 const ended={...page,markdown:page.markdown.replace('now:','2024-05-01:')};
 assert.deepEqual(readPublicProfilePeople([ended],target).people,[]);assert.deepEqual(unresolvedProfileUrls([hit,ended],target,D),[]);
});
