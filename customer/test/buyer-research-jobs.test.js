const test=require('node:test'),assert=require('node:assert/strict');
const {createClient,requestInput}=require('../buyer-research-jobs.js');
const person=(id='anna')=>({id,name:id==='anna'?'Anna Buyer':'Bob Buyer',title:'COO',organization:'Example'});
const candidate=()=>({company:'Example',domain:'example.com',website:'https://example.com/',buyerRoles:'COO',buyerSearchMode:'user_selected_target',people:[person()]});
function harness(respond,options={}){
 const calls=[],bridge={workspace:{id:'workspace-1'},session:{authenticated:true,user:{id:'user-1'}},conflict:false};
 const client=createClient({getBridge:()=>bridge,pollMs:2,requestTimeoutMs:100,fetchImpl:async(url,init)=>{const call={url,method:init.method,body:init.body&&JSON.parse(init.body),signal:init.signal};calls.push(call);const job=await respond(call,calls.length);return {ok:true,json:async()=>({job})};},...options});
 return {client,bridge,calls};
}
const snapshot=(owner,status='complete',revision=1)=>({id:'job-1',domain:owner.domain,status,phase:'contacts',revision,updatedAt:new Date().toISOString(),candidate:structuredClone(owner),progress:{completed:1,total:1,label:'Public source checks'},diagnostics:[]});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('an explicit first request starts one durable free job and observes saved snapshots',async()=>{
 const owner=candidate(),job=snapshot(owner);job.candidate.people[0].publicPhone='+371 23456789';let saved=0;
 const h=harness(call=>call.method==='POST'?{...job,status:'running',revision:1}:h.calls.length===1?null:{...job,revision:2});
 const result=await h.client.research(owner,{profile:{decisionMakers:'COO'},persist:()=>saved++});
 assert.equal(result.status,'complete');assert.equal(owner.people[0].publicPhone,'+371 23456789');assert.equal(h.calls.filter(c=>c.method==='POST').length,1);assert.equal(h.calls[1].body.action,'start');assert.equal(saved,2);assert.match(h.calls[0].url,/workspace_id=workspace-1/);assert.match(h.calls.at(-1).url,/job_id=job-1/);
 assert.ok(h.calls.every(c=>c.url.includes('/api/buyers/research?')));
});
test('GET restoration observes running jobs after reload without starting or resuming research',async()=>{
 const owner=candidate(),job=snapshot(owner);let reads=0;
 const h=harness(()=>({...job,status:++reads===1?'running':'needs_review',revision:reads}));h.bridge.conflict=true;
 const result=await h.client.restore(owner,{profile:{decisionMakers:'COO'}});
 assert.equal(result.status,'needs_review');assert.equal(owner.publicContactStatus,'error');assert.equal(owner.buyerDiscovery.researchIncomplete,true);assert.ok(h.calls.length>=2);assert.ok(h.calls.every(c=>c.method==='GET'));
});
test('unknown GET and terminal incomplete GET never create new work',async()=>{
 for(const job of [null,snapshot(candidate(),'failed'),snapshot(candidate(),'canceled'),snapshot(candidate(),'needs_review')]){
  const owner=candidate(),h=harness(()=>job);await h.client.restore(owner,{profile:{decisionMakers:'COO'}});assert.equal(h.calls.length,1);assert.equal(h.calls[0].method,'GET');
 }
});
test('explicit resume posts one revision-checked action and never loops terminal attempts',async()=>{
 const owner=candidate(),job=snapshot(owner,'needs_review',7),h=harness(call=>call.method==='GET'?job:{...job,revision:8});
 await h.client.research(owner,{profile:{decisionMakers:'COO'}});
 assert.equal(h.calls.length,2);assert.deepEqual([h.calls[1].body.action,h.calls[1].body.jobId,h.calls[1].body.expectedRevision],['resume','job-1',7]);
});
test('aborting a stalled request settles promptly and cannot cancel the server job or apply late findings',async()=>{
 const owner=candidate(),controller=new AbortController();let finish;const h=harness(()=>new Promise(resolve=>finish=resolve));
 const work=h.client.research(owner,{signal:controller.signal});await tick();controller.abort();await assert.rejects(work,{name:'AbortError'});
 const late=snapshot(owner);late.candidate.people[0].publicPhone='+371 23456789';finish(late);await tick();assert.equal(owner.people[0].publicPhone,undefined);assert.ok(h.calls.every(c=>c.method==='GET'));assert.equal(h.calls[0].signal.aborted,true);
});
test('a changed workspace, person name, title, or new local roster prevents late writes',async()=>{
 for(const change of [(h,o)=>h.bridge.workspace.id='workspace-2',(h,o)=>o.people[0].name='Different Buyer',(h,o)=>o.people[0].title='CFO',(h,o)=>o.people.push(person('bob'))]){
  const owner=candidate(),job=snapshot(owner);job.candidate.people[0].publicPhone='+371 23456789';let finish,saves=0;
  const h=harness(()=>new Promise(resolve=>finish=resolve)),work=h.client.restore(owner,{persist:()=>saves++});await tick();change(h,owner);finish(job);await assert.rejects(work,{name:'AbortError'});assert.equal(saves,0);assert.equal(owner.people[0].publicPhone,undefined);
 }
});
test('context changes also stop observing a transport that never resolves',async()=>{
 const owner=candidate(),h=harness(()=>new Promise(()=>{}),{requestTimeoutMs:1000});
 const work=h.client.restore(owner);await tick();owner.company='Another Company';await assert.rejects(work,{name:'AbortError'});assert.equal(h.calls.length,1);
});
test('selected-person research preserves other identities, local selections, paid data, and accepted evidence',async()=>{
 const owner=candidate();owner.people.push(person('bob'));Object.assign(owner.people[0],{kept:true,flowSelected:true,phoneEnrichment:{status:'verified',phone:'+371 11111111'},publicEmail:'anna@example.com',publicEmailUrl:'https://example.com/team'});
 const job=snapshot(owner);Object.assign(job.candidate.people[0],{kept:false,flowSelected:false,phoneEnrichment:null,publicEmail:'',publicEmailUrl:'',publicPhone:'+371 23456789'});job.candidate.people[1].publicPhone='+371 99999999';
 const h=harness(()=>job);await h.client.restore(owner,{personIds:['anna']});
 assert.equal(owner.people[0].kept,true);assert.equal(owner.people[0].flowSelected,true);assert.equal(owner.people[0].phoneEnrichment.phone,'+371 11111111');assert.equal(owner.people[0].publicEmail,'anna@example.com');assert.equal(owner.people[0].publicPhone,'+371 23456789');assert.equal(owner.people[1].publicPhone,undefined);
});
test('a reused stable id cannot move source channels to another name or role',async()=>{
 for(const field of ['name','title','organization']){
  const owner=candidate(),job=snapshot(owner);job.candidate.people[0][field]='Different';job.candidate.people[0].publicPhone='+371 23456789';
  const h=harness(()=>job);await h.client.restore(owner);assert.equal(owner.people[0].publicPhone,undefined);assert.equal(owner.people[0][field],person()[field]);
 }
});
test('initial empty acquisition accepts new identities and preserves their stable ids across checkpoints',async()=>{
 const owner=candidate();owner.people=[];const job=snapshot({...owner,people:[person()]});let reads=0;
 const h=harness(()=>({...job,status:++reads===1?'running':'complete',revision:reads}));await h.client.restore(owner);
 assert.equal(owner.people.length,1);assert.equal(owner.people[0].id,'anna');
});
test('different company, role or seller-context jobs do not apply on domain restore',async()=>{
 for(const mutate of [job=>job.candidate.company='Another',job=>job.candidate.buyerRoles='CFO',job=>job.input={profile:{website:'https://other.test'}}]){
  const owner=candidate(),job=snapshot(owner);mutate(job);job.candidate.people[0].publicPhone='+371 23456789';const h=harness(()=>job);
  assert.equal(await h.client.restore(owner,{profile:{website:'https://seller.test',decisionMakers:'COO'}}),null);assert.equal(owner.people[0].publicPhone,undefined);assert.equal(h.calls.length,1);
 }
});
test('an explicit task cancel posts cancellation and stops a running observer',async()=>{
 const owner=candidate(),job=snapshot(owner,'running');let canceled=false;
 const h=harness(call=>call.method==='POST'?(canceled=true,{...job,status:'canceled',revision:2}):{...job,status:canceled?'canceled':'running'});
 const observe=h.client.restore(owner);await tick();const result=await h.client.cancel(owner);await assert.rejects(observe,{name:'AbortError'});
 assert.equal(result.status,'canceled');assert.equal(h.calls.filter(c=>c.method==='POST').length,1);assert.equal(h.calls.find(c=>c.method==='POST').body.action,'cancel');
});
test('workspace sync conflict permits authoritative reads and blocks mutations',async()=>{
 const owner=candidate(),h=harness(()=>null);h.bridge.conflict=true;assert.equal(await h.client.restore(owner),null);await assert.rejects(h.client.research(owner),/synchronization conflict/i);assert.ok(h.calls.every(c=>c.method==='GET'));
});
test('request payload excludes arbitrary state, credentials and paid service flags',()=>{
 const owner=candidate();owner.tokens={access:'private'};owner.people[0].apiKey='private';owner.people[0].flowConfirmPhone=true;owner.people[0].flowConfirmEmail=true;owner.delivery={send:true};
 const body=requestInput(owner,{priorityOffers:'Services',apiKey:'private',enablePaidSearch:true});
 assert.equal(body.candidate.people[0].flowConfirmPhone,undefined);assert.equal(body.candidate.people[0].flowConfirmEmail,undefined);assert.equal(body.candidate.tokens,undefined);assert.equal(body.candidate.people[0].apiKey,undefined);assert.equal(body.candidate.delivery,undefined);assert.equal(body.profile.apiKey,undefined);assert.equal(body.profile.enablePaidSearch,undefined);
});
test('HTTP failures are visible and never trigger automatic retries or a provider fallback',async()=>{
 const owner=candidate();let calls=0;
 // Use a stable authenticated bridge, as the application does.
 const bridge={workspace:{id:'w'},session:{authenticated:true}},stable=createClient({getBridge:()=>bridge,fetchImpl:async()=>{calls++;return {ok:false,status:503,json:async()=>({error:'Read unavailable'})};}});
 await assert.rejects(stable.restore(owner),/Read unavailable/);assert.equal(calls,1);
});

