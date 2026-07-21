const activeStatuses=["dispatching","accepted","running"];
const makeWebhookHosts=/^hook\.(eu1|eu2|us1|us2)\.make\.com$/i;

export function validDispatchUrl(value){
  try{const url=new URL(String(value||""));return url.protocol==="https:"&&makeWebhookHosts.test(url.hostname)&&url.pathname.length>20;}
  catch{return false;}
}

export function normalizePolicy(row={}){
  const value=(name,fallback)=>{const parsed=Number(row[name]);return Number.isFinite(parsed)?parsed:fallback;};
  return {
    daily_run_limit:value("daily_run_limit",3),
    monthly_candidate_limit:value("monthly_candidate_limit",90),
    per_run_candidate_limit:value("per_run_candidate_limit",3),
    cooldown_seconds:value("cooldown_seconds",300),
    dispatch_timeout_ms:value("dispatch_timeout_ms",12000)
  };
}

export function budgetDecision({policy,dailyRuns=0,monthlyCandidates=0,activeRun=null,lastRunAt=null,now=Date.now(),test=false}){
  if(test)return {allowed:true,reason:"test_run",candidateBudget:0};
  if(activeRun)return {allowed:false,reason:"run_in_progress",retryAfter:60};
  if(dailyRuns>=policy.daily_run_limit)return {allowed:false,reason:"daily_run_limit",retryAfter:3600};
  if(monthlyCandidates+policy.per_run_candidate_limit>policy.monthly_candidate_limit)return {allowed:false,reason:"monthly_candidate_limit",retryAfter:86400};
  if(lastRunAt){const elapsed=Math.max(0,Math.floor((now-new Date(lastRunAt).getTime())/1000));if(elapsed<policy.cooldown_seconds)return {allowed:false,reason:"cooldown",retryAfter:policy.cooldown_seconds-elapsed};}
  return {allowed:true,reason:"within_budget",candidateBudget:policy.per_run_candidate_limit};
}

export async function policyFor(env,workspaceId){
  const row=await env.DB.prepare("SELECT * FROM run_policies WHERE workspace_id=?").bind(workspaceId).first();
  return normalizePolicy(row||{});
}

export async function runBudgetState(env,workspaceId,policy,test=false){
  const active=await env.DB.prepare(`SELECT id,status,created_at FROM research_runs WHERE workspace_id=? AND status IN ('dispatching','accepted','running') AND deadline_at>datetime('now') ORDER BY created_at DESC LIMIT 1`).bind(workspaceId).first();
  const daily=await env.DB.prepare("SELECT COUNT(*) count FROM research_runs WHERE workspace_id=? AND test=0 AND created_at>=date('now')").bind(workspaceId).first();
  const monthly=await env.DB.prepare("SELECT COALESCE(SUM(candidate_budget),0) candidates FROM research_runs WHERE workspace_id=? AND test=0 AND created_at>=date('now','start of month') AND status NOT IN ('failed','cancelled')").bind(workspaceId).first();
  const last=await env.DB.prepare("SELECT created_at FROM research_runs WHERE workspace_id=? AND test=0 ORDER BY created_at DESC LIMIT 1").bind(workspaceId).first();
  return budgetDecision({policy,dailyRuns:Number(daily?.count)||0,monthlyCandidates:Number(monthly?.candidates)||0,activeRun:active,lastRunAt:last?.created_at,test});
}

export async function listRuns(env,workspaceId,limit=25){
  const {results}=await env.DB.prepare(`SELECT id,created_at started,status,candidate_budget,candidates_used,attempts,error_code,error_message,accepted_at,completed_at,test
    FROM research_runs WHERE workspace_id=? ORDER BY created_at DESC LIMIT ?`).bind(workspaceId,limit).all();
  return results.map(row=>({id:row.id,started:row.started,status:row.status,candidate_budget:row.candidate_budget,candidates_used:row.candidates_used,attempts:row.attempts,error_code:row.error_code,error_message:row.error_message,accepted_at:row.accepted_at,completed_at:row.completed_at,test:Boolean(row.test),findings:row.candidates_used,qualified:0,saved:0,emailed:0,errors:row.error_code?1:0}));
}

export async function recordRunEvent(env,runId,eventType,details={}){
  await env.DB.prepare("INSERT INTO run_events(id,run_id,event_type,details_json) VALUES(?,?,?,?)").bind(crypto.randomUUID(),runId,eventType,JSON.stringify(details)).run();
}

export const runStatusIsActive=status=>activeStatuses.includes(status);
