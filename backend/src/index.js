import {allowedOrigin,corsHeaders,sha256,randomToken,constantTimeEqual,cookieValue,sessionCookie,clearSessionCookie} from "./security.js";
import {canonicalSnapshot,ingestCanonicalSnapshot} from "./canonical.js";
import {assessCandidate,compileQueries} from "./quality.js";
import {listRuns,policyFor,recordRunEvent,runBudgetState,validDispatchUrl} from "./runs.js";

const json = (value,status=200,headers={}) => new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
const error = (message,status,headers) => json({error:message},status,headers);
const uuid = () => crypto.randomUUID();

async function sessionUser(request, env) {
  const token=cookieValue(request,"leadintel_session"); if(!token)return null;
  const tokenHash=await sha256(token);
  return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at
    FROM sessions JOIN users ON users.id=sessions.user_id
    WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();
}

async function audit(env,{workspaceId=null,userId=null,type,entityType=null,entityId=null,metadata={}}) {
  await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json)
    VALUES(?,?,?,?,?,?,?)`).bind(uuid(),workspaceId,userId,type,entityType,entityId,JSON.stringify(metadata)).run();
}

async function router(request,env) {
  const url=new URL(request.url); const origin=allowedOrigin(request,env.APP_ORIGIN); const cors=corsHeaders(origin);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.headers.get("Origin")&&!origin)return error("Origin not allowed",403,cors);

  if(url.pathname==="/api/health")return json({status:"ok",service:"leadintel-api"},200,cors);
  if(!url.pathname.startsWith("/api/"))return env.ASSETS.fetch(request);

  if(url.pathname==="/api/login"&&request.method==="POST") {
    const body=await request.json().catch(()=>({}));
    if(!constantTimeEqual(body.email||"",env.ADMIN_EMAIL||"")||!constantTimeEqual(body.password||"",env.ADMIN_PASSWORD||"")) {
      await audit(env,{type:"auth.login_failed",metadata:{email:String(body.email||"").slice(0,120)}});
      return error("Invalid email or password",401,cors);
    }
    const user=await env.DB.prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE").bind(env.ADMIN_EMAIL).first();
    if(!user)return error("Owner account has not been initialized",503,cors);
    const token=randomToken(); const tokenHash=await sha256(token); const hours=Math.max(1,Number(env.SESSION_TTL_HOURS)||168);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at<=datetime('now')"),
      env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now',?))").bind(tokenHash,user.id,`+${hours} hours`),
      env.DB.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id)
    ]);
    await audit(env,{userId:user.id,type:"auth.login_succeeded"});
    return json({user:{id:user.id,email:user.email,name:user.display_name,role:user.role}},200,{...cors,"Set-Cookie":sessionCookie(token,hours*3600)});
  }

  const user=await sessionUser(request,env);
  if(url.pathname==="/api/session")return user?json({authenticated:true,user:{id:user.id,email:user.email,name:user.display_name,role:user.role}},200,cors):json({authenticated:false},401,cors);
  if(!user)return error("Authentication required",401,cors);

  if(url.pathname==="/api/logout"&&request.method==="POST") {
    const token=cookieValue(request,"leadintel_session"); if(token)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
    await audit(env,{userId:user.id,type:"auth.logout"});
    return json({ok:true},200,{...cors,"Set-Cookie":clearSessionCookie});
  }

  const workspaceId=url.searchParams.get("workspace_id")||"edgars-latvia";
  const membership=await env.DB.prepare("SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?").bind(workspaceId,user.id).first();
  if(!membership)return error("Workspace access denied",403,cors);

  if(url.pathname==="/api/snapshot"&&request.method==="GET") {
    const canonical=await canonicalSnapshot(env,workspaceId);if(canonical)return json(canonical,200,cors);
    const record=await env.DB.prepare("SELECT payload_json FROM snapshots WHERE workspace_id=? ORDER BY created_at DESC LIMIT 1").bind(workspaceId).first();
    return record?json(JSON.parse(record.payload_json),200,cors):error("No workspace snapshot",404,cors);
  }
  if(url.pathname==="/api/snapshot"&&request.method==="POST") {
    if(!["owner","researcher"].includes(membership.role))return error("Write access required",403,cors);
    const payload=await request.json().catch(()=>null);
    if(!payload||!Array.isArray(payload.opportunities))return error("A snapshot with opportunities is required",400,cors);
    const snapshotId=uuid(); const generatedAt=String(payload.generated_at||new Date().toISOString());
    await env.DB.prepare("INSERT INTO snapshots(id,workspace_id,schema_version,payload_json,generated_at,created_by) VALUES(?,?,?,?,?,?)")
      .bind(snapshotId,workspaceId,Number(payload.schema_version)||1,JSON.stringify(payload),generatedAt,user.id).run();
    const canonical=await ingestCanonicalSnapshot(env,workspaceId,payload);
    const runId=String(payload.run_id||payload.opportunities.find(item=>item?.run_id)?.run_id||"").trim();
    if(runId){
      const matchingRun=await env.DB.prepare("SELECT id FROM research_runs WHERE id=? AND workspace_id=?").bind(runId,workspaceId).first();
      if(matchingRun){
        await env.DB.prepare("UPDATE research_runs SET status='completed',candidates_used=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,error_code=NULL,error_message=NULL WHERE id=?")
          .bind(Math.max(0,Number(canonical.input_rows)||payload.opportunities.length),runId).run();
        await recordRunEvent(env,runId,"run.completed",{opportunities:payload.opportunities.length,canonical});
      }
    }
    await audit(env,{workspaceId,userId:user.id,type:"snapshot.created",entityType:"snapshot",entityId:snapshotId,metadata:{opportunities:payload.opportunities.length,...canonical}});
    return json({id:snapshotId,opportunities:payload.opportunities.length,canonical},201,cors);
  }
  if(url.pathname==="/api/quality/compile"&&request.method==="POST") {
    const body=await request.json().catch(()=>null);if(!body)return error("Query families are required",400,cors);
    return json({queries:compileQueries(body)},200,cors);
  }
  if(url.pathname==="/api/quality/evaluate"&&request.method==="POST") {
    const body=await request.json().catch(()=>null);if(!body?.candidate)return error("A candidate is required",400,cors);
    return json(assessCandidate(body.candidate,body.context||{}),200,cors);
  }
  if(url.pathname==="/api/run-policy"&&request.method==="GET") {
    const policy=await policyFor(env,workspaceId);
    const budget=await runBudgetState(env,workspaceId,policy,false);
    return json({policy,budget},200,cors);
  }
  if(url.pathname==="/api/runs"&&request.method==="GET")return json({runs:await listRuns(env,workspaceId)},200,cors);
  if(url.pathname==="/api/runs"&&request.method==="POST") {
    if(!["owner","researcher"].includes(membership.role))return error("Write access required",403,cors);
    const body=await request.json().catch(()=>null);
    if(!body||!validDispatchUrl(body.dispatch_url))return error("A valid Make webhook URL is required",400,cors);
    const idempotencyKey=String(request.headers.get("Idempotency-Key")||body.idempotency_key||"").trim();
    if(idempotencyKey.length<16||idempotencyKey.length>128)return error("A valid idempotency key is required",400,cors);
    const existing=await env.DB.prepare("SELECT id,status,created_at,accepted_at,error_code,error_message FROM research_runs WHERE workspace_id=? AND idempotency_key=?").bind(workspaceId,idempotencyKey).first();
    if(existing)return json({run:existing,duplicate:true},200,cors);
    const test=Boolean(body.test);const policy=await policyFor(env,workspaceId);const budget=await runBudgetState(env,workspaceId,policy,test);
    if(!budget.allowed)return json({error:"Run blocked by cost controls",code:budget.reason,retry_after:budget.retryAfter||null,policy},429,{...cors,"Retry-After":String(budget.retryAfter||60)});
    const runId=`RUN-${new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14)}-${uuid().slice(0,8)}`;
    const candidateBudget=test?0:budget.candidateBudget;
    const payload={...(body.payload||{}),workspace_id:workspaceId,run_id:runId,test,cost_controls:{candidate_budget:candidateBudget,daily_run_limit:policy.daily_run_limit,monthly_candidate_limit:policy.monthly_candidate_limit}};
    await env.DB.prepare(`INSERT INTO research_runs(id,workspace_id,idempotency_key,status,test,candidate_budget,request_json,requested_by,deadline_at)
      VALUES(?,?,?,?,?,?,?,?,datetime('now','+20 minutes'))`).bind(runId,workspaceId,idempotencyKey,"dispatching",test?1:0,candidateBudget,JSON.stringify(payload),user.id).run();
    await recordRunEvent(env,runId,"run.created",{candidate_budget:candidateBudget,test});
    if(test){
      const dispatchHost=new URL(body.dispatch_url).hostname;
      await env.DB.prepare("UPDATE research_runs SET status='completed',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,response_json=? WHERE id=?")
        .bind(JSON.stringify({validated:true,dispatch_url_host:dispatchHost}),runId).run();
      await recordRunEvent(env,runId,"connection.validated",{dispatch_url_host:dispatchHost,cost:0});
      await audit(env,{workspaceId,userId:user.id,type:"research_run.connection_validated",entityType:"research_run",entityId:runId,metadata:{cost:0}});
      return json({run:{id:runId,status:"completed",candidate_budget:0,test:true},validated:true,cost:0,policy},200,cors);
    }
    let response;
    try{
      response=await fetch(body.dispatch_url,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","X-LeadIntel-Run-ID":runId},body:JSON.stringify(payload),signal:AbortSignal.timeout(policy.dispatch_timeout_ms)});
      const responseText=await response.text();
      if(!response.ok)throw Object.assign(new Error(`Make returned ${response.status}`),{code:`make_${response.status}`,safeToRetry:response.status===429||response.status>=500,responseText});
      await env.DB.prepare("UPDATE research_runs SET status='accepted',attempts=1,response_json=?,accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({status:response.status,body:responseText.slice(0,2000)}),runId).run();
      await recordRunEvent(env,runId,"dispatch.accepted",{status:response.status});
      await audit(env,{workspaceId,userId:user.id,type:"research_run.accepted",entityType:"research_run",entityId:runId,metadata:{candidate_budget:candidateBudget,test}});
      return json({run:{id:runId,status:"accepted",candidate_budget:candidateBudget},duplicate:false,policy},202,cors);
    }catch(cause){
      const timedOut=cause?.name==="TimeoutError"||cause?.name==="AbortError";const code=timedOut?"dispatch_timeout":String(cause?.code||"dispatch_failed");
      const status=timedOut?"timed_out":"failed";const message=timedOut?"Make did not confirm receipt before the safety timeout":String(cause?.message||"Make dispatch failed");
      await env.DB.prepare("UPDATE research_runs SET status=?,attempts=1,error_code=?,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,code,message,runId).run();
      await recordRunEvent(env,runId,`dispatch.${status}`,{code,message,automatic_retry:false});
      await audit(env,{workspaceId,userId:user.id,type:`research_run.${status}`,entityType:"research_run",entityId:runId,metadata:{code,automatic_retry:false}});
      return json({error:message,code,run:{id:runId,status},automatic_retry:false},timedOut?504:502,cors);
    }
  }
  const opportunityMatch=url.pathname.match(/^\/api\/opportunities\/([^/]+)$/);
  if(opportunityMatch&&request.method==="PATCH") {
    if(!["owner","researcher"].includes(membership.role))return error("Write access required",403,cors);
    const opportunityId=decodeURIComponent(opportunityMatch[1]);
    const body=await request.json().catch(()=>null);
    if(!body||typeof body!=="object")return error("A workflow update is required",400,cors);
    const allowedStages=["Discovered","Qualified","Contact Found","Ready for Outreach","Contacted","Replied","Meeting","Proposal","Won","Lost"];
    const stage=String(body.pipeline_stage??"").trim();
    const status=String(body.status??"").trim();
    const nextAction=String(body.next_action??"").trim();
    const notes=String(body.notes??"").trim();
    if(stage&&!allowedStages.includes(stage))return error("Invalid pipeline stage",400,cors);
    if(status.length>80||nextAction.length>500||notes.length>5000)return error("Workflow field is too long",400,cors);
    const existing=await env.DB.prepare("SELECT id,status,pipeline_stage,next_action,notes FROM opportunities WHERE id=? AND workspace_id=?").bind(opportunityId,workspaceId).first();
    if(!existing)return error("Opportunity not found",404,cors);
    const updated={status:status||existing.status,pipeline_stage:stage||existing.pipeline_stage,next_action:body.next_action===undefined?existing.next_action:nextAction,notes:body.notes===undefined?existing.notes:notes};
    await env.DB.prepare("UPDATE opportunities SET status=?,pipeline_stage=?,next_action=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?")
      .bind(updated.status,updated.pipeline_stage,updated.next_action,updated.notes,opportunityId,workspaceId).run();
    await audit(env,{workspaceId,userId:user.id,type:"opportunity.workflow_updated",entityType:"opportunity",entityId:opportunityId,metadata:updated});
    return json({id:opportunityId,...updated},200,cors);
  }
  if(url.pathname==="/api/audit"&&request.method==="GET") {
    const {results}=await env.DB.prepare("SELECT id,event_type,entity_type,entity_id,metadata_json,created_at FROM audit_events WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100").bind(workspaceId).all();
    return json({events:results.map(row=>({...row,metadata:JSON.parse(row.metadata_json)}))},200,cors);
  }
  return error("Not found",404,cors);
}

export default {fetch(request,env){return router(request,env).catch(cause=>{console.error(cause);return error("Internal server error",500,corsHeaders(allowedOrigin(request,env.APP_ORIGIN)));});}};
