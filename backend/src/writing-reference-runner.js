import {bookAnalysisWork,methodCatalogue} from './book-method-analysis.js';
import {BOOK_METHODS_VERSION} from './workspace-skill-plan.js';
import {generateSkillModule} from './workspace-skill-generation.js';
import {skillFailure} from './workspace-skill-errors.js';
import {boundedBookWork,acquireBookLock,releaseBookLock,processingProgress,BOOK_BATCH_SIZE,BOOK_WINDOW_MS,BOOK_LEASE_MS} from './book-processing.js';
import {readableWritingCoverage} from './writing-reference-coverage.js';
import {chunkWritingReference,analyseWritingReferenceChunk,aggregateWritingReference} from './writing-reference-analysis.js';
import {getWritingReference,cleanupWritingReference,recoverWritingReferenceUploads} from './writing-reference-store.js';
import {workspaceSkillGenerator} from './workspace-skill-provider.js';
import {creditFailure} from './provider-credit-health.js';
function analysisFailure(error){
 if(/WORKSPACE_STORAGE_FULL/.test(String(error?.message||'')))return 'Workspace storage is full. Completed sections are saved. Free space or upgrade storage, then retry.';
 const message=String(error?.message||''),http=message.match(/request failed \((\d+)\)/),status=Number(http?.[1]||0);
 if(creditFailure(status,message))return 'Analysis stopped: the AI provider reported exhausted credits or billing quota. Check billing for your active AI provider, then retry.';
 if(error?.name==='TimeoutError'||error?.name==='AbortError'||/timed out/i.test(message))return 'Analysis timed out. Completed sections are saved; retry to continue.';
 if(status===429)return 'Analysis paused by the AI provider rate limit. Wait briefly, then retry; this does not confirm exhausted credits.';
 if(status===401||status===403)return 'Analysis stopped: the AI provider rejected access. Check your active AI connection in Settings, then retry.';
 if(status===400||status===404)return 'Analysis stopped: the AI provider rejected the model or request. Check your active model in Settings, then retry.';
 if(status)return `Analysis stopped: AI provider request failed (${status}). Completed sections are saved; retry to continue.`;
 if(error?.status===503&&/active AI provider/.test(message))return message;
 if(/^(Technique response must be valid JSON|Invalid technique|Invalid technique response|Invalid skill module)/.test(message))return 'The AI provider returned invalid analysis output. Completed sections are saved; retry to continue.';
 if(message==='Extracted source is unavailable')return 'The extracted source is unavailable. Upload the source again.';
 return 'Analysis stopped because of an unexpected error. Completed sections are saved; retry to continue.';
}
const stmt=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
export async function writingReferenceProgress(env,scope,id){
 const source=await getWritingReference(env,scope,id);
 const object=await env.WRITING_REFERENCES_BUCKET.get(source.text_key);
 if(!object)return {completed:0,total:0};
 const job=await stmt(env,'SELECT * FROM writing_reference_jobs WHERE source_id=?',id).first();
 const total=job?.total||bookAnalysisWork(JSON.parse(await object.text())).length;
 const row=await stmt(env,"SELECT count(*) AS completed FROM writing_reference_chunks WHERE source_id=? AND status='Complete'",id).first();
 return processingProgress(job,Number(row.completed),total);
}

