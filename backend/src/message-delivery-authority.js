import {acceptedDeliveryContentAssertion} from './delivery-idempotency.js';
import {campaignDispatchAuthority} from './email-campaigns.js';
import {assertMessageSourceAuthority} from './message-source-authority.js';
import {assertReviewedRecipient} from './reviewed-recipient.js';
import {contactRequestGuard} from './contact-operation-authority.js';
import {messageBatch,messageRowAssertion} from './message-operation-authority.js';
import ContactPolicy from '../../customer/contact-confirmation-policy.js';
const fail=message=>{throw Object.assign(Error(message),{status:409,code:'MESSAGE_DELIVERY_CONTEXT_CHANGED'});};

// An accepted contact is an exact address + current identity, never a historical ID.
export async function manualDeliveryAuthority(request,env,{workspaceId,access,domain,recipient,company,connection,provider,recipientSnapshot,sourceAuthority,campaignReceipt,idempotencyKey,campaignMessage,contentHash}){
 const source=await assertMessageSourceAuthority(env,workspaceId,sourceAuthority);const campaignAuthority=campaignReceipt?await campaignDispatchAuthority(env,workspaceId,campaignReceipt,campaignMessage):null;
 const context={workspaceId,userId:access.user.id,role:access.member.role};context.guard=await contactRequestGuard(request,env,context);context.writeAuthority=context.guard.writeAuthority;await context.guard();
 if(!company||['suppressed','archived'].includes(company.lifecycle_status))fail('Save the target company and confirm this work email in Buyers before delivery.');
 const policy=await env.DB.prepare('SELECT config_json FROM approved_workflows WHERE workspace_id=?').bind(workspaceId).first();let level='provider_verified';try{level=ContactPolicy.level(JSON.parse(policy?.config_json||'{}').buyers?.confirmationLevel);}catch{}
 const contact=await env.DB.prepare('SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND normalized_email=? AND archived_at IS NULL').bind(workspaceId,company.id,recipient).first();
 if(!contact||!ContactPolicy.accepted(contact,domain,level))fail('Confirm this exact work email in Buyers before delivery.');assertReviewedRecipient(recipientSnapshot,contact,company);
 const payload=source.workspace;
 const table=provider==='gmail'?'gmail_connections':'microsoft_mail_connections',emailKey=provider==='gmail'?'google_email':'microsoft_email';
 const mailbox=()=>Object.fromEntries(['workspace_id','user_id',emailKey,'encrypted_refresh_token','scopes','status'].map(key=>[key,connection[key]??null]));
 const capacity=()=>env.DB.prepare(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM outreach_automation_queue WHERE workspace_id=? AND status='sending') AND NOT EXISTS(SELECT 1 FROM outreach_automation_queue q JOIN outreach_automation_sequences s ON s.id=q.sequence_id AND s.workspace_id=q.workspace_id WHERE q.workspace_id=? AND (q.recipient=? OR s.recipient=?) AND s.status='active' AND q.status IN ('queued','waiting_window','blocked_limit','failed','sending')) AND NOT EXISTS(SELECT 1 FROM conversation_plans p JOIN gmail_messages root ON root.id=p.message_id AND root.workspace_id=p.workspace_id WHERE p.workspace_id=? AND root.recipient=? AND p.status='active' AND EXISTS(SELECT 1 FROM conversation_plan_steps step WHERE step.plan_id=p.id AND step.status IN ('queued','sending'))) AND NOT EXISTS(SELECT 1 FROM conversation_mailbox_locks WHERE workspace_id=? AND julianday(expires_at)>julianday(?)) AND NOT EXISTS(SELECT 1 FROM gmail_messages WHERE workspace_id=? AND status='sending' AND (?!='gmail' OR idempotency_key!=?)) AND NOT EXISTS(SELECT 1 FROM microsoft_mail_messages WHERE workspace_id=? AND status='sending' AND (?!='microsoft-mail' OR idempotency_key!=?)) THEN 1 ELSE json('MESSAGE_CAPACITY_CHANGED') END`).bind(workspaceId,workspaceId,recipient,recipient,workspaceId,recipient,workspaceId,new Date().toISOString(),workspaceId,provider,idempotencyKey||'',workspaceId,provider,idempotencyKey||'');
 const assertions=()=>[capacity(),...(contentHash?[acceptedDeliveryContentAssertion(env,{workspaceId,provider,key:idempotencyKey||'',contentHash})]:[]),...(campaignAuthority?.assertions()||[]),messageRowAssertion(env.DB,'outreach_contact_suppression','workspace_id=? AND email=?',[workspaceId,recipient],null),messageRowAssertion(env.DB,'crm_contacts','workspace_id=? AND id=?',[workspaceId,contact.id],contact),messageRowAssertion(env.DB,'crm_companies','workspace_id=? AND id=?',[workspaceId,company.id],company),messageRowAssertion(env.DB,'approved_workflows','workspace_id=?',[workspaceId],policy),messageRowAssertion(env.DB,'customer_workspace_state','workspace_id=?',[workspaceId],payload),messageRowAssertion(env.DB,table,'workspace_id=?',[workspaceId],mailbox())];
 const check=async()=>{await campaignAuthority?.check();
  for(const [assertion,code,message] of [[capacity(),'DELIVERY_ACTION_HELD','A queued, supervised or unresolved delivery owns this mailbox or recipient. Review its receipt or explicitly cancel known future actions before continuing.'],...(contentHash?[[acceptedDeliveryContentAssertion(env,{workspaceId,provider,key:idempotencyKey||'',contentHash}),'DELIVERY_REVISION_ALREADY_ACCEPTED','This exact reviewed message was already accepted. Review its receipt before sending a distinct follow-up.']]:[])])try{await assertion.first();}catch(cause){if(/malformed JSON|MESSAGE_(?:CAPACITY_CHANGED|REVISION_ALREADY_ACCEPTED)/i.test(String(cause.message)))throw Object.assign(Error(message),{status:409,code});throw cause;}
  if(!ContactPolicy.accepted(contact,domain,level))fail('The accepted work email needs review before delivery.');await messageBatch(env,context,[],assertions());};
 const commit=async writes=>{await campaignAuthority?.check();const result=await messageBatch(env,context,writes,assertions());return result.at(-1);};
 await check();return {check,commit,crmContext:()=>{
  const authority=context.writeAuthority();
  return {...context,guard:check,writeAuthority:undefined,messageAssertions:[env.DB.prepare(`SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE json('MESSAGE_AUTHORITY_CHANGED') END`).bind(...authority.args),...assertions()]};
 }};
}

// Reading a mailbox may retain replies and suppress recipients, so those writes
// keep the original session, role and mailbox authority through every await.
export async function mailboxOperationAuthority(request,env,{workspaceId,access,connection,provider}){
 const context={workspaceId,userId:access.user.id,role:access.member.role};context.guard=await contactRequestGuard(request,env,context);context.writeAuthority=context.guard.writeAuthority;
 const table=provider==='gmail'?'gmail_connections':'microsoft_mail_connections',emailKey=provider==='gmail'?'google_email':'microsoft_email';
 const snapshot=Object.fromEntries(['workspace_id','user_id',emailKey,'encrypted_refresh_token','scopes','status'].map(key=>[key,connection[key]??null]));
 const assertions=()=>[messageRowAssertion(env.DB,table,'workspace_id=?',[workspaceId],snapshot)];
 const check=async()=>messageBatch(env,context,[],assertions());
 const commit=async(writes,extra=[])=>{const result=await messageBatch(env,context,writes,[...assertions(),...extra]);return writes.length?result.slice(-writes.length):[];};
 const crmContext=(extra=[])=>{const authority=context.writeAuthority();return {...context,guard:check,writeAuthority:undefined,messageAssertions:[env.DB.prepare(`SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE json('MESSAGE_AUTHORITY_CHANGED') END`).bind(...authority.args),...assertions(),...extra]};};
 await check();return {check,commit,crmContext};
}
