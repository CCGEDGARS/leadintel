import {finishSkillWrite,discardSkillObject} from './workspace-skill-objects.js';
import {processingProgress} from './book-processing.js';
import {getWritingReference} from './writing-reference-store.js';
import {skillWorkItems,SKILL_SAVED_SECTIONS_SQL} from './workspace-skill-plan.js';
export const WORKSPACE_SKILLS_VERSION='20261027-book-skills-v1';
export const SKILL_LIMIT=30;
export const skillStmt=(env,sql,...values)=>env.DB.prepare(sql).bind(...values);
export const skillFail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function scoped(scope){if(!scope?.workspaceId)skillFail('Authenticated workspace required',401);}
function decode(row){return {...row,enabled:Boolean(row.enabled),coverage:JSON.parse(row.coverage_json||'{}'),routing:JSON.parse(row.routing_json||'[]')};}
export function publicSkill(row){return {progress:processingProgress(row,Number(row.saved_sections??row.completed)||0,row.total),id:row.id,title:row.title,status:row.status,enabled:row.enabled,revision:row.revision,description:row.description,coverage:row.coverage,completed:Number(row.saved_sections??row.completed)||0,total:row.total,error:!row.error_code&&row.error==='Skill creation was interrupted. Completed sections are saved. Check your AI connection and retry.'?'Skill creation stopped, but its original failure detail was not recorded. Completed sections are preserved. Retry creation to continue.':row.error,errorCode:row.error_code||'',errorPhase:row.error_phase||'',retryAttempts:Number(row.retry_attempts)||0,nextRetryAt:Number(row.next_at)||0,sourceId:row.source_id,sourceFilename:row.source_filename,createdAt:row.created_at};}
export async function listWorkspaceSkills(env,scope){scoped(scope);const rows=await skillStmt(env,`SELECT s.*,${SKILL_SAVED_SECTIONS_SQL} AS saved_sections FROM workspace_skills s WHERE workspace_id=? AND status NOT IN ('Deleted','Deleting') ORDER BY created_at,id`,scope.workspaceId).all();return rows.results.map(decode);}
export async function getWorkspaceSkill(env,scope,id){scoped(scope);const row=await skillStmt(env,`SELECT s.*,${SKILL_SAVED_SECTIONS_SQL} AS saved_sections FROM workspace_skills s WHERE workspace_id=? AND id=? AND status NOT IN ('Deleted','Deleting')`,scope.workspaceId,id).first();if(!row)skillFail('Skill not found',404);return decode(row);}
export async function createWorkspaceSkill(env,scope,{sourceId,expectedRevision}){
 scoped(scope);if(!Number.isInteger(expectedRevision))skillFail('Book revision is required',400);
 const source=await getWritingReference(env,scope,sourceId);
 if(source.revision!==expectedRevision)skillFail('Book changed. Refresh and try again.');
 if(source.status!=='Ready'||!source.summary?.trim()||!source.catalogue_key)skillFail('Complete book analysis and review its summary before creating a skill.');
 if(source.coverage?.requiresReview&&!source.coverage.reviewAccepted)skillFail('Review the extracted book before creating a skill.');
 const prior=await skillStmt(env,"SELECT * FROM workspace_skills WHERE workspace_id=? AND source_hash=? AND status NOT IN ('Deleted','Deleting')",scope.workspaceId,source.content_hash).first();if(prior)return decode(prior);
 const [textObject,catalogueObject]=await Promise.all([env.WRITING_REFERENCES_BUCKET.get(source.text_key),env.WRITING_REFERENCES_BUCKET.get(source.catalogue_key)]);
 if(!textObject||!catalogueObject)skillFail('The complete analysed book content is unavailable. Upload and analyse the book again.',422);
 const extracted=JSON.parse(await textObject.text()),catalogue=JSON.parse(await catalogueObject.text()),chunks=skillWorkItems(extracted);
 if(!chunks.length||!Array.isArray(catalogue.techniques)||!catalogue.techniques.length)skillFail('Book analysis contains no usable methods. Review or retry analysis.',422);
 const id=crypto.randomUUID(),inputKey=`skills/${scope.workspaceId}/${id}/input.json`,title=String(source.presentation?.title||source.filename||'Untitled').replace(/\.(pdf|txt|md|markdown)$/i,'').trim().slice(0,240);
 let inserted;
 try{inserted=await skillStmt(env,`INSERT INTO workspace_skills(id,workspace_id,title,source_hash,source_id,source_revision,source_filename,input_key,coverage_json,description,total) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM writing_reference_sources s JOIN writing_reference_slots p ON p.source_id=s.id WHERE s.id=? AND s.workspace_id=? AND s.revision=? AND s.status='Ready') ON CONFLICT DO NOTHING`,id,scope.workspaceId,title,source.content_hash,source.id,source.revision,source.filename,inputKey,JSON.stringify(source.coverage),source.summary.slice(0,1000),chunks.length,source.id,scope.workspaceId,source.revision).run();}
 catch(error){if(/limit is 30/i.test(error.message)){const duplicate=await skillStmt(env,"SELECT * FROM workspace_skills WHERE workspace_id=? AND source_hash=? AND status NOT IN ('Deleted','Deleting')",scope.workspaceId,source.content_hash).first();if(duplicate)return decode(duplicate);skillFail('Your Skill Library is full (30 skills). Download and delete a skill to make room.');}throw error;}
 if(!inserted.meta.changes){const duplicate=await skillStmt(env,"SELECT * FROM workspace_skills WHERE workspace_id=? AND source_hash=? AND status NOT IN ('Deleted','Deleting')",scope.workspaceId,source.content_hash).first();if(duplicate)return decode(duplicate);skillFail('Book changed. Refresh and try again.');}
 try{
  const reserved=await skillStmt(env,"INSERT INTO workspace_skill_objects(skill_id,object_key,pending_until) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM workspace_skills WHERE id=? AND status='Preparing')",id,inputKey,Date.now()+900000,id).run();if(!reserved.meta.changes)skillFail('Skill creation was cancelled.');
  await env.WRITING_REFERENCES_BUCKET.put(inputKey,JSON.stringify({title,filename:source.filename,hash:source.content_hash,coverage:source.coverage,extracted,catalogue}));await finishSkillWrite(env,id,inputKey);
  const saved=await skillStmt(env,"UPDATE workspace_skills SET status='Processing',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='Preparing'",id).run();
  if(!saved.meta.changes){await discardSkillObject(env,id,inputKey);skillFail('Skill creation was cancelled.');}
 }catch(error){await finishSkillWrite(env,id,inputKey).catch(()=>null);await skillStmt(env,"UPDATE workspace_skills SET status='Failed',error='The book snapshot could not be saved. Delete this skill and try again.',revision=revision+1 WHERE id=? AND status='Preparing'",id).run();throw error;}
 return getWorkspaceSkill(env,scope,id);
}
export async function cleanupWorkspaceSkill(env,id){
 const row=await skillStmt(env,"SELECT * FROM workspace_skills WHERE id=? AND status='Deleting'",id).first();if(!row)return;
 // Bound each pass, and forget a key only after its physical deletion succeeds.
 // This prevents large skills from restarting the same exhausted deletion loop.
 const keys=await skillStmt(env,`SELECT object_key FROM (
  SELECT input_key AS object_key FROM workspace_skills WHERE id=?
  UNION SELECT package_key FROM workspace_skills WHERE id=?
  UNION SELECT object_key FROM workspace_skill_chunks WHERE skill_id=?
  UNION SELECT object_key FROM workspace_skill_parts WHERE skill_id=?
  UNION SELECT object_key FROM workspace_skill_objects WHERE skill_id=?
 ) WHERE object_key<>'' LIMIT 40`,id,id,id,id,id).all();
 for(const {object_key:key} of keys.results){
  if(env.bookInvocationBudget&&!env.bookInvocationBudget.hasRoom(64))break;
  const tracking=await skillStmt(env,'SELECT cleanup_version,pending_until FROM workspace_skill_objects WHERE skill_id=? AND object_key=?',id,key).first();
  await env.WRITING_REFERENCES_BUCKET.delete(key);
  await env.DB.batch([
   skillStmt(env,'DELETE FROM workspace_skill_objects WHERE skill_id=? AND object_key=? AND cleanup_version=? AND pending_until<=?',id,key,Number(tracking?.cleanup_version)||0,Date.now()),
   skillStmt(env,'DELETE FROM workspace_skill_parts WHERE skill_id=? AND object_key=?',id,key),
   skillStmt(env,'DELETE FROM workspace_skill_chunks WHERE skill_id=? AND object_key=?',id,key),
   skillStmt(env,"UPDATE workspace_skills SET input_key=CASE WHEN input_key=? THEN '' ELSE input_key END,package_key=CASE WHEN package_key=? THEN '' ELSE package_key END WHERE id=? AND status='Deleting'",key,key,id)
  ]);
 }
 const remaining=await skillStmt(env,`SELECT 1 FROM workspace_skill_objects WHERE skill_id=?
  UNION ALL SELECT 1 FROM workspace_skill_parts WHERE skill_id=?
  UNION ALL SELECT 1 FROM workspace_skill_chunks WHERE skill_id=?
  UNION ALL SELECT 1 FROM workspace_skills WHERE id=? AND (input_key<>'' OR package_key<>'') LIMIT 1`,id,id,id,id).first();
 if(remaining)return;
 await skillStmt(env,'DELETE FROM workspace_skill_attempts WHERE skill_id=?',id).run();
 await skillStmt(env,"UPDATE workspace_skills SET status='Deleted',title='',source_id='',source_filename='',description='',routing_json='[]',coverage_json='{}',error='' WHERE id=? AND status='Deleting'",id).run();
}
export async function mutateWorkspaceSkill(env,scope,id,body){
 const row=await getWorkspaceSkill(env,scope,id);if(!Number.isInteger(body.expectedRevision)||row.revision!==body.expectedRevision)skillFail('Skill changed. Refresh and try again.');
 if(body.delete===true){const result=await skillStmt(env,"UPDATE workspace_skills SET status='Deleting',enabled=0,revision=revision+1,lease_id='',lease_until=0 WHERE id=? AND workspace_id=? AND revision=?",id,scope.workspaceId,body.expectedRevision).run();if(!result.meta.changes)skillFail('Skill changed. Refresh and try again.');await cleanupWorkspaceSkill(env,id);return null;}
 if(body.retry===true){if(row.status!=='Failed')skillFail('Only failed skills can be retried.');if(!await env.WRITING_REFERENCES_BUCKET.get(row.input_key))skillFail('Book snapshot unavailable. Delete this skill and create it again.');const results=await env.DB.batch([skillStmt(env,"DELETE FROM workspace_skill_attempts WHERE skill_id=? AND EXISTS(SELECT 1 FROM workspace_skills WHERE id=? AND workspace_id=? AND revision=? AND status='Failed')",id,id,scope.workspaceId,body.expectedRevision),skillStmt(env,"UPDATE workspace_skills SET status='Processing',error='',error_code='',error_phase='',retry_attempts=0,revision=revision+1,lease_id='',lease_until=0,next_at=0 WHERE id=? AND workspace_id=? AND revision=? AND status='Failed'",id,scope.workspaceId,body.expectedRevision)]);if(!results[1].meta.changes)skillFail('Skill changed. Refresh and try again.');}
 else{if(typeof body.enabled!=='boolean')skillFail('Choose whether the skill is enabled',400);const result=await skillStmt(env,'UPDATE workspace_skills SET enabled=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=?',body.enabled?1:0,id,scope.workspaceId,body.expectedRevision).run();if(!result.meta.changes)skillFail('Skill changed. Refresh and try again.');}
 return getWorkspaceSkill(env,scope,id);
}
