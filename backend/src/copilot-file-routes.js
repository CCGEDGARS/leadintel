import {createFileRecord,putImmutableOriginal,saveExtraction,retainAnalysis,deleteAnalysisTree} from './copilot-file-store.js';
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
    if(block.table!==undefined){if(!Array.isArray(block.table))return 'Extraction has invalid blocks';allRows+=block.table.length;if(allRows>100000)return 'Extraction exceeds structural limits';for(const row of block.table){if(!Array.isArray(row))return 'Extraction has invalid blocks';allCells+=row.length;if(row.length>1000||allCells>100000)return 'Extraction exceeds structural limits';if(format==='csv')csvRows+=1;for(const cell of row){if(typeof cell!=='string')return 'Extraction has invalid blocks';characters+=cell.length;if((format==='xlsx'||format==='xls')&&Boolean(cell))cells+=1;}}}
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
async function digestFile(env,workspaceId,digest){return env.DB.prepare(`SELECT f.*,EXISTS(SELECT 1 FROM copilot_file_extractions e WHERE e.file_id=f.id) AS has_extraction FROM copilot_files f WHERE sha256=? AND workspace_id=? AND deleted_at IS NULL LIMIT 1`).bind(digest,workspaceId).first();}
async function originalExists(env,file){const object=await env.COPILOT_FILES.head(file.r2_key);return object&&object.size===file.byte_size&&object.customMetadata?.sha256===file.sha256;}
async function reserveUpload(env,input){
  let file=await digestFile(env,input.workspaceId,input.sha256);const uploadToken=crypto.randomUUID();
  if(!file){
    try{const record=await createFileRecord(env,{...input,uploadToken});return {id:record.id,r2_key:record.r2Key,sha256:input.sha256,byte_size:input.byteSize,uploadToken};}
    catch(cause){file=await digestFile(env,input.workspaceId,input.sha256);if(!file)throw cause;}
  }
  if(['complete','partial'].includes(file.extraction_status)&&file.has_extraction&&await originalExists(env,file))return {id:file.id,reused:true};
  if(file.extraction_status==='deleting')return {busy:true};
  const claimed=await env.DB.prepare(`UPDATE copilot_files SET upload_token=?,extraction_status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND deleted_at IS NULL AND upload_token IS ? AND extraction_status=? AND (extraction_status!='pending' OR updated_at<datetime('now','-5 minutes'))`).bind(uploadToken,file.id,input.workspaceId,file.upload_token,file.extraction_status).run();
  return claimed.meta?.changes?{...file,uploadToken}:{busy:true};
}
const analysisColumns='a.id,a.file_id,a.workspace_id,a.request,a.canonical_result_json,a.status,a.retained,a.created_at,a.updated_at';
async function rateLimit(env,userId,workspaceId,read){
  const operation=read?'read':'write';
  for(const [key,limit] of [[`user:${userId}:${operation}`,read?120:20],[`workspace:${workspaceId}:${operation}`,read?600:60]]){
    const row=await env.DB.prepare(`INSERT INTO copilot_file_rate_limits(scope_key,window_start,count) VALUES(?,unixepoch()/60,1) ON CONFLICT(scope_key) DO UPDATE SET window_start=excluded.window_start,count=CASE WHEN window_start=excluded.window_start THEN MIN(count+1,?) ELSE 1 END RETURNING count`).bind(key,limit+1).first();
    if(!row||row.count>limit)return false;
  }
  return true;
}
function publicAnalysis(row){return {id:row.id,file_id:row.file_id,workspace_id:row.workspace_id,request:row.request,result:JSON.parse(row.canonical_result_json),status:row.status,retained:Boolean(row.retained),created_at:row.created_at,updated_at:row.updated_at};}
async function lifecycle(request,env,workspaceId,match,cors){
  const id=match[1],save=match[2];
  try{
    if(!id&&request.method==='GET'){
      const {results=[]}=await env.DB.prepare(`SELECT ${analysisColumns} FROM copilot_file_analyses a JOIN copilot_files f ON f.id=a.file_id AND f.workspace_id=a.workspace_id WHERE a.workspace_id=? AND a.retained=1 AND a.status='completed' AND a.deleted_at IS NULL AND f.deleted_at IS NULL AND f.extraction_status IN ('complete','partial') ORDER BY a.updated_at DESC,a.id DESC LIMIT 100`).bind(workspaceId).all();
      return json({analyses:results.map(row=>({id:row.id,file_id:row.file_id,title:JSON.parse(row.canonical_result_json).title||'',status:row.status,retained:true,created_at:row.created_at,updated_at:row.updated_at}))},200,cors);
    }
    if(id&&!save&&request.method==='DELETE')return json(await deleteAnalysisTree(env,{workspaceId,analysisId:id}),200,cors);
    if(id&&(!save&&request.method==='GET'||save&&request.method==='POST')){
      const row=await env.DB.prepare(`SELECT ${analysisColumns},f.extraction_status FROM copilot_file_analyses a JOIN copilot_files f ON f.id=a.file_id AND f.workspace_id=a.workspace_id WHERE a.id=? AND a.workspace_id=? AND a.deleted_at IS NULL AND f.deleted_at IS NULL`).bind(id,workspaceId).first();
      if(!row)return error('File analysis not found',404,cors);
      if(row.status!=='completed'||!['complete','partial'].includes(row.extraction_status))return error('File analysis is not ready',409,cors);
      if(save)return json(await retainAnalysis(env,{workspaceId,id}),200,cors);
      const {results:messages=[]}=await env.DB.prepare(`SELECT role,content,evidence_json,created_at FROM copilot_file_analysis_messages WHERE analysis_id=? ORDER BY created_at DESC,id DESC LIMIT 50`).bind(id).all();
      return json({analysis:{...publicAnalysis(row),messages:messages.reverse().map(row=>({role:row.role,content:row.content,evidence:JSON.parse(row.evidence_json),created_at:row.created_at}))}},200,cors);
    }
    return error('Method not allowed',405,cors);
  }catch{return error('Unable to access file analysis; retry shortly',503,{...cors,'Retry-After':'5'});}
}

