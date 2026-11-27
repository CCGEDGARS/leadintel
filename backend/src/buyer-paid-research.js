import {readAdditionalContactPolicy,lookupAdditionalEmail} from './additional-contact-services.js';
import {findCrmCompanyByDomain,getCrmCompany,upsertCrmIntelligence} from './crm.js';
import {sha256} from './security.js';
import {buyerContactOptions} from './buyer-contact-context.js';
import {tregLookupAccounting} from './treg-contact-research.js';
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
export const PAID_PRIORITY_RESEARCH_REQUIRED='ADDITIONAL_CONTACT_PRIORITY_RESEARCH_REQUIRED';
export const PAID_PRIORITY_RESEARCH_INCOMPLETE='PAID_PRIORITY_RESEARCH_INCOMPLETE';
function priorityDepthGaps(candidate,context,detail,workEmailSearch){
 const contactOptions=buyerContactOptions(candidate,context,detail),people=D.mandatoryBuyerResearchPriorities(candidate.people||[],candidate,{forExecution:true,contactOptions});
 return people.length>0&&people.length===P.priorityCount(candidate,workEmailSearch)&&people.every(person=>D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.every(key=>D.buyerResearchCheckPassed(candidate,person,key)))?people.filter(person=>!D.acceptedOfficialBuyerEmail(candidate,person)&&!D.buyerResearchCheckPassed(candidate,person,'deep')):[];
}
export async function capturePaidContinuationScope(env,context,candidate,intent,jobId,guard){
 await guard();const row=await env.DB.prepare('SELECT research_snapshot_json,evidence_json FROM crm_intelligence WHERE workspace_id=? AND company_id=?').bind(context.workspaceId,intent.companyId).first();
 const snapshot=JSON.parse(row?.research_snapshot_json||'{}'),detail={intelligence:{research_snapshot:snapshot,evidence:JSON.parse(row?.evidence_json||'[]')}};
 if(snapshot.buyerResearch?.jobId!==jobId||paidBuyerScope(paidSnapshotCandidate(candidate,detail))!==paidBuyerScope(candidate))return null;
 await guard();return {row,hash:await paidContinuationScopeHash(row)};
}
export function workEmailSearchComplete(candidate,intent,contactOptions){
 if(candidate.publicResearch?.paidResearch?.status!=='complete')return false;
 const group=P.targetGroup(candidate,{automaticBuyerLimit:intent.automaticBuyerLimit});
 return group.length>0&&group.every(person=>contactOptions.confirmedEmail(person))
  &&D.buyerResearchCoveragePassed(candidate,{contactOptions,researchPeople:group,allowPartialRoster:true});
}
export async function buyerPaidIntent(env,workspaceId,requested,candidate){
 if(!requested)return null;
 const policy=await readAdditionalContactPolicy(env,workspaceId),company=await findCrmCompanyByDomain(env.DB,workspaceId,candidate.domain);
 if(policy.provider==='firecrawl'||!policy.enabled&&!policy.phoneEnabled)return null;
 const row=company?await env.DB.prepare('SELECT research_snapshot_json FROM crm_intelligence WHERE workspace_id=? AND company_id=?').bind(workspaceId,company.id).first():null;
 return {provider:policy.provider,email:policy.enabled,phone:policy.provider==='treg'&&policy.phoneEnabled,automaticBuyerLimit:policy.automaticBuyerLimit,policyUpdatedAt:policy.updatedAt,companyId:company?.id||'',snapshotHash:await sha256(row?.research_snapshot_json||'{}')};
}
export async function runBuyerPaidResearch(env,context,candidate,{intent,jobId,guard,signal,lookup=lookupAdditionalEmail,onContinuation}={}){
 const policy=await readAdditionalContactPolicy(env,context.workspaceId),previous=candidate.publicResearch?.paidResearch;
 const report={version:1,...previous,provider:policy.provider,startedAt:previous?.startedAt||stamp(),outcomes:[...(previous?.outcomes||[])],companyId:intent?.companyId||'',status:'running',reason:'',code:'',completedAt:''};
 candidate.publicResearch={...(candidate.publicResearch||{}),paidResearch:report};
 const stop=(status,reason,code='')=>{Object.assign(report,{status,reason,code,completedAt:stamp()});return true;};
 if(!intent)return stop('disabled','This research request is free-only.');
 if(!intent.email&&!intent.phone)return stop('disabled','Paid email and phone research were off when this run started.');
 if(policy.provider!==intent.provider||policy.provider!=='treg')return stop('blocked','The saved automatic contact provider needs review.');
 const limit=Math.min(policy.automaticBuyerLimit,P.automaticLimit(intent.automaticBuyerLimit));
 const email=intent.email&&policy.enabled,phone=intent.phone&&policy.phoneEnabled;
 const workEmailSearch=intent.workEmailSearch===true&&email&&!phone;
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
 const contactOptions=buyerContactOptions(active,context,detail);
 if(paidBuyerScope(active)!==paidBuyerScope(candidate))return stop('blocked','Saved buyer qualification or evidence changed. Review the current CRM research.','PAID_SCOPE_CHANGED');
 const contactFor=p=>{
  const exact=(detail.contacts||[]).filter(c=>String(c.external_person_id)===String(p.id)&&same(c.name,p.publicName||p.name));
  if(exact.length)return exact.find(c=>C.accepted(c,active.domain,'provider_verified'))||exact[0];
  const title=v=>String(v||'').toLowerCase().replace(String(p.publicName||p.name).toLowerCase(),'').replace(/^[\s—–:|-]+/,'').trim();
  const canonical=(detail.contacts||[]).filter(c=>same(c.name,p.publicName||p.name)&&title(c.title)===title(p.title)&&C.accepted(c,active.domain,'provider_verified')&&(!c.linkedin_url||!p.publicLinkedinUrl||D.normalizeLinkedInUrl(c.linkedin_url)===D.normalizeLinkedInUrl(p.publicLinkedinUrl)));
  return canonical.length===1?canonical[0]:{};
 };
 const complete=p=>{const contact=contactFor(p);return (!email||D.acceptedOfficialBuyerEmail(active,p)||C.accepted(contact,active.domain,'provider_verified'))&&(!phone||D.confirmedBuyerPhone(active,p,contact,{workspaceId:context.workspaceId,companyId:company.id}));};
 const deferPublic=async(outcome,currentDetail=detail)=>{
  const scope=await capturePaidContinuationScope(env,context,candidate,intent,jobId,guard);
  if(!scope)return stop('blocked','Saved company research changed before free continuation. Its paid receipt is retained.','PAID_SCOPE_CHANGED');
  intent.continuationScopeHash=scope.hash;await onContinuation?.(scope);
  // Capture the unchanged own CRM scope first, then invalidate only the
  // summaries whose newly required deeper work has not actually run.
  const gaps=priorityDepthGaps(candidate,context,currentDetail,workEmailSearch);
  for(const person of gaps){person.emailResearch={...person.emailResearch,status:'partial'};if(person.contactResearch)person.contactResearch.channels={...person.contactResearch.channels,company:{...person.contactResearch.channels?.company,status:'partial'}};}
  const accountability=candidate.publicResearch.accountability;
  if(accountability){accountability.status='partial';accountability.stopReason='checks_incomplete';accountability.checkedPeople=Math.min(Number(accountability.checkedPeople)||0,(candidate.people||[]).filter(p=>p.emailResearch?.status==='complete').length);accountability.gaps=[...new Set([...(accountability.gaps||[]),'A newly displayed buyer requires deeper public checks before the saved paid attempt continues.'])].slice(0,20);}
  Object.assign(outcome,{status:'processing',code:PAID_PRIORITY_RESEARCH_REQUIRED,reason:'The newly displayed buyer needs its bounded deeper public checks before paid research continues.'});
  report.outcomes=report.outcomes.filter(row=>row.personId!==outcome.personId).concat(outcome).slice(0,10);
  Object.assign(report,{code:PAID_PRIORITY_RESEARCH_REQUIRED,publicResearchAttempts:0,reason:outcome.reason});return false;
 };
 // A provider email can establish a new displayed buyer without supplying
 // the published evidence needed to waive its deeper public research.
 const depthGaps=priorityDepthGaps(active,context,detail,workEmailSearch),gapIds=new Set(depthGaps.map(p=>String(p.id)));
 if(depthGaps.length){
  if(previous?.code===PAID_PRIORITY_RESEARCH_REQUIRED)return stop('blocked','The bounded free continuation is incomplete. Resume missing public checks before paid research.',PAID_PRIORITY_RESEARCH_INCOMPLETE);
  let pending=report.outcomes.find(row=>gapIds.has(row.personId)&&['checked','processing'].includes(row.status));
  // A lease/slice can end after the verified email SQL commit but before its
  // outcome checkpoint. Recover only this job's still-matching paid identity
  // from the durable automatic reservation and its settled phase ledger.
  if(!pending&&snapshot.buyerResearch?.jobId===jobId){
   for(const person of P.targetGroup(active,{automaticBuyerLimit:limit})){
    if(!gapIds.has(String(person.id)))continue;
    if(!C.accepted(contactFor(person),active.domain,'provider_verified'))continue;
    const month=stamp().slice(0,7),attempt=await env.DB.prepare("SELECT result_json FROM additional_contact_attempts WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider='treg'").bind(context.workspaceId,company.id,String(person.id),month).first(),saved=JSON.parse(attempt?.result_json||'{}');
    const identity=await sha256(JSON.stringify([active.company,active.domain,String(person.id),person.publicName||person.name,person.title,person.organization,D.normalizeLinkedInUrl(person.publicLinkedinUrl||person.linkedin_url)]));
    if(saved.automatic!==true||saved.provider_started!==true||saved.lookup_identity!==identity)continue;
    const key=await sha256([context.workspaceId,company.id,person.id,month].join('|')),settled=await env.DB.prepare("SELECT COUNT(*) n FROM treg_contact_calls WHERE workspace_id=? AND request_key=? AND phase IN ('find','verify') AND json_extract(result_json,'$._leadintel.status')='settled'").bind(context.workspaceId,key).first();
    if(Number(settled?.n)!==2)continue;
    const accounting=await tregLookupAccounting(env,context,active,person,company.id,month,saved.research||{});
    pending={personId:String(person.id),email,phone,status:'processing',attempts:1,checkedAt:stamp(),costMicro:accounting.costMicro};break;
   }
  }
  if(pending)return deferPublic(pending);
 }
 for(const outcome of report.outcomes)if(outcome.status==='processing'&&outcome.code===PAID_PRIORITY_RESEARCH_REQUIRED){
  const person=active.people.find(p=>String(p.id)===outcome.personId);
  if(person&&complete(person))Object.assign(outcome,{status:'checked',code:'',reason:'Enabled paid channels were already saved before free continuation.'});
 }
 const done=new Set(report.outcomes.filter(r=>r.status!=='processing').map(r=>r.personId));
 if(!report.outcomes.some(row=>row.status==='processing')&&report.outcomes.filter(r=>r.status==='checked').length>=limit)return stop('complete','Automatic research has checked the selected priority buyers. Other buyers can be checked manually.');
 const targets=P.targets(active,{workEmailSearch,provider:'treg',automaticBuyerLimit:limit,contactOptions,confirmedEmail:p=>complete(p)?'complete':''}).filter(p=>!done.has(String(p.id)));
 const person=targets[0];
 if(!person){const selected=P.targets(active,{workEmailSearch,provider:'treg',automaticBuyerLimit:limit,contactOptions,confirmedEmail:()=>''});if(selected.length&&selected.every(p=>complete(p)||done.has(String(p.id))))return stop('complete','The selected priority buyers have been checked. Other buyers can be checked manually.');const unresolved=(active.people||[]).filter(p=>!complete(p)&&!done.has(String(p.id)));return stop(unresolved.length?'blocked':'complete',unresolved.length?'Remaining buyers need current qualification, free checks or AI review.':'Enabled paid channels have been checked.');}
 if(!report.outcomes.some(row=>row.personId===String(person.id)&&row.status==='processing')&&report.outcomes.filter(r=>r.status!=='blocked').length>=limit)return stop('complete','Automatic research has checked the selected priority buyers. Other buyers can be checked manually.');
 const contact=contactFor(person),includeEmail=Boolean(email&&!D.acceptedOfficialBuyerEmail(active,person)&&!C.accepted(contact,active.domain,'provider_verified')),includePhone=Boolean(phone&&!D.confirmedBuyerPhone(active,person,contact,{workspaceId:context.workspaceId,companyId:company.id}));
 const attempts=(Number(report.outcomes.find(row=>row.personId===String(person.id))?.attempts)||0)+1;
 if(attempts>12)return stop('blocked','The saved lookup is still pending after bounded recovery checks. Its receipt is retained for review.');
 const input={person_id:person.id,provider:'treg',automatic:true,automatic_buyer_limit:limit,automatic_email:email,automatic_phone:phone,data_lookup:includePhone,phone_approved:includePhone,email_lookup:includeEmail};
 if(includePhone&&!includeEmail&&contact.id&&C.accepted(contact,active.domain,'provider_verified'))input.contact_id=contact.id;
 let outcome;
 try{const result=await lookup(env,{...context,guard,writeAuthority:guard.writeAuthority},company.id,input,{guard,signal,workEmailSearch});await guard();outcome={personId:String(person.id),email:includeEmail,phone:includePhone,status:result.request?.status==='processing'?'processing':'checked',result:result.research?.status||result.request?.status||'checked',reason:String(result.reason||'').slice(0,220),checkedAt:stamp(),costMicro:Number(result.research?.costMicro)||0};}
 catch(error){if(signal?.aborted||['CANCELED','CONTEXT_CHANGED','LEASE_EXPIRED','TIME_BUDGET'].includes(error.code))throw error;outcome={personId:String(person.id),email:includeEmail,phone:includePhone,status:['TREG_RETRY_SAME_LOOKUP','ADDITIONAL_CONTACT_RESERVATION_HOLD',PAID_PRIORITY_RESEARCH_REQUIRED].includes(error.code)?'processing':'blocked',code:error.code||'PAID_RESEARCH_FAILED',reason:String(error.message||'Paid research unavailable').slice(0,220),checkedAt:stamp()};
  if(error.code===PAID_PRIORITY_RESEARCH_REQUIRED){const attempt=await env.DB.prepare("SELECT result_json FROM additional_contact_attempts WHERE workspace_id=? AND company_id=? AND person_id=? AND month=? AND provider='treg'").bind(context.workspaceId,company.id,String(person.id),stamp().slice(0,7)).first();const saved=JSON.parse(attempt?.result_json||'{}');outcome.costMicro=Math.max(Number(saved.research?.costMicro)||0,Number(report.outcomes.find(row=>row.personId===String(person.id))?.costMicro)||0);}
 }
 outcome.attempts=attempts;
 const earlier=report.outcomes.find(row=>row.personId===outcome.personId);
 if(earlier?.code===PAID_PRIORITY_RESEARCH_REQUIRED){outcome.email=outcome.email||earlier.email;outcome.phone=outcome.phone||earlier.phone;outcome.costMicro=Math.max(Number(outcome.costMicro)||0,Number(earlier.costMicro)||0);}
 report.outcomes=report.outcomes.filter(r=>r.personId!==outcome.personId).concat(outcome).slice(0,10);
 const latest=await getCrmCompany(env.DB,context,company.id);await guard();
 if(paidBuyerScope(paidSnapshotCandidate(candidate,latest))!==paidBuyerScope(candidate))return stop('blocked','Saved buyer qualification or evidence changed after the lookup. Its receipt is retained.','PAID_SCOPE_CHANGED');
 if(priorityDepthGaps(candidate,context,latest,workEmailSearch).length&&(outcome.status!=='blocked'||outcome.code===PAID_PRIORITY_RESEARCH_REQUIRED))return deferPublic(outcome,latest);
 if(outcome.status==='blocked')return stop('blocked',outcome.reason);
 if(outcome.status==='processing'){report.reason='The provider lookup is pending; its saved request will be reused.';return false;}
 return false;
}

// Approved workflows use the same targeting, consent and ledger path as saved
// buyer jobs. A pending lookup is left resumable rather than polled or repurchased.
export async function runWorkflowPaidResearch(env,context,candidate,{intent,runId,guard,lookup,resumePublic}={}){
 const policy=await readAdditionalContactPolicy(env,context.workspaceId);
 if(candidate.publicResearch?.paidResearch?.code===PAID_PRIORITY_RESEARCH_REQUIRED&&resumePublic&&!await resumePublic())return candidate.publicResearch.paidResearch;
 for(let slice=0;slice<=Math.min(policy.automaticBuyerLimit,P.automaticLimit(intent?.automaticBuyerLimit));slice++){
  await guard();
  const finished=await runBuyerPaidResearch(env,context,candidate,{intent,jobId:'workflow:'+runId,guard,lookup});
  if(finished||candidate.publicResearch.paidResearch.outcomes.some(row=>row.status==='processing'))break;
 }
 return candidate.publicResearch.paidResearch;
}
