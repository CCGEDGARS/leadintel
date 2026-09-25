import {allowedOrigin,corsHeaders,sha256,randomToken,constantTimeEqual,cookieValue,sessionCookie,clearSessionCookie} from "./security.js";
import {canonicalSnapshot,ingestCanonicalSnapshot} from "./canonical.js";
import {assessCandidate,compileQueries} from "./quality.js";
import {listRuns,policyFor,recordRunEvent,runBudgetState,validDispatchUrl} from "./runs.js";
import {APOLLO_PEOPLE_SEARCH_URL,apolloSearchBody,enrichmentDecision,normalizeDomain,provenBusinessEmail,publicPersonSummary,rankApolloPeople,strongPersonalEmail} from "./enrichment.js";
import {creditFailure,recordProviderCredit} from "./provider-credit-health.js";

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
  if(url.pathname==="/api/enrichment-policy"&&request.method==="GET") {
    const policy=await env.DB.prepare("SELECT provider,minimum_score,daily_credit_limit,monthly_credit_limit,retry_after_days,allow_personal_email,phone_lookup_mode FROM enrichment_policies WHERE workspace_id=?").bind(workspaceId).first();
    const daily=await env.DB.prepare("SELECT COALESCE(SUM(credits_reserved),0) value FROM enrichment_requests WHERE workspace_id=? AND created_at>=date('now') AND status!='cancelled'").bind(workspaceId).first();
    const monthly=await env.DB.prepare("SELECT COALESCE(SUM(credits_reserved),0) value FROM enrichment_requests WHERE workspace_id=? AND created_at>=date('now','start of month') AND status!='cancelled'").bind(workspaceId).first();
    return json({policy,usage:{daily:Number(daily?.value)||0,monthly:Number(monthly?.value)||0},configured:Boolean(env.APOLLO_API_KEY),personal_email_mode:policy?.allow_personal_email?"owner_approval":"disabled",personal_email_default:false,phone_numbers:false,phone_lookup_mode:policy?.phone_lookup_mode||"on_request"},200,cors);
  }
  const enrichmentMatch=url.pathname.match(/^\/api\/opportunities\/([^/]+)\/enrich$/);
  if(enrichmentMatch&&request.method==="POST") {
    if(!["owner","researcher"].includes(membership.role))return error("Write access required",403,cors);
    const opportunityId=decodeURIComponent(enrichmentMatch[1]);const body=await request.json().catch(()=>({}));
    const record=await env.DB.prepare(`SELECT o.id,o.company_id,o.score_10,o.decision_maker_role,c.canonical_name,c.domain,c.website_url,
      (SELECT COUNT(*) FROM evidence_items e WHERE e.company_id=o.company_id) evidence_count,
      (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id=o.company_id AND ct.email_status IN ('Verified','Strong match')) verified_contacts
      FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE o.id=? AND o.workspace_id=?`).bind(opportunityId,workspaceId).first();
    if(!record)return error("Opportunity not found",404,cors);
    const policy=await env.DB.prepare("SELECT * FROM enrichment_policies WHERE workspace_id=?").bind(workspaceId).first();
    const personalApproved=Boolean(body.allow_personal_email)&&membership.role==="owner"&&Boolean(policy.allow_personal_email);
    if(body.allow_personal_email&&membership.role!=="owner")return error("Only the workspace owner can approve a personal-email exception",403,cors);
    const recent=await env.DB.prepare("SELECT id,status,personal_email_requested,created_at FROM enrichment_requests WHERE opportunity_id=? AND created_at>=datetime('now',?) ORDER BY created_at DESC LIMIT 1")
      .bind(opportunityId,`-${Number(policy.retry_after_days)||30} days`).first();
    const daily=await env.DB.prepare("SELECT COALESCE(SUM(credits_reserved),0) value FROM enrichment_requests WHERE workspace_id=? AND created_at>=date('now') AND status!='cancelled'").bind(workspaceId).first();
    const monthly=await env.DB.prepare("SELECT COALESCE(SUM(credits_reserved),0) value FROM enrichment_requests WHERE workspace_id=? AND created_at>=date('now','start of month') AND status!='cancelled'").bind(workspaceId).first();
    const domain=normalizeDomain(record.domain||record.website_url);
    const recentBlocks=recent&&!(personalApproved&&recent.status==="not_found"&&!recent.personal_email_requested);
    const decision=enrichmentDecision({score:record.score_10,evidenceCount:record.evidence_count,verifiedContact:Number(record.verified_contacts)>0,domain,recentRequest:recentBlocks?recent:null,dailyReserved:daily?.value,monthlyReserved:monthly?.value,policy});
    if(body.validate)return json({decision,configured:Boolean(env.APOLLO_API_KEY),company:record.canonical_name,domain,role:record.decision_maker_role||"Commercial Director",personal_email_requested:personalApproved,personal_email_mode:policy.allow_personal_email?"owner_approval":"disabled",phone_numbers:false},200,cors);
    if(!decision.allowed)return json({error:"Enrichment blocked by quality or credit controls",code:decision.reason},409,cors);
    if(!env.APOLLO_API_KEY)return json({error:"Apollo API connection is not configured",code:"apollo_not_configured"},503,cors);
    const requestId=`ENR-${uuid()}`;const role=record.decision_maker_role||"Commercial Director";
    await env.DB.prepare(`INSERT INTO enrichment_requests(id,workspace_id,opportunity_id,company_id,status,role_requested,requested_by,personal_email_requested)
      VALUES(?,?,?,?,?,?,?,?)`).bind(requestId,workspaceId,opportunityId,record.company_id,"processing",role,user.id,personalApproved?1:0).run();
    try{
      const searchResponse=await fetch(APOLLO_PEOPLE_SEARCH_URL,{method:"POST",headers:{"Content-Type":"application/json","Cache-Control":"no-cache","Accept":"application/json","X-Api-Key":env.APOLLO_API_KEY},body:JSON.stringify(apolloSearchBody({domain,roles:[role]}))});
      if(!searchResponse.ok){const detail=await searchResponse.clone().text().catch(()=>"");if(creditFailure(searchResponse.status,detail.slice(0,800)))await recordProviderCredit(env,{workspaceId,userId:user.id,provider:'apollo',kind:'failed',source:'managed'});throw Object.assign(new Error(`Apollo search returned ${searchResponse.status}`),{code:`apollo_search_${searchResponse.status}`});}
      const search=await searchResponse.json();const rankedPeople=rankApolloPeople(search.people||[],role);const candidate=rankedPeople[0];const personId=String(candidate?.id||candidate?.person_id||"");
      if(!personId){
        await env.DB.prepare("UPDATE enrichment_requests SET status='not_found',credits_reserved=0,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,response_summary_json=? WHERE id=?")
          .bind(JSON.stringify({search_results:Array.isArray(search.people)?search.people.length:0}),requestId).run();
        return json({request:{id:requestId,status:"not_found",credits_used:0},contact:null},200,cors);
      }
      const matchUrl=new URL("https://api.apollo.io/api/v1/people/match");matchUrl.searchParams.set("id",personId);matchUrl.searchParams.set("reveal_personal_emails",personalApproved?"true":"false");matchUrl.searchParams.set("reveal_phone_number","false");matchUrl.searchParams.set("run_waterfall_email","false");matchUrl.searchParams.set("run_waterfall_phone","false");
      const matchResponse=await fetch(matchUrl,{method:"POST",headers:{"Content-Type":"application/json","Cache-Control":"no-cache","Accept":"application/json","X-Api-Key":env.APOLLO_API_KEY}});
      if(!matchResponse.ok){const detail=await matchResponse.clone().text().catch(()=>"");if(creditFailure(matchResponse.status,detail.slice(0,800)))await recordProviderCredit(env,{workspaceId,userId:user.id,provider:'apollo',kind:'failed',source:'managed'});throw Object.assign(new Error(`Apollo match returned ${matchResponse.status}`),{code:`apollo_match_${matchResponse.status}`});}
      await recordProviderCredit(env,{workspaceId,userId:user.id,provider:'apollo',kind:'recovered',source:'managed'});
      const matched=await matchResponse.json();const person=matched.person||{};const businessEmail=provenBusinessEmail(person,domain);const personalEmail=personalApproved?strongPersonalEmail(person,domain,role,personId):"";const selectedEmail=businessEmail||personalEmail;const emailType=businessEmail?"work":"personal";const emailStatus=businessEmail?"Verified":"Strong match";const summary=publicPersonSummary(person);
      if(!selectedEmail){
        await env.DB.prepare("UPDATE enrichment_requests SET status='not_found',credits_used=1,person_provider_id=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,response_summary_json=? WHERE id=?")
          .bind(personId,JSON.stringify(summary),requestId).run();
        return json({request:{id:requestId,status:"not_found",credits_used:1},contact:null,reason:"verified_company_email_not_returned"},200,cors);
      }
      const fullName=String(person.name||[person.first_name,person.last_name].filter(Boolean).join(" ")||"Verified decision-maker");
      const contactId=`ct_${(await sha256(`${workspaceId}|${selectedEmail}`)).slice(0,24)}`;
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO contacts(id,workspace_id,company_id,full_name,normalized_name,role,business_email,email_status,verification_provider,verified_at,linkedin_url,email_type,match_confidence)
          VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?) ON CONFLICT(workspace_id,business_email) DO UPDATE SET full_name=excluded.full_name,role=excluded.role,email_status=excluded.email_status,verification_provider='Apollo',verified_at=CURRENT_TIMESTAMP,linkedin_url=excluded.linkedin_url,email_type=excluded.email_type,match_confidence=excluded.match_confidence,updated_at=CURRENT_TIMESTAMP`)
          .bind(contactId,workspaceId,record.company_id,fullName,fullName.toLowerCase(),String(person.title||role),selectedEmail,emailStatus,"Apollo",String(person.linkedin_url||""),emailType,businessEmail?"verified":"high"),
        env.DB.prepare("UPDATE enrichment_requests SET status='verified',credits_used=1,person_provider_id=?,contact_id=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,response_summary_json=? WHERE id=?")
          .bind(personId,contactId,JSON.stringify(summary),requestId)
      ]);
      await audit(env,{workspaceId,userId:user.id,type:"contact.verified",entityType:"contact",entityId:contactId,metadata:{provider:"Apollo",opportunity_id:opportunityId,credits_used:1,email_type:emailType,match_confidence:businessEmail?"verified":"high",personal_email_owner_approved:personalApproved,phone_numbers:false}});
      return json({request:{id:requestId,status:"verified",credits_used:1},contact:{id:contactId,name:fullName,role:String(person.title||role),email:selectedEmail,email_type:emailType,email_status:emailStatus,match_confidence:businessEmail?"verified":"high",provider:"Apollo",linkedin_url:String(person.linkedin_url||"")}},201,cors);
    }catch(cause){
      const code=String(cause?.code||"apollo_failed");const message=String(cause?.message||"Apollo enrichment failed");
      await env.DB.prepare("UPDATE enrichment_requests SET status='failed',credits_reserved=0,error_code=?,error_message=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(code,message,requestId).run();
      await audit(env,{workspaceId,userId:user.id,type:"enrichment.failed",entityType:"enrichment_request",entityId:requestId,metadata:{code}});
      return json({error:message,code,request:{id:requestId,status:"failed"}},502,cors);
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
    const existing=await env.DB.prepare("SELECT id,company_id,status,pipeline_stage,next_action,notes FROM opportunities WHERE id=? AND workspace_id=?").bind(opportunityId,workspaceId).first();
    if(!existing)return error("Opportunity not found",404,cors);
    let companyDomain;
    if(body.company_domain!==undefined){
      companyDomain=normalizeDomain(body.company_domain);
      if(!companyDomain||companyDomain.length>253)return error("Enter a valid company domain",400,cors);
      await env.DB.prepare("UPDATE companies SET domain=?,website_url=CASE WHEN website_url='' THEN ? ELSE website_url END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?")
        .bind(companyDomain,`https://${companyDomain}`,existing.company_id,workspaceId).run();
    }
    const updated={status:status||existing.status,pipeline_stage:stage||existing.pipeline_stage,next_action:body.next_action===undefined?existing.next_action:nextAction,notes:body.notes===undefined?existing.notes:notes};
    await env.DB.prepare("UPDATE opportunities SET status=?,pipeline_stage=?,next_action=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?")
      .bind(updated.status,updated.pipeline_stage,updated.next_action,updated.notes,opportunityId,workspaceId).run();
    await audit(env,{workspaceId,userId:user.id,type:"opportunity.workflow_updated",entityType:"opportunity",entityId:opportunityId,metadata:{...updated,company_domain:companyDomain}});
    return json({id:opportunityId,...updated,company_domain:companyDomain},200,cors);
  }
  if(url.pathname==="/api/audit"&&request.method==="GET") {
    const {results}=await env.DB.prepare("SELECT id,event_type,entity_type,entity_id,metadata_json,created_at FROM audit_events WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100").bind(workspaceId).all();
    return json({events:results.map(row=>({...row,metadata:JSON.parse(row.metadata_json)}))},200,cors);
  }
  return error("Not found",404,cors);
}

export default {fetch(request,env){return router(request,env).catch(cause=>{console.error(cause);return error("Internal server error",500,corsHeaders(allowedOrigin(request,env.APP_ORIGIN)));});}};
