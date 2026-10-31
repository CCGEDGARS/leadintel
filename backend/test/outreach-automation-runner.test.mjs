import {seedAutomationSource} from './outreach-automation-source-fixture.mjs';
import {createHash} from 'node:crypto';
import {queuedRecipientIdentity} from '../src/queued-recipient-authority.js';
function bindSeededRecipients(db){for(const seq of db.raw.prepare('SELECT * FROM outreach_automation_sequences').all()){const company=db.raw.prepare('SELECT * FROM crm_companies WHERE normalized_domain=?').get(seq.domain),contact=db.raw.prepare('SELECT * FROM crm_contacts WHERE normalized_email=?').get(seq.recipient);db.raw.prepare('UPDATE outreach_automation_sequences SET contact_identity=? WHERE id=?').run('recipient-v2:'+createHash('sha256').update(queuedRecipientIdentity(contact,company)).digest('hex'),seq.id);}seedAutomationSource(db);}
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runOutreachAutomation as runWithVerification} from '../src/outreach-automation-runner.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const r=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes||0)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE workspaces(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT);INSERT INTO workspace_members VALUES('w1','u1','owner');CREATE TABLE gmail_connections(workspace_id TEXT PRIMARY KEY,user_id TEXT,google_email TEXT,encrypted_refresh_token TEXT,scopes TEXT,status TEXT,history_id TEXT,connected_at TEXT,updated_at TEXT,disconnected_at TEXT);
CREATE TABLE microsoft_mail_messages(id TEXT,workspace_id TEXT,idempotency_key TEXT,recipient TEXT,status TEXT,sent_at TEXT,created_at TEXT);CREATE TABLE gmail_messages(id TEXT PRIMARY KEY,workspace_id TEXT,idempotency_key TEXT,domain TEXT,recipient TEXT,subject TEXT,gmail_message_id TEXT,gmail_thread_id TEXT,sent_by TEXT,sent_at TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(workspace_id,idempotency_key));
CREATE TABLE crm_companies(id TEXT PRIMARY KEY,workspace_id TEXT,normalized_domain TEXT,company_name TEXT,lifecycle_status TEXT,deleted_at TEXT,pipeline_stage TEXT,updated_at TEXT);
CREATE TABLE crm_contacts(id TEXT PRIMARY KEY,workspace_id TEXT,company_id TEXT,normalized_email TEXT,email_status TEXT,name TEXT DEFAULT 'Buyer Person',source TEXT DEFAULT 'apollo',archived_at TEXT);
CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
INSERT INTO workspaces VALUES('w1');INSERT INTO users VALUES('u1');INSERT INTO gmail_connections(workspace_id,user_id,google_email,encrypted_refresh_token,status) VALUES('w1','u1','sender@example.com','x','connected');`);this.raw.exec(fs.readFileSync(new URL('../migrations/0015_outreach_automation.sql',import.meta.url),'utf8'));this.raw.exec(fs.readFileSync(new URL('../migrations/0024_automation_brand_html.sql',import.meta.url),'utf8'));this.raw.exec(fs.readFileSync(new URL('../migrations/0025_contact_suppression.sql',import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){this.raw.exec('BEGIN');try{const out=[];for(const row of rows)out.push(await row.run());this.raw.exec('COMMIT');return out;}catch(e){this.raw.exec('ROLLBACK');throw e;}}}
function seedPolicy(db,overrides={}){const p={mode:'automatic',enabled:1,paused:0,emergency_stop:0,workspace_daily_limit:20,mailbox_daily_limit:20,working_days_json:'[1,2,3,4,5]',timezone:'Europe/Riga',send_window_start:'09:00',send_window_end:'16:30',min_delay_minutes:8,max_delay_minutes:18,max_followups:2,followup_delays_days_json:'[3,7]',reply_poll_interval_minutes:60,...overrides};db.raw.prepare(`INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,paused,emergency_stop,workspace_daily_limit,mailbox_daily_limit,working_days_json,timezone,send_window_start,send_window_end,min_delay_minutes,max_delay_minutes,max_followups,followup_delays_days_json,reply_poll_interval_minutes,updated_by) VALUES('w1',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'u1')`).run(p.mode,p.enabled,p.paused,p.emergency_stop,p.workspace_daily_limit,p.mailbox_daily_limit,p.working_days_json,p.timezone,p.send_window_start,p.send_window_end,p.min_delay_minutes,p.max_delay_minutes,p.max_followups,p.followup_delays_days_json,p.reply_poll_interval_minutes);}
function seedSequence(db,{id='s1',domain='example.com',recipient='buyer@example.com',queueId='q1',scheduled='2026-09-08T08:00:00.000Z',status='queued',followup='Follow up',source='pkg1'}={}){db.raw.prepare(`INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,deleted_at,pipeline_stage,updated_at) VALUES(?,?,?,?,?,NULL,'Ready for Outreach',CURRENT_TIMESTAMP)`).run(`c-${id}`,'w1',domain,domain,'prospect');db.raw.prepare(`INSERT INTO crm_contacts(id,workspace_id,company_id,normalized_email,email_status) VALUES(?,?,?,?, 'verified')`).run(`p-${id}`,'w1',`c-${id}`,recipient);db.raw.prepare(`INSERT INTO outreach_automation_sequences(id,workspace_id,gmail_connection_workspace_id,source_package_key,domain,recipient,approved_at,initial_subject,initial_body,followup_body,status,created_by) VALUES(?,?,?,?,?,?,?,'Subject','Body',?,'active','u1')`).run(id,'w1','w1',source,domain,recipient,'2026-09-08T07:00:00.000Z',followup);db.raw.prepare(`INSERT INTO outreach_automation_queue(id,workspace_id,sequence_id,gmail_connection_workspace_id,step_index,recipient,subject,body,status,earliest_send_at,scheduled_send_at,idempotency_key) VALUES(?,?,?,?,0,?,?,?, ?,?,?,?)`).run(queueId,'w1',id,'w1',recipient,'Subject','Body',status,scheduled,scheduled,`auto-${queueId}-stable-key`);bindSeededRecipients(db);}
function fixture(overrides={}){const db=new DB();seedPolicy(db,overrides.policy||{});seedSequence(db,overrides.sequence||{});return {DB:db,AUTOMATIC_GMAIL_DELIVERY_MODE:'enabled'};}
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
  const env=fixture();seedSequence(env.DB,{id:'s2',domain:'second.com',recipient:'two@second.com',queueId:'q2',source:'pkg2'});let calls=[];const transient=Object.assign(new Error('temporary'),{retryable:true,deliveryNotAttempted:true});
  let first=true;let result=await runOutreachAutomation(env,{now,sendMessage:async({queue})=>{calls.push(queue.id);if(queue.id==='q1'&&first){first=false;throw transient;}return {id:`gm-${queue.id}`,threadId:`th-${queue.id}`};},onSent:noCrm});assert.equal(result.sent,1);assert.deepEqual(calls,['q1','q2']);let failed=env.DB.raw.prepare(`SELECT status,last_error_code,attempt_count,scheduled_send_at FROM outreach_automation_queue WHERE id='q1'`).get();assert.equal(failed.status,'failed');assert.equal(failed.last_error_code,'pre_delivery_transient');assert.equal(failed.attempt_count,1);assert.ok(failed.scheduled_send_at>now.toISOString());
  result=await runOutreachAutomation(env,{now:new Date('2026-09-08T09:00:00.000Z'),sendMessage:async({queue})=>({id:`gm-${queue.id}`,threadId:`th-${queue.id}`}),onSent:noCrm});assert.equal(result.sent,1);assert.equal(env.DB.raw.prepare(`SELECT status FROM outreach_automation_queue WHERE id='q1'`).get().status,'sent');
});

sqliteTest('repeated scheduler execution never double-sends a sent queue item',async()=>{
  const env=fixture();let calls=0;const sendMessage=async({queue})=>{calls++;return {id:`gm-${queue.id}`,threadId:`th-${queue.id}`};};await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});await runOutreachAutomation(env,{now:new Date('2026-09-08T08:45:00.000Z'),sendMessage,onSent:noCrm});assert.equal(calls,1);assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM gmail_messages WHERE idempotency_key='auto-q1-stable-key'`).get().count,1);
});

