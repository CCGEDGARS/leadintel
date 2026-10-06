const stmt=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
const fail=(message,status=409)=>{const e=Error(message);e.status=status;throw e;};
function card(row){return {...row,workspaceId:row.workspace_id,active:Boolean(row.active),coverage:JSON.parse(row.coverage_json),techniques:JSON.parse(row.techniques_json)};}
async function init(env,scope){if(!scope?.workspaceId)fail('Authenticated workspace required',401);await stmt(env,'INSERT OR IGNORE INTO writing_reference_workspaces(workspace_id) VALUES(?)',scope.workspaceId).run();}
export async function writingReferenceRevision(env,scope){await init(env,scope);return Number((await stmt(env,'SELECT revision FROM writing_reference_workspaces WHERE workspace_id=?',scope.workspaceId).first()).revision);}
export async function listWritingReferences(env,scope){await init(env,scope);const {results}=await stmt(env,`SELECT s.* FROM writing_reference_sources s JOIN writing_reference_slots p ON p.source_id=s.id WHERE s.workspace_id=? AND s.status<>'Deleted' ORDER BY s.slot`,scope.workspaceId).all();return results.map(card);}
export async function getWritingReference(env,scope,id){const row=await stmt(env,`SELECT s.* FROM writing_reference_sources s JOIN writing_reference_slots p ON p.source_id=s.id WHERE s.workspace_id=? AND s.id=? AND s.status<>'Deleted'`,scope.workspaceId,id).first();if(!row)fail('Source not found',404);return card(row);}
export async function writingReferenceSlots(env,scope){const rows=await stmt(env,'SELECT slot,revision FROM writing_reference_slots WHERE workspace_id=?',scope.workspaceId).all();return Object.fromEntries(rows.results.map(r=>[r.slot,r.revision]));}
export async function recoverWritingReferenceUploads(env,now=Date.now()){
 const rows=await stmt(env,'SELECT * FROM writing_reference_uploads WHERE expires_at<? LIMIT 12',now).all();
 for(const row of rows.results){const installed=await stmt(env,"SELECT id FROM writing_reference_sources WHERE id=? AND status NOT IN ('Deleting','Deleted')",row.source_id).first();if(installed){await stmt(env,'DELETE FROM writing_reference_uploads WHERE id=?',row.id).run();continue;}try{await env.WRITING_REFERENCES_BUCKET.delete(row.original_key);if(row.text_key)await env.WRITING_REFERENCES_BUCKET.delete(row.text_key);await stmt(env,'DELETE FROM writing_reference_uploads WHERE id=?',row.id).run();}catch{/* retain durable obligation */}}
 await stmt(env,'DELETE FROM writing_reference_upload_tickets WHERE expires_at<?',now).run();
}
export async function putWritingReference(env,scope,{slot,expectedRevision,expectedSourceId=null,expectedSlotRevision=0,filename,document}){
 if(!Number.isInteger(slot)||slot<1||slot>3)fail('Choose a source slot from 1 to 3',400);
 if(!env.WRITING_REFERENCES_BUCKET)fail('Private source storage is not configured',503);await init(env,scope);
 await stmt(env,'INSERT OR IGNORE INTO writing_reference_slots(workspace_id,slot) VALUES(?,?)',scope.workspaceId,slot).run();
 const prior=await stmt(env,'SELECT * FROM writing_reference_slots WHERE workspace_id=? AND slot=?',scope.workspaceId,slot).first();
 const old=prior.source_id?await getWritingReference(env,scope,prior.source_id):null;
 if(Number(expectedRevision)!==Number(old?.revision||0)||expectedSourceId!==prior.source_id||Number(expectedSlotRevision)!==Number(prior.revision)||old?.status==='Deleting')fail('Source changed. Refresh and try again.');
 const id=crypto.randomUUID(),base=`writing/${scope.workspaceId}/${id}`,originalKey=base+'/original',textKey=base+'/text.json';
 await stmt(env,'INSERT INTO writing_reference_uploads(id,workspace_id,source_id,original_key,text_key,expires_at) VALUES(?,?,?,?,?,?)',id,scope.workspaceId,id,originalKey,textKey,Date.now()+600000).run();
 try{
  await env.WRITING_REFERENCES_BUCKET.put(originalKey,document.bytes,{httpMetadata:{contentType:document.mime}});
  await env.WRITING_REFERENCES_BUCKET.put(textKey,JSON.stringify(document.extracted));
  const results=await env.DB.batch([
   stmt(env,`UPDATE writing_reference_slots SET source_id=?,revision=revision+1 WHERE workspace_id=? AND slot=? AND revision=? AND source_id IS ?`,id,scope.workspaceId,slot,prior.revision,prior.source_id),
   stmt(env,`INSERT INTO writing_reference_sources(id,workspace_id,slot,filename,mime,content_hash,original_key,text_key,status,coverage_json) SELECT ?,?,?,?,?,?,?,?,'Processing',? WHERE EXISTS(SELECT 1 FROM writing_reference_slots WHERE workspace_id=? AND slot=? AND source_id=?)`,id,scope.workspaceId,slot,filename,document.mime,document.sha256,originalKey,textKey,JSON.stringify(document.extracted.coverage),scope.workspaceId,slot,id),
   stmt(env,`INSERT INTO writing_reference_jobs(source_id,workspace_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM writing_reference_sources WHERE id=?)`,id,scope.workspaceId,id),
   stmt(env,`UPDATE writing_reference_sources SET status='Deleting',active=0,instruction='',summary='',techniques_json='[]',revision=revision+1 WHERE id=? AND EXISTS(SELECT 1 FROM writing_reference_slots WHERE source_id=?)`,prior.source_id,id),
   stmt(env,`UPDATE writing_reference_workspaces SET revision=revision+1 WHERE workspace_id=? AND EXISTS(SELECT 1 FROM writing_reference_slots WHERE source_id=?)`,scope.workspaceId,id)
  ]);
  if(!results[0].meta.changes)fail('Source changed. Refresh and try again.');
 }catch(e){const cleanup=await Promise.allSettled([env.WRITING_REFERENCES_BUCKET.delete(originalKey),env.WRITING_REFERENCES_BUCKET.delete(textKey)]);if(cleanup.every(r=>r.status==='fulfilled'))await stmt(env,'DELETE FROM writing_reference_uploads WHERE id=?',id).run().catch(()=>null);throw e;}
 await stmt(env,'DELETE FROM writing_reference_uploads WHERE id=?',id).run().catch(()=>null);
 if(prior.source_id)await cleanupWritingReference(env,scope,prior.source_id).catch(()=>null);
 return getWritingReference(env,scope,id);
}
export async function patchWritingReference(env,scope,{id,expectedRevision,active,instruction}){
 const row=await getWritingReference(env,scope,id);if(row.revision!==Number(expectedRevision))fail('Source changed. Refresh and try again.');
 if(row.status==='Deleting')fail('Source is being deleted');if(active===true&&row.status!=='Ready')fail('Only Ready sources can activate');
 if(active!==undefined&&typeof active!=='boolean')fail('Activation must be a boolean',400);
 if(instruction!==undefined&&(typeof instruction!=='string'||instruction.length>500))fail('Source instruction is too long',400);
 const nextActive=active===undefined?row.active:active,nextInstruction=instruction===undefined?row.instruction:instruction;
 const result=await env.DB.batch([
  stmt(env,`UPDATE writing_reference_sources SET active=?,instruction=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND status<>'Deleting'`,nextActive?1:0,nextInstruction,id,scope.workspaceId,expectedRevision),
  stmt(env,`UPDATE writing_reference_slots SET revision=revision+1 WHERE source_id=? AND EXISTS(SELECT 1 FROM writing_reference_sources WHERE id=? AND revision=?)`,id,id,expectedRevision+1),
  stmt(env,`UPDATE writing_reference_workspaces SET revision=revision+1 WHERE workspace_id=? AND EXISTS(SELECT 1 FROM writing_reference_sources WHERE id=? AND revision=?)`,scope.workspaceId,id,expectedRevision+1)
 ]);if(!result[0].meta.changes)fail('Source changed. Refresh and try again.');return getWritingReference(env,scope,id);
}
export async function cleanupWritingReference(env,scope,id){
 const row=await stmt(env,'SELECT * FROM writing_reference_sources WHERE id=? AND workspace_id=?',id,scope.workspaceId).first();if(!row||row.status==='Deleted')return;if(row.status!=='Deleting')fail('Source is not marked for deletion');
 try{await env.WRITING_REFERENCES_BUCKET.delete(row.original_key);await env.WRITING_REFERENCES_BUCKET.delete(row.text_key);await env.WRITING_REFERENCES_BUCKET.delete(row.catalogue_key||row.original_key.replace(/original$/,'catalogue.json'));}catch{fail('Source cleanup failed; deletion will retry',503);}
 await env.DB.batch([
  stmt(env,'DELETE FROM writing_reference_chunks WHERE source_id=?',id),stmt(env,'DELETE FROM writing_reference_jobs WHERE source_id=?',id),
  stmt(env,`UPDATE writing_reference_sources SET status='Deleted',filename='',mime='',content_hash='',original_key='',text_key='',catalogue_key='',coverage_json='{}',summary='',techniques_json='[]',instruction='',error_code='',active=0 WHERE id=? AND workspace_id=? AND status='Deleting'`,id,scope.workspaceId),
  stmt(env,'UPDATE writing_reference_slots SET source_id=NULL,revision=revision+1 WHERE workspace_id=? AND source_id=?',scope.workspaceId,id)
 ]);
}
export async function deleteWritingReference(env,scope,{id,expectedRevision}){
 const row=await getWritingReference(env,scope,id);if(row.revision!==Number(expectedRevision))fail('Source changed. Refresh and try again.');
 const result=await env.DB.batch([
  stmt(env,`UPDATE writing_reference_sources SET status='Deleting',active=0,instruction='',summary='',techniques_json='[]',revision=revision+1 WHERE workspace_id=? AND id=? AND revision=?`,scope.workspaceId,id,expectedRevision),
  stmt(env,'DELETE FROM writing_reference_chunks WHERE source_id=? AND EXISTS(SELECT 1 FROM writing_reference_sources WHERE id=? AND status=\'Deleting\')',id,id),
  stmt(env,'DELETE FROM writing_reference_jobs WHERE source_id=? AND EXISTS(SELECT 1 FROM writing_reference_sources WHERE id=? AND status=\'Deleting\')',id,id),
  stmt(env,'UPDATE writing_reference_slots SET revision=revision+1 WHERE source_id=?',id),
  stmt(env,'UPDATE writing_reference_workspaces SET revision=revision+1 WHERE workspace_id=?',scope.workspaceId)
 ]);if(!result[0].meta.changes)fail('Source changed. Refresh and try again.');await cleanupWritingReference(env,scope,id);return {status:'Deleted',referenceRevision:await writingReferenceRevision(env,scope)};
}
export function writingReferenceStore(env){return {snapshot:async scope=>{for(let n=0;n<3;n++){const before=await writingReferenceRevision(env,scope),cards=await listWritingReferences(env,scope);for(const row of cards){if(row.active&&row.status==='Ready'&&row.catalogue_key){const object=await env.WRITING_REFERENCES_BUCKET.get(row.catalogue_key);if(!object)fail('Active writing source catalogue is unavailable',503);row.techniques=JSON.parse(await object.text()).techniques;}}const after=await writingReferenceRevision(env,scope);if(before===after)return {cards,referenceRevision:after};}fail('Writing references changed. Refresh and regenerate.');},revision:scope=>writingReferenceRevision(env,scope)};}
