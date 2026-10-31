const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),Crm=require('../crm-engine.js'),Policy=require('../contact-confirmation-policy.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'');
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(){
 const dom=new JSDOM('<div id="toast"></div>',{url:'https://audit.example/'}),data=new Map(),writes=[],events=[];
 const teemu={id:'teemu',name:'Teemu Suursalmi',publicName:'Teemu Suursalmi',title:'Head of Hydrogen',organization:'Fixture Company',publicNameUrl:'https://company.example/team',linkedin_url:'https://linkedin.com/in/teemu-fixture'},klas={id:'klas',name:'Klas Nilsson',publicName:'Klas Nilsson',title:'Head of Procurement',organization:'Fixture Company',publicNameUrl:'https://company.example/team',linkedin_url:'https://linkedin.com/in/klas-fixture'};
 const candidate={company:'Fixture Company',domain:'company.example',crmId:'crm-company',people:[teemu,klas],qualification:{eligible:true},buyerRoles:['Head of Hydrogen','Head of Procurement'],buyerDiscovery:{pool:[]},evidence:[]};
 const b={workspace:{id:'w'},session:{authenticated:true,user:{id:'u'}},saveCrmCompany:async()=>{writes.push('crm');return {ok:true,company:{id:'crm-company',normalized_domain:'company.example',workspace_id:'w'}};},saveNow:async()=>{writes.push('sync');return {saved:true};}};
 const c={console,URL,AbortController,CustomEvent:dom.window.CustomEvent,setTimeout,clearTimeout,setInterval,clearInterval,document:dom.window.document,LeadIntelDiscovery:D,LeadIntelCrm:Crm,LeadIntelContactPolicy:Policy,LeadIntelServerBridge:b,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},addEventListener(){},dispatchEvent:e=>events.push(e.type)};c.window=c;c.LeadIntelAdditionalContacts={register:hooks=>c.hooks=hooks};vm.createContext(c);vm.runInContext(source,c);
 Object.assign(c,{renderAll(){},showToast:m=>writes.push('toast:'+m),qualificationAssessment:()=>({eligible:true}),refreshCrmState:async()=>writes.push('refresh'),ensureCrmCompany:async()=>({id:'crm-company',normalized_domain:'company.example',workspace_id:'w'}),saveDiscovery:()=>writes.push('local')});c.fixture={status:'complete',candidates:[candidate],selectedProspects:[candidate],pipeline:[],potentialMatches:[],rawResults:[]};vm.runInContext('discovery=fixture;',c);
 const result=()=>({contact:{id:'contact-teemu',external_person_id:teemu.id,name:teemu.name,title:teemu.title,company_id:'crm-company',linkedin_url:teemu.linkedin_url,work_email:'teemu@company.example',email_status:'verified',source:'treg'}});
 return {c,b,candidate,teemu,klas,data,writes,events,result,eval:code=>vm.runInContext(code,c),close:()=>dom.window.close()};
}
const tick=()=>new Promise(setImmediate);
for(const change of ['employer','role','profile','name','replacement','user','bridge','ticket'])test(`paid prepare rejects ${change} while CRM company preparation waits`,async()=>{
 const f=fixture();try{const wait=gate();f.c.ensureCrmCompany=()=>wait.promise;const pending=f.c.hooks.prepare(f.candidate,f.teemu);await tick();
 if(change==='employer')f.teemu.organization='Different Employer';if(change==='role')f.teemu.title='Finance Director';if(change==='profile')f.teemu.linkedin_url=f.klas.linkedin_url;if(change==='name')f.teemu.publicName='Another Person';if(change==='replacement')f.candidate.people[0]={...f.teemu};if(change==='user')f.b.session.user.id='other';if(change==='bridge')f.c.LeadIntelServerBridge={...f.b};if(change==='ticket')f.data.set('leadintel_account_context_v1','replaced');
 wait.resolve({id:'crm-company'});await assert.rejects(pending,/buyer|context|workspace/i);assert.deepEqual(f.writes,[]);
 }finally{f.close();}
});
test('paid prepare follows Teemu through reorder and validates returned CRM company identity',async()=>{
 const f=fixture();try{const wait=gate();f.c.ensureCrmCompany=()=>wait.promise;const pending=f.c.hooks.prepare(f.candidate,f.teemu);f.candidate.people.reverse();wait.resolve({id:'crm-company'});assert.equal((await pending).id,'crm-company');
 f.b.saveCrmCompany=async()=>({ok:true,company:{id:'different-company',normalized_domain:'other.example',workspace_id:'w'}});await assert.rejects(f.c.hooks.prepare(f.candidate,f.teemu),/company|identity/i);
 }finally{f.close();}
});
for(const change of ['employer','user','bridge','ticket'])test(`Hunter save cannot sync after ${change} changes during CRM acknowledgement`,async()=>{
 const f=fixture();try{const wait=gate();f.b.saveCrmCompany=()=>wait.promise;const pending=f.c.hooks.saveHunter(f.candidate,f.teemu,'teemu@company.example',{status:'valid',deliverability:'deliverable'});await tick();
 if(change==='employer')f.teemu.organization='Different Employer';if(change==='user')f.b.session.user.id='other';if(change==='bridge')f.c.LeadIntelServerBridge={...f.b};if(change==='ticket')f.data.set('leadintel_account_context_v1','replaced');
 wait.resolve({ok:true,company:{id:'crm-company',normalized_domain:'company.example'}});await assert.rejects(pending,/buyer|context|workspace/i);assert.equal(f.writes.includes('sync'),false);assert.equal(f.teemu.hunterChecks['teemu@company.example'].status,'valid');
 }finally{f.close();}
});
for(const change of ['employer','user','ticket'])test(`paid acceptance cannot dispatch a late CRM event after ${change} changes`,async()=>{
 const f=fixture();try{const wait=gate();f.c.refreshCrmState=()=>wait.promise;const pending=f.c.hooks.accept(f.candidate,f.teemu,f.result());await tick();if(change==='employer')f.teemu.organization='Different Employer';if(change==='user')f.b.session.user.id='other';if(change==='ticket')f.data.set('leadintel_account_context_v1','replaced');wait.resolve(true);await assert.rejects(pending,/buyer|context|workspace/i);assert.deepEqual(f.events,[]);
 }finally{f.close();}
});
for(const mismatch of ['person','name','company','profile','title','data','workspace','conflicting-profiles','malformed-profile'])test(`paid acceptance independently rejects wrong ${mismatch} before local writes`,async()=>{
 const f=fixture();try{const result=f.result();if(mismatch==='person')result.contact.external_person_id=f.klas.id;if(mismatch==='name')result.contact.name=f.klas.name;if(mismatch==='company')result.contact.company_id='wrong';if(mismatch==='profile')result.contact.linkedin_url=f.klas.linkedin_url;if(mismatch==='title')result.contact.title='Another role';if(mismatch==='workspace')result.contact.workspace_id='other-workspace';if(mismatch==='conflicting-profiles'){result.contact.public_linkedin_url=f.teemu.linkedin_url;result.contact.linkedin_url=f.klas.linkedin_url;}if(mismatch==='malformed-profile')result.contact.public_linkedin_url='https://example.com/unrelated';if(mismatch==='data')result.contactData={version:1,domain:f.candidate.domain,personId:f.klas.id};await assert.rejects(f.c.hooks.accept(f.candidate,f.teemu,result),/identity|buyer|contact/i);assert.deepEqual(f.writes,[]);assert.equal(f.eval('enrichmentResults.size'),0);
 }finally{f.close();}
});
test('paid cleanup cannot clear a newer root buyer action pending token',()=>{
 const f=fixture();try{const old={};f.c.hooks.pending(f.candidate,f.teemu,true,old);f.teemu.title='New role';f.c.selected=f.teemu;f.c.selectedCompany=f.candidate;f.eval('newOwner=captureBuyerAction(selectedCompany,selected);newToken=beginBuyerPending(newOwner);');assert.ok(f.c.newToken,'A stale paid marker must not block the current root action');f.c.hooks.pending(f.candidate,f.teemu,false,old);assert.equal(f.eval('enrichmentPending.has(personKey(selectedCompany,selected))'),true);f.eval('endBuyerPending(personKey(selectedCompany,selected),newToken)');assert.equal(f.eval('enrichmentPending.size'),0);
 }finally{f.close();}
});
test('paid phone reuse does not trust a different buyer saved contactData or raw contact',()=>{
 const f=fixture();try{f.teemu.contactData={version:1,domain:f.candidate.domain,personId:f.klas.id,identityName:f.klas.name,phone:{status:'provider_listed',number:'+12025550142'}};assert.equal(f.c.hooks.phone(f.candidate,f.teemu),false);f.c.wrongContact={id:'wrong',external_person_id:f.klas.id,name:f.klas.name,phone_number:'+12025550143',phone_status:'provider_listed'};f.eval('enrichmentResults.set("company.example|teemu",{contact:wrongContact})');assert.equal(f.c.hooks.phone(f.candidate,f.teemu),false);
 }finally{f.close();}
});
test('exact paid acceptance retains a detached result through refresh and emits one owned event',async()=>{
 const f=fixture();try{const wait=gate();f.c.refreshCrmState=()=>wait.promise;const result=f.result(),pending=f.c.hooks.accept(f.candidate,f.teemu,result);await tick();result.contact.name=f.klas.name;result.contact.work_email='wrong@company.example';wait.resolve(true);await pending;assert.equal(f.eval('enrichmentResults.get("company.example|teemu").contact.work_email'),'teemu@company.example');assert.deepEqual(f.events,['leadintel:crm-changed']);
 }finally{f.close();}
});
test('an active root pending token blocks overlapping paid state without losing ownership',()=>{
 const f=fixture();try{f.c.selected=f.teemu;f.c.selectedCompany=f.candidate;f.eval('rootOwner=captureBuyerAction(selectedCompany,selected);rootToken=beginBuyerPending(rootOwner);');assert.throws(()=>f.c.hooks.pending(f.candidate,f.teemu,true,{}),/already active/i);assert.equal(f.eval('buyerActionPendingOwners.get(personKey(selectedCompany,selected))===rootToken'),true);f.eval('endBuyerPending(personKey(selectedCompany,selected),rootToken)');assert.equal(f.eval('enrichmentPending.size'),0);
 }finally{f.close();}
});
test('an exact saved phone remains reusable without changing email or ownership status',()=>{
 const f=fixture();try{f.teemu.contactData={version:1,domain:f.candidate.domain,personId:f.teemu.id,identityName:f.teemu.name,identityTitle:f.teemu.title,identityOrganization:f.teemu.organization,phone:{status:'provider_listed',number:'+12025550142'}};assert.equal(f.c.hooks.phone(f.candidate,f.teemu),true);assert.equal(f.teemu.contactVerification,undefined);
 }finally{f.close();}
});
for(const change of ['strategy','account-ticket'])test(`actual registered paid adapter rejects ${change} changed during provider response`,async()=>{
 const f=fixture();try{
  const hooks=f.c.hooks,started=gate(),response=gate();f.c.AbortSignal=AbortSignal;f.c.LeadIntelAdditionalContactPolicy={readiness:()=>({eligible:true}),targets:()=>[]};f.c.LeadIntelDialogs={confirm:async()=>true};
  f.c.fetch=async url=>{if(url.includes('/additional-contact-services/email')){started.resolve();return response.promise;}return {ok:true,json:async()=>url.includes('/policy')?{policy:{provider:'treg',enabled:true,phoneEnabled:false,maxPerCompany:1,dailyLimit:5,monthlyLimit:150},role:'owner'}:{providers:[{provider:'treg',configured:true,source:'customer'}]}};};
  f.eval(fs.readFileSync(require.resolve('../additional-contact-services.js'),'utf8'));f.c.LeadIntelAdditionalContacts.register(hooks);await f.c.LeadIntelAdditionalContacts.load();
  const run=f.c.LeadIntelAdditionalContacts.run(f.candidate,f.teemu,{dataLookup:true,emailOnly:true});await started.promise;f.writes.length=0;
  if(change==='strategy')f.data.set('leadintel_customer_v2_state',JSON.stringify({website:'https://different-seller.example',profile:{companyName:'Changed Seller'}}));else f.data.set('leadintel_account_context_v1','replacement-ticket');
  response.resolve({ok:true,json:async()=>f.result()});assert.equal(await run,false);assert.equal(f.eval('enrichmentResults.size'),0);assert.equal(f.teemu.contactVerification,undefined);assert.deepEqual(f.writes,[]);assert.deepEqual(f.events,[]);
 }finally{f.close();}
});
