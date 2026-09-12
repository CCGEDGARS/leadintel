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
  if(extraction.title!==undefined&&typeof extraction.title!=='string'||typeof extraction.coverage.complete!=='boolean'||extraction.coverage.omitted!==undefined&&!Array.isArray(extraction.coverage.omitted))return 'Extraction has invalid metadata';
  if(extraction.blocks.length>1000||extraction.warnings.length>1000||(extraction.coverage.omitted||[]).length>1000)return 'Extraction exceeds structural limits';
  const locators=new Set();let characters=0,cells=0,csvRows=0,allCells=0,allRows=0;
  for(const block of extraction.blocks){
    if(!exactKeys(block,new Set(['locator','text','table']))||typeof block.locator!=='string'||!clean(block.locator,500)||block.locator.length>500||locators.has(block.locator))return 'Extraction has invalid blocks';
    locators.add(block.locator);if(block.text!==undefined&&typeof block.text!=='string')return 'Extraction has invalid blocks';characters+=String(block.text||'').length;
    if(block.table!==undefined){if(!Array.isArray(block.table))return 'Extraction has invalid blocks';allRows+=block.table.length;if(allRows>20000)return 'Extraction exceeds structural limits';for(const row of block.table){if(!Array.isArray(row))return 'Extraction has invalid blocks';allCells+=row.length;if(row.length>1000||allCells>100000)return 'Extraction exceeds structural limits';if(format==='csv')csvRows+=1;for(const cell of row){if(typeof cell!=='string')return 'Extraction has invalid blocks';characters+=cell.length;if((format==='xlsx'||format==='xls')&&cell.trim())cells+=1;}}}
  }
  if(extraction.warnings.some(value=>typeof value!=='string')||(extraction.coverage.omitted||[]).some(value=>typeof value!=='string')||Object.keys(extraction.evidenceIndex).length!==locators.size||Object.keys(extraction.evidenceIndex).some(locator=>!locators.has(locator))||Object.values(extraction.evidenceIndex).some(value=>typeof value!=='string'))return 'Extraction has invalid evidence';
  // Source counts exclude metadata, but the aggregate budget includes all normalized text.
  const aggregate=characters+(extraction.title||'').length+[...extraction.warnings,...(extraction.coverage.omitted||[]),...Object.values(extraction.evidenceIndex)].reduce((sum,value)=>sum+value.length,0);
  if(aggregate>COPILOT_FILE_LIMITS.maxExtractionChars||cells>COPILOT_FILE_LIMITS.maxCells||csvRows>COPILOT_FILE_LIMITS.maxCsvRows)return 'Extraction exceeds a supported limit';
  if(!Number.isSafeInteger(extraction.counts.characters)||!Number.isSafeInteger(extraction.counts.nonEmptyCells)||!Number.isSafeInteger(extraction.counts.csvRows)||extraction.counts.characters!==characters||extraction.counts.nonEmptyCells!==cells||extraction.counts.csvRows!==csvRows)return 'Extraction counts do not match content';
  return null;
}
function multipartField(form,name){const values=form.getAll(name);return values.length===1?values[0]:null;}
const MAX_MULTIPART_BYTES=18*1024*1024,MAX_EXTRACTION_BYTES=2*1024*1024;
async function boundedForm(request){
  if(Number(request.headers.get('content-length'))>MAX_MULTIPART_BYTES)return {status:413};
  if(!request.body)return {status:400};
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_MULTIPART_BYTES){await reader.cancel();return {status:413};}chunks.push(value);}
    const body=new Blob(chunks);return {form:await new Response(body,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData()};
  }catch{return {status:400};}
}

export async function handleCopilotFileRoute(request,env,cors={}){
  const url=new URL(request.url);if(!url.pathname.startsWith('/api/copilot/files'))return null;
  const workspaceId=clean(url.searchParams.get('workspace_id'),180);const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
  if(url.pathname!=='/api/copilot/files'||request.method!=='POST')return error('Method not allowed',405,cors);
  const parsed=await boundedForm(request);if(!parsed.form)return error(parsed.status===413?'Multipart upload is too large':'Multipart upload is required',parsed.status,cors);const form=parsed.form;
  const allowed=new Set(['file','extraction_json','sha256','extractor_version']);if([...form.keys()].some(key=>!allowed.has(key)))return error('Multipart upload contains unsupported fields',400,cors);
  const file=multipartField(form,'file'),extractionJson=multipartField(form,'extraction_json'),submittedDigest=clean(multipartField(form,'sha256'),64).toLowerCase(),extractorVersion=clean(multipartField(form,'extractor_version'),180);
  if(!file||typeof file.arrayBuffer!=='function'||typeof extractionJson!=='string'||!extractorVersion||!/^[0-9a-f]{64}$/.test(submittedDigest))return error('Required multipart fields are missing',400,cors);
  if(new TextEncoder().encode(extractionJson).byteLength>MAX_EXTRACTION_BYTES)return error('Extraction JSON is too large',413,cors);
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
