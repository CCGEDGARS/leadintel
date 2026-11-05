import test from 'node:test';
import assert from 'node:assert/strict';
import {startBuyerJob,commandBuyerJob,readBuyerJob,publicBuyerJob,workspaceBuyerContext,authoritySql,normalizeBuyerInput} from '../src/buyer-research-store.js';
import {putCustomerState} from '../src/customer-state.js';
import {buyerJobsFixture,workspaceId,foreignWorkspaceId} from './buyer-research-jobs-fixture.mjs';

test('migrated SQL enforces workspace ownership, one active company job and cascading task deletion',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 assert.equal(job.status,'queued');assert.equal(job.revision,1);assert.equal(job.workspace_id,workspaceId);assert.equal(job.requested_by,f.users.owner.id);assert.equal(job.session_hash,f.users.owner.sessionTokenHash);assert.notEqual(job.session_hash,f.users.owner.token);
 assert.throws(()=>f.DB.raw.prepare('INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json) VALUES(?,?,?,?,?,?,?)').run('duplicate',workspaceId,f.users.owner.id,f.users.owner.sessionTokenHash,'forge.example','other','{}'),/UNIQUE/);
 assert.throws(()=>f.DB.raw.prepare('INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json) VALUES(?,?,?,?,?,?,?)').run('foreign','missing',f.users.owner.id,f.users.owner.sessionTokenHash,'other.example','other','{}'),/FOREIGN KEY/);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,result_json) VALUES(?,'query-1','search','complete','[]')").run(job.id);f.DB.raw.prepare('DELETE FROM buyer_research_jobs WHERE id=?').run(job.id);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks').get().n,0);
});

test('identical sequential starts reuse one saved generation and domain lookup never crosses workspaces',async t=>{
 const f=await buyerJobsFixture(t),first=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),second=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 assert.equal(first.id,second.id);assert.equal(second.revision,first.revision);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n,1);assert.equal(await readBuyerJob(f.env,foreignWorkspaceId,{id:first.id}),null);assert.equal(await readBuyerJob(f.env,foreignWorkspaceId,{domain:first.domain}),null);
});

test('simultaneous identical starts share a saved job instead of surfacing the active-job unique constraint',async t=>{
 const f=await buyerJobsFixture(t),outcomes=await Promise.allSettled([startBuyerJob(f.env,workspaceId,f.users.owner,f.body),startBuyerJob(f.env,workspaceId,f.users.owner,f.body)]);
 assert.deepEqual(outcomes.map(row=>row.status),['fulfilled','fulfilled'],outcomes.map(row=>row.reason?.message).join(' | '));assert.equal(outcomes[0].value.id,outcomes[1].value.id);assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_jobs WHERE status IN ('queued','running')").get().n,1);
});

test('changed retained identity cancels the old generation and clears its active lease',async t=>{
 const f=await buyerJobsFixture(t),first=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='running',lease_token='old-worker',lease_until=9999999999999 WHERE id=?").run(first.id);
 const next=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,candidate:{...f.candidate,people:f.candidate.people.map(p=>({...p,title:'Operations Director'}))}}),old=await readBuyerJob(f.env,workspaceId,{id:first.id});
 assert.notEqual(next.id,first.id);assert.equal(old.status,'canceled');assert.equal(old.lease_token,null);assert.equal(old.lease_until,0);assert.equal(next.status,'queued');
});

test('a changed authoritative seller context replaces an active job even when buyer input is identical',async t=>{
 const f=await buyerJobsFixture(t),first=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),before=await workspaceBuyerContext(f.env,workspaceId);
 f.DB.raw.prepare("UPDATE customer_workspace_state SET payload_json=json_set(payload_json,'$.main.website','https://replacement-seller.example/'),version=version+1 WHERE workspace_id=?").run(workspaceId);
 assert.notEqual((await workspaceBuyerContext(f.env,workspaceId)).hash,before.hash);
 const next=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);assert.notEqual(next.id,first.id);assert.equal((await readBuyerJob(f.env,workspaceId,{id:first.id})).status,'canceled');assert.equal(JSON.parse(next.input_json).workspaceContext,(await workspaceBuyerContext(f.env,workspaceId)).hash);
});