const guard=`EXISTS(SELECT 1 FROM writing_reference_jobs j JOIN writing_reference_sources s ON s.id=j.source_id JOIN writing_reference_slots p ON p.source_id=s.id WHERE j.source_id=? AND j.lease_id=? AND s.status='Processing')`;
export async function claimWritingReferenceJob(env,{now=Date.now(),leaseId=crypto.randomUUID(),leaseUntil=now+BOOK_LEASE_MS}={}){
 return stmt(env,`UPDATE writing_reference_jobs SET state='Running',lease_id=?,lease_until=?,attempts=attempts+1 WHERE source_id=(SELECT j.source_id FROM writing_reference_jobs j JOIN writing_reference_sources s ON s.id=j.source_id WHERE s.status='Processing' AND j.state IN ('Pending','Running') AND j.lease_until<? AND j.next_at<=? ORDER BY j.next_at LIMIT 1) AND lease_until<? RETURNING *`,leaseId,leaseUntil,now,now,now).first();
}
export async function retryWritingReference(env,scope,{id,expectedRevision}){
 const row=await getWritingReference(env,scope,id);if(row.revision!==Number(expectedRevision)||row.status!=='Failed')throw Object.assign(Error('Source changed or cannot be retried'),{status:409});
 await env.DB.batch([
  stmt(env,`UPDATE writing_reference_sources SET status='Processing',error_code='',revision=revision+1 WHERE id=? AND workspace_id=? AND revision=? AND status='Failed'`,id,scope.workspaceId,expectedRevision),
  stmt(env,`UPDATE writing_reference_jobs SET state='Pending',lease_until=0,next_at=0,retry_attempts=0 WHERE source_id=? AND EXISTS(SELECT 1 FROM writing_reference_sources WHERE id=? AND status='Processing')`,id,id),
  stmt(env,`UPDATE writing_reference_chunks SET attempts=0 WHERE source_id=? AND status<>'Complete'`,id)
 ]);return getWritingReference(env,scope,id);
}
export async function runWritingReferenceJobs(env,{now=Date.now(),maxJobs=1,maxChunks=BOOK_BATCH_SIZE,generate,clock=Date.now}={}){
 if(!env.WRITING_REFERENCES_BUCKET)return [];
 await recoverWritingReferenceUploads(env,now);
 const deleting=await stmt(env,"SELECT id,workspace_id FROM writing_reference_sources WHERE status='Deleting' LIMIT 6").all();
 for(const row of deleting.results)await cleanupWritingReference(env,{workspaceId:row.workspace_id},row.id).catch(()=>null);
 const results=[];
 for(let n=0;n<maxJobs;n++){
  const start=Math.max(now,clock()),job=await claimWritingReferenceJob(env,{now,leaseUntil:start+BOOK_LEASE_MS});if(!job)break;
  if(!await acquireBookLock(env,job.workspace_id,job.lease_id,start,start+BOOK_LEASE_MS)){await stmt(env,"UPDATE writing_reference_jobs SET state='Pending',lease_until=0,next_at=? WHERE source_id=? AND lease_id=?",start+1000,job.source_id,job.lease_id).run();continue;}
  let calls=0,prepared=false;
  try{
   const source=await getWritingReference(env,{workspaceId:job.workspace_id},job.source_id);
   const object=await env.WRITING_REFERENCES_BUCKET.get(source.text_key);if(!object)throw Error('Extracted source is unavailable');
   const extracted=JSON.parse(await object.text()),chunks=bookAnalysisWork(extracted);prepared=extracted.coverage?.methodPlan===BOOK_METHODS_VERSION;
   const prior=await stmt(env,'SELECT * FROM writing_reference_chunks WHERE source_id=?',source.id).all(),byId=new Map(prior.results.map(r=>[r.chunk_id,r]));
   const baseline=prior.results.filter(r=>r.status==='Complete').length;
   await stmt(env,`UPDATE writing_reference_jobs SET total=?,progress_baseline=CASE WHEN started_at=0 THEN ? ELSE progress_baseline END,started_at=CASE WHEN started_at=0 THEN ? ELSE started_at END WHERE source_id=? AND lease_id=?`,chunks.length,baseline,start,source.id,job.lease_id).run();
   const remaining=chunks.filter(w=>byId.get(w.id)?.status!=='Complete');
   const run=remaining.length?(generate||await workspaceSkillGenerator(env,job.workspace_id)):null;
   const outcome=await boundedBookWork(remaining.slice(0,maxChunks),async work=>{
    const prior=byId.get(work.id);if(Number(prior?.attempts||0)>=3)throw Error('Analysis retry limit reached');
    const reserved=await stmt(env,`INSERT INTO writing_reference_chunks(source_id,chunk_id,status,attempts) SELECT ?,?,'Running',1 WHERE ${guard} ON CONFLICT(source_id,chunk_id) DO UPDATE SET status='Running',attempts=attempts+1 WHERE attempts<3`,source.id,work.id,source.id,job.lease_id).run();
    if(!reserved.meta.changes)return;
    let value;try{calls++;value=prepared?{module:{...await generateSkillModule({chunk:work.chunk,index:work.index,generate:run}),id:work.id}}:await analyseWritingReferenceChunk({chunk:work.chunk,generate:run});}
    catch(error){error.sectionAttempts=Number(prior?.attempts||0)+1;throw error;}
    const saved=await stmt(env,`UPDATE writing_reference_chunks SET status='Complete',techniques_json=? WHERE source_id=? AND chunk_id=? AND ${guard}`,JSON.stringify(value),source.id,work.id,source.id,job.lease_id).run();
    if(saved.meta.changes)await stmt(env,'UPDATE writing_reference_jobs SET last_progress_at=? WHERE source_id=? AND lease_id=?',Math.max(start,clock()),source.id,job.lease_id).run();
   },{clock,deadline:start+BOOK_WINDOW_MS});
   if(outcome.errors.length)throw outcome.errors.find(e=>!skillFailure(e,'generate_section').retryable)||outcome.errors[0];
   const completed=await stmt(env,"SELECT chunk_id,techniques_json FROM writing_reference_chunks WHERE source_id=? AND status='Complete'",source.id).all();
   if(completed.results.length===chunks.length){
    const catalogue=methodCatalogue(extracted,chunks,completed.results),status=readableWritingCoverage(extracted.coverage)?'Ready':'Needs attention';
    const catalogueKey=source.original_key.replace(/original$/,'catalogue.json'),uploadId=crypto.randomUUID();
    await stmt(env,'INSERT INTO writing_reference_uploads(id,workspace_id,source_id,original_key,text_key,expires_at) VALUES(?,?,?,?,?,?)',uploadId,job.workspace_id,source.id,catalogueKey,'',Date.now()+600000).run();
    await env.WRITING_REFERENCES_BUCKET.put(catalogueKey,JSON.stringify(catalogue));
    const res=await env.DB.batch([
     stmt(env,`UPDATE writing_reference_sources SET status=?,error_code='',summary=?,techniques_json=?,catalogue_key=?,coverage_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND ${guard}`,status,catalogue.summary,JSON.stringify(catalogue.techniques.slice(0,20)),catalogueKey,JSON.stringify({...extracted.coverage,techniqueCount:catalogue.techniques.length,previewCount:Math.min(20,catalogue.techniques.length),skillPrepared:prepared}),source.id,source.id,job.lease_id),
     stmt(env,`UPDATE writing_reference_jobs SET state='Complete',lease_until=0 WHERE source_id=? AND lease_id=?`,source.id,job.lease_id)
    ]);results.push({id:source.id,status:res[0].meta.changes?status:'Discarded',calls});
    if(res[0].meta.changes)await stmt(env,'DELETE FROM writing_reference_uploads WHERE id=?',uploadId).run().catch(()=>null);
   }else{
    await stmt(env,`UPDATE writing_reference_sources SET error_code='' WHERE id=? AND ${guard}`,source.id,source.id,job.lease_id).run();
    await stmt(env,`UPDATE writing_reference_jobs SET state='Pending',lease_until=0,next_at=? WHERE source_id=? AND lease_id=?`,0,source.id,job.lease_id).run();results.push({id:source.id,status:'Processing',calls});
   }
  }catch(error){
   const diagnostic=skillFailure(error,'generate_section'),attempt=Math.max(Number(job.retry_attempts||0)+1,Number(error.sectionAttempts)||1),retry=prepared&&diagnostic.retryable&&attempt<3;
   const message=analysisFailure(error)+(retry?' Retrying automatically; saved sections are preserved.':'');
   await env.DB.batch([
    stmt(env,`UPDATE writing_reference_sources SET status=?,active=0,error_code=?,revision=revision+1 WHERE id=? AND ${guard}`,retry?'Processing':'Failed',message,job.source_id,job.source_id,job.lease_id),
    stmt(env,`UPDATE writing_reference_jobs SET state=?,retry_attempts=?,lease_until=0,next_at=? WHERE source_id=? AND lease_id=?`,retry?'Pending':'Failed',attempt,retry?Math.max(now,clock())+30000*2**(attempt-1):0,job.source_id,job.lease_id)
   ]);results.push({id:job.source_id,status:retry?'Processing':'Failed',calls});
  }finally{await releaseBookLock(env,job.workspace_id,job.lease_id);}
 }
 return results;
}
