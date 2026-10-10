import {flowProjectionStatements} from './saved-flow-store.js';
import {validateOriginalScriptsWrite} from './original-scripts-policy.js';
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
export function validateCustomerStateWrite(current,{expectedVersion,schemaVersion,payload}){
  const normalized=normalizeCustomerPayload(payload);const size=customerStateSize(normalized);if(size>MAX_CUSTOMER_STATE_BYTES)throw new Error('Customer state exceeds 500 KB limit');
  stateBudget.restoreFromSync(normalized); // Reject malformed references before persisting them.
  const actual=Number(current?.version)||0;const expected=Number(expectedVersion)||0;if(actual!==expected)return {conflict:true,current};
  return {conflict:false,next:{schema_version:Math.max(1,Number(schemaVersion)||1),version:actual+1,payload:normalized}};
}
export async function getCustomerState(env,workspaceId){
  const row=await env.DB.prepare('SELECT workspace_id,schema_version,version,payload_json,updated_at FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();
  if(!row)return {...emptyCustomerState(workspaceId),state_codec:'workspace-sections-v1'};
  const payload=stateBudget.restoreFromSync(normalizeCustomerPayload(JSON.parse(row.payload_json||'{}')));
  return {workspace_id:row.workspace_id,schema_version:Number(row.schema_version)||1,version:Number(row.version)||1,payload,updated_at:row.updated_at||null,state_codec:'workspace-sections-v1'};
}
export async function putCustomerState(env,{workspaceId,userId,expectedVersion,schemaVersion,payload,role,allowFlowSwitch=false}){
  const current=await getCustomerState(env,workspaceId);const decision=validateCustomerStateWrite(current,{expectedVersion,schemaVersion,payload});if(decision.conflict)return decision;
  const restored=stateBudget.restoreFromSync(decision.next.payload);
  if(!allowFlowSwitch&&current.payload?.main?.myFlow?.id!==restored.main?.myFlow?.id&&(current.payload?.main?.myFlow?.id||restored.main?.myFlow?.id))throw new Error('Open a flow through My Flows before changing the active flow');
  const before=current.payload?.outreach?.messageStudio?.originalScripts||{},after=restored?.outreach?.messageStudio?.originalScripts||{};if(JSON.stringify(before)!==JSON.stringify(after)){const member=role?{role}:await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();validateOriginalScriptsWrite(current.payload,restored,member?.role);}
  const next=decision.next,encoded=JSON.stringify(next.payload);
  const projection=await flowProjectionStatements(env,workspaceId,current.payload,restored,encoded,next.version);
  const guardSql=projection.guard?' AND EXISTS(SELECT 1 FROM saved_flows WHERE workspace_id=? AND id=? AND revision=?)':'';
  const guardArgs=projection.guard?[workspaceId,projection.guard.id,projection.guard.revision]:[];
  let statement;
  if(current.version===0){
    statement=env.DB.prepare(`INSERT OR IGNORE INTO customer_workspace_state(workspace_id,schema_version,version,payload_json,updated_by,updated_at) SELECT ?,?,?,?,?,CURRENT_TIMESTAMP WHERE 1=1${guardSql}`).bind(workspaceId,next.schema_version,next.version,encoded,userId,...guardArgs);
  }else{
    statement=env.DB.prepare(`UPDATE customer_workspace_state SET schema_version=?,version=version+1,payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND version=?${guardSql}`).bind(next.schema_version,encoded,userId,workspaceId,current.version,...guardArgs);
  }
  const result=projection.writes.length?(await env.DB.batch([statement,...projection.writes]))[0]:await statement.run();
  if(Number(result?.meta?.changes||0)<1)return {conflict:true,current:await getCustomerState(env,workspaceId)};
  // Return the revision this CAS committed, never a later writer's payload.
  return {conflict:false,state:{workspace_id:workspaceId,...next,updated_at:null}};
}
