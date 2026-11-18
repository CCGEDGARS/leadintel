import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {storageDb} from './workspace-storage-fixture.mjs';
import {sha256} from '../src/security.js';
import {handleSavedFlowRoute} from '../src/saved-flow-routes.js';
import {getCustomerState,putCustomerState} from '../src/customer-state.js';
import {decode,savedFlowPayload} from '../src/saved-flow-store.js';
import {getFlowVersion,versionWrite} from '../src/saved-flow-versions.js';
import {preparePayloadRecord,payloadRecordWrites,payloadRecordCleanup} from '../src/workspace-record-store.js';
const ws='storage-w1',user='storage-owner';
const original={main:{website:'https://seller.test',targetMarkets:['Sweden'],profile:{companyName:'Seller',priorityOffers:'Equipment'},answers:{buyer_roles:'COO'},brandIdentity:{senderName:'Original sender'},step:5},outreach:{messageStudio:{mode:'professional',myTemplates:[{id:'mine',body:'Exact saved wording\nSecond line'}],essentials:{language:'sv'}}},discovery:{pipeline:[{company:'Retained company',people:[{name:'Known buyer'}]}]},delivery:{history:[{status:'sent',recipient:'buyer@example.test'}]}};
async function fixture(){const DB=storageDb();await DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").bind(await sha256('versions'),user).run();await DB.prepare('INSERT INTO customer_workspace_state(workspace_id,payload_json,version) VALUES(?,?,1)').bind(ws,JSON.stringify(original)).run();return {DB};}
async function call(env,id='',body,workspace=ws){return handleSavedFlowRoute(new Request('https://api.test/api/flows'+(id?'/'+id:'')+'?workspace_id='+workspace,{method:body?'POST':'GET',headers:{Cookie:'leadintel_session=versions','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);}
async function ok(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
async function create(env,name='Sweden'){const state=await getCustomerState(env,ws);return ok(await call(env,'',{action:'create',name,workspaceVersion:state.version}));}
const row=(env,id)=>env.DB.raw.prepare('SELECT * FROM saved_flows WHERE id=?').get(id);
async function open(env,id){const state=await getCustomerState(env,ws);return (await ok(await call(env,id,{action:'open',revision:row(env,id).revision,workspaceVersion:state.version}))).state;}
async function save(env,state){const result=await putCustomerState(env,{workspaceId:ws,userId:user,expectedVersion:state.version,schemaVersion:1,payload:state.payload,role:'owner'});assert.equal(result.conflict,false);return result.state;}
test('create, edit, switch and authenticated reopen keep exact workflow settings, scripts and progress independent',async()=>{
 const env=await fixture(),a=await create(env);assert.equal(row(env,a.id).snapshot_policy,'pinned');assert.equal(row(env,a.id).latest_version,1);
 let state=await open(env,a.id);state.payload.discovery.pipeline.push({company:'New progress'});state=await save(env,state);
 const b=await create(env,'Norway');state=await open(env,b.id);state.payload.main.website='https://different.test';state.payload.main.brandIdentity.senderName='Other sender';state.payload.outreach.messageStudio.myTemplates[0].body='Different script';state=await save(env,state);
 const reopened=await open(env,a.id);assert.equal(reopened.payload.main.website,original.main.website);assert.equal(reopened.payload.main.brandIdentity.senderName,'Original sender');assert.equal(reopened.payload.outreach.messageStudio.myTemplates[0].body,'Exact saved wording\nSecond line');assert.equal(reopened.payload.discovery.pipeline.length,2);
 assert.equal((await getCustomerState(env,ws)).payload.main.myFlow.id,a.id);assert.equal(row(env,a.id).status,'paused');assert.equal(row(env,b.id).status,'paused');
 const version=await getFlowVersion(env,ws,a.id,1);assert.equal(version.payload.discovery.pipeline.length,1);assert.equal(version.payload.outreach.messageStudio.myTemplates[0].body,'Exact saved wording\nSecond line');
});
test('explicit checkpoint is immutable; an older version creates a paused independent copy without rewinding original progress',async()=>{
 const env=await fixture(),a=await create(env);let state=await open(env,a.id);state.payload.outreach.messageStudio.myTemplates[0].body='Owner changed wording';state=await save(env,state);
 const result=await ok(await call(env,a.id,{action:'checkpoint',revision:row(env,a.id).revision,workspaceVersion:state.version}));assert.equal(result.savedVersion,2);
 assert.throws(()=>env.DB.raw.prepare("UPDATE saved_flow_versions SET payload_json='{}' WHERE flow_id=?").run(a.id),/immutable/);
 assert.equal((await getFlowVersion(env,ws,a.id,1)).payload.outreach.messageStudio.myTemplates[0].body,'Exact saved wording\nSecond line');
 const copy=await ok(await call(env,a.id,{action:'restore-version',revision:row(env,a.id).revision,version:1,name:'Recovered settings'}));const copied=row(env,copy.id),payload=await savedFlowPayload(env,copied);
 assert.equal(copied.status,'paused');assert.equal(copied.approved_at,null);assert.equal(copied.approvals_json,'{}');assert.equal(payload.outreach.messageStudio.myTemplates[0].body,'Exact saved wording\nSecond line');assert.deepEqual(payload.discovery,{});assert.deepEqual(payload.delivery,{});
 assert.equal((await getCustomerState(env,ws)).payload.outreach.messageStudio.myTemplates[0].body,'Owner changed wording');assert.equal((await getCustomerState(env,ws)).payload.delivery.history[0].status,'sent');
});
test('duplicate preserves exact custom settings while clearing buyers, queues and approvals',async()=>{
 const env=await fixture(),a=await create(env),copy=await ok(await call(env,a.id,{action:'duplicate',revision:1,name:'Finland',markets:['Finland']})),payload=await savedFlowPayload(env,row(env,copy.id));
 assert.deepEqual(payload.main.targetMarkets,['Finland']);assert.equal(payload.outreach.messageStudio.myTemplates[0].body,original.outreach.messageStudio.myTemplates[0].body);assert.deepEqual(payload.discovery,{});assert.deepEqual(payload.delivery,{});assert.equal(row(env,copy.id).status,'paused');assert.equal(row(env,copy.id).latest_version,1);assert.equal((await getFlowVersion(env,ws,a.id,1)).payload.main.targetMarkets[0],'Sweden');
});
test('versions are scoped; stale checkpoint and nonowners cannot change or recover another workspace',async()=>{
 const env=await fixture(),a=await create(env);await open(env,a.id);
 assert.equal((await call(env,a.id,undefined,'storage-w2')).status,404);
 await assert.rejects(getFlowVersion(env,'storage-w2',a.id,1),/not found/);
 assert.equal((await call(env,a.id,{action:'checkpoint',revision:row(env,a.id).revision,workspaceVersion:0})).status,409);
 env.DB.raw.prepare("UPDATE workspace_members SET role='sales' WHERE workspace_id=?").run(ws);
 assert.equal((await call(env,a.id,{action:'checkpoint',revision:row(env,a.id).revision,workspaceVersion:2})).status,403);
 assert.equal(row(env,a.id).latest_version,1);
});
test('quota rejection rolls back version creation and preserves every existing version and working payload',async()=>{
 const env=await fixture(),a=await create(env),state=await open(env,a.id),before=row(env,a.id);
 env.DB.raw.prepare('UPDATE workspace_storage_accounts SET included_records_limit=records_bytes+1 WHERE workspace_id=?').run(ws);
 const response=await call(env,a.id,{action:'checkpoint',revision:before.revision,workspaceVersion:state.version});assert.equal(response.status,507,await response.clone().text());assert.equal(row(env,a.id).latest_version,1);assert.equal(row(env,a.id).payload_json,before.payload_json);assert.equal(env.DB.raw.prepare('SELECT count(*) AS n FROM saved_flow_versions WHERE flow_id=?').get(a.id).n,1);
});
test('garbage collection retains large immutable version payloads even after the working flow changes',async()=>{
 const env=await fixture(),a=await create(env),payload={main:{notes:randomBytes(220000).toString('hex')}};
 const record=await preparePayloadRecord(payload,{forceRecords:true});assert.ok(record.chunks.length>1);
 await env.DB.batch([...payloadRecordWrites(env,ws,record,'1=1'),versionWrite(env,{workspaceId:ws,flowId:a.id,version:2,name:'Large version',payload:record.encoded,config:'{}',userId:user})]);
 await payloadRecordCleanup(env,ws).run();assert.deepEqual((await getFlowVersion(env,ws,a.id,2)).payload,payload);
 // Old workers must not erase chunks referenced only by a protected version.
 await env.DB.prepare('DELETE FROM workspace_payload_records WHERE workspace_id=?').bind(ws).run();assert.deepEqual((await getFlowVersion(env,ws,a.id,2)).payload,payload);
 const other=await preparePayloadRecord({main:{unused:'orphan'}},{forceRecords:true});await env.DB.batch(payloadRecordWrites(env,ws,other,'1=1'));await payloadRecordCleanup(env,ws).run();assert.equal(env.DB.raw.prepare('SELECT count(*) AS n FROM workspace_payload_records WHERE snapshot_id=?').get(other.snapshot).n,0);
});
test('checkpoint rejects session revocation at transaction boundary without producing a version',async()=>{
 const env=await fixture(),a=await create(env),state=await open(env,a.id),batch=env.DB.batch.bind(env.DB);let armed=true;
 env.DB.batch=async writes=>{if(armed){armed=false;env.DB.raw.exec('DELETE FROM sessions');}return batch(writes);};
 const response=await call(env,a.id,{action:'checkpoint',revision:row(env,a.id).revision,workspaceVersion:state.version});assert.ok([401,403,409].includes(response.status));assert.equal(row(env,a.id).latest_version,1);
});
test('a trusted saved original can reopen while ordinary browser writes cannot edit platform originals',async()=>{
 const env=await fixture(),key='email:professional:lv',reference={body:'Saved reference wording',locked:true,revision:1,history:[]};
 const seeded=structuredClone(original);seeded.outreach.messageStudio.originalScripts={[key]:reference};
 env.DB.raw.prepare('UPDATE customer_workspace_state SET payload_json=? WHERE workspace_id=?').run(JSON.stringify(seeded),ws);
 const a=await create(env);let state=await open(env,a.id);
 state.payload.outreach.messageStudio.originalScripts[key].body='Unauthorized rewrite';
 await assert.rejects(save(env,state),/Only the platform owner/);
 // Simulate a later platform reference stored outside this saved workflow.
 const different=structuredClone(seeded);different.outreach.messageStudio.originalScripts[key].body='Later reference';
 env.DB.raw.prepare('UPDATE customer_workspace_state SET payload_json=?,version=version+1 WHERE workspace_id=?').run(JSON.stringify(different),ws);
 state=await open(env,a.id);
 assert.deepEqual(state.payload.outreach.messageStudio.originalScripts[key],reference);
 state.payload.outreach.messageStudio.originalScripts[key].body='Another unauthorized rewrite';
 await assert.rejects(save(env,state),/Only the platform owner/);
});
