const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {resolve,promise};}
function runner(){
 const gate=deferred(),people=[{id:'teemu',name:'Teemu Myllykangas',title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team'},{id:'klas',name:'Klas Buyer',title:'Engineering Director',organization:'Example',publicNameUrl:'https://example.com/team'}];
 const owner={company:'Example',domain:'example.com',buyerRoles:'Procurement Director; Engineering Director',people,buyerDiscovery:{companyDossier:{status:'partial',facts:[]}}};let dossierCandidate,mandatory=0,saves=0;
 const c={LeadIntelDiscovery:{...D,runOfficialContactResearch:async()=>({}),runMandatoryBuyerResearch:async(candidate,{accountability})=>{mandatory++;for(const person of candidate.people)person.emailResearch={status:'complete',searches:11,failed:0};accountability.status='complete';accountability.gaps=[];return accountability;}},AbortController,Date,URL,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,PUBLIC_NAME_CHECK_VERSION:'v',discovery:{selectedProspects:[owner]},mainState:()=>({profile:{}}),canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'workspace'},session:{user:{id:'user'}}}),crmAuthenticated:()=>false,saveDiscovery(){saves++;},renderPipeline(){},renderCandidates(){},showToast(){},confirmResearchedPublicEmails:async()=>{},reviewBuyerPublicEvidence:async()=>({status:'complete',conflicts:[]})};
 c.window={LeadIntelCompanyDossierUi:{research:async candidate=>{dossierCandidate=candidate;return gate.promise;},evidenceRows:()=>[]}};require('./helpers/strategy-discovery-context.cjs')(c);vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function runPublicProspectContacts('),source.indexOf('function scheduleSavedBuyerPublicChecks(')),c);
 return {c,owner,gate,get dossierCandidate(){return dossierCandidate;},get mandatory(){return mandatory;},get saves(){return saves;}};
}
test('Teemu and Klas retain their own research after the live shortlist reorders',async()=>{
 const h=runner(),pending=h.c.runPublicProspectContacts(h.owner.domain);h.owner.people.reverse();h.gate.resolve({});
 assert.equal(await pending,true);assert.equal(h.mandatory,1);assert.deepEqual(h.owner.people.map(p=>p.id),['klas','teemu']);assert.ok(h.owner.people.every(p=>p.emailResearch?.searches===11));
});
for(const changed of ['discovery','bridge','company'])test(`a replaced ${changed} cancels the old retained buyer research`,async()=>{
 const h=runner(),pending=h.c.runPublicProspectContacts(h.owner.domain),saved=h.saves;
 if(changed==='discovery')h.c.discovery={selectedProspects:[h.owner]};
 if(changed==='bridge')h.c.bridge=()=>({workspace:{id:'workspace'},session:{user:{id:'user'}}});
 if(changed==='company')h.owner.company='Different Company';
 h.gate.resolve({});assert.equal(await pending,false);assert.equal(h.mandatory,0);assert.equal(h.owner.people[0].emailResearch,undefined);
 if(changed!=='company')assert.equal(h.saves,saved,'old context cannot save into the replacement context');
});
test('late dossier mutations are isolated from retained evidence when the person is replaced',async()=>{
 const h=runner(),pending=h.c.runPublicProspectContacts(h.owner.domain);h.owner.people[0]={...h.owner.people[0],name:'Replacement Buyer'};
 h.dossierCandidate.buyerDiscovery.companyDossier.facts.push({claim:'Late old-company evidence'});h.gate.resolve({});
 assert.equal(await pending,false);assert.equal(h.owner.buyerDiscovery.companyDossier.facts.length,0);
});
function identityRunner(){
 const gate=deferred(),owner={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:[{id:'teemu',name:'Teemu Myllykangas',title:'Procurement Director'}]},state={selectedProspects:[owner],pipeline:[],candidates:[],potentialMatches:[]};let saves=0;
 const c={LeadIntelDiscovery:D,AbortController,Date,URL,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,discovery:state,mainState:()=>({profile:{decisionMakers:'Procurement Director'}}),canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'workspace'},session:{user:{id:'user'}}}),saveDiscovery(){saves++;},renderAll(){},showToast(){},fetchBuyerResearch:async()=>{},window:{LeadIntelCompanyDossierUi:{research:async()=>gate.promise,evidenceRows:()=>{throw Error('Stop after controlled dossier');}}}};
 require('./helpers/strategy-discovery-context.cjs')(c);vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function searchDecisionMakers('),source.indexOf('function saveLocalPipeline(')),c);
 return {c,owner,gate,state,get saves(){return saves;}};
}
for(const changed of ['removed','replaced'])test(`identity discovery cannot resurrect a ${changed} company after dossier research`,async()=>{
 const h=identityRunner(),pending=h.c.searchDecisionMakers(h.owner),replacement={...h.owner,company:'Replacement Example',people:[{id:'klas',name:'Klas Buyer',title:'COO'}]};
 h.state.selectedProspects=changed==='removed'?[]:[replacement];const saves=h.saves;h.gate.resolve({});
 assert.equal(await pending,false);assert.equal(h.saves,saves,'stale run must not persist into current working records');assert.deepEqual(h.state.selectedProspects,changed==='removed'?[]:[replacement]);
});
function officialRunner(){
 const owner={company:'North Works',domain:'north.example',people:[]},snapshots=[],blocked=deferred(),waiting=deferred(),checkpoint=deferred(),session={workspace:{id:'workspace'},session:{user:{id:'user'}}};
 const root='https://north.example/',contact=root+'contact',supplier=root+'supplier';
 const c={LeadIntelDiscovery:D,AbortController,Date,URL,setTimeout,clearTimeout,discovery:{selectedProspects:[owner]},mainState:()=>({profile:{}}),selectedProspects:()=>c.discovery.selectedProspects,canonicalDomain:D.canonicalDomain,bridge:()=>session,crmAuthenticated:()=>true,saveDiscovery(){snapshots.push(JSON.parse(JSON.stringify(owner)));if(owner.buyerDiscovery?.officialContactInventory?.channels.some(p=>p.value==='info@north.example'))checkpoint.resolve();},renderAll(){},showToast(){},crmCompanyByDomain:()=>null,searchBuyerPublicPages:async()=>[],fetchFirecrawlBuyerResearch:async(_kind,{url})=>{if(url===supplier){waiting.resolve();return blocked.promise;}return {ok:true,json:async()=>({data:{url,markdown:url===root?'# North Works\n[Contact]('+contact+')\n[Supplier]('+supplier+')':'# Contact\ninfo@north.example'}})};}};
 require('./helpers/strategy-discovery-context.cjs')(c);vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function refreshOfficialCompanyContacts('),source.indexOf('function companyContactDossierHtml(')),c);
 return {c,owner,snapshots,blocked,waiting,checkpoint,session,supplier};
}
test('official refresh persists the completed company contacts before a later supplier read finishes',async()=>{
 const h=officialRunner(),pending=h.c.refreshOfficialCompanyContacts(h.owner.domain);await h.waiting.promise;
 await new Promise(r=>setImmediate(r));
 const saved=h.snapshots.at(-1);h.blocked.resolve({ok:true,json:async()=>({data:{url:h.supplier,markdown:'# Supplier\nsuppliers@north.example'}})});assert.ok(saved.buyerDiscovery?.officialContactInventory?.channels.some(p=>p.value==='info@north.example'),'completed source evidence must already be durable');assert.ok(saved.buyerDiscovery.officialContactInventory.research.pendingUrls.includes(h.supplier));
 h.blocked.resolve({ok:true,json:async()=>({data:{url:h.supplier,markdown:'# Supplier\nsuppliers@north.example'}})});assert.equal(await pending,true);
});
test('a canceled public run cannot clear a replacement official refresh loading state',async()=>{
 const h=runner(),controller=new AbortController(),official=deferred();
 const publicRun=h.c.runPublicProspectContacts(h.owner.domain,{signal:controller.signal});controller.abort();
 h.c.selectedProspects=()=>h.c.discovery.selectedProspects;h.c.crmAuthenticated=()=>true;h.c.crmCompanyByDomain=()=>null;h.c.renderAll=()=>{};
 h.c.LeadIntelDiscovery={...h.c.LeadIntelDiscovery,runOfficialContactResearch:async()=>official.promise};
 vm.runInContext(source.slice(source.indexOf('async function refreshOfficialCompanyContacts('),source.indexOf('function companyContactDossierHtml(')),h.c);
 const replacement=h.c.refreshOfficialCompanyContacts(h.owner.domain);assert.equal(h.owner.publicContactStatus,'loading');h.gate.resolve({});
 assert.equal(await publicRun,false);const status=h.owner.publicContactStatus;official.resolve({});await replacement;assert.equal(status,'loading','cleanup must belong to the active contact operation');
});
for(const mode of ['removed','replaced'])test(`a selected research owner ${mode} during dossier await is canceled even if a discovery copy remains`,async()=>{
 const h=runner();h.c.discovery.candidates=[h.owner];const pending=h.c.runPublicProspectContacts(h.owner.domain);
 h.c.discovery.selectedProspects=mode==='removed'?[]:[{...h.owner,people:[...h.owner.people]}];h.gate.resolve({});assert.equal(await pending,false);assert.equal(h.mandatory,0);
});
test('manual paid-suppression intent survives forced and expanded scopes queued behind shared public research',async()=>{
 const h=runner(),first=deferred(),second=deferred(),calls=[];h.c.publicContactPromises=new Map();
 h.c.runPublicProspectContacts=async(domain,options)=>{calls.push(options);return calls.length===1?first.promise:calls.length===2?second.promise:true;};
 vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows(')),h.c);
 const initial=h.c.findPublicProspectContacts(h.owner.domain,{personIds:['teemu']}),manual=h.c.findPublicProspectContacts(h.owner.domain,{personIds:['klas'],force:true,manualContact:true}),expanded=h.c.findPublicProspectContacts(h.owner.domain,{personIds:['teemu','klas']});
 first.resolve(true);await new Promise(r=>setImmediate(r));second.resolve(true);await Promise.all([initial,manual,expanded]);assert.equal(calls.length,3);assert.equal(calls[1].force,true);assert.equal(calls[2].manualContact,true,'queued broad pass must keep the shared manual-contact spending boundary');
});
test('reloading a published official refresh checkpoint resumes only its unread supplier source',async()=>{
 const h=officialRunner(),pending=h.c.refreshOfficialCompanyContacts(h.owner.domain);await h.waiting.promise;await new Promise(r=>setImmediate(r));
 const saved=h.snapshots.at(-1);h.session.session.user.id='other-user';h.blocked.resolve({ok:true,json:async()=>({data:{url:h.supplier,markdown:'# Supplier\nlate@north.example'}})});assert.equal(await pending,false);
 const restored=D.recoverInterruptedDiscoveryState({selectedProspects:[{...saved,buyerSearchMode:'user_selected_target'}]}).selectedProspects[0],reads=[];h.c.discovery={selectedProspects:[restored]};h.session.session.user.id='user';
 h.c.fetchFirecrawlBuyerResearch=async(_kind,{url})=>{reads.push(url);return {ok:true,json:async()=>({data:{url,markdown:'# Supplier\nsuppliers@north.example'}})};};
 assert.equal(await h.c.refreshOfficialCompanyContacts(restored.domain),true);assert.deepEqual(reads,[h.supplier]);assert.equal(restored.buyerDiscovery.officialContactInventory.research.status,'complete');assert.ok(restored.buyerDiscovery.officialContactInventory.channels.some(p=>p.value==='info@north.example'));assert.ok(!restored.buyerDiscovery.officialContactInventory.channels.some(p=>p.value==='late@north.example'));
});
for(const result of [false,true])test(`public confirmation ${result?'with a lost research context':'returning false'} cannot invent confirmed contact evidence`,async()=>{
 const h=runner(),candidate={company:'Example',domain:'example.com',people:[{id:'teemu',name:'Teemu Myllykangas',title:'Procurement Director',publicEmail:'teemu@example.com',publicEmailUrl:'https://example.com/team'}]},gate=deferred();let current=true;
 h.c.crmAuthenticated=()=>true;h.c.publicBuyerSource=()=>true;h.c.personKey=(_candidate,person)=>person.id;h.c.enrichmentResults=new Map();h.c.confirmPublicBuyerSource=async()=>gate.promise;
 vm.runInContext(source.slice(source.indexOf('async function confirmResearchedPublicEmails('),source.indexOf('async function runPublicProspectContacts(')),h.c);
 const pending=h.c.confirmResearchedPublicEmails(candidate,new AbortController().signal,'workspace',()=>current,h.owner);if(result)current=false;gate.resolve(result);await pending;assert.equal(candidate.people[0].contactVerification,undefined);
});
test('the AI review receipt signs and retains exactly the bounded evidence supplied to the reviewer',async()=>{
 const h=runner(),candidate={...h.owner,publicResearch:{}},rows=[{url:'https://example.com/team',markdown:'# Example\nTeemu Myllykangas\nProcurement Director\nPublic source passage.'}];let request;
 h.c.crmAuthenticated=()=>true;h.c.LEADINTEL_API='https://api.example';h.c.fetchBuyerResearch=async(_url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({status:'complete',provider:'gemini',supervisor:{status:'complete',reviewedPersonIds:['teemu','klas']}})};};
 vm.runInContext(source.slice(source.indexOf('async function reviewBuyerPublicEvidence('),source.indexOf('async function confirmResearchedPublicEmails(')),h.c);
 const result=await h.c.reviewBuyerPublicEvidence(candidate,rows,new AbortController().signal);assert.deepEqual(JSON.parse(JSON.stringify(candidate.publicResearch.reviewEvidence)),request.evidence);assert.equal(result.aiReview.inputSignature,D.buyerReviewSignature(candidate));candidate.publicResearch.reviewEvidence[0].excerpt+=' changed';assert.notEqual(result.aiReview.inputSignature,D.buyerReviewSignature(candidate));
});
test('identity discovery stops before another provider when retained buyer evidence changes during dossier await',async()=>{
 const h=identityRunner();Object.assign(h.owner.people[0],{publicName:'Teemu Myllykangas',publicNameUrl:'https://example.com/team'});let websiteReads=0;h.c.window.LeadIntelCompanyDossierUi.evidenceRows=()=>[];h.c.window.LeadIntelFirstPartyResearch={collectWebsiteEvidence:async()=>{websiteReads++;return {pages:[]};}};
 const pending=h.c.searchDecisionMakers(h.owner);h.owner.people[0].publicEmail='newer@example.com';h.owner.people[0].publicEmailUrl='https://example.com/newer';h.gate.resolve({});
 assert.equal(await pending,false);assert.equal(websiteReads,0);assert.equal(h.owner.people[0].publicEmail,'newer@example.com');
});
test('identity discovery stops before another provider when company buying roles change during dossier await',async()=>{
 const h=identityRunner();let websiteReads=0;h.c.window.LeadIntelCompanyDossierUi.evidenceRows=()=>[];h.c.window.LeadIntelFirstPartyResearch={collectWebsiteEvidence:async()=>{websiteReads++;return {pages:[]};}};
 const pending=h.c.searchDecisionMakers(h.owner);h.owner.buyerRoles='Finance Director';h.gate.resolve({});assert.equal(await pending,false);assert.equal(websiteReads,0);assert.equal(h.owner.buyerRoles,'Finance Director');
});
