import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
const candidateOf=row=>JSON.parse(row.result_json);
const person=(extra={})=>({id:'apollo-anna',name:'Anna Andersson',title:'Head of Procurement',organization_name:'Forge Industries',...extra});
async function identityJob(t){const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='identities' WHERE id=?").run(job.id);return {...f,job};}
const run=(f,services={})=>runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{search:async()=>[],...services}});
test('company research runs free Apollo identity search and retains official buyers without importing wrong employers or partial identities',async t=>{
 const f=await identityJob(t),calls=[];
 await run(f,{apollo:async payload=>{calls.push(payload);return {people:[person(),person({id:'wrong',name:'Other Person',organization_name:'Other Company'}),person({id:'partial',name:'Anna'})]};}});
 assert.equal(calls.length,1);assert.deepEqual(calls[0].q_organization_domains_list,['forge.example']);assert.equal(calls[0].reveal_phone_number,undefined);assert.equal(calls[0].reveal_personal_emails,undefined);
 const row=await readBuyerJob(f.env,workspaceId,{id:f.job.id}),saved=candidateOf(row);assert.equal(row.phase,'contacts');assert.ok(saved.people.some(p=>p.id==='robert'));assert.ok(saved.people.some(p=>p.id==='apollo-anna'));assert.ok(!saved.people.some(p=>['wrong','partial'].includes(p.id)));
 const receipt=saved.publicResearch.accountability.tools.find(p=>p.provider==='apollo');assert.equal(receipt.attempted,1);assert.equal(receipt.succeeded,1);assert.equal(receipt.results,3);
 assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND kind='search' AND request_value LIKE 'Apollo people search%' AND status='complete'").get(f.job.id).n,1);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='identities',next_at=0 WHERE id=?").run(f.job.id);await run(f,{apollo:async()=>assert.fail('a resumed job must reuse completed Apollo work')});
 const reopened=candidateOf(await readBuyerJob(f.env,workspaceId,{id:f.job.id}));assert.equal(reopened.publicResearch.accountability.tools.find(p=>p.provider==='apollo').attempted,1);assert.ok(reopened.people.some(p=>p.id==='apollo-anna'));
});
test('zero-result discovery uses one company-name fallback and records real zero-result successes',async t=>{
 const f=await identityJob(t),calls=[];await run(f,{apollo:async payload=>{calls.push(payload);return {people:[]};}});
 assert.equal(calls.length,2);assert.equal(calls[1].companyNameFallback,true);const saved=candidateOf(await readBuyerJob(f.env,workspaceId,{id:f.job.id}));const a=saved.publicResearch.accountability.tools.find(p=>p.provider==='apollo');assert.equal(a.succeeded,2);assert.equal(a.results,0);assert.ok(saved.people.some(p=>p.id==='robert'));
});
test('unavailable Apollo is optional, bounded to two failures, and leaves public research available',async t=>{
 const f=await identityJob(t);let calls=0;await run(f,{apollo:async()=>{calls++;throw Object.assign(Error('Controlled Apollo outage'),{status:502,code:'SERVICE_APOLLO_UNAVAILABLE',executed:true});}});
 assert.equal(calls,2);const row=await readBuyerJob(f.env,workspaceId,{id:f.job.id}),saved=candidateOf(row);assert.equal(row.phase,'contacts');assert.equal(saved.publicResearch.accountability.tools.find(p=>p.provider==='apollo').failed,2);assert.ok(saved.people.some(p=>p.id==='robert'));
});
test('disabled directory discovery records a skip without paid lookup or a provider retry',async t=>{
 const f=await identityJob(t);let calls=0;await run(f,{apollo:async()=>{calls++;throw Object.assign(Error('Apollo discovery disabled'),{status:409,code:'SERVICE_APOLLO_DISCOVERY_DISABLED',executed:false});}});
 assert.equal(calls,1);const saved=candidateOf(await readBuyerJob(f.env,workspaceId,{id:f.job.id}));assert.equal(saved.publicResearch.accountability.tools.find(p=>p.provider==='apollo').attempted,0);assert.equal(saved.publicResearch.accountability.tools.find(p=>p.provider==='apollo').skipped,1);
});
test('a platform key cannot dispatch free discovery for a workspace without its own Apollo credential',async t=>{
 const f=await identityJob(t);f.env.APOLLO_API_KEY='forbidden-platform-key';const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>assert.fail('No workspace key means no provider dispatch');t.after(()=>{globalThis.fetch=originalFetch;});
 await run(f);const saved=candidateOf(await readBuyerJob(f.env,workspaceId,{id:f.job.id})),receipt=saved.publicResearch.accountability.tools.find(p=>p.provider==='apollo');assert.equal(receipt.attempted,0);assert.equal(receipt.skipped,1);assert.ok(saved.people.some(p=>p.id==='robert'));
});
test('rate-limited free discovery records one real failure without a second API call',async t=>{
 const f=await identityJob(t);let calls=0;await run(f,{apollo:async()=>{calls++;throw Object.assign(Error('Rate limited'),{status:429,code:'SERVICE_APOLLO_RATE_LIMIT',executed:true,httpStatus:429});}});
 assert.equal(calls,1);const saved=candidateOf(await readBuyerJob(f.env,workspaceId,{id:f.job.id}));assert.equal(saved.publicResearch.accountability.tools.find(p=>p.provider==='apollo').failed,1);
});

