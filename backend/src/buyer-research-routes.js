import {sha256,cookieValue} from './security.js';
import {stmt,startBuyerJob,commandBuyerJob,readBuyerJob,publicBuyerJob} from './buyer-research-store.js';
import {runBuyerResearchJobs} from './buyer-research-runner.js';
import {storageErrorResponse} from './workspace-storage.js';
const json=(value,status,cors)=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...cors}});
async function access(request,env,workspaceId,write=false){
 const token=cookieValue(request,'leadintel_session');if(!token)return {status:401,error:'Authentication required'};
 const sessionTokenHash=await sha256(token),user=await stmt(env,"SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now')",sessionTokenHash).first();
 if(!user)return {status:401,error:'Authentication expired or revoked'};
 const member=await stmt(env,'SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?',workspaceId,user.id).first();
 if(!member||!['owner','researcher','sales'].includes(member.role))return {status:403,error:'Workspace research access denied'};
 return {user:{...user,sessionTokenHash,role:member.role}};
}
export async function handleBuyerResearchRoute(request,env,cors={},ctx){
 const url=new URL(request.url);if(url.pathname!=='/api/buyers/research')return null;
 const workspaceId=url.searchParams.get('workspace_id')||'';
 if(!workspaceId||workspaceId.length>160)return json({error:'Workspace is required'},400,cors);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405,cors);
 const checked=await access(request,env,workspaceId,request.method==='POST');if(checked.error)return json({error:checked.error},checked.status,cors);
 try{
  if(request.method==='GET'){
   const job=await readBuyerJob(env,workspaceId,{id:url.searchParams.get('job_id')||undefined,domain:url.searchParams.get('domain')});
   return json({job:await publicBuyerJob(env,job,{recoverRetained:!url.searchParams.get('job_id')})},200,cors);
  }
  if(Number(request.headers.get('Content-Length')||0)>262144)return json({error:'Buyer context exceeds the request limit'},413,cors);
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body)||new TextEncoder().encode(JSON.stringify(body)).byteLength>262144)return json({error:'A bounded buyer context is required'},400,cors);
  if(!['start','resume','cancel'].includes(body.action||'start'))return json({error:'Unknown buyer research command'},400,cors);
  const current=await access(request,env,workspaceId,true);if(current.error)return json({error:current.error},current.status,cors);
  const row=(body.action||'start')==='start'?await startBuyerJob(env,workspaceId,current.user,body):await commandBuyerJob(env,workspaceId,current.user,body);
  const job=await publicBuyerJob(env,row,{recoverRetained:true});
  // The HTTP response is the durable acknowledgement. A short wake is optional;
  // the minute scheduler remains responsible after the browser goes away.
  if(ctx?.waitUntil&&['queued','running'].includes(row.status))ctx.waitUntil(runBuyerResearchJobs(env,{maxJobs:1,jobId:row.id,windowMs:18000}).catch(()=>{}));
  return json({job},200,cors);
 }catch(cause){return storageErrorResponse(cause,cors)||json({error:cause?.status?String(cause.message).slice(0,220):'Buyer research could not be saved. Completed work is preserved.'},cause?.status||503,cors);}
}
