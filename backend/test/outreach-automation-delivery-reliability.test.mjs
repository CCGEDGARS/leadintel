import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {seedAutomationSource} from './outreach-automation-source-fixture.mjs';
import {sha256} from '../src/security.js';
import {handleOutreachAutomationRoute} from '../src/outreach-automation-routes.js';
import {runOutreachAutomation} from '../src/outreach-automation-runner.js';
import {pollOutreachReplies} from '../src/outreach-automation-replies.js';
const now=new Date('2026-09-08T08:30:00.000Z');
async function fixture({bodyChanges={},expectedStatus=201}={}){
 const DB=storageDb(),env={DB,AUTOMATIC_GMAIL_DELIVERY_MODE:'enabled',OUTREACH_AUTOMATION_TEST_NOW:now.toISOString()};
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner','2099-01-01')").run(await sha256('automation-reliability'));
 DB.raw.exec(`INSERT INTO gmail_connections(workspace_id,user_id,google_email,encrypted_refresh_token,scopes,status) VALUES('storage-w1','storage-owner','seller@example.test','fixture','send','connected');
 INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,pipeline_stage,first_seen_at,last_seen_at,created_at,updated_at) VALUES('delivery-co','storage-w1','buyer.example','Buyer Company','prospect','Ready for Outreach','now','now','now','now');
 INSERT INTO crm_contacts(id,workspace_id,company_id,name,title,work_email,normalized_email,email_status,source,created_at,updated_at) VALUES('delivery-buyer','storage-w1','delivery-co','Reviewed Buyer','CEO','buyer@buyer.example','buyer@buyer.example','verified','apollo','now','now');
 INSERT INTO outreach_automation_policies(workspace_id,mode,enabled,workspace_daily_limit,mailbox_daily_limit,working_days_json,timezone,send_window_start,send_window_end,min_delay_minutes,max_delay_minutes,max_followups,followup_delays_days_json,reply_poll_interval_minutes,updated_by) VALUES('storage-w1','automatic',1,5,5,'[1,2,3,4,5]','Europe/Riga','09:00','16:30',8,18,2,'[3,7]',60,'storage-owner');`);
 const authority=seedAutomationSource(DB,{workspaceId:'storage-w1',userId:'storage-owner'});
 const body={approved:true,source_authority:authority,approved_at:'2026-09-08T08:00:00.000Z',domain:'buyer.example',recipient:'buyer@buyer.example',subject:'Reviewed subject',body:'Reviewed body',followup_body:'Reviewed follow-up',recipient_snapshot:{contactId:'delivery-buyer',name:'Reviewed Buyer',title:'CEO',email:'buyer@buyer.example',linkedin:'',companyDomain:'buyer.example'},...bodyChanges};
 const response=await handleOutreachAutomationRoute(new Request('https://fixture/api/outreach-automation/sequences?workspace_id=storage-w1',{method:'POST',headers:{Cookie:'leadintel_session=automation-reliability','Content-Type':'application/json'},body:JSON.stringify(body)}),env,{});assert.equal(response.status,expectedStatus);if(!response.ok)return {env,DB,body,response};const queued=await response.json();
 const prepare=DB.prepare.bind(DB);DB.prepare=sql=>{const statement=prepare(sql);statement.deliverySql=sql;return statement;};
 return {env,DB,body,sequence:queued.sequence,queue:queued.queue_items[0]};
}
function thread(f,text){return {id:'accepted-thread',messages:[{id:'incoming-meeting',threadId:'accepted-thread',internalDate:String(Date.parse('2026-09-08T09:30:00Z')),payload:{mimeType:'text/plain',headers:[{name:'From',value:f.body.recipient}],body:{data:Buffer.from(text).toString('base64url')}}}]};}
test('actual enqueue, accepted dispatch, CRM and meeting-request reply retain durable exact identity without declaring a booked meeting',async()=>{
 const f=await fixture();try{
  let sends=0;const first=await runOutreachAutomation(f.env,{now,sendMessage:async()=>{sends++;return {id:'accepted-id',threadId:'accepted-thread'};}});assert.equal(first.sent,1);assert.equal(sends,1);
  assert.equal(f.DB.raw.prepare("SELECT pipeline_stage FROM crm_companies WHERE id='delivery-co'").get().pipeline_stage,'Contacted');assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM crm_activities WHERE activity_type='email.sent'").get().n,1);
  const reply=await pollOutreachReplies(f.env,{now:new Date('2026-09-08T10:00:00Z'),fetchThread:async()=>thread(f,'Yes, can we schedule a meeting?')});assert.equal(reply.stopped,1);assert.equal(reply.replies,1);
  assert.equal(f.DB.raw.prepare('SELECT category FROM outreach_automation_processed_replies').get().category,'meeting_request');assert.equal(f.DB.raw.prepare("SELECT pipeline_stage FROM crm_companies WHERE id='delivery-co'").get().pipeline_stage,'Replied');assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM crm_activities WHERE activity_type='email.reply_received'").get().n,1);
  assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM outreach_automation_queue WHERE step_index>0 AND status='cancelled_reply'").get().n,2);
  await runOutreachAutomation(f.env,{now:new Date('2026-09-18T08:00:00Z'),sendMessage:async()=>{sends++;throw Error('Must never submit');}});assert.equal(sends,1);
 }finally{f.DB.raw.close();}
});
test('revocation at the actual CRM transaction preserves acceptance and cannot advance CRM',async()=>{
 const f=await fixture();try{const batch=f.DB.batch.bind(f.DB);let fired=false;f.DB.batch=async rows=>{if(!fired&&rows.some(row=>row.deliverySql?.includes('INSERT OR IGNORE INTO crm_activities'))){fired=true;f.DB.raw.exec("UPDATE workspace_members SET role='viewer' WHERE workspace_id='storage-w1'");}return batch(rows);};
  let sends=0;const result=await runOutreachAutomation(f.env,{now,sendMessage:async()=>{sends++;return {id:'accepted-id',threadId:'accepted-thread'};}});assert.equal(result.sent,1);assert.equal(sends,1);assert.equal(fired,true);
  assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM crm_activities WHERE activity_type='email.sent'").get().n,0);assert.equal(f.DB.raw.prepare("SELECT pipeline_stage FROM crm_companies WHERE id='delivery-co'").get().pipeline_stage,'Ready for Outreach');assert.equal(f.DB.raw.prepare('SELECT status FROM gmail_messages').get().status,'sent');assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM audit_events WHERE event_type='outreach_automation.crm_sync_failed_after_send'").get().n,1);
 }finally{f.DB.raw.close();}
});
test('external campaign prefixes cannot bypass original canonical source or invent persisted campaign approval',async()=>{
 for(const source_authority of [null,undefined,'current']){const f=await fixture({bodyChanges:{contact_identity:'campaign:nonexistent:delivery-buyer',...(source_authority==='current'?{}:{source_authority})},expectedStatus:409});try{assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM outreach_automation_sequences').get().n,0);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM outreach_automation_queue').get().n,0);}finally{f.DB.raw.close();}}
});
test('a manual accepted send after queueing holds the automatic initial across both providers',async()=>{
 for(const table of ['gmail_messages','microsoft_mail_messages']){const f=await fixture();try{f.DB.raw.prepare(`INSERT INTO ${table}(id,workspace_id,idempotency_key,domain,recipient,subject,sent_by,status,sent_at) VALUES('manual-other-key','storage-w1','manual-other-key','buyer.example','buyer@buyer.example','Reviewed subject','storage-owner','sent',?)`).run(now.toISOString());let sends=0;const result=await runOutreachAutomation(f.env,{now,sendMessage:async()=>{sends++;return {id:'duplicate',threadId:'duplicate-thread'};}});assert.equal(sends,0,table);assert.equal(result.sent,0,table);assert.notEqual(f.DB.raw.prepare('SELECT status FROM outreach_automation_queue WHERE id=?').get(f.queue.id).status,'sent');}finally{f.DB.raw.close();}}
});
test('status cannot disclose queue recipients after the original session is revoked during its final read',async()=>{
 const f=await fixture();try{const prepare=f.DB.prepare.bind(f.DB);f.DB.prepare=sql=>{const statement=prepare(sql);if(sql.includes('pending_steps')){const all=statement.all.bind(statement);statement.all=async()=>{const result=await all();f.DB.raw.exec('DELETE FROM sessions');return result;};}return statement;};const response=await handleOutreachAutomationRoute(new Request('https://fixture/api/outreach-automation/status?workspace_id=storage-w1',{headers:{Cookie:'leadintel_session=automation-reliability'}}),f.env,{});assert.equal(response.status,401);assert.equal((await response.text()).includes('buyer@buyer.example'),false);}finally{f.DB.raw.close();}
});
test('an accepted automatic initial cannot be repeated manually with another key or provider but a distinct reviewed followup may send',async()=>{
 const {handleSaasRoute}=await import('../src/saas-routes.js'),{importAesKey,encryptSecret}=await import('../src/oauth.js');const f=await fixture(),originalFetch=globalThis.fetch;try{
  f.DB.raw.exec("UPDATE outreach_automation_policies SET max_followups=0,followup_delays_days_json='[]'");let automatic=0;assert.equal((await runOutreachAutomation(f.env,{now,sendMessage:async()=>{automatic++;return {id:'accepted-auto',threadId:'auto-thread'};}})).sent,1);assert.equal(automatic,1);
  f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');f.env.GOOGLE_OAUTH_CLIENT_ID='fixture';f.env.GOOGLE_OAUTH_CLIENT_SECRET='fixture';f.env.MICROSOFT_OAUTH_CLIENT_ID='fixture';f.env.MICROSOFT_OAUTH_CLIENT_SECRET='fixture';const encrypted=await encryptSecret('fixture-refresh',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));f.DB.raw.prepare("UPDATE gmail_connections SET encrypted_refresh_token=? WHERE workspace_id='storage-w1'").run(encrypted);f.DB.raw.prepare("INSERT INTO microsoft_mail_connections(workspace_id,user_id,microsoft_email,encrypted_refresh_token,scopes,status) VALUES('storage-w1','storage-owner','seller@example.test',?,'send','connected')").run(encrypted);
  let providerCalls=0;globalThis.fetch=async url=>String(url).includes('token')?Response.json({access_token:'fixture-token'}):(providerCalls++,Response.json({id:'manual-followup',threadId:'manual-followup-thread'}));
  const manual=(provider,body,key)=>handleSaasRoute(new Request(`https://fixture/api/integrations/${provider}/send?workspace_id=storage-w1`,{method:'POST',headers:{Cookie:'leadintel_session=automation-reliability','Content-Type':'application/json'},body:JSON.stringify({...f.body,body,text_body:body,html_body:'',idempotency_key:key})}),f.env,{});
  for(const provider of ['gmail','microsoft-mail']){const response=await manual(provider,f.body.body,'manual-duplicate-'+provider);assert.equal(response.status,409,provider);assert.equal(providerCalls,0);}
  const distinct=await manual('gmail','A separately reviewed follow-up.','manual-distinct-followup');assert.equal(distinct.status,201);assert.equal(providerCalls,1);assert.equal((await distinct.json()).message.status,'sent');
 }finally{globalThis.fetch=originalFetch;f.DB.raw.close();}
});
