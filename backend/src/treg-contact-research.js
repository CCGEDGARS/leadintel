import {resolveWorkspaceServiceCredential} from './service-integrations.js';
import {upsertCrmContacts,appendCrmActivity,getCrmCompany,writeCrmRecord} from './crm.js';
import {sha256} from './security.js';
const fail=(message,status=409,code='TREG_RESEARCH_HOLD')=>Object.assign(Error(message),{status,code});
const identity=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const nameKey=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ').toLowerCase();
const tag=value=>String(value||'').replace(/[^a-zA-Z0-9._:-]/g,'_').slice(0,128);
const object=value=>value&&typeof value==='object'?value:{};
const profile=value=>{try{const url=new URL(value);return /(^|\.)linkedin\.com$/.test(url.hostname)&&url.pathname.startsWith('/in/')?url.pathname.replace(/\/$/,'').toLowerCase():'';}catch{return '';}};

async function lookupKeys(context,candidate,person,companyId,attemptKey){
 const base=await sha256([context.workspaceId,companyId,person.id,attemptKey].join('|'));
 const dataBase=await sha256([context.workspaceId,companyId,person.id,attemptKey,identity(person.publicName||person.name),String(candidate.domain||'').toLowerCase(),person.publicLinkedinUrl||person.linkedin_url||''].join('|'));
 return {base,dataBase};
}
// Read the durable phase ledger, including charged responses which did not finish.
// Replaying a phase never adds its settled charge a second time.
export async function tregLookupAccounting(env,context,candidate,person,companyId,attemptKey,retained={}){
 const {base,dataBase}=await lookupKeys(context,candidate,person,companyId,attemptKey),ids=[...new Set(retained.callIds||[])].slice(0,40);
 const {results=[]}=await env.DB.prepare("SELECT request_key,phase,call_id,cost_micro FROM treg_contact_calls WHERE workspace_id=? AND (request_key IN (?,?)"+(ids.length?' OR call_id IN ('+ids.map(()=>'?').join(',')+')':'')+')').bind(context.workspaceId,base,dataBase,...ids).all();
 return {costMicro:results.length?results.reduce((sum,row)=>sum+(Number(row.cost_micro)||0),0):Number(retained.costMicro)||0,callIds:[...new Set([...ids,...results.map(row=>row.call_id).filter(Boolean)])]};
}
export function mergeTregContactData(prior,incoming,{includeEmail=true,includePhone=true}={}){
 if(!incoming)return prior;
 const same=prior?.version===1&&prior.domain===incoming.domain&&String(prior.personId)===String(incoming.personId)&&['identityName','identityTitle','identityOrganization','identityLinkedinUrl'].every(field=>!prior[field]||!incoming[field]||nameKey(prior[field])===nameKey(incoming[field]));
 if(!same)return {...incoming};
 const stamp=(row,fallback)=>Date.parse(row?.checkedAt||fallback||'')||0;
 const channel=(field,requested)=>{
  const old=prior[field],next=incoming[field];if(!old)return next;if(!requested||!next||next.status==='not_requested')return old;
  const found=row=>field==='phone'?Boolean(row?.number):row?.status==='provider_reported';
  if(found(old)&&!found(next))return old;
  if(found(old)===found(next)&&stamp(old,prior.checkedAt)>stamp(next,incoming.checkedAt))return old;
  return field==='profile'&&found(old)&&found(next)?{...old,...Object.fromEntries(Object.entries(next).filter(([,value])=>value!==''&&value!==null&&value!==undefined))}:next;
 };
 const latest=stamp(prior)>stamp(incoming)?prior:incoming,merged={...prior,...incoming,checkedAt:latest.checkedAt,profile:channel('profile',includeEmail),phone:channel('phone',includePhone),lastAttempt:latest.lastAttempt,costMicro:Math.max(Number(prior.costMicro)||0,Number(incoming.costMicro)||0),callIds:[...new Set([...(prior.callIds||[]),...(incoming.callIds||[])])]};
 merged.status=latest.status==='partial'||[merged.profile,merged.phone].some(row=>['error','conflict'].includes(row?.status))?'partial':merged.profile?.status==='provider_reported'||merged.phone?.number||latest.status==='updated'?'updated':'no_new_data';
 return merged;
}
function buyerContactData(value,person,domain){
 return value?.version===1&&value.domain===domain&&String(value.personId)===String(person.id)&&(!value.identityTitle||nameKey(value.identityTitle)===nameKey(person.title))&&(!value.identityOrganization||nameKey(value.identityOrganization)===nameKey(person.organization))&&(!value.identityName||nameKey(value.identityName)===nameKey(person.publicName||person.name))&&(!value.identityLinkedinUrl||!(person.publicLinkedinUrl||person.linkedin_url)||profile(value.identityLinkedinUrl)===profile(person.publicLinkedinUrl||person.linkedin_url))?value:null;
}
async function currentBuyerData(env,context,person,companyId,domain){
 const row=await env.DB.prepare('SELECT research_snapshot_json FROM crm_intelligence WHERE company_id=? AND workspace_id=?').bind(companyId,context.workspaceId).first();
 const saved=(JSON.parse(row?.research_snapshot_json||'{}').buyerResearch?.buyers||[]).find(buyer=>String(buyer.id)===String(person.id));
 return {saved,data:buyerContactData(saved?.contactData,person,domain)};
}
async function saveBuyerData(env,context,candidate,person,companyId,attemptKey,data,{guard,includeEmail,includePhone}){
 const expectedProfile=person.publicLinkedinUrl||person.linkedin_url||'',selected="SELECT e.key FROM json_each(research_snapshot_json,'$.buyerResearch.buyers') e WHERE CAST(json_extract(e.value,'$.id') AS TEXT)=? AND COALESCE(NULLIF(json_extract(e.value,'$.publicName'),''),json_extract(e.value,'$.name'))=? AND json_extract(e.value,'$.title')=? AND COALESCE(NULLIF(json_extract(e.value,'$.publicLinkedinUrl'),''),json_extract(e.value,'$.linkedin_url'),'')=? LIMIT 1";
 const selectedArgs=[String(person.id),person.publicName||person.name,person.title,expectedProfile];
 for(let retry=0;retry<5;retry++){
  await guard();const current=await currentBuyerData(env,context,person,companyId,candidate.domain);
  const merged=mergeTregContactData(current.data,data,{includeEmail,includePhone});Object.assign(merged,await tregLookupAccounting(env,context,candidate,person,companyId,attemptKey,merged));
  const written=await writeCrmRecord(env.DB,context,"UPDATE crm_intelligence SET research_snapshot_json=json_set(research_snapshot_json,'$.buyerResearch.buyers['||("+selected+")||'].contactData',json(?)),intelligence_updated_at=? WHERE company_id=? AND workspace_id=? AND ("+selected+") IS NOT NULL AND COALESCE(json_extract(research_snapshot_json,'$.buyerResearch.buyers['||("+selected+")||'].contactData'),'null')=?",[...selectedArgs,JSON.stringify(merged),merged.checkedAt,companyId,context.workspaceId,...selectedArgs,...selectedArgs,JSON.stringify(current.saved?.contactData||null)]);
  if(written?.meta?.changes??written?.changes)return merged;
 }
 throw fail('The selected buyer changed or is still being saved. Retry the saved lookup.');
}

