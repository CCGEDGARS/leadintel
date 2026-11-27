import {resolveWorkspaceServiceCredential} from './service-integrations.js';
import {requestFirecrawl} from './firecrawl-request.js';
import {writeCrmRecord} from './crm.js';
import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
const key=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
const owner=(company,person)=>[D.canonicalDomain(company.domain),key(person.publicName||person.name),key(person.title)];
const personName=p=>p.publicName||p.name;
const invalid=message=>Object.assign(Error(message),{status:400});
const incomplete=reason=>({status:'incomplete',reason});
const short=value=>String(value||'').slice(0,80);
const validAddress=(email,domain)=>typeof email==='string'&&/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)&&email.toLowerCase().endsWith('@'+domain)&&! /^(?:info|sales|office|contact|support|mail|team|hr|pr|reception)@/i.test(email);
export function interpretEmail(row,domain){
 const field=row?.fields?.work_email;
 if(!field){
  const calls=Array.isArray(row?.calls)?row.calls:[];
  const misses=calls.length&&calls.every(c=>['miss','not_found','no_match'].includes(c.status));
  return misses?{status:'not_found',reason:'No work email returned by the checked providers.'}:incomplete(calls.length?'Provider checks did not establish a result.':'No provider ran within the credit allowance.');
 }
 const email=String(field.value||'').toLowerCase(),provider=short(field.provider);
 if(field.warning==='employer_mismatch'||field.domain_match!==true||!validAddress(email,domain)||!provider)return incomplete('Provider result did not match the selected company.');
 const raw=row.results?.find(v=>v.provider===provider)?.data;
 const verifier=Array.isArray(raw)?raw[0]:raw;
 if(verifier?.email&&key(verifier.email)!==email)return incomplete('Finder and verifier returned different addresses.');
 if(verifier?.is_role_account===true||verifier?.is_disposable===true||['invalid','undeliverable'].includes(verifier?.status))return incomplete('The returned mailbox failed its provider checks.');
 const deliverable=verifier?.substatus==='deliverable'&&verifier.status==='safe'&&verifier.is_domain_catch_all===false;
 return {status:'found',email,finder:provider,qualification:short(verifier?.qualification||verifier?.status),mailbox:deliverable?'deliverable':verifier?.is_domain_catch_all===true?'catch_all':'unverified',...(deliverable?{verifier:provider}:{}),...(Number.isFinite(verifier?.confidence)?{confidence:verifier.confidence}:{}),...(typeof verifier?.is_domain_catch_all==='boolean'?{catchAll:verifier.is_domain_catch_all}:{})};
}
export async function lookupFirecrawlEmails(env,workspaceId,domain,people,{maxCredits=0,signal,requestId,guard,fetchImpl=fetch}={}){
 const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'firecrawl');
 if(!credential.configured)return people.map(()=>incomplete('Connect Firecrawl to check email providers.'));
 const names=people.map(name=>({name,domain}));
 const options={people:names,contact_fields:['work_email'],profile:false,max_credits:maxCredits};
 const response=await requestFirecrawl(env,workspaceId,'enrich',{
  credential,fetchImpl,beforeDispatch:guard,requestId:requestId||crypto.randomUUID(),purpose:'buyer_research',
  payload:{alexandria:[{provider:'firecrawl',capability:'enrich/auto',options}],timeout:40000},
  signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)
 });
 if(!response.ok)throw Error('Firecrawl email lookup returned HTTP '+response.status);
 const payload=await response.json(),entry=payload?.data?.alexandria?.[0],data=entry?.data;
 if(entry?.error||!Array.isArray(data?.people))throw Error('Firecrawl email lookup returned no usable receipt.');
 const checkedAt=new Date().toISOString();
 return people.map((_,i)=>{
  const matches=data.people.filter(row=>row.input_index===i);
  const result=matches.length===1?interpretEmail(matches[0],domain):incomplete('Missing or ambiguous provider result.');
  return {...(data.stopped&&result.status==='not_found'?incomplete('The provider stopped before all checks finished.'):result),checkedAt,requestId,...(people.length===1?{credits:data.credits_used??null}:{})};
 });
}
export async function applySavedEmails(env,workspaceId,companyId,candidate){
 if(!companyId||!candidate.people?.length)return;
 const records=await env.DB.prepare('SELECT person_name,person_role,origin,evidence_json FROM buyer_email_evidence WHERE workspace_id=? AND company_id=? AND domain=?').bind(workspaceId,companyId,D.canonicalDomain(candidate.domain)).all();
 for(const person of candidate.people){
  delete person.waterfallEmail;
  const [,name,role]=owner(candidate,person);
  const matches=records.results.filter(r=>r.person_name===name&&r.person_role===role).map(r=>({...JSON.parse(r.evidence_json),origin:r.origin}));
  const evidence=matches.find(r=>r.origin==='firecrawl'&&r.status==='found')||matches.find(r=>r.status==='found')||matches[0];
  if(evidence)person.waterfallEmail=evidence;
 }
}
export async function storeEmail(env,context,companyId,candidate,person,result,origin){
 const data={...result,origin,domain:D.canonicalDomain(candidate.domain),identityName:personName(person),identityRole:person.title};
 await writeCrmRecord(env.DB,context,`INSERT INTO buyer_email_evidence(workspace_id,company_id,domain,person_name,person_role,origin,evidence_json,updated_at)
 VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,company_id,domain,person_name,person_role,origin) DO UPDATE SET evidence_json=excluded.evidence_json,updated_at=excluded.updated_at
 WHERE json_extract(excluded.evidence_json,'$.status')='found' AND (json_extract(buyer_email_evidence.evidence_json,'$.mailbox') IS NOT 'deliverable' OR json_extract(excluded.evidence_json,'$.mailbox')='deliverable') OR json_extract(buyer_email_evidence.evidence_json,'$.status')!='found'`,[context.workspaceId,companyId,...owner(candidate,person),origin,JSON.stringify(data),new Date().toISOString()]);
 return data;
}
export async function saveLiveEmail(env,context,candidate,person,companyId,result){
 const evidence=await storeEmail(env,context,companyId,candidate,person,result,'firecrawl');
 if(evidence.mailbox!=='deliverable'||!evidence.email)return {emailEvidence:evidence,research:result};
 const {email}=evidence,personId=String(person.id),name=personName(person),now=result.checkedAt;
 const bind=[context.workspaceId,companyId,personId,name,person.title,email];
 const liveCompany="EXISTS (SELECT 1 FROM crm_companies WHERE id=? AND workspace_id=? AND normalized_domain=? AND deleted_at IS NULL AND lifecycle_status NOT IN ('archived','suppressed'))";
 const companyArgs=[companyId,context.workspaceId,D.canonicalDomain(candidate.domain)];
 const identity="workspace_id=? AND company_id=? AND external_person_id=? AND name=? AND title=? AND normalized_email=?";
 // An address already owned by another CRM contact is never reassigned by a finder.
 await writeCrmRecord(env.DB,context,`INSERT OR IGNORE INTO crm_contacts
 (id,workspace_id,company_id,name,title,work_email,normalized_email,external_person_id,email_status,email_type,verification_provider,verified_at,source,created_at,updated_at)
 SELECT ?,?,?,?,?,?,?,?,'verified','work','Firecrawl',?,'firecrawl',?,? WHERE ${liveCompany}
 AND NOT EXISTS (SELECT 1 FROM crm_contacts WHERE workspace_id=? AND company_id=? AND external_person_id=?)`,
 [crypto.randomUUID(),context.workspaceId,companyId,name,person.title,email,email,personId,now,now,now,...companyArgs,context.workspaceId,companyId,personId]);
 await writeCrmRecord(env.DB,context,`UPDATE crm_contacts SET email_status='verified',email_type='work',verification_provider='Firecrawl',verified_at=?,updated_at=?
 WHERE ${identity} AND archived_at IS NULL AND COALESCE(email_status,'') NOT IN ('invalid','undeliverable','bounced','rejected','suppressed') AND ${liveCompany}`,[now,now,...bind,...companyArgs]);
 const contact=await env.DB.prepare(`SELECT * FROM crm_contacts WHERE ${identity} AND archived_at IS NULL AND email_status='verified' AND verified_at=? AND verification_provider='Firecrawl'`).bind(...bind,now).first();
 return {emailEvidence:evidence,research:result,...(contact?{contact}:{})};
}
async function batchRequestId(jobId,names){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([jobId,names]))));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
export async function checkFreeEmails(env,context,candidate,companyId,people,{confirmedEmail,lookup=lookupFirecrawlEmails,signal,refresh=false,jobId}){
 if(!companyId||!people.length)return;
 await applySavedEmails(env,context.workspaceId,companyId,candidate);
 const due=people.filter(person=>{
  const saved=person.waterfallEmail;
  if(confirmedEmail?.(person)||D.acceptedOfficialBuyerEmail(candidate,person)||D.listedBuyerEmailSource(candidate,person)?.email||people.filter(p=>key(personName(p))===key(personName(person))).length!==1)return false;
  if(jobId&&saved?.jobId===jobId)return false;
  if(saved?.status==='found')return Boolean(refresh&&saved.checkedAt&&Date.now()-Date.parse(saved.checkedAt)>30*86400000);
  return refresh||!saved||Date.now()-Date.parse(saved.checkedAt)>86400000;
 });
 if(!due.length)return;
 let results;
 try{results=await lookup(env,context.workspaceId,D.canonicalDomain(candidate.domain),due.map(personName),{maxCredits:0,requestId:jobId?await batchRequestId(jobId,due.map(personName)):undefined,guard:context.guard,signal});}
 catch(error){if(signal?.aborted)throw error;results=due.map(()=>incomplete('Firecrawl email service was unavailable.'));}
 for(const [i,person] of due.entries()){
  await context.guard?.();
  const evidence={...results[i],checkedAt:results[i].checkedAt||new Date().toISOString(),jobId};
  await saveLiveEmail(env,context,candidate,person,companyId,evidence);
 }
 await applySavedEmails(env,context.workspaceId,companyId,candidate);
}

