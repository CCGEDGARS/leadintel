const uuid=()=>crypto.randomUUID();

function clean(value,max=8000){return String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').trim().slice(0,max);}
function json(value,fallback){try{return JSON.stringify(value??fallback);}catch{throw new Error('Copilot file data must be JSON serializable');}}
function keyFor(workspaceId,fileId){return `workspaces/${workspaceId}/copilot-files/${fileId}/original`;}
function required(value,name){if(!value)throw new Error(`${name} is required`);return value;}
function sha256(value){const normalized=clean(required(value,'sha256'),64).toLowerCase();if(!/^[0-9a-f]{64}$/.test(normalized))throw new Error('sha256 must be a 64-character hexadecimal digest');return normalized;}
function bytesForDigest(bytes){
  if(bytes instanceof ArrayBuffer)return bytes;
  if(ArrayBuffer.isView(bytes))return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  throw new Error('Copilot file bytes must be an ArrayBuffer or typed array');
}
async function matchesDigest(bytes,expected){
  const digest=await crypto.subtle.digest('SHA-256',bytesForDigest(bytes));
  const actual=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
  return actual===expected;
}
function digestBytes(value){const bytes=new Uint8Array(32);for(let index=0;index<bytes.length;index++)bytes[index]=Number.parseInt(value.slice(index*2,index*2+2),16);return bytes.buffer;}

async function fileForWorkspace(env,workspaceId,fileId){
  return env.DB.prepare(`SELECT id,workspace_id,r2_key,sha256,mime_type,byte_size,created_at FROM copilot_files WHERE id=? AND workspace_id=? AND deleted_at IS NULL`).bind(fileId,workspaceId).first();
}

async function analysisForWorkspace(env,workspaceId,id){
  return env.DB.prepare(`SELECT id,file_id,workspace_id,retained FROM copilot_file_analyses WHERE id=? AND workspace_id=? AND deleted_at IS NULL`).bind(id,workspaceId).first();
}

export async function createFileRecord(env,input){
  const workspaceId=clean(required(input?.workspaceId,'workspaceId'),180);const id=uuid();const r2Key=keyFor(workspaceId,id);
  const record={id,workspaceId,r2Key,sha256:sha256(input?.sha256),originalName:clean(required(input?.originalName,'originalName'),1024),extension:clean(required(input?.extension,'extension'),24).toLowerCase(),mimeType:clean(required(input?.mimeType,'mimeType'),256),byteSize:Number(input?.byteSize)};
  if(!Number.isSafeInteger(record.byteSize)||record.byteSize<0)throw new Error('byteSize must be a non-negative integer');
  await env.DB.prepare(`INSERT INTO copilot_files(id,workspace_id,created_by,original_name,extension,mime_type,byte_size,sha256,r2_key,extraction_status,coverage_json,warnings_json,upload_token) VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?,?)`)
    .bind(record.id,record.workspaceId,clean(input?.userId,180)||null,record.originalName,record.extension,record.mimeType,record.byteSize,record.sha256,record.r2Key,json(input?.coverage,{}),json(input?.warnings,[]),input?.uploadToken||null).run();
  return record;
}

export async function putImmutableOriginal(env,{workspaceId,fileId,bytes,sha256,contentType}){
  const file=await fileForWorkspace(env,workspaceId,fileId);if(!file)throw new Error('Copilot file not found');
  if(sha256?.toLowerCase()!==file.sha256||!await matchesDigest(bytes,file.sha256))throw new Error('Copilot file digest does not match its metadata');
  const onlyIf=new Headers({'If-None-Match':'*'});
  const object=await env.COPILOT_FILES.put(file.r2_key,bytes,{onlyIf,httpMetadata:{contentType:clean(contentType||file.mime_type,256)},customMetadata:{sha256:file.sha256},sha256:digestBytes(file.sha256)});
  if(!object)throw new Error('Copilot file original is immutable and already exists');
  return {key:file.r2_key,sha256:file.sha256};
}

export async function saveExtraction(env,input){
  const workspaceId=clean(required(input?.workspaceId,'workspaceId'),180);const fileId=clean(required(input?.fileId,'fileId'),180);if(!await fileForWorkspace(env,workspaceId,fileId))throw new Error('Copilot file not found');
  const characterCount=Number(input?.characterCount??0),cellCount=Number(input?.cellCount??0);if(!Number.isSafeInteger(characterCount)||characterCount<0||!Number.isSafeInteger(cellCount)||cellCount<0)throw new Error('Extraction counts must be non-negative integers');
  if(input.uploadToken){
    // Both writes are fenced in the same transaction: a timed-out uploader cannot
    // overwrite extraction committed by the process that recovered its lease.
    const result=await env.DB.batch([
      env.DB.prepare(`INSERT INTO copilot_file_extractions(file_id,blocks_json,evidence_index_json,character_count,cell_count,extractor_version) SELECT id,?,?,?,?,? FROM copilot_files WHERE id=? AND workspace_id=? AND upload_token=? AND extraction_status='pending' AND deleted_at IS NULL ON CONFLICT(file_id) DO UPDATE SET blocks_json=excluded.blocks_json,evidence_index_json=excluded.evidence_index_json,character_count=excluded.character_count,cell_count=excluded.cell_count,extractor_version=excluded.extractor_version,updated_at=CURRENT_TIMESTAMP`).bind(json(input.blocks,[]),json(input.evidenceIndex,{}),characterCount,cellCount,clean(required(input.extractorVersion,'extractorVersion'),180),fileId,workspaceId,input.uploadToken),
      env.DB.prepare(`UPDATE copilot_files SET extraction_status=?,coverage_json=?,warnings_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND upload_token=? AND extraction_status='pending' AND deleted_at IS NULL`).bind(input.partial?'partial':'complete',json(input.coverage,{}),json(input.warnings,[]),fileId,workspaceId,input.uploadToken)
    ]);
    if(!result[1]?.meta?.changes)throw new Error('Upload lease is no longer owned');
    return {fileId,characterCount,cellCount};
  }
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO copilot_file_extractions(file_id,blocks_json,evidence_index_json,character_count,cell_count,extractor_version) VALUES(?,?,?,?,?,?) ON CONFLICT(file_id) DO UPDATE SET blocks_json=excluded.blocks_json,evidence_index_json=excluded.evidence_index_json,character_count=excluded.character_count,cell_count=excluded.cell_count,extractor_version=excluded.extractor_version,updated_at=CURRENT_TIMESTAMP`).bind(fileId,json(input?.blocks,[]),json(input?.evidenceIndex,{}),characterCount,cellCount,clean(required(input?.extractorVersion,'extractorVersion'),180)),
    env.DB.prepare(`UPDATE copilot_files SET extraction_status=?,coverage_json=?,warnings_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(input?.partial?'partial':'complete',json(input?.coverage,{}),json(input?.warnings,[]),fileId,workspaceId)
  ]);
  return {fileId,characterCount,cellCount};
}

