import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_CUSTOMER_STATE_BYTES,normalizeCustomerPayload,customerStateSize,emptyCustomerState,validateCustomerStateWrite} from '../src/customer-state.js';

test('normalizeCustomerPayload keeps only approved namespaces',()=>{
  assert.deepEqual(normalizeCustomerPayload({main:{a:1},discovery:{b:2},outreach:{},delivery:{},meta:{x:1},secret:{token:'no'}}),{main:{a:1},discovery:{b:2},outreach:{},delivery:{},meta:{x:1}});
  assert.throws(()=>normalizeCustomerPayload([]),/must be an object/);
});

test('empty state is version zero and writable at expected version zero',()=>{
  const current=emptyCustomerState('ws-1');
  const result=validateCustomerStateWrite(current,{expectedVersion:0,schemaVersion:1,payload:{main:{ok:true}}});
  assert.equal(result.conflict,false);assert.equal(result.next.version,1);assert.deepEqual(result.next.payload.main,{ok:true});
});

test('version mismatch returns conflict without inventing a merge',()=>{
  const current={workspace_id:'ws',version:4,schema_version:1,payload:{main:{server:true}}};
  const result=validateCustomerStateWrite(current,{expectedVersion:3,schemaVersion:1,payload:{main:{client:true}}});
  assert.equal(result.conflict,true);assert.equal(result.current,current);
});

test('customer state enforces the 500 KB cap',()=>{
  assert.equal(MAX_CUSTOMER_STATE_BYTES,500*1024);
  const payload={main:{text:'x'.repeat(MAX_CUSTOMER_STATE_BYTES+100)}};
  assert.ok(customerStateSize(payload)>MAX_CUSTOMER_STATE_BYTES);
  assert.throws(()=>validateCustomerStateWrite(emptyCustomerState('ws'),{expectedVersion:0,schemaVersion:1,payload}),/500 KB/);
});
test('a save acknowledges its own committed revision even if another session writes before the response',async()=>{
 const {putCustomerState}=await import('../src/customer-state.js');let reads=0;
 const env={DB:{prepare(sql){return {bind(...args){return {async first(){reads++;return reads===1?{workspace_id:'w1',schema_version:1,version:3,payload_json:'{"main":{"offer":"Base"}}'}:{workspace_id:'w1',schema_version:1,version:5,payload_json:'{"main":{"offer":"Later other session"}}'};},async run(){assert.match(sql,/WHERE workspace_id=\? AND version=\?/);assert.equal(args.at(-1),3);return {meta:{changes:1}};}};}};}}};
 const result=await putCustomerState(env,{workspaceId:'w1',userId:'u1',expectedVersion:3,schemaVersion:1,payload:{main:{offer:'My committed edit'}}});
 assert.equal(result.conflict,false);assert.equal(result.state.version,4);assert.equal(result.state.payload.main.offer,'My committed edit');
});

test('server reads packed research as business records and applies original-script authorization to packed drafts',async()=>{
 const {default:budget}=await import('../../customer/state-budget.js');const {getCustomerState,putCustomerState}=await import('../src/customer-state.js');
 const report={summary:'Evidence-backed commercial context '.repeat(1800)};
 const original={main:{market:{researchReports:Array.from({length:15},(_,i)=>({...report,id:'report-'+i}))}},outreach:{messageStudio:{originalScripts:{professional:{body:'Protected original'}}}}};
 const wire=budget.prepareForSync(original).payload;
 assert.ok(budget.bytes(wire)<=MAX_CUSTOMER_STATE_BYTES);
 let writes=0;const env={DB:{prepare(sql){return {bind(){return {async first(){return {workspace_id:'w1',version:3,schema_version:1,payload_json:JSON.stringify(wire)};},async run(){writes++;return {meta:{changes:1}};}};}};}}};
 const read=await getCustomerState(env,'w1');assert.deepEqual(read.payload,original);
 const changed=structuredClone(original);changed.outreach.messageStudio.originalScripts.professional.body='Changed';
 await assert.rejects(putCustomerState(env,{workspaceId:'w1',userId:'member',role:'member',expectedVersion:3,payload:budget.prepareForSync(changed).payload}),/owner|original/i);assert.equal(writes,0);
});
