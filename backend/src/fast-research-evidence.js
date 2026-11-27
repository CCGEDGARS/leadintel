import {websiteIdentitySupport,websiteNameKey} from './website-contact-evidence.js';
import {websiteStaffCards} from './website-contact-staff.js';
// Step 2 owns these receipts. Step 4 reads them in place, without copying page
// bodies into a second storage allowance or counting them as new provider calls.
export async function savedFastResearch(env,workspaceId,candidate,now=Date.now()){
 const row=await env.DB.prepare(`SELECT j.id,j.status,j.deadline_at,j.state_json FROM website_contact_jobs j
 JOIN crm_companies c ON c.workspace_id=j.workspace_id AND c.id=j.company_id
 WHERE j.workspace_id=? AND c.normalized_domain=? AND c.deleted_at IS NULL AND c.lifecycle_status NOT IN ('suppressed','archived')
 AND json_extract(j.input_json,'$.domain')=c.normalized_domain AND json_extract(j.input_json,'$.company')=c.company_name
 AND c.company_name=? AND (?='' OR c.id=?) AND json_extract(j.input_json,'$.managementLimit')>0
 AND j.updated_at>=datetime('now','-30 days') ORDER BY j.rowid DESC LIMIT 1`).bind(workspaceId,candidate.domain,candidate.company,candidate.crmId||'',candidate.crmId||'').first();
 if(!row)return null;
 const state=JSON.parse(row.state_json),pages=new Map(),index=new Map();
 let directory;
 for(const t of state.tasks||[]){
  const age=now-Date.parse(t.checkedAt);
  if(t.archived||t.status!=='complete'||!(age>=0&&age<=30*86400000))continue;
  const value=t.result;
  if(t.kind==='read'&&value?.sourceRead&&value.markdown&&!value.archived&&globalThis.LeadIntelDiscovery.buyerSourceReadLocation(candidate,t.value,value)){
   const key=globalThis.LeadIntelCompanyDossier.url(t.value);
   if(key&&now-Date.parse(value.extractedAt)>=0&&now-Date.parse(value.extractedAt)<=30*86400000)pages.set(key,value);
  }else if(t.kind==='public_index'&&Array.isArray(value))index.set('Free public index | '+t.value,{hits:value});
  else if(t.kind==='apollo'&&t.value==='management-company-identities'&&Array.isArray(value?.people))directory=value;
 }
 // Only carry a saved name and current role. Channel values and mailbox status
 // use their own source checks in the buyer job.
 const staff=(state.people||[]).flatMap(person=>{
  if(websiteIdentitySupport(candidate,person).kind!=='official')return [];
  const page=pages.get(globalThis.LeadIntelCompanyDossier.url(person.publicNameUrl)),name=person.publicName||person.name;
  if(!page||!websiteNameKey(page.markdown).includes(websiteNameKey(name)))return [];
  return [{id:person.id,name,publicName:name,title:person.title,organization:candidate.company,publicNameUrl:person.publicNameUrl,identitySource:'public',identityStatus:'confirmed',companyContactSource:'official_staff'}];
 });
 return {jobId:row.id,pages,index,directory,staff,active:['queued','running'].includes(row.status)&&row.deadline_at>now};
}

// Company discovery may only know the domain yet. Reuse an exact official
// page from a still-current CRM company, then apply the list's own fit checks.
export async function fastCompanyPage(env,workspaceId,url,domain){
 const receipt=await env.DB.prepare(`SELECT json_extract(t.value,'$.result') AS page
  FROM crm_companies c JOIN website_contact_jobs j ON j.workspace_id=c.workspace_id AND j.company_id=c.id,
  json_each(j.state_json,'$.tasks') t
  WHERE c.workspace_id=? AND c.normalized_domain=? AND c.deleted_at IS NULL AND c.lifecycle_status NOT IN ('suppressed','archived')
  AND json_extract(j.input_json,'$.company')=c.company_name AND json_extract(j.input_json,'$.domain')=c.normalized_domain
  AND json_extract(j.input_json,'$.managementLimit')>0 AND json_extract(t.value,'$.kind')='read'
  AND json_extract(t.value,'$.status')='complete' AND NOT COALESCE(json_extract(t.value,'$.archived'),0)
  AND json_extract(t.value,'$.value')=? AND datetime(json_extract(t.value,'$.checkedAt')) BETWEEN datetime('now','-30 days') AND datetime('now')
  ORDER BY j.rowid DESC LIMIT 1`).bind(workspaceId,domain,url).first();
 if(!receipt?.page)return null;
 const page=JSON.parse(receipt.page);
 const age=Date.now()-Date.parse(page.extractedAt);
 return age>=0&&age<=30*86400000&&page.sourceRead&&page.markdown&&!page.archived?{data:page,researchTrace:[{provider:'saved',operation:'extract',status:'reused',results:1}]}:null;
}

// Recover a failed standalone search from its own completed page reads and
// the selected company's recent website research, without dispatching a lookup.
export async function recoverOfficialBuyers(env,row,input,candidate){
 if(candidate.people?.length||input.scope==='selected_buyers'||input.taskId||input.recheck||input.paidResearch||!input.fullResearch||row.status!=='needs_review')return;
 const D=globalThis.LeadIntelDiscovery;
 const saved=await savedFastResearch(env,row.workspace_id,candidate);
 const reads=await env.DB.prepare("SELECT request_value,result_json FROM buyer_research_tasks WHERE job_id=? AND kind='read' AND status='complete' AND updated_at>=datetime('now','-30 days') ORDER BY updated_at DESC LIMIT 40").bind(row.id).all();
 const pages=new Map(saved?.pages||[]);
 for(const item of reads.results||[]){
  const page=JSON.parse(item.result_json),age=Date.now()-Date.parse(page.extractedAt);
  if(page.sourceRead===true&&age>=0&&age<=30*86400000&&D.canonicalDomain(page.url)===candidate.domain&&D.buyerSourceReadLocation(candidate,item.request_value,page)&&typeof page.markdown==='string')pages.set(page.url,page);
 }
 const staffPage=page=>/team|staff|people|management|leadership|contact|about|kontakt|ledelse|om-os|medarbejd/i.test(page.url);
 const official=[...pages.values()].filter(p=>D.canonicalDomain(p.url)===candidate.domain).sort((a,b)=>Number(staffPage(b))-Number(staffPage(a))).slice(0,10);
 const people=D.mergeBuyerPool(saved?.staff||[],[...D.discoverCompanyContacts(official,candidate),...official.flatMap(p=>websiteStaffCards(p,candidate))],input.profile);
 if(people.length)candidate.people=D.retainBuyerIdentities(people,input.profile,candidate).slice(0,10);
}
