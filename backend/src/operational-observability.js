// Receipts describe actual handler execution. They never assert delivery,
// provider billing settlement, or the success of work swallowed by a handler.
export const SCHEDULED_TASKS=Object.freeze({
  storage_reconciliation:60,writing_references:60,workspace_skills:60,company_materials:60,language_packs:60,
  market_monitoring:3600,source_health:3600,saved_flows:3600,approved_workflows:3600,
  conversation_poll:3600,conversation_enrollment:3600,conversation_plans:3600,outreach_replies:3600,outreach_delivery:3600
});
export const OPERATIONAL_RETENTION=Object.freeze({days:30,receiptsPerTask:512,stageReceiptsPerWorkspace:1000});
const outcomes=new Set(['started','completed','partial','failed','blocked','timed_out','canceled','stale','resumed','retry','duplicate_hold','unknown']);
const counters=['considered','completed','failed','blocked','held','skipped','sent','rescheduled','queries','sources','qualified','usable','ready','requested','reviewed','persisted','mismatches'];
export const OPERATIONAL_ACTIONS=Object.freeze(['profile','strategy','companies','buyers','triggers','messages','crm','delivery']);
export function safeOperationalId(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value.toLowerCase():null;}
export function safeOperationalCounters(value={}){
  const result={};for(const key of counters){if(Number.isSafeInteger(value?.[key])&&value[key]>=0)result[key]=value[key];}return result;
}
function boundedDuration(value){return Number.isSafeInteger(value)&&value>=0&&value<=86400000?value:null;}
async function append(env,{workspaceId=null,type,entityType,operationId,metadata,cap}){
  const id=crypto.randomUUID();
  // This namespace alone is pruned; customer audit evidence is retained.
  const match=workspaceId===null?'workspace_id IS NULL':'workspace_id=?';
  const scope=workspaceId===null?[]:[workspaceId];
  await env.DB.batch([
    env.DB.prepare('INSERT INTO audit_events(id,workspace_id,event_type,entity_type,entity_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,workspaceId,type,entityType,operationId,JSON.stringify(metadata),new Date().toISOString()),
    env.DB.prepare(`DELETE FROM audit_events WHERE ${match} AND event_type=? AND entity_type=? AND (datetime(created_at)<datetime('now','-30 days') OR id IN (SELECT id FROM audit_events WHERE ${match} AND event_type=? AND entity_type=? ORDER BY created_at DESC,rowid DESC LIMIT -1 OFFSET ?))`).bind(...scope,type,entityType,...scope,type,entityType,cap)
  ]);
}
async function schedulerReceipt(env,task,operationId,outcome,durationMs,scheduledAt){
  try{await append(env,{type:'operations.scheduler',entityType:task,operationId,metadata:{version:1,outcome,durationMs:boundedDuration(durationMs),scheduledAt:new Date(scheduledAt).toISOString()},cap:OPERATIONAL_RETENTION.receiptsPerTask});}
  catch{console.warn('Operational scheduler receipt unavailable');}
}
export async function observeScheduledTask(env,task,operation,{scheduledAt=Date.now()}={}){
  if(!Object.hasOwn(SCHEDULED_TASKS,task))throw Error('Unsupported scheduled task');
  const operationId=crypto.randomUUID(),started=Date.now();
  await schedulerReceipt(env,task,operationId,'started',null,scheduledAt);
  try{
    const result=await operation();
    // A resolved summary may contain failed work; do not relabel it healthy.
    const rows=Array.isArray(result)?result:[result];
    const failed=rows.some(row=>String(row?.status||'').toLowerCase()==='failed'||row?.failed>0);
    const partial=rows.some(row=>['partial','needs attention'].includes(String(row?.status||'').toLowerCase())||row?.accessStatus==='no_access'||row?.accessStatus==='partial'||row?.blocked>0||row?.held>0);
    await schedulerReceipt(env,task,operationId,failed?'failed':partial?'partial':'completed',Date.now()-started,scheduledAt);
    return result;
  }catch(cause){await schedulerReceipt(env,task,operationId,'failed',Date.now()-started,scheduledAt);throw cause;}
}

// Internal hooks only: no route accepts client-supplied telemetry. Do not pass
// customer content, request keys, domains, names, provider bodies or error text.
export async function recordOperationalStage(env,{workspaceId,stage,outcome,durationMs=null,counts={},operationId,runId,contextId,revision,action}={}){
  if(typeof workspaceId!=='string'||!workspaceId||!Number.isInteger(stage)||stage<1||stage>7||!outcomes.has(outcome))throw Error('Invalid operational stage receipt');
  const correlation={operationId:safeOperationalId(operationId)||crypto.randomUUID(),runId:safeOperationalId(runId),contextId:safeOperationalId(contextId),revision:Number.isSafeInteger(revision)&&revision>0?revision:null,action:OPERATIONAL_ACTIONS.includes(action)?action:null};
  try{await append(env,{workspaceId,type:'operations.stage',entityType:'journey',operationId:correlation.operationId,metadata:{version:1,stage,outcome,durationMs:boundedDuration(durationMs),counts:safeOperationalCounters(counts),...correlation},cap:OPERATIONAL_RETENTION.stageReceiptsPerWorkspace});return true;}
  catch{console.warn('Operational stage receipt unavailable');return false;}
}
