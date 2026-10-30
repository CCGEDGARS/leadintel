const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../discovery-engine.js');
const {createTaskCentre}=require('../background-task-centre.js');
const {buildAttentionItems}=require('../attention-centre-model.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function runtime(){
 let now=Date.now(),searches=0;
 const centre=createTaskCentre({now:()=>now});
 const snapshots=[],timers=new Map();let timerId=0;
 const candidate={company:'Example Mining',domain:'example.com',website:'https://example.com',market:'Sweden',buyerFit:{purchase:'plant equipment installation project procurement'},people:[]};
 const context={AbortController,Date,console,setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id),DISCOVERY_REQUEST_TIMEOUT_MS:25000,
  window:{LeadIntelTaskCentre:centre,LeadIntelFirstPartyResearch:{collectWebsiteEvidence:async()=>{now+=75000;return {pages:[]};}}},
  LeadIntelDiscovery:D,groundedGeminiPersonSearch:async()=>({status:'not_configured',provider:'gemini',results:[],reason:'Fixture has no Google connection'}),mainState:()=>({profile:{decisionMakers:'Procurement Director; Engineering Director'}}),canonicalDomain:D.canonicalDomain,showToast:()=>{},saveDiscovery:()=>{},renderAll:()=>{},discovery:{pipeline:[],selectedProspects:[candidate]},LEADINTEL_API:'https://api.example',BUYER_RESEARCH_VERSION:'test',PUBLIC_NAME_CHECK_VERSION:'test',confirmResearchedPublicEmails:async()=>{},crmAuthenticated:()=>true,crmCompanyByDomain:()=>null,
  bridge:()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[]})}),
  searchBuyerPublicPages:async()=>{if(searches++%4===0)now+=25000;return [];},
  fetchBuyerResearch:async()=>{now+=60000;const task=centre.list()[0];snapshots.push({task,card:{...candidate.buyerResearchProgress},attention:buildAttentionItems({tasks:centre.list(),workspaceStarted:false,now})});return {ok:true,json:async()=>({results:[]})};},
  findPublicProspectContacts:async()=>{},refreshCrmState:async()=>{}};
 require('./helpers/dossier-boundary.cjs')(context);vm.createContext(context);
 const helpers=source.slice(source.indexOf('function buyerResearchIncomplete('),source.indexOf('function buyerProviderStatusHtml('));
 vm.runInContext(helpers+source.slice(source.indexOf('async function searchDecisionMakers('),source.indexOf('function saveLocalPipeline'))+'\nthis.run=searchDecisionMakers;',context);
 return {context,candidate,centre,snapshots,timers};
}

test('completed public query batches and grounded cross-check report real task progress',async()=>{
 const {context,candidate,centre,snapshots}=runtime();
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);
 const grounded=snapshots[0];
 assert.equal(grounded.attention.some(item=>item.detail==='No progress has been reported for more than three minutes.'),false);
 assert.match(grounded.task.stage,/grounded/i);
 assert.match(grounded.card.label,/grounded/i);
 assert.equal(grounded.task.total,5);
 assert.equal(grounded.task.completed,1);
 assert.equal(centre.list()[0].status,'partial');assert.equal(candidate.publicResearch.accountability.status,'partial');
});

test('the buyer run deadline remains active during contact evidence and preserves researched identities on cancellation',async()=>{
 const {context,candidate,centre,timers}=runtime();let contactDeadline;
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[{id:'ada',name:'Ada Andersson',title:'Inköpschef',organization_name:candidate.company}]})});
 context.findPublicProspectContacts=async(domain,{signal})=>{
  contactDeadline=[...timers.values()].find(timer=>timer.delay>450000);
  assert.ok(contactDeadline?.delay<=1500000,'public handoff has a finite upper bound');
  if(contactDeadline)contactDeadline.fn();
  if(signal.aborted){candidate.publicContactStatus='error';candidate.people[0].emailResearch={status:'partial',searches:2,failed:1};}
 };
 assert.equal(await context.run(candidate,{allowCrmSync:false}),false);
 assert.ok(contactDeadline,'a fresh bounded deadline stays active when contact checks start');
 assert.equal(candidate.people[0].name,'Ada Andersson');
 assert.equal(candidate.people[0].emailResearch.status,'partial');
 assert.equal(candidate.buyerDiscovery.pool[0].name,'Ada Andersson');
 assert.equal(candidate.buyerDiscovery.researchIncomplete,true);
 assert.equal(candidate.buyerResearchProgress.phase,'error');
 assert.equal(centre.list()[0].status,'error');
 assert.equal(timers.size,0);
});

