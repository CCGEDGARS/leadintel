import {cookieValue,sha256} from './security.js';
import {writingReferencesEnabled} from './writing-reference-routes.js';
import {storageErrorResponse} from './workspace-storage.js';
import {listWorkspaceSkills,getWorkspaceSkill,createWorkspaceSkill,mutateWorkspaceSkill,publicSkill,SKILL_LIMIT} from './workspace-skill-store.js';
import {skillPackage,zipFiles,moduleMarkdown} from './workspace-skill-export.js';
const json=(value,status=200,cors={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
export async function handleWorkspaceSkillRoute(request,env,cors={}){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/workspace-skills'))return null;
 const token=cookieValue(request,'leadintel_session');if(!token)return json({error:'Authentication required'},401,cors);
 const user=await env.DB.prepare("SELECT users.id FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();if(!user)return json({error:'Authentication required'},401,cors);
 const workspaceId=url.searchParams.get('workspace_id'),member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();if(!member)return json({error:'Workspace access denied'},403,cors);
 if(!writingReferencesEnabled(env,workspaceId))return json({error:'Connect workspace-owned storage before using the Skill Library.'},403,cors);
 if(!env.WRITING_REFERENCES_BUCKET)return json({error:'Private skill storage is unavailable'},503,cors);
 if(request.method!=='GET'&&member.role!=='owner')return json({error:'Only the workspace owner can manage skills'},403,cors);
 const match=url.pathname.match(/^\/api\/workspace-skills(?:\/([a-f0-9-]+)(?:\/(download|retry))?)?\/?$/);if(!match)return json({error:'Not found'},404,cors);
 const [,id,action]=match,scope={workspaceId,userId:user.id};
 try{
  if(request.method==='GET'&&id){const skill=await getWorkspaceSkill(env,scope,id);if(skill.status!=='Ready'&&action==='download')return json({error:'Skill is not ready yet'},409,cors);if(skill.status!=='Ready')return json({skill:publicSkill(skill)},200,cors);const pkg=await skillPackage(env,scope,id);if(action==='download')return new Response(zipFiles(pkg.files),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(skill.title.replace(/[\r\n/\\]/g,'-')+'.zip')}`,'Cache-Control':'no-store',...cors}});if(action)return json({error:'Not found'},404,cors);return json({skill:publicSkill(skill),markdown:pkg.files['SKILL.md'],methods:pkg.modules.map(m=>({id:m.id,title:m.title,markdown:moduleMarkdown(m)}))},200,cors);}
  if(request.method!=='GET'){
   const raw=await request.text();if(raw.length>4000)return json({error:'Skill request is too large'},413,cors);let body;try{body=JSON.parse(raw);}catch{return json({error:'Skill request is required'},400,cors);}if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Skill request is required'},400,cors);
   if(!id&&request.method==='POST')await createWorkspaceSkill(env,scope,body);
   else if(id&&!action&&request.method==='PATCH'){if(Object.keys(body).some(k=>!['expectedRevision','enabled'].includes(k)))return json({error:'Unsupported skill change'},400,cors);await mutateWorkspaceSkill(env,scope,id,body);}
   else if(id&&!action&&request.method==='DELETE')await mutateWorkspaceSkill(env,scope,id,{expectedRevision:body.expectedRevision,delete:true});
   else if(id&&action==='retry'&&request.method==='POST')await mutateWorkspaceSkill(env,scope,id,{expectedRevision:body.expectedRevision,retry:true});
   else return json({error:'Method not allowed'},405,cors);
  }
  return json({skills:(await listWorkspaceSkills(env,scope)).map(publicSkill),limit:SKILL_LIMIT,canManage:member.role==='owner'},request.method==='POST'&&!id?201:200,cors);
 }catch(error){return storageErrorResponse(error,cors)||json({error:error.status?error.message:'Skill operation failed. Refresh and try again.'},error.status||503,cors);}
}
