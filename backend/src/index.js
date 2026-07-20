import {allowedOrigin,corsHeaders,sha256,randomToken,constantTimeEqual,cookieValue,sessionCookie,clearSessionCookie} from "./security.js";
import {canonicalSnapshot,ingestCanonicalSnapshot} from "./canonical.js";
import {assessCandidate,compileQueries} from "./quality.js";

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
