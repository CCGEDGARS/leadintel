import FlowState from '../../customer/my-flows.js';
import stateBudget from '../../customer/state-budget.js';
import {approvedContext,approvalStatus,normalizeWorkflowConfig,fingerprint,setupBlockers} from './approved-workflow-engine.js';
import {automaticGmailDeliveryEnabled} from './outreach-automation.js';
import {apolloCapabilities,hunterVerificationPolicy,resolveWorkspaceServiceCredential} from './service-integrations.js';
export const parse=(value,fallback={})=>{try{return JSON.parse(value||'')??fallback;}catch{return fallback;}};
export const decode=row=>stateBudget.restoreFromSync(parse(row?.payload_json));
export const encode=payload=>JSON.stringify(stateBudget.prepareForSync(payload,{allowSectionPacking:true}).payload);
export async function currentPayload(env,workspaceId){return decode(await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first());}
export async function savedFlowRow(env,workspaceId,id){return env.DB.prepare('SELECT * FROM saved_flows WHERE workspace_id=? AND id=?').bind(workspaceId,id).first();}
export async function savedFlowPayload(env,row){const current=await currentPayload(env,row.workspace_id);const saved=row.id==='legacy-'+row.workspace_id&&!current.main?.myFlow?.id?current:decode(row);return FlowState.composePayload(saved,current,row);}
export async function sharedHash(payload){return fingerprint(FlowState.sharedBusiness(payload));}
export async function savedFlowView(env,row){
 const payload=await savedFlowPayload(env,row),context=approvedContext({...payload.main,messageStudio:payload.outreach?.messageStudio});
 const config=normalizeWorkflowConfig(parse(row.config_json),context),stages=await approvalStatus(context,config,parse(row.approvals_json));
 const sharedChanged=(row.shared_hash||await sharedHash(decode(row)))!==await sharedHash(await currentPayload(env,row.workspace_id));
 const review=parse(row.review_json,[]);const blockers=setupBlockers(context,config);
 if(sharedChanged)blockers.push('Shared business settings changed. Open this flow and review the affected pages.');
 if(review.length)blockers.push('Confirm the duplicate review checklist');
 const gmail=await env.DB.prepare("SELECT status FROM gmail_connections WHERE workspace_id=? AND status='connected'").bind(row.workspace_id).first();
 if(!gmail)blockers.push('Connect Gmail for automatic delivery');
 if(!automaticGmailDeliveryEnabled(env)&&env.APPROVED_WORKFLOW_DELIVERY_MODE!=='enabled')blockers.push('Automatic delivery is disabled on the server');
 const apollo=await apolloCapabilities(env,row.workspace_id);
 if(config.buyers.confirmContacts&&!apollo.email)blockers.push('Enable Apollo email enrichment in Apollo Settings');
 if(config.buyers.confirmPhone&&!apollo.phone)blockers.push('Enable Apollo phone enrichment in Apollo Settings');
 const hunter=await hunterVerificationPolicy(env,row.workspace_id);if(hunter.enabled&&!(await resolveWorkspaceServiceCredential(env,row.workspace_id,'hunter')).configured)blockers.push('Additional Hunter verification is enabled but its connection is unavailable');
 const {results:runs=[]}=await env.DB.prepare('SELECT id,revision,status,stage_index,error_message,created_at,updated_at,result_json FROM approved_workflow_runs WHERE workspace_id=? AND flow_id=? ORDER BY created_at DESC LIMIT 10').bind(row.workspace_id,row.id).all();
 return {id:row.id,name:row.name,stateVersion:row.state_version,status:sharedChanged&&row.status==='automatic'?'needs_review':row.status,revision:row.revision,config,context,stages,blockers,review,sharedChanged,summary:FlowState.summary(payload,config),approvedAt:row.approved_at,nextRunAt:row.next_run_at,runs:runs.map(r=>({...r,result:parse(r.result_json),result_json:undefined})),updatedAt:row.updated_at};
}
export async function savedFlowAuthorized(env,workspaceId,revision,id){
 const row=await savedFlowRow(env,workspaceId,id);if(!row||row.status!=='automatic'||row.revision!==Number(revision)||!row.approved_by||parse(row.review_json,[]).length)return false;
 const member=await env.DB.prepare('SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?').bind(workspaceId,row.approved_by).first();if(member?.role!=='owner')return false;
 const payload=await savedFlowPayload(env,row),hash=await fingerprint(approvedContext({...payload.main,messageStudio:payload.outreach?.messageStudio}));
 if(hash!==row.context_hash||(row.shared_hash||await sharedHash(decode(row)))!==await sharedHash(await currentPayload(env,workspaceId))){await env.DB.prepare("UPDATE saved_flows SET status='needs_review',updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND revision=? AND status='automatic'").bind(workspaceId,id,revision).run();return false;}
 return true;
}
// Include projection writes in the customer-state CAS transaction. Progress alone never invalidates approval.
export async function flowProjectionStatements(env,workspaceId,before,after,encodedPayload,nextVersion){
 const id=after.main?.myFlow?.id;if(!id)return {writes:[],guard:null};
 const row=await savedFlowRow(env,workspaceId,id);if(!row)throw Error('Saved flow is unavailable in this workspace');
 const context=approvedContext({...after.main,messageStudio:after.outreach?.messageStudio}),hash=await fingerprint(context),shared=await sharedHash(after);
 const material=row.context_hash!==hash||(row.shared_hash||await sharedHash(decode(row)))!==shared,revision=row.revision+(material?1:0);
 const writes=[];
 if(!before.main?.myFlow?.id&&id!=='legacy-'+workspaceId){
   const legacy=await savedFlowRow(env,workspaceId,'legacy-'+workspaceId);
   if(legacy){const previousHash=await fingerprint(approvedContext({...before.main,messageStudio:before.outreach?.messageStudio})),previousShared=await sharedHash(before),changed=previousHash!==legacy.context_hash||(legacy.shared_hash||await sharedHash(decode(legacy)))!==previousShared;writes.push(env.DB.prepare("UPDATE saved_flows SET payload_json=?,state_version=state_version+1,revision=revision+?,status=CASE WHEN ? AND status='automatic' THEN 'needs_review' ELSE status END,approved_at=CASE WHEN ? THEN NULL ELSE approved_at END,context_hash=?,shared_hash=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND EXISTS(SELECT 1 FROM customer_workspace_state WHERE workspace_id=? AND version=? AND payload_json=?)").bind(encode(before),changed?1:0,changed?1:0,changed?1:0,previousHash,previousShared,workspaceId,legacy.id,workspaceId,nextVersion,encodedPayload));}
 }
 writes.push(env.DB.prepare("UPDATE saved_flows SET payload_json=?,state_version=state_version+1,context_hash=?,shared_hash=?,revision=?,status=CASE WHEN ? AND status='automatic' THEN 'needs_review' ELSE status END,approved_at=CASE WHEN ? THEN NULL ELSE approved_at END,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=? AND EXISTS(SELECT 1 FROM customer_workspace_state WHERE workspace_id=? AND version=? AND payload_json=?)").bind(encodedPayload,hash,shared,revision,material?1:0,material?1:0,workspaceId,id,workspaceId,nextVersion,encodedPayload));
 return {guard:{id,revision:row.revision},writes};
}
