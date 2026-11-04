import {readAdditionalContactPolicy,lookupAdditionalEmail} from './additional-contact-services.js';
import {findCrmCompanyByDomain,getCrmCompany,upsertCrmIntelligence} from './crm.js';
import {sha256} from './security.js';
import '../../customer/crm-engine.js';
import '../../customer/contact-confirmation-policy.js';
import '../../customer/additional-contact-policy.js';
const D=globalThis.LeadIntelDiscovery,P=globalThis.LeadIntelAdditionalContactPolicy,C=globalThis.LeadIntelContactPolicy;
const stamp=()=>new Date().toISOString(),same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
export const paidBuyerScope=candidate=>JSON.stringify([
 D.buyerReviewSignature(candidate),candidate.qualification,
 D.safeBuyerAiReview(candidate.publicResearch?.aiReview),candidate.publicResearch?.conflicts||[],
 D.safeBuyerAgent(candidate.publicResearch?.buyerAgent,candidate.domain),candidate.buyerDiscovery?.companyDossier||null,
 (candidate.people||[]).map(person=>{const q=D.qualifyBuyer(person,{decisionMakers:D.effectiveBuyerRoles(candidate)},candidate);return [String(person.id),person.country||'',person.opportunityScope||null,q.eligible,q.gaps];}).sort((a,b)=>a[0].localeCompare(b[0]))
]);
export function paidSnapshotCandidate(candidate,detail){const s=detail.intelligence?.research_snapshot||{},r=s.buyerResearch||{};return {...candidate,market:s.market,evidence:detail.intelligence?.evidence||[],qualification:s.qualification,buyerRoles:s.buyerRoles,buyerRolesChanged:s.buyerRolesChanged,fitDescription:s.fitDescription,buyerFit:s.buyerFit,buyerDiscovery:r.discovery,publicResearch:r.publicResearch,people:r.buyers||[]};}
export const paidContinuationScopeHash=row=>sha256(JSON.stringify([row?.research_snapshot_json||'{}',row?.evidence_json||'[]']));
export async function buyerPaidIntent(env,workspaceId,requested,candidate){
 if(!requested)return null;
 const policy=await readAdditionalContactPolicy(env,workspaceId),company=await findCrmCompanyByDomain(env.DB,workspaceId,candidate.domain);
 if(!policy.enabled&&!policy.phoneEnabled)return null;
 const row=company?await env.DB.prepare('SELECT research_snapshot_json FROM crm_intelligence WHERE workspace_id=? AND company_id=?').bind(workspaceId,company.id).first():null;
 return {provider:policy.provider,email:policy.enabled,phone:policy.provider==='treg'&&policy.phoneEnabled,policyUpdatedAt:policy.updatedAt,companyId:company?.id||'',snapshotHash:await sha256(row?.research_snapshot_json||'{}')};
}
export async function runBuyerPaidResearch(env,context,candidate,{intent,jobId,guard,signal,lookup=lookupAdditionalEmail}={}){
 const policy=await readAdditionalContactPolicy(env,context.workspaceId),previous=candidate.publicResearch?.paidResearch;
 const report={version:1,...previous,provider:policy.provider,startedAt:previous?.startedAt||stamp(),outcomes:[...(previous?.outcomes||[])],companyId:intent?.companyId||'',status:'running',reason:''};
 candidate.publicResearch={...(candidate.publicResearch||{}),paidResearch:report};
 const stop=(status,reason,code='')=>{Object.assign(report,{status,reason,code,completedAt:stamp()});return true;};
 if(!intent)return stop('disabled','This research request is free-only.');
 if(!intent.email&&!intent.phone)return stop('disabled','Paid email and phone research were off when this run started.');
 if(policy.provider!==intent.provider||policy.provider!=='treg')return stop('blocked','The saved automatic contact provider needs review.');
 const email=intent.email&&policy.enabled,phone=intent.phone&&policy.phoneEnabled;
 if(!email&&!phone)return stop('disabled','Paid email and phone research are off for this run.');
 await guard();
 const company=await findCrmCompanyByDomain(env.DB,context.workspaceId,candidate.domain);
 if(!company||company.id!==intent.companyId||!same(company.company_name,candidate.company)||company.lifecycle_status!=='prospect')return stop('blocked','Save and qualify this company before automatic contact research.');
 let detail=await getCrmCompany(env.DB,context,company.id);await guard();
 const row=await env.DB.prepare('SELECT research_snapshot_json,evidence_json FROM crm_intelligence WHERE company_id=? AND workspace_id=?').bind(company.id,context.workspaceId).first();
 const snapshot=detail.intelligence?.research_snapshot||{};
 const recoveredOwnScope=snapshot.buyerResearch?.jobId===jobId&&intent.continuationScopeHash&&await paidContinuationScopeHash(row)===intent.continuationScopeHash;
 if(snapshot.buyerResearch?.jobId!==jobId||recoveredOwnScope&&paidBuyerScope(paidSnapshotCandidate(candidate,detail))!==paidBuyerScope(candidate)){
  if(!recoveredOwnScope&&await sha256(row?.research_snapshot_json||'{}')!==intent.snapshotHash)return stop('blocked','Saved company research changed during this run. Review it before paid lookup.','PAID_SCOPE_CHANGED');
  const qualification=snapshot.qualification;
  if(!qualification)return stop('blocked','The saved company qualification is unavailable.');
  candidate.qualification=qualification;
  candidate.market=snapshot.market??candidate.market;
  const mapped=globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(candidate).intelligence.research_snapshot;
  const research={...mapped.buyerResearch,jobId};
  for(const p of research.buyers){const old=snapshot.buyerResearch?.buyers?.find(v=>same(v.id,p.id)&&same(v.publicName||v.name,p.publicName||p.name)&&same(v.title,p.title));const data=old&&D.safeContactData(old.contactData,p,candidate.domain);if(data)p.contactData=data;}
  const authority=guard.writeAuthority||(()=>({sql:'1',args:[]}));
  const scope={...context,guard,writeAuthority:()=>{const base=authority();return {sql:'('+base.sql+') AND EXISTS(SELECT 1 FROM crm_intelligence WHERE company_id=? AND workspace_id=? AND research_snapshot_json=? AND evidence_json=?)',args:[...base.args,company.id,context.workspaceId,row.research_snapshot_json,row.evidence_json]};}};
  await upsertCrmIntelligence(env.DB,scope,company.id,{...(detail.intelligence||{}),research_snapshot:{...snapshot,market:mapped.market,fitDescription:mapped.fitDescription,buyerRoles:mapped.buyerRoles,buyerRolesChanged:mapped.buyerRolesChanged,buyerFit:mapped.buyerFit,buyerResearch:research}});
  await guard();detail=await getCrmCompany(env.DB,context,company.id);
  if(detail.intelligence?.research_snapshot?.buyerResearch?.jobId!==jobId)return stop('blocked','Saved research changed before paid lookup; no provider was started.');
 }
 const active={...paidSnapshotCandidate(candidate,detail),peopleStatus:'complete',publicContactStatus:'complete'};
 if(paidBuyerScope(active)!==paidBuyerScope(candidate))return stop('blocked','Saved buyer qualification or evidence changed. Review the current CRM research.','PAID_SCOPE_CHANGED');
 const contactFor=p=>{
  const exact=(detail.contacts||[]).filter(c=>String(c.external_person_id)===String(p.id)&&same(c.name,p.publicName||p.name));
  if(exact.length)return exact.find(c=>C.accepted(c,active.domain,'provider_verified'))||exact[0];
  const title=v=>String(v||'').toLowerCase().replace(String(p.publicName||p.name).toLowerCase(),'').replace(/^[\s—–:|-]+/,'').trim();
  const canonical=(detail.contacts||[]).filter(c=>same(c.name,p.publicName||p.name)&&title(c.title)===title(p.title)&&C.accepted(c,active.domain,'provider_verified')&&(!c.linkedin_url||!p.publicLinkedinUrl||D.normalizeLinkedInUrl(c.linkedin_url)===D.normalizeLinkedInUrl(p.publicLinkedinUrl)));
  return canonical.length===1?canonical[0]:{};
 };
 const complete=p=>{const contact=contactFor(p);return (!email||D.acceptedOfficialBuyerEmail(active,p)||C.accepted(contact,active.domain,'provider_verified'))&&(!phone||D.confirmedBuyerPhone(active,p,contact,{workspaceId:context.workspaceId,companyId:company.id}));};
 const done=new Set(report.outcomes.filter(r=>r.status!=='processing').map(r=>r.personId));
 if(!report.outcomes.some(row=>row.status==='processing')&&report.outcomes.filter(r=>r.status==='checked').length>=1)return stop('complete','Automatic research has checked its one priority buyer. Other buyers can be checked manually.');
 const targets=P.targets(active,{provider:'treg',maxPerCompany:policy.maxPerCompany,confirmedEmail:p=>complete(p)?'complete':''}).filter(p=>!done.has(String(p.id)));
 const person=targets[0];
 if(!person){const primary=P.targets(active,{provider:'treg',confirmedEmail:()=>''})[0];if(primary&&(complete(primary)||done.has(String(primary.id))))return stop('complete','The priority buyer has been checked. Other buyers can be checked manually.');const unresolved=(active.people||[]).filter(p=>!complete(p)&&!done.has(String(p.id)));return stop(unresolved.length?'blocked':'complete',unresolved.length?'Remaining buyers need current qualification, free checks or AI review.':'Enabled paid channels have been checked.');}
 if(!report.outcomes.some(row=>row.personId===String(person.id)&&row.status==='processing')&&report.outcomes.filter(r=>r.status!=='blocked').length>=1)return stop('complete','Automatic research has checked its one priority buyer. Other buyers can be checked manually.');
 const contact=contactFor(person),includeEmail=Boolean(email&&!D.acceptedOfficialBuyerEmail(active,person)&&!C.accepted(contact,active.domain,'provider_verified')),includePhone=Boolean(phone&&!D.confirmedBuyerPhone(active,person,contact,{workspaceId:context.workspaceId,companyId:company.id}));
 const attempts=(Number(report.outcomes.find(row=>row.personId===String(person.id))?.attempts)||0)+1;
 if(attempts>12)return stop('blocked','The saved lookup is still pending after bounded recovery checks. Its receipt is retained for review.');
 const input={person_id:person.id,provider:'treg',automatic:true,automatic_email:email,automatic_phone:phone,data_lookup:includePhone,phone_approved:includePhone,email_lookup:includeEmail};
 if(includePhone&&!includeEmail&&contact.id&&C.accepted(contact,active.domain,'provider_verified'))input.contact_id=contact.id;
 let outcome;
 try{const result=await lookup(env,{...context,guard,writeAuthority:guard.writeAuthority},company.id,input,{guard,signal});await guard();outcome={personId:String(person.id),email:includeEmail,phone:includePhone,status:result.request?.status==='processing'?'processing':'checked',result:result.research?.status||result.request?.status||'checked',checkedAt:stamp(),costMicro:Number(result.research?.costMicro)||0};}
 catch(error){if(signal?.aborted||['CANCELED','CONTEXT_CHANGED','LEASE_EXPIRED','TIME_BUDGET'].includes(error.code))throw error;outcome={personId:String(person.id),email:includeEmail,phone:includePhone,status:['TREG_RETRY_SAME_LOOKUP','ADDITIONAL_CONTACT_RESERVATION_HOLD'].includes(error.code)?'processing':'blocked',code:error.code||'PAID_RESEARCH_FAILED',reason:String(error.message||'Paid research unavailable').slice(0,220),checkedAt:stamp()};}
 outcome.attempts=attempts;
 report.outcomes=report.outcomes.filter(r=>r.personId!==outcome.personId).concat(outcome).slice(0,10);
 const latest=await getCrmCompany(env.DB,context,company.id);await guard();
 if(paidBuyerScope(paidSnapshotCandidate(candidate,latest))!==paidBuyerScope(candidate))return stop('blocked','Saved buyer qualification or evidence changed after the lookup. Its receipt is retained.','PAID_SCOPE_CHANGED');
 if(outcome.status==='blocked')return stop('blocked',outcome.reason);
 if(outcome.status==='processing'){report.reason='The provider lookup is pending; its saved request will be reused.';return false;}
 return false;
}

// Approved workflows use the same targeting, consent and ledger path as saved
// buyer jobs. A pending lookup is left resumable rather than polled or repurchased.
export async function runWorkflowPaidResearch(env,context,candidate,{intent,runId,guard,lookup}={}){
 const policy=await readAdditionalContactPolicy(env,context.workspaceId);
 for(let slice=0;slice<=policy.maxPerCompany;slice++){
  await guard();
  const finished=await runBuyerPaidResearch(env,context,candidate,{intent,jobId:'workflow:'+runId,guard,lookup});
  if(finished||candidate.publicResearch.paidResearch.outcomes.some(row=>row.status==='processing'))break;
 }
 return candidate.publicResearch.paidResearch;
}
