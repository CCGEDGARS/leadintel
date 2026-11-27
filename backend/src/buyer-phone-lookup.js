import {enrichCrmContact} from './crm-routes.js';
import {lookupAdditionalEmail} from './additional-contact-services.js';
import {websitePaidScope} from './website-contact-paid.js';

const key=row=>[row.workspace_id,row.company_id,row.apollo_id];
const where='workspace_id=? AND company_id=? AND apollo_id=?';
export const phoneIdentity=p=>JSON.stringify([p.publicName||p.name,p.title||'',p.organization||'',p.publicLinkedinUrl||p.linkedin_url||'']);

export async function startBuyerPhone(env,context,companyId,person,apolloId,{guard,signal,websiteJob,enrich=enrichCrmContact}={}){
 await guard();
 const db=env.DB,ids=[context.workspaceId,companyId,apolloId];
 const identity=phoneIdentity(person);
 await db.prepare('INSERT OR IGNORE INTO buyer_phone_aliases(workspace_id,company_id,person_id,identity_json,apollo_id) VALUES(?,?,?,?,?)').bind(context.workspaceId,companyId,String(person.id),identity,apolloId).run();
 const alias=await db.prepare('SELECT apollo_id FROM buyer_phone_aliases WHERE workspace_id=? AND company_id=? AND person_id=? AND identity_json=?').bind(context.workspaceId,companyId,String(person.id),identity).first();
 if(alias?.apollo_id!==apolloId)throw Error('Conflicting Apollo identities for this buyer');
 const saved=await db.prepare("SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND (external_person_id=? OR id IN (SELECT r.contact_id FROM buyer_phone_lookups f JOIN crm_enrichment_requests r ON r.id=f.request_id WHERE f.workspace_id=? AND f.company_id=? AND f.apollo_id=?)) AND archived_at IS NULL AND phone_number IS NOT NULL AND lower(phone_status) IN ('verified','provider_listed')").bind(...ids,...ids).first();
 if(saved&&String(saved.name).trim().toLowerCase()===String(person.publicName||person.name).trim().toLowerCase())return {contact:{...saved,phone_identity_aliases:[{id:String(person.id),identity}]},cached:true,request:{status:'already_confirmed',credits_used:0}};
 await db.prepare('INSERT OR IGNORE INTO buyer_phone_lookups(workspace_id,company_id,apollo_id,person_id,identity_json,website_job,user_id,session_hash,role) VALUES(?,?,?,?,?,?,?,?,?)').bind(...ids,String(person.id),phoneIdentity(person),websiteJob||null,context.userId,context.sessionHash,context.role).run();
 const row=await db.prepare('SELECT * FROM buyer_phone_lookups WHERE '+where).bind(...ids).first();
 if(JSON.parse(row.identity_json)[0].trim().toLowerCase()!==String(person.publicName||person.name).trim().toLowerCase())throw Error('Saved phone lookup identity changed');
 if(row.state==='held'){
  // A new approval may resume a held lookup using fresh session authority.
  await db.prepare("UPDATE buyer_phone_lookups SET state='waiting',lease_until=0,website_job=?,person_id=?,identity_json=?,session_hash=?,user_id=?,role=? WHERE "+where+" AND state='held'").bind(websiteJob||null,String(person.id),phoneIdentity(person),context.sessionHash,context.userId,context.role,...ids).run();
 }
 if(row.state==='complete')return {cached:true,request:{status:'complete',credits_used:0}};
 const bindRequest=id=>db.prepare('UPDATE buyer_phone_lookups SET request_id=? WHERE '+where+' AND request_id IS NULL').bind(id,...ids).run();
 const history=await db.prepare("SELECT id,status FROM crm_enrichment_requests WHERE workspace_id=? AND company_id=? AND person_provider_id=? AND provider='apollo' AND phone_requested=1 AND (status!='failed' OR credits_used>0) ORDER BY rowid DESC LIMIT 1").bind(...ids).first();
 if(history){await bindRequest(history.id);return {cached:true,request:{status:history.status==='not_found'?'processing':history.status,id:history.id}};}
 const matches=(await db.prepare("SELECT id FROM crm_contacts WHERE workspace_id=? AND company_id=? AND archived_at IS NULL AND external_person_id IN (?,?) AND lower(trim(name))=lower(trim(?)) LIMIT 2").bind(context.workspaceId,companyId,String(person.id),apolloId,person.publicName||person.name).all()).results;
 if(matches.length>1)throw Error('Multiple saved contacts match this buyer. Resolve the duplicate before a paid lookup.');
 const req=new Request('https://leadintel.internal/enrich',{method:'POST',signal,body:JSON.stringify({person_id:apolloId,contact_id:matches[0]?.id,name:person.publicName||person.name,title:person.title,phone_lookup:true})});
 const response=await enrich(req,env,{},{context,guard},companyId),result=await response.json();
 if(!response.ok)throw Object.assign(Error(result.error),{status:response.status,code:result.code});
 if(result.request?.id)await bindRequest(result.request.id);
 if(result.contact?.external_person_id===apolloId)result.contact.phone_identity_aliases=[{id:String(person.id),identity}];
 return result;
}

