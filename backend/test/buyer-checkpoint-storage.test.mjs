import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {compactBuyerCheckpoint,readBuyerCheckpoint} from '../src/buyer-checkpoint.js';

const legacyReason='Workspace storage is full. Completed evidence is preserved; free space and resume.';
const facts=Array.from({length:420},(_,i)=>({quote:'Stålkonstruktioner — company evidence. '.repeat(45),sourceUrl:'https://forge.example/team',page:i}));
const dossier={status:'complete',facts,channels:[],sources:[],people:[],passes:[]};

function request(f,body){
 const headers={Origin:f.env.APP_ORIGIN,Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'};
 return app.fetch(new Request(f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers,body:JSON.stringify(body)}),f.env,{});
}
async function tick(f,jobId,services){
 const waits=[];
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{
  runBuyerResearchJobs:env=>runBuyerResearchJobs(env,{jobId,maxJobs:1,services}),runWebsiteContactJobs:async()=>[]
 });
 await Promise.all(waits);
}

test('a checkpoint that cannot fit in the remaining 0.59 MB advances on the registered scheduler with all source evidence intact',async t=>{
 const f=await buyerJobsFixture(t);
 const job=(await (await request(f,{...f.body,fullResearch:true,peopleFirst:true})).json()).job;
 const row=()=>f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='dossier' WHERE id=?").run(job.id);
 f.DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=records_bytes+590000 WHERE workspace_id=?').run(workspaceId);
 const candidate={...JSON.parse(row().result_json),buyerDiscovery:{companyDossier:dossier}};
 assert.throws(()=>f.DB.raw.prepare('UPDATE buyer_research_jobs SET result_json=? WHERE id=?').run(JSON.stringify(candidate),job.id),/WORKSPACE_STORAGE_FULL/);
 let calls=0;
 await tick(f,job.id,{registry:async()=>({status:'unsupported'}),dossier:async()=>{calls++;return dossier;}});
 assert.equal(calls,1);
 assert.equal(row().phase,'contacts');assert.equal(row().status,'queued');
 assert.deepEqual(readBuyerCheckpoint(row().result_json).buyerDiscovery.companyDossier,dossier);
 const status=await app.fetch(new Request(f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId+'&job_id='+job.id,{headers:{Cookie:'leadintel_session='+f.users.owner.token}}),f.env,{});
 assert.equal(status.status,200);
 const view=(await status.json()).job;
 assert.equal(view.id,job.id);assert.ok(view.candidate.buyerDiscovery.companyDossier.facts.length);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,0);
});

test('an authorized resume compacts legacy history, retains the roster and reuses the saved job and receipts',async t=>{
 const f=await buyerJobsFixture(t);
 const job=(await (await request(f,{...f.body,fullResearch:true,peopleFirst:true})).json()).job;
 const row=()=>f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id);
 const original={...JSON.parse(row().result_json),buyerDiscovery:{companyDossier:dossier},publicResearch:{accountability:{status:'partial',stopReason:'time_budget'}}};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',last_error=?,result_json=? WHERE id=?").run(legacyReason,JSON.stringify(original),job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json) VALUES(?,'team','read','official','team','complete',1,'{}')").run(job.id);
 const account=()=>f.DB.raw.prepare('SELECT * FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId);
 f.DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=records_bytes WHERE workspace_id=?').run(workspaceId);
 const before=account();
 const result=await request(f,{action:'resume',jobId:job.id,expectedRevision:row().revision,allowMeteredPublicResearch:true});
 assert.equal(result.status,200);
 const resumed=(await result.json()).job;assert.equal(resumed.id,job.id);assert.equal(resumed.status,'queued');assert.equal(resumed.progress.completed,1);
 assert.ok(before.records_bytes-account().records_bytes>590000);assert.equal(account().files_bytes,before.files_bytes);
 assert.deepEqual(readBuyerCheckpoint(row().result_json),original);
 assert.deepEqual(JSON.parse(row().result_json).people.map(p=>p.id),original.people.map(p=>p.id));
 assert.equal(JSON.parse(row().result_json).publicResearch.accountability.stopReason,'time_budget');
 assert.equal(compactBuyerCheckpoint(row().result_json),row().result_json);
});

