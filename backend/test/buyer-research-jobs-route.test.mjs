import test from 'node:test';
import assert from 'node:assert/strict';
import {startBuyerJob} from '../src/buyer-research-store.js';
import {buyerJobsFixture,workspaceId,foreignWorkspaceId} from './buyer-research-jobs-fixture.mjs';

async function handle(request,env,ctx={}){const {handleBuyerResearchRoute}=await import('../src/buyer-research-routes.js');return handleBuyerResearchRoute(request,env,{},ctx);}
function request(f,{body,role='owner',workspace=workspaceId,query='',cookie=true,method=body?'POST':'GET'}={}){return new Request(`https://app.fixture.test/api/buyers/research?workspace_id=${workspace}${query}`,{method,headers:{Origin:'https://app.fixture.test',...(cookie?{Cookie:'leadintel_session='+f.users[role].token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
const countJobs=f=>f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n;
function interceptWrite(f,pattern,revoke){
 const prepare=f.DB.prepare.bind(f.DB);let intercepted=false;
 f.DB.prepare=sql=>{const statement=prepare(sql),run=statement.run.bind(statement);statement.run=async()=>{if(!intercepted&&pattern.test(sql)){intercepted=true;revoke();}return run();};return statement;};
 return ()=>intercepted;
}

test('owner, researcher and sales can start free-source research using their actual hashed sessions',async t=>{
 const f=await buyerJobsFixture(t);
 for(const role of ['owner','researcher','sales']){const candidate={...f.candidate,domain:role+'.example'},response=await handle(request(f,{role,body:{action:'start',candidate}}),f.env);assert.equal(response.status,200,role+': '+await response.clone().text());const {job}=await response.json();assert.equal(job.status,'queued');assert.equal(job.domain,candidate.domain);const row=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id);assert.equal(row.requested_by,f.users[role].id);assert.equal(row.session_hash,f.users[role].sessionTokenHash);}
 assert.equal(countJobs(f),3);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks').get().n,0);
});

test('anonymous, expired, viewer and foreign-workspace commands cannot create research jobs',async t=>{
 const f=await buyerJobsFixture(t);
 const anonymous=await handle(request(f,{cookie:false,body:f.body}),f.env);assert.equal(anonymous.status,401);
 f.DB.raw.prepare("UPDATE sessions SET expires_at=datetime('now','-1 day') WHERE token_hash=?").run(f.users.researcher.sessionTokenHash);assert.equal((await handle(request(f,{role:'researcher',body:f.body}),f.env)).status,401);
 assert.equal((await handle(request(f,{role:'viewer',body:f.body}),f.env)).status,403);
 const denied=await handle(request(f,{role:'foreign',body:f.body}),f.env);assert.ok([401,403].includes(denied.status));assert.equal(countJobs(f),0);
});

test('job GETs by domain and ID are read-only and never wake provider or worker progress',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),before=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs').all(),tasks=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks').all(),changes=f.DB.raw.prepare('SELECT total_changes() n').get().n;
 for(const query of ['&domain=forge.example','&job_id='+job.id]){const response=await handle(request(f,{query}),f.env,{waitUntil(){assert.fail('A read-only GET cannot schedule job execution');}});assert.equal(response.status,200);const body=await response.json();assert.equal(body.job.id,job.id);assert.equal(body.job.status,'queued');assert.ok(!JSON.stringify(body).includes(f.users.owner.sessionTokenHash));}
 assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_jobs').all(),before);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks').all(),tasks);assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,changes);
});

test('an authorized member of another workspace cannot read or command a foreign job ID',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 const read=await handle(request(f,{role:'foreign',workspace:foreignWorkspaceId,query:'&job_id='+job.id}),f.env);assert.equal(read.status,200);assert.equal((await read.json()).job,null);
 const cancel=await handle(request(f,{role:'foreign',workspace:foreignWorkspaceId,body:{action:'cancel',jobId:job.id,expectedRevision:1}}),f.env);assert.equal(cancel.status,404);assert.equal(f.DB.raw.prepare('SELECT status FROM buyer_research_jobs WHERE id=?').get(job.id).status,'queued');
});