test('cancel and resume enforce exact revisions and preserve complete task receipts',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,attempts,result_json) VALUES(?,'search-ok','search','complete',1,'[{\"url\":\"https://forge.example/team\"}]'),(?,'read-failed','read','failed',3,'{}')").run(job.id,job.id);
 await assert.rejects(()=>commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'cancel',jobId:job.id,expectedRevision:0}),{status:409});assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).status,'queued');
 const canceled=await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'cancel',jobId:job.id,expectedRevision:1});assert.equal(canceled.status,'canceled');assert.equal(canceled.revision,2);
 await assert.rejects(()=>commandBuyerJob(f.env,workspaceId,f.users.sales,{action:'resume',jobId:job.id,expectedRevision:1}),{status:409});
 const resumed=await commandBuyerJob(f.env,workspaceId,f.users.sales,{action:'resume',jobId:job.id,expectedRevision:2});assert.equal(resumed.status,'queued');assert.equal(resumed.revision,3);assert.equal(resumed.requested_by,f.users.sales.id);assert.equal(resumed.session_hash,f.users.sales.sessionTokenHash);
 const tasks=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=? ORDER BY task_key').all(job.id);assert.equal(tasks.find(row=>row.task_key==='search-ok').result_json,'[{"url":"https://forge.example/team"}]');assert.equal(tasks.find(row=>row.task_key==='search-ok').attempts,1);assert.equal(tasks.find(row=>row.task_key==='read-failed').attempts,0);
});

test('competing cancel commands cannot both acknowledge the same expected revision',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),command={action:'cancel',jobId:job.id,expectedRevision:job.revision};
 const outcomes=await Promise.allSettled([commandBuyerJob(f.env,workspaceId,f.users.owner,command),commandBuyerJob(f.env,workspaceId,f.users.owner,command)]);
 assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);assert.equal(outcomes.find(row=>row.status==='rejected')?.reason.status,409);assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).revision,2);
});

test('a resume that loses its revision race cannot reset failed task attempts',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),canceled=await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'cancel',jobId:job.id,expectedRevision:1});
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,attempts) VALUES(?,'failed','read','failed',2)").run(job.id);
 const outcomes=await Promise.allSettled([commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'resume',jobId:job.id,expectedRevision:canceled.revision}),commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'cancel',jobId:job.id,expectedRevision:canceled.revision})]);
 assert.equal(outcomes[1].status,'fulfilled');assert.equal(outcomes[0].status,'rejected');assert.equal(outcomes[0].reason.status,409);assert.equal(f.DB.raw.prepare("SELECT attempts FROM buyer_research_tasks WHERE job_id=? AND task_key='failed'").get(job.id).attempts,2);
});

test('resuming saved work rejects a changed seller context without resetting its failed tasks',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'cancel',jobId:job.id,expectedRevision:1});
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,attempts) VALUES(?,'failed','read','failed',3)").run(job.id);f.DB.raw.prepare("UPDATE customer_workspace_state SET payload_json=json_set(payload_json,'$.main.website','https://changed.example/') WHERE workspace_id=?").run(workspaceId);
 await assert.rejects(()=>commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'resume',jobId:job.id,expectedRevision:2}),{status:409});assert.equal(f.DB.raw.prepare('SELECT attempts FROM buyer_research_tasks WHERE job_id=?').get(job.id).attempts,3);assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).status,'canceled');
});

test('hashed session authority SQL stops authorizing work after session deletion or member downgrade',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),authorized=()=>f.DB.raw.prepare(`SELECT count(*) n FROM buyer_research_jobs WHERE id=? AND ${authoritySql}`).get(job.id).n;
 assert.equal(authorized(),1);f.DB.raw.prepare("UPDATE workspace_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(workspaceId,f.users.owner.id);assert.equal(authorized(),0);f.DB.raw.prepare("UPDATE workspace_members SET role='owner' WHERE workspace_id=? AND user_id=?").run(workspaceId,f.users.owner.id);assert.equal(authorized(),1);f.DB.raw.prepare('DELETE FROM sessions WHERE token_hash=?').run(f.users.owner.sessionTokenHash);assert.equal(authorized(),0);
});

