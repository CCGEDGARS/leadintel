import {constantTimeEqual} from './security.js';
import {appendCrmActivity} from './crm.js';

const encoder=new TextEncoder();
const stamp=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status,headers,code)=>json({error:message,...(code?{code}:{})},status,headers);

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
  return valid[0]?clean(valid[0].sanitized_number||valid[0].raw_number,80):'';
}

export async function handleApolloCrmWebhook(request,env,corsOverride={}){
  const cors=corsOverride||{};const url=new URL(request.url);
  if(url.pathname!=='/api/webhooks/apollo/crm-contact')return null;
  if(request.method!=='POST')return error('Method not allowed',405,cors,'CRM_APOLLO_WEBHOOK_METHOD');
  if(!clean(env.APOLLO_WEBHOOK_SECRET,500))return error('Apollo webhook signing is not configured',503,cors,'CRM_APOLLO_WEBHOOK_NOT_CONFIGURED');

  const requestId=clean(url.searchParams.get('request_id'),180);const supplied=clean(url.searchParams.get('sig'),256);
  if(!requestId||!supplied)return error('Invalid Apollo webhook signature',403,cors,'CRM_APOLLO_WEBHOOK_INVALID');
  const expected=await hmacHex(requestId,env.APOLLO_WEBHOOK_SECRET);
  if(!constantTimeEqual(supplied,expected))return error('Invalid Apollo webhook signature',403,cors,'CRM_APOLLO_WEBHOOK_INVALID');

  const row=await env.DB.prepare(`SELECT * FROM crm_enrichment_requests WHERE id=? AND provider='apollo'`).bind(requestId).first();
  if(!row)return error('Apollo enrichment request not found',404,cors,'CRM_APOLLO_WEBHOOK_REQUEST_NOT_FOUND');
  if(row.webhook_received_at)return json({ok:true,duplicate:true,request:{id:row.id,status:row.status,credits_used:Number(row.credits_used)||0}},200,cors);

  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object')return error('Apollo webhook payload is required',400,cors,'CRM_APOLLO_WEBHOOK_PAYLOAD_REQUIRED');

  const callbackCredits=Math.max(0,Number(body.credits_consumed)||0);
  const totalCredits=Math.max(0,Number(row.credits_used)||0)+callbackCredits;
  const phone=validPhoneFromCallback(body,row.person_provider_id);
  const receivedAt=stamp();
  let contact=null;
  if(row.contact_id){
    contact=await env.DB.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL`).bind(row.contact_id,row.workspace_id,row.company_id).first();
  }

  if(contact){
    await env.DB.prepare(`UPDATE crm_contacts SET phone_number=?,phone_status=?,verification_provider='Apollo',verified_at=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(phone||contact.phone_number||null,phone?'Verified':'Not found',phone?receivedAt:contact.verified_at||null,receivedAt,contact.id,row.workspace_id).run();
    contact=await env.DB.prepare(`SELECT * FROM crm_contacts WHERE id=? AND workspace_id=?`).bind(contact.id,row.workspace_id).first();
  }

  const finalStatus=phone||contact?.normalized_email?'verified':'not_found';
  const summary={status:clean(body.status,80)||null,total_requested_enrichments:Number(body.total_requested_enrichments)||0,unique_enriched_records:Number(body.unique_enriched_records)||0,missing_records:Number(body.missing_records)||0,phone_found:Boolean(phone),credits_consumed:callbackCredits};
  await env.DB.prepare(`UPDATE crm_enrichment_requests SET status=?,credits_used=?,response_summary_json=?,webhook_received_at=?,completed_at=?,updated_at=? WHERE id=? AND webhook_received_at IS NULL`).bind(finalStatus,totalCredits,JSON.stringify(summary),receivedAt,receivedAt,receivedAt,row.id).run();

  if(phone){
    await appendCrmActivity(env.DB,{workspaceId:row.workspace_id,userId:null,role:'system'},{id:`apollo-phone:${row.id}`,companyId:row.company_id,contactId:row.contact_id,type:'contact.phone_enriched',summary:'Apollo verified phone number',metadata:{provider:'Apollo',request_id:row.id,provider_request_id:row.provider_request_id||null,person_provider_id:row.person_provider_id,phone_status:'Verified',credits_used:totalCredits,phone_credits:callbackCredits}});
  }

  return json({ok:true,duplicate:false,request:{id:row.id,status:finalStatus,credits_used:totalCredits},contact},200,cors);
}
