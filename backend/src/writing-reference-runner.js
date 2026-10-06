import {chunkWritingReference,analyseWritingReferenceChunk,aggregateWritingReference} from './writing-reference-analysis.js';
import {getWritingReference,cleanupWritingReference,recoverWritingReferenceUploads} from './writing-reference-store.js';
import {importAesKey,decryptSecret} from './oauth.js';
import {generateText} from './ai-provider.js';
const stmt=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
const guard=`EXISTS(SELECT 1 FROM writing_reference_jobs j JOIN writing_reference_sources s ON s.id=j.source_id JOIN writing_reference_slots p ON p.source_id=s.id WHERE j.source_id=? AND j.lease_id=? AND s.status='Processing')`;
export async function claimWritingReferenceJob(env,{now=Date.now(),leaseId=crypto.randomUUID()}={}){
 return stmt(env,`UPDATE writing_reference_jobs SET state='Running',lease_id=?,lease_until=?,attempts=attempts+1 WHERE source_id=(SELECT j.source_id FROM writing_reference_jobs j JOIN writing_reference_sources s ON s.id=j.source_id WHERE s.status='Processing' AND j.state IN ('Pending','Running') AND j.lease_until<? AND j.next_at<=? ORDER BY j.next_at LIMIT 1) AND lease_until<? RETURNING *`,leaseId,now+90000,now,now,now).first();
}
async function workspaceGenerate(env,workspaceId){
 const row=await stmt(env,'SELECT provider,model,encrypted_api_key FROM workspace_ai_integrations WHERE workspace_id=? AND active=1 LIMIT 1',workspaceId).first();
 if(!row||!env.OAUTH_TOKEN_ENCRYPTION_KEY)throw Error('Connect an active AI provider in Settings');
 const key=await importAesKey(env.OAUTH_TOKEN_ENCRYPTION_KEY),apiKey=await decryptSecret(row.encrypted_api_key,key);
 return input=>generateText({provider:row.provider,model:row.model,apiKey,...input,signal:AbortSignal.timeout(12000)});
}
export async function retryWritingReference(env,scope,{id,expectedRevision}){
 const row=await getWritingReference(env,scope,id);if(row.revision!==Number(expectedRevision)||row.status!=='Failed')throw Object.assign(Error('Source changed or cannot be retried'),{status:409});
 await env.DB.batch([
  stmt(env,`UPDATE writing_reference_sources SET status='Processing',error_code='',revision=revision+1 WHERE id=? AND workspace_id=? AND revision=? AND status='Failed'`,id,scope.workspaceId,expectedRevision),
  stmt(env,`UPDATE writing_reference_jobs SET state='Pending',lease_until=0,next_at=0 WHERE source_id=? AND EXISTS(SELECT 1 FROM writing_reference_sources WHERE id=? AND status='Processing')`,id,id),
  stmt(env,`UPDATE writing_reference_chunks SET attempts=0 WHERE source_id=? AND status<>'Complete'`,id)
 ]);return getWritingReference(env,scope,id);
}
export async function runWritingReferenceJobs(env,{now=Date.now(),maxJobs=1,maxChunks=2,generate}={}){
 if(!env.WRITING_REFERENCES_BUCKET)return [];
 await recoverWritingReferenceUploads(env,now);
 const deleting=await stmt(env,"SELECT id,workspace_id FROM writing_reference_sources WHERE status='Deleting' LIMIT 6").all();
 for(const row of deleting.results)await cleanupWritingReference(env,{workspaceId:row.workspace_id},row.id).catch(()=>null);
 const results=[];
 for(let n=0;n<maxJobs;n++){
  const job=await claimWritingReferenceJob(env,{now});if(!job)break;
  let calls=0;
  try{
   const source=await getWritingReference(env,{workspaceId:job.workspace_id},job.source_id);
   const object=await env.WRITING_REFERENCES_BUCKET.get(source.text_key);if(!object)throw Error('Extracted source is unavailable');
   const extracted=JSON.parse(await object.text()),chunks=chunkWritingReference(extracted);
   const run=generate||await workspaceGenerate(env,job.workspace_id);
   for(const chunk of chunks){
    if(calls>=maxChunks)break;
    const prior=await stmt(env,'SELECT * FROM writing_reference_chunks WHERE source_id=? AND chunk_id=?',source.id,chunk.id).first();if(prior?.status==='Complete')continue;
    if(Number(prior?.attempts||0)>=3)throw Error('Analysis retry limit reached');
    const reserved=await stmt(env,`INSERT INTO writing_reference_chunks(source_id,chunk_id,status,attempts) SELECT ?,?,'Running',1 WHERE ${guard} ON CONFLICT(source_id,chunk_id) DO UPDATE SET status='Running',attempts=attempts+1 WHERE attempts<3`,source.id,chunk.id,source.id,job.lease_id).run();
    if(!reserved.meta.changes)break;calls++;
    const techniques=await analyseWritingReferenceChunk({chunk,generate:run});
    await stmt(env,`UPDATE writing_reference_chunks SET status='Complete',techniques_json=? WHERE source_id=? AND chunk_id=? AND ${guard}`,JSON.stringify(techniques),source.id,chunk.id,source.id,job.lease_id).run();
   }
   const completed=await stmt(env,"SELECT techniques_json FROM writing_reference_chunks WHERE source_id=? AND status='Complete'",source.id).all();
   if(completed.results.length===chunks.length){
    const catalogue=aggregateWritingReference(completed.results.map(row=>JSON.parse(row.techniques_json))),status=extracted.coverage.unreadable?'Needs attention':'Ready';
    const catalogueKey=source.original_key.replace(/original$/,'catalogue.json'),uploadId=crypto.randomUUID();
    await stmt(env,'INSERT INTO writing_reference_uploads(id,workspace_id,source_id,original_key,text_key,expires_at) VALUES(?,?,?,?,?,?)',uploadId,job.workspace_id,source.id,catalogueKey,'',Date.now()+600000).run();
    await env.WRITING_REFERENCES_BUCKET.put(catalogueKey,JSON.stringify(catalogue));
    const res=await env.DB.batch([
     stmt(env,`UPDATE writing_reference_sources SET status=?,summary=?,techniques_json=?,catalogue_key=?,coverage_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND ${guard}`,status,catalogue.summary,JSON.stringify(catalogue.techniques.slice(0,20)),catalogueKey,JSON.stringify({...extracted.coverage,techniqueCount:catalogue.techniques.length,previewCount:Math.min(20,catalogue.techniques.length)}),source.id,source.id,job.lease_id),
     stmt(env,`UPDATE writing_reference_jobs SET state='Complete',lease_until=0 WHERE source_id=? AND lease_id=?`,source.id,job.lease_id)
    ]);results.push({id:source.id,status:res[0].meta.changes?status:'Discarded',calls});
    if(res[0].meta.changes)await stmt(env,'DELETE FROM writing_reference_uploads WHERE id=?',uploadId).run().catch(()=>null);
   }else{
    await stmt(env,`UPDATE writing_reference_jobs SET state='Pending',lease_until=0,next_at=? WHERE source_id=? AND lease_id=?`,now+30000,source.id,job.lease_id).run();results.push({id:source.id,status:'Processing',calls});
   }
  }catch{
   // Never log provider text or document contents; expose only an actionable fixed message.
   await env.DB.batch([
    stmt(env,`UPDATE writing_reference_sources SET status='Failed',active=0,error_code='Analysis failed. Check your AI connection or quota, then retry.',revision=revision+1 WHERE id=? AND ${guard}`,job.source_id,job.source_id,job.lease_id),
    stmt(env,`UPDATE writing_reference_jobs SET state='Failed',lease_until=0 WHERE source_id=? AND lease_id=?`,job.source_id,job.lease_id)
   ]);results.push({id:job.source_id,status:'Failed',calls});
  }
 }
 return results;
}