test('restoring a legacy review-phase job researches newly discovered identities before review or paid work',async t=>{
 const f=await identityJob(t);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='review' WHERE id=?").run(f.job.id);
 await run(f,{apollo:async()=>({people:[person(),person({id:'second',name:'Bo Svensson'})]}),read:async url=>({url,markdown:'Forge Industries team',metadata:{sourceURL:url}}),independent:async()=>({status:'not_configured',results:[]})});
 const row=await readBuyerJob(f.env,workspaceId,{id:f.job.id}),saved=candidateOf(row);assert.ok(saved.people.some(p=>p.id==='apollo-anna'));assert.notEqual(row.phase,'paid');assert.notEqual(row.phase,'done');assert.equal(JSON.parse(row.input_json).apolloIdentityVersion,1);
 assert.equal(f.DB.raw.prepare("SELECT phase FROM buyer_research_tasks WHERE job_id=? AND request_value LIKE 'Apollo people search%' LIMIT 1").get(f.job.id).phase,'identities');
});
test('selected-person Recheck never starts whole-company Apollo discovery',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,personIds:['robert']});f.job=job;f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='identities' WHERE id=?").run(job.id);
 await run(f,{apollo:async()=>assert.fail('Selected-person research cannot launch directory discovery')});assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).phase,'contacts');
});
test('cancel during a free Apollo response prevents late candidate and completed-task writes',async t=>{
 const f=await identityJob(t),original=f.job.result_json;let release,started;const gate=new Promise(r=>release=r),entered=new Promise(r=>started=r);
 const work=run(f,{apollo:async()=>{started();await gate;return {people:[person()]};}});
 await entered;f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0 WHERE id=?").run(f.job.id);release();await work;
 const row=await readBuyerJob(f.env,workspaceId,{id:f.job.id});assert.equal(row.status,'canceled');assert.equal(row.result_json,original);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND status='complete'").get(f.job.id).n,0);
});

test('actual HTTP acknowledgement and scheduled wrapper execute the encrypted customer Apollo identity path without paid endpoints',async t=>{
 const {default:app}=await import('../src/app.js'),{encryptSecret,importAesKey}=await import('../src/oauth.js');
 const f=await buyerJobsFixture(t),key='controlled-apollo-identity-key';f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,19).toString('base64');f.env.APOLLO_API_KEY='forbidden-platform-key';
 const encrypted=await encryptSecret(key,await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES(?,'apollo',?,'test',?)").run(workspaceId,encrypted,JSON.stringify({discovery_enabled:true,email_enrichment_enabled:true,phone_enrichment_enabled:true}));
 const calls=[],originalFetch=globalThis.fetch;globalThis.fetch=async(url,options={})=>{
  if(new URL(url).hostname==='api.apollo.io'){calls.push({url:String(url),body:JSON.parse(options.body),key:options.headers['X-Api-Key']});assert.match(String(url),/\/mixed_people\/api_search$/);return Response.json({people:[{...person(),email:'must-not-leak@forge.example',phone_number:'+46123456789'},person({id:'second',name:'Bo Svensson'})]});}
  if(new URL(url).hostname==='forge.example')return new Response('<h1>Forge Industries</h1><p>Robert Lund — Head of Procurement — Forge Industries.</p>',{headers:{'Content-Type':'text/html'}});
  throw Error('Unplanned network request in controlled test: '+new URL(url).hostname);
 };t.after(()=>{globalThis.fetch=originalFetch;});
 const waits=[],request=new Request('https://app.fixture.test/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Origin:'https://app.fixture.test',Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify({...f.body,paidResearch:false})});
 const response=await app.fetch(request,f.env,{waitUntil:p=>waits.push(p)});assert.equal(response.status,200);const {job}=await response.json();await Promise.all(waits);
 const noop=async()=>({completed:0}),services={search:async()=>[],read:async url=>({url,markdown:'Robert Lund — Head of Procurement — Forge Industries',metadata:{sourceURL:url}}),dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]})};
 for(let i=0;i<8&&!calls.length;i++){const pending=[];await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,maxJobs:1,windowMs:30000,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(pending);}
 assert.equal(calls.length,1);assert.equal(calls[0].key,key);assert.equal(calls[0].body.reveal_phone_number,undefined);
 const row=await readBuyerJob(f.env,workspaceId,{id:job.id}),saved=candidateOf(row);assert.ok(saved.people.some(p=>p.id==='apollo-anna'));assert.equal(saved.publicResearch.accountability.tools.find(p=>p.provider==='apollo').succeeded,1);
 const tasks=f.DB.raw.prepare("SELECT request_value,result_json FROM buyer_research_tasks WHERE job_id=? AND request_value LIKE 'Apollo people search%'").all(job.id);assert.equal(tasks.length,1);assert.doesNotMatch(JSON.stringify(tasks),/must-not-leak|46123456789|controlled-apollo-identity-key|forbidden-platform-key/);
 const events=f.DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='operations.scheduler' AND entity_type='buyer_research'").all();assert.ok(events.length>0);
});
