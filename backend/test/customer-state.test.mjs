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

test('customer state enforces one megabyte cap',()=>{
  const payload={main:{text:'x'.repeat(MAX_CUSTOMER_STATE_BYTES+100)}};
  assert.ok(customerStateSize(payload)>MAX_CUSTOMER_STATE_BYTES);
  assert.throws(()=>validateCustomerStateWrite(emptyCustomerState('ws'),{expectedVersion:0,schemaVersion:1,payload}),/1 MB/);
});
