const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),Crm=require('../crm-engine.js'),Policy=require('../contact-confirmation-policy.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {resolve,promise};}
function runtime(){
 const dom=new JSDOM('<div id="customer-pipeline"></div><div id="company-candidates"></div><div id="toast"></div>',{url:'https://audit.example/'}),data=new Map(),calls=[],writes=[];
 const teemu={id:'teemu',name:'Teemu Suursalmi',publicName:'Teemu Suursalmi',title:'Head of Hydrogen',organization:'Fixture Company',publicNameUrl:'https://company.example/team',publicEmail:'teemu@company.example',publicEmailUrl:'https://company.example/team',linkedin_url:'https://linkedin.com/in/teemu-fixture'};
 const klas={id:'klas',name:'Klas Nilsson',publicName:'Klas Nilsson',title:'Head of Procurement',organization:'Fixture Company',publicNameUrl:'https://company.example/team',linkedin_url:'https://linkedin.com/in/klas-fixture'};
 const candidate={company:'Fixture Company',domain:'company.example',crmId:'crm-company',buyerSearchMode:'user_selected_target',buyerRoles:'Head of Hydrogen; Head of Procurement',people:[teemu,klas]};
 const b={workspace:{id:'w'},session:{authenticated:true,user:{id:'u'}},saveCrmContacts:async(companyId,contacts)=>({ok:true,contacts:contacts.map(contact=>({...contact,id:'crm-teemu',company_id:companyId,workspace_id:'w'}))})};
 const c={console,URL,AbortController,CustomEvent:dom.window.CustomEvent,setTimeout,clearTimeout,setInterval,clearInterval,document:dom.window.document,LeadIntelDiscovery:D,LeadIntelCrm:Crm,LeadIntelContactPolicy:Policy,LeadIntelServerBridge:b,localStorage:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)},addEventListener(){},dispatchEvent:e=>calls.push(e.type)};c.window=c;vm.createContext(c);vm.runInContext(source,c);
 Object.assign(c,{renderAll(){},renderPipeline(){},renderCandidates(){},showToast:m=>calls.push(String(m)),refreshCrmState:async()=>true,saveDiscovery:()=>writes.push('save'),ensureCrmCompany:async()=>({id:'crm-company',workspace_id:'w',normalized_domain:'company.example'})});
 c.fixture={status:'complete',candidates:[candidate],selectedProspects:[candidate],pipeline:[],potentialMatches:[]};vm.runInContext('discovery=fixture;crmCompanies=[{id:"crm-company",normalized_domain:"company.example"}];buyerConfirmationLevel="public_confirmed";confirmationPolicyWorkspace="w";',c);
 const contact=()=>({id:'crm-teemu',company_id:'crm-company',workspace_id:'w',external_person_id:'teemu',name:'Teemu Suursalmi',title:'Head of Hydrogen',work_email:'teemu@company.example',normalized_email:'teemu@company.example',email_status:'public_confirmed',verification_provider:'Public source',public_email_url:'https://company.example/team',verified_at:new Date().toISOString()});
 const dispatch=()=>{c.bindDiscovery();const original=c.confirmPublicBuyerSource;c.confirmPublicBuyerSource=(...args)=>{c.pending=original(...args);return c.pending;};c.document.getElementById('customer-pipeline').innerHTML='<button data-recheck-public-email="company.example" data-person-index="0" data-person-id="teemu">Recheck source</button>';c.document.querySelector('button').click();return ()=>c.pending;};
 return {c,b,candidate,teemu,klas,data,calls,writes,contact,dispatch,eval:code=>vm.runInContext(code,c),close:()=>dom.window.close()};
}
for(const change of ['employer','title','email','removed','user','ticket','bridge'])test(`dispatched source confirmation rejects ${change} changed while the actual provider response waits`,async()=>{
 const r=runtime(),g=deferred(),started=deferred();let posts=0;try{r.c.fetchBuyerResearch=async(_url,options)=>{posts++;assert.equal(JSON.parse(options.body).person_id,'teemu');started.resolve();return g.promise;};const pending=r.dispatch();await started.promise;
 if(change==='employer')r.teemu.organization='Another employer';if(change==='title')r.teemu.title='Former role';if(change==='email')r.teemu.publicEmail='newer@company.example';if(change==='removed')r.candidate.people=[r.klas];if(change==='user')r.b.session.user.id='other';if(change==='ticket')r.data.set('leadintel_account_context_v1','replacement-ticket');if(change==='bridge')r.c.LeadIntelServerBridge={...r.b};
 g.resolve({ok:true,json:async()=>({contact:r.contact()})});await pending().catch(()=>false);assert.equal(posts,1,'the request really started');assert.equal(r.teemu.publicEmailSourceCheck,undefined);assert.equal(r.eval('enrichmentResults.size'),0);assert.equal(r.writes.length,0);
 }finally{r.close();}
});
for(const field of ['external_person_id','company_id','workspace_id','work_email','normalized_email','public_email_url','name','email_status'])test(`source confirmation rejects a contradictory returned ${field}`,async()=>{
 const r=runtime();try{const contact=r.contact();contact[field]=field==='public_email_url'?'https://company.example/other-team':field==='email_status'?'public_unverified':'wrong';r.c.fetchBuyerResearch=async()=>({ok:true,json:async()=>({contact})});assert.equal(await r.c.confirmPublicBuyerSource(r.candidate,r.teemu,{evidenceOnly:true}).catch(()=>false),false);assert.equal(r.teemu.publicEmailSourceCheck,undefined);assert.equal(r.eval('enrichmentResults.size'),0);}finally{r.close();}
});
test('source confirmation accepts a current exact receipt after Klas and Teemu reorder',async()=>{
 const r=runtime(),g=deferred(),started=deferred();try{r.c.fetchBuyerResearch=async()=>{started.resolve();return g.promise;};const pending=r.c.confirmPublicBuyerSource(r.candidate,r.teemu,{evidenceOnly:true});await started.promise;r.candidate.people.reverse();g.resolve({ok:true,json:async()=>({contact:r.contact()})});assert.equal(await pending,true);assert.equal(r.teemu.publicEmailSourceCheck.status,'confirmed');assert.equal(r.klas.publicEmailSourceCheck,undefined);assert.equal(r.eval('enrichmentResults.get("company.example|teemu").contact.id'),'crm-teemu');}finally{r.close();}
});
test('public source confirmation accepts a guarded same-identity research copy and rejects a different copied identity',async()=>{
 for(const changed of [false,true]){const r=runtime();try{const copy=JSON.parse(JSON.stringify(r.candidate)),person=copy.people[0];if(changed)person.organization='Another employer';let posts=0;r.c.fetchBuyerResearch=async()=>{posts++;return {ok:true,json:async()=>({contact:r.contact()})};};assert.equal(await r.c.confirmPublicBuyerSource(copy,person,{evidenceOnly:true,contextGuard:()=>true,researchOwner:r.candidate}).catch(()=>false),!changed);assert.equal(posts,changed?0:1);assert.equal(r.teemu.publicEmailSourceCheck,undefined,'only the research copy is mutated before its guarded checkpoint');}finally{r.close();}}
});
for(const phase of ['search','body','company','contacts','reload'])test(`public candidate email cannot apply after buyer replacement during ${phase}`,async()=>{
 const r=runtime(),g=deferred(),started=deferred();try{delete r.teemu.publicEmail;delete r.teemu.publicEmailUrl;
 const response={ok:true,json:async()=>({data:[{url:'https://company.example/team',markdown:'# Fixture Company\nTeemu Suursalmi\nHead of Hydrogen\nteemu.suursalmi@company.example',sourceRead:true}]})};
 r.c.fetchFirecrawlBuyerResearch=async()=>{if(phase==='search'){started.resolve();return g.promise;}return phase==='body'?{ok:true,json:async()=>{started.resolve();return g.promise;}}:response;};
 if(phase==='company')r.c.ensureCrmCompany=async()=>{started.resolve();return g.promise;};if(phase==='contacts')r.b.saveCrmContacts=async()=>{started.resolve();return g.promise;};if(phase==='reload')r.c.refreshCrmState=async()=>{started.resolve();return g.promise;};
 const pending=r.c.findPublicCandidateEmail(r.candidate,r.teemu);await started.promise;r.candidate.people=[r.klas,{...r.teemu,organization:'Another employer'}];g.resolve(phase==='search'?response:phase==='body'?await response.json():phase==='company'?{id:'crm-company',normalized_domain:'company.example'}:phase==='contacts'?{ok:true,contacts:[r.contact()]}:true);assert.equal(await pending.catch(()=>false),false);assert.equal(r.klas.publicEmail,undefined);assert.equal(r.candidate.people[1].publicEmail,undefined);assert.equal(r.writes.length,0);
 }finally{r.close();}
});
for(const change of ['user','ticket','bridge'])test(`policy response cannot adopt a prior ${change} owner in the same workspace`,async()=>{
 const r=runtime(),g=deferred(),started=deferred();try{r.c.fetch=async()=>{started.resolve();return g.promise;};const pending=r.c.refreshBuyerConfirmationPolicy();await started.promise;if(change==='user')r.b.session.user.id='other';if(change==='ticket')r.data.set('leadintel_account_context_v1','replacement-ticket');if(change==='bridge')r.c.LeadIntelServerBridge={...r.b};g.resolve({ok:true,json:async()=>({confirmationLevel:'public_confirmed'})});await pending;assert.equal(r.c.LeadIntelBuyerConfirmationPolicy.level(),'provider_verified');}finally{r.close();}
});
test('an older policy response cannot replace a newer policy success',async()=>{
 const r=runtime(),old=deferred();try{let requests=0;r.c.fetch=async()=>++requests===1?old.promise:{ok:true,json:async()=>({confirmationLevel:'provider_verified'})};const first=r.c.refreshBuyerConfirmationPolicy();await r.c.refreshBuyerConfirmationPolicy();old.resolve({ok:true,json:async()=>({confirmationLevel:'public_confirmed'})});await first;assert.equal(r.c.LeadIntelBuyerConfirmationPolicy.level(),'provider_verified');}finally{r.close();}
});
test('a current source rejection is retained through save and prevents a cached listing from qualifying',async()=>{
 const r=runtime();try{r.c.fetchBuyerResearch=async()=>({ok:false,status:409,json:async()=>({error:'Exact person–email attribution no longer appears'})});await assert.rejects(r.c.confirmPublicBuyerSource(r.candidate,r.teemu,{evidenceOnly:true}),/no longer appears/);assert.equal(r.teemu.publicEmailSourceCheck.status,'failed');assert.equal(r.writes.length,1);assert.equal(r.c.publicBuyerSource(r.candidate,r.teemu),undefined);}finally{r.close();}
});
test('public candidate email keeps the same retained person after a reorder during CRM acknowledgment',async()=>{
 const r=runtime(),g=deferred(),started=deferred();try{delete r.teemu.publicEmail;delete r.teemu.publicEmailUrl;r.c.fetchFirecrawlBuyerResearch=async()=>({ok:true,json:async()=>({data:[{url:'https://company.example/team',markdown:'Teemu Suursalmi\nHead of Hydrogen\nteemu.suursalmi@company.example',sourceRead:true}]})});
 r.b.saveCrmContacts=async(company,contacts)=>{started.resolve();await g.promise;return {ok:true,contacts:contacts.map(contact=>({...contact,id:'crm-teemu',company_id:company,workspace_id:'w'}))};};
 const pending=r.c.findPublicCandidateEmail(r.candidate,r.teemu);await started.promise;r.candidate.people.reverse();g.resolve();assert.equal(await pending,true);assert.equal(r.teemu.publicEmail,'teemu.suursalmi@company.example');assert.equal(r.klas.publicEmail,undefined);assert.equal(r.writes.length,1);
 }finally{r.close();}
});
test('a late failed policy refresh preserves the newer successful current-owner policy',async()=>{
 const r=runtime(),old=deferred();try{let requests=0;r.c.fetch=async()=>++requests===1?old.promise:{ok:true,json:async()=>({confirmationLevel:'public_confirmed'})};const first=r.c.refreshBuyerConfirmationPolicy();await r.c.refreshBuyerConfirmationPolicy();old.resolve({ok:false,status:503,json:async()=>({error:'Unavailable'})});await first;assert.equal(r.c.LeadIntelBuyerConfirmationPolicy.level(),'public_confirmed');}finally{r.close();}
});
test('an explicit legacy public confirmation keeps its original person owner through real research checkpoints',async()=>{
 const r=runtime(),started=deferred(),dossier=deferred();let pending,mandatory=0;try{delete r.teemu.publicEmail;delete r.teemu.publicEmailUrl;
 r.b.getCrmCompany=async()=>({ok:true,company:{id:'crm-company',normalized_domain:'company.example'},contacts:[]});
 r.c.LeadIntelDiscovery={...D,qualifyBuyer:()=>({eligible:true,gaps:[]}),buyerResearchCoveragePassed:candidate=>candidate.publicResearch?.accountability?.status==='complete',runOfficialContactResearch:async()=>({}),runMandatoryBuyerResearch:async(candidate,{accountability})=>{mandatory++;candidate.people[0].emailResearch={status:'complete',searches:11,failed:0};accountability.status='complete';accountability.gaps=[];return accountability;}};
 r.c.LeadIntelCompanyDossierUi={research:async()=>{started.resolve();return dossier.promise;},evidenceRows:()=>[]};r.c.reviewBuyerPublicEvidence=async()=>({status:'unavailable',conflicts:[]});r.c.confirmResearchedPublicEmails=async()=>{};r.c.fetch=async()=>({ok:true,json:async()=>({providers:[]})});r.c.LeadIntelDialogs={confirm:async()=>false};
 // Visible E-mail now requests paid-only work; exercise the retained legacy public path explicitly.
 pending=r.c.confirmBuyerContact(r.candidate,0,{kind:'email',additionalHandled:true,dataLookup:true,personId:'teemu'});await started.promise;
 const retained=r.candidate.people.find(person=>person.id==='teemu');dossier.resolve({});await pending.catch(()=>false);
 assert.equal(retained,r.teemu,'the first real research checkpoint must preserve the selected action owner');assert.equal(r.candidate.people.find(person=>person.id==='teemu'),r.teemu,'completed checkpoints retain the same owner');assert.equal(mandatory,1);assert.equal(r.teemu.emailResearch.searches,11);
 }finally{r.close();}
});
test('a completed real Buyer Agent assessment and AI review both sign the same retained evidence bundle',async()=>{
 const r=runtime();let reviews=0;try{
 r.c.LeadIntelDiscovery={...D,runOfficialContactResearch:async()=>({}),runMandatoryBuyerResearch:async(candidate,{accountability})=>{for(const person of candidate.people)person.emailResearch={status:'complete',searches:11,failed:0};accountability.status='complete';accountability.gaps=[];return accountability;}};
 const rows=[{url:'https://company.example/team',sourceRead:true,markdown:'# Fixture Company leadership\nTeemu Suursalmi\nHead of Hydrogen\nTeemu Suursalmi leads hydrogen project delivery.\n\nKlas Nilsson\nHead of Procurement\nKlas Nilsson leads procurement for Fixture Company.'}];
 r.c.LeadIntelCompanyDossierUi={research:async()=>({}),evidenceRows:()=>rows};r.c.confirmResearchedPublicEmails=async()=>{};
 r.c.fetchBuyerResearch=async(url,options)=>{assert.match(url,/contact-evidence-review/);reviews++;const input=JSON.parse(options.body);assert.ok(input.evidence.length>0&&input.evidence.length<=20);return {ok:true,json:async()=>({status:'complete',provider:'gemini',conflicts:[],supervisor:{status:'complete',reviewedPersonIds:['teemu','klas'],findings:[]}})};};
 assert.equal(await r.c.runPublicProspectContacts(r.candidate.domain,{researchOwner:r.candidate,manualContact:true}),true);assert.equal(reviews,1);
 const signature=D.buyerReviewSignature(r.candidate);assert.equal(r.candidate.publicResearch.buyerAgent.inputSignature,signature,'the just-completed Buyer Agent must remain current after AI review');assert.equal(r.candidate.publicResearch.aiReview.inputSignature,signature);assert.equal(D.buyerQualityAssessment(r.candidate).aiReviewStatus,'complete');assert.doesNotMatch(D.buyerQualityAssessment(r.candidate).requirements.find(row=>row.id==='buyer_agent').reason,/evidence changed/);
 }finally{r.close();}
});
test('a selected-person review signs retained full context while unreviewed roster coverage stays partial',async()=>{
 const r=runtime();let reviewed;try{
 r.c.LeadIntelDiscovery={...D,runOfficialContactResearch:async()=>({}),runMandatoryBuyerResearch:async(candidate,{accountability})=>{candidate.people[0].emailResearch={status:'complete',searches:11,failed:0};accountability.status='complete';accountability.gaps=[];return accountability;}};
 r.c.LeadIntelCompanyDossierUi={research:async()=>({}),evidenceRows:()=>[{url:'https://company.example/team',sourceRead:true,markdown:'Teemu Suursalmi\nHead of Hydrogen\nTeemu Suursalmi leads hydrogen project delivery for Fixture Company.'}]};r.c.confirmResearchedPublicEmails=async()=>{};
 r.c.fetchBuyerResearch=async(_url,options)=>{const input=JSON.parse(options.body);reviewed=input.people.map(person=>person.id);return {ok:true,json:async()=>({status:'complete',provider:'gemini',conflicts:[],supervisor:{status:'complete',reviewedPersonIds:reviewed,findings:[]}})};};
 assert.equal(await r.c.runPublicProspectContacts(r.candidate.domain,{researchOwner:r.candidate,personIds:['teemu'],manualContact:true}),true);assert.deepEqual(reviewed,['teemu']);
 const report=r.candidate.publicResearch,signature=D.buyerReviewSignature(r.candidate);assert.equal(report.aiReview.inputSignature,signature);assert.equal(report.buyerAgent.inputSignature,signature);assert.deepEqual(Array.from(report.aiReview.reviewedPersonIds),['teemu']);assert.deepEqual(Array.from(report.buyerAgent.people,person=>person.personId),['teemu']);assert.equal(D.buyerQualityAssessment(r.candidate).aiReviewStatus,'partial');assert.equal(D.buyerQualityAssessment(r.candidate).passed,false);
 r.klas.organization='Another employer';assert.notEqual(report.aiReview.inputSignature,D.buyerReviewSignature(r.candidate),'later changes in retained context still invalidate the saved review');
 }finally{r.close();}
});
