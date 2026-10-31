import {contactRequestGuard} from './contact-operation-authority.js';
import {messageBatch,messageRowAssertion} from './message-operation-authority.js';
import {cookieValue,sha256} from './security.js';
import {importAesKey,encryptSecret,decryptSecret} from './oauth.js';
import {translateGoogle,validateGoogleTranslationInput,verifyGoogleTranslationCredential} from './google-translation.js';
const json=(value,status=200,cors={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
const CONFIG='/api/integrations/translation/google',TRANSLATE='/api/translation/google';
const status=(row,role)=>({provider:'google-translate',model:'nmt',configured:Boolean(row),verified_at:row?.verified_at||null,canManage:role==='owner'});
async function readBody(request,max){const text=await request.text();if(text.length>max)throw Object.assign(new Error('Translation request is too large'),{status:413});let body;try{body=JSON.parse(text);}catch{throw Object.assign(new Error('A valid JSON request is required'),{status:400});}if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(new Error('A valid JSON object is required'),{status:400});return body;}
export async function handleGoogleTranslationRoute(request,env,cors={}){
 const url=new URL(request.url),config=url.pathname===CONFIG;if(!config&&url.pathname!==TRANSLATE)return null;
 const token=cookieValue(request,'leadintel_session');if(!token)return json({error:'Authentication required'},401,cors);
 const user=await env.DB.prepare("SELECT users.id FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();if(!user)return json({error:'Authentication required'},401,cors);
 const workspaceId=url.searchParams.get('workspace_id')||'',member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();if(!member)return json({error:'Workspace access denied'},403,cors);
 if(config&&!['GET','PUT','DELETE'].includes(request.method)||!config&&request.method!=='POST')return json({error:'Method not allowed'},405,cors);
 if(config&&request.method!=='GET'&&member.role!=='owner')return json({error:'Only the workspace owner can configure Google Cloud Translation'},403,cors);
 if(!config&&!['owner','researcher','sales'].includes(member.role))return json({error:'Workspace writer role required'},403,cors);
 try{
  const context={workspaceId,userId:user.id,role:member.role};context.guard=await contactRequestGuard(request,env,context);context.writeAuthority=context.guard.writeAuthority;await context.guard();
  if(config&&request.method==='DELETE'){await messageBatch(env,context,[env.DB.prepare('DELETE FROM workspace_google_translation_integrations WHERE workspace_id=?').bind(workspaceId)]);return json(status(null,member.role),200,cors);}
  if(config&&request.method==='GET'){const row=await env.DB.prepare('SELECT verified_at FROM workspace_google_translation_integrations WHERE workspace_id=?').bind(workspaceId).first();return json(status(row,member.role),200,cors);}
  if(config){
   const body=await readBody(request,10000),apiKey=body.api_key;
   if(Object.keys(body).some(k=>k!=='api_key')||typeof apiKey!=='string'||apiKey.trim().length<8||apiKey.length>8192||/[\r\n\u0000]/.test(apiKey))return json({error:'A valid Google Cloud Translation API key is required'},400,cors);
   let encryptionKey;try{encryptionKey=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY);}catch{return json({error:'Google Cloud Translation credential encryption is not configured'},503,cors);}
   const previous=await env.DB.prepare('SELECT encrypted_api_key FROM workspace_google_translation_integrations WHERE workspace_id=?').bind(workspaceId).first();await context.guard();await verifyGoogleTranslationCredential(apiKey.trim(),{signal:request.signal});const encrypted=await encryptSecret(apiKey.trim(),encryptionKey);
   await messageBatch(env,context,[env.DB.prepare(`INSERT INTO workspace_google_translation_integrations(workspace_id,encrypted_api_key,configured_by,verified_at,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(workspace_id) DO UPDATE SET encrypted_api_key=excluded.encrypted_api_key,configured_by=excluded.configured_by,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(workspaceId,encrypted,user.id)],[messageRowAssertion(env.DB,'workspace_google_translation_integrations','workspace_id=?',[workspaceId],previous)]);
   const row=await env.DB.prepare('SELECT verified_at FROM workspace_google_translation_integrations WHERE workspace_id=?').bind(workspaceId).first();return json(status(row,member.role),200,cors);
  }
  const body=await readBody(request,100000);validateGoogleTranslationInput(body);
  const row=await env.DB.prepare('SELECT encrypted_api_key FROM workspace_google_translation_integrations WHERE workspace_id=?').bind(workspaceId).first();if(!row)return json({error:'Connect Google Cloud Translation in this workspace before using this provider'},409,cors);
  let apiKey;try{apiKey=await decryptSecret(row.encrypted_api_key,await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY));}catch{return json({error:'Google Cloud Translation credential is unavailable. Reconnect this workspace.'},503,cors);}
  await context.guard();const result=await translateGoogle({apiKey,source:body.source,language:body.language,sourceLanguage:body.sourceLanguage,protectedTerms:body.protectedTerms,signal:request.signal});
  await messageBatch(env,context,[env.DB.prepare('UPDATE workspace_google_translation_integrations SET last_used_at=CURRENT_TIMESTAMP WHERE workspace_id=?').bind(workspaceId)],[messageRowAssertion(env.DB,'workspace_google_translation_integrations','workspace_id=?',[workspaceId],row)]);await context.guard();return json(result,200,cors);
 }catch(error){return json({error:error?.status?error.message:'Google Cloud Translation is unavailable. Your original is preserved; retry.'},error?.status||503,cors);}
}
