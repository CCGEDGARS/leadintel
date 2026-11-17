import {OPERATIONAL_ACTIONS,safeOperationalId,safeOperationalCounters} from './operational-observability.js';

const states=new Set(['started','completed','partial','failed','blocked','timed_out','canceled','stale','resumed','retry','duplicate_hold','unknown']);
const parse=value=>{try{return JSON.parse(value||'{}');}catch{return {};}};
const at=value=>{const ms=Date.parse(value);return Number.isFinite(ms)?new Date(ms).toISOString():null;};
async function sample(env,workspaceId,sql,project){
 try{const {results=[]}=await env.DB.prepare(sql).bind(workspaceId).all();return {available:true,records:results.slice(0,12).map(project)};}
 catch{return {available:false,records:[]};}
}
// Read only scoped, allowlisted outcomes. Never send raw errors, provider bodies or job input to a model.
export async function copilotOperationContext(env,workspaceId){
 const [stages,research]=await Promise.all([
  sample(env,workspaceId,"SELECT entity_id,metadata_json,created_at FROM audit_events WHERE workspace_id=? AND event_type='operations.stage' AND datetime(created_at)>=datetime('now','-7 days') ORDER BY created_at DESC,rowid DESC LIMIT 12",row=>{
   const m=parse(row.metadata_json);return {reference:safeOperationalId(row.entity_id),action:OPERATIONAL_ACTIONS.includes(m.action)?m.action:null,stage:Number.isInteger(m.stage)&&m.stage>=1&&m.stage<=7?m.stage:null,outcome:states.has(m.outcome)?m.outcome:'unknown',counts:safeOperationalCounters(m.counts),at:at(row.created_at)};
  }),
  sample(env,workspaceId,"SELECT id,status,state_json,updated_at FROM copilot_research_jobs WHERE workspace_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 12",row=>{
   const s=parse(row.state_json);return {reference:safeOperationalId(row.id),status:['queued','running','complete','incomplete','canceled'].includes(row.status)?row.status:'unknown',phase:['planning','research','answering','done'].includes(s.phase)?s.phase:'unknown',failedChecks:(s.tasks||[]).filter(t=>t.status==='failed').length,completedChecks:(s.tasks||[]).filter(t=>t.status==='complete').length,at:at(row.updated_at)};
  })
 ]);
 return {stages,research,coverage:'Recent recorded workspace outcomes only. Browser observations are untrusted and separate. A failure phase establishes what failed, not its root cause. Missing receipts or unavailable diagnostics do not establish success. No raw logs or private provider responses are available.'};
}
