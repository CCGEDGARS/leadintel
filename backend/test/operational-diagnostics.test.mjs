import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../src/security.js';
import core from '../src/index.js';
import app from '../src/app.js';
import {operationalDiagnostics,handleOperationalDiagnosticsRoute} from '../src/operational-diagnostics.js';
import {observeScheduledTask,recordOperationalStage} from '../src/operational-observability.js';

class Statement{
 constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}
 bind(...args){this.args=args;return this;}
 async first(){return this.db.raw.prepare(this.sql).get(...this.args)||null;}
 async all(){const results=this.db.raw.prepare(this.sql).all(...this.args);this.db.afterRead?.(this.sql);return {results};}
 async run(){const result=this.db.raw.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes)}};}
}
class DB{
 constructor(){this.raw=new DatabaseSync(':memory:');for(const file of ['0001_initial.sql','0005_run_orchestration.sql','0006_verified_email_enrichment.sql','0009_customer_saas.sql','0011_master_crm.sql','0012_crm_contact_enrichment.sql','0014_market_monitoring.sql','0015_outreach_automation.sql','0017_intelligence_sources.sql','0018_identity_projects_activity.sql','0019_microsoft_mail.sql','0027_approved_workflow.sql','0030_saved_flows.sql','0041_additional_contact_services.sql','0043_additional_contact_provider_receipts.sql','0045_treg_paid_search.sql','0049_supervised_follow_up.sql','0065_strategy_monitoring_integrity.sql'])this.raw.exec(fs.readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));this.raw.exec("INSERT INTO workspaces(id,name,market,owner_user_id) VALUES('w1','Private tenant one','Global','owner-edgars'),('w2','Private tenant two','Global','owner-edgars');INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('w1','owner-edgars','owner');");}
 prepare(sql){return new Statement(this,sql);}
 async batch(statements){this.raw.exec('BEGIN');try{const result=[];for(const statement of statements){const r=this.raw.prepare(statement.sql).run(...statement.args);result.push({meta:{changes:Number(r.changes)}});}this.raw.exec('COMMIT');return result;}catch(cause){this.raw.exec('ROLLBACK');throw cause;}}
}
const now=new Date('2026-10-31T12:00:00.000Z');
const env=()=>({DB:new DB()});
async function fixture(){const value=env();const token='operations-test-token';value.DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'owner-edgars',datetime('now','+1 day'))").run(await sha256(token));return {env:value,token};}
const request=(path='/api/operations/diagnostics?workspace_id=w1',token,method='GET')=>new Request('https://api.test'+path,{method,headers:token?{Cookie:'leadintel_session='+token}:{}});
const receipt=(db,{task='saved_flows',outcome='completed',at=now.toISOString(),id=crypto.randomUUID(),workspaceId=null,type='operations.scheduler',meta={}}={})=>db.raw.prepare('INSERT INTO audit_events(id,workspace_id,event_type,entity_type,entity_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)').run(crypto.randomUUID(),workspaceId,type,task,id,JSON.stringify({outcome,durationMs:12,...meta}),at);

test('actual core and production app expose only authenticated explicit workspace read-only diagnostics',async()=>{
 const {env,token}=await fixture();
 assert.equal((await core.fetch(request(),env)).status,401);
 assert.equal((await core.fetch(request(undefined,'invalid-session'),env)).status,401);
 assert.equal((await core.fetch(request('/api/operations/diagnostics',token),env)).status,400);
 assert.equal((await core.fetch(request('/api/operations/diagnostics?workspace_id=w2',token),env)).status,403);
 assert.equal((await core.fetch(request('/api/operations/diagnostics?workspace_id=w1',token,'POST'),env)).status,405);
 const before=env.DB.raw.prepare('SELECT total_changes() AS n').get().n;
 const response=await app.fetch(request(undefined,token),env,{});
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(env.DB.raw.prepare('SELECT total_changes() AS n').get().n,before);
 const data=await response.json();for(const key of ['queue','workflow','monitoring','research','contactAttempts','apolloReservations','stageReceipts','auditSignals','sourceHealth'])assert.equal(data[key].status,'recorded',key);
 assert.ok(data.scheduler.every(row=>row.status==='unknown'&&row.missedRun===null));
 assert.equal(data.charges.confirmedRecordedAmountMicro,null);
});

