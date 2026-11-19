import {monitorConfig} from './monitoring-store.js';

// Only an explicit, evidence-backed threshold pass is an opportunity. Older or
// incomplete assessments remain available in the verification queue.
export const opportunitySql = "(COALESCE(json_extract(assessment_json,'$.relevant'),0)=1 AND COALESCE(json_extract(assessment_json,'$.meetsThreshold'),0)=1)";
export async function findingCounts(env,workspaceId){
 const counts=await env.DB.prepare(`SELECT count(*) total,
 COALESCE(SUM(status='new' AND ${opportunitySql}),0) unread,
 COALESCE(SUM(status='new' AND NOT ${opportunitySql}),0) needsReview,
 COALESCE(SUM(status='reviewed'),0) reviewed,COALESCE(SUM(status='dismissed'),0) dismissed,
 COALESCE(SUM(revision),0) versions,MAX(updated_at) updatedAt
 FROM monitoring_findings WHERE workspace_id=?`).bind(workspaceId).first();
 return {...counts,opportunities:counts.unread,changeToken:JSON.stringify(counts)};
}

export async function monitorStatuses(env,workspaceId){
 const [legacy,named,runs]=await Promise.all([
  env.DB.prepare('SELECT * FROM market_monitoring_configs WHERE workspace_id=?').bind(workspaceId).first(),
  env.DB.prepare('SELECT * FROM monitoring_monitors WHERE workspace_id=? ORDER BY archived,name').bind(workspaceId).all(),
  env.DB.prepare(`WITH history AS (SELECT monitor_id,status,error_message,started_at,completed_at,
   ROW_NUMBER() OVER(PARTITION BY monitor_id ORDER BY started_at DESC,rowid DESC) position,
   MAX(CASE WHEN status='completed' THEN completed_at END) OVER(PARTITION BY monitor_id) last_successful_at
   FROM market_monitoring_runs WHERE workspace_id=?) SELECT * FROM history WHERE position=1`).bind(workspaceId).all()
 ]);
 return [...(legacy?[legacy]:[]),...named.results].map(row=>{
  const config=monitorConfig(row),run=runs.results.find(r=>r.monitor_id===config.id);
  const interrupted=run?.status==='running'&&(!row.lease_id||Date.parse(row.lease_expires_at)<=Date.now());
  return {...config,category_id:row.category_id||config.workflow.categoryId||'',lastSuccessfulAt:run?.last_successful_at||'',
   latestRun:run?{status:interrupted?'failed':run.status,error:interrupted?'lease_expired':run.error_message||'',startedAt:run.started_at,completedAt:run.completed_at||''}:null};
 });
}