test('route cancel and resume reject stale revisions and update the original job only',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 assert.equal((await handle(request(f,{body:{action:'cancel',jobId:job.id,expectedRevision:0}}),f.env)).status,409);
 const cancel=await handle(request(f,{role:'sales',body:{action:'cancel',jobId:job.id,expectedRevision:1}}),f.env);assert.equal(cancel.status,200);assert.equal((await cancel.json()).job.status,'canceled');
 assert.equal((await handle(request(f,{body:{action:'resume',jobId:job.id,expectedRevision:1}}),f.env)).status,409);
 const resume=await handle(request(f,{role:'researcher',body:{action:'resume',jobId:job.id,expectedRevision:2}}),f.env);assert.equal(resume.status,200);const saved=(await resume.json()).job;assert.equal(saved.id,job.id);assert.equal(saved.revision,3);assert.equal(saved.status,'queued');assert.equal(countJobs(f),1);
});

test('membership revoked while JSON is pending cannot authorize a subsequent job write',async t=>{
 const f=await buyerJobsFixture(t),req=request(f,{body:f.body});req.json=async()=>{f.DB.raw.prepare('DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?').run(workspaceId,f.users.owner.id);return f.body;};
 const response=await handle(req,f.env);assert.ok([401,403].includes(response.status));assert.equal(countJobs(f),0);
});

test('session revoked while JSON is pending cannot authorize a subsequent job write',async t=>{
 const f=await buyerJobsFixture(t),req=request(f,{body:f.body});req.json=async()=>{f.DB.raw.prepare('DELETE FROM sessions WHERE token_hash=?').run(f.users.owner.sessionTokenHash);return f.body;};
 const response=await handle(req,f.env);assert.equal(response.status,401);assert.equal(countJobs(f),0);
});

test('unknown commands, malformed bodies and unsupported methods leave the job store unchanged',async t=>{
 const f=await buyerJobsFixture(t);assert.equal((await handle(request(f,{body:{action:'buy-contacts',candidate:f.candidate}}),f.env)).status,400);
 const malformed=request(f,{body:f.body});malformed.json=async()=>{throw SyntaxError('Invalid JSON');};assert.equal((await handle(malformed,f.env)).status,400);
 const put=await handle(request(f,{method:'PUT',body:f.body}),f.env);assert.ok([404,405].includes(put.status));assert.equal(countJobs(f),0);
});

for(const revoked of ['session','membership'])test(`revoked ${revoked} at the real INSERT boundary cannot create a job after route authorization`,async t=>{
 const f=await buyerJobsFixture(t),hit=interceptWrite(f,/INSERT(?: OR \w+)? INTO buyer_research_jobs/i,()=>revoked==='session'?f.DB.raw.prepare('DELETE FROM sessions WHERE token_hash=?').run(f.users.owner.sessionTokenHash):f.DB.raw.prepare("UPDATE workspace_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(workspaceId,f.users.owner.id));
 const response=await handle(request(f,{body:f.body}),f.env);assert.equal(hit(),true);assert.ok([401,403,409].includes(response.status),'write must reject revoked authority: '+response.status);assert.equal(countJobs(f),0);
});

for(const action of ['cancel','resume'])for(const revoked of ['session','membership'])test(`revoked ${revoked} at the ${action} CAS boundary cannot change job or task state`,async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 if(action==='resume')f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='canceled',revision=2 WHERE id=?").run(job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,attempts) VALUES(?,'failed','read','failed',2)").run(job.id);
 const before=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id),tasks=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=?').all(job.id),hit=interceptWrite(f,/UPDATE buyer_research_jobs SET [\s\S]*\bstatus='(?:queued|canceled)'/i,()=>revoked==='session'?f.DB.raw.prepare('DELETE FROM sessions WHERE token_hash=?').run(f.users.owner.sessionTokenHash):f.DB.raw.prepare("UPDATE workspace_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(workspaceId,f.users.owner.id));
 const response=await handle(request(f,{body:{action,jobId:job.id,expectedRevision:before.revision}}),f.env);assert.equal(hit(),true);assert.ok([401,403,409].includes(response.status),'write must reject revoked authority: '+response.status);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id),before);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=?').all(job.id),tasks);
});
