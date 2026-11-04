import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {readBuyerJob,startBuyerJob} from '../src/buyer-research-store.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';

async function scheduledSlice(f,id,services,windowMs=50000){
 const waits=[],noop=async()=>({completed:0});let used;
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:async(env,options)=>{const result=await runBuyerResearchJobs(env,{...options,maxJobs:1,windowMs,services,jobId:id});used=env.bookInvocationBudget.used;return result;},runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);return used;
}

test('a timeout while replaying cached checks cannot abandon contacts because no new task was written',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);let calls=0,now=Date.now(),latency=0;t.mock.method(Date,'now',()=>now);
 const services={search:async()=>{calls++;return [];},read:async url=>({url,markdown:'Robert Lund — Head of Procurement — Forge Industries',metadata:{sourceURL:url}}),independent:async()=>({status:'not_configured',results:[]})};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);await scheduledSlice(f,job.id,services);
 const first=await readBuyerJob(f.env,workspaceId,{id:job.id}),candidate=JSON.parse(first.result_json),before=calls;candidate.people[0].contactResearch.checks.gmail.status='partial';
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',phase_ms=0,phase_runs=0,result_json=? WHERE id=?").run(JSON.stringify(candidate),job.id);
 const prepare=f.DB.prepare.bind(f.DB);t.mock.method(f.DB,'prepare',sql=>{now+=latency;return prepare(sql);});latency=80;
 await scheduledSlice(f,job.id,services,2000);const partial=await readBuyerJob(f.env,workspaceId,{id:job.id});
 assert.equal(JSON.parse(partial.result_json).publicResearch.accountability.stopReason,'time_budget');assert.equal(calls,before,'The interrupted pass used only successful saved receipts');assert.equal(partial.phase,'contacts','Zero newly saved tasks cannot turn an interrupted pass into a finished phase');assert.equal(partial.status,'queued');
 latency=0;await scheduledSlice(f,job.id,services);const resumed=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(resumed.phase,'review');assert.equal(JSON.parse(resumed.result_json).publicResearch.accountability.checkedPeople,1);assert.equal(calls,before);
});

for(const mode of ['eligible','queued_review','revoked','changed_context','replaced','already_recovered','canceled'])test(`actual scheduler repairs a legacy contact-timeout once, with ${mode} authority`,async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),candidate={...f.candidate,publicResearch:{accountability:{...globalThis.LeadIntelDiscovery.createBuyerResearchAccountability(),status:'partial',stopReason:'time_budget'}}};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status=?,phase='done',input_json=json_remove(input_json,'$.contactContinuationVersion'),result_json=?,diagnostic_json='[]' WHERE id=?").run(mode==='canceled'?'canceled':'needs_review',JSON.stringify(candidate),job.id);
 if(mode==='queued_review')f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='queued',phase='review' WHERE id=?").run(job.id);
 if(mode==='already_recovered')f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.contactContinuationVersion',1,'$.contactSchedulingRecoveryVersion',1) WHERE id=?").run(job.id);
 if(mode==='revoked')f.DB.raw.prepare("UPDATE workspace_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(workspaceId,f.users.owner.id);
 if(mode==='changed_context')f.DB.raw.prepare("UPDATE customer_workspace_state SET payload_json=json_set(payload_json,'$.main.website','https://changed.example/'),version=version+1 WHERE workspace_id=?").run(workspaceId);
 if(mode==='replaced')await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,force:true});
 let calls=0;const services={search:async()=>{calls++;return [];},read:async url=>({url,markdown:'Robert Lund — Head of Procurement — Forge Industries',metadata:{sourceURL:url}}),dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',results:[]}),review:async()=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:['robert'],findings:[]},conflicts:[]})};
 const before=await readBuyerJob(f.env,workspaceId,{id:job.id});
 if(mode==='eligible'){
  const response=await app.fetch(new Request(f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId+'&job_id='+job.id,{headers:{Cookie:'leadintel_session='+f.users.owner.token}}),f.env,{});assert.equal(response.status,200);assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).revision,before.revision,'Read-only restore does not launch the repair');
 }
 await scheduledSlice(f,job.id,services);if(mode==='queued_review')await scheduledSlice(f,job.id,services);
 // Repair now revisits missing upstream owners as well as contact checks.
 if(['eligible','queued_review'].includes(mode))for(let i=0;i<5&&(await readBuyerJob(f.env,workspaceId,{id:job.id})).phase!=='review';i++)await scheduledSlice(f,job.id,services);
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});
 if(['eligible','queued_review'].includes(mode)){
  assert.equal(saved.status,'queued','An interrupted pre-fix job must resume without asking the user to restart it');assert.equal(saved.phase,'review');assert.ok(calls>0);assert.equal(JSON.parse(saved.result_json).publicResearch.accountability.checkedPeople,1);assert.equal(JSON.parse(saved.input_json).contactContinuationVersion,1);assert.equal(saved.id,job.id);
 }else{assert.equal(saved.status,before.status);assert.equal(saved.result_json,before.result_json);assert.equal(calls,0,'Canceled, replaced, revoked, changed-context and already recovered work cannot restart');}
});

