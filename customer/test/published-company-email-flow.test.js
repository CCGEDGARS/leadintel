const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),P=require('../contact-confirmation-policy.js'),{company,staff}=require('./fixtures/company-contact-reference.cjs');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
test('official first-name work emails use the same exact staff-card ownership gate as confirmation',()=>{
 for(const [name,title,email] of [['Johnny Spång','Logistik och leveranser','johnny@wernedal-co.se'],['Catrin Haglund','Administration','catrin@wernedal-co.se']])assert.deepEqual(D.sourcedBuyerEmails({name,title},company.domain,[staff],company.company).map(r=>r.email),[email]);
 for(const row of [{...staff,url:'https://other.example/contact'},{...staff,markdown:'**Johnny Spång**\nLogistik och leveranser\n\n**Catrin Haglund**\nAdministration\ncatrin@wernedal-co.se'},{...staff,evidenceKind:'model_summary',markdown:''}])assert.equal(D.sourcedBuyerEmails({name:'Johnny Spång',title:'Logistik och leveranser'},company.domain,[row],company.company).length,0);
});
test('Hunter connection alone does not block an official-source-confirmed email',()=>{
 const person={id:'johnny',name:'Johnny Spång',publicName:'Johnny Spång',title:'Logistik och leveranser',organization:company.company,publicNameUrl:staff.url,identityStatus:'confirmed'},contact={name:person.name,work_email:'johnny@wernedal-co.se',email_status:'public_confirmed',verification_provider:'Public source',public_email_url:staff.url,verified_at:new Date().toISOString()};
 const ctx={LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,acceptedBuyerConfirmationLevel:()=> 'public_confirmed',publicBuyerSource:()=>({email:contact.work_email,url:staff.url}),window:{LeadIntelContactPolicy:P,LeadIntelServiceSettings:{hunterEnabled:()=>true}}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function verifiedBuyerEmail('),source.indexOf('\nfunction buyerNextAction(')),ctx);assert.equal(ctx.verifiedBuyerEmail(company,person,contact),'johnny@wernedal-co.se');
});
test('selecting a confirmed company contact uses its own email and actual role in the saved handoff',async()=>{
 const contact=D.discoverCompanyContacts([staff],company).find(p=>p.name==='Catrin Haglund'),candidate={...company,people:[],buyerDiscovery:{companyContacts:[contact]}},calls=[];
 const ctx={discovery:{selectedProspects:[candidate]},canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'w1'}}),crmAuthenticated:()=>true,enrichmentResults:new Map([[contact.id,{contact:{work_email:contact.publicEmail}}]]),personKey:(c,p)=>p.id,verifiedBuyerEmail:(c,p,result)=>result.work_email||'',saveDiscovery(){},showToast(){},saveBuyerAndProceed:async(d,i)=>{calls.push({domain:d,...candidate.people[i]});return true;}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function selectPublishedCompanyContact('),source.indexOf('function companyContactDossierHtml(')),ctx);
 assert.equal(await ctx.selectPublishedCompanyContact(company.domain,contact.id),true);assert.equal(calls[0].publicEmail,'catrin@wernedal-co.se');assert.equal(calls[0].title,'Administration');assert.equal(calls[0].contactPurpose,'company_contact');
 ctx.verifiedBuyerEmail=()=>'';assert.equal(await ctx.selectPublishedCompanyContact(company.domain,contact.id),false);assert.equal(calls.length,1);
});
test('automatic flow may reuse an explicitly selected company contact without assigning a buyer role',()=>{
 const p={...D.discoverCompanyContacts([staff],company).find(p=>p.name==='Catrin Haglund'),kept:true,contactPurpose:'company_contact'};
 assert.equal(D.isSelectedCompanyContact(p,company),true);
 for(const change of [{kept:false},{contactPurpose:''},{organization:'Other Company'},{publicEmailUrl:'https://other.example/team'},{publicEmail:'info@wernedal-co.se'}])assert.equal(D.isSelectedCompanyContact({...p,...change},company),false);
});
test('CRM reload restores confirmed company-email readiness without a new source or paid lookup',()=>{
 const p=D.discoverCompanyContacts([staff],company).find(p=>p.name==='Catrin Haglund'),c={...company,buyerDiscovery:{companyContacts:[p]}},contact={id:'crm-catrin',external_person_id:p.id,name:p.name,work_email:p.publicEmail,email_status:'public_confirmed',verification_provider:'Public source',public_email_url:staff.url,verified_at:new Date().toISOString()},ctx={enrichmentResults:new Map(),personKey:(c,p)=>p.id,window:{LeadIntelContactPolicy:P}};
 const start=source.indexOf('function hydratePublishedCompanyEmails(');assert.ok(start>=0);const end=source.indexOf('\nfunction ',start+10);vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 assert.equal(ctx.hydratePublishedCompanyEmails(c,[contact]),true);assert.equal(ctx.enrichmentResults.get(p.id).contact.id,'crm-catrin');assert.equal(p.publicEmailSourceCheck.status,'confirmed');assert.equal(ctx.hydratePublishedCompanyEmails(c,[contact]),false);
});
