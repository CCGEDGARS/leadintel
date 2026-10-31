import {readAdditionalContactPolicy} from './additional-contact-services.js';
import {readStoredPayload,readOwnedPayload,preparePayloadRecord,payloadRecordWrites,MAX_WORKSPACE_TRANSFER_BYTES} from './workspace-record-store.js';
import FlowState from '../../customer/my-flows.js';
import stateBudget from '../../customer/state-budget.js';
import {approvedContext,approvalStatus,normalizeWorkflowConfig,fingerprint,setupBlockers} from './approved-workflow-engine.js';
import {automaticGmailDeliveryEnabled} from './outreach-automation.js';
import {apolloCapabilities,hunterVerificationPolicy,resolveWorkspaceServiceCredential} from './service-integrations.js';
export const parse=(value,fallback={})=>{try{return JSON.parse(value||'')??fallback;}catch{return fallback;}};
export const decode=(row,env)=>JSON.parse(row?.payload_json||'{}')?.format==='leadintel-workspace-records-v1'?readOwnedPayload(env,row?.workspace_id,row,{flowId:row.id}).then(value=>value.payload):readStoredPayload(env,row?.workspace_id,row?.payload_json);
export const encode=payload=>JSON.stringify(stateBudget.prepareForSync(payload,{allowSectionPacking:true,allowBundlePacking:true,allowCompressionPacking:true,maxSyncBytes:MAX_WORKSPACE_TRANSFER_BYTES}).payload);
export async function currentPayload(env,workspaceId){return (await readOwnedPayload(env,workspaceId,await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first())).payload;}
export async function savedFlowRow(env,workspaceId,id){return env.DB.prepare('SELECT * FROM saved_flows WHERE workspace_id=? AND id=?').bind(workspaceId,id).first();}
export async function savedFlowPayload(env,row){const current=await currentPayload(env,row.workspace_id);const saved=row.id==='legacy-'+row.workspace_id&&!current.main?.myFlow?.id?current:await decode(row,env);return FlowState.composePayload(saved,current,row);}
export async function sharedHash(payload){return fingerprint(FlowState.sharedBusiness(payload));}
export async function savedFlowView(env,row){
 const payload=await savedFlowPayload(env,row),context=approvedContext({...payload.main,messageStudio:payload.outreach?.messageStudio});
 const config=normalizeWorkflowConfig(parse(row.config_json),context),stages=await approvalStatus(context,config,parse(row.approvals_json));
 const sharedChanged=(row.shared_hash||await sharedHash(await decode(row,env)))!==await sharedHash(await currentPayload(env,row.workspace_id));
 const review=parse(row.review_json,[]);const blockers=setupBlockers(context,config);
 if(sharedChanged)blockers.push('Shared business settings changed. Open this flow and review the affected pages.');
 if(review.length)blockers.push('Confirm the duplicate review checklist');
 const gmail=await env.DB.prepare("SELECT status FROM gmail_connections WHERE workspace_id=? AND status='connected'").bind(row.workspace_id).first();
 if(!gmail)blockers.push('Connect Gmail for automatic delivery');
 if(!automaticGmailDeliveryEnabled(env)&&env.APPROVED_WORKFLOW_DELIVERY_MODE!=='enabled')blockers.push('Automatic delivery is disabled on the server');
 const apollo=await apolloCapabilities(env,row.workspace_id);
 const paidSearch=await readAdditionalContactPolicy(env,row.workspace_id);
  if(paidSearch.provider==='treg'){if(paidSearch.enabled&&!(await resolveWorkspaceServiceCredential(env,row.workspace_id,'treg')).configured)blockers.push('Reconnect Treg in Settings');}else if(config.buyers.confirmContacts&&!apollo.email)blockers.push('Enable Apollo email enrichment in Apollo Settings');
 if(config.buyers.confirmPhone&&!apollo.phone)blockers.push('Enable Apollo phone enrichment in Apollo Settings');
 const hunter=await hunterVerificationPolicy(env,row.workspace_id);if(hunter.enabled&&!(await resolveWorkspaceServiceCredential(env,row.workspace_id,'hunter')).configured)blockers.push('Additional Hunter verification is enabled but its connection is unavailable');
 const {results:runs=[]}=await env.DB.prepare('SELECT id,revision,status,stage_index,error_message,created_at,updated_at,result_json FROM approved_workflow_runs WHERE workspace_id=? AND flow_id=? ORDER BY created_at DESC LIMIT 10').bind(row.workspace_id,row.id).all();
 return {id:row.id,name:row.name,stateVersion:row.state_version,status:sharedChanged&&row.status==='automatic'?'needs_review':row.status,revision:row.revision,config,context,stages,blockers,review,sharedChanged,summary:FlowState.summary(payload,config),approvedAt:row.approved_at,nextRunAt:row.next_run_at,runs:runs.map(r=>({...r,result:parse(r.result_json),result_json:undefined})),updatedAt:row.updated_at};
}
export async function savedFlowAuthorized(env,workspaceId,revision,id){
 const row=await savedFlowRow(env,workspaceId,id);if(!row||row.status!=='automatic'||row.revision!==Number(revision)||!row.approved_by||!row.approved_at||parse(row.review_json,[]).length)return false;
 const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,row.approved_by).first();if(member?.role!=='owner')return false;
 const source=await env.DB.prepare('SELECT * FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();
 const payload=await savedFlowPayload(env,row),context=approvedContext({...payload.main,messageStudio:payload.outreach?.messageStudio}),hash=await fingerprint(context);
 let stagesApproved=false;try{stagesApproved=(await approvalStatus(context,normalizeWorkflowConfig(parse(row.config_json),context),parse(row.approvals_json))).every(stage=>stage.approved);}catch{}
 if(hash!==row.context_hash||!stagesApproved||(row.shared_hash||await sharedHash(await decode(row,env)))!==await sharedHash(await currentPayload(env,workspaceId))){await env.DB.prepare("UPDATE saved_flows SET status='needs_review',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=? AND status='automatic' AND config_json=? AND approvals_json=? AND payload_json=? AND state_version=? AND approved_by IS ? AND approved_at IS ? AND EXISTS(SELECT 1 FROM customer_workspace_state WHERE workspace_id=? AND version=? AND payload_json=?)").bind(workspaceId,id,revision,row.config_json,row.approvals_json,row.payload_json,row.state_version,row.approved_by,row.approved_at,workspaceId,source?.version,source?.payload_json).run();return false;}
 return true;
}
// Include projection writes in the customer-state CAS transaction. Progress alone never invalidates approval.
export async function flowProjectionStatements(env,workspaceId,before,after,encodedPayload,nextVersion){
 const id=after.main?.myFlow?.id;if(!id)return {writes:[],guard:null};
 const row=await savedFlowRow(env,workspaceId,id);if(!row)throw Error('Saved flow is unavailable in this workspace');
 const context=approvedContext({...after.main,messageStudio:after.outreach?.messageStudio}),hash=await fingerprint(context),shared=await sharedHash(after);
 const material=row.context_hash!==hash||(row.shared_hash||await sharedHash(await decode(row,env)))!==shared,revision=row.revision+(material?1:0);
 const writes=[];
 if(!before.main?.myFlow?.id&&id!=='legacy-'+workspaceId){
   const legacy=await savedFlowRow(env,workspaceId,'legacy-'+workspaceId);
   if(legacy){const legacyRecord=await preparePayloadRecord(encode(before));const previousHash=await fingerprint(approvedContext({...before.main,messageStudio:before.outreach?.messageStudio})),previousShared=await sharedHash(before),changed=previousHash!==legacy.context_hash||(legacy.shared_hash||await sharedHash(await decode(legacy,env)))!==previousShared;writes.push(env.DB.prepare("UPDATE saved_flows SET payload_json=?,state_version=state_version+1,revision=revision+?,status=CASE WHEN ? AND status='automatic' THEN 'needs_review' ELSE status END,context_hash=?,shared_hash=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND EXISTS(SELECT 1 FROM customer_workspace_state WHERE workspace_id=? AND version=? AND payload_json=?)").bind(legacyRecord.encoded,changed?1:0,changed?1:0,previousHash,previousShared,workspaceId,legacy.id,workspaceId,nextVersion,encodedPayload));writes.push(...payloadRecordWrites(env,workspaceId,legacyRecord,'EXISTS(SELECT 1 FROM saved_flows WHERE workspace_id=? AND id=? AND payload_json=?)',[workspaceId,legacy.id,legacyRecord.encoded]));}
 }
 writes.push(env.DB.prepare("UPDATE saved_flows SET payload_json=?,state_version=state_version+1,context_hash=?,shared_hash=?,revision=?,status=CASE WHEN ? AND status='automatic' THEN 'needs_review' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND EXISTS(SELECT 1 FROM customer_workspace_state WHERE workspace_id=? AND version=? AND payload_json=?)").bind(encodedPayload,hash,shared,revision,material?1:0,workspaceId,id,workspaceId,nextVersion,encodedPayload));
 return {guard:{id,revision:row.revision},writes};
}
