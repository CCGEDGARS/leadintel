import {sha256,cookieValue} from './security.js';
import {fetchWithScrapling,scraplingConfigured} from './scrapling.js';

const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers)=>json({error:message},status,headers);
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const SCRAPLING_PROBE_TARGET='https://example.com/';

async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();}
async function membership(env,workspaceId,userId){return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();}
async function audit(env,{workspaceId,userId,metadata={}}){try{await env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),workspaceId,userId,'service.scrapling_scrape','workspace_service_integration','scrapling',JSON.stringify(metadata)).run();}catch{}}

export async function handleScraplingRoute(request,env,cors={}){
  const url=new URL(request.url);
  if(url.pathname==='/api/integrations/services/scrapling/health'){
    if(request.method!=='GET')return error('Method not allowed',405,cors);
    if(!scraplingConfigured(env))return error('Scrapling service is not configured',503,cors);
    try{
      const result=await fetchWithScrapling(env,SCRAPLING_PROBE_TARGET);
      return json({status:'ok',service:'leadintel-scrapling-fallback',source:result.data.metadata.source,statusCode:result.data.metadata.statusCode},200,cors);
    }catch(cause){return error(clean(cause?.message||'Scrapling extraction failed',180),502,cors);}
  }
  if(url.pathname!=='/api/integrations/services/scrapling/scrape')return null;
  if(request.method!=='POST')return error('Method not allowed',405,cors);
  const workspaceId=clean(url.searchParams.get('workspace_id')||'',120);if(!workspaceId)return error('workspace_id is required',400,cors);
  const user=await sessionUser(request,env);if(!user)return error('Authentication required',401,cors);
  const member=await membership(env,workspaceId,user.id);if(!member||!['owner','researcher','sales'].includes(member.role))return error('Workspace access denied',403,cors);
  if(!scraplingConfigured(env))return error('Scrapling service is not configured',503,cors);
  const body=await request.json().catch(()=>null);const target=clean(body?.url||'',2000);if(!target)return error('A public research URL is required',400,cors);
  try{
    const result=await fetchWithScrapling(env,target);
    await audit(env,{workspaceId,userId:user.id,metadata:{source:'scrapling-fallback',target_url:result.data.metadata.sourceURL,status_code:result.data.metadata.statusCode,fetched_at:result.data.metadata.fetchedAt}});
    return json(result,200,cors);
  }catch(cause){return error(clean(cause?.message||'Scrapling extraction failed',180),502,cors);}
}