export async function createAnalysis(env,input){
  const workspaceId=clean(required(input?.workspaceId,'workspaceId'),180);const fileId=clean(required(input?.fileId,'fileId'),180);if(!await fileForWorkspace(env,workspaceId,fileId))throw new Error('Copilot file not found');
  const id=uuid();const status=clean(input?.status||'completed',32);if(!['pending','running','completed','failed'].includes(status))throw new Error('Copilot analysis status is invalid');
  await env.DB.prepare(`INSERT INTO copilot_file_analyses(id,file_id,workspace_id,created_by,request,canonical_result_json,provider,model,usage_json,status,retained,source_coverage_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,fileId,workspaceId,clean(input?.userId,180)||null,clean(required(input?.request,'request'),8000),json(input?.result,{}),clean(input?.provider,120),clean(input?.model,240),json(input?.usage,{}),status,input?.retained?1:0,input?.sourceCoverage==null?null:json(input.sourceCoverage,{})).run();
  return {id,fileId,workspaceId,status,retained:Boolean(input?.retained)};
}

export async function retainAnalysis(env,{workspaceId,id}){
  const analysis=await analysisForWorkspace(env,workspaceId,id);if(!analysis)throw new Error('Copilot file analysis not found');
  await env.DB.prepare(`UPDATE copilot_file_analyses SET retained=1,retained_at=COALESCE(retained_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(id,workspaceId).run();
  return {id,retained:true};
}

async function markDeleting(env,file){
  await env.DB.prepare(`UPDATE copilot_files SET extraction_status='deleting',updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=?`).bind(file.id,file.workspace_id).run();
}

async function deleteFileTree(env,file){
  await markDeleting(env,file);
  await env.COPILOT_FILES.delete(file.r2_key);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM copilot_file_analyses WHERE file_id=? AND workspace_id=?`).bind(file.id,file.workspace_id),
    env.DB.prepare(`DELETE FROM copilot_file_extractions WHERE file_id=?`).bind(file.id),
    env.DB.prepare(`DELETE FROM copilot_files WHERE id=? AND workspace_id=?`).bind(file.id,file.workspace_id)
  ]);
}

export async function deleteAnalysisTree(env,{workspaceId,analysisId}){
  const analysis=await analysisForWorkspace(env,workspaceId,analysisId);if(!analysis)return {deleted:false};
  const file=await fileForWorkspace(env,workspaceId,analysis.file_id);if(file)await deleteFileTree(env,file);
  return {deleted:true};
}

export async function purgeExpiredUnretainedFiles(env,now=new Date()){
  const cutoff=new Date(Number(now)-24*60*60*1000).toISOString();
  const {results=[]}=await env.DB.prepare(`SELECT f.id,f.workspace_id,f.r2_key FROM copilot_files f WHERE f.deleted_at IS NULL AND f.created_at<? AND NOT EXISTS (SELECT 1 FROM copilot_file_analyses a WHERE a.file_id=f.id AND a.retained=1 AND a.deleted_at IS NULL)`).bind(cutoff).all();
  let deleted=0,failed=0;
  for(const file of results){try{await deleteFileTree(env,file);deleted+=1;}catch{failed+=1;}}
  return {deleted,failed};
}
