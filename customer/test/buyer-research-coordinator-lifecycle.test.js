const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function coordinator(){
 const first=deferred(),calls=[],owner={company:'Example',domain:'example.com',people:[{id:'a',name:'Ada Andersson'},{id:'b',name:'Bert Buyer'}]},state={workspace:'one',user:'owner'};
 const c={LeadIntelDiscovery:D,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,canonicalDomain:D.canonicalDomain,discovery:{selectedProspects:[owner]},mainState:()=>({profile:{}}),bridge:()=>({workspace:{id:state.workspace},session:{user:{id:state.user}}}),publicContactPromises:new Map(),runPublicProspectContacts:async(domain,options)=>{calls.push({domain,options,workspace:state.workspace,user:state.user});return calls.length===1?first.promise:true;}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows(')),c);return {c,first,calls,owner,state};
}
test('a forced selected-buyer refresh queued behind an unforced pass executes its own forced checks',async()=>{
 const {c,first,calls,owner}=coordinator();
 const initial=c.findPublicProspectContacts(owner.domain,{researchOwner:owner,personIds:['a']});
 const refresh=c.findPublicProspectContacts(owner.domain,{researchOwner:owner,personIds:['a'],force:true,manualContact:true});
 first.resolve(true);await Promise.all([initial,refresh]);
 assert.equal(calls.length,2,'force cannot be satisfied by an already-started unforced pass');assert.equal(calls[1].options.force,true);assert.equal(calls[1].options.manualContact,true);
});
test('an uncovered queued scope cannot start research in a replacement workspace',async()=>{
 const {c,first,calls,owner,state}=coordinator();
 const initial=c.findPublicProspectContacts(owner.domain,{personIds:['a']});
 const queued=c.findPublicProspectContacts(owner.domain,{personIds:['b']});
 state.workspace='two';c.discovery={selectedProspects:[{...owner,people:[...owner.people]}]};first.resolve(true);
 await initial;assert.equal(await queued,false);assert.equal(calls.length,1,'the queued request belongs to its starting workspace');
});
test('an uncovered queued scope cannot start after the signed-in user changes',async()=>{
 const {c,first,calls,owner,state}=coordinator();
 const initial=c.findPublicProspectContacts(owner.domain,{personIds:['a']});
 const queued=c.findPublicProspectContacts(owner.domain,{personIds:['b']});
 state.user='replacement';first.resolve(true);await initial;
 assert.equal(await queued,false);assert.equal(calls.length,1);
});
test('cancellation settles the shared run without starting its queued scopes',async()=>{
 const {c,first,calls,owner}=coordinator(),controller=new AbortController();
 const initial=c.findPublicProspectContacts(owner.domain,{signal:controller.signal,personIds:['a']});
 const queued=c.findPublicProspectContacts(owner.domain,{personIds:['b']});
 controller.abort();assert.equal(await initial,false);assert.equal(await queued,false);assert.equal(calls.length,1);
 first.resolve(true);
});

function runner(){
 const gate=deferred(),owner={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:[{id:'a',name:'Ada Andersson',publicName:'Ada Andersson',title:'Procurement Director',publicNameUrl:'https://example.com/team'}]},state={user:'owner'};
 const c={LeadIntelDiscovery:{...D,runOfficialContactResearch:async()=>({}),runMandatoryBuyerResearch:async(candidate,{accountability})=>{accountability.status='complete';accountability.gaps=[];return accountability;}},AbortController,Date,URL,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,PUBLIC_NAME_CHECK_VERSION:'v',discovery:{selectedProspects:[owner]},mainState:()=>({profile:{}}),canonicalDomain:D.canonicalDomain,bridge:()=>({workspace:{id:'workspace'},session:{user:{id:state.user}}}),crmAuthenticated:()=>false,saveDiscovery(){},renderPipeline(){},renderCandidates(){},showToast(){},confirmResearchedPublicEmails:async()=>{},reviewBuyerPublicEvidence:async()=>({status:'complete',conflicts:[]})};
 c.window={LeadIntelCompanyDossierUi:{research:async()=>gate.promise,evidenceRows:()=>[]}};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function runPublicProspectContacts('),source.indexOf('function scheduleSavedBuyerPublicChecks(')),c);return {c,owner,gate,state};
}
test('a user replacement prevents a late research result from writing buyer evidence',async()=>{
 const {c,owner,gate,state}=runner(),pending=c.runPublicProspectContacts(owner.domain,{researchOwner:owner});
 state.user='replacement';owner.people[0].publicEmail='newer@example.com';gate.resolve({});assert.equal(await pending,false);assert.equal(owner.people[0].publicEmail,'newer@example.com');
});
test('an edited same-ID buyer identity cannot be overwritten by an earlier research snapshot',async()=>{
 const {c,owner,gate}=runner(),pending=c.runPublicProspectContacts(owner.domain,{researchOwner:owner});
 owner.people=[{...owner.people[0],name:'Beth Berg',publicName:'Beth Berg',title:'Finance Director',publicEmail:'beth@example.com'}];gate.resolve({});
 assert.equal(await pending,false);assert.equal(owner.people[0].name,'Beth Berg');assert.equal(owner.people[0].publicEmail,'beth@example.com');
});
test('newer same-identity contact evidence cannot be overwritten by an earlier research snapshot',async()=>{
 const {c,owner,gate}=runner(),pending=c.runPublicProspectContacts(owner.domain,{researchOwner:owner});
 owner.people[0].publicEmail='newer@example.com';owner.people[0].publicEmailUrl='https://example.com/newer-contact';gate.resolve({});
 assert.equal(await pending,false);assert.equal(owner.people[0].publicEmail,'newer@example.com');assert.equal(owner.people[0].publicEmailUrl,'https://example.com/newer-contact');
});
test('a manual contact request joining existing automatic research suppresses automatic paid follow-up',async()=>{
 const {c,owner,gate}=runner();let automatic=0;
 c.publicContactPromises=new Map();c.window.LeadIntelAdditionalContacts={auto:async()=>{automatic++;}};
 vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows(')),c);
 const initial=c.findPublicProspectContacts(owner.domain,{researchOwner:owner,personIds:['a']});
 const manual=c.findPublicProspectContacts(owner.domain,{researchOwner:owner,personIds:['a'],manualContact:true});
 gate.resolve({});await Promise.all([initial,manual]);assert.equal(automatic,0,'joining an automatic run must retain explicit manual-contact intent');
});
test('an explicit forced contact refresh forwards refresh intent to company dossier research',async()=>{
 const {c,owner,gate}=runner();let options;
 c.window.LeadIntelCompanyDossierUi.research=async(_candidate,_context,settings)=>{options=settings;return gate.promise;};
 const pending=c.runPublicProspectContacts(owner.domain,{researchOwner:owner,force:true});gate.resolve({});await pending;assert.equal(options.force,true);
});
