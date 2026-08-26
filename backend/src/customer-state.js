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
  const actual=Number(current?.version)||0;const expected=Number(expectedVersion)||0;if(actual!==expected)return {conflict:true,current};
  return {conflict:false,next:{schema_version:Math.max(1,Number(schemaVersion)||1),version:actual+1,payload:normalized}};
}
export async function getCustomerState(env,workspaceId){
  const row=await env.DB.prepare('SELECT workspace_id,schema_version,version,payload_json,updated_at FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();
  if(!row)return emptyCustomerState(workspaceId);
  let payload={};try{payload=normalizeCustomerPayload(JSON.parse(row.payload_json||'{}'));}catch{}
  return {workspace_id:row.workspace_id,schema_version:Number(row.schema_version)||1,version:Number(row.version)||1,payload,updated_at:row.updated_at||null};
}
export async function putCustomerState(env,{workspaceId,userId,expectedVersion,schemaVersion,payload}){
  const current=await getCustomerState(env,workspaceId);const decision=validateCustomerStateWrite(current,{expectedVersion,schemaVersion,payload});if(decision.conflict)return decision;
  const next=decision.next;let result;
  if(current.version===0){
    result=await env.DB.prepare(`INSERT OR IGNORE INTO customer_workspace_state(workspace_id,schema_version,version,payload_json,updated_by,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(workspaceId,next.schema_version,next.version,JSON.stringify(next.payload),userId).run();
  }else{
    result=await env.DB.prepare(`UPDATE customer_workspace_state SET schema_version=?,version=version+1,payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND version=?`).bind(next.schema_version,JSON.stringify(next.payload),userId,workspaceId,current.version).run();
  }
  if(Number(result?.meta?.changes||0)<1)return {conflict:true,current:await getCustomerState(env,workspaceId)};
  return {conflict:false,state:await getCustomerState(env,workspaceId)};
}