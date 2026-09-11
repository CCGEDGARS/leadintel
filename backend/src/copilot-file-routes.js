import {createFileRecord,putImmutableOriginal,saveExtraction} from './copilot-file-store.js';
import {COPILOT_FILE_LIMITS,validateUploadedFile} from './copilot-file-security.js';

const OPERATING_ROLES=new Set(['owner','researcher','sales']);
const clean=(value,max=8000)=>String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').trim().slice(0,max);
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,cors)=>json({error:message},status,cors);
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.has(key));
async function sha256(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}
function cookie(request,name){return request.headers.get('Cookie')?.split(';').map(item=>item.trim()).find(item=>item.startsWith(`${name}=`))?.slice(name.length+1)||'';}
async function sessionUser(request,env){const token=cookie(request,'leadintel_session');if(!token)return null;return env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>datetime('now')`).bind(await sha256(token)).first();}
async function requireMember(request,env,workspaceId){
  if(!workspaceId)return {status:400,error:'workspace_id is required'};
  const user=await sessionUser(request,env);if(!user)return {status:401,error:'Authentication required'};
  const member=await env.DB.prepare(`SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?`).bind(workspaceId,user.id).first();
  if(!member)return {status:403,error:'Workspace access denied'};
  if(!OPERATING_ROLES.has(String(member.role||'').toLowerCase()))return {status:403,error:'Workspace role is not permitted'};
  return {user,member};
}
function extractionError(extraction,format){
  if(!exactKeys(extraction,new Set(['format','title','blocks','evidenceIndex','warnings','coverage','counts']))||extraction.format!==format||!Array.isArray(extraction.blocks)||!Array.isArray(extraction.warnings)||!exactKeys(extraction.evidenceIndex,new Set(Object.keys(extraction.evidenceIndex||{})))||!exactKeys(extraction.coverage,new Set(['complete','omitted']))||!exactKeys(extraction.counts,new Set(['characters','nonEmptyCells','csvRows'])))return 'Extraction has an unsupported shape';
  const locators=new Set();let characters=clean(extraction.title,10000).length,cells=0,csvRows=0;
  for(const block of extraction.blocks){
    if(!exactKeys(block,new Set(['locator','text','table']))||typeof block.locator!=='string'||!clean(block.locator,500)||locators.has(block.locator))return 'Extraction has invalid blocks';
    locators.add(block.locator);if(block.text!==undefined&&typeof block.text!=='string')return 'Extraction has invalid blocks';characters+=String(block.text||'').length;
    if(block.table!==undefined){if(!Array.isArray(block.table))return 'Extraction has invalid blocks';for(const row of block.table){if(!Array.isArray(row))return 'Extraction has invalid blocks';if(format==='csv')csvRows+=1;for(const cell of row){if(typeof cell!=='string')return 'Extraction has invalid blocks';characters+=cell.length;if((format==='xlsx'||format==='xls')&&cell.trim())cells+=1;}}}
  }
  if(extraction.warnings.some(value=>typeof value!=='string')||Object.keys(extraction.evidenceIndex).some(locator=>!locators.has(locator))||Object.values(extraction.evidenceIndex).some(value=>typeof value!=='string'))return 'Extraction has invalid evidence';
  if(characters>COPILOT_FILE_LIMITS.maxExtractionChars||cells>COPILOT_FILE_LIMITS.maxCells||csvRows>COPILOT_FILE_LIMITS.maxCsvRows)return 'Extraction exceeds a supported limit';
  if(!Number.isSafeInteger(extraction.counts.characters)||!Number.isSafeInteger(extraction.counts.nonEmptyCells)||!Number.isSafeInteger(extraction.counts.csvRows)||extraction.counts.characters!==characters||extraction.counts.nonEmptyCells!==cells||extraction.counts.csvRows!==csvRows)return 'Extraction counts do not match content';
  return null;
}
function multipartField(form,name){const values=form.getAll(name);return values.length===1?values[0]:null;}

export async function handleCopilotFileRoute(request,env,cors={}){
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/copilot/files'))return null;
  const workspaceId=clean(url.searchParams.get('workspace_id'),180);const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
  if(url.pathname!=='/api/copilot/files'||request.method!=='POST')return error('Method not allowed',405,cors);
  const form=await request.formData().catch(()=>null);if(!form)return error('Multipart upload is required',400,cors);
  const allowed=new Set(['file','extraction_json','sha256','extractor_version']);if([...form.keys()].some(key=>!allowed.has(key)))return error('Multipart upload contains unsupported fields',400,cors);
  const file=multipartField(form,'file'),extractionJson=multipartField(form,'extraction_json'),submittedDigest=clean(multipartField(form,'sha256'),64).toLowerCase(),extractorVersion=clean(multipartField(form,'extractor_version'),180);
  if(!file||typeof file.arrayBuffer!=='function'||typeof extractionJson!=='string'||!extractorVersion||!/^[0-9a-f]{64}$/.test(submittedDigest))return error('Required multipart fields are missing',400,cors);
  const bytes=new Uint8Array(await file.arrayBuffer());const validation=await validateUploadedFile({headers:new Headers({'content-type':file.type}),bytes,name:file.name});
  if(!validation.ok)return error(validation.error,validation.status,cors);
  if(validation.sha256!==submittedDigest)return error('File digest does not match uploaded content',422,cors);
  let extraction;try{extraction=JSON.parse(extractionJson);}catch{return error('Extraction JSON is invalid',422,cors);}
  const invalidExtraction=extractionError(extraction,validation.format);if(invalidExtraction)return error(invalidExtraction,422,cors);
  const existing=await env.DB.prepare(`SELECT id,workspace_id FROM copilot_files WHERE sha256=? AND workspace_id=? AND deleted_at IS NULL LIMIT 1`).bind(validation.sha256,workspaceId).first();
  if(existing)return json({file_id:existing.id,reused:true},200,cors);
  const record=await createFileRecord(env,{workspaceId,userId:access.user.id,originalName:validation.originalName,extension:validation.extension,mimeType:validation.mimeType,byteSize:validation.byteSize,sha256:validation.sha256,coverage:extraction.coverage,warnings:extraction.warnings});
  try{
    await putImmutableOriginal(env,{workspaceId,fileId:record.id,bytes,sha256:validation.sha256,contentType:validation.mimeType});
    await saveExtraction(env,{workspaceId,fileId:record.id,blocks:extraction.blocks,evidenceIndex:extraction.evidenceIndex,characterCount:extraction.counts.characters,cellCount:extraction.counts.nonEmptyCells,extractorVersion,coverage:extraction.coverage,warnings:extraction.warnings,partial:extraction.coverage.complete===false});
  }catch(cause){return error('Unable to persist uploaded file',500,cors);}
  return json({file_id:record.id,reused:false},201,cors);
}