test('public job reads expose saved progress without session hashes or private task bodies and perform no writes',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,result_json) VALUES(?,'read-body','read','complete','{\"markdown\":\"private task-only body\"}')").run(job.id);
 const before=f.DB.raw.prepare('SELECT * FROM buyer_research_jobs').get(),tasks=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks').all();
 for(let i=0;i<3;i++){const view=await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{domain:'forge.example'}));assert.equal(view.id,job.id);assert.equal(view.progress.completed,1);assert.equal(view.progress.total,1);assert.equal(view.progress.executionStatus,'queued');assert.equal(view.progress.label,'Reading official company sources');assert.ok(!JSON.stringify(view).includes(f.users.owner.sessionTokenHash));assert.ok(!JSON.stringify(view).includes('private task-only body'));}
 assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_jobs').get(),before);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks').all(),tasks);
});

test('client contact execution claims are removed from new server job input',async t=>{
 const f=await buyerJobsFixture(t),person={...f.candidate.people[0],contactResearch:{version:1,checks:{official:{status:'complete'}}},emailResearch:{status:'complete'},publicEmailEvidence:{version:2,sourceRead:true},publicEmailSourceCheck:{status:'confirmed'},patternFindings:[{email:'guessed@forge.example'}]},input=normalizeBuyerInput({candidate:{...f.candidate,people:[person],publicResearch:{accountability:{status:'complete'}},buyerDiscovery:{companyContacts:[person]}}},f.payload);
 assert.equal(input.candidate.people[0].contactResearch,undefined);assert.equal(input.candidate.people[0].emailResearch,undefined);assert.equal(input.candidate.people[0].publicEmailEvidence,undefined);assert.equal(input.candidate.people[0].publicEmailSourceCheck,undefined);assert.deepEqual(input.candidate.publicResearch,{});assert.deepEqual(input.candidate.buyerDiscovery.companyContacts,[]);
});

test('canonical caller profiles retain seller context through the public registry and an unchanged start roundtrip',async t=>{
 const f=await buyerJobsFixture(t),profile={priorityOffers:'precision machining; industrial automation',idealCustomer:'Nordic equipment manufacturers',targetMarkets:'Sweden, Finland',exclusions:'recruiters; competitors',website:'https://seller.example/products',decisionMakers:'Head of Procurement'};
 f.payload.main={...f.payload.main,website:profile.website,targetMarkets:['Sweden','Finland'],profile:{...profile,exclusions:''},answers:{priority_offers:profile.priorityOffers,ideal_customer:profile.idealCustomer,buyer_roles:profile.decisionMakers,exclusions:profile.exclusions}};await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:1,payload:f.payload});
 const first=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,profile}),view=await publicBuyerJob(f.env,first);
 assert.deepEqual(JSON.parse(globalThis.LeadIntelDiscovery.buyerFitContext(view.input.profile)),{offers:'precision machining; industrial automation',buyers:'Nordic equipment manufacturers',markets:'Sweden, Finland',exclusions:'recruiters; competitors',website:'seller.example'});
 const roundtrip=await startBuyerJob(f.env,workspaceId,f.users.owner,{action:'start',candidate:view.candidate,profile:view.input.profile,personIds:view.input.personIds});assert.equal(roundtrip.id,first.id);assert.deepEqual(JSON.parse(roundtrip.input_json).profile,JSON.parse(first.input_json).profile);
});

test('unsupported local, IP and credential-bearing company domains cannot create jobs',async t=>{
 const f=await buyerJobsFixture(t);
 for(const domain of ['127.0.0.1','localhost','private.local','http://[::1]/','https://[::ffff:127.0.0.1]/','https://person:secret@forge.example/team'])await assert.rejects(()=>startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,candidate:{...f.candidate,domain}}),{status:400});
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n,0);
});

