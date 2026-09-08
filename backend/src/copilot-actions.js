import {getCustomerState,putCustomerState} from './customer-state.js';
import {assertModelSafe,redactProtectedData} from './copilot-security.js';

export const COPILOT_ACTION_TYPES=Object.freeze(['signal.add','signal.update','icp.update_field']);
const ACTIONS=new Set(COPILOT_ACTION_TYPES);
const SIGNAL_FIELDS=new Set(['name','description','keywords','weight','priority','active']);
const ICP_FIELDS=new Set(['name','criteria','industries','company_size','geography','buyer_roles','pain_points','exclusions','priority']);
const OPERATING_ROLES=new Set(['owner','researcher','sales']);
const uuid=()=>crypto.randomUUID();
function clean(value,max=2000){return String(value??'').replace(/\s+/g,' ').trim().slice(0,max);}
function validId(value){return /^[A-Za-z0-9._:-]{1,180}$/.test(String(value||''));}
function validIdempotency(value){return /^[A-Za-z0-9._:-]{8,128}$/.test(String(value||''));}
function clone(value){return JSON.parse(JSON.stringify(value??{}));}
function marketFrom(state){return state?.main?.market&&typeof state.main.market==='object'?state.main.market:{};}
function normalizeKeywords(value){return (Array.isArray(value)?value:[]).map(item=>clean(item,120)).filter(Boolean).slice(0,20);}
function normalizeWeight(value){const n=Number(value);if(!Number.isFinite(n))throw new Error('Signal weight must be a number');return Math.max(0,Math.min(100,Math.round(n)));}
function normalizePriority(value){const p=clean(value,40).toLowerCase();if(!['low','medium','high','critical'].includes(p))throw new Error('Signal priority is not allowed');return p;}
function normalizeSignalFields(source,{forAdd=false}={}){
  const out={};for(const [key,value] of Object.entries(source||{})){
    if(!SIGNAL_FIELDS.has(key))throw new Error(`Signal change field is not allowed: ${key}`);
    if(key==='keywords')out.keywords=normalizeKeywords(value);
    else if(key==='weight')out.weight=normalizeWeight(value);
    else if(key==='priority')out.priority=normalizePriority(value);
    else if(key==='active')out.active=Boolean(value);
    else out[key]=clean(value,key==='description'?2400:240);
  }
  if(forAdd&&!clean(out.name,240))throw new Error('Signal name is required');return out;
}
function safeIcpValue(field,value){
  if(['industries','buyer_roles','pain_points'].includes(field)){const values=Array.isArray(value)?value:[value];return values.map(item=>clean(item,300)).filter(Boolean).slice(0,30);}
  return clean(value,field==='criteria'||field==='exclusions'?3000:500);
}
function previewSignal(signal){if(!signal)return null;return {id:clean(signal.id,180),name:clean(signal.name,240),keywords:normalizeKeywords(signal.keywords),weight:Number(signal.weight)||0,priority:clean(signal.priority,40),active:signal.active!==false};}
function previewIcp(icp,field){return icp?{id:clean(icp.id,180),field,value:icp[field]??null}:null;}

export function normalizeActionProposal(candidate,context={}){
  const source=candidate&&typeof candidate==='object'&&!Array.isArray(candidate)?candidate:{};const action_type=clean(source.action_type||source.actionType,80);
  if(!ACTIONS.has(action_type))throw new Error('Copilot action is not allowed or is prohibited');
  const rawPayload=source.payload&&typeof source.payload==='object'&&!Array.isArray(source.payload)?source.payload:{};assertModelSafe(rawPayload);const state=context.state||{};const market=marketFrom(state);
  let payload,preview;
  if(action_type==='signal.add'){
    const signalSource=rawPayload.signal&&typeof rawPayload.signal==='object'&&!Array.isArray(rawPayload.signal)?rawPayload.signal:{};const id=clean(signalSource.id||rawPayload.signal_id,180);if(id&&!validId(id))throw new Error('Signal id is invalid');
    const safe=normalizeSignalFields(Object.fromEntries(Object.entries(signalSource).filter(([key])=>key!=='id')),{forAdd:true});payload={signal:{id:id||`copilot-signal-${Date.now()}`,...safe}};preview={before:null,after:previewSignal(payload.signal)};
  }else if(action_type==='signal.update'){
    const signalId=clean(rawPayload.signal_id,180);if(!validId(signalId))throw new Error('Signal id is required');const changes=normalizeSignalFields(rawPayload.changes||{});if(!Object.keys(changes).length)throw new Error('At least one safe signal change is required');
    const existing=(Array.isArray(market.signals)?market.signals:[]).find(item=>String(item?.id)===signalId);if(!existing)throw new Error('Signal was not found');payload={signal_id:signalId,changes};preview={before:previewSignal(existing),after:previewSignal({...existing,...changes})};
  }else{
    const icpId=clean(rawPayload.icp_id,180),field=clean(rawPayload.field,80);if(!validId(icpId))throw new Error('ICP id is required');if(!ICP_FIELDS.has(field))throw new Error('ICP field is not allowed');const existing=(Array.isArray(market.icps)?market.icps:[]).find(item=>String(item?.id)===icpId);if(!existing)throw new Error('ICP was not found');const value=safeIcpValue(field,rawPayload.value);payload={icp_id:icpId,field,value};preview={before:previewIcp(existing,field),after:{id:icpId,field,value}};
  }
  const normalized={action_type,payload:redactProtectedData(payload),preview:redactProtectedData(preview)};assertModelSafe(normalized);return normalized;
}

