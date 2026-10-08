import {sha256,cookieValue,randomToken} from './security.js';
import {validateWritingReference} from './writing-reference-validation.js';
import {listWritingReferences,getWritingReference,putWritingReference,patchWritingReference,deleteWritingReference,writingReferenceRevision,writingReferenceSlots} from './writing-reference-store.js';
import {writingReferenceProgress,retryWritingReference} from './writing-reference-runner.js';
const json=(value,status,cors)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
export function writingReferencesEnabled(env,workspaceId){return String(env.WRITING_REFERENCES_ALLOWED_WORKSPACES||'').split(',').map(s=>s.trim()).includes(workspaceId);}
function safeCard(row){return {id:row.id,slot:row.slot,revision:row.revision,filename:row.filename,status:row.status,active:row.active,instruction:row.instruction,coverage:row.coverage,summary:row.summary,techniques:row.techniques,error:row.error_code};}
async function snapshot(env,scope){const cards=await Promise.all((await listWritingReferences(env,scope)).map(async row=>({...safeCard(row),...(row.status==='Processing'?{progress:await writingReferenceProgress(env,scope,row.id)}:{})})));return {cards,slotRevisions:await writingReferenceSlots(env,scope),referenceRevision:await writingReferenceRevision(env,scope)};}
async function uploadForm(form,env,scope,settings,cors,ctx){
 const file=form.get('file');if(!file||typeof file.arrayBuffer!=='function')return json({error:'A source file is required'},400,cors);
 if(file.size>20*1024*1024)return json({error:'Maximum document size is 20 MiB'},413,cors);
 const filename=file.name,mime=/\.(md|markdown)$/i.test(filename)?'text/markdown':file.type||(/\.pdf$/i.test(filename)?'application/pdf':'text/plain');
 let document;try{document=await validateWritingReference({bytes:new Uint8Array(await file.arrayBuffer()),mime,filename});}catch{return json({error:'Unable to read source. Use a text-readable, unencrypted PDF, UTF-8 TXT or Markdown file within the document limits.'},422,cors);}
 await putWritingReference(env,scope,{...settings,filename,document});/* The minute scheduler owns analysis: HTTP background work is limited to 30 seconds. */return json(await snapshot(env,scope),201,cors);
}
export async function handleWritingReferenceRoute(request,env,cors={},ctx){
 const url=new URL(request.url);
 if(url.pathname==='/writing-reference-upload'){
  if(request.method!=='POST')return json({error:'Method not allowed'},405,cors);
  if(Number(request.headers.get('Content-Length'))>20*1024*1024+8192)return json({error:'Maximum document size is 20 MiB'},413,cors);
  try{const form=await request.formData(),ticket=String(form.get('ticket')||'');if(!ticket)return json({error:'Upload authorization expired. Select the file again.'},401,cors);
   const row=await env.DB.prepare('DELETE FROM writing_reference_upload_tickets WHERE token_hash=? AND expires_at>? RETURNING *').bind(await sha256(ticket),Date.now()).first();if(!row)return json({error:'Upload authorization expired. Select the file again.'},401,cors);
   const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(row.workspace_id,row.user_id).first();if(member?.role!=='owner'||!writingReferencesEnabled(env,row.workspace_id))return json({error:'Workspace access denied'},403,cors);
   return await uploadForm(form,env,{workspaceId:row.workspace_id,userId:row.user_id},{slot:row.slot,expectedRevision:row.expected_revision,expectedSourceId:row.expected_source_id,expectedSlotRevision:row.expected_slot_revision},cors,ctx);
  }catch(e){return json({error:e.status?e.message:'Source upload failed. Select the file again.'},e.status||503,cors);}
 }
 if(!url.pathname.startsWith('/api/writing-references'))return null;
 const workspaceId=url.searchParams.get('workspace_id'),token=cookieValue(request,'leadintel_session');
 if(!token)return json({error:'Authentication required'},401,cors);
 const user=await env.DB.prepare(`SELECT users.id FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(await sha256(token)).first();
 if(!user)return json({error:'Authentication required'},401,cors);
 const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,user.id).first();if(!member)return json({error:'Workspace access denied'},403,cors);
 if(!writingReferencesEnabled(env,workspaceId))return json({error:'Connect workspace-owned storage before using Writing References. Pilot access is limited to enabled workspaces.'},403,cors);
 if(!env.WRITING_REFERENCES_BUCKET)return json({error:'Private source storage is not configured'},503,cors);
 if(request.method!=='GET'&&member.role!=='owner')return json({error:'Only the workspace owner can change writing sources'},403,cors);
 const scope={workspaceId,userId:user.id};
 if(url.pathname==='/api/writing-references/upload-ticket'&&request.method==='POST'){
  const body=await request.json().catch(()=>null);if(!body||!Number.isInteger(body.slot)||body.slot<1||body.slot>3||!Number.isInteger(body.expectedRevision)||!Number.isInteger(body.expectedSlotRevision))return json({error:'Source slot and revision are required'},400,cors);
  const ticket=randomToken();await env.DB.prepare('INSERT INTO writing_reference_upload_tickets(token_hash,workspace_id,user_id,slot,expected_revision,expected_source_id,expected_slot_revision,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(await sha256(ticket),workspaceId,user.id,body.slot,body.expectedRevision,body.expectedSourceId||null,body.expectedSlotRevision,Date.now()+120000).run();
  return json({ticket,uploadUrl:new URL('/writing-reference-upload',request.url).href},201,cors);
 }
 const match=url.pathname.match(/^\/api\/writing-references(?:\/([a-f0-9-]+)(?:\/(original|retry))?)?\/?$/);if(!match)return json({error:'Not found'},404,cors);
 try{
  const [,id,action]=match;
  if(!id&&request.method==='GET')return json(await snapshot(env,scope),200,cors);
  if(!id&&request.method==='POST'){
   if(Number(request.headers.get('Content-Length'))>20*1024*1024+8192)return json({error:'Maximum document size is 20 MiB'},413,cors);
   const form=await request.formData();return await uploadForm(form,env,scope,{slot:Number(form.get('slot')),expectedRevision:Number(form.get('expectedRevision')),expectedSourceId:form.get('expectedSourceId')||null,expectedSlotRevision:Number(form.get('expectedSlotRevision')||0)},cors,ctx);
  }
  const row=await getWritingReference(env,scope,id);
  if(action==='original'&&request.method==='GET'){
   if(row.status==='Deleting')return json({error:'Source is being deleted'},409,cors);const object=await env.WRITING_REFERENCES_BUCKET.get(row.original_key);if(!object)return json({error:'Source unavailable'},404,cors);
   return new Response(object.body||await object.arrayBuffer(),{headers:{'Content-Type':row.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'Cache-Control':'no-store',...cors}});
  }
  if(!action&&request.method==='GET')return json({card:safeCard(row)},200,cors);
  const body=await request.json().catch(()=>null);if(!body||!Number.isInteger(body.expectedRevision))return json({error:'Source revision is required'},400,cors);
  if(action==='retry'&&request.method==='POST'){await retryWritingReference(env,scope,{id,...body});/* The minute scheduler owns analysis: HTTP background work is limited to 30 seconds. */}
  else if(!action&&request.method==='PATCH')await patchWritingReference(env,scope,{id,...body});
  else if(!action&&request.method==='DELETE')await deleteWritingReference(env,scope,{id,...body});
  else return json({error:'Method not allowed'},405,cors);
  return json(await snapshot(env,scope),200,cors);
 }catch(e){return json({error:e.status?e.message:'Source storage operation failed. Refresh and try again.'},e.status||503,cors);}
}
