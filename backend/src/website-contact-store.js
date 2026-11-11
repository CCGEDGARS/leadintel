import {cookieValue,sha256} from './security.js';
import {normalizeDomain} from './crm.js';
import {websiteContactIdentity} from './website-contact-evidence.js';

export const contactSql=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export const contactParse=(value,fallback={})=>{try{return JSON.parse(value)}catch{return fallback}};
export const contactError=(message,status=409,code='WEBSITE_CONTACT_CHANGED')=>Object.assign(Error(message),{status,code});
export const contactActive=status=>['queued','running'].includes(status);
// This scope deliberately does not mention the seller Profile, markets or fit.
// Exact role, session and company identity are checked inside every result write.
export const contactCompanyAuthority=`EXISTS(SELECT 1 FROM crm_companies c WHERE c.workspace_id=website_contact_jobs.workspace_id AND c.id=website_contact_jobs.company_id AND c.deleted_at IS NULL AND c.lifecycle_status NOT IN ('suppressed','archived') AND c.company_name=json_extract(website_contact_jobs.input_json,'$.company') AND c.normalized_domain=json_extract(website_contact_jobs.input_json,'$.domain'))`;
export const contactAuthority=`EXISTS(SELECT 1 FROM workspace_members m JOIN sessions s ON s.user_id=m.user_id WHERE m.workspace_id=website_contact_jobs.workspace_id AND m.user_id=website_contact_jobs.requested_by AND m.role=website_contact_jobs.requested_role AND m.role IN ('owner','researcher','sales') AND s.token_hash=website_contact_jobs.session_hash AND s.expires_at>datetime('now')) AND ${contactCompanyAuthority}`;

