import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runOutreachAutomation} from '../src/outreach-automation-runner.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const r=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes||0)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE workspaces(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE gmail_connections(workspace_id TEXT PRIMARY KEY,user_id TEXT,google_email TEXT,encrypted_refresh_token TEXT,scopes TEXT,status TEXT,history_id TEXT,connected_at TEXT,updated_at TEXT,disconnected_at TEXT);
CREATE TABLE gmail_messages(id TEXT PRIMARY KEY,workspace_id TEXT,idempotency_key TEXT,domain TEXT,recipient TEXT,subject TEXT,gmail_message_id TEXT,gmail_thread_id TEXT,sent_by TEXT,sent_at TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(workspace_id,idempotency_key));
CREATE TABLE crm_companies(id TEXT PRIMARY KEY,workspace_id TEXT,normalized_domain TEXT,company_name TEXT,lifecycle_status TEXT,deleted_at TEXT,pipeline_stage TEXT,updated_at TEXT);
CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
INSERT INTO workspaces VALUES('w1');INSERT INTO users VALUES('u1');INSERT INTO gmail_connections(workspace_id,user_id,google_email,encrypted_refresh_token,status) VALUES('w1','u1','sender@example.com','x','connected');`);this.raw.exec(fs.readFileSync(new URL('../migrations/0015_outreach_automation.sql',import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){this.raw.exec('BEGIN');try{const out=[];for(const row of rows)out.push(await row.run());this.raw.exec('COMMIT');return out;}catch(e){this.raw.exec('ROLLBACK');throw e;}}}
function seedPolicy(db,overrides={}){const p={mode:'automatic',enabled:1,paused:0,emergency_stop:0,workspace_daily_limit:20,mailbox_daily_limit:20,working_days_json:'[1,2,3,4,5]',timezone:'Europe/Riga',send_window_start:'09:00',send_window_end:'16:30',min_delay_minutes:8,max_delay_minutes:18,max_followups:2,followup_delays_days_json:'[3,7]',reply_poll_interval_minutes:60,...overrides};db.raw.prepare(`INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,paused,emergency_stop,workspace_daily_limit,mailbox_daily_limit,working_days_json,timezone,send_window_start,send_window_end,min_delay_minutes,max_delay_minutes,max_followups,followup_delays_days_json,reply_poll_interval_minutes,updated_by) VALUES('w1',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'u1')`).run(p.mode,p.enabled,p.paused,p.emergency_stop,p.workspace_daily_limit,p.mailbox_daily_limit,p.working_days_json,p.timezone,p.send_window_start,p.send_window_end,p.min_delay_minutes,p.max_delay_minutes,p.max_followups,p.followup_delays_days_json,p.reply_poll_interval_minutes);}
function seedSequence(db,{id='s1',domain='example.com',recipient='buyer@example.com',queueId='q1',scheduled='2026-09-08T08:00:00.000Z',status='queued',followup='Follow up',source='pkg1'}={}){db.raw.prepare(`INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,deleted_at,pipeline_stage,updated_at) VALUES(?,?,?,?,?,NULL,'Ready for Outreach',CURRENT_TIMESTAMP)`).run(`c-${id}`,'w1',domain,domain,'prospect');db.raw.prepare(`INSERT INTO outreach_automation_sequences(id,workspace_id,gmail_connection_workspace_id,source_package_key,domain,recipient,approved_at,initial_subject,initial_body,followup_body,status,created_by) VALUES(?,?,?,?,?,?,?,'Subject','Body',?,'active','u1')`).run(id,'w1','w1',source,domain,recipient,'2026-09-08T07:00:00.000Z',followup);db.raw.prepare(`INSERT INTO outreach_automation_queue(id,workspace_id,sequence_id,gmail_connection_workspace_id,step_index,recipient,subject,body,status,earliest_send_at,scheduled_send_at,idempotency_key) VALUES(?,?,?,?,0,?,?,?, ?,?,?,?)`).run(queueId,'w1',id,'w1',recipient,'Subject','Body',status,scheduled,scheduled,`auto-${queueId}-stable-key`);}
function fixture(overrides={}){const db=new DB();seedPolicy(db,overrides.policy||{});seedSequence(db,overrides.sequence||{});return {DB:db};}
const now=new Date('2026-09-08T08:30:00.000Z');
const noCrm=async()=>{};

sqliteTest('runner sends only due eligible rows, records confirmed send, and creates bounded business-day followups',async()=>{
  const env=fixture();const sent=[];const result=await runOutreachAutomation(env,{now,random:()=>0,sendMessage:async({queue})=>{sent.push(queue.id);return {id:`gm-${queue.id}`,threadId:`th-${queue.id}`};},onSent:noCrm});
  assert.equal(result.sent,1);assert.deepEqual(sent,['q1']);const row=env.DB.raw.prepare(`SELECT status,gmail_message_id,gmail_thread_id,sent_at FROM outreach_automation_queue WHERE id='q1'`).get();assert.equal(row.status,'sent');assert.equal(row.gmail_message_id,'gm-q1');
  const followups=env.DB.raw.prepare(`SELECT step_index,status,scheduled_send_at,body FROM outreach_automation_queue WHERE sequence_id='s1' AND step_index>0 ORDER BY step_index`).all();assert.equal(followups.length,2);assert.deepEqual(followups.map(x=>x.step_index),[1,2]);assert.ok(followups.every(x=>x.status==='queued'&&x.body==='Follow up'));
  const localDates=followups.map(x=>x.scheduled_send_at.slice(0,10));assert.deepEqual(localDates,['2026-09-11','2026-09-17']);
});

sqliteTest('runner preserves randomized spacing for other rows already selected in the same due batch',async()=>{
  const env=fixture();seedSequence(env.DB,{id:'s2',domain:'second.com',recipient:'two@second.com',queueId:'q2',source:'pkg2'});const sent=[];const result=await runOutreachAutomation(env,{now,random:()=>0.999999,sendMessage:async({queue})=>{sent.push(queue.id);return {id:`gm-${queue.id}`,threadId:`th-${queue.id}`};},onSent:noCrm});
  assert.equal(result.sent,1);assert.deepEqual(sent,['q1']);const second=env.DB.raw.prepare(`SELECT status,scheduled_send_at FROM outreach_automation_queue WHERE id='q2'`).get();assert.equal(second.status,'queued');assert.ok(second.scheduled_send_at>='2026-09-08T08:48:00.000Z');
});

sqliteTest('runner enforces workspace/mailbox limits before Gmail',async()=>{
  for(const field of ['workspace_daily_limit','mailbox_daily_limit']){const env=fixture({policy:{[field]:1}});env.DB.raw.prepare(`INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,sent_at,status) VALUES('old','w1','old-key','old.com','x@old.com','Old','2026-09-08T07:00:00.000Z','sent')`).run();let calls=0;const result=await runOutreachAutomation(env,{now,sendMessage:async()=>{calls++;return {id:'x',threadId:'x'};},onSent:noCrm});assert.equal(calls,0);assert.equal(result.sent,0);assert.equal(env.DB.raw.prepare(`SELECT status FROM outreach_automation_queue WHERE id='q1'`).get().status,'blocked_limit');}
});

sqliteTest('pause and emergency stop fail closed without claiming or sending',async()=>{
  for(const flag of ['paused','emergency_stop']){const env=fixture({policy:{[flag]:1}});let calls=0;await runOutreachAutomation(env,{now,sendMessage:async()=>{calls++;return {id:'x',threadId:'x'};},onSent:noCrm});assert.equal(calls,0);assert.notEqual(env.DB.raw.prepare(`SELECT status FROM outreach_automation_queue WHERE id='q1'`).get().status,'sent');}
});

sqliteTest('outside-window rows are rescheduled and suppressed companies are skipped',async()=>{
  let env=fixture({sequence:{scheduled:'2026-09-08T03:00:00.000Z'}});let calls=0;await runOutreachAutomation(env,{now:new Date('2026-09-08T04:00:00Z'),sendMessage:async()=>{calls++;return {id:'x',threadId:'x'};},onSent:noCrm});assert.equal(calls,0);let row=env.DB.raw.prepare(`SELECT status,scheduled_send_at FROM outreach_automation_queue WHERE id='q1'`).get();assert.equal(row.status,'waiting_window');assert.ok(row.scheduled_send_at>'2026-09-08T04:00:00Z');
  env=fixture();env.DB.raw.prepare(`UPDATE crm_companies SET lifecycle_status='suppressed' WHERE normalized_domain='example.com'`).run();await runOutreachAutomation(env,{now,sendMessage:async()=>{calls++;return {id:'x',threadId:'x'};},onSent:noCrm});row=env.DB.raw.prepare(`SELECT status FROM outreach_automation_queue WHERE id='q1'`).get();assert.equal(row.status,'skipped');
});

sqliteTest('one failed send does not stop another and transient failure retries with backoff',async()=>{
  const env=fixture();seedSequence(env.DB,{id:'s2',domain:'second.com',recipient:'two@second.com',queueId:'q2',source:'pkg2'});let calls=[];const transient=Object.assign(new Error('temporary'),{retryable:true});
  let first=true;let result=await runOutreachAutomation(env,{now,sendMessage:async({queue})=>{calls.push(queue.id);if(queue.id==='q1'&&first){first=false;throw transient;}return {id:`gm-${queue.id}`,threadId:`th-${queue.id}`};},onSent:noCrm});assert.equal(result.sent,1);assert.deepEqual(calls,['q1','q2']);let failed=env.DB.raw.prepare(`SELECT status,last_error_code,attempt_count,scheduled_send_at FROM outreach_automation_queue WHERE id='q1'`).get();assert.equal(failed.status,'failed');assert.equal(failed.last_error_code,'transient');assert.equal(failed.attempt_count,1);assert.ok(failed.scheduled_send_at>now.toISOString());
  result=await runOutreachAutomation(env,{now:new Date('2026-09-08T09:00:00.000Z'),sendMessage:async({queue})=>({id:`gm-${queue.id}`,threadId:`th-${queue.id}`}),onSent:noCrm});assert.equal(result.sent,1);assert.equal(env.DB.raw.prepare(`SELECT status FROM outreach_automation_queue WHERE id='q1'`).get().status,'sent');
});

sqliteTest('repeated scheduler execution never double-sends a sent queue item',async()=>{
  const env=fixture();let calls=0;const sendMessage=async({queue})=>{calls++;return {id:`gm-${queue.id}`,threadId:`th-${queue.id}`};};await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});await runOutreachAutomation(env,{now:new Date('2026-09-08T08:45:00.000Z'),sendMessage,onSent:noCrm});assert.equal(calls,1);assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM gmail_messages WHERE idempotency_key='auto-q1-stable-key'`).get().count,1);
});
