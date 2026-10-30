import {resolveWorkspaceServiceCredential} from './service-integrations.js';
import {upsertCrmContacts,appendCrmActivity,getCrmCompany} from './crm.js';
import {sha256} from './security.js';
const fail=(message,status=409,code='TREG_RESEARCH_HOLD')=>Object.assign(Error(message),{status,code});
const identity=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const tag=value=>String(value||'').replace(/[^a-zA-Z0-9._:-]/g,'_').slice(0,128);
const object=value=>value&&typeof value==='object'?value:{};

// One backend boundary owns attribution, request ceilings and idempotency.
export async function findTregWorkEmail(env,context,candidate,person,companyId,{attemptKey,guard=async()=>{},dataLookup=false,includePhone=false,includeEmail=true,existingContact=null}={},deps={}){
 const credential=await (deps.credential||resolveWorkspaceServiceCredential)(env,context.workspaceId,'treg');
 if(credential.source!=='customer'||!credential.apiKey)throw fail('Connect your Treg team token in Settings.',409,'ADDITIONAL_CONTACT_PROVIDER_REQUIRED');
 const name=String(person.publicName||person.name||'').trim(),parts=name.split(/\s+/),domain=String(candidate.domain||'').toLowerCase();
 if(parts.length<2||!domain||!attemptKey)throw fail('A qualified named buyer, company domain and saved lookup are required.');
 const base=await sha256([context.workspaceId,companyId,person.id,attemptKey].join('|'));
 const dataBase=await sha256([context.workspaceId,companyId,person.id,attemptKey,identity(name),domain,person.publicLinkedinUrl||person.linkedin_url||''].join('|'));
 const requestKey=phase=>['profile','phone'].includes(phase)?dataBase:base;
 const receipt=deps.receipt||(async row=>{
  await env.DB.prepare(`INSERT INTO treg_contact_calls(workspace_id,request_key,phase,call_id,cost_micro,result_json) VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id,request_key,phase) DO UPDATE SET call_id=COALESCE(excluded.call_id,call_id),cost_micro=MAX(cost_micro,excluded.cost_micro),poll_count=poll_count+1,result_json=excluded.result_json,updated_at=CURRENT_TIMESTAMP`).bind(context.workspaceId,requestKey(row.phase),row.phase,row.callId,row.costMicro,JSON.stringify(row.body)).run();
  await env.DB.prepare("UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='treg'").bind(context.workspaceId).run();
 });
 const previous=async phase=>deps.receipt?null:env.DB.prepare('SELECT call_id,cost_micro,result_json,updated_at,created_at,poll_count FROM treg_contact_calls WHERE workspace_id=? AND request_key=? AND phase=?').bind(context.workspaceId,requestKey(phase),phase).first();
 let total=0,newCalls=0;const callIds=[];
 const call=async(phase,endpoint,body,{poll=false}={})=>{
  await guard({phase});const saved=await previous(phase);
  if(saved&&!poll){total+=Number(saved.cost_micro)||0;if(saved.call_id)callIds.push(saved.call_id);return JSON.parse(saved.result_json);}
  const headers={'X-Treg-Token':credential.apiKey,'Content-Type':'application/json',Accept:'application/json','X-Treg-Meta':`customer=${tag(context.workspaceId)},workspace=${tag(context.workspaceId)},feature=buyer-email`,'X-Treg-Route-Max-Cost':poll?'0':phase==='phone'?'0.25':['find','profile'].includes(phase)?'0.05':'0.025','Idempotency-Key':`leadintel-${requestKey(phase)}-${phase}`};
  if(phase==='find'){headers['X-Treg-Route-Verify']='false';headers['X-Treg-Route-Exclude']='tomba';}
  if(phase==='verify')headers['X-Treg-Route-Prefer']='bounceban';
  let response;
  try{newCalls++;response=await (deps.fetch||fetch)(`https://treg.to/call/${endpoint}${poll?'?'+new URLSearchParams(body):''}`,{method:poll?'GET':'POST',headers,...(!poll?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(110000)});}
  catch{throw fail('Treg request is still pending or interrupted. Retry this saved lookup to recover it without buying it again.',503,'TREG_RETRY_SAME_LOOKUP');}
  if(!response.ok)throw fail(response.status===402?'Treg credit balance or per-call limit needs attention.':response.status===401||response.status===403?'Treg rejected the saved team token.':response.status===429?'Treg usage limit reached. Try this saved lookup later.':'Treg could not complete this lookup. Retry the saved lookup.',response.status>=400&&response.status<500?response.status:503,'TREG_RETRY_SAME_LOOKUP');
  const payload=await response.json().catch(()=>null);if(!payload||typeof payload!=='object')throw fail('Treg returned an unreadable result. Retry the saved lookup.',503,'TREG_RETRY_SAME_LOOKUP');
  const cost=response.headers.get('X-Treg-Cost-Micro'),original=response.headers.get('X-Treg-Original-Cost-Micro');
  // A replay has no new charge; retain the original settled charge for this operation.
  const costMicro=Math.max(0,Number(original??cost)||0),callId=response.headers.get('X-Treg-Call-Id');
  await receipt({phase,callId,costMicro,body:payload});total+=costMicro;if(callId)callIds.push(callId);await guard();return payload;
 };
 const result=(status,reason,extra={})=>({contact:null,reason,research:{provider:'treg',status,checkedAt:new Date().toISOString(),costMicro:total,callIds},request:{status:status==='processing'?'processing':status},...extra});
 const emailLookup=async()=>{
 const found=await call('find','treg.people.email.find',{full_name:name,first_name:parts[0],last_name:parts.slice(1).join(' '),domain,...(person.publicLinkedinUrl||person.linkedin_url?{linkedin_url:person.publicLinkedinUrl||person.linkedin_url}:{})});
 const output=object(found.output),raw=object(found.raw),record=object(raw.data||raw),email=String(output.email||record.email||'').trim().toLowerCase();
 if(!email)return result('not_found','Treg returned no work email for this buyer.');
 const personal=/@(gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|live\.com|yahoo\.[a-z.]+|icloud\.com|proton\.me|protonmail\.com|aol\.com)$/i.test(email);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.split('@')[1]!==domain&&!personal||/^(info|sales|contact|support|office|admin|team|noreply|hr|press)@/.test(email))return result('unconfirmed','The result was not a personal work email on this company domain.');
 const returnedName=output.full_name||output.fullName||record.full_name||record.fullName||[output.first_name||record.first_name,output.last_name||record.last_name].filter(Boolean).join(' ');
 if(personal&&identity(returnedName)!==identity(name))return result('unconfirmed','Personal email requires exact returned person ownership.');
 if(returnedName&&identity(returnedName)!==identity(name))return result('unconfirmed','Treg returned a different buyer identity.');
 const returnedProfile=output.employee_linkedin||output.linkedin_url||output.linkedin||record.employee_linkedin||record.linkedin_url||record.linkedin;
 const expectedProfile=person.publicLinkedinUrl||person.linkedin_url;
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
 const returnedEmail=String(v.email||r.email||'').toLowerCase();
 if(returnedEmail&&returnedEmail!==email)return result('unconfirmed','Verification returned a different email address.');
 const verdict=String(v.status||v.result||r.result||r.status||'').toLowerCase();
 const flags=[v.is_accept_all,v.accept_all,r.is_accept_all,r.accept_all];
 const unsafe=flags.some(x=>x===true||x==='true')||[v,r].some(x=>x.is_disposable===true||!personal&&x.is_free===true||x.is_role===true||x.block===true);
 if(!['valid','deliverable'].includes(verdict)||unsafe||!flags.some(x=>x===false||x==='false'))return result(task&&['pending','processing','unknown',''].includes(verdict)?'processing':'unconfirmed','Mailbox verification is pending or inconclusive. No recipient was approved.');
 await guard();const checkedAt=new Date().toISOString();
 const evidence={status:'valid',deliverability:'deliverable',checked_at:checkedAt,provider:'Treg',served_by:checked._treg?.provider||'bounceban'};
 const save=deps.save||(async()=>{
  const detail=await getCrmCompany(env.DB,context,companyId);
  if(['suppressed','archived'].includes(detail.company.lifecycle_status))throw fail('This company is blocked in CRM.');
  if(detail.contacts.some(c=>String(c.work_email||c.normalized_email||'').toLowerCase()===email&&identity(c.name)!==identity(name)))throw fail('This email belongs to another CRM identity. Review the conflict.');
  await guard();
  const contacts=await upsertCrmContacts(env.DB,context,companyId,[{external_person_id:person.id,name,title:person.title,work_email:email,email_status:'verified',source:'treg',linkedin_url:expectedProfile}]);
  const contact=contacts[0];if(!contact)throw fail('Verified Treg contact could not be saved.');
  await env.DB.prepare("UPDATE crm_contacts SET email_status='verified',email_type=?,match_confidence='verified',verification_provider='Treg',verified_at=?,updated_at=? WHERE id=? AND workspace_id=? AND company_id=?").bind(personal?'personal':'work',checkedAt,checkedAt,contact.id,context.workspaceId,companyId).run();
  await appendCrmActivity(env.DB,context,{companyId,contactId:contact.id,type:'contact.enriched',summary:'Treg verified a named buyer’s work email',metadata:{provider:'Treg',call_ids:callIds,cost_micro:total}});
  return {...contact,email_status:'verified',verification_provider:'Treg',verified_at:checkedAt};
 });
 return {...result('verified','Work email verified.'),contact:{...await save(email,evidence),email_type:personal?'personal':'work',external_person_id:person.id},verification:evidence};
 }; // Email verification is independent of profile and phone availability.
 const emailResult=existingContact?{...result('verified','Saved company email reused.'),contact:existingContact,cached:true}:includeEmail?await emailLookup():result('not_requested','Paid email search is off.');
 if(!dataLookup)return emailResult;
 const checkedAt=new Date().toISOString(),expectedProfile=person.publicLinkedinUrl||person.linkedin_url;
 const linkedin=value=>{try{const u=new URL(value);return /(^|\.)linkedin\.com$/.test(u.hostname)&&u.pathname.startsWith('/in/')?'https://www.linkedin.com'+u.pathname.replace(/\/$/,''):'';}catch{return '';}};
 const domainOf=value=>{try{return new URL(/^https?:/.test(value)?value:'https://'+value).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
 const clean=value=>typeof value==='string'?value.trim().slice(0,200):'';
 const fields={full_name:name,first_name:parts[0],last_name:parts.slice(1).join(' '),domain,...(expectedProfile?{linkedin_url:expectedProfile}:{}),...(emailResult.contact?.work_email?{email:emailResult.contact.work_email}:{})};
 const retained=person.contactData;
 const previousData=retained?.version===1&&retained.domain===domain&&String(retained.personId)===String(person.id)&&(!retained.identityName||String(retained.identityName).trim().toLowerCase()===name.toLowerCase())&&(!retained.identityLinkedinUrl||!expectedProfile||linkedin(retained.identityLinkedinUrl)===linkedin(expectedProfile))?retained:null;
 const data={version:1,personId:String(person.id),identityName:name,identityLinkedinUrl:expectedProfile||'',domain,checkedAt,status:'no_new_data',profile:!includeEmail&&previousData?.profile?{...previousData.profile}:{status:includeEmail?'not_found':'not_requested'},phone:!includePhone&&previousData?.phone?{...previousData.phone,checkedAt:previousData.phone.checkedAt||previousData.checkedAt,requested:false}:{status:includePhone?'not_found':'not_requested'},costMicro:0,callIds:[]};
 const attributed=payload=>{
  const row=object(payload.output),raw=object(payload.raw),r=object(raw.person||raw.data||raw);
  const returnedName=row.full_name||r.full_name||r.name;
  const returnedLinkedin=row.linkedin_url||r.linkedin_url||r.linkedin;
  const returnedDomain=row.company_domain||row.domain||r.company_domain||r.organization?.primary_domain||r.company?.domain;
  if(returnedName&&identity(returnedName)!==identity(name)||returnedLinkedin&&expectedProfile&&linkedin(returnedLinkedin)!==linkedin(expectedProfile)||returnedDomain&&domainOf(returnedDomain)!==domain)return {conflict:true};
  return {row,r,matched:Boolean(returnedName&&identity(returnedName)===identity(name)||returnedLinkedin&&expectedProfile&&linkedin(returnedLinkedin)===linkedin(expectedProfile))};
 };
 if(includeEmail)try{
  const profile=await call('profile','treg.people.enrich',fields),match=attributed(profile);
  if(match.conflict)data.profile={status:'conflict'};
  else if(match.matched){
   const {row,r}=match;
   data.profile={status:'provider_reported',title:clean(row.title||row.job_title||r.title||r.job_title),company:clean(row.company_name||r.organization?.name||r.company?.name),linkedinUrl:linkedin(row.linkedin_url||r.linkedin_url),city:clean(row.city||r.city),country:clean(row.country||r.country),seniority:clean(row.seniority||r.seniority),source:clean(profile._treg?.served_by||profile._treg?.provider||'Treg')};
  }
 }catch(error){data.profile={status:'error',reason:clean(error.message)};}
 if(includePhone){
  try{
   const payload=await call('phone','treg.people.phone.find',fields),match=attributed(payload),number=clean(payload.output?.phone);
   if(match.conflict)data.phone={status:'conflict'};
   else if(number&&/^\+[1-9]\d{6,14}$/.test(number.replace(/[\s().-]/g,'')))data.phone={status:'provider_listed',number:number.replace(/[\s().-]/g,''),source:clean(payload._treg?.served_by||payload._treg?.provider||'Treg')};
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
  contact=contact||detail.contacts.find(c=>String(c.external_person_id)===String(person.id)&&identity(c.name)===identity(name))||null;
  if(includePhone&&data.phone.status==='provider_listed'&&data.phone.number){
   contact=contact||detail.contacts.find(c=>String(c.external_person_id)===String(person.id)&&identity(c.name)===identity(name))||null;
   if(!contact){const saved=await upsertCrmContacts(env.DB,context,companyId,[{external_person_id:person.id,name,title:person.title,linkedin_url:expectedProfile,source:'treg'}]);contact=saved[0];}
   await guard();
   await env.DB.prepare("UPDATE crm_contacts SET phone_number=CASE WHEN LOWER(COALESCE(phone_status,''))='verified' THEN phone_number ELSE ? END,phone_status=CASE WHEN LOWER(COALESCE(phone_status,''))='verified' THEN phone_status ELSE 'provider_listed' END,updated_at=? WHERE id=? AND workspace_id=? AND company_id=?").bind(data.phone.number,checkedAt,contact.id,context.workspaceId,companyId).run();
   contact=await env.DB.prepare('SELECT * FROM crm_contacts WHERE id=? AND workspace_id=? AND company_id=? AND archived_at IS NULL').bind(contact.id,context.workspaceId,companyId).first();
  }
  // Only the selected buyer is patched. Other research, contacts and activities remain intact.
  const selected="SELECT e.key FROM json_each(research_snapshot_json,'$.buyerResearch.buyers') e WHERE CAST(json_extract(e.value,'$.id') AS TEXT)=? AND COALESCE(NULLIF(json_extract(e.value,'$.publicName'),''),json_extract(e.value,'$.name'))=? AND json_extract(e.value,'$.title')=? AND COALESCE(NULLIF(json_extract(e.value,'$.publicLinkedinUrl'),''),json_extract(e.value,'$.linkedin_url'),'')=? LIMIT 1";
  const selectedArgs=[String(person.id),person.publicName||person.name,person.title,expectedProfile||''];
  await guard();
  const written=await env.DB.prepare("UPDATE crm_intelligence SET research_snapshot_json=json_set(research_snapshot_json,'$.buyerResearch.buyers['||("+selected+")||'].contactData',json(?)),intelligence_updated_at=? WHERE company_id=? AND workspace_id=? AND ("+selected+") IS NOT NULL").bind(...selectedArgs,JSON.stringify(data),checkedAt,companyId,context.workspaceId,...selectedArgs).run();
  if(!(written?.meta?.changes??written?.changes))throw fail('The selected buyer changed. Reload the saved research.');
  await appendCrmActivity(env.DB,context,{companyId,contactId:contact?.id,type:'contact.enriched',summary:'Manual contact data research completed',metadata:{provider:'Treg',contact_data:data}});
 }
 return {...emailResult,cached:newCalls===0,contact,contactData:data,research:{...emailResult.research,costMicro:total,callIds:data.callIds}};
}
