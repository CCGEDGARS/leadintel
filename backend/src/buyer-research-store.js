import {readBuyerCheckpoint,compactBuyerCheckpoint,buyerRecordLimit,buyerRecordLimitMessage} from './buyer-checkpoint.js';
import {recoverOfficialBuyers} from './fast-research-evidence.js';
import {applySavedEmails} from './firecrawl-buyer-email.js';
import {allowFullResearch,meteredBuyerResearchAllowed} from './research-strategy.js';
import '../../customer/strategy-integrity.js';
import {buyerRunWindow} from './buyer-research-window.js';
import {buyerCreditWindowKey,buyerCreditLimitFor,readBuyerCredits} from './buyer-research-credits.js';
import {prepareBuyerRecheck} from './buyer-recheck-plan.js';
import {sha256} from './security.js';
import {loadBuyerContactContext} from './buyer-contact-context.js';
import {buyerPaidIntent,paidBuyerScope,paidSnapshotCandidate,paidContinuationScopeHash} from './buyer-paid-research.js';
import {readOwnedPayload} from './workspace-record-store.js';
import '../../customer/discovery-engine.js';
import '../../customer/targeting-policy.js';
const D=globalThis.LeadIntelDiscovery;
export const activeBuyerJob=status=>['queued','running'].includes(status);
export const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export const parse=(text,fallback={})=>{try{return JSON.parse(text);}catch{return fallback;}};
function currentWindowPause(row,input,diagnostics){
 const last=diagnostics.at(-1);
 if(row.status!=='needs_review'||row.last_error)return null;
 // Jobs resumed by older versions can still have the previous window's pause at the end of their history.
 const started=Date.parse(input.executionWindowStartedAt);
 if(last?.code==='run_window')return Date.parse(last.at)<started?null:last;
 // A pause at the credit limit holds until the job is resumed, also when another note was written after it.
 for(let index=diagnostics.length-1;index>=0;index--){
  const entry=diagnostics[index];
  if(entry?.code==='resumed'||Date.parse(entry?.at)<started)return null;
  if(entry?.code==='credit_limit')return entry;
 }
 return null;
}
const allowed="('owner','researcher','sales')";
export const authoritySql=`EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=buyer_research_jobs.session_hash AND s.user_id=buyer_research_jobs.requested_by AND s.expires_at>datetime('now') AND m.workspace_id=buyer_research_jobs.workspace_id AND m.role IN ${allowed}) AND (json_extract(buyer_research_jobs.input_json,'$.taskId') IS NULL OR EXISTS(SELECT 1 FROM copilot_research_tasks t WHERE t.id=json_extract(buyer_research_jobs.input_json,'$.taskId') AND t.workspace_id=buyer_research_jobs.workspace_id AND t.status='running' AND (json_extract(t.input_json,'$.plan.paidMode')<>'saved_policy' OR EXISTS(SELECT 1 FROM additional_contact_policies p WHERE p.workspace_id=t.workspace_id AND p.provider=json_extract(t.input_json,'$.paidPolicy.provider') AND p.enabled=json_extract(t.input_json,'$.paidPolicy.enabled') AND p.phone_enabled=json_extract(t.input_json,'$.paidPolicy.phoneEnabled') AND p.daily_limit=json_extract(t.input_json,'$.paidPolicy.dailyLimit') AND p.monthly_limit=json_extract(t.input_json,'$.paidPolicy.monthlyLimit') AND p.automatic_buyer_limit=json_extract(t.input_json,'$.paidPolicy.automaticBuyerLimit') AND p.max_per_company=json_extract(t.input_json,'$.paidPolicy.maxPerCompany')))))`;
const callerSql=`EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.user_id=? AND s.expires_at>datetime('now') AND m.workspace_id=? AND m.role IN ${allowed})`;
const callerArgs=(workspaceId,user)=>[user.sessionTokenHash,user.id,workspaceId];
export const lost=()=>Object.assign(Error('Buyer research authorization or job context changed'),{code:'CANCELED',status:409});
export function activeBuyerProfile(payload={}){
 const main=payload.main||{},referenceDomains=(main.referenceCustomers?.rows||[]).map(r=>D.canonicalDomain(r.website||r.domain));
 const base={...(main.profile||{}),...globalThis.LeadIntelTargeting?.profileFields?.(main),website:main.website||main.profile?.website,referenceDomains,exclusions:[main.profile?.exclusions,main.answers?.exclusions,...referenceDomains].filter(Boolean).join('; '),targetMarkets:(main.targetMarkets||[]).join(', ')||main.profile?.targetMarkets};
 return D.effectiveTargetingProfile(base,globalThis.LeadIntelStrategyIntegrity.executionMarketForState(main));
}
export async function workspaceBuyerContext(env,workspaceId,taskId){
 const row=await stmt(env,'SELECT version,payload_json FROM customer_workspace_state WHERE workspace_id=?',workspaceId).first();
 let {payload}=await readOwnedPayload(env,workspaceId,row);
 if(taskId){const task=await stmt(env,'SELECT input_json FROM copilot_research_tasks WHERE id=? AND workspace_id=?',taskId,workspaceId).first();if(!task)throw lost();payload={main:parse(task.input_json).main};}
 const main=payload.main||{};
 return {payload,version:Number(row?.version)||0,hash:await sha256(JSON.stringify([main.website||'',main.targetMarkets||[],D.buyerFitContext(activeBuyerProfile(payload))]))};
}
export function normalizeBuyerInput(body,stored={}){
 const raw=body?.candidate||{},original=String(raw.domain||raw.website||'').trim();
 let inputUrl;try{inputUrl=new URL(/^https?:\/\//i.test(original)?original:'https://'+original);}catch{throw Object.assign(Error('A valid public company domain is required'),{status:400});}
 if(inputUrl.username||inputUrl.password||!['http:','https:'].includes(inputUrl.protocol))throw Object.assign(Error('A public company domain without credentials is required'),{status:400});
 const domain=D.canonicalDomain(original);
 if(!domain||!domain.includes('.')||/^\d+(?:\.\d+){3}$/.test(domain)||/[\s:@[\]]/.test(domain)||/^(localhost|.*\.local)$/.test(domain)||!String(raw.company||'').trim())throw Object.assign(Error('A named company with a public domain is required'),{status:400});
 const saved=[...(stored.discovery?.selectedProspects||[]),...(stored.discovery?.candidates||[]),...(stored.discovery?.pipeline||[])].find(c=>D.canonicalDomain(c.domain)===domain);
 const selected=(body.personIds||[]).map(String).slice(0,10),roles=D.buyerResearchRoles(raw,body.profile||{},activeBuyerProfile(stored));
 const normalized=D.normalizeDiscoveryState({selectedProspects:[{...(body.websiteScanId?{}:saved),...raw,domain,buyerSearchMode:'user_selected_target',buyerRoles:roles.join('; ')}]}).selectedProspects[0];
 if(!normalized)throw Object.assign(Error('Company research input is invalid'),{status:400});
 // Client snapshots are input claims, never server execution receipts. Source pages
 // are read by the job before any new contact evidence can be accepted.
 normalized.people=(normalized.people||[]).filter(p=>!selected.length||selected.includes(String(p.id))).slice(0,10).map(p=>{
  const copy={...p};for(const key of ['contactResearch','emailResearch','publicEmailEvidence','publicPhoneEvidence','publicEmailSourceCheck','publicPhoneSourceCheck','patternFindings','gmailMatches','contactVerification','waterfallEmail'])delete copy[key];return copy;
 });
 normalized.publicResearch={};normalized.publicContacts=[];
 normalized.buyerDiscovery={opportunityRoles:roles,companyContacts:[]};
 const activeProfile=activeBuyerProfile(stored),hasActive=Boolean(stored.main?.profile&&Object.keys(stored.main.profile).length);
 if(hasActive&&body.profile&&D.buyerFitContext(body.profile)!==D.buyerFitContext(activeProfile))throw Object.assign(Error('The seller profile changed. Save or reload its current context before starting research.'),{status:409});
 const fit=parse(D.buyerFitContext(hasActive?activeProfile:body.profile||{})),profile={priorityOffers:fit.offers,idealCustomer:fit.buyers,targetMarkets:fit.markets,exclusions:fit.exclusions,website:fit.website,decisionMakers:roles.join('; ')};
 const personIds=normalized.people.map(p=>String(p.id));
 return {candidate:normalized,profile,roles,personIds,scope:selected.length?'selected_buyers':'all_buyers'};
}
export async function buyerInputKey(input){return sha256(JSON.stringify([...(input.websiteScanId?[input.websiteScanId]:[]),...(input.taskId?[input.taskId]:[]),...(input.freeDiscovery?['free-discovery']:[]),input.paidResearch,input.candidate.domain,input.candidate.company,input.profile,input.roles.slice().sort(),input.personIds.slice().sort(),input.candidate.people.map(p=>[p.id,p.publicName||p.name,p.title,p.organization]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]));}
export async function readBuyerJob(env,workspaceId,{id,domain,websiteScanId,legacyScan}={}){
 if(!id&&websiteScanId)return stmt(env,"SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND json_extract(input_json,'$.websiteScanId')=?",workspaceId,D.canonicalDomain(domain),websiteScanId).first();
 if(!id&&legacyScan)return stmt(env,"SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND json_extract(input_json,'$.websiteScanId') IS NULL ORDER BY rowid DESC LIMIT 1",workspaceId,D.canonicalDomain(domain)).first();
 return id?stmt(env,'SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND id=?',workspaceId,id).first():stmt(env,'SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND domain=? ORDER BY rowid DESC LIMIT 1',workspaceId,D.canonicalDomain(domain)).first();
}
export async function recoverInterruptedContactJob(env,{jobId}={}){
 // One-time repair of the old cumulative-timeout behavior. GET remains read-only;
 // only the scheduler may resume the latest still-authorized saved request.
 const rows=await stmt(env,`SELECT * FROM buyer_research_jobs WHERE status IN ('needs_review','complete') AND phase='done' AND COALESCE(json_extract(diagnostic_json,'$[#-1].code'),'') NOT IN ('run_window','credit_limit') AND COALESCE(json_extract(input_json,'$.recheck.version'),0)=0 AND updated_at>datetime('now','-30 days') AND ((COALESCE(json_extract(input_json,'$.contactSourceScope'),'')<>? AND json_extract(result_json,'$.buyerDiscovery.officialContactInventory.research.status') IN ('partial','error') AND COALESCE(json_extract(result_json,'$.buyerDiscovery.officialContactInventory.research.discoveryScope'),'')<>?) OR (json_extract(result_json,'$.publicResearch.accountability.stopReason')='time_budget' AND COALESCE(json_extract(input_json,'$.contactContinuationVersion'),0)<1) OR (COALESCE(json_extract(input_json,'$.contactSchedulingVersion'),0)<1 AND COALESCE(json_extract(input_json,'$.contactSchedulingRecoveryVersion'),0)<1 AND json_extract(result_json,'$.publicResearch.accountability.status')='partial' AND json_extract(result_json,'$.publicResearch.accountability.stopReason')='time_budget') OR (COALESCE(json_extract(input_json,'$.executionContinuationVersion'),0)<4 AND (json_extract(result_json,'$.publicResearch.buyerAgent.status')='needs_review' OR json_extract(result_json,'$.publicResearch.aiReview.status')='complete' OR EXISTS(SELECT 1 FROM buyer_research_tasks t WHERE t.job_id=buyer_research_jobs.id AND t.status='running')))) AND NOT EXISTS(SELECT 1 FROM buyer_research_jobs newer WHERE newer.workspace_id=buyer_research_jobs.workspace_id AND newer.domain=buyer_research_jobs.domain AND newer.rowid>buyer_research_jobs.rowid) AND ${authoritySql} ${jobId?'AND id=?':''} ORDER BY updated_at LIMIT 3`,D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion,D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion,...(jobId?[jobId]:[])).all();
 for(const row of rows.results||[]){
  const input=parse(row.input_json),context=await workspaceBuyerContext(env,row.workspace_id,input.taskId),matches=input.workspaceContext===context.hash,diagnostics=parse(row.diagnostic_json,[]),executionRepair=Number(input.contactContinuationVersion||0)>=1;
  const candidate=readBuyerCheckpoint(row.result_json,input.candidate),{contactOptions}=await loadBuyerContactContext(env,{workspaceId:row.workspace_id},candidate),phase=resumePhase(candidate,input,contactOptions);
  let paidScope=null,continuationScopeHash='';
  if(matches&&input.paidResearch?.companyId){
   const value=await stmt(env,'SELECT research_snapshot_json,evidence_json FROM crm_intelligence WHERE workspace_id=? AND company_id=?',row.workspace_id,input.paidResearch.companyId).first(),snapshot=parse(value?.research_snapshot_json),candidate=readBuyerCheckpoint(row.result_json,input.candidate);
   const detail={intelligence:{research_snapshot:snapshot,evidence:parse(value?.evidence_json,[])}};
   if(snapshot.buyerResearch?.jobId===row.id&&paidBuyerScope(paidSnapshotCandidate(candidate,detail))===paidBuyerScope(candidate)){paidScope=value;continuationScopeHash=await paidContinuationScopeHash(value);}
  }
  diagnostics.push({phase,reason:matches?'Resuming interrupted research; completed tasks and confirmed contacts retained':'Saved seller context changed; start research with the current context',at:new Date().toISOString(),code:executionRepair?'execution_continuation_v1':'contact_continuation_v1'});
  const update=stmt(env,`UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.contactContinuationVersion',1,'$.executionContinuationVersion',4,'$.contactSchedulingRecoveryVersion',1,'$.contactSourceScope',?${paidScope?",'$.paidResearch.continuationScopeHash',?":''}),status=?,phase=?,phase_ms=0,phase_runs=0,diagnostic_json=?,lease_token=NULL,lease_until=0,next_at=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND status IN ('needs_review','complete') AND NOT EXISTS(SELECT 1 FROM buyer_research_jobs newer WHERE newer.workspace_id=buyer_research_jobs.workspace_id AND newer.domain=buyer_research_jobs.domain AND newer.rowid>buyer_research_jobs.rowid) AND ${authoritySql} AND COALESCE((SELECT version FROM customer_workspace_state WHERE workspace_id=buyer_research_jobs.workspace_id),0)=? ${paidScope?'AND EXISTS(SELECT 1 FROM crm_intelligence WHERE workspace_id=? AND company_id=? AND research_snapshot_json=? AND evidence_json=?)':''}`,D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion,...(paidScope?[continuationScopeHash]:[]),matches?'queued':'needs_review',matches?phase:row.phase,JSON.stringify(diagnostics.slice(-20)),row.id,row.revision,context.version,...(paidScope?[row.workspace_id,input.paidResearch.companyId,paidScope.research_snapshot_json,paidScope.evidence_json]:[]));
  // Requeue and retry reset are atomic: no worker may claim the repaired job
  // before the interrupted-task attempts have been restored.
  const reset=matches?stmt(env,`UPDATE buyer_research_tasks SET attempts=0,status='failed' WHERE job_id=? AND kind IN ('search','read','independent') AND status='failed' AND error LIKE '%time budget reached%' AND EXISTS(SELECT 1 FROM buyer_research_jobs WHERE id=? AND status='queued' AND revision=? AND json_extract(input_json,'$.contactContinuationVersion')=1 AND ${authoritySql} AND COALESCE((SELECT version FROM customer_workspace_state WHERE workspace_id=buyer_research_jobs.workspace_id),0)=?)`,row.id,row.id,row.revision+1,context.version):null;
  const [updated]=await env.DB.batch([update,...(reset?[reset]:[])]);
  if(updated.meta.changes&&matches){
   // Provider failures keep their attempt limits. Only interrupted public tasks
   // regain their bounded retry; completed source bodies and receipts survive.
   return row.id;
  }
 }
 return null;
}
function resumePhase(saved,input={},contactOptions={}){const candidate=D.reconcileBuyerEvidence(saved,{trustedAgentSources:true}),review=D.safeBuyerAiReview(candidate.publicResearch?.aiReview),coverage=D.buyerResearchCoveragePassed(candidate,{contactOptions});return input.recheck?(!coverage?'contacts':review?.status!=='complete'||review.inputSignature!==D.buyerReviewSignature(candidate)?'review':'done'):!D.officialContactCoveragePassed(candidate)?'official':input.peopleFirst&&!input.fullResearch&&!candidate.people?.length?'identities':input.peopleFirst&&!input.fullResearch&&!coverage?'contacts':candidate.buyerDiscovery?.companyDossier?.status!=='complete'?'dossier':!candidate.people?.length?'identities':!coverage?'contacts':review?.status!=='complete'||review.inputSignature!==D.buyerReviewSignature(candidate)?'review':input.paidResearch&&!['complete','disabled'].includes(candidate.publicResearch?.paidResearch?.status)?'paid':'done';}
async function retainedJobCandidate(env,row,input,current){
 // Only server-owned results in this workspace and seller context can restore
 // source facts. Current roster, rejections and execution receipts remain authoritative.
 const history=await stmt(env,"SELECT input_json,result_json FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND rowid<(SELECT rowid FROM buyer_research_jobs WHERE id=?) AND updated_at>datetime('now','-30 days') ORDER BY rowid DESC LIMIT 3",row.workspace_id,row.domain,row.id).all();
 let candidate=current;
 for(const old of history.results||[]){const prior=parse(old.input_json);if(!input.workspaceContext||prior.workspaceContext!==input.workspaceContext)continue;
  candidate=D.mergeRetainedBuyerResearch(readBuyerCheckpoint(old.result_json,{}),candidate);
 }
 return candidate;
}
export async function savedBuyerRoster(env,row){
 if(!row)return [];
 const input=parse(row.input_json);if(!input.workspaceContext)return [];
 // A one-person job is not the company's roster. Restore the latest retained
 // full roster only within the same workspace, company, seller context and roles.
 const history=await stmt(env,`SELECT result_json FROM buyer_research_jobs
 WHERE workspace_id=? AND domain=? AND updated_at>datetime('now','-30 days')
 AND json_extract(input_json,'$.workspaceContext')=?
 AND COALESCE(json_extract(input_json,'$.scope'),'all_buyers')!='selected_buyers'
 AND COALESCE(json_extract(input_json,'$.roles'),'[]')=?
 AND json_array_length(result_json,'$.people')>0 ORDER BY rowid DESC LIMIT 12`,row.workspace_id,row.domain,input.workspaceContext,JSON.stringify(input.roles||[])).all();
 let pool=[];
 for(const old of (history.results||[]).slice().reverse()){
  const candidate=D.reconcileBuyerEvidence(readBuyerCheckpoint(old.result_json,{}),{trustedAgentSources:true});
  if(D.canonicalDomain(candidate.domain)!==row.domain)continue;
  pool=D.mergeBuyerPool(pool,candidate.people||[],input.profile);
 }
 const latest=readBuyerCheckpoint(row.result_json,{});
 return D.retainBuyerIdentities(pool,input.profile||{},latest).slice(0,10);
}
export async function savedBuyerResearchReceipts(env,row){
 if(!row)return [];
 const input=parse(row.input_json);if(!input.workspaceContext)return [];
 // Read the latest receipt per research identity, rather than the last few
 // jobs: repeated one-person rechecks must not hide another person's results.
 const history=await stmt(env,`SELECT person_json,compact_job,revision FROM (
 SELECT j.revision,p.value person_json,CASE WHEN json_extract(j.result_json,'$.format')='buyer-checkpoint-v1' THEN j.id END compact_job,ROW_NUMBER() OVER (
 PARTITION BY json_extract(p.value,'$.contactResearch.identityKey') ORDER BY j.rowid DESC) rank
 FROM buyer_research_jobs j,json_each(j.result_json,'$.people') p
 WHERE j.workspace_id=? AND j.domain=? AND j.updated_at>datetime('now','-30 days')
 AND json_extract(j.input_json,'$.workspaceContext')=?
 AND json_extract(p.value,'$.contactResearch.policyVersion')=?
 AND json_extract(p.value,'$.contactResearch.identityKey') IS NOT NULL
 ) WHERE rank=1 LIMIT 40`,row.workspace_id,row.domain,input.workspaceContext,D.BUYER_CONTACT_RESEARCH_POLICY.version).all();
 const receipts=history.results||[],compactJobs=new Set(receipts.map(row=>row.compact_job).filter(Boolean));
 for(const id of compactJobs){
  const saved=await stmt(env,'SELECT result_json,revision FROM buyer_research_jobs WHERE workspace_id=? AND id=?',row.workspace_id,id).first();
  const roster=saved?readBuyerCheckpoint(saved.result_json).people:[];
  for(const entry of receipts.filter(item=>item.compact_job===id)){
   const expected=parse(entry.person_json);
   entry.person=saved?.revision===entry.revision&&roster.find(person=>person.id===expected.id&&person.contactResearch?.identityKey===expected.contactResearch?.identityKey);
  }
 }
 return receipts.map(r=>{
  const p=r.compact_job?r.person:parse(r.person_json),safe=p&&D.mergeBuyerPool([],[p])[0];if(!safe)return null;
  return Object.fromEntries(['id','name','publicName','title','organization','publicLinkedinUrl','linkedin_url','contactResearch','emailResearch','gmailMatches','gmailCandidates'].filter(k=>safe[k]!==undefined).map(k=>[k,safe[k]]));
 }).filter(Boolean);
}
export async function publicBuyerJob(env,row,{recoverRetained=false}={}){
 if(!row)return null;const input=parse(row.input_json);let candidate=readBuyerCheckpoint(row.result_json,input.candidate||{});
 if(recoverRetained&&!input.websiteScanId)candidate=await retainedJobCandidate(env,row,input,candidate);
 await recoverOfficialBuyers(env,row,input,candidate);
 candidate=D.reconcileBuyerEvidence(candidate,{trustedAgentSources:true});
 // A person saved before f5036bf8 with the description of a publication as the job title is not handed out.
 if(Array.isArray(candidate.people))candidate.people=candidate.people.filter(person=>!D.publicationRole(person?.title));
 const totals=await stmt(env,"SELECT status,count(*) n,MAX(updated_at) last_activity_at FROM buyer_research_tasks WHERE job_id=? GROUP BY status",row.id).all();
 const activeTask=input.recheck&&row.status==='running'?await stmt(env,"SELECT kind,request_value FROM buyer_research_tasks WHERE job_id=? AND status='running' ORDER BY updated_at DESC LIMIT 1",row.id).first():null;
 const activity=activeTask?.kind==='read'?'Reading public contact evidence':activeTask?.kind==='independent'?'Cross-checking contact evidence':activeTask?.kind==='search'?(/gmail|googlemail/i.test(activeTask.request_value)?'Searching public Gmail business-contact listings':/linkedin/i.test(activeTask.request_value)?'Checking LinkedIn identity':'Searching public contact sources'):'';

 const {detail,contactOptions}=await loadBuyerContactContext(env,{workspaceId:row.workspace_id},candidate);
 await applySavedEmails(env,row.workspace_id,detail?.company?.id,candidate);
 const crm=detail?{company:detail.company,contacts:detail.contacts,contactData:detail.contactData,phoneRequests:detail.phoneRequests}:null;
 const quality=D.buyerQualityAssessment(candidate,{contactOptions});
 const completed=(totals.results||[]).find(r=>r.status==='complete')?.n||0,total=(totals.results||[]).reduce((n,r)=>n+Number(r.n),0);
 const iso=value=>{const date=new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(String(value))?value.replace(' ','T')+'Z':value);return Number.isFinite(date.getTime())?date.toISOString():'';};
 const updatedAt=iso(row.updated_at),createdAt=iso(row.created_at),lastActivityAt=[updatedAt,...(totals.results||[]).map(r=>iso(r.last_activity_at))].filter(Boolean).sort().at(-1)||updatedAt;
 // Forecasts describe finished research passes, not guaranteed contact yield.
 // Keep the sample private to this workspace and the same scope/paid mode.
 const history=await stmt(env,`SELECT (unixepoch(updated_at)-unixepoch(created_at)) seconds FROM buyer_research_jobs
 WHERE workspace_id=? AND id<>? AND phase='done' AND status IN ('complete','needs_review')
 AND COALESCE(json_extract(input_json,'$.scope'),'all_buyers')=?
 AND COALESCE(json_extract(input_json,'$.recheck.version'),0)=?
 AND (COALESCE(json_extract(input_json,'$.paidResearch'),0)<>0)=?
 AND created_at>=datetime('now','-30 days')
 AND unixepoch(updated_at)-unixepoch(created_at) BETWEEN 1 AND 1800
 ORDER BY updated_at DESC LIMIT 20`,row.workspace_id,row.id,input.scope||'all_buyers',Number(input.recheck?.version)||0,input.paidResearch?1:0).all();
 const durations=(history.results||[]).map(item=>Number(item.seconds)).filter(Number.isFinite).sort((a,b)=>a-b);
 const estimate=durations.length>=5?{lowerSeconds:durations[Math.floor((durations.length-1)*.5)],upperSeconds:durations[Math.ceil((durations.length-1)*.9)],samples:durations.length}:null;
 const lastResultAt=(totals.results||[]).filter(item=>item.status==='complete').map(item=>iso(item.last_activity_at)).filter(Boolean).sort().at(-1)||null;
 const runWindow=buyerRunWindow(row,input);
 // What this job has spent at Firecrawl: in the current run window and in all, beside what a run of this size is
 // expected to stay under. The size is the people this run researches (the selected ones, or the whole roster),
 // and "above expected" is only said once they are known, from the contacts phase on. A count that cannot be read
 // is absent, never zero. Shown only: nothing is stopped by it.
 let credits=null;
 try{
  const count=await readBuyerCredits(env,row.id,buyerCreditWindowKey(row,input)),researched=input.scope==='selected_buyers'?(input.personIds||[]).length:(candidate.people||[]).length,expected=buyerCreditLimitFor(env,row.workspace_id,researched);
  credits={used:count.window.used,reported:count.window.reported,unreported:count.window.unreported,requests:count.window.requests,unreportedRequests:count.window.unreportedRequests,expected,aboveExpected:['contacts','review','paid','done'].includes(row.phase)&&count.window.counted>expected,total:count.total.used,totalUnreported:count.total.unreported,totalUnreportedRequests:count.total.unreportedRequests};
 }catch{}
 const timing={estimate,lastResultAt,runWindow,nextAttemptAt:row.status==='queued'&&Number(row.next_at)>0?new Date(Number(row.next_at)).toISOString():null};
 // The input roster may already contain names before the worker reaches discovery.
 const pastIdentityStage=input.peopleFirst&&row.phase==='dossier'||['contacts','review','paid','done'].includes(row.phase);
 const identities=pastIdentityStage&&(candidate.people||[]).some(person=>D.sourcedBuyerIdentity(person,candidate));
 const stages={official:D.officialContactCoveragePassed(candidate),dossier:candidate.buyerDiscovery?.companyDossier?.status==='complete'&&!candidate.buyerDiscovery?.companyDossier?.lastAttempt,identities,contacts:D.buyerResearchCoveragePassed(candidate,{contactOptions}),review:quality.aiReviewStatus==='complete'&&(!input.paidResearch||['complete','disabled'].includes(candidate.publicResearch?.paidResearch?.status))};
 const diagnostics=parse(row.diagnostic_json,[]),paused=currentWindowPause(row,input,diagnostics);
 const finishedFree=input.freeDiscovery&&!input.fullResearch&&row.status==='needs_review'&&diagnostics.at(-1)?.code==='free_discovery_finished';
 const freeOnly=finishedFree&&!await meteredBuyerResearchAllowed(env,row.workspace_id);
 const labels={official:'Reading official company sources',dossier:'Researching the company',identities:'Finding decision-makers',contacts:'Checking contact evidence',review:'Reviewing buyer evidence',paid:'Researching approved paid channels',done:'Research saved'};
 return {id:row.id,domain:row.domain,retainedEvidenceRecovered:recoverRetained,contextKey:row.context_key,crm,input:{...(input.websiteScanId?{websiteScanId:input.websiteScanId}:{}),...(freeOnly?{freeOnly:true}:{}),freeDiscovery:Boolean(input.freeDiscovery&&!input.fullResearch),publicContactChecks:input.publicContactChecks===true,fullResearch:Boolean(input.fullResearch||input.meteredPublicResearchApproved),peopleFirst:Boolean(input.peopleFirst),paidResearch:Boolean(input.paidResearch),company:input.candidate?.company,domain:row.domain,profile:input.profile,roles:input.roles,personIds:input.scope==='selected_buyers'?input.personIds:[],scope:input.scope},status:row.status,phase:row.phase,resumePhase:resumePhase(candidate,input,contactOptions),revision:row.revision,createdAt,updatedAt,candidate,quality,diagnostics:[...diagnostics,...(row.last_error?[{phase:row.phase,...(buyerRecordLimit(row.last_error)?{code:'workspace_records_full',reason:buyerRecordLimitMessage}:{reason:row.last_error})}]:[])],progress:{timing,stages,credits,windowPaused:Boolean(paused),executionStatus:row.status,completed:Number(completed),total,inProgress:row.status==='running'?Number((totals.results||[]).find(r=>r.status==='running')?.n)||0:0,lastActivityAt,label:buyerRecordLimit(row.last_error)?buyerRecordLimitMessage:input.freeDiscovery&&diagnostics.at(-1)?.code==='free_discovery_finished'?diagnostics.at(-1).reason:paused?paused.reason:activity|| (row.status==='needs_review'?'Research saved · '+(quality.gaps[0]||'review remaining gaps'):input.recheck&&row.phase==='contacts'?Object.values(input.recheck.plans).some(plan=>plan.queries.length)?'Checking missing contact details · alternative public sources':'Rechecking saved sources · no untried alternative queries':labels[row.phase]||row.phase.replaceAll('_',' '))}};
}
// A second Full click reopens its run, including a partial or budget-paused result.
// Only a separate resume command authorizes another execution window.
function sameFullScope(previous,input){
 const roles=value=>JSON.stringify([...(value.roles||[])].sort());
 return !previous.taskId&&!previous.paidResearch&&previous.scope==='all_buyers'
  &&previous.candidate?.company===input.candidate.company&&previous.workspaceContext===input.workspaceContext&&roles(previous)===roles(input);
}
const meteredCompanyResearch=input=>Boolean(input.fullResearch||input.meteredPublicResearchApproved);
async function reuseFullResearch(env,workspaceId,user,current,input){
 if(!current)return null;
 const previous=parse(current.input_json);
 if(!sameFullScope(previous,input)){
  if(activeBuyerJob(current.status))throw Object.assign(Error('Another research scope is active for this company. Open its progress before starting Full research.'),{status:409});
  return null;
 }
 if(meteredCompanyResearch(previous)||current.status==='complete')return current;
 if(current.status==='canceled')return null;
 if(activeBuyerJob(current.status)){
  // Keep the current lease. The worker observes this flag at its next boundary.
  const saved=await stmt(env,`UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.fullResearch',json('true'),'$.emailWaterfallVersion',1)
   WHERE id=? AND status IN ('queued','running') AND ${callerSql}`,current.id,...callerArgs(workspaceId,user)).run();
  if(saved.meta.changes)return readBuyerJob(env,workspaceId,{id:current.id});
  throw Object.assign(Error('Research or your access changed. Reopen the saved run.'),{status:409});
 }
 const candidate=readBuyerCheckpoint(current.result_json),{contactOptions}=await loadBuyerContactContext(env,{workspaceId},candidate);
 const missing=resumePhase(candidate,{...previous,freeDiscovery:false},contactOptions);
 const phase=['contacts','dossier'].includes(missing)?'identities':missing;
 if(phase==='done')return current;
 const saved=await stmt(env,`UPDATE buyer_research_jobs SET status='queued',phase=?,phase_ms=0,phase_runs=0,next_at=0,last_error='',revision=revision+1,
  input_json=json_set(input_json,'$.fullResearch',json('true'),'$.emailWaterfallVersion',1,'$.freeDiscovery',json('false'),'$.meteredPublicResearchApproved',json('true'),'$.executionWindowStartedAt',?),
  session_hash=?,requested_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND ${callerSql}`,phase,new Date().toISOString(),user.sessionTokenHash,user.id,current.id,current.revision,...callerArgs(workspaceId,user)).run();
 if(!saved.meta.changes)throw Object.assign(Error('Research changed. Reopen the saved run.'),{status:409});
 return readBuyerJob(env,workspaceId,{id:current.id});
}
export async function startBuyerJob(env,workspaceId,user,body,trusted=null){
 const stored=await workspaceBuyerContext(env,workspaceId,trusted?.taskId),input=normalizeBuyerInput(body,stored.payload);
 input.peopleFirst=body.peopleFirst===true&&!trusted?.taskId&&input.scope==='all_buyers';
 input.freeDiscovery=input.peopleFirst&&body.freeDiscovery===true&&body.paidResearch!==true;
 if(body.fullResearch===true){
  if(trusted||!input.peopleFirst||body.freeDiscovery||body.paidResearch||input.scope!=='all_buyers')throw Object.assign(Error('Full research applies to one company and public sources only.'),{status:400});
  try{
   await allowFullResearch(env,workspaceId);input.fullResearch=true;input.meteredPublicResearchApproved=true;
  }catch(error){
   if(!body.allowFreeFallback||error.code!=='FULL_RESEARCH_DISABLED')throw error;
   input.freeDiscovery=true;input.publicContactChecks=true;
  }
 }
 input.emailWaterfallVersion=1;
 input.executionWindowStartedAt=new Date().toISOString();
 input.contactContinuationVersion=1;
 input.executionContinuationVersion=4;
 input.contactSourceScope=D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion;
 input.paidResearch=await buyerPaidIntent(env,workspaceId,body.paidResearch===true&&input.scope==='all_buyers',input.candidate);
 if(body.paidEmailLimit!==undefined){
  const limit=body.paidEmailLimit;
  if(!Number.isInteger(limit)||limit<1||limit>4||!input.paidResearch?.email||input.paidResearch.provider!=='treg'||!input.paidResearch.companyId)throw Object.assign(Error('A saved company, enabled Treg email policy and a limit of one to four buyers are required.'),{status:409});
  input.paidResearch.phone=false;input.paidResearch.workEmailSearch=true;
  input.paidResearch.automaticBuyerLimit=Math.min(limit,input.paidResearch.automaticBuyerLimit);
 }
 if(trusted?.taskId){input.taskId=trusted.taskId;if(input.paidResearch){input.paidResearch.email=trusted.email===true&&input.paidResearch.email;input.paidResearch.phone=trusted.phone===true&&input.paidResearch.phone;input.paidResearch.automaticBuyerLimit=Math.min(input.paidResearch.automaticBuyerLimit,trusted.buyerCount);}}
 if(body.websiteScanId!==undefined){
  if(!input.peopleFirst||body.fullResearch!==true||trusted||input.paidResearch||typeof body.websiteScanId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(body.websiteScanId))throw Object.assign(Error('Invalid website buyer scan.'),{status:400});
  input.websiteScanId=body.websiteScanId;
  const scope={domain:input.candidate.domain,websiteScanId:input.websiteScanId};
  const existing=await readBuyerJob(env,workspaceId,scope);
  if(existing)return existing;
  input.workspaceContext=stored.hash;
  input.candidate.people=[];input.personIds=[];
  delete input.candidate.buyerResearchJob;delete input.candidate.buyerResearchProgress;
  input.candidate.peopleStatus='idle';input.candidate.publicContactStatus='idle';
  const id=crypto.randomUUID(),key=await buyerInputKey(input);
  const created=await stmt(env,`INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json,result_json,phase)
   SELECT ?,?,?,?,?,?,?,?,'official' WHERE ${callerSql} ON CONFLICT DO NOTHING`,id,workspaceId,user.id,user.sessionTokenHash,scope.domain,key,JSON.stringify(input),JSON.stringify(input.candidate),...callerArgs(workspaceId,user)).run();
  if(created.meta.changes)return readBuyerJob(env,workspaceId,{id});
  const concurrent=await readBuyerJob(env,workspaceId,scope);
  if(concurrent)return concurrent;
  throw Object.assign(Error('Another buyer run is active for this company, or your workspace access changed. Retry Find buyers after the active run finishes.'),{status:409});
 }
 const key=await buyerInputKey(input);
 input.workspaceContext=stored.hash;
 if(body.force===true&&input.scope==='selected_buyers'){
  const history=await stmt(env,"SELECT input_json,result_json FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND updated_at>datetime('now','-30 days') ORDER BY rowid DESC LIMIT 8",workspaceId,input.candidate.domain).all();
  prepareBuyerRecheck(input,history.results||[]);
 }
 const current=await readBuyerJob(env,workspaceId,{domain:input.candidate.domain});
 if(body.jobId&&current?.id!==body.jobId||body.expectedRevision!==undefined&&Number(body.expectedRevision)!==current?.revision)throw Object.assign(Error('Buyer research changed; reload the latest saved job'),{status:409});
 if(input.freeDiscovery&&current){
  const previous=parse(current.input_json);
  // A saved metered run is read-only on the free path, including during upgrades.
  if(meteredCompanyResearch(previous)&&previous.workspaceContext===stored.hash)return current;
 }
 if(current&&!body.force&&!current.last_error&&['needs_review','complete'].includes(current.status)&&input.scope==='all_buyers'&&(input.fullResearch||input.publicContactChecks)){
  const previous=parse(current.input_json);
  const diagnostics=parse(current.diagnostic_json,[]);
  const finished=current.phase==='done'||diagnostics.at(-1)?.code==='free_discovery_finished';
  const missingFinder=!previous.emailWaterfallVersion&&(previous.fullResearch||previous.publicContactChecks);
  const sameMode=Boolean(previous.fullResearch)===Boolean(input.fullResearch);
  if(finished&&missingFinder&&sameMode&&sameFullScope(previous,input)&&!currentWindowPause(current,previous,diagnostics)){
   const updated=await stmt(env,`UPDATE buyer_research_jobs SET status='queued',phase='contacts',phase_runs=0,phase_ms=0,next_at=0,last_error='',revision=revision+1,requested_by=?,session_hash=?,input_json=json_set(input_json,'$.emailWaterfallVersion',1,'$.executionWindowStartedAt',?) WHERE id=? AND revision=? AND ${callerSql}`,user.id,user.sessionTokenHash,input.executionWindowStartedAt,current.id,current.revision,...callerArgs(workspaceId,user)).run();
   if(updated.meta.changes)return readBuyerJob(env,workspaceId,{id:current.id});
   throw Object.assign(Error('Buyer research changed. Reopen the saved run.'),{status:409});
  }
 }
 if(input.publicContactChecks&&current){
  const previous=parse(current.input_json);
  if(previous.freeDiscovery&&!previous.publicContactChecks&&sameFullScope(previous,input)){
   const finished=parse(current.diagnostic_json,[]).at(-1)?.code==='free_discovery_finished';
   if(activeBuyerJob(current.status)||finished){
    const updated=await stmt(env,`UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.publicContactChecks',json('true'),'$.emailWaterfallVersion',1),phase=CASE WHEN ? THEN 'contacts' ELSE phase END,status=CASE WHEN ? THEN 'queued' ELSE status END,next_at=0,revision=revision+1 WHERE id=? AND revision=? AND ${callerSql}`,Number(finished),Number(finished),current.id,current.revision,...callerArgs(workspaceId,user)).run();
    if(updated.meta.changes)return readBuyerJob(env,workspaceId,{id:current.id});
    throw Object.assign(Error('Buyer research changed. Reopen the saved run.'),{status:409});
   }
  }
 }
 if(input.fullResearch&&(!body.force||current&&activeBuyerJob(current.status))){
  // A newer one-person check may be the latest job without replacing this
  // company's Full run or its provider receipts.
  const currentInput=current&&parse(current.input_json);
  if(current&&!activeBuyerJob(current.status)&&!(currentInput.fullResearch&&sameFullScope(currentInput,input))){
   const retained=await stmt(env,`SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND domain=?
    AND json_extract(input_json,'$.candidate.company')=? AND json_extract(input_json,'$.workspaceContext')=?
    AND json_extract(input_json,'$.fullResearch')=1 AND updated_at>=datetime('now','-30 days')
    AND id<>? ORDER BY rowid DESC LIMIT 8`,workspaceId,input.candidate.domain,input.candidate.company,stored.hash,current.id).all();
   for(const previous of retained.results){
    if(sameFullScope(parse(previous.input_json),input))return previous;
   }
  }
  const existing=await reuseFullResearch(env,workspaceId,user,current,input);
  if(existing)return existing;
 }
 if(body.paidEmailLimit&&current&&activeBuyerJob(current.status))throw Object.assign(Error('A buyer search is already running for this company.'),{status:409});
 if(trusted?.taskId&&current&&activeBuyerJob(current.status)&&parse(current.input_json).taskId!==trusted.taskId)throw Object.assign(Error('Another buyer research job is active for this company. Finish or pause it first.'),{status:409});
 if(current?.context_key===key&&parse(current.input_json).workspaceContext===stored.hash&&(!body.force||activeBuyerJob(current.status))){
  if((input.paidResearch||body.resumeIncomplete===true)&&!activeBuyerJob(current.status)&&current.status==='needs_review')return commandBuyerJob(env,workspaceId,user,{action:'resume',jobId:current.id,expectedRevision:current.revision});
  return current;
 }
 if(current&&activeBuyerJob(current.status)&&parse(current.input_json).taskId&&!trusted?.taskId)throw Object.assign(Error('Pause the research task in Ask LeadIntel before replacing this job.'),{status:409});
 if(current&&activeBuyerJob(current.status)){
  // An explicit replacement invalidates the old lease before the next job exists.
  const canceled=await stmt(env,`UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND status IN ('queued','running') AND ${callerSql}`,current.id,current.revision,...callerArgs(workspaceId,user)).run();if(!canceled.meta.changes)throw Object.assign(Error('Buyer research changed before replacement'),{status:409});
 }
 let initialPhase=input.recheck?'contacts':'official';
 if((body.resumeIncomplete===true||input.fullResearch)&&input.scope==='all_buyers'){
  const prior=await stmt(env,`SELECT result_json FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND updated_at>datetime('now','-30 days') AND json_extract(input_json,'$.workspaceContext')=? AND COALESCE(json_extract(input_json,'$.scope'),'all_buyers')!='selected_buyers' AND COALESCE(json_extract(input_json,'$.roles'),'[]')=? ORDER BY rowid DESC LIMIT 1`,workspaceId,input.candidate.domain,stored.hash,JSON.stringify(input.roles||[])).first();
  if(prior){
   input.candidate=D.reconcileBuyerEvidence(D.mergeRetainedBuyerResearch(readBuyerCheckpoint(prior.result_json,{}),input.candidate,{retainPeople:!input.candidate.people.length}),{trustedAgentSources:true});
   const {contactOptions}=await loadBuyerContactContext(env,{workspaceId},input.candidate);initialPhase=input.freeDiscovery?'official':resumePhase(input.candidate,input,contactOptions);
  }
 }

 if(current&&input.paidResearch&&parse(current.input_json).workspaceContext===stored.hash){
  const prior=readBuyerCheckpoint(current.result_json,{}),priorInput=parse(current.input_json),identity=p=>JSON.stringify([p.id,p.publicName||p.name,p.title,p.organization]);
  const {contactOptions}=await loadBuyerContactContext(env,{workspaceId},prior);
  if(JSON.stringify(priorInput.profile)===JSON.stringify(input.profile)&&JSON.stringify((prior.people||[]).map(identity).sort())===JSON.stringify(input.candidate.people.map(identity).sort())&&D.buyerResearchCoveragePassed(prior,{contactOptions})&&D.safeBuyerAiReview(prior.publicResearch?.aiReview)?.inputSignature===D.buyerReviewSignature(prior)){
   input.candidate=prior;delete input.candidate.publicResearch.paidResearch;initialPhase='paid';
  }
 }
 const id=crypto.randomUUID();
 const written=await stmt(env,`INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json,result_json,phase) SELECT ?,?,?,?,?,?,?,?,? WHERE ${callerSql} ON CONFLICT DO NOTHING`,id,workspaceId,user.id,user.sessionTokenHash,input.candidate.domain,key,JSON.stringify(input),JSON.stringify(input.candidate),initialPhase,...callerArgs(workspaceId,user)).run();
 if(!written.meta.changes){
  const concurrent=await stmt(env,`SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND status IN ('queued','running') AND ${callerSql}`,workspaceId,input.candidate.domain,...callerArgs(workspaceId,user)).first();
  if(input.fullResearch&&concurrent){
   const existing=await reuseFullResearch(env,workspaceId,user,concurrent,input);
   if(existing)return existing;
  }
  if(concurrent?.context_key===key&&parse(concurrent.input_json).workspaceContext===stored.hash)return concurrent;
  throw Object.assign(Error('Research authorization or the active company run changed.'),{status:409});
 }
 return readBuyerJob(env,workspaceId,{id});
}
export function standaloneBuyerDiscovery(input){
 return !input.taskId&&!input.recheck&&(input.scope||'all_buyers')==='all_buyers';
}
export async function commandBuyerJob(env,workspaceId,user,body){
 const row=await readBuyerJob(env,workspaceId,{id:body.jobId,domain:body.candidate?.domain||body.domain});
 if(!row)throw Object.assign(Error('Buyer research job not found'),{status:404});
 if(body.expectedRevision!==undefined&&Number(body.expectedRevision)!==row.revision)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
 if(body.action==='cancel'){
  const updated=await stmt(env,`UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND ${callerSql}`,row.id,row.revision,...callerArgs(workspaceId,user)).run();if(!updated.meta.changes)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
 }else{
  if(activeBuyerJob(row.status))return row;
  const other=await stmt(env,"SELECT id FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND id<>? AND status IN ('queued','running')",workspaceId,row.domain,row.id).first();
  if(other)throw Object.assign(Error('Wait for the active buyer run for this company before resuming this saved run.'),{status:409});
  const input=parse(row.input_json),context=await workspaceBuyerContext(env,workspaceId,input.taskId);
  if(input.workspaceContext!==context.hash)throw Object.assign(Error('The company profile changed. Start research with the updated context.'),{status:409});
  if(meteredCompanyResearch(input)&&body.resumeFreeCompany&&body.allowMeteredPublicResearch!==true)return row;
  if(meteredCompanyResearch(input)||body.allowMeteredPublicResearch===true)await allowFullResearch(env,workspaceId);
  const freeResume=!input.fullResearch&&standaloneBuyerDiscovery(input)&&(
   body.resumeFreeCompany===true||!input.meteredPublicResearchApproved&&!input.paidResearch&&input.peopleFirst==null
  );
  if(freeResume){
   input.freeDiscovery=true;
   input.peopleFirst=true;
   input.paidResearch=null;
   input.meteredPublicResearchApproved=false;
  }
  const expanding=input.freeDiscovery&&parse(row.diagnostic_json,[]).at(-1)?.code==='free_discovery_finished'&&body.allowMeteredPublicResearch===true;
  if(input.freeDiscovery&&parse(row.diagnostic_json,[]).at(-1)?.code==='free_discovery_finished'){
   if(body.allowMeteredPublicResearch!==true)return row;
   input.freeDiscovery=false;
   input.meteredPublicResearchApproved=true;input.fullResearch=true;
  }
  const storagePaused=buyerRecordLimit(row.last_error)||parse(row.diagnostic_json,[]).at(-1)?.code==='workspace_records_full';
  if(storagePaused){
   // Only an authorized Resume reclaims space. A CAS protects each immutable
   // observation of a saved result, including a concurrently resumed job.
   const saved=await stmt(env,`SELECT id,revision FROM buyer_research_jobs WHERE workspace_id=? AND status IN ('complete','needs_review','canceled','failed') AND length(result_json)>=65536 AND json_extract(result_json,'$.format') IS NULL ORDER BY length(result_json) DESC LIMIT 12`,workspaceId).all();
   for(const item of saved.results){
    const previous=await stmt(env,'SELECT result_json FROM buyer_research_jobs WHERE workspace_id=? AND id=? AND revision=?',workspaceId,item.id,item.revision).first();
    if(!previous)continue;
    const compact=compactBuyerCheckpoint(previous.result_json);
    if(compact!==previous.result_json)await stmt(env,`UPDATE buyer_research_jobs SET result_json=? WHERE workspace_id=? AND id=? AND revision=? AND status IN ('complete','needs_review','canceled','failed') AND ${callerSql}`,compact,workspaceId,item.id,item.revision,...callerArgs(workspaceId,user)).run();
   }
   const requiredBytes=Number(/^workspace_records_full:(\d+)$/.exec(row.last_error)?.[1]);
   if(requiredBytes>0){
    const space=await stmt(env,`SELECT (CASE WHEN a.plan_key='plus' AND a.paid_until>unixepoch() THEN a.plus_records_limit ELSE a.included_records_limit END)-a.records_bytes+length(CAST(j.result_json AS BLOB)) AS available FROM workspace_storage_accounts a JOIN buyer_research_jobs j ON j.workspace_id=a.workspace_id WHERE j.id=? AND a.workspace_id=?`,row.id,workspaceId).first();
    if(space&&space.available<requiredBytes){
     const missing=Math.ceil((requiredBytes-space.available)/1000);
     throw Object.assign(Error('Buyer research needs at least '+missing+' KB more CRM & workspace data space. The saved job is paused. No research provider was contacted.'),{status:507});
    }
   }
  }
  const candidate=readBuyerCheckpoint(row.result_json,input.candidate),{contactOptions}=await loadBuyerContactContext(env,{workspaceId},candidate),diagnostics=parse(row.diagnostic_json,[]),paused=currentWindowPause(row,input,diagnostics),phase=expanding?'identities':storagePaused&&row.phase!=='done'?row.phase:input.freeDiscovery?(row.phase==='identities'?'identities':'official'):paused&&row.phase!=='done'?row.phase:resumePhase(candidate,input,contactOptions);
  if(phase==='done')return row;
  if(!input.emailWaterfallVersion&&(input.fullResearch||input.publicContactChecks||input.recheck))input.emailWaterfallVersion=1;
  const startedAt=new Date().toISOString();
  if(paused||storagePaused)diagnostics.push({phase,code:'resumed',reason:'Resumed unfinished research',at:startedAt});
  const updated=await stmt(env,`UPDATE buyer_research_jobs SET phase=?,diagnostic_json=?,input_json=?,last_error='',status='queued',requested_by=?,session_hash=?,lease_token=NULL,lease_until=0,next_at=0,phase_ms=0,phase_runs=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND ${callerSql}`,phase,JSON.stringify(diagnostics.slice(-20)),JSON.stringify({...input,executionWindowStartedAt:startedAt}),user.id,user.sessionTokenHash,row.id,row.revision,...callerArgs(workspaceId,user)).run();
  if(!updated.meta.changes)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
  await stmt(env,`UPDATE buyer_research_tasks SET attempts=0,status='failed' WHERE job_id=? AND status<>'complete' AND (status<>'running' OR ?=0) AND EXISTS(SELECT 1 FROM buyer_research_jobs WHERE id=? AND status='queued' AND revision=? AND requested_by=? AND session_hash=?) AND ${callerSql}`,row.id,input.fullResearch?1:0,row.id,row.revision+1,user.id,user.sessionTokenHash,...callerArgs(workspaceId,user)).run();
 }
 return readBuyerJob(env,workspaceId,{id:row.id});
}

