import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState,getCustomerState} from '../src/customer-state.js';
import {needsDeepCopilotResearch,researchInput,runCopilotResearchJobs,readCopilotResearchJob,commandCopilotResearchJob} from '../src/copilot-research-jobs.js';
import {referenceResearchRequested,savedReferenceScope,resolveReferenceResearchScope} from '../src/copilot-research-scope.js';
import {shouldUseExternalResearch} from '../src/copilot-service.js';

const question='suggest buying signals for the reference companies that i added';
const rows=Array.from({length:5},(_,i)=>({companyName:'Reference '+i,website:'https://reference'+i+'.example/',country:i===0?'Denmark':'Sweden'}));
async function prepare(t,references=rows){
 const f=await buyerJobsFixture(t);const state=await getCustomerState(f.env,workspaceId);
 state.payload.main.referenceCustomers={rows:references};
 await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:state.version,payload:state.payload});
 return f;
}
async function post(f,message=question,conversation_id,research_mode){
 const response=await app.fetch(new Request('https://fixture.test/api/copilot/chat?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify({message,...(conversation_id?{conversation_id}:{}),...(research_mode?{research_mode}:{})})}),f.env,{});
 assert.equal(response.status,202);return (await response.json()).research_job;
}
async function run(f,id,services){
 for(let i=0;i<6;i++){
  const waits=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runCopilotResearchJobs:(env,o)=>runCopilotResearchJobs(env,{...o,services}),runBuyerResearchJobs:noop,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);
  const job=await readCopilotResearchJob(f.env,workspaceId,id);if(!['queued','running'].includes(job.status))return job;
 }
 return readCopilotResearchJob(f.env,workspaceId,id);
}
function controlled(extra={}){return {
 plan:()=>assert.fail('Saved references must not be collapsed into a guessed single company'),
 read:async url=>({url,description:'Official reference company evidence: an investment in a new production line was announced on 2026-11-01.',evidenceKind:'page_extract'}),
 search:async()=>({results:[],web_search:true,provider:'controlled'}),
 followup:async()=>({queries:[]}),
 apollo:()=>assert.fail('Signal research must not call contact discovery'),
 answer:async evidence=>({answer:'New production lines are an observed event; demand for our service remains a hypothesis [1].',research_status:evidence.status,synthesis_completed:true}),...extra};}

test('the exact reported request cannot bypass public research; no-browse and operational boundaries remain',()=>{
 assert.equal(needsDeepCopilotResearch(question),true);assert.equal(shouldUseExternalResearch({question}),true);
 for(const q of ['Without web research, '+question,"Do not browse; "+question,'Update my CRM records using reference companies'])assert.equal(needsDeepCopilotResearch(q),false,q);
 assert.equal(referenceResearchRequested('Explain anchoring in negotiation'),false);
 assert.equal(referenceResearchRequested('What does the reference companies button do?'),false);
 assert.equal(referenceResearchRequested('Analyze reference company https://another.example/'),false);
 assert.equal(needsDeepCopilotResearch('Analyze bogestaal.dk and bmg-as.no'),true);
 assert.deepEqual(researchInput('Analyze bogestaal.dk and bmg-as.no').urls,['https://bogestaal.dk/','https://bmg-as.no/']);
 const history=[{role:'assistant',metadata:{research_scope:{mode:'references'}}},{role:'assistant',metadata:{research_scope:null,research_target:{companyName:'Different company'}}}];
 assert.equal(referenceResearchRequested('Check their news',history),false,'a newer target supersedes a prior reference scope');
 for(const newer of [{role:'assistant',metadata:{research_job:{id:'new',status:'queued'}}},{role:'user',content:'Analyze https://another.example/'}])assert.equal(referenceResearchRequested('Also check their careers pages',[history[0],newer]),false,'queued jobs and explicit user targets stop older reference inheritance');
});
test('queued HTTP research retains its captured reference scope but a newer queued URL becomes the follow-up target',async t=>{
 const f=await prepare(t),first=await post(f);
 const followup=await post(f,'Also check their careers pages',first.conversation_id);assert.equal(followup.scope.targets[0].url,rows[0].website);
 const next=await post(f,'Analyze https://another.example/',first.conversation_id,'thorough');assert.equal(next.scope,null);
 const after=await post(f,'Also check their careers pages',first.conversation_id,'thorough');assert.equal(after.scope,null);
 const input=JSON.parse(f.DB.raw.prepare('SELECT input_json FROM copilot_research_jobs WHERE id=?').get(after.id).input_json);assert.deepEqual(input.urls,['https://another.example/']);
});
test('reference scope preserves companyName and safe URLs, deduplicates, bounds coverage and excludes private notes',()=>{
 const scope=savedReferenceScope({referenceCustomers:{rows:[null,'bad row',...rows,...rows,{companyName:'Private URL',website:'http://127.0.0.1/'},{companyName:'Signed URL',website:'https://safe.example/?token=hidden'},...Array.from({length:12},(_,i)=>({companyName:'Extra '+i,domain:'extra'+i+'.example',notes:'CONFIDENTIAL',approximateValue:12345}))]}});
 assert.equal(scope.targets.length,10);assert.equal(scope.total,19);assert.equal(scope.omitted,9);
 assert.equal(scope.targets[0].name,'Reference 0');assert.equal(scope.targets[5].url,'');assert.equal(scope.targets[6].url,'');assert.doesNotMatch(JSON.stringify(scope),/127\.0|hidden|CONFIDENTIAL|12345/);
});
test('authenticated HTTP queues all five saved sites; scheduler evidence reaches the real answer pipeline and chat reload',async t=>{
 const f=await prepare(t),reads=[],queries=[];const before=await getCustomerState(f.env,workspaceId),job=await post(f);
 let answers=0;f.env.COPILOT_TEST_PROVIDER={generate:async options=>{const p=JSON.parse(options.prompt);answers++;assert.equal(p.external_research.scope.targets.length,5);assert.ok(p.external_research.scope.targets.every(t=>t.pageRead));assert.ok(p.external_research.required_answer.some(s=>/weights are advisory/.test(s)));assert.equal(p.workspace_context.references.targets[0].name,'Reference 0');return {text:JSON.stringify({answer:'The five reference sites were read. Production-line investment is observed [1]; service demand remains a hypothesis.'})};},search:()=>assert.fail('Do not restart shallow research')};
 const {answer,...services}=controlled({read:async url=>{reads.push(url);return controlled().read(url);},search:async q=>{queries.push(q);return {results:[{url:'https://industry.example/reference-investment',title:'Independent trade report'}],web_search:true};},followup:async input=>{assert.ok(input.sources.some(s=>s.evidenceKind==='page_extract'));return {queries:[{target:0,query:'recent hiring expansion news'}]};}});
 const result=await run(f,job.id,services);assert.equal(result.status,'complete');assert.equal(answers,1);assert.ok(rows.every(r=>reads.includes(r.website)));assert.ok(reads.includes('https://industry.example/reference-investment'));assert.ok(queries.some(q=>q.includes('recent hiring expansion news')));assert.ok(queries.length<=14);assert.ok(reads.length<=12);
 assert.deepEqual((await getCustomerState(f.env,workspaceId)).payload,before.payload);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);
 const response=await app.fetch(new Request('https://fixture.test/api/copilot/conversations/'+job.conversation_id+'?workspace_id='+workspaceId,{headers:{Cookie:'leadintel_session='+f.users.owner.token}}),f.env,{});const messages=(await response.json()).messages;
 const saved=messages.find(m=>m.role==='assistant');assert.equal(saved.metadata.research_scope.targets.length,5);assert.equal(saved.metadata.research_job.id,job.id);assert.ok(saved.metadata.sources.filter(s=>s.evidenceKind==='page_extract').length>=5);
 const next=await resolveReferenceResearchScope(f.env,workspaceId,'Also check their careers pages',messages);assert.equal(next.targets[0].url,rows[0].website);
 assert.equal(await resolveReferenceResearchScope(f.env,workspaceId,'Analyze https://another.example/',messages),null);
});
test('failed reference read is explicit and Continue retries it without repeating successful reads',async t=>{
 const f=await prepare(t),job=await post(f),counts=new Map();let fail=true;
 const services=controlled({read:async url=>{counts.set(url,(counts.get(url)||0)+1);if(fail&&url===rows[2].website)throw Error('Blocked with private provider response');return controlled().read(url);}});
 const partial=await run(f,job.id,services);assert.equal(partial.status,'incomplete');assert.equal(partial.scope.targets[2].pageRead,false);assert.equal(partial.can_resume,true);assert.ok(partial.tools.some(t=>t.status==='failed'&&t.url===rows[2].website));assert.doesNotMatch(JSON.stringify(partial),/private provider response/);
 fail=false;await commandCopilotResearchJob(f.env,{workspaceId,id:job.id,userId:f.users.owner.id,sessionHash:f.users.owner.sessionTokenHash,action:'resume',revision:partial.revision});const result=await run(f,job.id,services);assert.equal(result.status,'complete');assert.equal(counts.get(rows[0].website),1);assert.equal(counts.get(rows[2].website),3);
});
test('missing reasoning connection cannot claim a follow-up planner executed',async t=>{
 const f=await prepare(t),job=await post(f),{followup,...services}=controlled();
 const result=await run(f,job.id,services);assert.equal(result.status,'incomplete');assert.ok(result.scope.targets.every(t=>t.pageRead));assert.ok(result.tools.some(t=>t.operation==='followup'&&t.code==='PUBLIC_RESEARCH_REASONING_UNAVAILABLE'));assert.ok(!result.tools.some(t=>t.operation==='research_followup'&&t.status==='succeeded'));
});
test('empty and over-limit reference lists never claim complete coverage',async t=>{
 const f=await prepare(t,[]),job=await post(f);const result=await run(f,job.id,controlled({read:()=>assert.fail(),search:()=>assert.fail()}));assert.equal(result.status,'incomplete');assert.equal(result.report.total,0);assert.equal(result.can_resume,false);assert.match(result.answer,/No websites were read/);
 const state=await getCustomerState(f.env,workspaceId);state.payload.main.referenceCustomers.rows=Array.from({length:13},(_,i)=>({companyName:'Ref '+i,domain:'r'+i+'.example'}));await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:state.version,payload:state.payload});
 const more=await post(f),done=await run(f,more.id,controlled());assert.equal(done.status,'incomplete');assert.equal(done.scope.omitted,3);assert.equal(done.scope.targets.length,10);assert.equal(done.can_resume,false);
});
test('changed reference list gets a distinct job and another workspace cannot access its scope',async t=>{
 const f=await prepare(t),a=await post(f);const unrelated=await getCustomerState(f.env,workspaceId);unrelated.payload.main.workspaceGoals={successOutcome:'A revised internal goal'};await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:unrelated.version,payload:unrelated.payload});assert.equal((await post(f,question,a.conversation_id)).id,a.id,'unrelated saves do not duplicate active research');const state=await getCustomerState(f.env,workspaceId);state.payload.main.referenceCustomers.rows=[{companyName:'Dental Practice',domain:'dental.example'}];await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:state.version,payload:state.payload});
 const b=await post(f,question,a.conversation_id);assert.notEqual(a.id,b.id);assert.equal(b.scope.targets[0].name,'Dental Practice');assert.equal(a.scope.targets[0].name,'Reference 0');
 const response=await app.fetch(new Request('https://fixture.test/api/copilot/research/'+a.id+'?workspace_id='+workspaceId,{headers:{Cookie:'leadintel_session='+f.users.foreign.token}}),f.env,{});assert.equal(response.status,403);
});