test('deadline while grounded research is pending retains newly acquired public identities as incomplete evidence',async()=>{
 const {context,candidate,timers}=runtime();
 context.searchBuyerPublicPages=async()=>[{url:'https://linkedin.com/in/ada-andersson',title:'Ada Andersson | Head of Procurement | Example Mining'}];
 context.fetchBuyerResearch=async()=>{[...timers.values()].find(timer=>timer.delay===450000).fn();throw Object.assign(new Error('Buyer research canceled'),{name:'AbortError'});};
 assert.equal(await context.run(candidate,{allowCrmSync:false}),false);
 assert.ok(candidate.buyerDiscovery.pool?.some(person=>person.name==='Ada Andersson'));
 assert.ok(candidate.buyerDiscovery.resultDiagnostics.some(row=>row.accepted&&row.parsedName==='Ada Andersson'));
 assert.equal(candidate.buyerDiscovery.researchIncomplete,true);
 assert.equal(candidate.buyerResearchProgress.phase,'error');
});

test('incomplete buyer evidence finishes its task with warnings',async()=>{
 const {context,candidate,centre}=runtime();
 context.fetchBuyerResearch=async()=>{throw new Error('Grounded provider unavailable');};
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);
 assert.equal(candidate.buyerDiscovery.researchIncomplete,true);
 assert.equal(centre.list()[0].status,'partial');
});

test('contact source checkpoints reach the active buyer task and saved evidence',async()=>{
 const {context,candidate,centre}=runtime();
 const checks=[];
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[{id:'ada',name:'Ada Andersson',title:'Inköpschef',organization_name:candidate.company}]})});
 context.findPublicProspectContacts=async(domain,{onProgress})=>{
  candidate.people[0].emailResearch={status:'partial',searches:2,failed:0};
  onProgress({label:'Verifying public contact evidence · 0/1 people checked'});
  checks.push({task:centre.list()[0],card:{...candidate.buyerResearchProgress}});
  candidate.people[0].emailResearch={status:'complete',searches:7,failed:0};
  candidate.publicContactStatus='complete';
 };
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);
 assert.equal(checks[0].task.stage,'Verifying public contact evidence · 0/1 people checked');
 assert.equal(checks[0].card.label,checks[0].task.stage);
 assert.equal(candidate.buyerDiscovery.pool[0].emailResearch.status,'complete');
});

test('public contact runner emits source checkpoints while retaining independent channel outcomes',async()=>{
 const person={id:'ada',name:'Ada Andersson',title:'Procurement Director',organization:'Example',publicLinkedinUrl:'https://linkedin.com/in/ada-andersson'};
 const owner={company:'Example',domain:'example.com',buyerRoles:'Procurement Director',people:[person]};
 const reports=[];let at=Date.now();
 class Clock extends Date{static now(){return at;}}
 const context={LeadIntelDiscovery:D,groundedGeminiPersonSearch:async()=>({status:'not_configured',provider:'gemini',results:[],reason:'Fixture has no Google connection'}),canonicalDomain:D.canonicalDomain,Date:Clock,URL,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,PUBLIC_NAME_CHECK_VERSION:'test',
  discovery:{selectedProspects:[owner]},mainState:()=>({}),bridge:()=>({workspace:{id:'workspace'}}),confirmResearchedPublicEmails:async()=>{},crmAuthenticated:()=>false,saveDiscovery:()=>{},renderPipeline:()=>{},renderCandidates:()=>{},showToast:()=>{},
  searchBuyerEmailPatterns:async(candidate,rows,signal,{onProgress})=>{
   candidate.people[0].emailResearch={status:'partial',searches:1,failed:0};onProgress();
   at+=1000;candidate.people[0].emailResearch={status:'complete',searches:7,failed:0};onProgress();
   return {searches:7,failed:0,evidence:[]};
  },searchBuyerPublicPages:async()=>[],scrapeOfficialContactPage:async()=>null,groundedBuyerFollowUp:async()=>({status:'complete',rows:[]}),reviewBuyerPublicEvidence:async()=>{assert.equal(owner.publicContactStatus,'loading','the research action must stay busy until AI review finishes');return {status:'complete',conflicts:[]};}};
 require('./helpers/dossier-boundary.cjs')(context);vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('async function runPublicProspectContacts('),source.indexOf('function scheduleSavedBuyerPublicChecks('))+'\nthis.run=runPublicProspectContacts;',context);
 assert.equal(await context.run(owner.domain,{onProgress:report=>reports.push(report.label)}),true);
 assert.ok(reports.includes('Verifying public contact evidence · 0/1 people checked'));
 assert.ok(reports.includes('Verifying public contact evidence · 1/1 people checked'));
 assert.equal(reports.includes('Cross-checking public contact evidence with grounded research'),false,'known identities use the mandatory pass without repeating the legacy research pipeline');
 assert.ok(reports.includes('AI supervisor: checking research coverage · Buyer Agent evidence'));
 assert.equal(owner.people[0].emailResearch.status,'complete');
 assert.equal(owner.buyerDiscovery.pool[0].emailResearch.status,'complete');
});

