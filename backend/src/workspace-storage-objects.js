const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const fail=(message,status=503)=>Object.assign(Error(message),{status});
function objectWorkspace(key){const match=String(key).match(/^(?:writing|materials)\/([A-Za-z0-9_-]{1,160})\/[A-Za-z0-9_-]+\/(original|text\.json|catalogue\.json)$/);if(!match)throw fail('Private storage key is invalid',400);return match[1];}
function byteSize(value){if(typeof value==='string')return new TextEncoder().encode(value).byteLength;if(value instanceof ArrayBuffer)return value.byteLength;if(ArrayBuffer.isView(value))return value.byteLength;throw fail('Upload size must be known before storage',400);}
export async function reconcileStorageObjects(env,{workspaceId=null,limit=12,now=Math.floor(Date.now()/1000)}={}){
 if(!env.WRITING_REFERENCES_BUCKET)return;
 const rows=await stmt(env,"SELECT * FROM workspace_storage_objects WHERE (state='unmeasured' OR (state IN ('writing','deleting') AND lease_until<?)) AND (? IS NULL OR workspace_id=?) ORDER BY state,object_key LIMIT ?",now,workspaceId,workspaceId,limit).all();
 for(const row of rows.results){
  objectWorkspace(row.object_key);
  const object=await env.WRITING_REFERENCES_BUCKET.head(row.object_key);
  if(object)await stmt(env,"UPDATE workspace_storage_objects SET byte_size=?,state='ready',operation_token=NULL,lease_until=0 WHERE object_key=? AND state=? AND operation_token IS ?",Number(object.size),row.object_key,row.state,row.operation_token).run();
  else await stmt(env,'DELETE FROM workspace_storage_objects WHERE object_key=? AND state=? AND operation_token IS ?',row.object_key,row.state,row.operation_token).run();
 }
}
export function withWorkspaceStorage(env){
 const raw=env.WRITING_REFERENCES_BUCKET;if(env.WORKSPACE_STORAGE_ENABLED!=='true'||!raw)return env;
 const bucket={
  get:(...args)=>raw.get(...args),head:(...args)=>raw.head(...args),list:(...args)=>raw.list(...args),
  async put(key,value,options){
   const workspace=objectWorkspace(key),size=byteSize(value),token=crypto.randomUUID(),lease=Math.floor(Date.now()/1000)+900;
   // Older unmeasured objects cannot silently consume another customer's paid allowance.
   await reconcileStorageObjects(env,{workspaceId:workspace});
   const pending=await stmt(env,"SELECT count(*) n FROM workspace_storage_objects WHERE workspace_id=? AND state='unmeasured'",workspace).first();
   if(pending.n)throw fail('Existing file usage is being measured. Retry shortly.');
   const prior=await stmt(env,'SELECT * FROM workspace_storage_objects WHERE object_key=?',key).first();
   if(prior&&prior.state!=='ready')throw fail('A previous file operation is being recovered. Retry shortly.',409);
   const result=prior?
    await stmt(env,"UPDATE workspace_storage_objects SET byte_size=?,state='writing',operation_token=?,lease_until=? WHERE object_key=? AND state='ready' AND byte_size=?",Math.max(prior.byte_size,size),token,lease,key,prior.byte_size).run():
    await stmt(env,"INSERT OR IGNORE INTO workspace_storage_objects(object_key,workspace_id,byte_size,state,operation_token,lease_until) VALUES(?,?,?,'writing',?,?)",key,workspace,size,token,lease).run();
   if(!result.meta.changes)throw fail('A file operation is already in progress',409);
   const saved=await raw.put(key,value,options);
   const committed=await stmt(env,"UPDATE workspace_storage_objects SET byte_size=?,state='ready',operation_token=NULL,lease_until=0 WHERE object_key=? AND operation_token=?",size,key,token).run();
   if(!committed.meta.changes)throw fail('File commit requires recovery. Retry shortly.');
   return saved;
  },
  async delete(key){
   if(Array.isArray(key)){for(const k of key)await bucket.delete(k);return;}
   const workspace=objectWorkspace(key);await reconcileStorageObjects(env,{workspaceId:workspace});
   const row=await stmt(env,'SELECT * FROM workspace_storage_objects WHERE object_key=?',key).first();
   if(!row){await raw.delete(key);return;}
   const token=crypto.randomUUID();
   const reserved=await stmt(env,"UPDATE workspace_storage_objects SET state='deleting',operation_token=?,lease_until=? WHERE object_key=? AND state='ready'",token,Math.floor(Date.now()/1000)+900,key).run();
   if(!reserved.meta.changes)throw fail('A file operation is already in progress',409);
   await raw.delete(key);
   await stmt(env,'DELETE FROM workspace_storage_objects WHERE object_key=? AND operation_token=?',key,token).run();
  }
 };
 return {...env,WRITING_REFERENCES_BUCKET:bucket};
}
