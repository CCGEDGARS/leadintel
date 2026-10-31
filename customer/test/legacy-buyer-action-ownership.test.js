const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js'),ownership=require('./helpers/buyer-action-context.cjs');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function runtime(){
 const person={id:'public-anna',name:'Anna Buyer',title:'Procurement Director',organization:'Example',linkedin_url:'https://www.linkedin.com/in/anna-buyer'},other={id:'public-other',name:'Other Buyer',title:'Procurement Director',organization:'Example'},candidate={company:'Example',domain:'example.com',people:[person,other]},results=new Map(),calls=[],actions=[];
 const b={workspace:{id:'w'},session:{authenticated:true,user:{id:'u'}},getCrmCompany:async()=>({ok:true,contacts:[],phoneRequests:[]}),searchApolloPeople:async()=>({ok:true,people:[{id:'apollo-anna',name:person.name,title:person.title,organization:{name:'Example'},linkedin_url:person.linkedin_url}]}),enrichCrmContact:async(id,p)=>{calls.push(p.id);return {ok:true,contact:null,request:{status:'not_found'}};}};
 const c={console,Date,Promise,Map,Set,CONTACT_CONFIRM_VERSION:'test-version',LeadIntelDiscovery:D,discovery:{candidates:[candidate],selectedProspects:[],pipeline:[]},canonicalDomain:D.canonicalDomain,crmAuthenticated:()=>true,bridge:()=>b,personKey:(company,p)=>company.domain+'|'+p.id,enrichmentResults:results,enrichmentPending:new Set(),selectedBuyerEnrichment:new Set(),renderCandidates(){},renderPipeline(){},renderAll(){},saveDiscovery(){},showToast(){},ensureCrmCompany:async()=>({id:'company'}),refreshCrmState:async()=>{},findPublicCandidateEmail:async()=>false,window:{LeadIntelDialogs:{confirm:async()=>true},LeadIntelTaskCentre:{start(){},update(){},complete(){},fail(){},registerActions:(id,a)=>actions.push(a)},dispatchEvent(){}},CustomEvent:class{}};
 c.selectedBuyerKey=c.personKey;
 ownership.prepare(c,candidate);vm.createContext(c);vm.runInContext(ownership.source+source.slice(source.indexOf('async function resolveApolloBuyer('),source.indexOf('async function enrichContact('))+source.slice(source.indexOf('async function enrichContact('),source.indexOf('async function saveCandidate('))+source.slice(source.indexOf('async function enrichSelectedProspect('),source.indexOf('function publicResearchOutcome(')),c);
 return {c,b,person,other,candidate,results,calls,actions,eval:s=>vm.runInContext(s,c)};
}
test('explicit phone refresh follows stable person ID after cards reorder',async()=>{
 const r=runtime();r.candidate.people.reverse();r.b.getCrmCompany=async()=>({ok:true,contacts:[{id:'saved',external_person_id:r.person.id,name:r.person.name,linkedin_url:r.person.linkedin_url,phone_number:'+12025550142',phone_status:'verified'}],phoneRequests:[]});
 r.c.crmCompanyByDomain=()=>({id:'company'});assert.equal(await r.c.refreshEnrichedContact(0,0,{domain:'example.com',personId:r.person.id}),true);assert.equal(r.results.has('example.com|'+r.person.id),true);assert.equal(r.results.has('example.com|'+r.other.id),false);
 r.candidate.people=[r.other];assert.equal(await r.c.refreshEnrichedContact(0,0,{domain:'example.com',personId:r.person.id}),false);
});
for(const conflict of ['profile','employer','name boundary'])test('Apollo identity resolution rejects matching name with conflicting '+conflict,async()=>{
 const r=runtime();r.b.searchApolloPeople=async()=>({ok:true,people:[{id:'wrong',name:conflict==='name boundary'?'Ann A Buyer':r.person.name,organization:{name:conflict==='employer'?'Wrong employer':'Example'},linkedin_url:conflict==='profile'?'https://www.linkedin.com/in/wrong':r.person.linkedin_url}]});
 await assert.rejects(r.c.resolveApolloBuyer(r.candidate,r.person),/full name, employer and professional profile/);assert.equal(r.calls.length,0);
});
test('changing user while Apollo identity search waits prevents paid dispatch',async()=>{
 const r=runtime(),g=gate();r.b.searchApolloPeople=()=>g.promise;const pending=r.c.enrichContactWithApollo(0,0,{phoneLookup:true,approved:true});await new Promise(setImmediate);r.b.session.user.id='replacement';g.resolve({ok:true,people:[]});assert.equal(await pending,false);assert.equal(r.calls.length,0);assert.equal(r.results.size,0);
});
test('late provider completion cannot replace newer pending ownership or cache another user’s result',async()=>{
 const r=runtime(),g=gate();r.person.id='apollo-anna';r.b.enrichCrmContact=()=>g.promise;const pending=r.c.enrichContactWithApollo(0,0,{phoneLookup:true,approved:true});await new Promise(setImmediate);r.b.session.user.id='replacement';r.c.newToken=r.c.beginBuyerPending(r.c.captureBuyerAction(r.candidate,r.person));assert.ok(r.c.newToken);
 g.resolve({ok:true,contact:{name:r.person.name,external_person_id:'apollo-anna',phone_number:'+12025550142'}});assert.equal(await pending,false);assert.equal(r.results.size,0);assert.equal(r.eval('enrichmentPending.has("example.com|apollo-anna")'),true);
});
test('Apollo retry retains its original stable buyer after card reorder',async()=>{
 const r=runtime();r.person.id='apollo-anna';r.b.enrichCrmContact=async()=>({ok:false,error:'temporary failure'});await r.c.enrichContactWithApollo(0,0,{phoneLookup:true,approved:true});assert.equal(r.actions.length,1);r.candidate.people.reverse();let selected;
 r.b.enrichCrmContact=async(id,p)=>{selected=p.name;return {ok:true,contact:null,request:{status:'not_found'}};};assert.equal(await r.actions[0].retry(),true);assert.equal(selected,'Anna Buyer');r.candidate.people=[r.other];assert.equal(await r.actions[0].retry(),false);
});

