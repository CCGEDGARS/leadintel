import {sha256,cookieValue} from './security.js';
import {
  listCrmCompanies,getCrmCompany,upsertCrmCompany,updateCrmCompany,
  setCrmPipelineStage,removeCrmFromPipeline,archiveCrmCompany,restoreCrmCompany,
  suppressCrmCompany,markCrmCustomer,deleteCrmCompany,upsertCrmContacts,
  patchCrmContact,archiveCrmContact,appendCrmActivity
} from './crm.js';

const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,code)=>json({error:message,...(code?{code}:{})},status,headers);

async function sessionUser(request,env){const token=cookieValue(request,'leadintel_session');if(!token)return null;const tokenHash=await sha256(token);return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(tokenHash).first();}
async function membership(env,workspaceId,userId){return env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first();}
async function requireMember(request,env,workspaceId,roles=[]){const user=await sessionUser(request,env);if(!user)return {error:'Authentication required',status:401};const member=await membership(env,workspaceId,user.id);if(!member)return {error:'Workspace access denied',status:403};if(roles.length&&!roles.includes(member.role))return {error:'Workspace role is not permitted',status:403};return {user,member,context:{workspaceId,userId:user.id,role:member.role}};}
function routeError(cause,cors){const status=Number(cause?.status)||500;const safeStatus=status>=400&&status<600?status:500;return error(safeStatus===500?'Internal server error':String(cause?.message||'CRM request failed'),safeStatus,cors,cause?.code);}
function workspace(url){return String(url.searchParams.get('workspace_id')||'').trim();}
function parseCompanyPath(path){const match=path.match(/^\/api\/crm\/companies\/([^/]+)(?:\/(pipeline|archive|restore|suppress|mark-customer|contacts|activities))?$/);return match?{id:decodeURIComponent(match[1]),action:match[2]||''}:null;}
function parseContactPath(path){const match=path.match(/^\/api\/crm\/contacts\/([^/]+)$/);return match?{id:decodeURIComponent(match[1])}:null;}
const WRITER_ROLES=['owner','researcher','sales'];
const CLIENT_ACTIVITY_TYPES=new Set(['dossier.built','content.approved','email.sent','email.reply_received','meeting.recorded','proposal.recorded','deal.won','deal.lost']);

export async function handleCrmRoute(request,env,corsOverride={}){
  const url=new URL(request.url);const path=url.pathname;const cors=corsOverride||{};
  if(!path.startsWith('/api/crm/'))return null;
  const workspaceId=workspace(url);if(!workspaceId)return error('workspace_id is required',400,cors,'CRM_WORKSPACE_REQUIRED');
  try{
    if(path==='/api/crm/companies'){
      const access=await requireMember(request,env,workspaceId,request.method==='POST'?WRITER_ROLES:[]);if(access.error)return error(access.error,access.status,cors);
      if(request.method==='GET')return json(await listCrmCompanies(env.DB,access.context,{q:url.searchParams.get('q')||'',lifecycle:url.searchParams.get('lifecycle')||'',pipeline_stage:url.searchParams.get('pipeline_stage')||'',limit:url.searchParams.get('limit')||'',cursor:url.searchParams.get('cursor')||''}),200,cors);
      if(request.method==='POST'){const body=await request.json().catch(()=>null);if(!body)return error('CRM company payload is required',400,cors,'CRM_PAYLOAD_REQUIRED');const result=await upsertCrmCompany(env.DB,access.context,body);return json(result,result.created?201:200,cors);}
      return error('Method not allowed',405,cors);
    }

    const company=parseCompanyPath(path);
    if(company){
      const isDelete=request.method==='DELETE'&&!company.action;const roles=isDelete?['owner']:WRITER_ROLES;const readOnly=request.method==='GET';const access=await requireMember(request,env,workspaceId,readOnly?[]:roles);if(access.error)return error(access.error,access.status,cors);
      if(!company.action){
        if(request.method==='GET')return json(await getCrmCompany(env.DB,access.context,company.id),200,cors);
        if(request.method==='PATCH'){const body=await request.json().catch(()=>null);if(!body)return error('CRM company patch is required',400,cors);return json({company:await updateCrmCompany(env.DB,access.context,company.id,body)},200,cors);}
        if(request.method==='DELETE')return json(await deleteCrmCompany(env.DB,access.context,company.id),200,cors);
        return error('Method not allowed',405,cors);
      }
      if(company.action==='pipeline'){
        if(request.method==='POST'){const body=await request.json().catch(()=>({}));return json({company:await setCrmPipelineStage(env.DB,access.context,company.id,body.stage||'Discovered')},200,cors);}
        if(request.method==='DELETE')return json({company:await removeCrmFromPipeline(env.DB,access.context,company.id)},200,cors);
        return error('Method not allowed',405,cors);
      }
      if(company.action==='archive'&&request.method==='POST')return json({company:await archiveCrmCompany(env.DB,access.context,company.id)},200,cors);
      if(company.action==='restore'&&request.method==='POST')return json({company:await restoreCrmCompany(env.DB,access.context,company.id)},200,cors);
      if(company.action==='suppress'&&request.method==='POST')return json({company:await suppressCrmCompany(env.DB,access.context,company.id)},200,cors);
      if(company.action==='mark-customer'&&request.method==='POST')return json({company:await markCrmCustomer(env.DB,access.context,company.id)},200,cors);
      if(company.action==='contacts'){
        if(request.method==='POST'){const body=await request.json().catch(()=>null);const contacts=Array.isArray(body)?body:Array.isArray(body?.contacts)?body.contacts:[];return json({contacts:await upsertCrmContacts(env.DB,access.context,company.id,contacts)},200,cors);}
        return error('Method not allowed',405,cors);
      }
      if(company.action==='activities'){
        if(request.method==='GET'){const detail=await getCrmCompany(env.DB,access.context,company.id);return json({activities:detail.activities},200,cors);}
        if(request.method==='POST'){const body=await request.json().catch(()=>null);if(!body||!CLIENT_ACTIVITY_TYPES.has(String(body.type||body.activity_type||'')))return error('Unsupported CRM activity type',400,cors,'CRM_ACTIVITY_INVALID');const result=await appendCrmActivity(env.DB,access.context,{...body,companyId:company.id});return json(result,200,cors);}
        return error('Method not allowed',405,cors);
      }
      return error('Not found',404,cors);
    }

    const contact=parseContactPath(path);
    if(contact){const access=await requireMember(request,env,workspaceId,WRITER_ROLES);if(access.error)return error(access.error,access.status,cors);if(request.method==='PATCH'){const body=await request.json().catch(()=>null);if(!body)return error('CRM contact patch is required',400,cors);return json({contact:await patchCrmContact(env.DB,access.context,contact.id,body)},200,cors);}if(request.method==='DELETE')return json(await archiveCrmContact(env.DB,access.context,contact.id),200,cors);return error('Method not allowed',405,cors);}

    return error('Not found',404,cors);
  }catch(cause){return routeError(cause,cors);}
}