test('resume holds a known oversized write without opening a new research window',async t=>{
 const f=await buyerJobsFixture(t);
 const job=(await (await request(f,{...f.body,fullResearch:true,peopleFirst:true})).json()).job;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',last_error='workspace_records_full:1000000' WHERE id=?").run(job.id);
 f.DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=records_bytes+590000 WHERE workspace_id=?').run(workspaceId);
 const row=()=>f.DB.raw.prepare('SELECT status,revision,input_json FROM buyer_research_jobs WHERE id=?').get(job.id);
 const before=row();
 const response=await request(f,{action:'resume',jobId:job.id,allowMeteredPublicResearch:true,expectedRevision:before.revision});
 assert.equal(response.status,507);assert.match((await response.json()).error,/needs at least \d+ KB more CRM & workspace data/);
 assert.deepEqual(row(),before);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks').get().n,0);
});

test('Find buyers in a free-only workspace cannot requeue an older metered run',async t=>{
 const f=await buyerJobsFixture(t),find={...f.body,peopleFirst:true,fullResearch:true,allowFreeFallback:true};
 const job=(await (await request(f,find)).json()).job;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='official',last_error=?,input_json=json_remove(input_json,'$.emailWaterfallVersion') WHERE id=?").run(legacyReason,job.id);
 f.DB.raw.prepare("INSERT INTO workspace_research_settings(workspace_id,full_research_policy) VALUES(?,'free_only') ON CONFLICT(workspace_id) DO UPDATE SET full_research_policy='free_only'").run(workspaceId);
 const snapshot=()=>f.DB.raw.prepare('SELECT * FROM buyer_research_jobs WHERE id=?').get(job.id);
 const before=snapshot();
 const response=await request(f,find);
 assert.equal(response.status,200);
 const saved=(await response.json()).job;
 assert.equal(saved.id,job.id);
 assert.equal(saved.status,'needs_review');
 assert.deepEqual(snapshot(),before);
 await tick(f,job.id,{});
 assert.deepEqual(snapshot(),before);
 assert.equal(f.DB.raw.prepare('SELECT count(*) AS n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n,0);
 // Older jobs can carry the metered approval without the newer Full flag.
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_remove(input_json,'$.fullResearch') WHERE id=?").run(job.id);
 const legacy=snapshot(),resume={action:'resume',jobId:job.id,expectedRevision:legacy.revision};
 assert.equal((await request(f,resume)).status,200);
 assert.equal((await request(f,{...resume,allowMeteredPublicResearch:true})).status,403);
 assert.deepEqual(snapshot(),legacy);
});

test('a saved full run paused at official sources keeps its checkpoint until authorized Resume',async t=>{
 const f=await buyerJobsFixture(t),find={...f.body,peopleFirst:true,fullResearch:true};
 const job=(await (await request(f,find)).json()).job;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='official',last_error=?,input_json=json_remove(input_json,'$.emailWaterfallVersion') WHERE id=?").run(legacyReason,job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,status,attempts) VALUES(?,'saved-page','read','official','complete',1)").run(job.id);
 const opened=(await (await request(f,find)).json()).job;
 assert.equal(opened.phase,'official');
 assert.equal(opened.status,'needs_review');
 const resumed=await request(f,{action:'resume',jobId:job.id,expectedRevision:opened.revision,allowMeteredPublicResearch:true});
 assert.equal(resumed.status,200);
 const value=(await resumed.json()).job;
 assert.equal(value.id,job.id);assert.equal(value.phase,'official');assert.equal(value.progress.completed,1);
 const input=JSON.parse(f.DB.raw.prepare('SELECT input_json FROM buyer_research_jobs WHERE id=?').get(job.id).input_json);
 assert.equal(input.emailWaterfallVersion,1);
});