test('a contact promise that ignores abort cannot leave the buyer task running past its deadline',async()=>{
 const {context,candidate,centre,timers}=runtime();
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[{id:'ada',name:'Ada Andersson',title:'Inköpschef',organization_name:candidate.company}]})});
 context.findPublicProspectContacts=async()=>{candidate.publicContactStatus='loading';[...timers.values()].find(timer=>timer.delay>450000)?.fn();return new Promise(()=>{});};
 const result=await context.run(candidate,{allowCrmSync:false});
 assert.equal(result,false);
 assert.equal(candidate.peopleStatus,'error');
 assert.equal(candidate.publicContactStatus,'error');
 assert.equal(candidate.buyerDiscovery.researchIncomplete,true);
 assert.equal(candidate.buyerDiscovery.pool[0].name,'Ada Andersson');
 assert.equal(centre.list()[0].status,'error');
});

test('late buyer provider results cannot write into a different workspace with the same company',async()=>{
 const {context,candidate,centre}=runtime();
 const other={...candidate,people:[{id:'other',name:'Other Buyer',title:'Director'}]};let savesAfterSwitch=0;
 context.saveDiscovery=()=>{if(context.discovery.selectedProspects[0]===other)savesAfterSwitch++;};
 context.fetchBuyerResearch=async()=>{
  context.discovery={pipeline:[],selectedProspects:[other]};
  context.bridge=()=>({workspace:{id:'different-workspace'},searchApolloPeople:async()=>({ok:true,people:[]})});
  return {ok:true,json:async()=>({results:[{url:'https://linkedin.com/in/ada-andersson',title:'Ada Andersson | Head of Procurement | Example Mining'}]})};
 };
 assert.equal(await context.run(candidate,{allowCrmSync:false}),false);
 assert.equal(context.discovery.selectedProspects[0],other);
 assert.equal(other.people[0].name,'Other Buyer');
 assert.equal(savesAfterSwitch,0);
 assert.equal(centre.list()[0].status,'error');
});

