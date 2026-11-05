import {prepareBuyerRecheck} from './buyer-recheck-plan.js';
import {sha256} from './security.js';
import {getCrmCompany} from './crm.js';
import {buyerPaidIntent,paidBuyerScope,paidSnapshotCandidate,paidContinuationScopeHash} from './buyer-paid-research.js';
import {readOwnedPayload} from './workspace-record-store.js';
import '../../customer/discovery-engine.js';
import '../../customer/targeting-policy.js';
const D=globalThis.LeadIntelDiscovery;
export const activeBuyerJob=status=>['queued','running'].includes(status);
export const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export const parse=(text,fallback={})=>{try{return JSON.parse(text);}catch{return fallback;}};
const allowed="('owner','researcher','sales')";
export const authoritySql=`EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=buyer_research_jobs.session_hash AND s.user_id=buyer_research_jobs.requested_by AND s.expires_at>datetime('now') AND m.workspace_id=buyer_research_jobs.workspace_id AND m.role IN ${allowed})`;
const callerSql=`EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.user_id=? AND s.expires_at>datetime('now') AND m.workspace_id=? AND m.role IN ${allowed})`;
const callerArgs=(workspaceId,user)=>[user.sessionTokenHash,user.id,workspaceId];
export const lost=()=>Object.assign(Error('Buyer research authorization or job context changed'),{code:'CANCELED',status:409});
export function activeBuyerProfile(payload={}){
 const main=payload.main||{},referenceDomains=(main.referenceCustomers?.rows||[]).map(r=>D.canonicalDomain(r.website||r.domain));
 const base={...(main.profile||{}),...globalThis.LeadIntelTargeting?.profileFields?.(main),website:main.website||main.profile?.website,referenceDomains,exclusions:[main.profile?.exclusions,main.answers?.exclusions,...referenceDomains].filter(Boolean).join('; '),targetMarkets:(main.targetMarkets||[]).join(', ')||main.profile?.targetMarkets};
 return D.effectiveTargetingProfile(base,main.market||{});
}
export async function workspaceBuyerContext(env,workspaceId){
 const row=await stmt(env,'SELECT version,payload_json FROM customer_workspace_state WHERE workspace_id=?',workspaceId).first();
 const {payload}=await readOwnedPayload(env,workspaceId,row);
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
 const selected=(body.personIds||[]).map(String).slice(0,10),roles=D.buyerSelectionRoles({decisionMakers:raw.buyerRoles||raw.buyerDiscovery?.opportunityRoles||body.profile?.decisionMakers||stored.main?.profile?.decisionMakers||''});
 const normalized=D.normalizeDiscoveryState({selectedProspects:[{...saved,...raw,domain,buyerSearchMode:'user_selected_target',buyerRoles:roles.join('; ')}]}).selectedProspects[0];
 if(!normalized)throw Object.assign(Error('Company research input is invalid'),{status:400});
 // Client snapshots are input claims, never server execution receipts. Source pages
 // are read by the job before any new contact evidence can be accepted.
 normalized.people=(normalized.people||[]).filter(p=>!selected.length||selected.includes(String(p.id))).slice(0,10).map(p=>{
  const copy={...p};for(const key of ['contactResearch','emailResearch','publicEmailEvidence','publicPhoneEvidence','publicEmailSourceCheck','publicPhoneSourceCheck','patternFindings','gmailMatches','contactVerification'])delete copy[key];return copy;
 });
 normalized.publicResearch={};normalized.publicContacts=[];
 normalized.buyerDiscovery={opportunityRoles:roles,companyContacts:[]};
 const activeProfile=activeBuyerProfile(stored),hasActive=Boolean(stored.main?.profile&&Object.keys(stored.main.profile).length);
 if(hasActive&&body.profile&&D.buyerFitContext(body.profile)!==D.buyerFitContext(activeProfile))throw Object.assign(Error('The seller profile changed. Save or reload its current context before starting research.'),{status:409});
 const fit=parse(D.buyerFitContext(hasActive?activeProfile:body.profile||{})),profile={priorityOffers:fit.offers,idealCustomer:fit.buyers,targetMarkets:fit.markets,exclusions:fit.exclusions,website:fit.website,decisionMakers:roles.join('; ')};
 const personIds=normalized.people.map(p=>String(p.id));
 return {candidate:normalized,profile,roles,personIds,scope:selected.length?'selected_buyers':'all_buyers'};
}
export async function buyerInputKey(input){return sha256(JSON.stringify([input.paidResearch,input.candidate.domain,input.candidate.company,input.profile,input.roles.slice().sort(),input.personIds.slice().sort(),input.candidate.people.map(p=>[p.id,p.publicName||p.name,p.title,p.organization]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]));}
export async function readBuyerJob(env,workspaceId,{id,domain}={}){
 return id?stmt(env,'SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND id=?',workspaceId,id).first():stmt(env,'SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND domain=? ORDER BY rowid DESC LIMIT 1',workspaceId,D.canonicalDomain(domain)).first();
}
export async function recoverInterruptedContactJob(env,{jobId}={}){
 // One-time repair of the old cumulative-timeout behavior. GET remains read-only;
 // only the scheduler may resume the latest still-authorized saved request.
 const rows=await stmt(env,`SELECT * FROM buyer_research_jobs WHERE status IN ('needs_review','complete') AND phase='done' AND COALESCE(json_extract(input_json,'$.recheck.version'),0)=0 AND updated_at>datetime('now','-30 days') AND ((COALESCE(json_extract(input_json,'$.contactSourceScope'),'')<>? AND json_extract(result_json,'$.buyerDiscovery.officialContactInventory.research.status') IN ('partial','error') AND COALESCE(json_extract(result_json,'$.buyerDiscovery.officialContactInventory.research.discoveryScope'),'')<>?) OR (json_extract(result_json,'$.publicResearch.accountability.stopReason')='time_budget' AND COALESCE(json_extract(input_json,'$.contactContinuationVersion'),0)<1) OR (COALESCE(json_extract(input_json,'$.contactSchedulingVersion'),0)<1 AND COALESCE(json_extract(input_json,'$.contactSchedulingRecoveryVersion'),0)<1 AND json_extract(result_json,'$.publicResearch.accountability.status')='partial' AND json_extract(result_json,'$.publicResearch.accountability.stopReason')='time_budget') OR (COALESCE(json_extract(input_json,'$.executionContinuationVersion'),0)<4 AND (json_extract(result_json,'$.publicResearch.buyerAgent.status')='needs_review' OR json_extract(result_json,'$.publicResearch.aiReview.status')='complete' OR EXISTS(SELECT 1 FROM buyer_research_tasks t WHERE t.job_id=buyer_research_jobs.id AND t.status='running')))) AND NOT EXISTS(SELECT 1 FROM buyer_research_jobs newer WHERE newer.workspace_id=buyer_research_jobs.workspace_id AND newer.domain=buyer_research_jobs.domain AND newer.rowid>buyer_research_jobs.rowid) AND ${authoritySql} ${jobId?'AND id=?':''} ORDER BY updated_at LIMIT 3`,D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion,D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion,...(jobId?[jobId]:[])).all();
 for(const row of rows.results||[]){
  const input=parse(row.input_json),context=await workspaceBuyerContext(env,row.workspace_id),matches=input.workspaceContext===context.hash,diagnostics=parse(row.diagnostic_json,[]),executionRepair=Number(input.contactContinuationVersion||0)>=1;
  const candidate=parse(row.result_json,input.candidate),phase=resumePhase(candidate,input);
  let paidScope=null,continuationScopeHash='';
  if(matches&&input.paidResearch?.companyId){
   const value=await stmt(env,'SELECT research_snapshot_json,evidence_json FROM crm_intelligence WHERE workspace_id=? AND company_id=?',row.workspace_id,input.paidResearch.companyId).first(),snapshot=parse(value?.research_snapshot_json),candidate=parse(row.result_json,input.candidate);
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
function resumePhase(saved,input={}){const candidate=D.reconcileBuyerEvidence(saved,{trustedAgentSources:true}),review=D.safeBuyerAiReview(candidate.publicResearch?.aiReview);return input.recheck?(!D.buyerResearchCoveragePassed(candidate)?'contacts':review?.status!=='complete'||review.inputSignature!==D.buyerReviewSignature(candidate)?'review':'done'):!D.officialContactCoveragePassed(candidate)?'official':candidate.buyerDiscovery?.companyDossier?.status!=='complete'?'dossier':!candidate.people?.length?'identities':!D.buyerResearchCoveragePassed(candidate)?'contacts':review?.status!=='complete'||review.inputSignature!==D.buyerReviewSignature(candidate)?'review':input.paidResearch&&!['complete','disabled'].includes(candidate.publicResearch?.paidResearch?.status)?'paid':'done';}
async function retainedJobCandidate(env,row,input,current){
 // Only server-owned results in this workspace and seller context can restore
 // source facts. Current roster, rejections and execution receipts remain authoritative.
 const history=await stmt(env,"SELECT input_json,result_json FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND rowid<(SELECT rowid FROM buyer_research_jobs WHERE id=?) AND updated_at>datetime('now','-30 days') ORDER BY rowid DESC LIMIT 3",row.workspace_id,row.domain,row.id).all();
 let candidate=current;
 for(const old of history.results||[]){const prior=parse(old.input_json);if(!input.workspaceContext||prior.workspaceContext!==input.workspaceContext)continue;
  candidate=D.mergeRetainedBuyerResearch(parse(old.result_json,{}),candidate);
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
  const candidate=D.reconcileBuyerEvidence(parse(old.result_json,{}),{trustedAgentSources:true});
  if(D.canonicalDomain(candidate.domain)!==row.domain)continue;
  pool=D.mergeBuyerPool(pool,candidate.people||[],input.profile);
 }
 const latest=parse(row.result_json,{});
 return D.retainBuyerIdentities(pool,input.profile||{},latest).slice(0,10);
}
export async function savedBuyerResearchReceipts(env,row){
 if(!row)return [];
 const input=parse(row.input_json);if(!input.workspaceContext)return [];
 // Read the latest receipt per research identity, rather than the last few
 // jobs: repeated one-person rechecks must not hide another person's results.
 const history=await stmt(env,`SELECT person_json FROM (
 SELECT p.value person_json,ROW_NUMBER() OVER (
 PARTITION BY json_extract(p.value,'$.contactResearch.identityKey') ORDER BY j.rowid DESC) rank
 FROM buyer_research_jobs j,json_each(j.result_json,'$.people') p
 WHERE j.workspace_id=? AND j.domain=? AND j.updated_at>datetime('now','-30 days')
 AND json_extract(j.input_json,'$.workspaceContext')=?
 AND json_extract(p.value,'$.contactResearch.policyVersion')=?
 AND json_extract(p.value,'$.contactResearch.identityKey') IS NOT NULL
 ) WHERE rank=1 LIMIT 40`,row.workspace_id,row.domain,input.workspaceContext,D.BUYER_CONTACT_RESEARCH_POLICY.version).all();
 return (history.results||[]).map(r=>{
  const p=parse(r.person_json),safe=D.mergeBuyerPool([],[p])[0];if(!safe)return null;
  return Object.fromEntries(['id','name','publicName','title','organization','publicLinkedinUrl','linkedin_url','contactResearch','emailResearch','gmailMatches','gmailCandidates'].filter(k=>safe[k]!==undefined).map(k=>[k,safe[k]]));
 }).filter(Boolean);
}
export async function publicBuyerJob(env,row,{recoverRetained=false}={}){
 if(!row)return null;const input=parse(row.input_json);let candidate=parse(row.result_json,input.candidate||{});
 if(recoverRetained)candidate=await retainedJobCandidate(env,row,input,candidate);
 candidate=D.reconcileBuyerEvidence(candidate,{trustedAgentSources:true});
 const totals=await stmt(env,"SELECT status,count(*) n,MAX(updated_at) last_activity_at FROM buyer_research_tasks WHERE job_id=? GROUP BY status",row.id).all();
 const activeTask=input.recheck&&row.status==='running'?await stmt(env,"SELECT kind,request_value FROM buyer_research_tasks WHERE job_id=? AND status='running' ORDER BY updated_at DESC LIMIT 1",row.id).first():null;
 const activity=activeTask?.kind==='read'?'Reading public contact evidence':activeTask?.kind==='independent'?'Cross-checking contact evidence':activeTask?.kind==='search'?(/gmail|googlemail/i.test(activeTask.request_value)?'Searching public Gmail business-contact listings':/linkedin/i.test(activeTask.request_value)?'Checking LinkedIn identity':'Searching public contact sources'):'';

 let crm=null;if(candidate.publicResearch?.paidResearch?.companyId){try{const detail=await getCrmCompany(env.DB,{workspaceId:row.workspace_id},candidate.publicResearch.paidResearch.companyId);if(D.canonicalDomain(detail.company?.normalized_domain)===row.domain)crm={company:detail.company,contacts:detail.contacts,contactData:detail.contactData,phoneRequests:detail.phoneRequests};}catch{}}
 const contact=p=>(crm?.contacts||[]).find(c=>String(c.external_person_id)===String(p.id)&&String(c.name).trim().toLowerCase()===String(p.publicName||p.name).trim().toLowerCase())||{};
 const quality=D.buyerQualityAssessment(candidate,{contactForPerson:contact,workspaceId:row.workspace_id,companyId:crm?.company?.id,confirmedEmail:p=>D.acceptedOfficialBuyerEmail(candidate,p)||(globalThis.LeadIntelContactPolicy.accepted(contact(p),row.domain,'provider_verified')?contact(p).normalized_email||contact(p).work_email:'')});
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
 const timing={estimate,lastResultAt,nextAttemptAt:row.status==='queued'&&Number(row.next_at)>0?new Date(Number(row.next_at)).toISOString():null};
 const labels={official:'Reading official company sources',dossier:'Researching the company',identities:'Finding decision-makers',contacts:'Checking contact evidence',review:'Reviewing buyer evidence',paid:'Researching approved paid channels',done:'Research saved'};
 return {id:row.id,domain:row.domain,retainedEvidenceRecovered:recoverRetained,contextKey:row.context_key,crm,input:{paidResearch:Boolean(input.paidResearch),company:input.candidate?.company,domain:row.domain,profile:input.profile,roles:input.roles,personIds:input.scope==='selected_buyers'?input.personIds:[],scope:input.scope},status:row.status,phase:row.phase,resumePhase:resumePhase(candidate,input),revision:row.revision,createdAt,updatedAt,candidate,quality,diagnostics:[...parse(row.diagnostic_json,[]),...(row.last_error?[{phase:row.phase,reason:row.last_error}]:[])],progress:{timing,executionStatus:row.status,completed:Number(completed),total,inProgress:row.status==='running'?Number((totals.results||[]).find(r=>r.status==='running')?.n)||0:0,lastActivityAt,label:activity|| (row.status==='needs_review'?'Research saved · '+(quality.gaps[0]||'review remaining gaps'):input.recheck&&row.phase==='contacts'?Object.values(input.recheck.plans).some(plan=>plan.queries.length)?'Checking missing contact details · alternative public sources':'Rechecking saved sources · no untried alternative queries':labels[row.phase]||row.phase.replaceAll('_',' '))}};
}
export async function startBuyerJob(env,workspaceId,user,body){
 const stored=await workspaceBuyerContext(env,workspaceId),input=normalizeBuyerInput(body,stored.payload);
 input.contactContinuationVersion=1;
 input.executionContinuationVersion=4;
 input.contactSourceScope=D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion;
 input.paidResearch=await buyerPaidIntent(env,workspaceId,body.paidResearch===true&&input.scope==='all_buyers',input.candidate);
 const key=await buyerInputKey(input);
 input.workspaceContext=stored.hash;
 if(body.force===true&&input.scope==='selected_buyers'){
  const history=await stmt(env,"SELECT input_json,result_json FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND updated_at>datetime('now','-30 days') ORDER BY rowid DESC LIMIT 8",workspaceId,input.candidate.domain).all();
  prepareBuyerRecheck(input,history.results||[]);
 }
 const current=await readBuyerJob(env,workspaceId,{domain:input.candidate.domain});
 if(body.jobId&&current?.id!==body.jobId||body.expectedRevision!==undefined&&Number(body.expectedRevision)!==current?.revision)throw Object.assign(Error('Buyer research changed; reload the latest saved job'),{status:409});
 if(current?.context_key===key&&parse(current.input_json).workspaceContext===stored.hash&&(!body.force||activeBuyerJob(current.status))){
  if((input.paidResearch||body.resumeIncomplete===true)&&!activeBuyerJob(current.status)&&current.status==='needs_review')return commandBuyerJob(env,workspaceId,user,{action:'resume',jobId:current.id,expectedRevision:current.revision});
  return current;
 }
 if(current&&activeBuyerJob(current.status)){
  // An explicit replacement invalidates the old lease before the next job exists.
  const canceled=await stmt(env,`UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND status IN ('queued','running') AND ${callerSql}`,current.id,current.revision,...callerArgs(workspaceId,user)).run();if(!canceled.meta.changes)throw Object.assign(Error('Buyer research changed before replacement'),{status:409});
 }
 let initialPhase=input.recheck?'contacts':'official';
 if(body.resumeIncomplete===true&&input.scope==='all_buyers'){
  const prior=await stmt(env,`SELECT result_json FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND updated_at>datetime('now','-30 days') AND json_extract(input_json,'$.workspaceContext')=? AND COALESCE(json_extract(input_json,'$.scope'),'all_buyers')!='selected_buyers' AND COALESCE(json_extract(input_json,'$.roles'),'[]')=? ORDER BY rowid DESC LIMIT 1`,workspaceId,input.candidate.domain,stored.hash,JSON.stringify(input.roles||[])).first();
  if(prior){
   input.candidate=D.reconcileBuyerEvidence(D.mergeRetainedBuyerResearch(parse(prior.result_json,{}),input.candidate,{retainPeople:!input.candidate.people.length}),{trustedAgentSources:true});
   initialPhase=resumePhase(input.candidate,input);
  }
 }

 if(current&&input.paidResearch&&parse(current.input_json).workspaceContext===stored.hash){
  const prior=parse(current.result_json,{}),priorInput=parse(current.input_json),identity=p=>JSON.stringify([p.id,p.publicName||p.name,p.title,p.organization]);
  if(JSON.stringify(priorInput.profile)===JSON.stringify(input.profile)&&JSON.stringify((prior.people||[]).map(identity).sort())===JSON.stringify(input.candidate.people.map(identity).sort())&&D.buyerResearchCoveragePassed(prior)&&D.safeBuyerAiReview(prior.publicResearch?.aiReview)?.inputSignature===D.buyerReviewSignature(prior)){
   input.candidate=prior;delete input.candidate.publicResearch.paidResearch;initialPhase='paid';
  }
 }
 const id=crypto.randomUUID();
 const written=await stmt(env,`INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json,result_json) SELECT ?,?,?,?,?,?,?,? WHERE ${callerSql}`,id,workspaceId,user.id,user.sessionTokenHash,input.candidate.domain,key,JSON.stringify(input),JSON.stringify(input.candidate),...callerArgs(workspaceId,user)).run();if(!written.meta.changes)throw Object.assign(Error('Research authorization changed'),{status:403});
 if(initialPhase!=='official')await stmt(env,"UPDATE buyer_research_jobs SET phase=? WHERE id=?",initialPhase,id).run();
 return readBuyerJob(env,workspaceId,{id});
}
export async function commandBuyerJob(env,workspaceId,user,body){
 const row=await readBuyerJob(env,workspaceId,{id:body.jobId,domain:body.candidate?.domain||body.domain});
 if(!row)throw Object.assign(Error('Buyer research job not found'),{status:404});
 if(body.expectedRevision!==undefined&&Number(body.expectedRevision)!==row.revision)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
 if(body.action==='cancel'){
  const updated=await stmt(env,`UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND ${callerSql}`,row.id,row.revision,...callerArgs(workspaceId,user)).run();if(!updated.meta.changes)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
 }else{
  if(activeBuyerJob(row.status))return row;
  const input=parse(row.input_json),context=await workspaceBuyerContext(env,workspaceId);
  if(input.workspaceContext!==context.hash)throw Object.assign(Error('The company profile changed. Start research with the updated context.'),{status:409});
  const candidate=parse(row.result_json,input.candidate),phase=resumePhase(candidate,input);
  if(phase==='done')return row;
  const updated=await stmt(env,`UPDATE buyer_research_jobs SET phase=?,last_error='',status='queued',requested_by=?,session_hash=?,lease_token=NULL,lease_until=0,next_at=0,phase_ms=0,phase_runs=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND ${callerSql}`,phase,user.id,user.sessionTokenHash,row.id,row.revision,...callerArgs(workspaceId,user)).run();
  if(!updated.meta.changes)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
  await stmt(env,`UPDATE buyer_research_tasks SET attempts=0,status='failed' WHERE job_id=? AND status<>'complete' AND EXISTS(SELECT 1 FROM buyer_research_jobs WHERE id=? AND status='queued' AND revision=? AND requested_by=? AND session_hash=?) AND ${callerSql}`,row.id,row.id,row.revision+1,user.id,user.sessionTokenHash,...callerArgs(workspaceId,user)).run();
 }
 return readBuyerJob(env,workspaceId,{id:row.id});
}

