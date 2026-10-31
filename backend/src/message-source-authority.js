import Outreach from '../../customer/outreach-engine.js';
import {readOwnedPayload} from './workspace-record-store.js';
const fail=()=>{throw Object.assign(Error('The reviewed Profile, Strategy or sender context changed or is unapproved. Review the current message before delivery; saved work is retained.'),{status:409,code:'MESSAGE_SOURCE_APPROVAL_CHANGED'});};
function sourceStamp(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||value.profileApproved!==true||value.strategyApproved!==true||typeof value.strategySignature!=='string'||typeof value.senderSignature!=='string'||!/^[a-zA-Z0-9-]+:[a-f0-9]{64}$/.test(value.strategySignature)||!/^([a-f0-9]{64})$/.test(value.senderSignature))return null;
 return {version:1,profileApproved:true,strategyApproved:true,strategySignature:value.strategySignature,senderSignature:value.senderSignature};
}
export async function currentMessageSourceAuthority(env,workspaceId){
 const saved=await readOwnedPayload(env,workspaceId,await env.DB.prepare('SELECT * FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first());
 return {authority:Outreach.messageSourceAuthority(saved.payload.main||{},saved.payload.outreach?.messageStudio||{}),workspace:saved.row};
}
export async function assertMessageSourceAuthority(env,workspaceId,expected){
 const stamp=sourceStamp(expected);if(!stamp)fail();const current=await currentMessageSourceAuthority(env,workspaceId),actual=sourceStamp(current.authority);
 if(!current.workspace||!actual||JSON.stringify(actual)!==JSON.stringify(stamp))fail();return current;
}
// Retain the original reviewed source once with its immutable sequence ID. A
// retry cannot reseal this record to a newer Profile, Strategy or sender.
export function messageSourceReceiptStatement(env,{workspaceId,userId=null,sequenceId,authority}){
 const stamp=sourceStamp(authority);if(!stamp)fail();
 return env.DB.prepare("INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) SELECT ?,?,?,'outreach.sequence_source_authority','outreach_sequence',?,? WHERE NOT EXISTS(SELECT 1 FROM audit_events WHERE workspace_id=? AND event_type='outreach.sequence_source_authority' AND entity_type='outreach_sequence' AND entity_id=?)").bind(crypto.randomUUID(),workspaceId,userId,sequenceId,JSON.stringify({version:1,sourceAuthority:stamp}),workspaceId,sequenceId);
}
export async function queuedMessageSourceCurrent(env,sequence){
 // These paths revalidate their complete persisted context/approval contracts in
 // workflowDeliveryAuthorized/campaignDeliveryAuthorized before dispatch.
 if(sequence.workflow_run_id||String(sequence.contact_identity||'').startsWith('campaign:'))return true;
 const row=await env.DB.prepare("SELECT metadata_json FROM audit_events WHERE workspace_id=? AND event_type='outreach.sequence_source_authority' AND entity_type='outreach_sequence' AND entity_id=? ORDER BY rowid LIMIT 1").bind(sequence.workspace_id,sequence.id).first();
 try{const receipt=JSON.parse(row?.metadata_json||'{}');await assertMessageSourceAuthority(env,sequence.workspace_id,receipt.sourceAuthority);return true;}catch{return false;}
}