sqliteTest('revoking email verification before the scheduled send stops automatic delivery',async()=>{
  const env=fixture();env.DB.raw.prepare(`UPDATE crm_contacts SET email_status='public_unverified' WHERE id='p-s1'`).run();let sends=0;
  const result=await runOutreachAutomation(env,{now,sendMessage:async()=>{sends++;return {id:'unexpected',threadId:'unexpected'};},onSent:noCrm});
  assert.equal(sends,0);assert.equal(result.skipped,1);
  const row=env.DB.raw.prepare(`SELECT status,last_error_code FROM outreach_automation_queue WHERE id='q1'`).get();assert.equal(row.status,'skipped');assert.equal(row.last_error_code,'crm_email_not_verified');
});

sqliteTest('contact suppression added after queueing prevents scheduled send',async()=>{
  const env=fixture();env.DB.raw.prepare(`INSERT INTO outreach_contact_suppression(workspace_id,email,reason,source) VALUES('w1','buyer@example.com','manual','owner')`).run();let sends=0;
  const result=await runOutreachAutomation(env,{now,sendMessage:async()=>{sends++;return {id:'unexpected',threadId:'unexpected'};},onSent:noCrm});
  assert.equal(sends,0);assert.equal(result.skipped,1);
  assert.deepEqual({...env.DB.raw.prepare(`SELECT status,last_error_code FROM outreach_automation_queue WHERE id='q1'`).get()},{status:'skipped',last_error_code:'contact_suppressed'});
});

