import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {handleOutreachAutomationRoute} from '../src/outreach-automation-routes.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes||0)}};}}
class DB{constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT,market TEXT,owner_user_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT,last_login_at TEXT);
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));
CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
CREATE TABLE gmail_connections(workspace_id TEXT PRIMARY KEY,user_id TEXT,google_email TEXT,encrypted_refresh_token TEXT,scopes TEXT,status TEXT,history_id TEXT,connected_at TEXT,updated_at TEXT,disconnected_at TEXT);
CREATE TABLE gmail_messages(id TEXT PRIMARY KEY,workspace_id TEXT,idempotency_key TEXT,domain TEXT,recipient TEXT,subject TEXT,gmail_message_id TEXT,gmail_thread_id TEXT,sent_by TEXT,sent_at TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(workspace_id,idempotency_key));
CREATE TABLE crm_companies(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,normalized_domain TEXT,company_name TEXT NOT NULL,lifecycle_status TEXT NOT NULL DEFAULT 'prospect');
INSERT INTO workspaces(id,name,market) VALUES('w1','Test','LV');`);this.raw.exec(fs.readFileSync(new URL('../migrations/0015_outreach_automation.sql',import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){this.raw.exec('BEGIN');try{const out=[];for(const row of rows)out.push(await row.run());this.raw.exec('COMMIT');return out;}catch(cause){this.raw.exec('ROLLBACK');throw cause;}}}
async function fixture({role='owner',automatic=true,gmail=true,suppressed=false}={}){const db=new DB();const token=`queue-${role}`;const hash=await sha256(token);db.raw.prepare('INSERT INTO users(id,email,display_name,role) VALUES(?,?,?,?)').run('u1',`${role}@example.com`,role,role);db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');db.raw.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('w1','u1',role);if(gmail)db.raw.prepare(`INSERT INTO gmail_connections(workspace_id,user_id,google_email,encrypted_refresh_token,scopes,status,connected_at,updated_at) VALUES('w1','u1','sender@example.com','x','','connected',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run();db.raw.prepare(`INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status) VALUES('c1','w1','example.com','Example',?)`).run(suppressed?'suppressed':'prospect');if(automatic)db.raw.prepare(`INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,workspace_daily_limit,mailbox_daily_limit,working_days_json,timezone,send_window_start,send_window_end,min_delay_minutes,max_delay_minutes,max_followups,followup_delays_days_json,reply_poll_interval_minutes,updated_by) VALUES('w1','automatic',1,20,20,'[1,2,3,4,5]','Europe/Riga','09:00','16:30',8,18,2,'[3,7]',60,'u1')`).run();return {env:{DB:db,OUTREACH_AUTOMATION_TEST_NOW:'2026-09-08T08:30:00.000Z'},token,db};}
function request(body,token){return new Request('https://api.example.test/api/outreach-automation/sequences?workspace_id=w1',{method:'POST',headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}
const approved={approved:true,domain:'example.com',recipient:'buyer@example.com',subject:'Original subject',body:'Original body',followup_body:'Original follow-up',approved_at:'2026-09-08T08:00:00.000Z',contact_identity:'Buyer|CEO'};

sqliteTest('enqueue fails closed for unsafe or unauthorized states',async()=>{
  let f=await fixture({automatic:false});let r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,409);
  f=await fixture();r=await handleOutreachAutomationRoute(request({...approved,approved:false},f.token),f.env,{});assert.equal(r.status,400);
  r=await handleOutreachAutomationRoute(request({...approved,recipient:'not-email'},f.token),f.env,{});assert.equal(r.status,400);
  f=await fixture({suppressed:true});r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,409);assert.equal((await r.json()).code,'CRM_COMPANY_SUPPRESSED');
  f=await fixture({gmail:false});r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,409);
  f=await fixture({role:'sales'});r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,403);
});

sqliteTest('successful enqueue snapshots approved content and creates only initial step',async()=>{
  const {env,token,db}=await fixture();const payload={...approved};
  const response=await handleOutreachAutomationRoute(request(payload,token),env,{});const result=await response.json();assert.equal(response.status,201);assert.equal(result.sequence.domain,'example.com');assert.equal(result.queue_items.length,1);assert.equal(result.queue_items[0].step_index,0);
  payload.subject='Edited later';payload.body='Edited later';payload.followup_body='Edited later';
  const seq=db.raw.prepare(`SELECT initial_subject,initial_body,followup_body FROM outreach_automation_sequences WHERE id=?`).get(result.sequence.id);assert.equal(seq.initial_subject,'Original subject');assert.equal(seq.initial_body,'Original body');assert.equal(seq.followup_body,'Original follow-up');
  const row=db.raw.prepare(`SELECT subject,body,status,scheduled_send_at FROM outreach_automation_queue WHERE sequence_id=?`).get(result.sequence.id);assert.equal(row.subject,'Original subject');assert.equal(row.body,'Original body');assert.equal(row.status,'queued');assert.ok(row.scheduled_send_at);
  assert.equal(db.raw.prepare(`SELECT COUNT(*) count FROM outreach_automation_queue WHERE sequence_id=?`).get(result.sequence.id).count,1);
});

sqliteTest('enqueue is idempotent for the same approved package identity',async()=>{
  const {env,token,db}=await fixture();const first=await handleOutreachAutomationRoute(request(approved,token),env,{});const one=await first.json();const second=await handleOutreachAutomationRoute(request(approved,token),env,{});const two=await second.json();assert.equal(first.status,201);assert.equal(second.status,200);assert.equal(two.duplicate,true);assert.equal(two.sequence.id,one.sequence.id);assert.equal(db.raw.prepare('SELECT COUNT(*) count FROM outreach_automation_sequences').get().count,1);assert.equal(db.raw.prepare('SELECT COUNT(*) count FROM outreach_automation_queue').get().count,1);
});
