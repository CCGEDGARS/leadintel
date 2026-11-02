import test from 'node:test';
import assert from 'node:assert/strict';
import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';
import {handleSaasRoute} from '../src/saas-routes.js';
import {handleCrmRoute} from '../src/crm-routes.js';

async function fixture(){
 const DB=storageDb(),env={DB};
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner','2099-01-01')").run(await sha256('manual-reconciliation'));
 DB.raw.exec("INSERT INTO crm_companies(id,workspace_id,normalized_domain,company_name,lifecycle_status,first_seen_at,last_seen_at,created_at,updated_at) VALUES('manual-co','storage-w1','buyer.example','Buyer Company','prospect','now','now','now','now')");
 const headers={Cookie:'leadintel_session=manual-reconciliation','Content-Type':'application/json'};
 const status=(changes={})=>handleSaasRoute(new Request('https://fixture/api/integrations/mail/delivery-status?'+new URLSearchParams({workspace_id:'storage-w1',domain:'buyer.example',recipient:'buyer@buyer.example',...changes}),{headers}),env,{});
 const activity=(changes={})=>handleCrmRoute(new Request('https://fixture/api/crm/companies/manual-co/activities?workspace_id=storage-w1',{method:'POST',headers,body:JSON.stringify({id:'manual-confirmed-record',type:'email.sent',channel:'gmail-compose',metadata:{recipient:'buyer@buyer.example',delivery_channel:'gmail-compose'},...changes})}),env,{});
 const pending=(table='gmail_messages',changes={})=>DB.raw.prepare(`INSERT INTO ${table}(id,workspace_id,idempotency_key,domain,recipient,subject,status) VALUES(?,?,?,?,?,?,'sending')`).run(changes.id||'unresolved',changes.workspace||'storage-w1',changes.id||'unresolved-key','buyer.example',changes.recipient||'buyer@buyer.example','Uncertain message');
 return {DB,env,status,activity,pending};
}
for(const provider of ['gmail_messages','microsoft_mail_messages'])test(`${provider}: fresh manual confirmation cannot relabel a durable unresolved submission`,async()=>{
 const f=await fixture();try{f.pending(provider);const response=await f.status();assert.ok(response,'status route must exist');assert.equal(response.status,200);assert.deepEqual(await response.json(),{workspace_id:'storage-w1',domain:'buyer.example',recipient:'buyer@buyer.example',manual_record_allowed:false,unresolved:true});const recorded=await f.activity();assert.equal(recorded.status,409);assert.equal((await recorded.json()).code,'DELIVERY_RECONCILIATION_REQUIRED');assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM crm_activities WHERE activity_type='email.sent'").get().n,0);assert.equal(f.DB.raw.prepare(`SELECT status FROM ${provider}`).get().status,'sending');}finally{f.DB.raw.close();}
});
test('manual preflight and writes preserve clean, normalized, provider-confirmed and other workspace paths',async()=>{
 const f=await fixture();try{f.pending('gmail_messages',{workspace:'storage-w2'});f.pending('microsoft_mail_messages',{id:'other-recipient',recipient:'other@buyer.example'});const response=await f.status({domain:'https://www.buyer.example/path',recipient:'BUYER@BUYER.EXAMPLE'});assert.ok(response);assert.equal(response.status,200);assert.deepEqual(await response.json(),{workspace_id:'storage-w1',domain:'buyer.example',recipient:'buyer@buyer.example',manual_record_allowed:true,unresolved:false});assert.equal((await f.activity()).status,200);f.pending('gmail_messages',{id:'own-unknown'});assert.equal((await f.activity({id:'provider-confirmed-record',channel:'gmail',metadata:{recipient:'buyer@buyer.example',delivery_channel:'gmail-api'}})).status,200);}finally{f.DB.raw.close();}
});
test('manual CRM commit repeats the durable unknown check after a clean preflight',async()=>{
 const f=await fixture();try{assert.equal((await f.status()).status,200);const prepare=f.DB.prepare.bind(f.DB),batch=f.DB.batch.bind(f.DB);f.DB.prepare=sql=>{const statement=prepare(sql);statement.deliverySql=sql;return statement;};let raced=false;f.DB.batch=async rows=>{if(!raced&&rows.some(row=>row.deliverySql?.includes('INSERT OR IGNORE INTO crm_activities'))){raced=true;f.pending('microsoft_mail_messages');}return batch(rows);};const response=await f.activity({channel:'manual',metadata:{delivery_record:{version:1,workspaceId:'storage-w1',record:{recipientEmail:'buyer@buyer.example',deliveryChannel:'gmail-compose'}}}});assert.equal(raced,true);assert.equal(response.status,409);assert.equal((await response.json()).code,'DELIVERY_RECONCILIATION_REQUIRED');assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_activities').get().n,0);}finally{f.DB.raw.close();}
});
test('manual status fails closed on lost access, final-read revocation and unavailable ledgers',async()=>{
 for(const mutation of ['DELETE FROM sessions',"DELETE FROM workspace_members WHERE workspace_id='storage-w1'",'DROP TABLE microsoft_mail_messages']){const f=await fixture();try{const prepare=f.DB.prepare.bind(f.DB);let changed=false;f.DB.prepare=sql=>{const statement=prepare(sql);if(sql.includes('AS unresolved')){const first=statement.first.bind(statement);statement.first=async()=>{if(!changed){changed=true;f.DB.raw.exec(mutation);}return first();};}return statement;};const response=await f.status();assert.ok(response);assert.ok(response.status>=400,mutation);const body=await response.json();assert.notEqual(body.manual_record_allowed,true,mutation);}finally{f.DB.raw.close();}}
});
