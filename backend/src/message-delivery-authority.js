import {assertReviewedRecipient} from './reviewed-recipient.js';
import {contactRequestGuard} from './contact-operation-authority.js';
import {messageBatch,messageRowAssertion} from './message-operation-authority.js';
import ContactPolicy from '../../customer/contact-confirmation-policy.js';
const fail=message=>{throw Object.assign(Error(message),{status:409,code:'MESSAGE_DELIVERY_CONTEXT_CHANGED'});};

// An accepted contact is an exact address + current identity, never a historical ID.
export async function manualDeliveryAuthority(request,env,{workspaceId,access,domain,recipient,company,connection,provider,recipientSnapshot}){
 const context={workspaceId,userId:access.user.id,role:access.member.role};context.guard=await contactRequestGuard(request,env,context);context.writeAuthority=context.guard.writeAuthority;await context.guard();
 if(!company||['suppressed','archived'].includes(company.lifecycle_status))fail('Save the target company and confirm this work email in Buyers before delivery.');
 const policy=await env.DB.prepare('SELECT config_json FROM approved_workflows WHERE workspace_id=?').bind(workspaceId).first();let level='provider_verified';try{level=ContactPolicy.level(JSON.parse(policy?.config_json||'{}').buyers?.confirmationLevel);}catch{}
 const contact=await env.DB.prepare('SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND normalized_email=? AND archived_at IS NULL').bind(workspaceId,company.id,recipient).first();
 if(!contact||!ContactPolicy.accepted(contact,domain,level))fail('Confirm this exact work email in Buyers before delivery.');assertReviewedRecipient(recipientSnapshot,contact,company);
 const payload=await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();
 const table=provider==='gmail'?'gmail_connections':'microsoft_mail_connections',emailKey=provider==='gmail'?'google_email':'microsoft_email';
 const mailbox=()=>Object.fromEntries(['workspace_id','user_id',emailKey,'encrypted_refresh_token','scopes','status'].map(key=>[key,connection[key]??null]));
 const assertions=()=>[messageRowAssertion(env.DB,'outreach_contact_suppression','workspace_id=? AND email=?',[workspaceId,recipient],null),messageRowAssertion(env.DB,'crm_contacts','workspace_id=? AND id=?',[workspaceId,contact.id],contact),messageRowAssertion(env.DB,'crm_companies','workspace_id=? AND id=?',[workspaceId,company.id],company),messageRowAssertion(env.DB,'approved_workflows','workspace_id=?',[workspaceId],policy),messageRowAssertion(env.DB,'customer_workspace_state','workspace_id=?',[workspaceId],payload),messageRowAssertion(env.DB,table,'workspace_id=?',[workspaceId],mailbox())];
 const check=async()=>{if(!ContactPolicy.accepted(contact,domain,level))fail('The accepted work email needs review before delivery.');await messageBatch(env,context,[],assertions());};
 const commit=async writes=>{const result=await messageBatch(env,context,writes,assertions());return result.at(-1);};
 await check();return {check,commit};
}