for(const replacementStatus of ['queued','canceled'])test(`a ${replacementStatus} replacement arriving during legacy recovery prevents the older request from restarting`,async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),candidate={...f.candidate,publicResearch:{accountability:{...globalThis.LeadIntelDiscovery.createBuyerResearchAccountability(),status:'partial',stopReason:'time_budget'}}};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='done',input_json=json_remove(input_json,'$.contactContinuationVersion'),result_json=? WHERE id=?").run(JSON.stringify(candidate),job.id);
 const prepare=f.DB.prepare.bind(f.DB);let replaced=false,calls=0;
 t.mock.method(f.DB,'prepare',sql=>{
  if(!replaced&&sql.startsWith('UPDATE buyer_research_jobs SET input_json=')){
   replaced=true;f.DB.raw.prepare("INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json,result_json,status,phase) SELECT 'newer-request',workspace_id,requested_by,session_hash,domain,context_key,input_json,result_json,?,'official' FROM buyer_research_jobs WHERE id=?").run(replacementStatus,job.id);
  }
  return prepare(sql);
 });
 await scheduledSlice(f,job.id,{search:async()=>{calls++;return [];}});assert.equal(replaced,true);const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(saved.status,'needs_review','An older request cannot reactivate after a newer one exists');assert.equal(saved.phase,'done');assert.equal(calls,0);
 const receipts=f.DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='operations.scheduler' AND entity_type='buyer_research'").all();assert.ok(receipts.every(row=>JSON.parse(row.metadata_json).outcome!=='failed'),'A racing queued replacement must not fail the entire scheduler task');
});

test('the actual scheduler finishes the bounded ten-person contact plan across slow slices without replaying completed searches',async t=>{
 const f=await buyerJobsFixture(t),names=['Alex Smith','Bo Svensson','Cecilia Berg','David Lind','Emma Wilson','Felix Turner','Grace Moore','Hugo Allen','Ida Jones','Jan Andersson'];
 const candidate={...f.candidate,people:names.map((name,i)=>({id:'buyer-'+i,name,publicName:name,title:'Head of Procurement',organization:'Forge Industries',publicNameUrl:'https://forge.example/team',kept:true}))};
 let now=Date.now(),slow=false;const calls=[],reads=[],phases=[];t.mock.method(Date,'now',()=>now);
 const text=names.map((name,i)=>`### ${name}\nHead of Procurement${i<4?`\n[${name.toLowerCase().replaceAll(' ','.')}@forge.example](mailto:${name.toLowerCase().replaceAll(' ','.')}@forge.example)`:''}\nForge Industries`).join('\n\n');
 const services={search:async query=>{calls.push(query);if(slow)now+=3000;return [];},read:async url=>{reads.push(url);return {url,markdown:text,metadata:{sourceURL:url,source:'direct-fallback'}};},dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',reason:'No independent test connection',results:[]}),review:async()=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:names.map((_,i)=>'buyer-'+i),findings:[]},conflicts:[]})};
 const url=f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,headers={Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'};
 const response=await app.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify({action:'start',candidate})}),f.env,{});assert.equal(response.status,200,await response.clone().text());
 const {job}=await response.json();let saved;
 for(let i=0;i<24;i++){
  saved=await readBuyerJob(f.env,workspaceId,{id:job.id});if(!['queued','running'].includes(saved.status))break;
  slow=saved.phase==='contacts';const waits=[],noop=async()=>({completed:0});let used;
  await app.scheduled({cron:'* * * * *',scheduledTime:now},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:async(env,options)=>{const result=await runBuyerResearchJobs(env,{...options,maxJobs:1,windowMs:50000,services,jobId:job.id});used=env.bookInvocationBudget.used;return result;},runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);
  saved=await readBuyerJob(f.env,workspaceId,{id:job.id});phases.push({phase:saved.phase,status:saved.status,ms:saved.phase_ms,runs:saved.phase_runs});assert.ok(used<=900,'Each real scheduler invocation retains database headroom');
 }
 const result=JSON.parse(saved.result_json);t.diagnostic(JSON.stringify({phases,searches:calls.length,checked:result.publicResearch.accountability.checkedPeople}));
 assert.equal(result.publicResearch.accountability.status,'complete','A processing-slice timeout must resume the unfinished public plan, not advance it to review');
 assert.equal(result.publicResearch.accountability.checkedPeople,10);assert.equal(saved.phase,'done');
 assert.ok(globalThis.LeadIntelDiscovery.buyerResearchCoveragePassed(result));
 assert.equal(globalThis.LeadIntelDiscovery.confirmedBuyerShortlist(result.people,f.payload.main.profile,result).priorityIds.length,4,'Four actually read and attributed contact emails are retained');
 const completed=f.DB.raw.prepare("SELECT request_value FROM buyer_research_tasks WHERE job_id=? AND kind='search' AND status='complete'").all(job.id);
 for(const task of completed)assert.ok(calls.filter(query=>query===task.request_value).length<=2,'Completed search results are reused; only an interrupted first dispatch may retry');
 const before=calls.length,reopened=await app.fetch(new Request(url+'&job_id='+job.id,{headers}),f.env,{});assert.equal(reopened.status,200);assert.equal((await reopened.json()).job.candidate.publicResearch.accountability.checkedPeople,10);assert.equal(calls.length,before,'Read-only reopen cannot repeat research');
 const restored=(await (await app.fetch(new Request(url+'&job_id='+job.id,{headers}),f.env,{})).json()).job.candidate;
 for(const person of globalThis.LeadIntelDiscovery.mandatoryBuyerResearchPriorities(restored.people,restored,{forExecution:true})){for(const key of globalThis.LeadIntelDiscovery.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks)assert.ok(globalThis.LeadIntelDiscovery.buyerResearchCheckPassed(restored,person,key),person.id+' retained '+key);assert.equal(person.contactResearch.checks.gmail.queryLog.length,3);}
 assert.equal(calls.length,before);
 assert.ok(reads.length>0);
});