test('safe acceptance, CRM outbox, follow-up queue and source failure projections expose no customer text',async()=>{
 const value=env(),db=value.DB;
 db.raw.exec("CREATE TABLE workspace_storage_accounts(workspace_id TEXT PRIMARY KEY,plan_key TEXT DEFAULT 'included',paid_until INTEGER DEFAULT 0,records_bytes INTEGER DEFAULT 0,included_records_limit INTEGER DEFAULT 10000000,plus_records_limit INTEGER DEFAULT 10000000);");
 db.raw.exec(`INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,created_at) VALUES('private-accepted','w1','private-key','secret.test','secret@tenant.test','private subject','sending','2026-10-31T10:00:00Z');
 INSERT INTO conversation_plans(id,message_id,workspace_id,approved_by,approved_at,context_version,mailbox_identity,company_id,contact_id,company_revision,contact_revision,policy_revision) VALUES('private-plan','private-accepted','w1','owner-edgars',CURRENT_TIMESTAMP,'private-context','secret@tenant.test','private-company','private-person','1','1','1');
 INSERT INTO conversation_plan_steps(id,plan_id,workspace_id,step_index,body,subject,days,scheduled_at,status) VALUES('private-step','private-plan','w1',1,'private body','private subject',3,'2026-01-01T00:00:00Z','sending');
 INSERT INTO conversation_events(id,message_id,workspace_id,provider_message_id,direction,body,occurred_at,ready) VALUES('private-event','private-accepted','w1','private-provider-id','outbound','private body','2026-01-01T00:00:00Z',1);
 INSERT INTO intelligence_sources(id,workspace_id,name,canonical_url,host,health_status,access_status,consecutive_failures,mandatory) VALUES('private-source','w1','Private source','https://secret.test','secret.test','failing','no_access',3,1);`);
 db.raw.prepare("INSERT INTO audit_events(id,workspace_id,event_type,entity_type,entity_id,metadata_json,created_at) VALUES('private-acceptance','w1','email.delivery_accepted','gmail_message','private-accepted',?,'2026-10-31T10:00:01Z')").run(JSON.stringify({message:{recipient:'secret@tenant.test',subject:'private subject'}}));
 const result=await operationalDiagnostics(db,'w1',{now});assert.equal(result.delivery.acceptanceReceipts.rows[0].status,'persistence_mismatch');assert.equal(result.delivery.followups.rows[0].uncertain,true);assert.equal(result.delivery.crmOutbox.rows[0].status,'pending_crm');assert.equal(result.sourceHealth.rows[0].consecutiveFailures,3);assert.ok(result.findings.some(row=>row.code==='research_source_failing'));assert.ok(result.findings.some(row=>row.code==='provider_acceptance_persistence_mismatch'));
 assert.doesNotMatch(JSON.stringify(result),/secret@|secret\.test|private-(?:key|accepted|context|company|person|provider|source|body|subject)|Private source/);
});

test('observability storage failure cannot prevent work or replace its real outcome',async()=>{
 const broken={DB:{batch:async()=>{throw Error('private storage outage');}}};let ran=0;const warn=console.warn;console.warn=()=>{};
 try{assert.equal(await observeScheduledTask(broken,'saved_flows',async()=>++ran),1);assert.equal(await recordOperationalStage(broken,{workspaceId:'w1',stage:7,outcome:'failed'}),false);}finally{console.warn=warn;}
 assert.equal(ran,1);
});

