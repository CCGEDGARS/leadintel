import {sha256} from './security.js';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export async function deliveryRequestHash(provider,body,connection){return sha256(JSON.stringify(stable({version:1,provider,domain:body.domain,recipient:body.recipient,subject:body.subject,body:body.body,textBody:body.text_body??null,htmlBody:body.html_body??null,recipientSnapshot:body.recipient_snapshot??null,...(body.campaign_delivery?{campaignDelivery:{campaignId:body.campaign_delivery.campaignId,contactId:body.campaign_delivery.contactId,approvedAt:body.campaign_delivery.approvedAt,contextHash:body.campaign_delivery.contextHash}}:{}),...(body.source_authority?{sourceAuthority:body.source_authority}:{}),...(body.customer_project_id?{customerProjectId:String(body.customer_project_id).trim()}:{}),sender:{workspace:connection?.workspace_id||'',owner:connection?.user_id||'',email:connection?.google_email||connection?.microsoft_email||'',connectedAt:connection?.connected_at||''}})));}
export function deliveryReservationReceipt(env,{workspaceId,userId,provider,messageId,key,hash,contentHash}){const table=provider==='gmail'?'gmail_messages':'microsoft_mail_messages';return env.DB.prepare(`INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) SELECT ?,?,?,'email.delivery_reserved',?,?,? WHERE NOT EXISTS(SELECT 1 FROM ${table} WHERE workspace_id=? AND idempotency_key=?)`).bind(crypto.randomUUID(),workspaceId,userId,provider+'_message',messageId,JSON.stringify({version:1,request_hash:hash,...(contentHash?{content_hash:contentHash}:{})}),workspaceId,key);}
export async function deliveryReplayMatches(env,{workspaceId,provider,messageId,hash}){const row=await env.DB.prepare("SELECT metadata_json FROM audit_events WHERE workspace_id=? AND entity_type=? AND entity_id=? AND event_type='email.delivery_reserved' ORDER BY rowid DESC LIMIT 1").bind(workspaceId,provider+'_message',messageId).first();try{return JSON.parse(row?.metadata_json||'{}').request_hash===hash;}catch{return false;}}

// Provider acceptance is separate from CRM/status synchronization. Persist only
// safe identifiers and the bound request hash, never raw provider responses.
export async function recordDeliveryAcceptance(env,{workspaceId,userId,provider,messageId,hash,message}){
 await env.DB.prepare("INSERT INTO audit_events(id,workspace_id,user_id,event_type,entity_type,entity_id,metadata_json) VALUES(?,?,?,'email.delivery_accepted',?,?,?)").bind(crypto.randomUUID(),workspaceId,userId,provider+'_message',messageId,JSON.stringify({version:1,request_hash:hash,message})).run();
}
export async function recoverDeliveryAcceptance(env,{workspaceId,provider,existing,hash}){
 if(existing.status!=='sending')return {message:existing,syncWarning:false};
 const row=await env.DB.prepare("SELECT metadata_json FROM audit_events WHERE workspace_id=? AND entity_type=? AND entity_id=? AND event_type='email.delivery_accepted' ORDER BY rowid DESC LIMIT 1").bind(workspaceId,provider+'_message',existing.id).first();
 let receipt;try{receipt=JSON.parse(row?.metadata_json||'{}');}catch{return {message:existing,syncWarning:false};}
 const message=receipt.message;
 if(receipt.request_hash!==hash||!message||message.id!==existing.id||message.status!=='sent'||message.recipient!==existing.recipient||message.domain!==existing.domain||message.subject!==existing.subject||!Number.isFinite(Date.parse(message.sent_at)))return {message:existing,syncWarning:false};
 if(provider==='gmail'&&(!validProviderId(message.gmail_message_id)||!validProviderId(message.gmail_thread_id))||provider!=='gmail'&&message.provider_status!=='accepted')return {message:existing,syncWarning:false};
 try{
  const write=provider==='gmail'?env.DB.prepare("UPDATE gmail_messages SET status='sent',gmail_message_id=?,gmail_thread_id=?,sent_at=? WHERE workspace_id=? AND id=? AND status='sending'").bind(message.gmail_message_id,message.gmail_thread_id,message.sent_at,workspaceId,existing.id):env.DB.prepare("UPDATE microsoft_mail_messages SET status='sent',provider_status='accepted',sent_at=? WHERE workspace_id=? AND id=? AND status='sending'").bind(message.sent_at,workspaceId,existing.id);
  await write.run();return {message:{...existing,...message},syncWarning:false};
 }catch{return {message:{...existing,...message},syncWarning:true};}
}
function validProviderId(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,256}$/.test(value);}

// CRM activity IDs are global, whereas transport keys/provider IDs are scoped.
// Reuse a matching retained legacy row; new rows include their workspace scope.
export async function deliveryCrmActivityId(env,{workspaceId,companyId,provider,key,legacyId,metadataField='idempotency_key'}){
 const candidate=String(legacyId).replace(/[^A-Za-z0-9._:-]/g,'-').slice(0,128);
 const existing=await env.DB.prepare('SELECT workspace_id,company_id,metadata_json FROM crm_activities WHERE id=?').bind(candidate).first();
 if(existing?.workspace_id===workspaceId&&existing.company_id===companyId){try{if(JSON.parse(existing.metadata_json||'{}')[metadataField]===key)return candidate;}catch{}}
 return `delivery-${provider}-${await sha256(JSON.stringify([workspaceId,companyId,provider,key]))}`;
}
export async function matchedDeliveryReplay(env,{workspaceId,provider,key,hash}){
 const table=provider==='gmail'?'gmail_messages':'microsoft_mail_messages';
 const existing=await env.DB.prepare(`SELECT * FROM ${table} WHERE workspace_id=? AND idempotency_key=?`).bind(workspaceId,key).first();
 return existing&&await deliveryReplayMatches(env,{workspaceId,provider,messageId:existing.id,hash})?existing:null;
}

// Provider-neutral exact rendered revision; a new transport key or provider does
// not by itself create a separately reviewed message. Different follow-ups do.
export async function deliveryContentHash(body){return sha256(JSON.stringify(stable({version:1,domain:String(body.domain||'').toLowerCase(),recipient:String(body.recipient||'').trim().toLowerCase(),subject:body.subject,text:body.text_body??body.body,html:body.html_body||'',sourceAuthority:body.source_authority??null})));}
export function acceptedDeliveryContentAssertion(env,{workspaceId,provider,key,contentHash}){return env.DB.prepare(`SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM audit_events a WHERE a.workspace_id=? AND a.event_type='email.delivery_reserved' AND CASE WHEN json_valid(a.metadata_json) THEN json_extract(a.metadata_json,'$.content_hash') END=? AND (EXISTS(SELECT 1 FROM gmail_messages m WHERE m.workspace_id=a.workspace_id AND m.id=a.entity_id AND m.status='sent' AND (?!='gmail' OR m.idempotency_key!=?)) OR EXISTS(SELECT 1 FROM microsoft_mail_messages m WHERE m.workspace_id=a.workspace_id AND m.id=a.entity_id AND m.status='sent' AND (?!='microsoft-mail' OR m.idempotency_key!=?)))) THEN 1 ELSE json('MESSAGE_REVISION_ALREADY_ACCEPTED') END`).bind(workspaceId,contentHash,provider,key,provider,key);}
