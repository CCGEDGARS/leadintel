import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {storageDb} from './workspace-storage-fixture.mjs';
import {getCustomerState,putCustomerState} from '../src/customer-state.js';
import {currentPayload} from '../src/saved-flow-store.js';
const workspaceId='storage-w1',userId='storage-owner';
const large=()=>({main:{website:'https://seller.example',profile:{companyName:'Seller'}},discovery:{candidates:[{company:'Buyer',domain:'buyer.example',evidence:[{url:'https://buyer.example/about',text:randomBytes(420000).toString('base64')+' Rīga 😀'}]}]},outreach:{selectedBuyer:{email:'buyer@buyer.example'}},meta:{persistence:{explicit_saved:true}}});

test('research above 500 KB saves outside the workspace row and hydrates every field',async()=>{
 const DB=storageDb(),env={DB},payload=large();
 const result=await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload});
 assert.equal(result.conflict,false);
 assert.deepEqual((await getCustomerState(env,workspaceId)).payload,payload);
 assert.deepEqual(await currentPayload(env,workspaceId),payload);
 const row=DB.raw.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').get(workspaceId);
 assert.ok(Buffer.byteLength(row.payload_json)<500*1024);
 assert.ok(DB.raw.prepare('SELECT count(*) n FROM workspace_payload_records WHERE workspace_id=?').get(workspaceId).n>1);
 const other=await getCustomerState(env,'storage-w2');assert.deepEqual(other.payload,{});
});

test('large research quota failure leaves previous workspace and storage counters untouched',async()=>{
 const DB=storageDb(),env={DB};
 await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload:{main:{website:'https://seller.example'}}});
 const before=await getCustomerState(env,workspaceId),used=DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes;
 DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=? WHERE workspace_id=?').run(used+10000,workspaceId);
 await assert.rejects(putCustomerState(env,{workspaceId,userId,expectedVersion:1,payload:large()}),/WORKSPACE_STORAGE_FULL/);
 assert.deepEqual(await getCustomerState(env,workspaceId),before);
 assert.equal(DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes,used);
});

test('a CAS loser cannot insert orphan research or replace the winner',async()=>{
 const DB=storageDb(),env={DB},payload=large();
 await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload:{main:{website:'https://seller.example'}}});
 const batch=DB.batch.bind(DB);let raced=false;
 DB.batch=async statements=>{if(!raced){raced=true;DB.raw.prepare('UPDATE customer_workspace_state SET version=2,payload_json=? WHERE workspace_id=?').run(JSON.stringify({main:{winner:true}}),workspaceId);}return batch(statements);};
 const result=await putCustomerState(env,{workspaceId,userId,expectedVersion:1,payload});
 assert.equal(result.conflict,true);assert.equal(result.current.payload.main.winner,true);
 assert.equal(DB.raw.prepare('SELECT count(*) n FROM workspace_payload_records').get().n,0);
});

test('saved-flow projection and inactive snapshots survive record cleanup',async()=>{
 const {decode}=await import('../src/saved-flow-store.js');
 const DB=storageDb(),env={DB},payload=large();payload.main.myFlow={id:'flow-one'};
 DB.raw.prepare("INSERT INTO saved_flows(id,workspace_id,name) VALUES('flow-one',?,'First')").run(workspaceId);
 await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload,allowFlowSwitch:true});
 const flow=DB.raw.prepare("SELECT * FROM saved_flows WHERE id='flow-one'").get();
 assert.deepEqual(await decode(flow,env),payload);
 // An inactive flow must keep its own research even after the active workspace changes.
 const second={main:{website:'https://seller.example'},discovery:{notes:'A different workspace view'}};
 await putCustomerState(env,{workspaceId,userId,expectedVersion:1,payload:second,allowFlowSwitch:true});
 assert.deepEqual(await decode(flow,env),payload);assert.deepEqual((await getCustomerState(env,workspaceId)).payload,second);
});