test('revoked session, removed membership, and changed role during reads cannot return snapshot',async()=>{
 for(const mutation of ["DELETE FROM sessions","DELETE FROM workspace_members WHERE workspace_id='w1'","UPDATE workspace_members SET role='researcher' WHERE workspace_id='w1'"]){
  const {env,token}=await fixture();let fired=false;env.DB.afterRead=sql=>{if(!fired&&sql.includes('FROM outreach_automation_queue')){fired=true;env.DB.raw.exec(mutation);}};
  const response=await handleOperationalDiagnosticsRoute(request(undefined,token),env);assert.equal(response.status,403);assert.equal(fired,true);
 }
});

test('actual persisted outstanding and historical states retain uncertainty, age, lease/revision mismatch and privacy',async()=>{
 const {DB:db}=env();
 db.raw.exec(`INSERT INTO gmail_connections(workspace_id,user_id,google_email) VALUES('w1','owner-edgars','secret@tenant.test');
 INSERT INTO outreach_automation_sequences(id,workspace_id,gmail_connection_workspace_id,source_package_key,domain,recipient,approved_at,initial_subject,initial_body) VALUES('private-sequence','w1','w1','private-key','secret.test','secret@tenant.test',CURRENT_TIMESTAMP,'private subject','private body');
 INSERT INTO outreach_automation_queue(id,workspace_id,sequence_id,gmail_connection_workspace_id,recipient,subject,body,status,earliest_send_at,scheduled_send_at,idempotency_key,created_at,updated_at,last_error_code) VALUES('private-queue','w1','private-sequence','w1','secret@tenant.test','private subject','private body','failed','2026-01-01','2026-01-01','private-key','2026-01-01 01:00:00','2026-01-01 01:00:00','ambiguous_send_state');
 INSERT INTO saved_flows(id,workspace_id,name,revision) VALUES('private-flow','w1','Private flow name',2);
 INSERT INTO approved_workflow_runs(id,workspace_id,flow_id,revision,status,lease_until,created_at) VALUES('private-run','w1','private-flow',1,'running','2026-01-01T00:00:00Z','2026-01-01 01:00:00');
 INSERT INTO research_runs(id,workspace_id,idempotency_key,status,deadline_at,created_at) VALUES('private-research','w1','private-key','accepted','2026-01-01','2026-01-01 01:00:00');
 INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,created_at) VALUES('private-message','w1','private-key','secret.test','secret@tenant.test','private subject','sending','2026-01-01 01:00:00');
 INSERT INTO microsoft_mail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,provider_status,created_at) VALUES('private-microsoft','w1','private-key','secret.test','secret@tenant.test','private subject','sent','unknown','2026-01-01 01:00:00');
 INSERT INTO additional_contact_attempts(workspace_id,company_id,person_id,month,provider,status,result_json,created_at) VALUES('w1','private-company','Private Person','2026-01','treg','needs_review','{"provider_started":true,"error":"secret@tenant.test"}','2026-01-01 01:00:00');
 INSERT INTO market_monitoring_configs(workspace_id,frequency,research_depth,lease_id,lease_expires_at,enabled,next_run_at) VALUES('w1','daily','quick','private-lease','2026-01-01T00:00:00Z',1,'2026-01-01T00:00:00Z');
 INSERT INTO market_monitoring_runs(id,workspace_id,trigger_type,research_depth,status,query_count,source_count,alert_count,started_at,completed_at,error_message) VALUES('private-monitor','w1','manual','quick','partial',4,2,1,'2026-10-31T10:00:00Z','2026-10-31T10:00:08Z','secret error');`);
 receipt(db,{workspaceId:'w1',type:'gmail.post_send_sync_failed',meta:{recipient:'secret@tenant.test',error:'secret'}});
 receipt(db,{workspaceId:'w2',type:'gmail.post_send_sync_failed',meta:{recipient:'other@tenant.test'}});
 const result=await operationalDiagnostics(db,'w1',{now});
 assert.equal(result.queue.rows[0].duplicateHold,true);assert.equal(result.queue.rows[0].uncertain,true);
 assert.ok(result.queue.rows[0].ageSeconds>7*86400);
 assert.equal(result.workflow.rows[0].revisionMismatch,true);assert.equal(result.workflow.rows[0].leaseExpired,true);
 assert.equal(result.research.rows[0].deadlineMissed,true);assert.equal(result.delivery.gmail.rows[0].uncertain,true);assert.equal(result.delivery.microsoft.rows[0].uncertain,true);
 assert.equal(result.monitoring.rows[0].durationMs,8000);assert.equal(result.contactAttempts.rows[0].reservationRetained,true);
 assert.ok(result.findings.some(row=>row.code==='provider_acceptance_persistence_mismatch'));
 assert.equal(result.auditSignals.sampled,1);
 assert.doesNotMatch(JSON.stringify(result),/secret@|secret\.test|Private Person|private-(?:key|flow|company|sequence|queue|run|message|lease|subject|body)|secret error|other@/);
});