test('a fulfilled public query in an interrupted batch is retained when a sibling ignores cancellation',{timeout:2000},async()=>{
 const {context,candidate,centre,timers}=runtime();let searches=0;
 context.searchBuyerPublicPages=async query=>{
  if(/\(contact OR contacts OR kontakt OR team\)|\(management OR leadership OR ledning OR executive\)|\(investor-contacts OR press-contact|\(supplier OR procurement OR contact OR kontakt\)|site:news\.cision\.com\/|\(privacy OR invoices OR accounting OR supplier\)/.test(query))return [];
  const index=searches++;
  if(index===0)return [{url:'https://linkedin.com/in/ada-andersson',title:'Ada Andersson | Head of Procurement | Example Mining'}];
  if(index===1){await new Promise(resolve=>setTimeout(resolve,5));[...timers.values()].find(timer=>timer.delay===450000).fn();}
  return new Promise(()=>{});
 };
 const result=await context.run(candidate,{allowCrmSync:false});
 assert.equal(result,false);
 assert.ok(candidate.buyerDiscovery.pool?.some(person=>person.name==='Ada Andersson'));
 assert.ok(candidate.buyerDiscovery.resultDiagnostics.some(row=>row.accepted&&row.parsedName==='Ada Andersson'));
 assert.equal(candidate.buyerDiscovery.researchIncomplete,true);
 assert.equal(centre.list()[0].status,'error');
});

function publicCrmRuntime(boundary){
 const person={id:'ada',name:'Ada Andersson',title:'Procurement Director',organization:'Old company',publicLinkedinUrl:'https://linkedin.com/in/ada-andersson'};
 const owner={company:'Old company',domain:'example.com',buyerRoles:'Procurement Director',people:[person]};
 const calls=[],events=[],parent=new AbortController();let savesAfterSwitch=0;
 const context={LeadIntelDiscovery:D,groundedGeminiPersonSearch:async()=>({status:'not_configured',provider:'gemini',results:[],reason:'Fixture has no Google connection'}),canonicalDomain:D.canonicalDomain,Date,URL,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,PUBLIC_NAME_CHECK_VERSION:'test',CustomEvent:class{},
  discovery:{selectedProspects:[owner]},mainState:()=>({}),confirmResearchedPublicEmails:async()=>{},crmAuthenticated:()=>true,crmCompanyByDomain:()=>null,
  saveDiscovery:()=>{if(bridge.workspace.id!=='old-workspace')savesAfterSwitch++;},renderPipeline:()=>{},renderCandidates:()=>{},showToast:()=>{},
  window:{LeadIntelCrm:{mapContacts:people=>people,mapDiscoveryCandidateToCrm:c=>({company:c.company})},dispatchEvent:event=>events.push(event)},
  searchBuyerEmailPatterns:async()=>({searches:0,failed:0,evidence:[]}),searchBuyerPublicPages:async()=>[],scrapeOfficialContactPage:async()=>null,groundedBuyerFollowUp:async()=>({status:'complete',rows:[]}),reviewBuyerPublicEvidence:async()=>{assert.equal(owner.publicContactStatus,'loading','the research action must stay busy until AI review finishes');return {status:'complete',conflicts:[]};}};
 const bridge={workspace:{id:'old-workspace'},
  listCrmCompanies:async()=>{boundary?.('lookup',{context,bridge,parent});return {ok:true,companies:[{id:'old-company',normalized_domain:owner.domain}]};},
  saveCrmContacts:async(id,people)=>{calls.push({type:'contacts',workspace:bridge.workspace.id,id,names:people.map(p=>p.name)});boundary?.('contacts',{context,bridge,parent});return {ok:true};},
  saveCrmCompany:async payload=>{calls.push({type:'snapshot',workspace:bridge.workspace.id,payload});return {ok:true};}};
 context.bridge=()=>bridge;
 require('./helpers/dossier-boundary.cjs')(context);vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function runPublicProspectContacts('),source.indexOf('function scheduleSavedBuyerPublicChecks('))+'\nthis.run=runPublicProspectContacts;',context);
 return {context,owner,calls,events,parent,savesAfterSwitch:()=>savesAfterSwitch};
}
for(const phase of ['lookup','contacts'])test(`public contact CRM sync stops after a workspace switch during ${phase}`,async()=>{
 const {context,owner,calls,events,parent,savesAfterSwitch}=publicCrmRuntime((boundary,{context,bridge})=>{
  if(boundary!==phase)return;
  bridge.workspace={id:'new-workspace'};context.discovery={selectedProspects:[{company:'New company',domain:owner.domain,people:[]}]};
 });
 assert.equal(await context.run(owner.domain,{signal:parent.signal}),false);
 assert.equal(calls.length,phase==='lookup'?0:1);
 assert.equal(calls.some(call=>call.workspace==='new-workspace'),false);
 assert.equal(events.length,0);
 assert.equal(savesAfterSwitch(),0);
});

test('public contact CRM sync stops after cancellation during company lookup',async()=>{
 const {context,owner,calls,events,parent}=publicCrmRuntime((boundary,{parent})=>{if(boundary==='lookup')parent.abort();});
 assert.equal(await context.run(owner.domain,{signal:parent.signal}),false);
 assert.deepEqual(calls,[]);assert.deepEqual(events,[]);
 assert.equal(owner.publicContactStatus,'error');
});

test('a pending contact lookup from another workspace cannot block the same domain in the current workspace',async()=>{
 let workspaceId='first',release;const calls=[];
 const context={LeadIntelDiscovery:D,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,canonicalDomain:D.canonicalDomain,discovery:{selectedProspects:[{domain:'example.com',people:[]}]},mainState:()=>({profile:{}}),publicContactPromises:new Map(),bridge:()=>({workspace:{id:workspaceId}}),runPublicProspectContacts:async domain=>{calls.push({domain,workspaceId});return workspaceId==='first'?new Promise(resolve=>{release=resolve;}):true;}};
 require('./helpers/dossier-boundary.cjs')(context);vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows('))+'\nthis.run=findPublicProspectContacts;',context);
 const first=context.run('example.com');workspaceId='second';
 const second=await Promise.race([context.run('example.com'),new Promise(resolve=>setTimeout(()=>resolve('hung'),50))]);
 release(false);await first;
 assert.equal(second,true);assert.equal(calls.length,2);
});

test('canceling a shared contact lookup allows immediate retry and old completion cannot detach its replacement',async()=>{
 let calls=0,releaseOld,releaseNew;
 const context={LeadIntelDiscovery:D,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,canonicalDomain:D.canonicalDomain,discovery:{selectedProspects:[{domain:'example.com',people:[]}]},mainState:()=>({profile:{}}),publicContactPromises:new Map(),bridge:()=>({workspace:{id:'workspace'}}),runPublicProspectContacts:async()=>{calls++;return new Promise(resolve=>{if(calls===1)releaseOld=resolve;else releaseNew=resolve;});}};
 require('./helpers/dossier-boundary.cjs')(context);vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows('))+'\nthis.run=findPublicProspectContacts;',context);
 const controller=new AbortController();const old=context.run('example.com',{signal:controller.signal});controller.abort();
 const fresh=context.run('example.com');
 const canceled=await Promise.race([old,new Promise(resolve=>setTimeout(()=>resolve('hung'),50))]);
 assert.equal(canceled,false);assert.equal(calls,2);
 releaseOld(false);await Promise.resolve();assert.equal(context.publicContactPromises.size,1);
 releaseNew(true);assert.equal(await fresh,true);assert.equal(context.publicContactPromises.size,0);
});

test('standalone public contact deadline settles an ignored await and its late runner cannot overwrite a successful retry',async()=>{
 const {context,owner,calls}=publicCrmRuntime();const timers=new Map(),runs=[];let id=0,releaseOld,entered;
 owner.people[0].publicNameUrl='https://example.com/team';const began=new Promise(resolve=>{entered=resolve;});
 context.setTimeout=(fn,delay)=>{timers.set(++id,{fn,delay});return id;};context.clearTimeout=id=>timers.delete(id);context.publicContactPromises=new Map();
 const actual=context.run;context.runPublicProspectContacts=(...args)=>{const run=actual(...args);runs.push(run);return run;};
 context.fetchFirecrawlBuyerResearch=async()=>{entered();return new Promise(resolve=>{releaseOld=resolve;});};
 vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows('))+'\nthis.find=findPublicProspectContacts;',context);
 const old=context.find(owner.domain);await began;[...timers.values()].find(timer=>timer.delay>450000).fn();
 assert.equal(await Promise.race([old,new Promise(resolve=>setTimeout(()=>resolve('hung'),50))]),false);assert.equal(owner.publicContactStatus,'error');assert.equal(context.publicContactPromises.size,0);
 context.fetchFirecrawlBuyerResearch=async()=>({ok:true,json:async()=>({data:{markdown:'Ada Andersson — Procurement Director — Old company. Published company team information.'}})});
 assert.equal(await context.find(owner.domain),true);assert.equal(owner.people[0].emailResearch.status,'complete');const saved=JSON.stringify(owner);
 releaseOld({ok:true,json:async()=>({data:{markdown:'Old late result'}})});assert.equal(await runs[0],false);assert.equal(JSON.stringify(owner),saved);assert.equal(calls.length,2);assert.equal(context.publicContactPromises.size,0);assert.equal(timers.size,0);
});

test('canceling a new subscriber detaches an older shared contact lookup so retry can start immediately',async()=>{
 let calls=0,releaseOld;
 const context={LeadIntelDiscovery:D,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,canonicalDomain:D.canonicalDomain,discovery:{selectedProspects:[{domain:'example.com',people:[]}]},mainState:()=>({profile:{}}),publicContactPromises:new Map(),bridge:()=>({workspace:{id:'workspace'}}),runPublicProspectContacts:async()=>++calls===1?new Promise(resolve=>{releaseOld=resolve;}):true};
 require('./helpers/dossier-boundary.cjs')(context);vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows('))+'\nthis.run=findPublicProspectContacts;',context);
 const old=context.run('example.com'),controller=new AbortController(),subscriber=context.run('example.com',{signal:controller.signal});controller.abort();
 assert.equal(await subscriber,false);assert.equal(await old,false);
 assert.equal(await context.run('example.com'),true);assert.equal(calls,2);releaseOld(false);
});

for(const shadowList of ['', 'selectedProspects', 'candidates'])test(`pipeline contact evidence and reload state survive ${shadowList||'no'} duplicate owner`,async()=>{
 const {context,candidate,centre}=runtime();candidate.saved=true;
 context.window.LeadIntelFirstPartyResearch.collectWebsiteEvidence=async()=>({pages:[{url:'https://example.com/team',text:'**Ada Andersson**\nInköpschef\nExample Mining company team and public procurement contact information.',fetchedAt:new Date().toISOString()}]});
 context.discovery={pipeline:[candidate],selectedProspects:[]};context.publicContactPromises=new Map();context.URL=URL;context.renderPipeline=()=>{};context.renderCandidates=()=>{};
 if(shadowList)context.discovery[shadowList]=[{...candidate,people:[]}];
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[{id:'ada',name:'Ada Andersson',title:'Inköpschef',organization_name:candidate.company,linkedin_url:'https://linkedin.com/in/ada-andersson'}]})});
 context.searchBuyerEmailPatterns=async(owner,rows,signal,{onProgress}={})=>{owner.people[0].emailResearch={status:'complete',searches:7,failed:0,checkedAt:new Date().toISOString()};onProgress?.();return {searches:7,failed:0,evidence:[]};};
 context.scrapeOfficialContactPage=async()=>null;context.groundedBuyerFollowUp=async()=>({status:'complete',rows:[]});context.reviewBuyerPublicEvidence=async()=>({status:'complete',conflicts:[]});
 vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows('))+source.slice(source.indexOf('async function runPublicProspectContacts('),source.indexOf('function scheduleSavedBuyerPublicChecks(')),context);
 assert.equal(await context.run(candidate,{pipeline:true,allowCrmSync:false}),true);
 const saved=context.discovery.pipeline[0];
 assert.equal(saved.people[0].emailResearch.status,'complete');assert.equal(saved.people[0].emailResearch.searches,13);
 assert.equal(saved.buyerDiscovery.pool[0].emailResearch.status,'complete');
 assert.equal(saved.publicContactVersion,'test');assert.notEqual(saved.publicContactStatus,'loading');
 assert.equal(centre.list()[0].status,'complete');
 const restored=D.normalizeDiscoveryState({pipeline:[saved]}).pipeline[0];
 assert.equal(restored.people[0].emailResearch.status,'complete');assert.equal(restored.buyerDiscovery.pool[0].emailResearch.searches,13);
 if(shadowList)assert.equal(context.discovery[shadowList][0].people.length,0);
});

test('persisting one buyer run preserves other active pipeline owners',async()=>{
 const {context,candidate}=runtime();candidate.saved=true;
 const other={company:'Other company',domain:'other.example',people:[],publicContactStatus:'loading'};
 context.discovery={pipeline:[candidate,other],selectedProspects:[]};
 assert.equal(await context.run(candidate,{pipeline:true,allowCrmSync:false}),true);
 assert.equal(context.discovery.pipeline.find(row=>row.domain===other.domain),other);
});

test('pipeline search entry preserves unrelated active contact owners before its first phase',async()=>{
 const {context,candidate}=runtime();const other={company:'Other company',domain:'other.example',people:[],publicContactStatus:'loading'};
 context.discovery={candidates:[],pipeline:[candidate,other],selectedProspects:[]};context.pipelineRows=()=>[candidate,other];context.renderPipeline=()=>{};
 context.window.LeadIntelPageQuality={require:()=>false,getReport:()=>({message:'Research held'})};
 vm.runInContext(source.slice(source.indexOf('function findPipelineDecisionMakers('),source.indexOf('async function searchDecisionMakers(')),context);
 assert.equal(await context.findPipelineDecisionMakers(0),false);
 assert.equal(context.discovery.pipeline[1],other);
});

test('shared contact research for a different owner cannot displace the requested current owner',async()=>{
 const firstOwner={domain:'example.com'},requestedOwner={domain:'example.com'};let releaseOld;const calls=[];
 const context={LeadIntelDiscovery:D,AbortController,setTimeout,clearTimeout,DISCOVERY_REQUEST_TIMEOUT_MS:25000,canonicalDomain:D.canonicalDomain,discovery:{selectedProspects:[firstOwner],pipeline:[requestedOwner]},publicContactPromises:new Map(),bridge:()=>({workspace:{id:'workspace'}}),runPublicProspectContacts:async(domain,{researchOwner})=>{calls.push(researchOwner);return researchOwner===firstOwner?new Promise(resolve=>{releaseOld=resolve;}):true;}};
 require('./helpers/dossier-boundary.cjs')(context);vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function findPublicProspectContacts('),source.indexOf('function publicSearchRows('))+'\nthis.run=findPublicProspectContacts;',context);
 const old=context.run('example.com',{researchOwner:firstOwner});
 const current=await Promise.race([context.run('example.com',{researchOwner:requestedOwner}),new Promise(resolve=>setTimeout(()=>resolve('hung'),50))]);
 releaseOld(false);await old;
 assert.equal(current,true);assert.deepEqual(calls,[firstOwner,requestedOwner]);
});

test('an explicit detached or wrong-domain contact owner cannot fall back to another saved company',async()=>{
 for(const invalid of ['detached','domain']){
  const {context,owner,calls}=publicCrmRuntime();const requested={...owner,domain:invalid==='domain'?'other.example':owner.domain};
  if(invalid==='domain')context.discovery.pipeline=[requested];
  assert.equal(await context.run(owner.domain,{researchOwner:requested}),false);
  assert.deepEqual(calls,[]);assert.equal(owner.publicContactStatus,undefined);
 }
});

test('completed industrial buyer research keeps approved Team Leadership roles valid after normalization and reload',async()=>{
 const {context,candidate}=runtime();
 const roles=['CEO/Owner','Team Leadership','Project Director','Operations','Production','Procurement','Engineering Director'];
 const main={profile:{priorityOffers:'Drawing development, metal manufacturing, installation and qualified workforce',decisionMakers:roles.join('; ')},market:{icps:[{id:'icp-core',type:'core',active:true,buyerRoles:roles.join('; ')}]}};
 context.mainState=()=>main;candidate.buyerRoles=roles.join('; ');candidate.buyerFit={purchase:'procurement contracts'};
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[{id:'ada',name:'Ada Andersson',title:'Inköpschef',organization_name:candidate.company}]})});
 context.findPublicProspectContacts=async()=>{candidate.people[0].emailResearch={status:'complete',searches:7,failed:0,checkedAt:new Date().toISOString()};candidate.publicContactStatus='complete';};
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);
 assert.equal(candidate.buyerRolesChanged,false);assert.equal(candidate.buyerRoles.length,12);
 const stored=JSON.stringify(D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target'}]}));
 const restored={LeadIntelDiscovery:D,localStorage:{getItem:()=>stored},DISCOVERY_STORAGE_KEY:'discovery',MAIN_STORAGE_KEY:'main',recoveredInterruptedRun:false,mainState:()=>main,window:{}};
 vm.createContext(restored);vm.runInContext(source.slice(source.indexOf('function loadDiscovery('),source.indexOf('function saveDiscovery(')),restored);
 const loaded=restored.loadDiscovery().selectedProspects[0];
 assert.equal(loaded.buyerRolesChanged,false);assert.equal(loaded.people[0].name,'Ada Andersson');
 assert.equal(D.buyerSelectionRoles({decisionMakers:loaded.buyerRoles}).length,12);
});

test('a researched company-specific role edit remains selected after its hold clears and the workspace reloads',async()=>{
 const {context,candidate}=runtime();
 const main={profile:{priorityOffers:'Industrial installation and qualified workforce',decisionMakers:'Project Director; Procurement Director'},market:{icps:[{id:'icp-core',type:'core',active:true,buyerRoles:'Project Director; Procurement Director'}]}};
 context.mainState=()=>main;candidate.buyerRoles='HR Director; Procurement Director';candidate.buyerRolesChanged=true;candidate.buyerFit={purchase:'procurement contracts'};
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[{id:'ada',name:'Ada Andersson',title:'Inköpschef',organization_name:candidate.company}]})});
 context.findPublicProspectContacts=async()=>{candidate.people[0].emailResearch={status:'complete',searches:7,failed:0,checkedAt:new Date().toISOString()};candidate.publicContactStatus='complete';};
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);assert.equal(candidate.buyerRolesChanged,false);
 const snapshot=require('../crm-engine.js').mapDiscoveryCandidateToCrm(candidate).intelligence.research_snapshot.buyerResearch;
 assert.equal(snapshot.discovery.roleSelectionContext,D.buyerRoleSelectionContext(main));
 const fromCrm=D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target',people:snapshot.buyers,buyerDiscovery:{...snapshot.discovery,checkedAt:snapshot.checkedAt}}]}).selectedProspects[0];
 assert.equal(fromCrm.buyerDiscovery.roleSelectionContext,D.buyerRoleSelectionContext(main));
 assert.ok(D.buyerRolesForTarget(main,fromCrm).includes('HR Director'));
 const stored=JSON.stringify(D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target'}]}));
 const restored={LeadIntelDiscovery:D,localStorage:{getItem:()=>stored},DISCOVERY_STORAGE_KEY:'discovery',MAIN_STORAGE_KEY:'main',recoveredInterruptedRun:false,mainState:()=>main,window:{}};
 vm.createContext(restored);vm.runInContext(source.slice(source.indexOf('function loadDiscovery('),source.indexOf('function saveDiscovery(')),restored);
 const loaded=restored.loadDiscovery().selectedProspects[0];
 assert.equal(loaded.buyerRolesChanged,false);assert.ok(loaded.buyerRoles.includes('HR Director'));
});