export async function handleCopilotFileRoute(request,env,cors={}){
  const url=new URL(request.url),analysisMatch=url.pathname.match(/^\/api\/copilot\/file-analyses(?:\/([^/]+)(\/save)?)?$/);
  // Task 5 owns analysis and message POST; do not swallow unrelated Copilot paths.
  if(url.pathname!=='/api/copilot/files'&&!analysisMatch||analysisMatch&&!analysisMatch[1]&&request.method==='POST')return null;
  const workspaceId=clean(url.searchParams.get('workspace_id'),180);const access=await requireMember(request,env,workspaceId);if(access.error)return error(access.error,access.status,cors);
  try{if(!await rateLimit(env,access.user.id,workspaceId,request.method==='GET'))return error('File request rate limit exceeded; retry shortly',429,{...cors,'Retry-After':'60'});}
  catch{return error('File request service is temporarily unavailable',503,{...cors,'Retry-After':'60'});}
  if(analysisMatch)return lifecycle(request,env,workspaceId,analysisMatch,cors);
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
  let record;
  try{
    record=await reserveUpload(env,{workspaceId,userId:access.user.id,originalName:validation.originalName,extension:validation.extension,mimeType:validation.mimeType,byteSize:validation.byteSize,sha256:validation.sha256,coverage:extraction.coverage,warnings:extraction.warnings});
    if(record.reused)return json({file_id:record.id,reused:true},200,cors);
    if(record.busy)return error('Upload is in progress; retry shortly',409,{...cors,'Retry-After':'5'});
    if(!await originalExists(env,record))await putImmutableOriginal(env,{workspaceId,fileId:record.id,bytes,sha256:validation.sha256,contentType:validation.mimeType});
    await saveExtraction(env,{workspaceId,fileId:record.id,uploadToken:record.uploadToken,blocks:extraction.blocks,evidenceIndex:extraction.evidenceIndex,characterCount:extraction.counts.characters,cellCount:extraction.counts.nonEmptyCells,extractorVersion,coverage:extraction.coverage,warnings:extraction.warnings,partial:extraction.coverage.complete===false});
  }catch(cause){
    // Keep the immutable original for a bounded retry; never advertise failed state as reusable.
    if(record?.uploadToken)await env.DB.prepare(`UPDATE copilot_files SET extraction_status='failed',updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND upload_token=? AND extraction_status='pending'`).bind(record.id,workspaceId,record.uploadToken).run().catch(()=>{});
    return error('Unable to persist uploaded file',500,cors);
  }
  return json({file_id:record.id,reused:false},201,cors);
}
