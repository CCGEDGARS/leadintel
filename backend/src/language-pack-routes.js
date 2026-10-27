import {cookieValue,sha256} from './security.js';
import {languagePackCatalogue,getLanguagePack,queueLanguagePack,runLanguagePackJobs} from './language-packs.js';
const json=(value,status=200,cors={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
export async function handleLanguagePackRoute(request,env,cors={},ctx){
 const url=new URL(request.url);if(!/^\/api\/language-packs(?:\/|$)/.test(url.pathname))return null;
 const token=cookieValue(request,'leadintel_session');if(!token)return json({error:'Authentication required'},401,cors);
 const user=await env.DB.prepare("SELECT users.id FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();if(!user)return json({error:'Authentication required'},401,cors);
 const workspaceId=url.searchParams.get('workspace_id');if(!workspaceId||workspaceId.length>160)return json({error:'workspace_id is required'},400,cors);
 const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();if(!member)return json({error:'Workspace access denied'},403,cors);
 try{
  if(request.method==='GET'&&url.pathname==='/api/language-packs')return json({pack:await getLanguagePack(env,url.searchParams.get('language'))},200,cors);
  if(request.method!=='POST'||url.pathname!=='/api/language-packs/prepare')return json({error:'Method not allowed'},405,cors);
  if(!['owner','researcher','sales'].includes(member.role))return json({error:'Workspace role is not permitted'},403,cors);
  const raw=await request.text();if(raw.length>2000)return json({error:'Request is too large'},413,cors);let body;try{body=JSON.parse(raw);}catch{return json({error:'A JSON country selection is required'},400,cors);}
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.country!=='string'||body.country.length>160)return json({error:'A country selection is required'},400,cors);
  const suggestion=languagePackCatalogue.resolveCountry(body.country),explicit=body.language!=null?languagePackCatalogue.normalizeLanguage(body.language):null;
  if(body.language!=null&&!explicit)return json({error:'Unsupported language'},400,cors);
  if(suggestion.requiresConfirmation&&!explicit)return json({pack:null,suggestion},200,cors);
  const language=explicit||suggestion.language;if(!language)return json({pack:null,suggestion},200,cors);
  const pack=await queueLanguagePack(env,{workspaceId,userId:user.id,language});
  if(ctx?.waitUntil&&['queued','preparing'].includes(pack.status))ctx.waitUntil(runLanguagePackJobs(env).catch(()=>{console.warn('language_pack_jobs_retry_pending');}));
  return json({pack,suggestion},200,cors);
 }catch(cause){return json({error:cause.status?cause.message:'Language preparation is unavailable. Try again later.'},cause.status||503,cors);}
}