test('automatic email and phone phases retain the selected buyer after cards reorder',async()=>{
 const r=runtime(),g=gate(),dispatched=[];r.person.flowConfirmEmail=r.person.flowConfirmPhone=true;
 r.c.confirmBuyerContact=async(candidate,index,options)=>{dispatched.push({kind:options.kind,id:candidate.people.find(p=>String(p.id)===String(options.personId))?.id||candidate.people[index]?.id});if(options.kind==='email')await g.promise;return true;};
 const run=r.c.runBuyerContactFlow(r.candidate,0,'company',{personId:r.person.id});await new Promise(setImmediate);r.candidate.people.reverse();g.resolve();await run;
 assert.deepEqual(dispatched,[{kind:'email',id:r.person.id},{kind:'phone',id:r.person.id}]);
});

test('flow checkbox mutates its stable buyer and rejects an obsolete target',()=>{
 const r=runtime();r.candidate.publicContactStatus='loading';r.candidate.people.reverse();const box={dataset:{flowDomain:'example.com',flowScope:'company',personIndex:'0',personId:r.person.id,flowConfirm:'email'},checked:true};
 r.c.toggleBuyerContactFlow(box);assert.equal(r.person.flowConfirmEmail,true);assert.equal(r.other.flowConfirmEmail,undefined);r.candidate.people=[r.other];r.c.toggleBuyerContactFlow(box);assert.equal(r.other.flowConfirmEmail,undefined);
});

test('actual selected-phone batch retains each original buyer after the first provider response reorders cards',async()=>{
 const r=runtime(),g=gate(),names=[];r.person.id='apollo-anna';r.other.id='apollo-other';r.c.discovery.selectedProspects=[r.candidate];for(const p of r.candidate.people)r.c.selectedBuyerEnrichment.add(r.c.selectedBuyerKey(r.candidate,p));
 r.b.searchApolloPeople=async()=>({ok:true,people:[r.person,r.other].map(p=>({id:'apollo-'+p.id,name:p.name,title:p.title,organization:{name:p.organization},linkedin_url:p.linkedin_url}))});
 r.b.enrichCrmContact=async(id,p)=>{names.push(p.name);if(names.length===1)await g.promise;return {ok:true,contact:null,request:{status:'not_found'}};};
 const run=r.c.enrichSelectedProspectBatch('example.com',true);await new Promise(setImmediate);r.candidate.people.reverse();g.resolve();assert.equal(await run,true);assert.deepEqual(names,['Anna Buyer','Other Buyer']);
});