test('scheduler records real executions and preserves return/error without private summary content',async()=>{
 const value=env();const result={completed:2,secret:'secret@tenant.test'};
 assert.equal(await observeScheduledTask(value,'saved_flows',async()=>result),result);
 const cause=Error('private provider response secret@tenant.test');await assert.rejects(observeScheduledTask(value,'outreach_delivery',async()=>{throw cause;}),error=>error===cause);
 await observeScheduledTask(value,'market_monitoring',async()=>[{status:'partial',reason:'private result'}]);
 const saved=value.DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='operations.scheduler'").all().map(row=>JSON.parse(row.metadata_json));
 assert.equal(saved.length,6);assert.equal(saved.filter(row=>row.outcome==='started').length,3);assert.ok(saved.some(row=>row.outcome==='failed'));assert.ok(saved.some(row=>row.outcome==='partial'));assert.ok(saved.filter(row=>row.outcome!=='started').every(row=>Number.isInteger(row.durationMs)));
 assert.doesNotMatch(JSON.stringify(saved),/secret|private|provider response/);
});

test('scheduler absence is unknown and only actual receipt timestamps trigger proposed overdue detection',async()=>{
 const {DB:db}=env();receipt(db,{task:'saved_flows',outcome:'started',id:'invocation',at:'2026-10-31T08:00:00.000Z'});receipt(db,{task:'saved_flows',outcome:'failed',id:'invocation',at:'2026-10-31T08:00:01.000Z'});
 const result=await operationalDiagnostics(db,'w1',{now});const task=result.scheduler.find(row=>row.task==='saved_flows');assert.equal(task.status,'failed');assert.equal(task.missedRun,true);assert.equal(task.receiptStale,true);assert.equal(task.thresholdBasis,'proposed_two_cadences_not_measured_SLA');
 assert.equal(result.scheduler.find(row=>row.task==='approved_workflows').status,'unknown');
 assert.ok(result.findings.some(row=>row.code==='scheduled_handler_failed'));
});

test('same-millisecond invocation finish matches operation rather than row ordering',async()=>{
 const {DB:db}=env();receipt(db,{outcome:'started',id:'same'});receipt(db,{outcome:'completed',id:'same'});const result=await operationalDiagnostics(db,'w1',{now});assert.equal(result.scheduler.find(row=>row.task==='saved_flows').status,'completed');
});

test('concurrent same-clock invocations select the newest actual start and its own finish',async()=>{
 const {DB:db}=env();receipt(db,{outcome:'started',id:'older'});receipt(db,{outcome:'started',id:'newer'});receipt(db,{outcome:'failed',id:'older'});
 let result=await operationalDiagnostics(db,'w1',{now});assert.equal(result.scheduler.find(row=>row.task==='saved_flows').status,'running');
 receipt(db,{outcome:'completed',id:'newer'});result=await operationalDiagnostics(db,'w1',{now});assert.equal(result.scheduler.find(row=>row.task==='saved_flows').status,'completed');
});

