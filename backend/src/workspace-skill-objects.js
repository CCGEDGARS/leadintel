// In-flight writes remain cleanup obligations until they finish or the maximum
// scheduled invocation lifetime expires. Versions fence concurrent cleanup.
export async function finishSkillWrite(env,skillId,key){
 return env.DB.prepare(`INSERT INTO workspace_skill_objects(skill_id,object_key,pending_until,cleanup_version) VALUES(?,?,0,1) ON CONFLICT(object_key) DO UPDATE SET pending_until=0,cleanup_version=cleanup_version+1 RETURNING cleanup_version`).bind(skillId,key).first();
}
export async function discardSkillObject(env,skillId,key){
 const row=await finishSkillWrite(env,skillId,key);
 try{await env.WRITING_REFERENCES_BUCKET.delete(key);}
 catch(error){await finishSkillWrite(env,skillId,key);throw error;}
 await env.DB.prepare('DELETE FROM workspace_skill_objects WHERE skill_id=? AND object_key=? AND cleanup_version=?').bind(skillId,key,row.cleanup_version).run();
}
