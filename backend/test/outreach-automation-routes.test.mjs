import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {handleSaasRoute} from '../src/saas-routes.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const result=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes||0)}};}}
class DB{
  constructor(){
    this.raw=new DatabaseSync(':memory:');
    this.raw.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT,market TEXT,owner_user_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT,last_login_at TEXT);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
      CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));
      CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
      CREATE TABLE gmail_connections(workspace_id TEXT PRIMARY KEY,user_id TEXT,google_email TEXT,encrypted_refresh_token TEXT,scopes TEXT,status TEXT,history_id TEXT,connected_at TEXT,updated_at TEXT,disconnected_at TEXT);
      CREATE TABLE gmail_messages(id TEXT PRIMARY KEY,workspace_id TEXT,idempotency_key TEXT,domain TEXT,recipient TEXT,subject TEXT,gmail_message_id TEXT,gmail_thread_id TEXT,sent_by TEXT,sent_at TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(workspace_id,idempotency_key));
      INSERT INTO workspaces(id,name,market) VALUES('w1','Test','LV');`);
    this.raw.exec(fs.readFileSync(new URL('../migrations/0015_outreach_automation.sql',import.meta.url),'utf8'));
  }
  prepare(sql){return new Statement(this.raw,sql);}async batch(rows){for(const row of rows)await row.run();}
}
async function fixture(role='owner'){
  const db=new DB();const token=`token-${role}`;const hash=await sha256(token);
  db.raw.prepare('INSERT INTO users(id,email,display_name,role) VALUES(?,?,?,?)').run('u1',`${role}@example.com`,role,role);
  db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');
  db.raw.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('w1','u1',role);
  db.raw.prepare(`INSERT INTO gmail_connections(workspace_id,user_id,google_email,encrypted_refresh_token,scopes,status,connected_at,updated_at) VALUES('w1','u1','sender@example.com','x','','connected',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run();
  return {env:{DB:db,CUSTOMER_APP_URL:'https://leadintel.ccgroup.lv/customer/',OUTREACH_AUTOMATION_TEST_NOW:'2026-09-08T12:00:00.000Z'},token,db};
}
function request(path,{method='GET',token,body}={}){return new Request(`https://api.example.test${path}`,{method,headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}

sqliteTest('policy GET is fail-safe default, sales can read, and only owner can mutate',async()=>{
  const owner=await fixture('owner');
  let response=await handleSaasRoute(request('/api/outreach-automation/policy?workspace_id=w1',{token:owner.token}),owner.env,{});let result=await response.json();
  assert.equal(response.status,200);assert.equal(result.policy.mode,'manual');assert.equal(result.policy.enabled,false);assert.equal(result.policy.workspaceDailyLimit,20);
  const sales=await fixture('sales');response=await handleSaasRoute(request('/api/outreach-automation/policy?workspace_id=w1',{token:sales.token}),sales.env,{});assert.equal(response.status,200);
  response=await handleSaasRoute(request('/api/outreach-automation/policy?workspace_id=w1',{method:'PUT',token:sales.token,body:{mode:'automatic',enabled:true}}),sales.env,{});assert.equal(response.status,403);
  response=await handleSaasRoute(request('/api/outreach-automation/policy?workspace_id=w1',{method:'PUT',token:owner.token,body:{mode:'automatic',enabled:true,workspaceDailyLimit:30,mailboxDailyLimit:20,workingDays:[1,2,3,4,5],timezone:'Europe/Riga',sendWindowStart:'09:00',sendWindowEnd:'16:30',minDelayMinutes:8,maxDelayMinutes:18,maxFollowups:2,followupDelaysDays:[3,7],replyPollIntervalMinutes:60}}),owner.env,{});result=await response.json();
  assert.equal(response.status,200);assert.equal(result.policy.mode,'automatic');assert.equal(result.policy.enabled,true);assert.equal(result.policy.workspaceDailyLimit,30);
  const audit=owner.db.raw.prepare(`SELECT event_type,metadata_json FROM audit_events WHERE event_type='outreach_automation.policy_updated'`).get();assert.ok(audit);assert.match(audit.metadata_json,/automatic/);
});

sqliteTest('invalid policy fields are rejected with 400',async()=>{
  const {env,token}=await fixture();
  for(const body of [
    {mode:'automatic',enabled:true,workspaceDailyLimit:0},
    {mode:'automatic',enabled:true,timezone:'Mars/Olympus'},
    {mode:'automatic',enabled:true,sendWindowStart:'18:00',sendWindowEnd:'09:00'},
    {mode:'automatic',enabled:true,minDelayMinutes:20,maxDelayMinutes:5}
  ]){
    const response=await handleSaasRoute(request('/api/outreach-automation/policy?workspace_id=w1',{method:'PUT',token,body}),env,{});assert.equal(response.status,400);
  }
});

sqliteTest('status counts confirmed sends in the configured timezone-local day and exposes queue state',async()=>{
  const {env,token,db}=await fixture();
  let response=await handleSaasRoute(request('/api/outreach-automation/policy?workspace_id=w1',{method:'PUT',token,body:{mode:'automatic',enabled:true,workspaceDailyLimit:20,mailboxDailyLimit:20,workingDays:[1,2,3,4,5],timezone:'Europe/Riga',sendWindowStart:'09:00',sendWindowEnd:'16:30',minDelayMinutes:8,maxDelayMinutes:18,maxFollowups:2,followupDelaysDays:[3,7],replyPollIntervalMinutes:60}}),env,{});assert.equal(response.status,200);
  db.raw.prepare(`INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,sent_at,status) VALUES(?,?,?,?,?,?,?,?)`).run('m1','w1','k1','a.lv','a@a.lv','A','2026-09-08T00:30:00.000Z','sent');
  db.raw.prepare(`INSERT INTO gmail_messages(id,workspace_id,idempotency_key,domain,recipient,subject,sent_at,status) VALUES(?,?,?,?,?,?,?,?)`).run('m2','w1','k2','b.lv','b@b.lv','B','2026-09-07T20:30:00.000Z','sent');
  db.raw.prepare(`INSERT INTO outreach_automation_sequences(id,workspace_id,gmail_connection_workspace_id,source_package_key,domain,recipient,approved_at,initial_subject,initial_body,status) VALUES('s1','w1','w1','pkg1','a.lv','a@a.lv','2026-09-08T07:00:00Z','S','B','active')`).run();
  db.raw.prepare(`INSERT INTO outreach_automation_queue(id,workspace_id,sequence_id,gmail_connection_workspace_id,step_index,recipient,subject,body,status,earliest_send_at,scheduled_send_at,idempotency_key) VALUES('q1','w1','s1','w1',0,'a@a.lv','S','B','queued','2026-09-08T08:00:00Z','2026-09-08T08:00:00Z','qk1')`).run();
  db.raw.prepare(`INSERT INTO outreach_automation_queue(id,workspace_id,sequence_id,gmail_connection_workspace_id,step_index,recipient,subject,body,status,earliest_send_at,scheduled_send_at,idempotency_key) VALUES('q2','w1','s1','w1',1,'a@a.lv','S','B','blocked_limit','2026-09-08T09:00:00Z','2026-09-08T09:00:00Z','qk2')`).run();
  response=await handleSaasRoute(request('/api/outreach-automation/status?workspace_id=w1',{token}),env,{});const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.usage.workspaceSentToday,1);assert.equal(result.usage.mailboxSentToday,1);assert.equal(result.usage.workspaceLimit,20);assert.equal(result.queue.queued,1);assert.equal(result.queue.blockedByLimit,1);assert.match(result.queue.nextEligibleSendAt,/^2026-09-08T08:00/);
});
