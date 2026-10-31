import {messageBatch} from './message-operation-authority.js';
import {WORKSPACE_RECORD_CODEC,MAX_WORKSPACE_TRANSFER_BYTES,preparePayloadRecord,payloadRecordWrites,payloadRecordCleanup,readStoredPayload,readOwnedPayload} from './workspace-record-store.js';
import {flowProjectionStatements} from './saved-flow-store.js';
import {validatePlatformOriginalScriptsWrite} from './original-scripts-policy.js';
import stateBudget from '../../customer/state-budget.js';
export const MAX_CUSTOMER_STATE_BYTES=500*1024;
const ALLOWED_KEYS=new Set(['main','discovery','outreach','delivery','meta']);
const encoder=new TextEncoder();

function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
export function normalizeCustomerPayload(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Customer state payload must be an object');
  const out={};for(const [key,value] of Object.entries(payload)){if(ALLOWED_KEYS.has(key))out[key]=object(value);}
  return out;
}
export function customerStateSize(payload){return encoder.encode(JSON.stringify(payload)).byteLength;}
export function emptyCustomerState(workspaceId){return {workspace_id:String(workspaceId||''),schema_version:1,version:0,payload:{},updated_at:null};}
export function validateCustomerStateWrite(current,{expectedVersion,schemaVersion,payload,maxBytes=MAX_CUSTOMER_STATE_BYTES}){
  if(payload?.format==='leadintel-workspace-records-v1')throw Error('Stored workspace references cannot be submitted as customer state');
  const normalized=normalizeCustomerPayload(payload);const size=customerStateSize(normalized);if(size>maxBytes)throw new Error(maxBytes===MAX_CUSTOMER_STATE_BYTES?'Customer state exceeds 500 KB limit':'Workspace exceeds the 8 MB transfer limit');
  stateBudget.restoreFromSync(normalized); // Reject malformed references before persisting them.
  const actual=Number(current?.version)||0;const expected=Number(expectedVersion)||0;if(actual!==expected)return {conflict:true,current};
  return {conflict:false,next:{schema_version:Math.max(1,Number(schemaVersion)||1),version:actual+1,payload:normalized}};
}
export async function getCustomerState(env,workspaceId){
  let row=await env.DB.prepare('SELECT workspace_id,schema_version,version,payload_json,updated_at FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();
  if(!row)return {...emptyCustomerState(workspaceId),state_codec:'workspace-sections-v1',bundle_codec:'workspace-bundle-v1',compression_codec:'workspace-lzw-v2',record_codec:WORKSPACE_RECORD_CODEC,max_sync_bytes:MAX_WORKSPACE_TRANSFER_BYTES};
  const owned=await readOwnedPayload(env,workspaceId,row);row=owned.row;const payload=normalizeCustomerPayload(owned.payload);
  return {workspace_id:row.workspace_id,schema_version:Number(row.schema_version)||1,version:Number(row.version)||1,payload,record_backed:JSON.parse(row.payload_json||'{}')?.format==='leadintel-workspace-records-v1',updated_at:row.updated_at||null,state_codec:'workspace-sections-v1',bundle_codec:'workspace-bundle-v1',compression_codec:'workspace-lzw-v2',record_codec:WORKSPACE_RECORD_CODEC,max_sync_bytes:MAX_WORKSPACE_TRANSFER_BYTES};
}
export async function putCustomerState(env,{workspaceId,userId,expectedVersion,schemaVersion,payload,role,allowFlowSwitch=false,operationContext=null,operationAssertions=[]}){
  const current=await getCustomerState(env,workspaceId);const decision=validateCustomerStateWrite(current,{expectedVersion,schemaVersion,payload,maxBytes:MAX_WORKSPACE_TRANSFER_BYTES});if(decision.conflict)return decision;
  const restored=stateBudget.restoreFromSync(decision.next.payload);
  if(!allowFlowSwitch&&current.payload?.main?.myFlow?.id!==restored.main?.myFlow?.id&&(current.payload?.main?.myFlow?.id||restored.main?.myFlow?.id))throw new Error('Open a flow through My Flows before changing the active flow');
  await validatePlatformOriginalScriptsWrite(env,current.payload,restored,userId);
  const next=decision.next,record=await preparePayloadRecord(next.payload,{forceRecords:current.record_backed===true}),encoded=record.encoded;
  const projection=await flowProjectionStatements(env,workspaceId,current.payload,restored,encoded,next.version);
  const guardSql=projection.guard?' AND EXISTS(SELECT 1 FROM saved_flows WHERE workspace_id=? AND id=? AND revision=?)':'';
  const guardArgs=projection.guard?[workspaceId,projection.guard.id,projection.guard.revision]:[];
  let statement;
  if(current.version===0){
    statement=env.DB.prepare(`INSERT OR IGNORE INTO customer_workspace_state(workspace_id,schema_version,version,payload_json,updated_by,updated_at) SELECT ?,?,?,?,?,CURRENT_TIMESTAMP WHERE 1=1${guardSql}`).bind(workspaceId,next.schema_version,next.version,encoded,userId,...guardArgs);
  }else{
    statement=env.DB.prepare(`UPDATE customer_workspace_state SET schema_version=?,version=version+1,payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND version=?${guardSql}`).bind(next.schema_version,encoded,userId,workspaceId,current.version,...guardArgs);
  }
  const chunks=payloadRecordWrites(env,workspaceId,record,'EXISTS(SELECT 1 FROM customer_workspace_state WHERE workspace_id=? AND version=? AND payload_json=?)',[workspaceId,next.version,encoded]);
  const writes=[statement,...projection.writes];
  if(record.chunks.length||current.record_codec&&customerStateSize(current.payload)>384*1024)writes.push(payloadRecordCleanup(env,workspaceId));
  writes.push(...chunks);
  const result=operationContext?(await messageBatch(env,operationContext,writes,operationAssertions)).slice(-writes.length)[0]:writes.length>1?(await env.DB.batch(writes))[0]:await statement.run();
  if(Number(result?.meta?.changes||0)<1)return {conflict:true,current:await getCustomerState(env,workspaceId)};
  // Return the revision this CAS committed, never a later writer's payload.
  return {conflict:false,state:{workspace_id:workspaceId,...next,updated_at:null}};
}