test('fresh sending is in flight, explicit uncertainty or expiry requires reconciliation',async()=>{
 const {DB:db}=env();db.raw.prepare("INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,status,created_at) VALUES('fresh','w1','fresh-key','secret.test','secret@tenant.test','private subject','sending',?)").run(now.toISOString());
 let result=await operationalDiagnostics(db,'w1',{now});assert.equal(result.delivery.gmail.rows[0].inFlight,true);assert.equal(result.delivery.gmail.rows[0].uncertain,false);assert.equal(result.findings.some(row=>row.code==='delivery_requires_reconciliation'),false);
 result=await operationalDiagnostics(db,'w1',{now:new Date(now.getTime()+301000)});assert.equal(result.delivery.gmail.rows[0].uncertain,true);assert.ok(result.findings.some(row=>row.code==='delivery_requires_reconciliation'));
 receipt(db,{workspaceId:'w1',type:'gmail.delivery_unconfirmed'});result=await operationalDiagnostics(db,'w1',{now});assert.ok(result.findings.some(row=>row.code==='delivery_requires_reconciliation'));
});

test('duration above the bounded observation range remains unknown instead of claiming exactly 24 hours',async()=>{
 const value=env();await recordOperationalStage(value,{workspaceId:'w1',stage:7,outcome:'failed',durationMs:86400001});const row=value.DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='operations.stage'").get();assert.equal(JSON.parse(row.metadata_json).durationMs,null);
});

test('stage receipts correlate safe operation/run/revision IDs and reject content-bearing metadata',async()=>{
 const value=env(),operationId=crypto.randomUUID(),runId=crypto.randomUUID(),contextId=crypto.randomUUID();
 value.DB.raw.prepare("INSERT INTO approved_workflow_runs(id,workspace_id,revision,status) VALUES(?,'w1',3,'completed')").run(runId);
 for(const outcome of ['started','completed'])await recordOperationalStage(value,{workspaceId:'w1',stage:5,outcome,operationId,runId,contextId,revision:3,action:'buyers',durationMs:outcome==='completed'?24:null});
 await recordOperationalStage(value,{workspaceId:'w1',stage:5,outcome:'failed',operationId:'secret@tenant.test',runId:'secret@tenant.test',contextId:'Private person',revision:'private',action:'private body'});
 const result=await operationalDiagnostics(value.DB,'w1');const correlated=result.stageReceipts.rows.filter(row=>row.operationId===operationId);assert.equal(correlated.length,2);assert.ok(correlated.every(row=>row.runId===runId&&row.contextId===contextId&&row.revision===3&&row.action==='buyers'));assert.equal(result.workflow.rows[0].runId,runId);
 const invalid=result.stageReceipts.rows.find(row=>row.status==='failed');assert.match(invalid.operationId,/^[0-9a-f-]{36}$/);assert.equal(invalid.runId,null);assert.equal(invalid.contextId,null);assert.equal(invalid.revision,null);assert.equal(invalid.action,null);assert.doesNotMatch(JSON.stringify(result),/secret@|Private person|private body/);
});

test('reservation projection follows actual Treg-specific retained retryable budget rule',async()=>{
 const {DB:db}=env();const add=db.raw.prepare("INSERT INTO additional_contact_attempts(workspace_id,company_id,person_id,month,provider,status,result_json,created_at) VALUES('w1','company',?,'2026-10',?,'retryable',?,?)");
 add.run('treg-started','treg','{"provider_started":true}',now.toISOString());add.run('treg-not-started','treg','{"provider_started":false}',now.toISOString());add.run('apollo-started','apollo','{"provider_started":true}',now.toISOString());
 const result=await operationalDiagnostics(db,'w1',{now});const rows=result.contactAttempts.rows;assert.equal(rows.find(row=>row.provider==='treg'&&row.providerStarted===true).reservationRetained,true);assert.equal(rows.find(row=>row.provider==='treg'&&row.providerStarted===false).reservationRetained,false);assert.equal(rows.find(row=>row.provider==='apollo').reservationRetained,false);
 assert.equal(rows.find(row=>row.provider==='apollo').requiresReconciliation,true);
});

