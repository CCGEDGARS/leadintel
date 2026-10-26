import {cookieValue,sha256,randomToken} from './security.js';
import {storageErrorResponse} from './workspace-storage.js';
const json=(value,status=200,cors={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const maxBytes=15*1024*1024;
export function materialCard(row){return {id:row.id,filename:row.filename,mime:row.mime,kind:row.kind,size:row.byte_size,status:row.status,revision:row.revision,analysis:JSON.parse(row.analysis_json),error:row.error};}
export async function listCompanyMaterials(env,workspace){return (await env.DB.prepare('SELECT * FROM company_materials WHERE workspace_id=? ORDER BY created_at,id').bind(workspace).all()).results.map(materialCard);}
export async function validateCompanyFile(file){
 if(!file||typeof file.arrayBuffer!=='function')fail('Choose a PDF, JPG or PNG file');
 if(file.size>maxBytes)fail('Maximum file size is 15 MB',413);
 if(!file.size||file.name.length>180||/[\x00-\x1f/\\]/.test(file.name))fail('Invalid file name');
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>maxBytes)fail('Maximum file size is 15 MB',413);
 const mime=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':/\.png$/i.test(file.name)?'image/png':/\.jpe?g$/i.test(file.name)?'image/jpeg':'');
 const pdf=mime==='application/pdf'&&/\.pdf$/i.test(file.name)&&new TextDecoder().decode(bytes.subarray(0,5))==='%PDF-';
 const png=mime==='image/png'&&/\.png$/i.test(file.name)&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
 const jpg=mime==='image/jpeg'&&/\.jpe?g$/i.test(file.name)&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!pdf&&!png&&!jpg)fail('Choose a valid PDF, JPG or PNG file');
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return {bytes,mime,kind:pdf?'pdf':'image',digest:Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')};
}
async function upload(form,env,workspace,cors){
 const file=form.get('file'),value=await validateCompanyFile(file);
 const duplicate=await env.DB.prepare('SELECT * FROM company_materials WHERE workspace_id=? AND digest=?').bind(workspace,value.digest).first();
 if(duplicate)return json({cards:await listCompanyMaterials(env,workspace),duplicate:true},200,cors);
 const id=crypto.randomUUID(),base=`materials/${workspace}/${id}/`,original=base+'original',text=base+'text.json';
 const result=await env.DB.prepare("INSERT OR IGNORE INTO company_materials(id,workspace_id,filename,mime,kind,byte_size,digest,original_key,text_key,lease_until) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM company_materials WHERE workspace_id=? AND kind=?)<?").bind(id,workspace,file.name,value.mime,value.kind,value.bytes.length,value.digest,original,text,Date.now()+180000,workspace,value.kind,value.kind==='pdf'?5:10).run();
 if(!result.meta.changes){const existing=await env.DB.prepare('SELECT id FROM company_materials WHERE workspace_id=? AND digest=?').bind(workspace,value.digest).first();if(existing)return json({cards:await listCompanyMaterials(env,workspace),duplicate:true},200,cors);fail(value.kind==='pdf'?'Maximum 5 PDFs reached':'Maximum 10 images reached',409);}
 try{
  await env.WRITING_REFERENCES_BUCKET.put(original,value.bytes,{httpMetadata:{contentType:value.mime}});
  const committed=await env.DB.prepare("UPDATE company_materials SET status='Processing',lease_until=0 WHERE id=? AND workspace_id=? AND status='Uploading'").bind(id,workspace).run();
  if(!committed.meta.changes){await env.WRITING_REFERENCES_BUCKET.delete(original);fail('Upload was removed. Select the file again.',409);}
 }catch(e){await env.DB.prepare("DELETE FROM company_materials WHERE id=? AND workspace_id=? AND status='Uploading'").bind(id,workspace).run();try{await env.WRITING_REFERENCES_BUCKET.delete(original);}catch{/* Storage reconciliation retains accounting for retry. */}throw e;}
 return json({cards:await listCompanyMaterials(env,workspace)},201,cors);
}
export async function handleCompanyMaterialsRoute(request,env,cors={}){
 const url=new URL(request.url),direct=url.pathname==='/company-material-upload';if(!direct&&!url.pathname.startsWith('/api/company-materials'))return null;
 try{
  if(!env.WRITING_REFERENCES_BUCKET)fail('Private material storage is unavailable',503);
  let workspace=url.searchParams.get('workspace_id'),user;
  if(direct){
   if(request.method!=='POST')fail('Method not allowed',405);
   if(Number(request.headers.get('Content-Length'))>maxBytes+16384)fail('Maximum file size is 15 MB',413);
   const form=await request.formData(),ticket=String(form.get('ticket')||'');if(!ticket)fail('Upload authorization expired. Select the file again.',401);
   const row=await env.DB.prepare('DELETE FROM company_material_upload_tickets WHERE token_hash=? AND expires_at>? RETURNING *').bind(await sha256(ticket),Date.now()).first();if(!row)fail('Upload authorization expired. Select the file again.',401);workspace=row.workspace_id;user={id:row.user_id};
   const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).first();if(!member||!['owner','researcher','sales'].includes(member.role))fail('Workspace access denied',403);
   return await upload(form,env,workspace,cors);
  }
  const token=cookieValue(request,'leadintel_session');if(!token)fail('Authentication required',401);
  user=await env.DB.prepare("SELECT users.id FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')").bind(await sha256(token)).first();if(!user)fail('Authentication required',401);
  const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspace,user.id).first();if(!member||!['owner','researcher','sales'].includes(member.role))fail('Workspace access denied',403);
  if(url.pathname==='/api/company-materials/upload-ticket'&&request.method==='POST'){
   await env.DB.prepare('DELETE FROM company_material_upload_tickets WHERE expires_at<?').bind(Date.now()).run();
   const ticket=randomToken();await env.DB.prepare('INSERT INTO company_material_upload_tickets VALUES(?,?,?,?)').bind(await sha256(ticket),workspace,user.id,Date.now()+120000).run();return json({ticket,uploadUrl:new URL('/company-material-upload',request.url).href},201,cors);
  }
  const match=url.pathname.match(/^\/api\/company-materials(?:\/([a-f0-9-]+)(?:\/(original|extracted|retry))?)?\/?$/);if(!match)fail('Not found',404);const [,id,action]=match;
  if(!id&&request.method==='GET')return json({cards:await listCompanyMaterials(env,workspace)},200,cors);
  if(!id&&request.method==='POST'){if(Number(request.headers.get('Content-Length'))>maxBytes+16384)fail('Maximum file size is 15 MB',413);return await upload(await request.formData(),env,workspace,cors);}
  const row=id?await env.DB.prepare('SELECT * FROM company_materials WHERE workspace_id=? AND id=?').bind(workspace,id).first():null;if(!row)fail('Material not found',404);
  if(action==='original'&&request.method==='GET'){
   if(row.status==='Deleting')fail('Material is being deleted',409);const object=await env.WRITING_REFERENCES_BUCKET.get(row.original_key);if(!object)fail('Original unavailable',404);
   return new Response(object.body||await object.arrayBuffer(),{headers:{'Content-Type':row.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'Cache-Control':'no-store',...cors}});
  }
  if(action==='extracted'&&request.method==='GET'){
   if(row.status!=='Ready')fail('Material is not ready yet',409);const object=await env.WRITING_REFERENCES_BUCKET.get(row.text_key);if(!object)fail('Extracted text unavailable',404);return json({...materialCard(row),sections:JSON.parse(await object.text()).sections},200,cors);
  }
  if(Number(request.headers.get('Content-Length'))>2048)fail('Request is too large',413);const body=await request.json().catch(()=>null);if(!Number.isSafeInteger(body?.expectedRevision)||body.expectedRevision<1)fail('Material revision required');
  if(action==='retry'&&request.method==='POST'){
   const result=await env.DB.prepare("UPDATE company_materials SET status='Processing',error='',revision=revision+1,lease_token=NULL,lease_until=0 WHERE workspace_id=? AND id=? AND revision=? AND status='Needs attention'").bind(workspace,id,body.expectedRevision).run();if(!result.meta.changes)fail('Material changed. Refresh and try again.',409);
  }else if(!action&&request.method==='DELETE'){
   const result=await env.DB.prepare("UPDATE company_materials SET status='Deleting',revision=revision+1,lease_token=NULL,lease_until=0 WHERE workspace_id=? AND id=? AND revision=?").bind(workspace,id,body.expectedRevision).run();if(!result.meta.changes)fail('Material changed. Refresh and try again.',409);
   await env.WRITING_REFERENCES_BUCKET.delete(row.original_key);await env.WRITING_REFERENCES_BUCKET.delete(row.text_key);await env.DB.prepare("DELETE FROM company_materials WHERE workspace_id=? AND id=? AND status='Deleting'").bind(workspace,id).run();
  }else fail('Method not allowed',405);
  return json({cards:await listCompanyMaterials(env,workspace)},200,cors);
 }catch(e){return storageErrorResponse(e,cors)||json({error:e.status?e.message:'Material storage failed. Your saved files are preserved; refresh and retry.'},e.status||503,cors);}
}