export async function createActionProposal(env,{workspaceId,userId,conversationId=null,expectedStateVersion=0,idempotencyKey,candidate,state}){
  if(!validIdempotency(idempotencyKey))throw new Error('A valid action idempotency key is required');const normalized=normalizeActionProposal(candidate,{state});
  const existing=await env.DB.prepare(`SELECT * FROM copilot_action_proposals WHERE workspace_id=? AND idempotency_key=?`).bind(workspaceId,idempotencyKey).first();if(existing)return rowProposal(existing);
  const id=uuid();await env.DB.prepare(`INSERT INTO copilot_action_proposals(id,workspace_id,conversation_id,proposed_by,action_type,status,payload_json,preview_json,result_json,idempotency_key,expected_state_version) VALUES(?,?,?,?,?,'proposed',?,?,?, ?,?)`).bind(id,workspaceId,conversationId,userId||null,normalized.action_type,JSON.stringify(normalized.payload),JSON.stringify(normalized.preview),JSON.stringify({}),idempotencyKey,Math.max(0,Number(expectedStateVersion)||0)).run();
  return rowProposal(await env.DB.prepare(`SELECT * FROM copilot_action_proposals WHERE id=? AND workspace_id=?`).bind(id,workspaceId).first());
}
function rowProposal(row){if(!row)return null;let payload={},preview={},result={};try{payload=JSON.parse(row.payload_json||'{}');}catch{}try{preview=JSON.parse(row.preview_json||'{}');}catch{}try{result=JSON.parse(row.result_json||'{}');}catch{}return {id:row.id,workspace_id:row.workspace_id,action_type:row.action_type,status:row.status,payload,preview,result,idempotency_key:row.idempotency_key,expected_state_version:Number(row.expected_state_version)||0,created_at:row.created_at,updated_at:row.updated_at};}
function ensureMarket(payload){if(!payload.main||typeof payload.main!=='object')payload.main={};if(!payload.main.market||typeof payload.main.market!=='object')payload.main.market={};return payload.main.market;}
function applyProposal(payload,proposal){
  const next=clone(payload);const market=ensureMarket(next);const action=proposal.action_type,data=proposal.payload;
  if(action==='signal.add'){
    if(!Array.isArray(market.signals))market.signals=[];if(market.signals.some(item=>String(item?.id)===String(data.signal.id)))throw new Error('Signal already exists');market.signals.push(clone(data.signal));
  }else if(action==='signal.update'){
    if(!Array.isArray(market.signals))throw new Error('Signal was not found');const index=market.signals.findIndex(item=>String(item?.id)===data.signal_id);if(index<0)throw new Error('Signal was not found');market.signals[index]={...market.signals[index],...clone(data.changes)};
  }else if(action==='icp.update_field'){
    if(!Array.isArray(market.icps))throw new Error('ICP was not found');const index=market.icps.findIndex(item=>String(item?.id)===data.icp_id);if(index<0)throw new Error('ICP was not found');market.icps[index]={...market.icps[index],[data.field]:clone(data.value)};
  }
  return next;
}
async function audit(env,{workspaceId,userId,proposal}){await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(uuid(),workspaceId,userId,'copilot.action_applied','copilot_action_proposal',proposal.id,JSON.stringify({proposal_id:proposal.id,action_type:proposal.action_type})).run();}

export async function executeConfirmedAction(env,{workspaceId,userId,role,proposalId,idempotencyKey}){
  if(!OPERATING_ROLES.has(clean(role,40).toLowerCase()))throw new Error('Workspace role is not permitted to confirm Copilot actions');if(!validIdempotency(idempotencyKey))throw new Error('A valid action idempotency key is required');
  const row=await env.DB.prepare(`SELECT * FROM copilot_action_proposals WHERE id=? AND workspace_id=?`).bind(proposalId,workspaceId).first();if(!row)throw new Error('Copilot action proposal not found');const proposal=rowProposal(row);if(proposal.idempotency_key!==idempotencyKey)throw new Error('Action confirmation idempotency key does not match proposal');
  if(proposal.status==='applied')return {applied:true,duplicate:true,proposal_id:proposal.id,result:proposal.result};if(!['proposed','confirmed'].includes(proposal.status))throw new Error(`Copilot action proposal cannot be applied from status ${proposal.status}`);
  const current=await getCustomerState(env,workspaceId);if(Number(current.version)!==Number(proposal.expected_state_version))return {applied:false,conflict:true,proposal_id:proposal.id,currentVersion:Number(current.version)||0,expectedVersion:proposal.expected_state_version};
  let nextPayload;try{nextPayload=applyProposal(current.payload,proposal);}catch(cause){return {applied:false,error:clean(cause?.message||cause,200),proposal_id:proposal.id};}
  await env.DB.prepare(`UPDATE copilot_action_proposals SET status='confirmed',confirmed_by=?,confirmed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND status='proposed'`).bind(userId||null,proposal.id,workspaceId).run();
  const written=await putCustomerState(env,{workspaceId,userId,expectedVersion:current.version,schemaVersion:current.schema_version,payload:nextPayload});if(written.conflict)return {applied:false,conflict:true,proposal_id:proposal.id,currentVersion:Number(written.current?.version)||0,expectedVersion:current.version};
  const result={state_version:written.state.version,action_type:proposal.action_type};await env.DB.prepare(`UPDATE copilot_action_proposals SET status='applied',result_json=?,applied_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(JSON.stringify(result),proposal.id,workspaceId).run();await audit(env,{workspaceId,userId,proposal});
  return {applied:true,duplicate:false,proposal_id:proposal.id,result};
}