test('bounded samples disclose truncation and unsafe/corrupt monetary receipts never become zero charge claims',async()=>{
 const {DB:db}=env();const add=db.raw.prepare('INSERT INTO treg_contact_calls(workspace_id,request_key,phase,call_id,cost_micro,created_at) VALUES(?,?,?,?,?,?)');
 add.run('w1','private-a','email','call-a',100,now.toISOString());add.run('w1','private-b','email','call-a',100,now.toISOString());add.run('w1','private-c','email','call-b',0,now.toISOString());add.run('w1','private-d','email','call-c',50,now.toISOString());add.run('w1','private-e','email','call-c',60,now.toISOString());
 let result=await operationalDiagnostics(db,'w1',{now});assert.equal(result.charges.confirmedRecordedAmountMicro,100);assert.equal(result.charges.confirmedReceipts,1);assert.equal(result.charges.unknownReceipts,2);assert.equal(result.charges.duplicateRowsIgnored,2);assert.doesNotMatch(JSON.stringify(result),/call-a|call-b|private-a/);
 for(let i=0;i<210;i++)add.run('w1','private-'+i,'email','call-'+i,1,now.toISOString());
 result=await operationalDiagnostics(db,'w1',{now});assert.equal(result.charges.moreAvailable,true);assert.equal(result.charges.confirmedRecordedAmountMicro,null);assert.equal(result.charges.status,'sample_incomplete');
 db.raw.exec('DROP TABLE treg_contact_calls');result=await operationalDiagnostics(db,'w1',{now});assert.equal(result.charges.status,'unavailable');assert.equal(result.charges.confirmedRecordedAmountMicro,null);assert.equal(result.charges.unknownReceipts,null);
});