test('new research snapshots replace unreferenced chunks and release their metered bytes',async()=>{
 const DB=storageDb(),env={DB},first=large(),second=large();
 await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload:first});
 const firstId=JSON.parse(DB.raw.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').get(workspaceId).payload_json).snapshot;
 await putCustomerState(env,{workspaceId,userId,expectedVersion:1,payload:second});
 assert.equal(DB.raw.prepare('SELECT count(*) n FROM workspace_payload_records WHERE snapshot_id=?').get(firstId).n,0);
 const chunks=DB.raw.prepare('SELECT sum(length(CAST(content AS BLOB))) n FROM workspace_payload_records').get().n;
 const used=DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes;
 assert.ok(used>=chunks&&used<chunks+1024);assert.deepEqual((await getCustomerState(env,workspaceId)).payload,second);
});

test('missing, foreign and altered payload chunks fail closed rather than hydrating empty data',async()=>{
 const {readStoredPayload}=await import('../src/workspace-record-store.js');
 const DB=storageDb(),env={DB};await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload:large()});
 const encoded=DB.raw.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').get(workspaceId).payload_json;
 await assert.rejects(readStoredPayload(env,'storage-w2',encoded),/incomplete/);
 await assert.rejects(putCustomerState(env,{workspaceId:'storage-w2',userId,expectedVersion:0,payload:JSON.parse(encoded)}),/references cannot/);
 DB.raw.prepare('DELETE FROM workspace_payload_records WHERE workspace_id=? AND part_index=0').run(workspaceId);
 await assert.rejects(getCustomerState(env,workspaceId),/incomplete/);
});

test('replacing a snapshot near quota uses final retained bytes, not old plus new evidence',async()=>{
 const DB=storageDb(),env={DB},first=large(),second=large();
 await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload:first});
 const used=DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes;
 DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=? WHERE workspace_id=?').run(used+5000,workspaceId);
 assert.equal((await putCustomerState(env,{workspaceId,userId,expectedVersion:1,payload:second})).conflict,false);
 assert.deepEqual((await getCustomerState(env,workspaceId)).payload,second);
});

test('the authenticated HTTP workspace route saves research above the old request-body ceiling',async()=>{
 const {handleSaasRoute}=await import('../src/saas-routes.js'),{sha256}=await import('../src/security.js');
 const DB=storageDb(),env={DB},payload=large();payload.discovery.notes=randomBytes(650000).toString('base64');
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").run(await sha256('workspace-record-test-session'),userId);
 const body=JSON.stringify({version:0,schema_version:1,payload});
 const response=await handleSaasRoute(new Request('https://api.test/api/customer/state?workspace_id='+workspaceId,{method:'PUT',headers:{Cookie:'leadintel_session=workspace-record-test-session','Content-Type':'application/json','Content-Length':String(Buffer.byteLength(body))},body}),env,{});
 assert.equal(response.status,200,await response.clone().text());
 assert.deepEqual((await getCustomerState(env,workspaceId)).payload,payload);
});

test('a concurrent replacement and cleanup cannot tear manifest reads from their research chunks',async()=>{
 const DB=storageDb(),env={DB},first=large(),second=large();
 await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload:first});
 const prepare=DB.prepare.bind(DB);let raced=false;
 DB.prepare=sql=>{const statement=prepare(sql);if(sql.startsWith('SELECT workspace_id,schema_version,version,payload_json,updated_at FROM customer_workspace_state')){const read=statement.first;statement.first=async()=>{const old=await read();if(!raced){raced=true;await putCustomerState(env,{workspaceId,userId,expectedVersion:1,payload:second});}return old;};}return statement;};
 const result=await getCustomerState(env,workspaceId);
 assert.equal(result.version,2);assert.deepEqual(result.payload,second);
});

test('shrinking separate research near quota does not require an extra inline copy',async()=>{
 const DB=storageDb(),env={DB};await putCustomerState(env,{workspaceId,userId,expectedVersion:0,payload:large()});
 const used=DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes;
 DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=? WHERE workspace_id=?').run(used+1000,workspaceId);
 const payload={main:{website:'https://seller.example'},discovery:{notes:'Kept research '.repeat(10000)}};
 assert.equal((await putCustomerState(env,{workspaceId,userId,expectedVersion:1,payload})).conflict,false);
 assert.deepEqual((await getCustomerState(env,workspaceId)).payload,payload);
 assert.ok(DB.raw.prepare('SELECT records_bytes FROM workspace_storage_accounts WHERE workspace_id=?').get(workspaceId).records_bytes<used);
});