function runOutreachAutomation(env,options={}){return runWithVerification(env,{verifyEmail:async()=>({verified:true,provider:'test'}),...options});}

sqliteTest('fresh verification failure holds recipient without Gmail and can be retried',async()=>{
 const env=fixture();let sends=0;const sendMessage=async()=>{sends++;return {id:'gm',threadId:'th'};};
 const result=await runOutreachAutomation(env,{now,verifyEmail:async()=>({verified:false,reason:'Needs review'}),sendMessage,onSent:noCrm});assert.equal(result.sent,0);assert.equal(sends,0);assert.equal(env.DB.raw.prepare("SELECT last_error_code FROM outreach_automation_queue WHERE id='q1'").get().last_error_code,'email_verification_required');
 await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});assert.equal(sends,0);
 env.DB.raw.prepare("UPDATE outreach_automation_queue SET status='queued',last_error_code=NULL WHERE id='q1'").run();await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});assert.equal(sends,1);
});
sqliteTest('pause during verification prevents Gmail send',async()=>{const env=fixture();let sends=0;await runOutreachAutomation(env,{now,verifyEmail:async()=>{env.DB.raw.prepare("UPDATE outreach_automation_policies SET paused=1 WHERE workspace_id='w1'").run();return {verified:true};},sendMessage:async()=>{sends++;},onSent:noCrm});assert.equal(sends,0);});
sqliteTest('automatic Gmail respects Microsoft campaign sends in the shared mailbox limit',async()=>{const env=fixture({policy:{workspace_daily_limit:1,mailbox_daily_limit:1}});env.DB.raw.exec("CREATE TABLE IF NOT EXISTS microsoft_mail_messages(id TEXT,workspace_id TEXT,status TEXT,sent_at TEXT,created_at TEXT)");env.DB.raw.exec("INSERT INTO microsoft_mail_messages(id,workspace_id,status,sent_at,created_at) VALUES('ms1','w1','sent','2026-09-08T07:00:00.000Z','2026-09-08T07:00:00.000Z')");let sent=0;const r=await runOutreachAutomation(env,{now,sendMessage:async()=>{sent++;return {id:'gm',threadId:'th'}},onSent:noCrm});assert.equal(sent,0);assert.equal(r.blocked,1);});