// Imported records keep their provenance. Only a live, server-owned provider
// response can create a verified recipient in CRM.
export async function importEmailEvidence(env,context,body){
 if(!['owner','researcher','sales'].includes(context.role))throw Object.assign(Error('Workspace research permission required.'),{status:403});
 const bundle=body.bundle,domain=D.canonicalDomain(bundle?.domain||'');
 if(bundle?.version!==1||!domain||!Array.isArray(bundle.records)||!bundle.records.length||bundle.records.length>10)throw invalid('Choose a buyer email evidence file with one to ten records.');
 const company=await env.DB.prepare("SELECT id,company_name,normalized_domain FROM crm_companies WHERE workspace_id=? AND id=? AND normalized_domain=? AND deleted_at IS NULL AND lifecycle_status NOT IN ('archived','suppressed')").bind(context.workspaceId,body.companyId||'',domain).first();
 if(!company)throw invalid('This evidence must match the selected CRM company.');
 const saved=await env.DB.prepare("SELECT result_json FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND json_extract(input_json,'$.candidate.company')=? AND COALESCE(json_extract(input_json,'$.scope'),'all_buyers')='all_buyers' ORDER BY rowid DESC LIMIT 1").bind(context.workspaceId,domain,company.company_name).first();
 const roster=JSON.parse(saved?.result_json||'{}').people||[],rows=[],ids=new Set();
 for(const row of bundle.records){
  if(row.listedName){const parts=key(row.name).split(' '),alias=key(row.listedName).split(' ');if(alias.length<2||alias[0]!==parts[0]||alias.at(-1)!==parts.at(-1))throw invalid('The listed name must match this buyer.');}
  const matches=roster.filter(p=>[row.name,row.listedName].some(n=>n&&key(n)===key(personName(p))));
  if(matches.length!==1||ids.has(matches[0].id)||!row.finder||!validAddress(row.email,domain))throw invalid('Each record needs one matching buyer, a finder and a work email on this domain.');
  const person=matches[0];ids.add(person.id);
  const mailbox=row.mailbox==='deliverable'&&row.verifier&&row.catchAll===false?'deliverable':'unverified';
  const evidence={domain,identityName:personName(person),identityRole:person.title,origin:'imported',status:'found',email:key(row.email),finder:short(row.finder),qualification:short(row.qualification),mailbox,verifier:short(row.verifier),...(typeof row.catchAll==='boolean'?{catchAll:row.catchAll}:{}),...(Number.isFinite(row.confidence)&&row.confidence>=0&&row.confidence<=100?{confidence:row.confidence}:{}),checkedAt:Number.isFinite(Date.parse(row.checkedAt))?new Date(row.checkedAt).toISOString():''};
  rows.push({person,evidence});
 }
 await context.guard?.();
 const authority=context.writeAuthority(),now=new Date().toISOString();
 const writes=rows.map(({person,evidence})=>env.DB.prepare(`INSERT INTO buyer_email_evidence(workspace_id,company_id,domain,person_name,person_role,origin,evidence_json,updated_at) SELECT ?,?,?,?,?,'imported',?,? WHERE (${authority.sql}) AND EXISTS(SELECT 1 FROM crm_companies WHERE id=? AND workspace_id=? AND normalized_domain=? AND deleted_at IS NULL AND lifecycle_status NOT IN ('archived','suppressed')) ON CONFLICT(workspace_id,company_id,domain,person_name,person_role,origin) DO UPDATE SET evidence_json=excluded.evidence_json,updated_at=excluded.updated_at`).bind(context.workspaceId,company.id,...owner({domain},person),JSON.stringify(evidence),now,...authority.args,company.id,context.workspaceId,domain));
 const results=await env.DB.batch(writes);
 if(results.some(r=>!r.meta.changes))throw invalid('Company access changed. Reopen the selected company.');
 const candidate={domain,people:rows.map(({person})=>({...person}))};await applySavedEmails(env,context.workspaceId,company.id,candidate);
 return candidate.people.map(p=>({personId:p.id,evidence:p.waterfallEmail}));
}
