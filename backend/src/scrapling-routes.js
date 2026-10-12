import {sha256,cookieValue} from './security.js';

const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers)=>json({error:message},status,headers);
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);

async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();}
async function membership(env,workspaceId,userId){return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();}
async function audit(env,{workspaceId,userId,metadata={}}){try{await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),workspaceId,userId,'service.scrapling_scrape','workspace_service_integration','scrapling',JSON.stringify(metadata)).run();}catch{}}

export async function handleScraplingRoute(request,env,cors={}){
  const url=new URL(request.url);
  if(url.pathname!=='/api/integrations/services/scrapling/scrape')return null;
  if(request.method!=='POST')return error('Method not allowed',405,cors);
  const workspaceId=clean(url.searchParams.get('workspace_id')||'',120);if(!workspaceId)return error('workspace_id is required',400,cors);
  const user=await sessionUser(request,env);if(!user)return error('Authentication required',401,cors);
  const member=await membership(env,workspaceId,user.id);if(!member||!['owner','researcher','sales'].includes(member.role))return error('Workspace access denied',403,cors);
  return json({error:'Shared Scrapling access is disabled. Connect your own Firecrawl API key in Settings.',code:'CUSTOMER_SERVICE_KEY_REQUIRED'},409,cors);
}