sqliteTest('ambiguous transport failure after submission never schedules an automatic resend',async()=>{
  for(const message of ['network fetch failed','timeout after submission']){
    const env=fixture();let submissions=0;const sendMessage=async()=>{submissions++;throw new Error(message);};
    await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});
    assert.equal(env.DB.raw.prepare("SELECT last_error_code FROM outreach_automation_queue WHERE id='q1'").get().last_error_code,'ambiguous_send_state');
    assert.equal(env.DB.raw.prepare('SELECT status FROM gmail_messages').get().status,'sending');
    await runOutreachAutomation(env,{now:new Date('2026-09-08T09:00:00Z'),sendMessage,onSent:noCrm});assert.equal(submissions,1);
  }
});

sqliteTest('legacy transient failures remain held because prior submission cannot be disproved',async()=>{
  const env=fixture();env.DB.raw.exec("UPDATE outreach_automation_queue SET status='failed',last_error_code='transient',attempt_count=1 WHERE id='q1'");
  env.DB.raw.exec("INSERT INTO gmail_messages(id,workspace_id,idempotency_key,status) VALUES('old-attempt','w1','auto-q1-stable-key','failed')");
  let sends=0;await runOutreachAutomation(env,{now,sendMessage:async()=>{sends++;return {id:'duplicate',threadId:'duplicate'};},onSent:noCrm});
  assert.equal(sends,0);assert.equal(env.DB.raw.prepare("SELECT status FROM outreach_automation_queue WHERE id='q1'").get().status,'failed');
});
sqliteTest('legacy unbound queue recipient and changed same-ID identity stay held',async()=>{for(const mutation of ["UPDATE outreach_automation_sequences SET contact_identity='old-contact-id'","UPDATE crm_companies SET company_name='Different Company'"]){const env=fixture();env.DB.raw.exec(mutation);let sent=0;await runOutreachAutomation(env,{now,sendMessage:async()=>{sent++;return {id:'unexpected',threadId:'unexpected'};},onSent:noCrm});assert.equal(sent,0);assert.equal(env.DB.raw.prepare("SELECT last_error_code FROM outreach_automation_queue WHERE id='q1'").get().last_error_code,'authorization_changed');}});

sqliteTest('concurrent workers serialize different automatic messages within one workspace',async()=>{
  const env=fixture();seedSequence(env.DB,{id:'s2',domain:'second.com',recipient:'two@second.com',queueId:'q2',source:'pkg2'});
  let entered,release;const pending=new Promise(resolve=>{release=resolve;});const started=new Promise(resolve=>{entered=resolve;});let calls=0;
  const sendMessage=async({queue})=>{calls++;if(queue.id==='q1'){entered();await pending;}return {id:`gm-${queue.id}`,threadId:`th-${queue.id}`};};
  const first=runOutreachAutomation(env,{now,sendMessage,onSent:noCrm,limit:1});await started;
  try{const second=await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});assert.equal(second.sent,0);assert.equal(calls,1);}finally{release();await first;}
});

sqliteTest('current daily capacity and changed send window are rechecked after verification',async()=>{
  for(const mutation of ["UPDATE outreach_automation_policies SET send_window_start='15:00'", "INSERT INTO gmail_messages(id,workspace_id,idempotency_key,status,sent_at) VALUES('other','w1','other','sent','2026-09-08T08:20:00.000Z')"]){
    const env=fixture({policy:{workspace_daily_limit:1,mailbox_daily_limit:1}});let calls=0;
    await runOutreachAutomation(env,{now,verifyEmail:async()=>{env.DB.raw.exec(mutation);return {verified:true};},sendMessage:async()=>{calls++;return {id:'unexpected',threadId:'unexpected'};},onSent:noCrm});
    assert.equal(calls,0,mutation);assert.notEqual(env.DB.raw.prepare("SELECT status FROM outreach_automation_queue WHERE id='q1'").get().status,'sent');
  }
});

