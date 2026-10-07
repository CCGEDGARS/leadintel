import {validateOriginalScriptsWrite} from './original-scripts-policy.js';
export async function putCustomerProjectState(env,{projectId,userId,role,body}){
 const existing=await env.DB.prepare('SELECT version,payload_json FROM customer_project_state WHERE project_id=?').bind(projectId).first();const expected=Number(body.version);
 if(!Number.isSafeInteger(expected)||expected<1)throw Error('Customer project state version is required');
 if(existing&&Number(existing.version)!==expected)return {conflict:true,current:existing};
 validateOriginalScriptsWrite(existing?JSON.parse(existing.payload_json||'{}'):{},body.payload,role);const version=existing?expected+1:1,schema=Number(body.schema_version||1);let result;
 if(existing)result=await env.DB.prepare('UPDATE customer_project_state SET schema_version=?,version=?,payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE project_id=? AND version=?').bind(schema,version,JSON.stringify(body.payload),userId,projectId,expected).run();
 else result=await env.DB.prepare('INSERT OR IGNORE INTO customer_project_state(project_id,schema_version,version,payload_json,updated_by,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)').bind(projectId,schema,version,JSON.stringify(body.payload),userId).run();
 if(Number(result?.meta?.changes||0)<1)return {conflict:true,current:await env.DB.prepare('SELECT version FROM customer_project_state WHERE project_id=?').bind(projectId).first()};return {state:{project_id:projectId,schema_version:schema,version,payload:body.payload,updated_by:userId}};
}
