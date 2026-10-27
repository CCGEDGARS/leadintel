import {skillStmt,cleanupWorkspaceSkill} from './workspace-skill-store.js';
import {chunkWritingReference} from './writing-reference-analysis.js';
import {generateSkillModule} from './workspace-skill-generation.js';
import {buildSkillPackage} from './workspace-skill-export.js';
import {workspaceSkillGenerator} from './workspace-skill-provider.js';
async function releaseInput(env,row){if(!row.input_key)return;await env.WRITING_REFERENCES_BUCKET.delete(row.input_key);await skillStmt(env,"UPDATE workspace_skills SET input_key='' WHERE id=? AND status='Ready' AND input_key=?",row.id,row.input_key).run();}
const guard="id=? AND lease_id=? AND status='Processing'";
export async function runWorkspaceSkillJobs(env,{now=Date.now(),maxJobs=1,maxChunks=2,generate}={}){
 if(!env.WRITING_REFERENCES_BUCKET)return [];
 const pendingDeletes=await skillStmt(env,"SELECT id FROM workspace_skills WHERE status='Deleting' LIMIT 5").all();for(const row of pendingDeletes.results)await cleanupWorkspaceSkill(env,row.id).catch(()=>null);
 // A lost upload request must not leave a permanent Preparing record.
 await skillStmt(env,"UPDATE workspace_skills SET status='Failed',error='Snapshot interrupted. Delete this skill and create it again.',revision=revision+1 WHERE status='Preparing' AND created_at<datetime('now','-10 minutes')").run();
 const released=await skillStmt(env,"SELECT id,input_key FROM workspace_skills WHERE status='Ready' AND input_key<>'' LIMIT 5").all();for(const row of released.results)await releaseInput(env,row).catch(()=>null);
 const unused=await skillStmt(env,"SELECT o.object_key FROM workspace_skill_objects o JOIN workspace_skills s ON s.id=o.skill_id WHERE s.status IN ('Ready','Failed','Deleted') AND o.object_key<>s.package_key AND NOT EXISTS(SELECT 1 FROM workspace_skill_chunks c WHERE c.object_key=o.object_key) LIMIT 6").all();for(const row of unused.results){try{await env.WRITING_REFERENCES_BUCKET.delete(row.object_key);await skillStmt(env,'DELETE FROM workspace_skill_objects WHERE object_key=?',row.object_key).run();}catch{/* durable cleanup obligation remains */}}
 const outcomes=[];
 for(let n=0;n<maxJobs;n++){
  const lease=crypto.randomUUID(),job=await skillStmt(env,`UPDATE workspace_skills SET lease_id=?,lease_until=? WHERE id=(SELECT id FROM workspace_skills WHERE status='Processing' AND lease_until<? AND next_at<=? ORDER BY next_at,created_at LIMIT 1) AND lease_until<? RETURNING *`,lease,now+180000,now,now,now).first();if(!job)break;
  let calls=0;
  try{
   const object=await env.WRITING_REFERENCES_BUCKET.get(job.input_key);if(!object)throw Error('SNAPSHOT_MISSING');const input=JSON.parse(await object.text()),chunks=chunkWritingReference(input.extracted),run=generate||await workspaceSkillGenerator(env,job.workspace_id);
   for(const [index,chunk] of chunks.entries()){
    if(calls>=maxChunks)break;if(await skillStmt(env,'SELECT object_key FROM workspace_skill_chunks WHERE skill_id=? AND chunk_index=?',job.id,index).first())continue;
    if(!await skillStmt(env,`SELECT id FROM workspace_skills WHERE ${guard}`,job.id,lease).first())break;
    calls++;const module=await generateSkillModule({chunk,index,catalogue:input.catalogue,generate:run}),key=`skills/${job.workspace_id}/${job.id}/${module.id}-${lease}.json`;
    const reserved=await skillStmt(env,`INSERT INTO workspace_skill_objects(skill_id,object_key) SELECT ?,? WHERE EXISTS(SELECT 1 FROM workspace_skills WHERE ${guard})`,job.id,key,job.id,lease).run();if(!reserved.meta.changes)break;
    await env.WRITING_REFERENCES_BUCKET.put(key,JSON.stringify(module));
    const saved=await skillStmt(env,`INSERT INTO workspace_skill_chunks(skill_id,chunk_index,object_key) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM workspace_skills WHERE ${guard}) ON CONFLICT DO NOTHING`,job.id,index,key,job.id,lease).run();if(!saved.meta.changes)await env.WRITING_REFERENCES_BUCKET.delete(key);
   }
   const completed=await skillStmt(env,'SELECT object_key FROM workspace_skill_chunks WHERE skill_id=? ORDER BY chunk_index',job.id).all();
   if(completed.results.length===chunks.length){
    const modules=[];for(const row of completed.results){const value=await env.WRITING_REFERENCES_BUCKET.get(row.object_key);if(!value)throw Error('MODULE_MISSING');modules.push(JSON.parse(await value.text()));}
    const pkg=buildSkillPackage(input,modules),key=`skills/${job.workspace_id}/${job.id}/package-${lease}.json`;
    const reserved=await skillStmt(env,`INSERT INTO workspace_skill_objects(skill_id,object_key) SELECT ?,? WHERE EXISTS(SELECT 1 FROM workspace_skills WHERE ${guard})`,job.id,key,job.id,lease).run();if(!reserved.meta.changes){outcomes.push({id:job.id,status:'Discarded',calls});continue;}
    await env.WRITING_REFERENCES_BUCKET.put(key,JSON.stringify(pkg));
    const saved=await skillStmt(env,`UPDATE workspace_skills SET status='Ready',package_key=?,routing_json=?,description=?,completed=?,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE ${guard}`,key,JSON.stringify(modules.map(m=>({id:m.id,title:m.title,purpose:m.purpose.slice(0,300),triggers:m.triggers}))),modules.slice(0,3).map(m=>m.purpose).join(' ').slice(0,1000),chunks.length,job.id,lease).run();if(!saved.meta.changes)await env.WRITING_REFERENCES_BUCKET.delete(key);else await releaseInput(env,job).catch(()=>null);outcomes.push({id:job.id,status:saved.meta.changes?'Ready':'Discarded',calls});
   }else{await skillStmt(env,`UPDATE workspace_skills SET completed=?,lease_until=0,next_at=? WHERE ${guard}`,completed.results.length,now+1000,job.id,lease).run();outcomes.push({id:job.id,status:'Processing',calls});}
  }catch(error){const message=/WORKSPACE_STORAGE_FULL/.test(error.message)?'Workspace storage is full. Free space or upgrade storage, then retry. Completed sections are saved.':error.status===503&&/active AI provider/.test(error.message)?'Connect an active AI provider in Settings, then retry.':/quota|billing|insufficient_quota/i.test(error.message)?'Your AI provider reported a billing or quota issue. Check your provider account, then retry.':/Invalid skill module/.test(error.message)?'The AI returned incomplete skill content. Completed sections are saved; retry to continue.':'Skill creation was interrupted. Completed sections are saved. Check your AI connection and retry.';await skillStmt(env,`UPDATE workspace_skills SET status='Failed',error=?,lease_until=0,revision=revision+1 WHERE ${guard}`,message,job.id,lease).run();outcomes.push({id:job.id,status:'Failed',calls});}
 }
 return outcomes;
}
