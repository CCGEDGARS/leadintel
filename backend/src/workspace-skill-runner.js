import {boundedBookWork,acquireBookLock,releaseBookLock,BOOK_BATCH_SIZE,BOOK_WINDOW_MS,BOOK_LEASE_MS} from './book-processing.js';
import {skillFailure,SKILL_MAX_ATTEMPTS} from './workspace-skill-errors.js';
import {skillStmt,cleanupWorkspaceSkill} from './workspace-skill-store.js';
import {skillWorkItems,SKILL_OUTPUTS_SQL,SKILL_SAVED_SECTIONS_SQL,preparedSkillModules,skillModuleId,skillRouting} from './workspace-skill-plan.js';
import {generateSkillModule} from './workspace-skill-generation.js';
import {buildSkillPackage} from './workspace-skill-export.js';
import {workspaceSkillGenerator,SKILL_REQUEST_TIMEOUT_MS} from './workspace-skill-provider.js';
async function releaseInput(env,row){if(!row.input_key)return;await env.WRITING_REFERENCES_BUCKET.delete(row.input_key);await skillStmt(env,"UPDATE workspace_skills SET input_key='' WHERE id=? AND status='Ready' AND input_key=?",row.id,row.input_key).run();}
const guard="id=? AND lease_id=? AND status='Processing'";
export async function runWorkspaceSkillJobs(env,{now=Date.now(),maxJobs=1,maxChunks=BOOK_BATCH_SIZE,generate,clock=Date.now}={}){
 if(!env.WRITING_REFERENCES_BUCKET)return [];
 const pendingDeletes=await skillStmt(env,"SELECT id FROM workspace_skills WHERE status='Deleting' LIMIT 1").all();for(const row of pendingDeletes.results)await cleanupWorkspaceSkill(env,row.id).catch(()=>null);
 // A lost upload request must not leave a permanent Preparing record.
 await skillStmt(env,"UPDATE workspace_skills SET status='Failed',error='Snapshot interrupted. Delete this skill and create it again.',revision=revision+1 WHERE status='Preparing' AND created_at<datetime('now','-10 minutes')").run();
 const released=await skillStmt(env,"SELECT id,input_key FROM workspace_skills WHERE status='Ready' AND input_key<>'' LIMIT 5").all();for(const row of released.results)await releaseInput(env,row).catch(()=>null);
 const unused=await skillStmt(env,"SELECT o.object_key FROM workspace_skill_objects o JOIN workspace_skills s ON s.id=o.skill_id WHERE s.status IN ('Ready','Failed','Deleted') AND o.object_key<>s.package_key AND NOT EXISTS(SELECT 1 FROM workspace_skill_chunks c WHERE c.object_key=o.object_key) AND NOT EXISTS(SELECT 1 FROM workspace_skill_parts p WHERE p.object_key=o.object_key) LIMIT 6").all();for(const row of unused.results){try{await env.WRITING_REFERENCES_BUCKET.delete(row.object_key);await skillStmt(env,'DELETE FROM workspace_skill_objects WHERE object_key=?',row.object_key).run();}catch{/* durable cleanup obligation remains */}}
 const outcomes=[];
 for(let n=0;n<maxJobs;n++){
  const start=Math.max(now,clock()),lease=crypto.randomUUID(),job=await skillStmt(env,`UPDATE workspace_skills SET lease_id=?,lease_until=? WHERE id=(SELECT id FROM workspace_skills WHERE status='Processing' AND lease_until<? AND next_at<=? ORDER BY next_at,created_at LIMIT 1) AND lease_until<? RETURNING *`,lease,start+BOOK_LEASE_MS,now,now,now).first();if(!job)break;
  if(!await acquireBookLock(env,job.workspace_id,lease,start,start+BOOK_LEASE_MS)){await skillStmt(env,`UPDATE workspace_skills SET lease_until=0,next_at=? WHERE ${guard}`,start+1000,job.id,lease).run();continue;}
  let calls=0,phase='load_book',consecutiveFailures=Number(job.retry_attempts)||0;
  try{
   const object=await env.WRITING_REFERENCES_BUCKET.get(job.input_key);if(!object)throw Error('SNAPSHOT_MISSING');const input=JSON.parse(await object.text());phase='read_progress';
   const legacy=await skillStmt(env,'SELECT chunk_index FROM workspace_skill_chunks WHERE skill_id=?',job.id).all(),chunks=skillWorkItems(input.extracted,legacy.results);
   const prior=await skillStmt(env,'SELECT chunk_index,part_index FROM workspace_skill_parts WHERE skill_id=?',job.id).all(),savedParts=new Set(prior.results.map(p=>`${p.chunk_index}:${p.part_index}`));
   const baseline=legacy.results.length+prior.results.length,cached=preparedSkillModules(input),fastCached=cached&&baseline===0;
   await skillStmt(env,`UPDATE workspace_skills SET total=?,progress_baseline=CASE WHEN started_at=0 THEN ? ELSE progress_baseline END,started_at=CASE WHEN started_at=0 THEN ? ELSE started_at END WHERE ${guard}`,chunks.length,baseline,start,job.id,lease).run();
   let run=generate;
   const missing=fastCached?[]:chunks.filter(w=>!w.legacy&&!savedParts.has(`${w.index}:${w.part}`)).slice(0,maxChunks);
   // Load configuration once before launching concurrent calls. Cached packaging needs no AI connection.
   if(missing.length){phase='connect_ai';run=run||await workspaceSkillGenerator(env,job.workspace_id);}
   const outcome=await boundedBookWork(missing,async work=>{
    const {index,part,chunk}=work;let localPhase='read_progress',sectionAttempts=0;
    try{
     if(!await skillStmt(env,`SELECT id FROM workspace_skills WHERE ${guard}`,job.id,lease).first())return;
     localPhase='generate_section';const attempt=await skillStmt(env,`INSERT INTO workspace_skill_attempts(skill_id,chunk_index,part_index,attempts) SELECT ?,?,?,1 WHERE EXISTS(SELECT 1 FROM workspace_skills WHERE ${guard}) ON CONFLICT(skill_id,chunk_index,part_index) DO UPDATE SET attempts=attempts+1 WHERE attempts<3 RETURNING attempts`,job.id,index,part,job.id,lease).first();if(!attempt)throw Error('SKILL_SECTION_RETRY_LIMIT');sectionAttempts=Number(attempt.attempts);calls++;const module=await generateSkillModule({chunk,index,catalogue:input.catalogue,generate:run});module.id=skillModuleId(index,part);
     const key=`skills/${job.workspace_id}/${job.id}/${module.id}-${lease}.json`;
     localPhase='save_section';const reserved=await skillStmt(env,`INSERT INTO workspace_skill_objects(skill_id,object_key) SELECT ?,? WHERE EXISTS(SELECT 1 FROM workspace_skills WHERE ${guard})`,job.id,key,job.id,lease).run();if(!reserved.meta.changes)return;
     await env.WRITING_REFERENCES_BUCKET.put(key,JSON.stringify(module));
     const saved=await skillStmt(env,`INSERT INTO workspace_skill_parts(skill_id,chunk_index,part_index,object_key) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM workspace_skills WHERE ${guard}) ON CONFLICT DO NOTHING`,job.id,index,part,key,job.id,lease).run();
     if(!saved.meta.changes)await env.WRITING_REFERENCES_BUCKET.delete(key);
     else{consecutiveFailures=0;await skillStmt(env,`UPDATE workspace_skills SET retry_attempts=0,error='',error_code='',error_phase='',last_progress_at=? WHERE ${guard}`,Math.max(start,clock()),job.id,lease).run();}
    }catch(error){error.skillPhase=localPhase;error.sectionAttempts=sectionAttempts;throw error;}
   },{clock,deadline:start+BOOK_WINDOW_MS});
   if(outcome.errors.length)throw outcome.errors.find(e=>!skillFailure(e,e.skillPhase).retryable)||outcome.errors[0];
   phase='assemble_skill';const completed=await skillStmt(env,SKILL_OUTPUTS_SQL,job.id,job.id).all();
   if(fastCached||completed.results.length===chunks.length){
    const modules=fastCached?[...cached]:[];for(const row of fastCached?[]:completed.results){const value=await env.WRITING_REFERENCES_BUCKET.get(row.object_key);if(!value)throw Error('MODULE_MISSING');modules.push(JSON.parse(await value.text()));}
    phase='publish_skill';const pkg=buildSkillPackage(input,modules),key=`skills/${job.workspace_id}/${job.id}/package-${lease}.json`;
    const reserved=await skillStmt(env,`INSERT INTO workspace_skill_objects(skill_id,object_key) SELECT ?,? WHERE EXISTS(SELECT 1 FROM workspace_skills WHERE ${guard})`,job.id,key,job.id,lease).run();if(!reserved.meta.changes){outcomes.push({id:job.id,status:'Discarded',calls});continue;}
    await env.WRITING_REFERENCES_BUCKET.put(key,JSON.stringify(pkg));
    const saved=await skillStmt(env,`UPDATE workspace_skills SET status='Ready',retry_attempts=0,error='',error_code='',error_phase='',package_key=?,routing_json=?,description=?,completed=?,prepared_count=?,last_progress_at=?,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE ${guard}`,key,JSON.stringify(skillRouting(modules)),modules.slice(0,3).map(m=>m.purpose).join(' ').slice(0,1000),chunks.length,fastCached?cached.length:0,Math.max(start,clock()),job.id,lease).run();if(!saved.meta.changes)await env.WRITING_REFERENCES_BUCKET.delete(key);else await releaseInput(env,job).catch(()=>null);outcomes.push({id:job.id,status:saved.meta.changes?'Ready':'Discarded',calls});
   }else{await skillStmt(env,`UPDATE workspace_skills SET completed=?,lease_until=0,next_at=? WHERE ${guard}`,completed.results.length,0,job.id,lease).run();outcomes.push({id:job.id,status:'Processing',calls});}
  }catch(error){
   phase=error.skillPhase||phase;const diagnostic=skillFailure(error,phase),attempt=Math.max(consecutiveFailures+1,Number(error.sectionAttempts)||0),retry=diagnostic.retryable&&attempt<SKILL_MAX_ATTEMPTS;
   const message=diagnostic.message+(retry?` Will retry automatically (${attempt}/${SKILL_MAX_ATTEMPTS}).`:`${attempt>=SKILL_MAX_ATTEMPTS?' Automatic retries stopped after three attempts.':''} Completed sections are saved.`);
   const progress=await skillStmt(env,`SELECT ${SKILL_SAVED_SECTIONS_SQL} AS n FROM workspace_skills s WHERE id=?`,job.id).first().catch(()=>null);
   const nextAt=retry?Math.max(now,clock())+30000*2**(attempt-1):0;
   const saved=await skillStmt(env,`UPDATE workspace_skills SET status=?,error=?,error_code=?,error_phase=?,retry_attempts=?,completed=?,next_at=?,lease_until=0,revision=revision+1 WHERE ${guard}`,retry?'Processing':'Failed',message,diagnostic.code,phase,attempt,Number(progress?.n??job.completed)||0,nextAt,job.id,lease).run();
   if(saved.meta.changes)console.warn('workspace_skill_failure',JSON.stringify({skillId:job.id,code:diagnostic.code,phase,attempt,retry}));
   outcomes.push({id:job.id,status:saved.meta.changes?(retry?'Processing':'Failed'):'Discarded',calls,error_code:diagnostic.code});
  }finally{await releaseBookLock(env,job.workspace_id,lease);}
 }
 return outcomes;
}