// One backend boundary owns attribution, request ceilings and idempotency.
export async function findTregWorkEmail(env,context,candidate,person,companyId,{attemptKey,guard=async()=>{},onDispatch=()=>{},dataLookup=false,includePhone=false,includeEmail=true,existingContact=null}={},deps={}){
 const parentGuard=guard,resolveCredential=deps.credential||resolveWorkspaceServiceCredential;
 await parentGuard();
 const credential=await resolveCredential(env,context.workspaceId,'treg');
 if(credential.source!=='customer'||!credential.apiKey)throw fail('Connect your Treg team token in Settings.',409,'ADDITIONAL_CONTACT_PROVIDER_REQUIRED');
 const revision=credential.row?.encrypted_api_key||credential.apiKey,credentialHash=await sha256(revision);
 guard=async options=>{await parentGuard(options);const current=await resolveCredential(env,context.workspaceId,'treg');if(current.source!=='customer'||(current.row?.encrypted_api_key||current.apiKey)!==revision)throw fail('The Treg connection changed. Review the saved lookup before retrying.',409,'ADDITIONAL_CONTACT_PROVIDER_CHANGED');await parentGuard(options);};
 const parentAuthority=context.writeAuthority||parentGuard.writeAuthority;
 context={...context,guard,writeAuthority:credential.row?.encrypted_api_key?()=>{const prior=parentAuthority?.();return {sql:[prior?.sql,"EXISTS(SELECT 1 FROM workspace_service_integrations WHERE workspace_id=? AND provider='treg' AND encrypted_api_key=?)"].filter(Boolean).map(s=>'('+s+')').join(' AND '),args:[...(prior?.args||[]),context.workspaceId,credential.row.encrypted_api_key]};}:parentAuthority};
 const name=String(person.publicName||person.name||'').trim(),parts=name.split(/\s+/),domain=String(candidate.domain||'').toLowerCase();
 if(parts.length<2||!domain||!attemptKey)throw fail('A qualified named buyer, company domain and saved lookup are required.');
 const {base,dataBase}=await lookupKeys(context,candidate,person,companyId,attemptKey);
 const requestKey=phase=>['profile','phone'].includes(phase)?dataBase:base;
 const receipt=deps.receipt||(async row=>{
  await env.DB.prepare(`INSERT INTO treg_contact_calls(workspace_id,request_key,phase,call_id,cost_micro,result_json) VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id,request_key,phase) DO UPDATE SET call_id=COALESCE(excluded.call_id,call_id),cost_micro=MAX(cost_micro,excluded.cost_micro),poll_count=poll_count+1,result_json=excluded.result_json,updated_at=CURRENT_TIMESTAMP`).bind(context.workspaceId,requestKey(row.phase),row.phase,row.callId,row.costMicro,JSON.stringify(row.body)).run();
  await env.DB.prepare("UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='treg'"+(credential.row?.encrypted_api_key?' AND encrypted_api_key=?':'')).bind(context.workspaceId,...(credential.row?.encrypted_api_key?[credential.row.encrypted_api_key]:[])).run();
 });
 const previous=async phase=>deps.receipt?null:env.DB.prepare('SELECT call_id,cost_micro,result_json,updated_at,created_at,poll_count FROM treg_contact_calls WHERE workspace_id=? AND request_key=? AND phase=?').bind(context.workspaceId,requestKey(phase),phase).first();
 let total=0,newCalls=0;const callIds=[];
 const call=async(phase,endpoint,body,{poll=false}={})=>{
  await guard({phase});const saved=await previous(phase);
  if(saved){const retained=JSON.parse(saved.result_json);if(retained._leadintel?.credentialHash!==credentialHash)throw fail('The saved lookup belongs to a previous Treg connection. Review its retained receipt.',409,'ADDITIONAL_CONTACT_PROVIDER_CHANGED');if(!poll&&retained._leadintel?.status==='settled'){total+=Number(saved.cost_micro)||0;if(saved.call_id)callIds.push(saved.call_id);return retained;}}
  const headers={'X-Treg-Token':credential.apiKey,'Content-Type':'application/json',Accept:'application/json','X-Treg-Meta':`customer=${tag(context.workspaceId)},workspace=${tag(context.workspaceId)},feature=buyer-email`,'X-Treg-Route-Max-Cost':poll?'0':phase==='phone'?'0.25':['find','profile'].includes(phase)?'0.05':'0.025','Idempotency-Key':`leadintel-${requestKey(phase)}-${phase}`};
  if(phase==='find'){headers['X-Treg-Route-Verify']='false';headers['X-Treg-Route-Exclude']='tomba';}
  if(phase==='verify')headers['X-Treg-Route-Prefer']='bounceban';
  let response;
  await guard({phase});
  await onDispatch({phase});await guard({phase});
  try{newCalls++;response=await (deps.fetch||fetch)(`https://treg.to/call/${endpoint}${poll?'?'+new URLSearchParams(body):''}`,{method:poll?'GET':'POST',headers,...(!poll?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(110000)});}
  catch{throw fail('Treg request is still pending or interrupted. Retry this saved lookup to recover it without buying it again.',503,'TREG_RETRY_SAME_LOOKUP');}
  const payload=await response.json().catch(()=>null),readable=payload&&typeof payload==='object'&&!Array.isArray(payload);
  const cost=response.headers.get('X-Treg-Cost-Micro'),original=response.headers.get('X-Treg-Original-Cost-Micro');
  // A replay has no new charge; retain the original settled charge for this operation.
  const costMicro=Math.max(0,Number(original??cost)||0),callId=response.headers.get('X-Treg-Call-Id');
  await receipt({phase,callId,costMicro,body:{...(response.ok&&readable?payload:{}),_leadintel:{credentialHash,status:response.ok&&readable?'settled':'uncertain',httpStatus:response.status}}});
  if(!response.ok)throw fail(response.status===402?'Treg credit balance or per-call limit needs attention.':response.status===401||response.status===403?'Treg rejected the saved team token.':response.status===429?'Treg usage limit reached. Try this saved lookup later.':'Treg could not complete this lookup. Retry the saved lookup.',response.status>=400&&response.status<500?response.status:503,'TREG_RETRY_SAME_LOOKUP');
  if(!readable)throw fail('Treg returned an unreadable result. Retry the saved lookup.',503,'TREG_RETRY_SAME_LOOKUP');
  total+=Math.max(costMicro,Number(saved?.cost_micro)||0);if(callId||saved?.call_id)callIds.push(callId||saved.call_id);await guard();return payload;
 };
 const result=(status,reason,extra={})=>({contact:null,reason,research:{provider:'treg',status,checkedAt:new Date().toISOString(),costMicro:total,callIds},request:{status:status==='processing'?'processing':status},...extra});
 const emailLookup=async()=>{
 const found=await call('find','treg.people.email.find',{full_name:name,first_name:parts[0],last_name:parts.slice(1).join(' '),domain,...(person.publicLinkedinUrl||person.linkedin_url?{linkedin_url:person.publicLinkedinUrl||person.linkedin_url}:{})});
 const output=object(found.output),raw=object(found.raw),record=object(raw.data||raw.person||raw),email=String(output.email||record.email||'').trim().toLowerCase();
 if(!email)return result('not_found','Treg returned no work email for this buyer.');
 const personal=/@(gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|live\.com|yahoo\.[a-z.]+|icloud\.com|proton\.me|protonmail\.com|aol\.com)$/i.test(email);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.split('@')[1]!==domain&&!personal||/^(info|sales|contact|support|office|admin|team|noreply|hr|press)@/.test(email))return result('unconfirmed','The result was not a personal work email on this company domain.');
 const returnedName=output.full_name||output.fullName||record.full_name||record.fullName||[output.first_name||record.first_name,output.last_name||record.last_name].filter(Boolean).join(' ');
 const expectedProfile=person.publicLinkedinUrl||person.linkedin_url;
 const records=[output,raw,object(raw.data),object(raw.person)],names=records.flatMap(row=>[row.full_name,row.fullName,row.name,row.first_name&&row.last_name?[row.first_name,row.last_name].join(' '):null]).filter(Boolean);
 if(records.some(row=>row.first_name&&nameKey(row.first_name)!==nameKey(parts[0])||row.last_name&&nameKey(row.last_name)!==nameKey(parts.slice(1).join(' '))))return result('unconfirmed','The provider returned conflicting buyer name components.');
 const emails=records.map(row=>row.email).filter(Boolean),profiles=records.flatMap(row=>[row.employee_linkedin,row.linkedin_url,row.linkedin]).filter(Boolean),domains=records.flatMap(row=>[row.company_domain,row.domain,row.organization?.primary_domain,row.company?.domain]).filter(Boolean);
 if(names.some(value=>nameKey(value)!==nameKey(name))||emails.some(value=>String(value).trim().toLowerCase()!==email)||profiles.some(value=>expectedProfile&&(!profile(value)||profile(value)!==profile(expectedProfile)))||domains.some(value=>String(value).replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'').toLowerCase()!==domain))return result('unconfirmed','The provider returned conflicting buyer or company evidence.');
 if(personal&&nameKey(returnedName)!==nameKey(name))return result('unconfirmed','Personal email requires exact returned person ownership.');
 if(returnedName&&nameKey(returnedName)!==nameKey(name))return result('unconfirmed','Treg returned a different buyer identity.');
 const returnedProfile=output.employee_linkedin||output.linkedin_url||output.linkedin||record.employee_linkedin||record.linkedin_url||record.linkedin;
 if(returnedProfile&&expectedProfile&&String(returnedProfile).replace(/^https?:\/\/(?:[a-z]+\.)?linkedin.com/,'linkedin.com').replace(/\/$/,'')!==String(expectedProfile).replace(/^https?:\/\/(?:[a-z]+\.)?linkedin.com/,'linkedin.com').replace(/\/$/,''))return result('unconfirmed','The returned professional profile belongs to a different identity.');
 if(!returnedName&&!(returnedProfile&&expectedProfile)&&identity(email.split('@')[0])!==identity(name))return result('unconfirmed','The provider did not establish ownership of this mailbox.');
 let checked=await call('verify','treg.people.email.verify',{email});
 let v=object(checked.output),r=object(checked.raw||checked),task=r.id||r.task_id;
 // BounceBan asynchronous results are polled through its free endpoint only.
 if(task&&checked._treg?.provider==='bounceban'&&!['valid','invalid','deliverable','undeliverable'].includes(String(v.status||r.result||'').toLowerCase())){
  const age=deps.receipt?null:await previous('poll'),verificationCall=await previous('verify');
  const timestamp=value=>Date.parse(/Z$/.test(value||'')?value:String(value||'').replace(' ','T')+'Z');
  if(age?.poll_count>=10||verificationCall&&Date.now()-timestamp(verificationCall.created_at)>300000)return result('unconfirmed','Verification did not finish within five minutes. Review the saved result before further research.');
  if(!age||Date.now()-timestamp(age.updated_at)>30000){checked=await call('poll','bounceban.people.email.verify.status',{id:String(task)},{poll:true});v=object(checked.output);r=object(checked.raw||checked);}
 }
 const verificationRows=[v,r,object(r.data),object(r.person)];
 if(verificationRows.map(row=>row.email).filter(Boolean).some(value=>String(value).trim().toLowerCase()!==email))return result('unconfirmed','Verification returned a different email address.');
 const verdict=String(v.status||v.result||r.result||r.status||'').trim().toLowerCase();
 const flags=verificationRows.flatMap(row=>[row.is_accept_all,row.accept_all]);
 const truth=value=>value===true||value===1||typeof value==='string'&&['true','1'].includes(value.trim().toLowerCase());
 const unsafe=flags.some(truth)||verificationRows.some(x=>truth(x.is_disposable)||!personal&&truth(x.is_free)||truth(x.is_role)||truth(x.block))||verificationRows.flatMap(row=>[row.status,row.result]).filter(Boolean).some(value=>['invalid','undeliverable','unknown','pending','processing','risky','accept_all'].includes(String(value).trim().toLowerCase()));
 if(!['valid','deliverable'].includes(verdict)||unsafe||!flags.some(x=>x===false||x==='false'))return result(task&&['pending','processing','unknown',''].includes(verdict)?'processing':'unconfirmed','Mailbox verification is pending or inconclusive. No recipient was approved.');
 await guard();const checkedAt=new Date().toISOString();
 const evidence={status:'valid',deliverability:'deliverable',checked_at:checkedAt,provider:'Treg',served_by:checked._treg?.provider||'bounceban'};
 const save=deps.save||(async()=>{
  const detail=await getCrmCompany(env.DB,context,companyId);
  if(['suppressed','archived'].includes(detail.company.lifecycle_status))throw fail('This company is blocked in CRM.');
  if(detail.contacts.some(c=>String(c.work_email||c.normalized_email||'').toLowerCase()===email&&nameKey(c.name)!==nameKey(name)))throw fail('This email belongs to another CRM identity. Review the conflict.');
  await guard();
  const contacts=await upsertCrmContacts(env.DB,context,companyId,[{external_person_id:person.id,name,title:person.title,work_email:email,email_status:'verified',source:'treg',linkedin_url:expectedProfile}]);
  const contact=contacts[0];if(!contact)throw fail('Verified Treg contact could not be saved.');
  await writeCrmRecord(env.DB,context,"UPDATE crm_contacts SET email_status='verified',email_type=?,match_confidence='verified',verification_provider='Treg',verified_at=?,updated_at=? WHERE id=? AND workspace_id=? AND company_id=?",[personal?'personal':'work',checkedAt,checkedAt,contact.id,context.workspaceId,companyId]);
  await appendCrmActivity(env.DB,context,{companyId,contactId:contact.id,type:'contact.enriched',summary:'Treg verified a named buyer’s work email',metadata:{provider:'Treg',call_ids:callIds,cost_micro:total}});
  return {...contact,email_status:'verified',verification_provider:'Treg',verified_at:checkedAt};
 });
 return {...result('verified','Work email verified.'),contact:{...await save(email,evidence),email_type:personal?'personal':'work',external_person_id:person.id},verification:evidence};
 }; // Email verification is independent of profile and phone availability.
 try{
 const emailResult=existingContact?{...result('verified','Saved company email reused.'),contact:existingContact,cached:true}:includeEmail?await emailLookup():result('not_requested','Paid email search is off.');
 if(!dataLookup)return emailResult;
 const checkedAt=new Date().toISOString(),expectedProfile=person.publicLinkedinUrl||person.linkedin_url;
 const linkedin=value=>{try{const u=new URL(value);return /(^|\.)linkedin\.com$/.test(u.hostname)&&u.pathname.startsWith('/in/')?'https://www.linkedin.com'+u.pathname.replace(/\/$/,''):'';}catch{return '';}};
 const domainOf=value=>{try{return new URL(/^https?:/.test(value)?value:'https://'+value).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
 const clean=value=>typeof value==='string'?value.trim().slice(0,200):'';
 const fields={full_name:name,first_name:parts[0],last_name:parts.slice(1).join(' '),domain,...(expectedProfile?{linkedin_url:expectedProfile}:{}),...(emailResult.contact?.work_email?{email:emailResult.contact.work_email}:{})};
 const retained=person.contactData;
 const validData=value=>buyerContactData(value,person,domain);
 const previousData=validData(retained);
 const data={version:1,personId:String(person.id),identityName:name,identityTitle:person.title||'',identityOrganization:person.organization||'',identityLinkedinUrl:expectedProfile||'',domain,checkedAt,status:'no_new_data',profile:!includeEmail&&previousData?.profile?{...previousData.profile}:{status:includeEmail?'not_found':'not_requested'},phone:!includePhone&&previousData?.phone?{...previousData.phone,checkedAt:previousData.phone.checkedAt||previousData.checkedAt,requested:false}:{status:includePhone?'not_found':'not_requested'},costMicro:0,callIds:[]};
 const attributed=payload=>{
  const row=object(payload.output),raw=object(payload.raw),r=object(raw.person||raw.data||raw);
  const records=[row,raw,object(raw.data),object(raw.person)],names=records.flatMap(record=>[record.full_name,record.fullName,record.name,record.first_name&&record.last_name?[record.first_name,record.last_name].join(' '):null]).filter(Boolean),profiles=records.flatMap(record=>[record.linkedin_url,record.linkedin]).filter(Boolean),domains=records.flatMap(record=>[record.company_domain,record.domain,record.organization?.primary_domain,record.company?.domain]).filter(Boolean);
  if(records.some(record=>record.first_name&&nameKey(record.first_name)!==nameKey(parts[0])||record.last_name&&nameKey(record.last_name)!==nameKey(parts.slice(1).join(' '))))return {conflict:true};
  if(names.some(value=>nameKey(value)!==nameKey(name))||profiles.some(value=>expectedProfile&&(!linkedin(value)||linkedin(value)!==linkedin(expectedProfile)))||domains.some(value=>domainOf(value)!==domain))return {conflict:true};
  const returnedName=row.full_name||r.full_name||r.name;
  const returnedLinkedin=row.linkedin_url||r.linkedin_url||r.linkedin;
  const returnedDomain=row.company_domain||row.domain||r.company_domain||r.organization?.primary_domain||r.company?.domain;
  if(returnedName&&nameKey(returnedName)!==nameKey(name)||returnedLinkedin&&expectedProfile&&linkedin(returnedLinkedin)!==linkedin(expectedProfile)||returnedDomain&&domainOf(returnedDomain)!==domain)return {conflict:true};
  return {row,r,matched:Boolean(returnedName&&nameKey(returnedName)===nameKey(name)||returnedLinkedin&&expectedProfile&&linkedin(returnedLinkedin)===linkedin(expectedProfile))};
 };
 if(includeEmail)try{
  const profile=await call('profile','treg.people.enrich',fields),match=attributed(profile);
  if(match.conflict)data.profile={status:'conflict'};
  else if(match.matched){
   const {row,r}=match;
   data.profile={status:'provider_reported',checkedAt,title:clean(row.title||row.job_title||r.title||r.job_title),company:clean(row.company_name||r.organization?.name||r.company?.name),linkedinUrl:linkedin(row.linkedin_url||r.linkedin_url),city:clean(row.city||r.city),country:clean(row.country||r.country),seniority:clean(row.seniority||r.seniority),source:clean(profile._treg?.served_by||profile._treg?.provider||'Treg')};
  }
 }catch(error){data.profile={status:'error',reason:clean(error.message)};}
 if(includePhone){
  try{
   const payload=await call('phone','treg.people.phone.find',fields),match=attributed(payload),number=clean(payload.output?.phone);
   if(match.conflict)data.phone={status:'conflict'};
   else if(number&&/^\+[1-9]\d{6,14}$/.test(number.replace(/[\s().-]/g,'')))data.phone={status:'provider_listed',checkedAt,number:number.replace(/[\s().-]/g,''),source:clean(payload._treg?.served_by||payload._treg?.provider||'Treg')};
  }catch(error){data.phone={status:'error',reason:clean(error.message)};}
 }
 data.status=[data.profile,data.phone].some(x=>['error','conflict'].includes(x.status))?'partial':data.profile.status==='provider_reported'||data.phone.number||!existingContact&&emailResult.contact?.work_email?'updated':'no_new_data';
 data.lastAttempt={status:data.status,checkedAt,phone:data.phone.status,phoneReason:data.phone.reason||'',profile:data.profile.status};
 if(includePhone&&!data.phone.number&&previousData?.phone?.number){data.phone={...previousData.phone,checkedAt:previousData.phone.checkedAt||previousData.checkedAt};}
 data.costMicro=total;data.callIds=[...new Set(callIds)];
 await guard();
 let contact=emailResult.contact;
 if(deps.saveData)await deps.saveData(data);
 else{
  const detail=await getCrmCompany(env.DB,context,companyId);
  if(['suppressed','archived'].includes(detail.company.lifecycle_status))throw fail('This company is blocked in CRM.');
  contact=contact||detail.contacts.find(c=>String(c.external_person_id)===String(person.id)&&nameKey(c.name)===nameKey(name))||null;
  Object.assign(data,await saveBuyerData(env,context,candidate,person,companyId,attemptKey,data,{guard,includeEmail,includePhone}));
  if(includePhone&&data.phone.status==='provider_listed'&&data.phone.number){
   if(!contact){const saved=await upsertCrmContacts(env.DB,context,companyId,[{external_person_id:person.id,name,title:person.title,linkedin_url:expectedProfile,source:'treg'}]);contact=saved[0];}
   // Read the selected channel inside the CRM write. A newer sibling snapshot
   // must not be replaced by this worker's earlier provider response.
   const selectedPhone="SELECT json_extract(e.value,'$.contactData.phone.number') FROM crm_intelligence i,json_each(i.research_snapshot_json,'$.buyerResearch.buyers') e WHERE i.company_id=? AND i.workspace_id=? AND CAST(json_extract(e.value,'$.id') AS TEXT)=? AND COALESCE(NULLIF(json_extract(e.value,'$.publicName'),''),json_extract(e.value,'$.name'))=? AND json_extract(e.value,'$.title')=? AND COALESCE(NULLIF(json_extract(e.value,'$.publicLinkedinUrl'),''),json_extract(e.value,'$.linkedin_url'),'')=? LIMIT 1";
   const selectedArgs=[companyId,context.workspaceId,String(person.id),person.publicName||person.name,person.title,expectedProfile||''];
   await guard();
   await writeCrmRecord(env.DB,context,"UPDATE crm_contacts SET phone_number=CASE WHEN LOWER(COALESCE(phone_status,''))='verified' THEN phone_number ELSE COALESCE(("+selectedPhone+"),phone_number) END,phone_status=CASE WHEN LOWER(COALESCE(phone_status,''))='verified' THEN phone_status WHEN ("+selectedPhone+") IS NOT NULL THEN 'provider_listed' ELSE phone_status END,updated_at=CASE WHEN updated_at>? THEN updated_at ELSE ? END WHERE id=? AND workspace_id=? AND company_id=?",[...selectedArgs,...selectedArgs,data.phone.checkedAt||checkedAt,data.phone.checkedAt||checkedAt,contact.id,context.workspaceId,companyId]);
  }
  // Reconcile again after any awaited CRM read: its row can predate a sibling's
  // completed channel even when all of its fields are nonempty.
  const fresh=(await getCrmCompany(env.DB,context,companyId)).contacts.find(row=>String(row.external_person_id)===String(person.id)&&nameKey(row.name)===nameKey(name));
  contact=fresh||contact;
  Object.assign(data,await saveBuyerData(env,context,candidate,person,companyId,attemptKey,data,{guard,includeEmail:false,includePhone:false}));
  if(contact?.id)contact=await env.DB.prepare('SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL').bind(contact.id,context.workspaceId,companyId).first();
  await appendCrmActivity(env.DB,context,{companyId,contactId:contact?.id,type:'contact.enriched',summary:'Manual contact data research completed',metadata:{provider:'Treg',contact_data:data}});
 }
 return {...emailResult,cached:newCalls===0,contact,contactData:data,research:{...emailResult.research,costMicro:data.costMicro,callIds:data.callIds}};
 }catch(error){
  // Commercial history remains durable regardless of permission. Its CRM
  // projection is allowed only while the original identity, session, provider
  // credential and paid-service authority still pass their existing guards.
  if(dataLookup&&!deps.saveData&&!deps.receipt)try{
   await guard();const current=await currentBuyerData(env,context,person,companyId,domain);
   if(current.data){
    const checkedAt=new Date().toISOString(),data={...current.data,checkedAt,status:'partial',lastAttempt:{...(current.data.lastAttempt||{}),checkedAt,status:'partial',...(includeEmail?{profile:'error'}:{}),...(includePhone?{phone:'error',phoneReason:String(error.message).slice(0,200)}:{})}};
    const retained=await saveBuyerData(env,context,candidate,person,companyId,attemptKey,data,{guard,includeEmail:false,includePhone:false});
    await appendCrmActivity(env.DB,context,{companyId,type:'contact.enriched',summary:'Contact research failed; previous evidence and billed phases retained',metadata:{provider:'Treg',contact_data:retained}});
   }
  }catch{/* Revocation or a changed identity leaves the phase ledger authoritative. */}
  throw error;
 }
}