sqliteTest('malformed provider success remains uncertain and cannot create followups or retry',async()=>{
  const env=fixture();let calls=0;const sendMessage=async()=>{calls++;return {id:'',threadId:null};};
  const first=await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});assert.equal(first.sent,0);assert.equal(first.failed,1);
  assert.equal(env.DB.raw.prepare("SELECT status FROM gmail_messages WHERE idempotency_key='auto-q1-stable-key'").get().status,'sending');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_queue WHERE step_index>0').get().n,0);
  await runOutreachAutomation(env,{now:new Date('2026-09-08T09:30:00Z'),sendMessage,onSent:noCrm});assert.equal(calls,1);
});

sqliteTest('durable acceptance recovers after confirmation database failure without submitting again',async()=>{
  const env=fixture();const batch=env.DB.batch.bind(env.DB);let fail=true,calls=0;
  env.DB.batch=async rows=>{if(fail&&rows.some(row=>row.sql.includes('UPDATE gmail_messages SET gmail_message_id='))){fail=false;throw Error('Injected confirmation persistence failure');}return batch(rows);};
  const sendMessage=async()=>{calls++;return {id:'accepted-id',threadId:'accepted-thread'};};
  const first=await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});assert.equal(first.failed,1);assert.equal(calls,1);
  await runOutreachAutomation(env,{now:new Date('2026-09-08T09:30:00Z'),sendMessage,onSent:noCrm});assert.equal(calls,1);
  assert.equal(env.DB.raw.prepare("SELECT status,gmail_message_id FROM gmail_messages WHERE idempotency_key='auto-q1-stable-key'").get().status,'sent');
  assert.equal(env.DB.raw.prepare("SELECT status FROM outreach_automation_queue WHERE id='q1'").get().status,'sent');
});

sqliteTest('a sent row with the same key but no matching original content receipt is held for review',async()=>{
  const env=fixture();env.DB.raw.exec("INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,gmail_message_id,gmail_thread_id,status,sent_at) VALUES('foreign','w1','auto-q1-stable-key','example.com','buyer@example.com','Different subject','foreign-id','foreign-thread','sent','2026-09-08T07:00:00Z')");let calls=0;
  const result=await runOutreachAutomation(env,{now,sendMessage:async()=>{calls++;return {id:'unexpected',threadId:'unexpected'};},onSent:noCrm});assert.equal(calls,0);assert.equal(result.sent,0);assert.notEqual(env.DB.raw.prepare("SELECT status FROM outreach_automation_queue WHERE id='q1'").get().status,'sent');
});

sqliteTest('failed followup persistence repairs schedules after restart without resending initial email',async()=>{
  const env=fixture();const batch=env.DB.batch.bind(env.DB);let fail=true,calls=0;env.DB.batch=async rows=>{if(fail&&rows.some(row=>row.sql.includes('INSERT OR IGNORE INTO outreach_automation_queue'))){fail=false;throw Error('Injected followup save failure');}return batch(rows);};
  const sendMessage=async()=>{calls++;return {id:'gm-initial',threadId:'thread-initial'};};await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});assert.equal(calls,1);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_queue WHERE step_index>0').get().n,0);
  await runOutreachAutomation(env,{now:new Date('2026-09-08T09:00:00Z'),sendMessage,onSent:noCrm});assert.equal(calls,1);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_queue WHERE step_index>0').get().n,2);
});

sqliteTest('a daylight-saving gap schedules followup in the first real enabled minute on the intended local day',async()=>{
  const env=fixture({policy:{working_days_json:'[1,2,3,4,5,6,7]',send_window_start:'03:30',send_window_end:'04:30',max_followups:1,followup_delays_days_json:'[1]'},sequence:{scheduled:'2026-03-28T01:30:00.000Z'}});
  await runOutreachAutomation(env,{now:new Date('2026-03-28T01:30:00Z'),sendMessage:async()=>({id:'gm-spring',threadId:'th-spring'}),onSent:noCrm});
  assert.equal(env.DB.raw.prepare('SELECT scheduled_send_at FROM outreach_automation_queue WHERE step_index=1').get().scheduled_send_at,'2026-03-29T01:00:00.000Z');
});