test('researched roles are invalidated by a real core role edit after save and reload',async()=>{
 const {context,candidate}=runtime();
 const roles=['CEO/Owner','Team Leadership','Project Director','Operations','Production','Procurement','Engineering Director'];
 const main={profile:{priorityOffers:'Metal manufacturing and installation',decisionMakers:roles.join('; ')},market:{icps:[{id:'icp-core',type:'core',active:true,buyerRoles:roles.join('; ')}]}};
 context.mainState=()=>main;candidate.buyerRoles=roles.join('; ');candidate.buyerFit={purchase:'procurement contracts'};
 context.bridge=()=>({workspace:{id:'workspace'},searchApolloPeople:async()=>({ok:true,people:[{id:'ada',name:'Ada Andersson',title:'Inköpschef',organization_name:candidate.company}]})});
 context.findPublicProspectContacts=async()=>{candidate.people[0].emailResearch={status:'complete',searches:7,failed:0,checkedAt:new Date().toISOString()};candidate.publicContactStatus='complete';};
 assert.equal(await context.run(candidate,{allowCrmSync:false}),true);assert.equal(candidate.buyerRolesChanged,false);
 const stored=JSON.stringify(D.normalizeDiscoveryState({selectedProspects:[{...candidate,buyerSearchMode:'user_selected_target'}]}));
 for(const changed of [roles.filter(role=>role!=='Team Leadership').concat('Maintenance Director'),roles.filter(role=>role!=='Engineering Director').concat('Maintenance Director')]){
  const updated=JSON.parse(JSON.stringify(main));updated.profile.decisionMakers=changed;updated.market.icps[0].buyerRoles=changed;
  const restored={LeadIntelDiscovery:D,localStorage:{getItem:()=>stored},DISCOVERY_STORAGE_KEY:'discovery',MAIN_STORAGE_KEY:'main',recoveredInterruptedRun:false,mainState:()=>updated,window:{}};
  vm.createContext(restored);vm.runInContext(source.slice(source.indexOf('function loadDiscovery('),source.indexOf('function saveDiscovery(')),restored);
  const loaded=restored.loadDiscovery().selectedProspects[0];
  assert.equal(loaded.buyerRolesChanged,true);assert.ok(loaded.buyerRoles.includes('Maintenance Director'));
 }
});
test('completed public research explicitly triggers approved paid research independently of rendering',async()=>{
 const {context,owner}=publicCrmRuntime(),automatic=[];context.window.LeadIntelAdditionalContacts={auto:async(candidate,options)=>automatic.push({candidate,options})};
 assert.equal(await context.run(owner.domain),true);assert.equal(automatic.length,1);assert.equal(automatic[0].candidate,owner);assert.equal(automatic[0].options.trigger,'research_completed');
});