test('newer same-identity local evidence survives a delayed server checkpoint',async()=>{
 const owner=candidate(),job=snapshot(owner);job.candidate.people[0].publicPhone='+371 11111111';let finish;const h=harness(()=>new Promise(resolve=>finish=resolve));
 const work=h.client.restore(owner);await tick();owner.people[0].publicPhone='+371 99999999';finish(job);await work;assert.equal(owner.people[0].publicPhone,'+371 99999999');
});
test('reopening a scoped job merges only the server-recorded selected identity',async()=>{
 const owner=candidate();owner.people.push(person('bob'));const job=snapshot(owner);job.input={personIds:['anna']};job.candidate.people[0].publicPhone='+371 11111111';job.candidate.people[1].publicPhone='+371 22222222';
 const h=harness(()=>job);await h.client.restore(owner);assert.equal(owner.people[0].publicPhone,'+371 11111111');assert.equal(owner.people[1].publicPhone,undefined);
});
test('a completed job for another person cannot satisfy an explicit new selected scope',async()=>{
 const owner=candidate();owner.people.push(person('bob'));const job=snapshot(owner);job.input={personIds:['anna']};
 const h=harness(call=>call.method==='POST'?{...job,id:'job-2',input:{personIds:['bob']}}:job);await h.client.research(owner,{personIds:['bob']});
 assert.equal(h.calls.filter(c=>c.method==='POST').length,1);assert.equal(h.calls[1].body.action,'start');assert.deepEqual(h.calls[1].body.personIds,['bob']);
});
function uiHarness(owner,respond){
 const fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 const h=harness(respond),state={selectedProspects:[owner],candidates:[],potentialMatches:[],pipeline:[]};let saves=0;
 const ctx={window:{LeadIntelBuyerResearchJobs:h.client},discovery:state,bridge:()=>h.bridge,crmAuthenticated:()=>true,discoveryOperationContext:()=>JSON.stringify([h.bridge.workspace.id,h.bridge.session.user.id]),discoveryAccountContext:()=>h.bridge.workspace.id,companyQualificationProfile:()=>({website:'https://seller.test',decisionMakers:'COO'}),mainState:()=>({profile:{decisionMakers:'COO'}}),LeadIntelDiscovery:{...D,buyerRolesForTarget:()=> 'COO'},canonicalDomain:D.canonicalDomain,saveDiscovery:()=>saves++,renderAll(){},showToast(){},selectedProspects:()=>state.selectedProspects,automaticPublicChecks:new Set(),discoveryStageOpenRevision:1,publicContactPromises:new Map(),runPublicProspectContacts:()=>{throw Error('Legacy public provider chain executed');},AbortController,Date,Map,Set,JSON,Boolean,Error};
 vm.createContext(ctx);
 for(const name of ['runDurableBuyerResearch','searchDecisionMakers','findPublicProspectContacts','scheduleSavedBuyerPublicChecks']){
  const start=source.search(new RegExp(`(?:async )?function ${name}\\(`)),tail=source.slice(start+1),next=tail.search(/\n(?:async )?function /);assert.ok(start>=0&&next>=0,name);vm.runInContext(source.slice(start,start+1+next),ctx);
 }
 return {...h,ctx,get saves(){return saves;}};
}
test('actual UI acquisition and public Recheck entries use the durable client without old provider orchestration',async()=>{
 for(const entry of ['initial','recheck']){
  const owner=candidate();if(entry==='initial')owner.people=[];const job=snapshot({...owner,people:[person()]}),h=uiHarness(owner,call=>call.method==='POST'?job:null);
  const result=entry==='initial'?await h.ctx.searchDecisionMakers(owner):await h.ctx.findPublicProspectContacts(owner.domain,{force:true,personIds:['anna']});
  assert.equal(result,true);assert.equal(h.saves,1);assert.equal(owner.people[0].id,'anna');assert.equal(h.calls.filter(call=>call.method==='POST').length,1);assert.ok(h.calls.every(call=>call.url.includes('/api/buyers/research?')));
 }
});
test('actual reopen scheduler queries authoritative jobs despite sync conflict and deduplicates retained owners',async()=>{
 const owner=candidate(),job=snapshot(owner,'needs_review'),h=uiHarness(owner,()=>job);h.bridge.conflict=true;
 assert.equal(h.ctx.scheduleSavedBuyerPublicChecks(),true);h.ctx.scheduleSavedBuyerPublicChecks();await tick();
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].method,'GET');assert.equal(h.saves,1);assert.equal(owner.publicContactStatus,'error');
});
test('newer local evidence remains protected across later server revisions in the same observer',async()=>{
 const owner=candidate(),job=snapshot(owner);job.candidate.people[0].publicPhone='+371 11111111';let first,saves=0;
 const h=harness(()=>h.calls.length===1?new Promise(resolve=>first=resolve):{...job,revision:2});
 const work=h.client.restore(owner,{persist:()=>saves++});await tick();owner.people[0].publicPhone='+371 99999999';first({...job,status:'running'});await work;
 assert.equal(saves,2);assert.equal(owner.people[0].publicPhone,'+371 99999999');
});
test('real authenticated route and migrated SQLite accept the client context and restore its authoritative snapshot',async t=>{
 const {buyerJobsFixture,workspaceId}=await import('../../backend/test/buyer-research-jobs-fixture.mjs'),{handleBuyerResearchRoute}=await import('../../backend/src/buyer-research-routes.js');
 const {activeBuyerProfile}=await import('../../backend/src/buyer-research-store.js');
 const f=await buyerJobsFixture(t),owner=structuredClone(f.candidate),profile=activeBuyerProfile(f.payload),bridge={workspace:{id:workspaceId},session:{authenticated:true,user:{id:f.users.owner.id}}},calls=[];
 const client=createClient({getBridge:()=>bridge,pollMs:2,fetchImpl:async(url,init)=>{
  calls.push({method:init.method,url});const headers={...init.headers,Cookie:'leadintel_session='+f.users.owner.token};
  const response=await handleBuyerResearchRoute(new Request(url,{...init,headers}),f.env);
  if(init.method==='POST'&&response.ok){const {job}=await response.clone().json(),result=structuredClone(job.candidate);result.people[0].publicPhone='+46 701234567';result.people.push({id:'source-new',name:'New Source Buyer',title:'COO',organization:owner.company});f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='review',revision=revision+1,result_json=? WHERE id=?").run(JSON.stringify(result),job.id);}
  return response;
 }});
 const result=await client.research(owner,{profile});assert.equal(result.status,'needs_review');assert.equal(owner.people[0].publicPhone,'+46 701234567');assert.equal(owner.people.length,2);assert.equal(calls.filter(call=>call.method==='POST').length,1);
 const changes=f.DB.raw.prepare('SELECT total_changes() n').get().n;bridge.conflict=true;
 const reopened=structuredClone(f.candidate);assert.equal((await client.restore(reopened,{profile})).id,result.id);assert.equal(reopened.people.length,2);assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,changes);assert.ok(calls.slice(3).every(call=>call.method==='GET'));
});
test('an explicit initial start cannot be swallowed by a pending read-only restoration',async()=>{
 const owner=candidate(),job=snapshot(owner);let first;const h=harness(call=>h.calls.length===1?new Promise(resolve=>first=resolve):call.method==='GET'?null:job);
 const restore=h.client.restore(owner);await tick();const stopped=assert.rejects(restore,{name:'AbortError'});const result=await h.client.research(owner);await stopped;
 assert.equal(result.status,'complete');assert.equal(h.calls.filter(call=>call.method==='POST').length,1);assert.equal(h.calls.find(call=>call.method==='POST').body.action,'start');first(null);
});
test('a failed explicit cancel cannot be reported as a canceled durable task',async()=>{
 const owner=candidate(),job=snapshot(owner,'running'),h=uiHarness(owner,call=>{if(call.method==='POST')throw Error('Cancellation unavailable');return job;}),tasks=require('../background-task-centre.js').createTaskCentre({storage:null}),controller=new AbortController();h.ctx.window.LeadIntelTaskCentre=tasks;
 const observe=h.ctx.runDurableBuyerResearch(owner,{restore:true,signal:controller.signal});await tick();const task=tasks.list()[0];assert.ok(task?.id);
 await assert.rejects(tasks.cancel(task.id),/Cancellation unavailable/);assert.notEqual(tasks.get(task.id).status,'canceled');controller.abort();await observe;
});
test('a mismatched-context GET retains its latest observed revision for an explicit replacement command',async()=>{
 const owner=candidate(),job=snapshot(owner,'needs_review',12);job.input={profile:{priorityOffers:'New saved offer',website:'https://seller.test'},roles:['COO']};job.candidate.people[0].publicPhone='+371 22222222';
 const h=harness(call=>call.method==='GET'?job:{...snapshot(owner),id:'job-2',input:{profile:{priorityOffers:'Requested offer',website:'https://seller.test'}}});
 await h.client.research(owner,{profile:{priorityOffers:'Requested offer',website:'https://seller.test'}});
 assert.equal(h.calls[1].body.action,'start');assert.equal(h.calls[1].body.jobId,job.id);assert.equal(h.calls[1].body.expectedRevision,12);assert.equal(owner.people[0].publicPhone,undefined);
});
test('real route rejects an outdated caller profile after GET and receives the latest observed CAS revision',async t=>{
 const {buyerJobsFixture,workspaceId}=await import('../../backend/test/buyer-research-jobs-fixture.mjs'),{handleBuyerResearchRoute}=await import('../../backend/src/buyer-research-routes.js'),{startBuyerJob}=await import('../../backend/src/buyer-research-store.js');
 const f=await buyerJobsFixture(t),owner=structuredClone(f.candidate),row=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),saved=JSON.parse(row.result_json);saved.people[0].publicPhone='+46 709999999';
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET revision=12,status='needs_review',result_json=? WHERE id=?").run(JSON.stringify(saved),row.id);
 const bridge={workspace:{id:workspaceId},session:{authenticated:true,user:{id:f.users.owner.id}}},calls=[],before=f.DB.raw.prepare('SELECT total_changes() n').get().n;
 const client=createClient({getBridge:()=>bridge,fetchImpl:async(url,init)=>{calls.push({method:init.method,body:init.body&&JSON.parse(init.body)});return handleBuyerResearchRoute(new Request(url,{...init,headers:{...init.headers,Cookie:'leadintel_session='+f.users.owner.token}}),f.env);}});
 await assert.rejects(client.research(owner,{profile:{...f.payload.main.profile,website:f.payload.main.website,priorityOffers:'Outdated seller offer'}}),{status:409});
 assert.deepEqual(calls.map(call=>call.method),['GET','POST']);assert.equal(calls[1].body.jobId,row.id);assert.equal(calls[1].body.expectedRevision,12);assert.equal(owner.people[0].publicPhone,undefined);assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,before);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks').get().n,0);
});