sqliteTest('accepted provider receipt is retained while revoked owner prevents later CRM side effects',async()=>{
  const env=fixture();let crm=0;const result=await runOutreachAutomation(env,{now,sendMessage:async()=>{env.DB.raw.exec("UPDATE workspace_members SET role='viewer' WHERE user_id='u1'");return {id:'accepted-revoked',threadId:'thread-revoked'};},onSent:async()=>{crm++;}});
  assert.equal(result.sent,1);assert.equal(crm,0);assert.equal(env.DB.raw.prepare("SELECT status FROM outreach_automation_queue WHERE id='q1'").get().status,'sent');
});

sqliteTest('a verification delay crossing the closing time cannot submit under the invocation-time window',async()=>{
  const env=fixture();const realNow=Date.now;let elapsed=0;const wall=realNow();Date.now=()=>wall+elapsed;let calls=0;
  try{await runOutreachAutomation(env,{now:new Date('2026-09-08T13:29:30.000Z'),verifyEmail:async()=>{elapsed=60000;return {verified:true};},sendMessage:async()=>{calls++;return {id:'unexpected',threadId:'unexpected'};},onSent:noCrm});assert.equal(calls,0);}finally{Date.now=realNow;}
});

sqliteTest('upstream source edits at each provider boundary hold original queue without resealing its approval',async()=>{
  for(const phase of ['before','verification','dispatch']){
    const env=fixture();let calls=0;const mutate=()=>{const payload=JSON.parse(env.DB.raw.prepare('SELECT payload_json FROM customer_workspace_state').get().payload_json);payload.main.profile.priorityOffers='Changed unreviewed offer';env.DB.raw.prepare('UPDATE customer_workspace_state SET payload_json=?').run(JSON.stringify(payload));};if(phase==='before')mutate();
    await runOutreachAutomation(env,{now,verifyEmail:async()=>{if(phase==='verification')mutate();return {verified:true};},sendMessage:async({dispatchGuard})=>{if(phase==='dispatch')mutate();await dispatchGuard();calls++;return {id:'unexpected',threadId:'unexpected'};},onSent:noCrm});
    assert.equal(calls,0,phase);assert.notEqual(env.DB.raw.prepare("SELECT status FROM outreach_automation_queue WHERE id='q1'").get().status,'sent');assert.equal(env.DB.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='outreach.sequence_source_authority'").get().n,1);
  }
});

sqliteTest('lowering allowed followups prevents already-queued higher steps from dispatching',async()=>{
  const env=fixture();let calls=0;const sendMessage=async()=>{calls++;return {id:`gm-${calls}`,threadId:'th-cadence'};};await runOutreachAutomation(env,{now,sendMessage,onSent:noCrm});assert.equal(calls,1);
  env.DB.raw.exec("UPDATE outreach_automation_policies SET max_followups=0,followup_delays_days_json='[]'");await runOutreachAutomation(env,{now:new Date('2026-09-11T08:30:00Z'),sendMessage,onSent:noCrm});assert.equal(calls,1);
});

sqliteTest('an active conversation lease or older uncertain Microsoft submission excludes automatic claiming',async()=>{
  for(const mutation of ["INSERT INTO conversation_mailbox_locks VALUES('w1','conversation-claim','2026-09-08T09:00:00.000Z')", "INSERT INTO microsoft_mail_messages(id,workspace_id,status,created_at) VALUES('ms-unknown','w1','sending','2026-09-07T08:00:00Z')"]){
    const env=fixture();env.DB.raw.exec(mutation);let calls=0;await runOutreachAutomation(env,{now,sendMessage:async()=>{calls++;return {id:'unexpected',threadId:'unexpected'};},onSent:noCrm});assert.equal(calls,0);assert.equal(env.DB.raw.prepare("SELECT status FROM outreach_automation_queue WHERE id='q1'").get().status,'queued');
  }
});
