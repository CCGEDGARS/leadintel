import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256} from '../src/security.js';
import {normalizeCalendlyUrl,processCalendlyWebhook,handleCalendlyIntegrationRoute} from '../src/calendly-integration.js';

let DatabaseSync=null;try{({DatabaseSync}=await import('node:sqlite'));}catch{}
const sqliteTest=(name,fn)=>test(name,{skip:DatabaseSync?false:'requires Node sqlite'},fn);
class Statement{constructor(db,sql){this.db=db;this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return this.db.prepare(this.sql).get(...this.args)??null;}async all(){return {results:this.db.prepare(this.sql).all(...this.args)};}async run(){const r=this.db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes||0)}};}}
class DB{
  constructor(){
    this.raw=new DatabaseSync(':memory:');
    this.raw.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE workspaces(id TEXT PRIMARY KEY);
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,display_name TEXT,role TEXT);
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,expires_at TEXT);
CREATE TABLE workspace_members(workspace_id TEXT,user_id TEXT,role TEXT,PRIMARY KEY(workspace_id,user_id));
CREATE TABLE gmail_connections(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),user_id TEXT,google_email TEXT,encrypted_refresh_token TEXT,scopes TEXT,status TEXT,history_id TEXT,connected_at TEXT,updated_at TEXT,disconnected_at TEXT);
CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
INSERT INTO workspaces VALUES('w1');INSERT INTO users VALUES('u1','owner@example.com','Owner','owner');INSERT INTO workspace_members VALUES('w1','u1','owner');INSERT INTO gmail_connections(workspace_id,user_id,status) VALUES('w1','u1','connected');`);
    this.raw.exec(fs.readFileSync(new URL('../migrations/0011_master_crm.sql',import.meta.url),'utf8'));
    this.raw.exec(fs.readFileSync(new URL('../migrations/0015_outreach_automation.sql',import.meta.url),'utf8'));
    this.raw.exec(fs.readFileSync(new URL('../migrations/0021_calendly_integration.sql',import.meta.url),'utf8'));
  }
  prepare(sql){return new Statement(this.raw,sql);}
  async batch(rows){this.raw.exec('BEGIN');try{const out=[];for(const row of rows)out.push(await row.run());this.raw.exec('COMMIT');return out;}catch(error){this.raw.exec('ROLLBACK');throw error;}}
}
async function fixture(){
  const DBi=new DB();const tokenHash=await sha256('webhook-secret');
  DBi.raw.prepare(`INSERT INTO workspace_calendly_integrations(workspace_id,scheduling_url,encrypted_personal_access_token,token_hint,user_uri,organization_uri,webhook_subscription_uri,webhook_secret_hash,status) VALUES(?,?,?,?,?,?,?,?,?)`).run('w1','https://calendly.com/edgars-7go/strategy-call-2','encrypted','…token','https://api.calendly.com/users/u1','https://api.calendly.com/organizations/o1','https://api.calendly.com/webhook_subscriptions/sub1',tokenHash,'connected');
  DBi.raw.prepare(`INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,pipeline_stage,first_seen_at,last_seen_at,created_at,updated_at) VALUES('c1','w1','example.com','Example Co','prospect','Contacted',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run();
  DBi.raw.prepare(`INSERT INTO crm_contacts(id,workspace_id,company_id,name,work_email,normalized_email,created_at,updated_at) VALUES('p1','w1','c1','Buyer','buyer@example.com','buyer@example.com',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run();
  DBi.raw.prepare(`INSERT INTO outreach_automation_sequences(id,workspace_id,gmail_connection_workspace_id,source_package_key,domain,recipient,approved_at,initial_subject,initial_body,followup_body,status,created_by) VALUES('s1','w1','w1','pkg-1','example.com','buyer@example.com',CURRENT_TIMESTAMP,'Subject','Body','Follow-up','active','u1')`).run();
  for(const [step,status] of [[0,'sent'],[1,'queued'],[2,'waiting_window']])DBi.raw.prepare(`INSERT INTO outreach_automation_queue(id,workspace_id,sequence_id,gmail_connection_workspace_id,step_index,recipient,subject,body,status,earliest_send_at,scheduled_send_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?)`).run(`q${step}`,'w1','s1','w1',step,'buyer@example.com','Subject','Body',status,`key-${step}`);
  const loginToken='calendly-owner-session';DBi.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(await sha256(loginToken),'u1');
  return {DB:DBi,loginToken};
}
function webhook(event='invitee.created',createdAt='2026-09-19T10:00:00.000Z'){
  return {event,created_at:createdAt,payload:{uri:'https://api.calendly.com/scheduled_events/e1/invitees/i1',email:'buyer@example.com',name:'Buyer',event:'https://api.calendly.com/scheduled_events/e1',status:event==='invitee.created'?'active':'canceled'}};
}

test('only valid public Calendly scheduling URLs are accepted',()=>{
  assert.equal(normalizeCalendlyUrl('https://calendly.com/edgars-7go/strategy-call-2'),'https://calendly.com/edgars-7go/strategy-call-2');
  assert.throws(()=>normalizeCalendlyUrl('https://evil.example/strategy-call-2'),/Calendly/);
  assert.throws(()=>normalizeCalendlyUrl('javascript:alert(1)'),/Calendly/);
});

sqliteTest('a booked meeting stops outreach, cancels follow-ups, advances CRM, and is idempotent',async()=>{
  const env=await fixture();
  const first=await processCalendlyWebhook(env,{workspaceId:'w1',secret:'webhook-secret',body:webhook()});
  assert.equal(first.accepted,true);assert.equal(first.duplicate,false);assert.equal(first.matched,true);
  assert.deepEqual({...env.DB.raw.prepare(`SELECT status,stop_reason FROM outreach_automation_sequences WHERE id='s1'`).get()},{status:'cancelled',stop_reason:'meeting_booked'});
  assert.deepEqual(env.DB.raw.prepare(`SELECT status FROM outreach_automation_queue WHERE sequence_id='s1' AND step_index>0 ORDER BY step_index`).all().map(row=>row.status),['skipped','skipped']);
  assert.equal(env.DB.raw.prepare(`SELECT pipeline_stage FROM crm_companies WHERE id='c1'`).get().pipeline_stage,'Meeting');
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM crm_activities WHERE activity_type='meeting.booked'`).get().count,1);
  const second=await processCalendlyWebhook(env,{workspaceId:'w1',secret:'webhook-secret',body:webhook()});
  assert.equal(second.duplicate,true);
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM crm_activities WHERE activity_type='meeting.booked'`).get().count,1);
});

sqliteTest('cancellation is logged without moving the CRM backwards or restarting outreach',async()=>{
  const env=await fixture();
  await processCalendlyWebhook(env,{workspaceId:'w1',secret:'webhook-secret',body:webhook()});
  const result=await processCalendlyWebhook(env,{workspaceId:'w1',secret:'webhook-secret',body:webhook('invitee.canceled','2026-09-19T11:00:00.000Z')});
  assert.equal(result.accepted,true);assert.equal(result.matched,true);
  assert.equal(env.DB.raw.prepare(`SELECT pipeline_stage FROM crm_companies WHERE id='c1'`).get().pipeline_stage,'Meeting');
  assert.equal(env.DB.raw.prepare(`SELECT status FROM outreach_automation_sequences WHERE id='s1'`).get().status,'cancelled');
  assert.equal(env.DB.raw.prepare(`SELECT COUNT(*) count FROM crm_activities WHERE activity_type='meeting.cancelled'`).get().count,1);
});

sqliteTest('an invalid webhook secret is rejected before any mutation',async()=>{
  const env=await fixture();
  const result=await processCalendlyWebhook(env,{workspaceId:'w1',secret:'wrong',body:webhook()});
  assert.equal(result.accepted,false);assert.equal(result.reason,'unauthorized');
  assert.equal(env.DB.raw.prepare(`SELECT status FROM outreach_automation_sequences WHERE id='s1'`).get().status,'active');
});


sqliteTest('owner connection verifies Calendly, registers the webhook, and stores only encrypted credentials',async()=>{
  const {DB,loginToken}=await fixture();DB.raw.prepare('DELETE FROM workspace_calendly_integrations').run();
  const env={DB,OAUTH_TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64')};const personalAccessToken='calendly-personal-access-token-ABCD';
  const originalFetch=globalThis.fetch;const seen=[];
  globalThis.fetch=async (url,options={})=>{seen.push({url:String(url),options});if(String(url).endsWith('/users/me'))return new Response(JSON.stringify({resource:{uri:'https://api.calendly.com/users/user-1',current_organization:'https://api.calendly.com/organizations/org-1',name:'Edgars'}}),{status:200,headers:{'Content-Type':'application/json'}});if(String(url).endsWith('/webhook_subscriptions'))return new Response(JSON.stringify({resource:{uri:'https://api.calendly.com/webhook_subscriptions/sub-1'}}),{status:201,headers:{'Content-Type':'application/json'}});return new Response('{}',{status:204});};
  try{
    const request=new Request('https://leadintel-api.example/api/integrations/calendly/connect?workspace_id=w1',{method:'PUT',headers:{Cookie:`leadintel_session=${loginToken}`,'Content-Type':'application/json'},body:JSON.stringify({personal_access_token:personalAccessToken,scheduling_url:'https://calendly.com/edgars-7go/strategy-call-2'})});
    const response=await handleCalendlyIntegrationRoute(request,env,{});assert.equal(response.status,200);const body=await response.json();
    assert.equal(body.connected,true);assert.equal(body.scheduling_url,'https://calendly.com/edgars-7go/strategy-call-2');assert.equal(JSON.stringify(body).includes(personalAccessToken),false);
    const row=DB.raw.prepare(`SELECT * FROM workspace_calendly_integrations WHERE workspace_id='w1'`).get();assert.ok(row.encrypted_personal_access_token);assert.equal(row.encrypted_personal_access_token.includes(personalAccessToken),false);assert.equal(row.webhook_secret_hash.length,64);
    const subscription=seen.find(item=>item.url.endsWith('/webhook_subscriptions'));const posted=JSON.parse(subscription.options.body);assert.deepEqual(posted.events,['invitee.created','invitee.canceled']);assert.equal(posted.scope,'user');assert.match(posted.url,/\/api\/webhooks\/calendly\/w1\//);assert.equal(posted.url.includes(personalAccessToken),false);
  }finally{globalThis.fetch=originalFetch;}
});
