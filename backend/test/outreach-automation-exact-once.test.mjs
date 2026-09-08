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
function fixture(){const db=new DB();db.raw.exec(`INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,paused,emergency_stop,workspace_daily_limit,mailbox_daily_limit,working_days_json,timezone,send_window_start,send_window_end,min_delay_minutes,max_delay_minutes,max_followups,followup_delays_days_json,reply_poll_interval_minutes,updated_by) VALUES('w1','automatic',1,0,0,20,20,'[1,2,3,4,5]','Europe/Riga','09:00','16:30',8,18,0,'[]',60,'u1');
INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,deleted_at,pipeline_stage,updated_at) VALUES('c1','w1','example.com','Example','prospect',NULL,'Ready for Outreach',CURRENT_TIMESTAMP);
INSERT INTO outreach_automation_sequences(id,workspace_id,gmail_connection_workspace_id,source_package_key,domain,recipient,approved_at,initial_subject,initial_body,followup_body,status,created_by) VALUES('s1','w1','w1','pkg','example.com','buyer@example.com','2026-09-08T07:00:00.000Z','Subject','Body','','active','u1');
INSERT INTO outreach_automation_queue(id,workspace_id,sequence_id,gmail_connection_workspace_id,step_index,recipient,subject,body,status,earliest_send_at,scheduled_send_at,idempotency_key) VALUES('q1','w1','s1','w1',0,'buyer@example.com','Subject','Body','queued','2026-09-08T08:00:00.000Z','2026-09-08T08:00:00.000Z','auto-q1');`);return {DB:db};}

sqliteTest('CRM side-effect failure after Gmail confirmation never reopens an already-sent message for retry',async()=>{
  const env=fixture();let gmailCalls=0;const sendMessage=async()=>{gmailCalls++;return {id:'gm-1',threadId:'th-1'};};
  const first=await runOutreachAutomation(env,{now:new Date('2026-09-08T08:30:00.000Z'),sendMessage,onSent:async()=>{throw new Error('CRM temporarily unavailable');}});
  assert.equal(gmailCalls,1);assert.equal(first.sent,1);const queue=env.DB.raw.prepare(`SELECT status,gmail_message_id FROM outreach_automation_queue WHERE id='q1'`).get();const message=env.DB.raw.prepare(`SELECT status,gmail_message_id FROM gmail_messages WHERE idempotency_key='auto-q1'`).get();assert.equal(queue.status,'sent');assert.equal(queue.gmail_message_id,'gm-1');assert.equal(message.status,'sent');assert.equal(message.gmail_message_id,'gm-1');
  const second=await runOutreachAutomation(env,{now:new Date('2026-09-08T09:30:00.000Z'),sendMessage,onSent:async()=>{}});assert.equal(second.sent,0);assert.equal(gmailCalls,1);
});