test('safe stage hook persists enum/numeric data and bounded pruning touches only owned namespaces',async()=>{
 const value=env();
 for(let i=0;i<600;i++)receipt(value.DB,{task:'saved_flows',at:'2026-10-30T00:00:'+String(i%60).padStart(2,'0')+'.000Z'});
 receipt(value.DB,{task:'saved_flows',type:'customer.original_evidence',at:'2020-01-01T00:00:00Z'});receipt(value.DB,{task:'outreach_delivery',at:'2026-10-30T00:00:00Z'});
 await observeScheduledTask(value,'saved_flows',async()=>({completed:0}));
 assert.equal(value.DB.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='operations.scheduler' AND entity_type='saved_flows'").get().n,512);
 assert.equal(value.DB.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='customer.original_evidence'").get().n,1);
 assert.equal(value.DB.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE entity_type='outreach_delivery'").get().n,1);
 await recordOperationalStage(value,{workspaceId:'w1',stage:6,outcome:'stale',durationMs:120,counts:{ready:2,reviewed:3,failed:-1,secret:'secret@tenant.test'}});
 const stage=JSON.parse(value.DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='operations.stage'").get().metadata_json);assert.deepEqual(stage.counts,{ready:2,reviewed:3});assert.equal(stage.durationMs,120);assert.doesNotMatch(JSON.stringify(stage),/secret/);
 await assert.rejects(recordOperationalStage(value,{workspaceId:'w1',stage:9,outcome:'secret'}));
});

test('actual scheduled entry emits receipts for invoked minute jobs with no configured-heartbeat fabrication',async()=>{
 const value=env(),pending=[];const warn=console.warn;console.warn=()=>{};
 try{await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},value,{waitUntil:promise=>pending.push(promise)});await Promise.allSettled(pending);}finally{console.warn=warn;}
 const tasks=value.DB.raw.prepare("SELECT DISTINCT entity_type FROM audit_events WHERE event_type='operations.scheduler'").all().map(row=>row.entity_type).sort();assert.deepEqual(tasks,['company_materials','language_packs','workspace_skills','writing_references']);
 assert.equal(value.DB.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='operations.scheduler' AND entity_type='saved_flows'").get().n,0);
});

test('actual hourly entry waits for replies before delivery while monitoring runs independently',async()=>{
 const value=env(),pending=[],calls=[];let releasePoll,enteredPoll;
 const polling=new Promise(resolve=>{enteredPoll=resolve;}),gate=new Promise(resolve=>{releasePoll=resolve;});
 const jobs=Object.fromEntries(['runSavedFlows','runApprovedWorkflows','pollConversations','enrollConversationWorkflows','runConversationPlans','runDueMarketMonitoring','runDueSourceHealthChecks'].map(name=>[name,async()=>{calls.push(name);return {};}]))
 jobs.pollOutreachReplies=async()=>{calls.push('pollReplies');enteredPoll();await gate;calls.push('pollComplete');};
 jobs.runOutreachAutomation=async()=>{calls.push('delivery');return {sent:0};};
 await app.scheduled({cron:'0 * * * *',scheduledTime:Date.now()},value,{waitUntil:promise=>pending.push(promise)},jobs);
 await polling;assert.ok(calls.includes('runDueMarketMonitoring'));assert.ok(calls.includes('runDueSourceHealthChecks'));assert.equal(calls.includes('delivery'),false);
 releasePoll();await Promise.all(pending);assert.ok(calls.indexOf('delivery')>calls.indexOf('pollComplete'));
 assert.equal(value.DB.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE entity_type='outreach_delivery'").get().n,2);
});

test('actual hourly entry records failed reply polling and holds delivery without blocking independent monitoring',async()=>{
 const value=env(),pending=[],calls=[];const jobs=Object.fromEntries(['runSavedFlows','runApprovedWorkflows','pollConversations','enrollConversationWorkflows','runConversationPlans','runDueMarketMonitoring','runDueSourceHealthChecks'].map(name=>[name,async()=>{calls.push(name);return {};}]))
 jobs.pollOutreachReplies=async()=>{throw Error('private poll failure');};jobs.runOutreachAutomation=async()=>{calls.push('delivery');};
 await app.scheduled({cron:'0 * * * *',scheduledTime:Date.now()},value,{waitUntil:promise=>pending.push(promise)},jobs);await Promise.all(pending);
 assert.equal(calls.includes('delivery'),false);assert.ok(calls.includes('runDueMarketMonitoring'));
 const receipts=value.DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE entity_type='outreach_replies'").all().map(row=>JSON.parse(row.metadata_json));assert.ok(receipts.some(row=>row.outcome==='failed'));assert.doesNotMatch(JSON.stringify(receipts),/private poll failure/);
});

test('operational revision comparison stays unknown without both valid source revisions and flags actual mismatch',async()=>{
 const {env:value,token}=await fixture(),headers={Cookie:'leadintel_session='+token},a='a'.repeat(40),b='b'.repeat(40);value.BACKEND_RELEASE_SHA=a;
 for(const [supplied,expected] of [[a,'match'],[b,'mismatch'],['private-person@example.test','unknown'],['','unknown']]){const response=await handleOperationalDiagnosticsRoute(new Request('https://test/api/operations/diagnostics?workspace_id=w1&frontend_revision='+encodeURIComponent(supplied),{headers}),value);assert.equal(response.status,200);const d=await response.json();assert.equal(d.release.comparison,expected);assert.equal(d.release.backendSha,a);assert.equal(d.findings.some(x=>x.code==='frontend_backend_revision_mismatch'),expected==='mismatch');assert.doesNotMatch(JSON.stringify(d),/private-person/);}
 delete value.BACKEND_RELEASE_SHA;const response=await handleOperationalDiagnosticsRoute(new Request('https://test/api/operations/diagnostics?workspace_id=w1&frontend_revision='+a,{headers}),value);assert.equal((await response.json()).release.comparison,'unknown');
});