test('a submitted profile that conflicts with authoritative targeting answers cannot cancel the newest job',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),before=await readBuyerJob(f.env,workspaceId,{id:job.id});
 await assert.rejects(()=>startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,candidate:{...f.candidate,company:'Changed company claim'},profile:{...f.payload.main.profile,website:f.payload.main.website,priorityOffers:'Unapproved caller offer'}}),{status:409});
 assert.deepEqual(await readBuyerJob(f.env,workspaceId,{id:job.id}),before);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n,1);
});

test('a stale force-start job ID or revision cannot replace the newest generation',async t=>{
 const f=await buyerJobsFixture(t),first=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),latest=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,candidate:{...f.candidate,people:f.candidate.people.map(person=>({...person,title:'Operations Director'}))}}),before=await readBuyerJob(f.env,workspaceId,{id:latest.id});
 await assert.rejects(()=>startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,force:true,jobId:first.id,expectedRevision:first.revision}),{status:409});
 await assert.rejects(()=>startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,force:true,jobId:latest.id,expectedRevision:latest.revision-1}),{status:409});
 assert.deepEqual(await readBuyerJob(f.env,workspaceId,{id:latest.id}),before);assert.equal((await readBuyerJob(f.env,workspaceId,{id:first.id})).status,'canceled');assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_jobs').get().n,2);
});

test('public job progress distinguishes queued execution from actual task checkpoints without exposing source bodies',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,updated_at,result_json) VALUES(?,'saved-read','read','complete','2026-11-03 15:00:00','{\"markdown\":\"private source\"}')").run(job.id);const view=await publicBuyerJob(f.env,job);assert.equal(view.createdAt,new Date(job.created_at.replace(' ','T')+'Z').toISOString());assert.equal(view.progress.executionStatus,'queued');assert.equal(view.progress.completed,1);assert.equal(view.progress.inProgress,0);assert.ok(Date.parse(view.progress.lastActivityAt)>=Date.parse(job.updated_at.replace(' ','T')+'Z'));assert.match(view.progress.label,/official company sources/i);assert.ok(!JSON.stringify(view).includes('private source'));
});

test('timing uses five same-workspace same-scope completed runs and distinguishes scheduling from results',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 assert.equal((await publicBuyerJob(f.env,job)).progress.timing.estimate,null);
 for(let i=0;i<5;i++)f.DB.raw.prepare("INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json,status,phase,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'complete','done',datetime('now','-1 hour'),datetime('now','-1 hour',?))").run('history-'+i,workspaceId,job.requested_by,job.session_hash,'history-'+i+'.example','history',job.input_json,'+'+(i+1)+' minutes');
 const view=await publicBuyerJob(f.env,{...job,next_at:Date.now()+60000});
 assert.equal(view.progress.timing.estimate.samples,5);assert.equal(view.progress.timing.estimate.lowerSeconds,180);assert.equal(view.progress.timing.estimate.upperSeconds,300);assert.ok(Date.parse(view.progress.timing.nextAttemptAt)>Date.now());assert.equal(view.progress.timing.lastResultAt,null);
 const paid={...job,input_json:JSON.stringify({...JSON.parse(job.input_json),paidResearch:{enabled:true}})};
 assert.equal((await publicBuyerJob(f.env,paid)).progress.timing.estimate,null);
 const selected={...job,input_json:JSON.stringify({...JSON.parse(job.input_json),scope:'selected_buyers',personIds:['robert']})};
 assert.equal((await publicBuyerJob(f.env,selected)).progress.timing.estimate,null);
});

test('company refresh reuses server dossier and retained buyers across a selected-person generation',async t=>{
 const f=await buyerJobsFixture(t),first=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),saved=JSON.parse(first.result_json);
 saved.buyerDiscovery={...saved.buyerDiscovery,companyDossier:{status:'complete',facts:[],people:[],channels:[],sources:[],passes:[]}};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',result_json=? WHERE id=?").run(JSON.stringify(saved),first.id);
 const selected=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,personIds:['robert'],force:true});
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review' WHERE id=?").run(selected.id);
 const resumed=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,resumeIncomplete:true,candidate:{...f.candidate,people:[]}});
 const result=JSON.parse(resumed.result_json);assert.equal(result.people.length,saved.people.length);assert.equal(result.buyerDiscovery.companyDossier.status,'complete');
});
