import {seedAutomationSource,automationSourceAuthority} from './outreach-automation-source-fixture.mjs';
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
CREATE TABLE crm_contacts(id TEXT PRIMARY KEY,workspace_id TEXT,company_id TEXT,normalized_email TEXT,email_status TEXT,name TEXT,source TEXT,archived_at TEXT);
CREATE TABLE audit_events(id TEXT PRIMARY KEY,workspace_id TEXT,user_id TEXT,event_type TEXT,entity_type TEXT,entity_id TEXT,metadata_json TEXT);
CREATE TABLE gmail_connections(workspace_id TEXT PRIMARY KEY,user_id TEXT,google_email TEXT,encrypted_refresh_token TEXT,scopes TEXT,status TEXT,history_id TEXT,connected_at TEXT,updated_at TEXT,disconnected_at TEXT);
CREATE TABLE microsoft_mail_messages(id TEXT PRIMARY KEY,workspace_id TEXT,recipient TEXT,status TEXT);
CREATE TABLE gmail_messages(id TEXT PRIMARY KEY,workspace_id TEXT,idempotency_key TEXT,domain TEXT,recipient TEXT,subject TEXT,gmail_message_id TEXT,gmail_thread_id TEXT,sent_by TEXT,sent_at TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(workspace_id,idempotency_key));
CREATE TABLE crm_companies(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,normalized_domain TEXT,company_name TEXT NOT NULL,lifecycle_status TEXT NOT NULL DEFAULT 'prospect',deleted_at TEXT);
INSERT INTO workspaces(id,name,market) VALUES('w1','Test','LV');`);this.raw.exec(fs.readFileSync(new URL('../migrations/0015_outreach_automation.sql',import.meta.url),'utf8'));this.raw.exec(fs.readFileSync(new URL('../migrations/0024_automation_brand_html.sql',import.meta.url),'utf8'));this.raw.exec(fs.readFileSync(new URL('../migrations/0025_contact_suppression.sql',import.meta.url),'utf8'));this.raw.exec(fs.readFileSync(new URL('../migrations/0027_approved_workflow.sql',import.meta.url),'utf8'));}prepare(sql){return new Statement(this.raw,sql);}async batch(rows){this.raw.exec('BEGIN');try{const out=[];for(const row of rows)out.push(await row.run());this.raw.exec('COMMIT');return out;}catch(cause){this.raw.exec('ROLLBACK');throw cause;}}}
async function fixture({role='owner',automatic=true,gmail=true,suppressed=false}={}){const db=new DB();const token=`queue-${role}`;const hash=await sha256(token);db.raw.prepare('INSERT INTO users(id,email,display_name,role) VALUES(?,?,?,?)').run('u1',`${role}@example.com`,role,role);db.raw.prepare(`INSERT INTO sessions VALUES(?,?,datetime('now','+1 day'))`).run(hash,'u1');db.raw.prepare('INSERT INTO workspace_members VALUES(?,?,?)').run('w1','u1',role);if(gmail)db.raw.prepare(`INSERT INTO gmail_connections(workspace_id,user_id,google_email,encrypted_refresh_token,scopes,status,connected_at,updated_at) VALUES('w1','u1','sender@example.com','x','','connected',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run();db.raw.prepare(`INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status) VALUES('c1','w1','example.com','Example',?)`).run(suppressed?'suppressed':'prospect');db.raw.prepare(`INSERT INTO crm_contacts(id,workspace_id,company_id,normalized_email,email_status,name,source) VALUES('p1','w1','c1','buyer@example.com','verified','Buyer Example','apollo')`).run();if(automatic)db.raw.prepare(`INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,workspace_daily_limit,mailbox_daily_limit,working_days_json,timezone,send_window_start,send_window_end,min_delay_minutes,max_delay_minutes,max_followups,followup_delays_days_json,reply_poll_interval_minutes,updated_by) VALUES('w1','automatic',1,20,20,'[1,2,3,4,5]','Europe/Riga','09:00','16:30',8,18,2,'[3,7]',60,'u1')`).run();seedAutomationSource(db);return {env:{DB:db,AUTOMATIC_GMAIL_DELIVERY_MODE:'enabled',OUTREACH_AUTOMATION_TEST_NOW:'2026-09-08T08:30:00.000Z'},token,db};}
function request(body,token){body={recipient_snapshot:{contactId:'p1',name:'Buyer Example',title:'',email:'buyer@example.com',linkedin:'',companyDomain:'example.com'},...body};return new Request('https://api.example.test/api/outreach-automation/sequences?workspace_id=w1',{method:'POST',headers:{Cookie:`leadintel_session=${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}
const approved={approved:true,source_authority:automationSourceAuthority(),domain:'example.com',recipient:'buyer@example.com',subject:'Original subject',body:'Original body',followup_body:'Original follow-up',approved_at:'2026-09-08T08:00:00.000Z',contact_identity:'Buyer|CEO'};

sqliteTest('enqueue fails closed for unsafe or unauthorized states',async()=>{
  let f=await fixture({automatic:false});let r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,409);
  f=await fixture();r=await handleOutreachAutomationRoute(request({...approved,approved:false},f.token),f.env,{});assert.equal(r.status,400);
  r=await handleOutreachAutomationRoute(request({...approved,recipient:'not-email'},f.token),f.env,{});assert.equal(r.status,400);
  f=await fixture({suppressed:true});r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,409);assert.equal((await r.json()).code,'CRM_COMPANY_SUPPRESSED');
  f=await fixture({gmail:false});r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,409);
  f=await fixture({role:'sales'});r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,403);
  f=await fixture();f.db.raw.prepare(`UPDATE crm_contacts SET email_status='public_unverified' WHERE id='p1'`).run();r=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(r.status,409);assert.equal((await r.json()).code,'CRM_EMAIL_NOT_VERIFIED');
});

sqliteTest('successful enqueue snapshots approved content and creates only initial step',async()=>{
  const {env,token,db}=await fixture();const payload={...approved};
  const response=await handleOutreachAutomationRoute(request(payload,token),env,{});const result=await response.json();assert.equal(response.status,201);assert.equal(result.sequence.domain,'example.com');assert.equal(result.queue_items.length,1);assert.equal(result.queue_items[0].step_index,0);
  payload.subject='Edited later';payload.body='Edited later';payload.followup_body='Edited later';
  const seq=db.raw.prepare(`SELECT initial_subject,initial_body,followup_body FROM outreach_automation_sequences WHERE id=?`).get(result.sequence.id);assert.equal(seq.initial_subject,'Original subject');assert.equal(seq.initial_body,'Original body');assert.equal(seq.followup_body,'Original follow-up');
  const row=db.raw.prepare(`SELECT subject,body,status,scheduled_send_at FROM outreach_automation_queue WHERE sequence_id=?`).get(result.sequence.id);assert.equal(row.subject,'Original subject');assert.equal(row.body,'Original body');assert.equal(row.status,'queued');assert.ok(row.scheduled_send_at);
  assert.equal(db.raw.prepare(`SELECT COUNT(*) count FROM outreach_automation_queue WHERE sequence_id=?`).get(result.sequence.id).count,1);
});

sqliteTest('approved branded HTML is validated and frozen with the queued message',async()=>{
  const {env,token,db}=await fixture();const html='<p>Hello buyer</p>';
  const response=await handleOutreachAutomationRoute(request({...approved,html_body:html,followup_html_body:'<p>Follow up</p>'},token),env,{});
  assert.equal(response.status,201);assert.equal(db.raw.prepare(`SELECT html_body FROM outreach_automation_queue WHERE step_index=0`).get().html_body,html);
  assert.equal(db.raw.prepare(`SELECT followup_html_body FROM outreach_automation_sequences LIMIT 1`).get().followup_html_body,'<p>Follow up</p>');
  const invalid=await fixture();const rejected=await handleOutreachAutomationRoute(request({...approved,html_body:'<script>alert(1)</script>'},invalid.token),invalid.env,{});
  assert.equal(rejected.status,400);assert.equal((await rejected.json()).code,'AUTOMATION_EMAIL_CONTENT_INVALID');
});

sqliteTest('enqueue is idempotent for the same approved package identity',async()=>{
  const {env,token,db}=await fixture();const first=await handleOutreachAutomationRoute(request(approved,token),env,{});const one=await first.json();const second=await handleOutreachAutomationRoute(request(approved,token),env,{});const two=await second.json();assert.equal(first.status,201);assert.equal(second.status,200);assert.equal(two.duplicate,true);assert.equal(two.sequence.id,one.sequence.id);assert.equal(db.raw.prepare('SELECT COUNT(*) count FROM outreach_automation_sequences').get().count,1);assert.equal(db.raw.prepare('SELECT COUNT(*) count FROM outreach_automation_queue').get().count,1);
});

sqliteTest('reapproving a previously queued recipient does not create an automatic second send',async()=>{
  const {env,token,db}=await fixture();const first=await handleOutreachAutomationRoute(request(approved,token),env,{});assert.equal(first.status,201);
  const second=await handleOutreachAutomationRoute(request({...approved,approved_at:'2026-09-09T08:00:00.000Z'},token),env,{});
  assert.equal(second.status,409);assert.equal((await second.json()).code,'AUTOMATION_RECIPIENT_ALREADY_CONTACTED');
  assert.equal(db.raw.prepare(`SELECT COUNT(*) n FROM outreach_automation_queue`).get().n,1);
});
sqliteTest('queue refuses missing reviewed identity and changed same-ID recipient before resealing',async()=>{for(const mutation of [null,"UPDATE crm_contacts SET name='Different Buyer'","UPDATE crm_contacts SET id='different-crm-id'"]){const f=await fixture();if(mutation)f.db.raw.exec(mutation);const r=await handleOutreachAutomationRoute(request({...approved,...(!mutation?{recipient_snapshot:null}:{})},f.token),f.env,{});assert.equal(r.status,409);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM outreach_automation_sequences').get().n,0);}});

sqliteTest('same approval identity cannot silently reuse different approved message content',async()=>{
  for(const replacement of [{subject:'Changed'}, {body:'Changed'}, {followup_body:'Changed'}, {html_body:'<p>Changed</p>'}, {followup_html_body:'<p>Changed followup</p>'}]){
    const f=await fixture();assert.equal((await handleOutreachAutomationRoute(request(approved,f.token),f.env,{})).status,201);
    const rejected=await handleOutreachAutomationRoute(request({...approved,...replacement},f.token),f.env,{});assert.equal(rejected.status,409);
    assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_queue').get().n,1);
  }
});

sqliteTest('competing approval timestamps cannot race the already-contacted recipient check',async()=>{
  const f=await fixture();const batch=f.db.batch.bind(f.db);let competitor;
  f.db.batch=async statements=>{if(statements.some(row=>row.sql.includes('INSERT OR IGNORE INTO outreach_automation_sequences'))){f.db.batch=batch;competitor=await handleOutreachAutomationRoute(request({...approved,approved_at:'2026-09-08T08:01:00.000Z'},f.token),f.env,{});}return batch(statements);};
  const response=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(competitor.status,201);assert.equal(response.status,409);
  assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_sequences').get().n,1);assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_queue').get().n,1);
});

sqliteTest('mailbox replacement at enqueue transaction rejects the captured approved package',async()=>{
  const f=await fixture();const batch=f.db.batch.bind(f.db);f.db.batch=async rows=>{if(rows.some(row=>row.sql.includes('INSERT OR IGNORE INTO outreach_automation_sequences')))f.db.raw.exec("UPDATE gmail_connections SET google_email='replacement@example.com',encrypted_refresh_token='new'");return batch(rows);};
  const response=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(response.status,409);assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_sequences').get().n,0);
});

sqliteTest('queue approval requires the original approved upstream source and rejects drift at commit',async()=>{
  for(const authority of [undefined,{}, {...automationSourceAuthority(),senderSignature:'0'.repeat(64)}]){
    const f=await fixture();const response=await handleOutreachAutomationRoute(request({...approved,source_authority:authority},f.token),f.env,{});assert.equal(response.status,409);assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_sequences').get().n,0);
  }
  const f=await fixture(),batch=f.db.batch.bind(f.db);f.db.batch=async rows=>{if(rows.some(row=>row.sql.includes('INSERT OR IGNORE INTO outreach_automation_sequences'))){const payload=JSON.parse(f.db.raw.prepare('SELECT payload_json FROM customer_workspace_state').get().payload_json);payload.main.profile.priorityOffers='Changed before commit';f.db.raw.prepare('UPDATE customer_workspace_state SET payload_json=?').run(JSON.stringify(payload));}return batch(rows);};
  const rejected=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(rejected.status,409);assert.equal(f.db.raw.prepare('SELECT COUNT(*) n FROM outreach_automation_sequences').get().n,0);assert.equal(f.db.raw.prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='outreach.sequence_source_authority'").get().n,0);
});

sqliteTest('queue retains exact reviewed whitespace and line breaks instead of trimming approved transport content',async()=>{
 const f=await fixture(),payload={...approved,subject:'  Reviewed subject  ',body:'\n  Reviewed first line\n\nSecond line  \n',followup_body:'\n Follow-up  \n',html_body:' \n<p>Reviewed body</p>\n ',followup_html_body:' \n<p>Follow-up</p>\n '};
 const response=await handleOutreachAutomationRoute(request(payload,f.token),f.env,{});assert.equal(response.status,201);const result=await response.json();assert.equal(result.queue_items[0].subject,payload.subject);assert.equal(result.queue_items[0].body,payload.body);assert.equal(result.queue_items[0].html_body,payload.html_body);assert.equal(result.sequence.followup_body,payload.followup_body);assert.equal(result.sequence.followup_html_body,payload.followup_html_body);
});
sqliteTest('oversized approved text and invalid subject headers are rejected without a truncated queued replacement',async()=>{
 for(const replacement of [{subject:'s'.repeat(501)},{body:'b'.repeat(100001)},{followup_body:'f'.repeat(100001)},{subject:'Reviewed\r\nBcc: unexpected@example.com'}]){const f=await fixture(),response=await handleOutreachAutomationRoute(request({...approved,...replacement},f.token),f.env,{});assert.equal(response.status,400);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM outreach_automation_sequences').get().n,0);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM outreach_automation_queue').get().n,0);}
});

sqliteTest('archived companies cannot acquire a new automatic sequence even with a reviewed source',async()=>{
 const f=await fixture();f.db.raw.exec("UPDATE crm_companies SET lifecycle_status='archived'");const response=await handleOutreachAutomationRoute(request(approved,f.token),f.env,{});assert.equal(response.status,409);assert.equal(f.db.raw.prepare('SELECT count(*) n FROM outreach_automation_sequences').get().n,0);
});
