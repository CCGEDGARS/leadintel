import {constantTimeEqual} from './security.js';
import {appendCrmActivity} from './crm.js';

const encoder=new TextEncoder();
const stamp=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,code)=>json({error:message,...(code?{code}:{})},status,headers);

export function apolloWebhookSigningSecret(env={}){
  return clean(env.APOLLO_WEBHOOK_SECRET,500)||(env.APOLLO_WEBHOOK_SERVER_BOUND?'':clean(env.APOLLO_API_KEY,500));
}

async function hmacHex(value,secret){
  const key=await crypto.subtle.importKey('raw',encoder.encode(String(secret||'')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(String(value||'')));
  return [...new Uint8Array(signature)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function buildApolloCrmWebhookUrl(baseUrl,requestId,secret){
  const url=new URL(String(baseUrl||''));
  if(url.protocol!=='https:')throw Object.assign(new Error('Apollo webhook must use HTTPS'),{code:'CRM_APOLLO_WEBHOOK_REQUIRED'});
  if(!clean(secret,500))throw Object.assign(new Error('Apollo webhook signing secret is not configured'),{code:'CRM_APOLLO_WEBHOOK_SECRET_REQUIRED'});
  url.searchParams.set('request_id',String(requestId));
  url.searchParams.set('sig',await hmacHex(requestId,secret));
  return url.toString();
}

function validPhoneFromCallback(body,personId){
  const people=Array.isArray(body?.people)?body.people:[];
  const person=people.find(item=>clean(item?.id||item?.person_id,180)===clean(personId,180))||null;
  const phones=Array.isArray(person?.phone_numbers)?person.phone_numbers:[];
  const valid=phones.filter(item=>String(item?.status_cd||item?.status||'').toLowerCase()==='valid_number'&&clean(item?.sanitized_number||item?.raw_number,80));
  valid.sort((left,right)=>{
    const rank=value=>String(value?.type_cd||value?.type||'').toLowerCase()==='work_direct'?0:String(value?.type_cd||value?.type||'').toLowerCase()==='mobile'?1:2;
    return rank(left)-rank(right);
  });
  const number=valid[0]?clean(valid[0].sanitized_number||valid[0].raw_number,80):'';return /^\+?[0-9 ()-]{7,30}$/.test(number)&&number.replace(/\D/g,'').length<=15?number:'';
}

export function apolloCrmIdentityVerified(row,contact,summary){
  if(!contact||summary.identity_verified===false)return false;
  const name=value=>clean(value,180).normalize('NFC').toLowerCase();
  const exact=summary.id===row.person_provider_id&&name(summary.name)&&name(summary.name)===name(contact.name);
  return Boolean(exact&&(summary.identity_verified===true||String(contact.source).toLowerCase()==='apollo'&&contact.external_person_id===row.person_provider_id));
}

// The callback inbox lives in the request ledger before contact projection.
// A retried callback can finish projection after a storage failure without billing twice.
export async function applyApolloCrmPhoneResult(db,row){
  if(!row?.webhook_received_at||!row.contact_id)return null;
  let summary;try{summary=JSON.parse(row.response_summary_json||'{}');}catch{return null;}
  const phone=summary.callback_phone||'';
  const contact=await db.prepare('SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL').bind(row.contact_id,row.workspace_id,row.company_id).first();
  if(!contact)return null;
  if(!apolloCrmIdentityVerified(row,contact,summary))return contact;
  if(summary.projection_applied!==1)await db.prepare(`UPDATE crm_contacts SET phone_number=CASE WHEN ?<>'' THEN ? ELSE phone_number END,
    phone_status=CASE WHEN ?<>'' THEN 'Verified' WHEN TRIM(COALESCE(phone_number,''))<>'' THEN phone_status ELSE 'Not found' END,
    verification_provider=CASE WHEN ?<>'' AND normalized_email IS NULL THEN 'Apollo' ELSE verification_provider END,
    verified_at=CASE WHEN ?<>'' AND normalized_email IS NULL THEN ? ELSE verified_at END,updated_at=? WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM crm_enrichment_requests newer WHERE newer.workspace_id=? AND newer.company_id=? AND newer.contact_id=? AND newer.phone_requested=1 AND newer.rowid>(SELECT rowid FROM crm_enrichment_requests WHERE id=?))`).bind(phone,phone,phone,phone,phone,row.webhook_received_at,row.webhook_received_at,contact.id,row.workspace_id,row.company_id,row.workspace_id,row.company_id,contact.id,row.id).run();
  await appendCrmActivity(db,{workspaceId:row.workspace_id,userId:null,role:'system'},{id:`apollo-phone:${row.id}`,companyId:row.company_id,contactId:row.contact_id,type:phone?'contact.phone_enriched':'contact.phone_not_found',summary:phone?'Apollo verified phone number':'Apollo phone lookup completed without a valid number',occurredAt:row.webhook_received_at,metadata:{provider:'Apollo',request_id:row.id,person_provider_id:row.person_provider_id,phone_status:phone?'Verified':'Not found',credits_used:Number(row.credits_used)||0,phone_credits:Number(summary.credits_consumed)||0}});
  await db.prepare("UPDATE crm_activities SET metadata_json=json_set(metadata_json,'$.credits_used',MAX(COALESCE(json_extract(metadata_json,'$.credits_used'),0),?)) WHERE id=? AND workspace_id=?").bind(Number(row.credits_used)||0,`apollo-phone:${row.id}`,row.workspace_id).run();
  await db.prepare("UPDATE crm_enrichment_requests SET response_summary_json=json_set(response_summary_json,'$.projection_applied',1) WHERE id=?").bind(row.id).run();
  return db.prepare('SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL').bind(contact.id,row.workspace_id,row.company_id).first();
}

export async function handleApolloCrmWebhook(request,env,corsOverride={}){
  const cors=corsOverride||{};const url=new URL(request.url);
  if(url.pathname!=='/api/webhooks/apollo/crm-contact')return null;
  if(request.method!=='POST')return error('Method not allowed',405,cors,'CRM_APOLLO_WEBHOOK_METHOD');
  const signingSecret=apolloWebhookSigningSecret(env);
  if(!signingSecret)return error('Apollo webhook signing is not configured',503,cors,'CRM_APOLLO_WEBHOOK_NOT_CONFIGURED');

  const requestId=clean(url.searchParams.get('request_id'),180);const supplied=clean(url.searchParams.get('sig'),256);
  if(!requestId||!supplied)return error('Invalid Apollo webhook signature',403,cors,'CRM_APOLLO_WEBHOOK_INVALID');
  const expected=await hmacHex(requestId,signingSecret);
  if(!constantTimeEqual(supplied,expected))return error('Invalid Apollo webhook signature',403,cors,'CRM_APOLLO_WEBHOOK_INVALID');

  const row=await env.DB.prepare(`SELECT * FROM crm_enrichment_requests WHERE id=? AND provider='apollo'`).bind(requestId).first();
  if(!row)return error('Apollo enrichment request not found',404,cors,'CRM_APOLLO_WEBHOOK_REQUEST_NOT_FOUND');
  if(!row.phone_requested)return error('Request did not authorize a phone callback',409,cors,'CRM_APOLLO_PHONE_NOT_REQUESTED');
  if(row.webhook_received_at){const contact=await applyApolloCrmPhoneResult(env.DB,row);return json({ok:true,duplicate:true,request:{id:row.id,status:row.status,credits_used:Number(row.credits_used)||0},contact},200,cors);}
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object'||!Array.isArray(body.people))return error('Apollo webhook payload is required',400,cors,'CRM_APOLLO_WEBHOOK_PAYLOAD_REQUIRED');
  if(body.people.length&&!body.people.some(p=>clean(p?.id||p?.person_id,180)===row.person_provider_id))return error('Callback identity does not match the request',422,cors,'CRM_APOLLO_WEBHOOK_IDENTITY_MISMATCH');
  const callbackCredits=Number(body.credits_consumed)||0;
  if(!Number.isFinite(callbackCredits)||callbackCredits<0||callbackCredits>100000)return error('Invalid callback credits',400,cors,'CRM_APOLLO_WEBHOOK_INVALID_CREDITS');
  const phone=validPhoneFromCallback(body,row.person_provider_id);
  if(!phone&&['pending','processing','running','queued'].includes(clean(body.status,80).toLowerCase()))return json({ok:true,pending:true,request:{id:row.id,status:row.status}},202,cors);
  const target=row.contact_id?await env.DB.prepare('SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL').bind(row.contact_id,row.workspace_id,row.company_id).first():null;
  let retainedSummary={};try{retainedSummary=JSON.parse(row.response_summary_json||'{}');}catch{}
  const receivedAt=stamp(),finalStatus=phone?(apolloCrmIdentityVerified(row,target,retainedSummary)?'verified':'pending_phone'):'not_found';
  const summary={status:clean(body.status,80)||null,total_requested_enrichments:Number(body.total_requested_enrichments)||0,unique_enriched_records:Number(body.unique_enriched_records)||0,missing_records:Number(body.missing_records)||0,phone_found:Boolean(phone),callback_phone:phone,credits_consumed:callbackCredits};
  const claimed=await env.DB.prepare(`UPDATE crm_enrichment_requests SET status=?,credits_used=credits_used+?,response_summary_json=json_patch(response_summary_json,?),webhook_received_at=?,completed_at=?,updated_at=? WHERE id=? AND webhook_received_at IS NULL RETURNING *`).bind(finalStatus,callbackCredits,JSON.stringify(summary),receivedAt,receivedAt,receivedAt,row.id).first();
  const settled=claimed||await env.DB.prepare('SELECT * FROM crm_enrichment_requests WHERE id=?').bind(row.id).first();
  const contact=await applyApolloCrmPhoneResult(env.DB,settled);
  return json({ok:true,duplicate:!claimed,request:{id:row.id,status:settled.status,credits_used:Number(settled.credits_used)||0},contact},200,cors);
}