// Only a settled, identity-matched callback may release the second purchase.
// Both entry points use the Apollo person ID as the shared durable key.
export async function runBuyerPhoneFallbacks(env,{lookup=lookupAdditionalEmail}={}){
 const rows=(await env.DB.prepare(`SELECT f.*,r.contact_id FROM buyer_phone_lookups f
 JOIN crm_enrichment_requests r ON r.workspace_id=f.workspace_id AND r.company_id=f.company_id AND r.person_provider_id=f.apollo_id AND r.id=f.request_id
 JOIN crm_contacts c ON c.id=r.contact_id AND c.workspace_id=f.workspace_id AND c.company_id=f.company_id
 WHERE f.state='waiting' AND f.lease_until<unixepoch() AND r.provider='apollo' AND r.phone_requested=1
 AND r.status='not_found' AND r.webhook_received_at IS NOT NULL AND r.error_code IS NULL
 AND json_extract(r.response_summary_json,'$.identity_verified')=1 AND json_extract(r.response_summary_json,'$.definitive_phone_miss')=1
 AND c.archived_at IS NULL AND COALESCE(c.phone_number,'')='' AND NOT EXISTS (SELECT 1 FROM crm_enrichment_requests newer WHERE newer.workspace_id=r.workspace_id AND newer.company_id=r.company_id AND newer.person_provider_id=r.person_provider_id AND newer.phone_requested=1 AND newer.rowid>r.rowid)
 ORDER BY f.lease_until LIMIT 4`).all()).results||[];
 for(const row of rows){
  const lease=Math.floor(Date.now()/1000)+300,ids=key(row);
  const claimed=await env.DB.prepare("UPDATE buyer_phone_lookups SET lease_until=? WHERE "+where+" AND state='waiting' AND lease_until<unixepoch()").bind(lease,...ids).run();
  if(!claimed.meta.changes)continue;
  const context={workspaceId:row.workspace_id,userId:row.user_id,role:row.role,sessionHash:row.session_hash};
  const authority=()=>({sql:`EXISTS(SELECT 1 FROM buyer_phone_lookups WHERE ${where} AND lease_until=? AND state='waiting') AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.user_id=? AND s.expires_at>datetime('now') AND m.workspace_id=? AND m.role=?)`,args:[...ids,lease,row.session_hash,row.user_id,row.workspace_id,row.role]});
  const guard=async()=>{const a=authority();if(!await env.DB.prepare('SELECT 1 WHERE '+a.sql).bind(...a.args).first())throw Error('Phone lookup authority changed');};
  guard.writeAuthority=authority;
  try{
   await guard();
   let researchScope;
   if(row.website_job){
    const job=await env.DB.prepare('SELECT revision FROM website_contact_jobs WHERE workspace_id=? AND id=?').bind(row.workspace_id,row.website_job).first();
    const scoped=await websitePaidScope(env,context,{approved:true,channel:'phone',provider:'treg',jobId:row.website_job,revision:job?.revision,personId:row.person_id});
    researchScope=scoped.scope;
   }
   const result=await lookup(env,context,row.company_id,{approved:true,provider:'treg',person_id:row.person_id,data_lookup:true,phone_approved:true,email_lookup:false},{guard,researchScope,phoneFallbackIdentity:row.identity_json});
   if(result.request?.status==='processing')continue;
   await guard();
   // Persist the source-attributed number on the same CRM contact used by Apollo.
   const number=result.contactData?.phone?.number;
   if(number)await env.DB.prepare("UPDATE crm_contacts SET phone_number=?,phone_status='provider_listed' WHERE workspace_id=? AND company_id=? AND id=? AND archived_at IS NULL AND COALESCE(phone_number,'')=''").bind(number,row.workspace_id,row.company_id,row.contact_id).run();
   await env.DB.prepare("UPDATE buyer_phone_lookups SET state='complete',result_json=? WHERE "+where+" AND lease_until=?").bind(JSON.stringify({status:result.request?.status,phone:result.contactData?.phone?.status}),...ids,lease).run();
  }catch(error){
   // Stop on revoked authority, changed evidence, provider or budget holds.
   await env.DB.prepare("UPDATE buyer_phone_lookups SET state='held',result_json=? WHERE "+where+" AND lease_until=?").bind(JSON.stringify({code:error.code||'PHONE_FALLBACK_HOLD'}),...ids,lease).run();
  }
 }
}
