import {normalizeEmail} from './gmail.js';
import {messageRowAssertion} from './message-operation-authority.js';

const unresolvedSql="EXISTS(SELECT 1 FROM gmail_messages WHERE workspace_id=? AND domain=? AND recipient=? AND status='sending') OR EXISTS(SELECT 1 FROM microsoft_mail_messages WHERE workspace_id=? AND domain=? AND recipient=? AND status='sending')";
const args=({workspaceId,domain,recipient})=>[workspaceId,domain,recipient,workspaceId,domain,recipient];
const unavailable=()=>Object.assign(Error('Delivery reconciliation is unavailable. Keep the original submission held and try again later.'),{status:503,code:'DELIVERY_STATUS_UNAVAILABLE'});
const held=()=>Object.assign(Error('An earlier provider submission has an unresolved outcome. Reconcile that submission before recording a manual send.'),{status:409,code:'DELIVERY_RECONCILIATION_REQUIRED'});

export async function manualDeliveryStatus(env,scope){
 try{const result=await env.DB.prepare(`SELECT (${unresolvedSql}) AS unresolved`).bind(...args(scope)).first();if(!result||![0,1].includes(Number(result.unresolved)))throw unavailable();return Boolean(Number(result.unresolved));}catch(cause){if(cause.code==='DELIVERY_STATUS_UNAVAILABLE')throw cause;throw unavailable();}
}

// Client manual observations cannot turn an unresolved provider reservation
// into a known send. Provider acceptance recovery has its own bound receipt.
export async function manualCrmDeliveryAssertions(env,context,companyId,activity){
 const metadata=activity.metadata||{},snapshot=metadata.delivery_record?.record;
 if(String(activity.type||activity.activity_type)!=='email.sent'||![activity.channel,metadata.delivery_channel,snapshot?.deliveryChannel].includes('gmail-compose'))return [];
 const recipient=normalizeEmail(metadata.recipient||snapshot?.recipientEmail),snapshotRecipient=snapshot?.recipientEmail?normalizeEmail(snapshot.recipientEmail):'';
 if(!recipient||snapshot?.recipientEmail&&snapshotRecipient!==recipient)throw Object.assign(Error('The manual delivery recipient is missing or inconsistent.'),{status:400,code:'CRM_DELIVERY_RECIPIENT_INVALID'});
 const company=await env.DB.prepare('SELECT id,workspace_id,normalized_domain FROM crm_companies WHERE workspace_id=? AND id=? AND deleted_at IS NULL').bind(context.workspaceId,companyId).first();
 if(!company?.normalized_domain)throw Object.assign(Error('The original CRM company is unavailable.'),{status:409,code:'CRM_COMPANY_NOT_FOUND'});
 const scope={workspaceId:context.workspaceId,domain:company.normalized_domain,recipient},previousGuard=context.guard;
 context.guard=async()=>{await previousGuard?.();if(await manualDeliveryStatus(env,scope))throw held();};
 await context.guard();
 return [messageRowAssertion(env.DB,'crm_companies','workspace_id=? AND id=?',[context.workspaceId,companyId],company),env.DB.prepare(`SELECT CASE WHEN NOT (${unresolvedSql}) THEN 1 ELSE json('DELIVERY_RECONCILIATION_REQUIRED') END`).bind(...args(scope))];
}