export async function websiteContactAccess(request,env,workspaceId){
 const token=cookieValue(request,'leadintel_session'),hash=token?await sha256(token):'';
 const user=hash?await contactSql(env,"SELECT s.user_id,m.role FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.workspace_id=?",hash,workspaceId).first():null;
 if(!user)throw contactError('Sign in to this workspace before researching contacts.',401);
 if(!['owner','researcher','sales'].includes(user.role))throw contactError('This workspace role cannot research contacts.',403);
 return {workspaceId,userId:user.user_id,role:user.role,sessionHash:hash};
}
export async function readWebsiteContacts(env,workspaceId,{id,companyId}={}){
 return id?contactSql(env,'SELECT * FROM website_contact_jobs WHERE workspace_id=? AND id=?',workspaceId,id).first():contactSql(env,'SELECT * FROM website_contact_jobs WHERE workspace_id=? AND company_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',workspaceId,companyId||'').first();
}
export function publicWebsiteContacts(row){
 if(!row)return null;
 const input=contactParse(row.input_json),state=contactParse(row.state_json),tasks=state.tasks||[],people=(state.people||[]).filter(websiteContactIdentity),excluded=(state.people||[]).length-people.length;
 return {id:row.id,companyId:row.company_id,company:input.company,domain:input.domain,status:row.status,revision:row.revision,phase:state.phase||'discovery',label:excluded?'Publication results were excluded from professional identities. Saved sources are retained; continue public research.':state.label||'Public contact research queued',description:state.description||'',descriptionSourceUrl:state.descriptionSourceUrl||'',people,channels:state.channels||[],routes:state.routes||[],sources:tasks.filter(t=>t.kind==='read'&&t.status==='complete').map(t=>t.result).map(({markdown,links,...source})=>source),tools:state.tools||[],gaps:state.gaps||[],coverage:{...state.coverage,excludedIndexedResults:excluded+(state.excludedIdentities||[]).length},counts:{discovered:people.length,checked:people.filter(p=>p.freeResearchStatus==='complete').length,review:people.filter(p=>p.freeResearchStatus==='needs_review').length,pending:people.filter(p=>!p.freeResearchStatus).length,reads:tasks.filter(t=>t.kind==='read'&&t.status==='complete').length,completed:tasks.filter(t=>t.status==='complete').length,planned:tasks.length},paidContacts:false,canResume:['incomplete','canceled'].includes(row.status),updatedAt:row.updated_at};
}
export async function websiteContactView(env,row){
 const view=publicWebsiteContacts(row);if(!view)return null;
 const company=await contactSql(env,'SELECT company_name,normalized_domain,lifecycle_status FROM crm_companies WHERE workspace_id=? AND id=? AND deleted_at IS NULL',row.workspace_id,row.company_id).first();
 if(!company||company.company_name!==view.company||company.normalized_domain!==view.domain||['suppressed','archived'].includes(company.lifecycle_status)){view.researchBlocked=true;view.canResume=false;view.label='The company identity or CRM status changed. Review the company before continuing research.';}
 const {results=[]}=await contactSql(env,'SELECT external_person_id,name,title,linkedin_url,work_email,email_status,phone_number,phone_status,source,verification_provider,verified_at,public_email_url FROM crm_contacts WHERE workspace_id=? AND company_id=? AND archived_at IS NULL LIMIT 500',row.workspace_id,row.company_id).all();
 for(const person of view.people){const found=results.filter(c=>String(c.external_person_id)===String(person.id)&&String(c.name||'').trim().toLowerCase()===String(person.publicName||person.name||'').trim().toLowerCase()&&(!c.linkedin_url||!person.publicLinkedinUrl&&!person.linkedin_url||c.linkedin_url===(person.publicLinkedinUrl||person.linkedin_url)));if(found.length===1){person.savedContact=found[0];person.savedContactRoleDiffers=String(found[0].title||'').trim().toLowerCase()!==String(person.title||'').trim().toLowerCase();}}
 return view;
}
export async function startWebsiteContacts(env,context,body){
 const company=await contactSql(env,"SELECT * FROM crm_companies WHERE workspace_id=? AND id=? AND deleted_at IS NULL AND lifecycle_status NOT IN ('suppressed','archived')",context.workspaceId,String(body.companyId||'')).first();
 if(!company||!normalizeDomain(company.normalized_domain))throw contactError('Save and check the company website before researching contacts.');
 const old=await readWebsiteContacts(env,context.workspaceId,{companyId:company.id});
 if(old&&contactParse(old.input_json).company===company.company_name&&contactParse(old.input_json).domain===company.normalized_domain)return old;
 if(old&&contactActive(old.status)){const canceled=await contactSql(env,`UPDATE website_contact_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1 WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.workspace_id=? AND m.user_id=? AND m.role=?)`,old.id,context.workspaceId,old.revision,context.sessionHash,context.workspaceId,context.userId,context.role).run();if(!canceled.meta.changes)throw contactError('The previous research changed. Refresh its saved progress.');}
 const id=crypto.randomUUID(),input={company:company.company_name,domain:company.normalized_domain,website:'https://'+company.normalized_domain+'/',purpose:'website_contacts',paidResearch:false};
 const state={phase:'discovery',label:'Read company website and find management first',people:[],sources:[],tasks:[],tools:[],gaps:[],discoveryStep:0,batchLimit:10,freeRevision:1,coverage:{peopleLimit:300,sourceLimit:40,apolloPageLimit:4,exhaustive:false}};
 const result=await contactSql(env,`INSERT INTO website_contact_jobs(id,workspace_id,company_id,requested_by,requested_role,session_hash,input_json,state_json,deadline_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.workspace_id=? AND m.user_id=? AND m.role=?) AND EXISTS(SELECT 1 FROM crm_companies c WHERE c.id=? AND c.workspace_id=? AND c.company_name=? AND c.normalized_domain=? AND c.deleted_at IS NULL AND c.lifecycle_status NOT IN ('suppressed','archived'))`,id,context.workspaceId,company.id,context.userId,context.role,context.sessionHash,JSON.stringify(input),JSON.stringify(state),Date.now()+30*60000,context.sessionHash,context.workspaceId,context.userId,context.role,company.id,context.workspaceId,input.company,input.domain).run();
 if(!result.meta.changes)throw contactError('The company or workspace authority changed.');
 return readWebsiteContacts(env,context.workspaceId,{id});
}
export async function commandWebsiteContacts(env,context,body){
 const row=await readWebsiteContacts(env,context.workspaceId,{id:body.jobId});
 if(!row)throw contactError('Saved contact research was not found.',404);
 if(row.requested_by!==context.userId&&context.role!=='owner')throw contactError('Only the requester or workspace owner can continue this research.',403);
 if(body.action==='cancel'){
  if(!contactActive(row.status))return row;
  // Stop grants no new work. Do not let normal source checkpoints invalidate
  // it, and never replace the latest saved state with the browser's snapshot.
  const stopped=await contactSql(env,`UPDATE website_contact_jobs SET status='canceled',revision=revision+1,lease_token=NULL,lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND status IN ('queued','running') AND (requested_by=? OR ?='owner') AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.workspace_id=? AND m.user_id=? AND m.role=?)`,row.id,context.workspaceId,context.userId,context.role,context.sessionHash,context.workspaceId,context.userId,context.role).run();
  if(!stopped.meta.changes){const current=await readWebsiteContacts(env,context.workspaceId,{id:row.id});if(current&&!contactActive(current.status))return current;throw contactError('Research authority changed before Stop could be saved.');}
  return readWebsiteContacts(env,context.workspaceId,{id:row.id});
 }
 if(row.revision!==body.revision)throw contactError('Research progress changed. Refresh its saved results.');
 const state=contactParse(row.state_json);
 if(!['incomplete','canceled'].includes(row.status))return row;
 {state.operationLimit=(state.tasks||[]).length+600;state.batchLimit=Math.min(300,(state.people||[]).filter(p=>p.freeResearchStatus).length+10);state.freeRevision=(state.freeRevision||1)+1;for(const task of state.tasks||[])if(task.status==='failed'){task.attempts=0;task.status='pending';}for(const person of state.people||[])if(person.freeResearchStatus==='needs_review')delete person.freeResearchStatus;state.label='Continuing unfinished public contact checks';}
 const result=await contactSql(env,`UPDATE website_contact_jobs SET status=?,state_json=?,requested_by=?,requested_role=?,session_hash=?,deadline_at=?,revision=revision+1,lease_token=NULL,lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM workspace_members m JOIN sessions s ON s.user_id=m.user_id WHERE m.workspace_id=? AND m.user_id=? AND m.role=? AND s.token_hash=? AND s.expires_at>datetime('now')) AND EXISTS(SELECT 1 FROM crm_companies c WHERE c.id=website_contact_jobs.company_id AND c.workspace_id=website_contact_jobs.workspace_id AND c.company_name=json_extract(input_json,'$.company') AND c.normalized_domain=json_extract(input_json,'$.domain') AND c.deleted_at IS NULL AND c.lifecycle_status NOT IN ('suppressed','archived'))`,'queued',JSON.stringify(state),context.userId,context.role,context.sessionHash,Date.now()+30*60000,row.id,context.workspaceId,row.revision,context.workspaceId,context.userId,context.role,context.sessionHash).run();
 if(!result.meta.changes)throw contactError('The company or research authority changed.');
 return readWebsiteContacts(env,context.workspaceId,{id:row.id});
}