test('selected batch cannot dispatch after its approving user changes',async()=>{
 const r=runtime(),g=gate();r.c.discovery.selectedProspects=[r.candidate];r.c.selectedBuyerEnrichment.add(r.c.selectedBuyerKey(r.candidate,r.person));r.c.window.LeadIntelDialogs.confirm=()=>g.promise;
 const run=r.c.enrichSelectedProspectBatch('example.com',true);r.b.session.user.id='replacement';g.resolve(true);assert.equal(await run,false);assert.equal(r.calls.length,0);
});

test('finishing an obsolete flow cannot delete the replacement user’s active flow',async()=>{
 const r=runtime(),old=gate(),fresh=gate();r.person.flowConfirmEmail=true;let calls=0;
 r.c.confirmBuyerContact=async()=>{calls++;return calls===1?old.promise:fresh.promise;};
 const first=r.c.runBuyerContactFlow(r.candidate,0,'company',{personId:r.person.id});await new Promise(setImmediate);r.b.session.user.id='replacement';const second=r.c.runBuyerContactFlow(r.candidate,0,'company',{personId:r.person.id});await new Promise(setImmediate);
 assert.equal(calls,2);old.resolve(true);assert.equal(await first,false);assert.equal(r.eval('contactFlowPromises.has("example.com|public-anna")'),true);
 fresh.resolve(true);assert.equal(await second,true);assert.equal(r.eval('contactFlowPromises.has("example.com|public-anna")'),false);
});

test('legacy public-to-Apollo identity changes stop before any paid lookup',async()=>{
 const r=runtime();assert.equal(await r.c.enrichContactWithApollo(0,0,{phoneLookup:true,approved:true}),false);assert.equal(r.calls.length,0);assert.match(r.results.get('example.com|public-anna').error,/approved Confirm data action/);
});

test('selected enrichment rejects malformed and incorrectly bound contact responses',async()=>{
 for(const result of [{ok:true},{ok:true,contact:{name:'Anna Buyer',phone_number:'+12025550142'}},{ok:true,contact:{id:'wrong',external_person_id:'apollo-other',name:'Other Buyer',company_id:'elsewhere',workspace_id:'w',phone_number:'+12025550142'}},{ok:true,contact:{id:'saved',external_person_id:'apollo-anna',name:'Ann A Buyer',company_id:'company',workspace_id:'w',phone_number:'+12025550142'}}]){
  const r=runtime();r.person.id='apollo-anna';r.c.discovery.selectedProspects=[r.candidate];r.b.enrichCrmContact=async()=>result;
  assert.equal(await r.c.enrichSelectedProspect('example.com',0,{phoneLookup:true,confirmed:true,personId:r.person.id}),false);assert.equal(r.results.size,0);
 }
});

test('provider-listed phone keeps its unverified wording in enrichment and refresh notifications',async()=>{
 const r=runtime(),toasts=[];r.person.id='apollo-anna';r.c.showToast=message=>toasts.push(message);const contact={id:'saved',external_person_id:r.person.id,name:r.person.name,company_id:'company',workspace_id:'w',phone_number:'+12025550142',phone_status:'provider_listed'};
 r.b.enrichCrmContact=async()=>({ok:true,contact,request:{status:'verified'}});assert.equal(await r.c.enrichContactWithApollo(0,0,{phoneLookup:true,approved:true}),true);
 r.c.crmCompanyByDomain=()=>({id:'company'});r.b.getCrmCompany=async()=>({ok:true,contacts:[contact],phoneRequests:[]});assert.equal(await r.c.refreshEnrichedContact(0,0,{domain:'example.com',personId:r.person.id}),true);
 assert.ok(toasts.every(message=>message.includes('phone listing (unverified)')));assert.ok(toasts.every(message=>!message.includes('verified phone')));
});
