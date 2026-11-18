import {readStoredPayload} from './workspace-record-store.js';
export function versionWrite(env,{workspaceId,flowId,version,name,payload,config,userId}){
 return env.DB.prepare('INSERT INTO saved_flow_versions(workspace_id,flow_id,version,name,payload_json,config_json,created_by) VALUES(?,?,?,?,?,?,?)').bind(workspaceId,flowId,version,name,payload,config,userId);
}
export async function listFlowVersions(env,workspace,id){
 return (await env.DB.prepare('SELECT version,name,created_at FROM saved_flow_versions WHERE workspace_id=? AND flow_id=? ORDER BY version DESC LIMIT 50').bind(workspace,id).all()).results;
}
export async function getFlowVersion(env,workspace,id,version){
 if(!Number.isSafeInteger(version)||version<1)throw Error('Choose a saved workflow version');
 const row=await env.DB.prepare('SELECT * FROM saved_flow_versions WHERE workspace_id=? AND flow_id=? AND version=?').bind(workspace,id,version).first();
 if(!row)throw Error('Saved workflow version not found');
 return {...row,payload:await readStoredPayload(env,workspace,row.payload_json)};
}
