import {resolveWorkspaceServiceCredential} from './service-integrations.js';
import {upsertCrmContacts,appendCrmActivity,getCrmCompany} from './crm.js';
import {sha256} from './security.js';
const fail=(message,status=409,code='TREG_RESEARCH_HOLD')=>Object.assign(Error(message),{status,code});
const identity=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const tag=value=>String(value||'').replace(/[^a-zA-Z0-9._:-]/g,'_').slice(0,128);
const object=value=>value&&typeof value==='object'?value:{};

// One backend boundary owns attribution, request ceilings and idempotency.
export async function findTregWorkEmail(env,context,candidate,person,companyId,{attemptKey,guard=async()=>{}}={},deps={}){
 const credential=await (deps.credential||resolveWorkspaceServiceCredential)(env,context.workspaceId,'treg');
 if(credential.source!=='customer'||!credential.apiKey)throw fail('Connect your Treg team token in Settings.',409,'ADDITIONAL_CONTACT_PROVIDER_REQUIRED');
 const name=String(person.publicName||person.name||'').trim(),parts=name.split(/\s+/),domain=String(candidate.domain||'').toLowerCase();
 if(parts.length<2||!domain||!attemptKey)throw fail('A qualified named buyer, company domain and saved lookup are required.');
 const base=await sha256([context.workspaceId,companyId,person.id,attemptKey].join('|'));
 const receipt=deps.receipt||(async row=>{
  await env.DB.prepare(`INSERT INTO treg_contact_calls(workspace_id,request_key,phase,call_id,cost_micro,result_json) VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id,request_key,phase) DO UPDATE SET call_id=COALESCE(excluded.call_id,call_id),cost_micro=MAX(cost_micro,excluded.cost_micro),poll_count=poll_count+1,result_json=excluded.result_json,updated_at=CURRENT_TIMESTAMP`).bind(context.workspaceId,base,row.phase,row.callId,row.costMicro,JSON.stringify(row.body)).run();
  await env.DB.prepare("UPDATE workspace_service_integrations SET last_used_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND provider='treg'").bind(context.workspaceId).run();
 });
 const previous=async phase=>deps.receipt?null:env.DB.prepare('SELECT call_id,cost_micro,result_json,updated_at,created_at,poll_count FROM treg_contact_calls WHERE workspace_id=? AND request_key=? AND phase=?').bind(context.workspaceId,base,phase).first();
 let total=0;const callIds=[];
 const call=async(phase,endpoint,body,{poll=false}={})=>{
  await guard();const saved=await previous(phase);
  if(saved&&!poll){total+=Number(saved.cost_micro)||0;if(saved.call_id)callIds.push(saved.call_id);return JSON.parse(saved.result_json);}
  const headers={'X-Treg-Token':credential.apiKey,'Content-Type':'application/json',Accept:'application/json','X-Treg-Meta':`customer=${tag(context.workspaceId)},workspace=${tag(context.workspaceId)},feature=buyer-email`,'X-Treg-Route-Max-Cost':poll?'0':phase==='find'?'0.05':'0.025','Idempotency-Key':`leadintel-${base}-${phase}`};
  if(phase==='find'){headers['X-Treg-Route-Verify']='false';headers['X-Treg-Route-Exclude']='tomba';}
  if(phase==='verify')headers['X-Treg-Route-Prefer']='bounceban';
  let response;
  try{response=await (deps.fetch||fetch)(`https://treg.to/call/${endpoint}${poll?'?'+new URLSearchParams(body):''}`,{method:poll?'GET':'POST',headers,...(!poll?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(110000)});}
  catch{throw fail('Treg request is still pending or interrupted. Retry this saved lookup to recover it without buying it again.',503,'TREG_RETRY_SAME_LOOKUP');}
  if(!response.ok)throw fail(response.status===402?'Treg credit balance or per-call limit needs attention.':response.status===401||response.status===403?'Treg rejected the saved team token.':response.status===429?'Treg usage limit reached. Try this saved lookup later.':'Treg could not complete this lookup. Retry the saved lookup.',response.status>=400&&response.status<500?response.status:503,'TREG_RETRY_SAME_LOOKUP');
  const payload=await response.json().catch(()=>null);if(!payload||typeof payload!=='object')throw fail('Treg returned an unreadable result. Retry the saved lookup.',503,'TREG_RETRY_SAME_LOOKUP');
  const cost=response.headers.get('X-Treg-Cost-Micro'),original=response.headers.get('X-Treg-Original-Cost-Micro');
  // A replay has no new charge; retain the original settled charge for this operation.
  const costMicro=Math.max(0,Number(original??cost)||0),callId=response.headers.get('X-Treg-Call-Id');
  await receipt({phase,callId,costMicro,body:payload});total+=costMicro;if(callId)callIds.push(callId);await guard();return payload;
 };
 const result=(status,reason,extra={})=>({contact:null,reason,research:{provider:'treg',status,checkedAt:new Date().toISOString(),costMicro:total,callIds},request:{status:status==='processing'?'processing':status},...extra});
 const found=await call('find','treg.people.email.find',{full_name:name,first_name:parts[0],last_name:parts.slice(1).join(' '),domain,...(person.publicLinkedinUrl||person.linkedin_url?{linkedin_url:person.publicLinkedinUrl||person.linkedin_url}:{})});
 const output=object(found.output),raw=object(found.raw),record=object(raw.data||raw),email=String(output.email||record.email||'').trim().toLowerCase();
 if(!email)return result('not_found','Treg returned no work email for this buyer.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.split('@')[1]!==domain||/^(info|sales|contact|support|office|admin|team|noreply|hr|press)@/.test(email))return result('unconfirmed','The result was not a personal work email on this company domain.');
 const returnedName=output.full_name||output.fullName||record.full_name||record.fullName||[output.first_name||record.first_name,output.last_name||record.last_name].filter(Boolean).join(' ');
 if(returnedName&&identity(returnedName)!==identity(name))return result('unconfirmed','Treg returned a different buyer identity.');
 const returnedProfile=record.employee_linkedin||record.linkedin_url||record.linkedin;
 const expectedProfile=person.publicLinkedinUrl||person.linkedin_url;
 if(returnedProfile&&expectedProfile&&String(returnedProfile).replace(/^https?:\/\/(?:[a-z]+\.)?linkedin.com/,'linkedin.com').replace(/\/$/,'')!==String(expectedProfile).replace(/^https?:\/\/(?:[a-z]+\.)?linkedin.com/,'linkedin.com').replace(/\/$/,''))return result('unconfirmed','The returned professional profile belongs to a different identity.');
 if(!returnedName&&!returnedProfile&&identity(email.split('@')[0])!==identity(name))return result('unconfirmed','The provider did not establish ownership of this mailbox.');
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
 const unsafe=flags.some(x=>x===true||x==='true')||[v,r].some(x=>x.is_disposable===true||x.is_free===true||x.is_role===true||x.block===true);
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
  await env.DB.prepare("UPDATE crm_contacts SET email_status='verified',email_type='work',match_confidence='verified',verification_provider='Treg',verified_at=?,updated_at=? WHERE id=? AND workspace_id=? AND company_id=?").bind(checkedAt,checkedAt,contact.id,context.workspaceId,companyId).run();
  await appendCrmActivity(env.DB,context,{companyId,contactId:contact.id,type:'contact.enriched',summary:'Treg verified a named buyer’s work email',metadata:{provider:'Treg',call_ids:callIds,cost_micro:total}});
  return {...contact,email_status:'verified',verification_provider:'Treg',verified_at:checkedAt};
 });
 return {...result('verified','Work email verified.'),contact:await save(email,evidence),verification:evidence};
}
