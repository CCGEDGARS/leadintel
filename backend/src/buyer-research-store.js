import {sha256} from './security.js';
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
export async function buyerInputKey(input){return sha256(JSON.stringify([input.candidate.domain,input.candidate.company,input.profile,input.roles.slice().sort(),input.personIds.slice().sort(),input.candidate.people.map(p=>[p.id,p.publicName||p.name,p.title,p.organization]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]));}
export async function readBuyerJob(env,workspaceId,{id,domain}={}){
 return id?stmt(env,'SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND id=?',workspaceId,id).first():stmt(env,'SELECT * FROM buyer_research_jobs WHERE workspace_id=? AND domain=? ORDER BY rowid DESC LIMIT 1',workspaceId,D.canonicalDomain(domain)).first();
}
function resumePhase(candidate){return !D.officialContactCoveragePassed(candidate)?'official':candidate.buyerDiscovery?.companyDossier?.status!=='complete'?'dossier':!candidate.people?.length?'identities':!D.buyerResearchCoveragePassed(candidate)?'contacts':candidate.publicResearch?.aiReview?.status!=='complete'?'review':'done';}
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
export async function publicBuyerJob(env,row,{recoverRetained=false}={}){
 if(!row)return null;const input=parse(row.input_json);let candidate=parse(row.result_json,input.candidate||{});
 if(recoverRetained)candidate=await retainedJobCandidate(env,row,input,candidate);
 const totals=await stmt(env,"SELECT status,count(*) n FROM buyer_research_tasks WHERE job_id=? GROUP BY status",row.id).all();
 const quality=D.buyerQualityAssessment(candidate,{confirmedEmail:p=>D.acceptedOfficialBuyerEmail(candidate,p)});
 const completed=(totals.results||[]).find(r=>r.status==='complete')?.n||0,total=(totals.results||[]).reduce((n,r)=>n+Number(r.n),0);
 return {id:row.id,domain:row.domain,retainedEvidenceRecovered:recoverRetained,contextKey:row.context_key,input:{company:input.candidate?.company,domain:row.domain,profile:input.profile,roles:input.roles,personIds:input.scope==='selected_buyers'?input.personIds:[],scope:input.scope},status:row.status,phase:row.phase,resumePhase:resumePhase(candidate),revision:row.revision,updatedAt:row.updated_at.replace(' ','T')+'Z',candidate,quality,diagnostics:[...parse(row.diagnostic_json,[]),...(row.last_error?[{phase:row.phase,reason:row.last_error}]:[])],progress:{completed:Number(completed),total,label:row.status==='needs_review'?'Research saved · '+(quality.gaps[0]||'review remaining gaps'):row.phase.replaceAll('_',' ')}};
}
export async function startBuyerJob(env,workspaceId,user,body){
 const stored=await workspaceBuyerContext(env,workspaceId),input=normalizeBuyerInput(body,stored.payload),key=await buyerInputKey(input);
 input.workspaceContext=stored.hash;
 const current=await readBuyerJob(env,workspaceId,{domain:input.candidate.domain});
 if(body.jobId&&current?.id!==body.jobId||body.expectedRevision!==undefined&&Number(body.expectedRevision)!==current?.revision)throw Object.assign(Error('Buyer research changed; reload the latest saved job'),{status:409});
 if(current?.context_key===key&&parse(current.input_json).workspaceContext===stored.hash&&(!body.force||activeBuyerJob(current.status)))return current;
 if(current&&activeBuyerJob(current.status)){
  // An explicit replacement invalidates the old lease before the next job exists.
  const canceled=await stmt(env,`UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND status IN ('queued','running') AND ${callerSql}`,current.id,current.revision,...callerArgs(workspaceId,user)).run();if(!canceled.meta.changes)throw Object.assign(Error('Buyer research changed before replacement'),{status:409});
 }
 const id=crypto.randomUUID();
 const written=await stmt(env,`INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json,result_json) SELECT ?,?,?,?,?,?,?,? WHERE ${callerSql}`,id,workspaceId,user.id,user.sessionTokenHash,input.candidate.domain,key,JSON.stringify(input),JSON.stringify(input.candidate),...callerArgs(workspaceId,user)).run();if(!written.meta.changes)throw Object.assign(Error('Research authorization changed'),{status:403});
 return readBuyerJob(env,workspaceId,{id});
}
export async function commandBuyerJob(env,workspaceId,user,body){
 const row=await readBuyerJob(env,workspaceId,{id:body.jobId,domain:body.candidate?.domain||body.domain});
 if(!row)throw Object.assign(Error('Buyer research job not found'),{status:404});
 if(body.expectedRevision!==undefined&&Number(body.expectedRevision)!==row.revision)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
 if(body.action==='cancel'){
  const updated=await stmt(env,`UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND ${callerSql}`,row.id,row.revision,...callerArgs(workspaceId,user)).run();if(!updated.meta.changes)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
 }else{
  if(activeBuyerJob(row.status)||row.status==='complete')return row;
  const input=parse(row.input_json),context=await workspaceBuyerContext(env,workspaceId);
  if(input.workspaceContext!==context.hash)throw Object.assign(Error('The company profile changed. Start research with the updated context.'),{status:409});
  const candidate=parse(row.result_json,input.candidate),phase=resumePhase(candidate);
  if(phase==='done')return row;
  const updated=await stmt(env,`UPDATE buyer_research_jobs SET phase=?,last_error='',status='queued',requested_by=?,session_hash=?,lease_token=NULL,lease_until=0,next_at=0,phase_ms=0,phase_runs=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND ${callerSql}`,phase,user.id,user.sessionTokenHash,row.id,row.revision,...callerArgs(workspaceId,user)).run();
  if(!updated.meta.changes)throw Object.assign(Error('Buyer research changed; reload its saved progress'),{status:409});
  await stmt(env,`UPDATE buyer_research_tasks SET attempts=0,status='failed' WHERE job_id=? AND status<>'complete' AND EXISTS(SELECT 1 FROM buyer_research_jobs WHERE id=? AND status='queued' AND revision=? AND requested_by=? AND session_hash=?) AND ${callerSql}`,row.id,row.id,row.revision+1,user.id,user.sessionTokenHash,...callerArgs(workspaceId,user)).run();
 }
 return readBuyerJob(env,workspaceId,{id:row.id});
}
