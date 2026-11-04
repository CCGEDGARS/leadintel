import {stmt,parse,authoritySql,lost,workspaceBuyerContext,readBuyerJob,publicBuyerJob,recoverInterruptedContactJob} from './buyer-research-store.js';
import {runBuyerPaidResearch} from './buyer-paid-research.js';
import {storageFailure} from './workspace-storage.js';
import {sha256} from './security.js';
import {researchWorkspaceDossier} from './company-dossier.js';
import {createBuyerSourceSearch} from './buyer-source-search.js';
import {readPublicBuyerPage} from './service-integrations.js';
import {reviewWorkspaceBuyerEvidence,searchWorkspaceBuyerContact} from './ai-routes.js';
import '../../customer/discovery-engine.js';
import '../../customer/company-dossier.js';
const D=globalThis.LeadIntelDiscovery,C=globalThis.LeadIntelCompanyDossier;
const phaseBudget={official:180000,dossier:360000,identities:90000,contacts:180000,review:45000,paid:360000};
// The public engine's 180s deadline bounds one pass. Scheduler slices resume
// that same finite task plan; their accumulated wall time is not completion.
const phaseExhausted=(phase,ms,runs)=>runs>=18||(!['official','dossier','contacts'].includes(phase)&&ms>=phaseBudget[phase]);
const nextPhase={official:'dossier',dossier:'identities',identities:'contacts',contacts:'review',review:'paid',paid:'done'};
const errorReason=(error,phase)=>`${phase}: ${error?.name==='TimeoutError'?'provider deadline reached':/\((?:4|5)\d{2}\)/.test(error?.message||'')?'provider HTTP '+error.message.match(/\((\d{3})\)/)[1]:error?.code==='TIME_BUDGET'||error?.name==='AbortError'?'time budget reached':error?.status===401||error?.status===403?'authorization changed':/limit|budget/i.test(error?.message||'')?'bounded work limit reached':'provider or source unavailable'}`;
const jsonSize=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
const resultRows=result=>Array.isArray(result)?result:result?.results||[];
function restoreSearch(value){const rows=value.rows||[];Object.defineProperty(rows,'searchProviders',{value:value.providers||[]});if(value.researchTrace)Object.defineProperty(rows,'researchTrace',{value:value.researchTrace});return rows;}
export async function runBuyerResearchJobs(env,{now=Date.now(),maxJobs=2,windowMs=50000,services={},clock=Date.now,jobId}={}){
 const results=[];
 for(let n=0;n<maxJobs;n++){
  const invocationBudget=env.bookInvocationBudget;
  if(invocationBudget&&!invocationBudget.admit(160))break;
  try{
  const start=clock(),lease=crypto.randomUUID(),until=start+Math.max(90000,windowMs+45000);
  const claim=()=>stmt(env,`UPDATE buyer_research_jobs SET status='running',lease_token=?,lease_until=?,updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM buyer_research_jobs WHERE status IN ('queued','running') AND lease_until<? AND next_at<=? ${jobId?'AND id=?':''} ORDER BY next_at,created_at LIMIT 1) AND lease_until<? RETURNING *`,lease,until,now,now,...(jobId?[jobId]:[]),now).first();
  let row=await claim();
  if(!row&&await recoverInterruptedContactJob(env,{jobId}))row=await claim();
  if(!row)break;
  const input=parse(row.input_json),originalCandidate=parse(row.result_json,input.candidate),reconciledCandidate=D.reconcileBuyerEvidence(originalCandidate,{trustedAgentSources:true});
  // A stale legacy paid slice first settles through the existing paid evidence
  // gate. Keep it eligible for terminal recovery, which captures its original
  // own-CRM scope before a fresh review changes that scope.
  const officialPlan=reconciledCandidate.buyerDiscovery?.officialContactInventory?.research,sourceScopeChanged=row.phase!=='official'&&officialPlan&&officialPlan.status!=='complete'&&officialPlan.discoveryScope!==D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion;
  const deferSemanticStamp=row.phase==='paid'&&(sourceScopeChanged||Number(input.executionContinuationVersion||0)<4&&(originalCandidate.publicResearch?.aiReview?.inputSignature!==D.buyerReviewSignature(reconciledCandidate)||!D.buyerResearchCoveragePassed(reconciledCandidate)));
  const candidate=deferSemanticStamp?originalCandidate:reconciledCandidate,controller=new AbortController();let invocationExhausted=false,activeTaskReservations=0,accepting=true,phase=row.phase,phaseMs=row.phase_ms,phaseRuns=row.phase_runs,changed=0,contextVersion=-1;
  const rescopeOfficial=sourceScopeChanged&&!deferSemanticStamp&&!input.recheck;
  if(rescopeOfficial){phase=row.phase='official';phaseMs=0;phaseRuns=0;}
  const timer=setTimeout(()=>controller.abort(Object.assign(Error('Job processing slice ended'),{code:'TIME_BUDGET'})),Math.max(1,windowMs));
  const guard=async({checkpoint=false}={})=>{
   if(!checkpoint&&!activeTaskReservations&&invocationBudget&&!invocationBudget.hasRoom(32)){invocationExhausted=true;throw Object.assign(Error('Shared invocation query budget reached; saved work will continue'),{code:'TIME_BUDGET'});}
   if(!checkpoint&&(!accepting||controller.signal.aborted))throw Object.assign(Error('Processing slice stopped'),{code:'TIME_BUDGET'});
   const live=await stmt(env,`SELECT status,lease_token,lease_until,CASE WHEN ${authoritySql} THEN 1 ELSE 0 END authorized FROM buyer_research_jobs WHERE id=?`,row.id).first();
   if(!live||live.status!=='running'||live.lease_token!==lease||!live.authorized)throw lost();
   if(live.lease_until<=clock())throw Object.assign(Error('Processing lease expired'),{code:'LEASE_EXPIRED'});
   const version=Number((await stmt(env,'SELECT version FROM customer_workspace_state WHERE workspace_id=?',row.workspace_id).first())?.version)||0;
   if(contextVersion!==version){const context=await workspaceBuyerContext(env,row.workspace_id);if(context.hash!==input.workspaceContext)throw Object.assign(Error('The seller context changed'),{code:'CONTEXT_CHANGED'});contextVersion=context.version;}
  };
  const writeGuard=`EXISTS(SELECT 1 FROM buyer_research_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>? AND ${authoritySql} AND COALESCE((SELECT version FROM customer_workspace_state WHERE workspace_id=buyer_research_jobs.workspace_id),0)=?)`;
  const current=async(checkpoint=false)=>{await guard({checkpoint});return [row.id,lease,clock(),contextVersion];};
  let scheduledContactWork=false;
  let report=candidate.publicResearch?.accountability||D.createBuyerResearchAccountability();candidate.publicResearch={...(candidate.publicResearch||{}),accountability:report,researchScope:input.scope,researchedPersonIds:input.personIds};
  const observe=entry=>D.recordBuyerResearchTool(report,entry);
  const nativeSearch=services.search||createBuyerSourceSearch(env,row.workspace_id,{guard,observe,signal:controller.signal});
  const scopedWrite=async(build,checkpoint=false)=>{for(let attempt=0;attempt<3;attempt++){const args=await current(checkpoint),result=await build(args).run();if(result.meta.changes)return result;}throw lost();};
  const inflightTasks=new Map(),contactTasks=new Set();
  const readProjection=(value,requested)=>D.buyerSourceReadLocation(candidate,requested,value)?{...value,sourceRead:true}:{url:value.url,metadata:{sourceURL:value.metadata?.sourceURL,url:value.metadata?.url,statusCode:value.metadata?.statusCode},sourceRead:false};
  const executeTaskBody=async(kind,value,operation)=>{
   await guard();const key=await sha256(kind+'|'+value),prior=await stmt(env,'SELECT * FROM buyer_research_tasks WHERE job_id=? AND task_key=?',row.id,key).first();
   if(phase==='contacts')contactTasks.add(key);
   if(prior?.status==='complete'){const result=parse(prior.result_json);return kind==='read'?{...readProjection(result,value),reused:true}:result;}
   // A running row belongs to the previous expired/canceled slice. It is not
   // a provider-failure receipt. Keep earlier real failures, but restore the
   // interrupted dispatch; bounded tasks and consecutive idle slices still bound work.
   const attempts=prior?.status==='running'?(prior.error&&!/time budget reached/i.test(prior.error)?Math.max(0,Number(prior.attempts||0)-1):0):Number(prior?.attempts||0);
   if(attempts>=2)throw Object.assign(Error('Source task attempt limit reached'+(prior?.error?' ('+prior.error+')':'')),{code:'TASK_LIMIT'});
   // Grounded contact search owns a 25s deadline. Do not dispatch it into the
   // final seconds of a slice where it cannot return and save a receipt.
   const independentWindow=services.independent?Number(services.independentMinimumMs)||0:30000;
   if(kind==='independent'&&windowMs-(clock()-start)<independentWindow)throw Object.assign(Error('Independent check deferred to the next processing slice'),{code:'TIME_BUDGET'});
   // Each finite phase owns its task allowance. Retained official/dossier
   // receipts are reusable evidence, not admissions against the contact plan.
   const count=await stmt(env,'SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND phase=?',row.id,phase).first();if(!prior&&Number(count?.n)>=384)throw Object.assign(Error('Research task budget reached'),{code:'TASK_LIMIT'});
   const reserved=await scopedWrite(args=>stmt(env,`INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts) SELECT ?,?,?,?,?,'running',1 WHERE ${writeGuard} ON CONFLICT(job_id,task_key) DO UPDATE SET attempts=?,status='running',updated_at=CURRENT_TIMESTAMP WHERE (buyer_research_tasks.status='running' OR attempts<2) AND ${writeGuard}`,row.id,key,kind,phase,String(value).slice(0,4000),...args,attempts+1,...args));
   if(!reserved.meta.changes)throw lost();
   try{
    const result=await operation();await guard();if(jsonSize(result)>160000)throw Error('Source task response exceeds bounded storage');
    const saved=await scopedWrite(args=>stmt(env,`UPDATE buyer_research_tasks SET status='complete',result_json=?,error='',updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND task_key=? AND ${writeGuard}`,JSON.stringify(result),row.id,key,...args));
    if(!saved.meta.changes)throw lost();changed++;return result;
   }catch(error){
    // Do not let an expired, canceled or revoked worker record a late receipt.
    if(accepting&&!controller.signal.aborted&&!['TIME_BUDGET','LEASE_EXPIRED','CANCELED','CONTEXT_CHANGED'].includes(error.code))await stmt(env,`UPDATE buyer_research_tasks SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND task_key=? AND ${writeGuard}`,errorReason(error,kind),row.id,key,row.id,lease,clock(),contextVersion).run();
    throw error;
   }
  };
  // Reserve a bounded task before dispatch. Its guards still enforce time,
  // lease and identity while the reserved query room permits receipt saving.
  const executeTask=async(kind,value,operation)=>{
   if(invocationBudget&&!invocationBudget.admit(64)){invocationExhausted=true;throw Object.assign(Error('Shared invocation query budget reached; saved work will continue'),{code:'TIME_BUDGET'});}
   activeTaskReservations++;
   try{return await executeTaskBody(kind,value,operation);}
   finally{activeTaskReservations--;invocationBudget?.release(64);}
  };
  const task=(kind,value,operation)=>{const key=kind+'|'+value;if(inflightTasks.has(key))return inflightTasks.get(key);const pending=executeTask(kind,value,operation);inflightTasks.set(key,pending);pending.finally(()=>{if(inflightTasks.get(key)===pending)inflightTasks.delete(key);}).catch(()=>{});return pending;};
  const search=async query=>restoreSearch(await task('search',query,async()=>{
   let rows;try{rows=await nativeSearch(query,{signal:controller.signal,diversify:Boolean(input.recheck&&Object.values(input.recheck.plans).some(plan=>plan.queries.includes(query)))});}catch(error){if(services.search)for(const entry of error.researchTrace||[])observe(entry);throw error;}
   if(!Array.isArray(rows))throw Error('Search response is invalid');
   if(services.search){const trace=rows.researchTrace||[];if(trace.length)trace.forEach(observe);else for(const provider of new Set([...(rows.searchProviders||[]),...rows.map(r=>r.searchProvider||r.buyerSource)].filter(Boolean)))observe({provider,operation:'search',status:'succeeded',results:rows.length});}
   const normalized=rows.slice(0,8).map(r=>({url:C.url(r.url),title:String(r.title||'').slice(0,400),description:String(r.description||r.text||'').slice(0,1800),markdown:String(r.markdown||r.content||'').slice(0,6000),evidenceKind:r.evidenceKind||'search_excerpt',buyerSource:r.buyerSource,searchProvider:r.searchProvider,...(r.sourceRead===true?{sourceRead:true,extractedAt:r.extractedAt||new Date().toISOString()}:{}),...(r.metadata?{metadata:{sourceURL:r.metadata.sourceURL,url:r.metadata.url,statusCode:r.metadata.statusCode}}:{})})).filter(r=>r.url);
   return {rows:normalized,providers:rows.searchProviders||[],researchTrace:rows.researchTrace||[]};
  }));
  const read=async url=>task('read',C.url(url),async()=>{
   let raw;try{raw=await (services.read||((url,signal)=>readPublicBuyerPage(env,row.workspace_id,url,{signal,totalTimeoutMs:18000,directTimeoutMs:3000,firecrawlTimeoutMs:12000})))(url,controller.signal);}catch(error){for(const entry of error.researchTrace||[])observe(entry);throw error;}
   const page=raw?.data||raw||{};
   if(raw?.success===false||page.error||Number(page.metadata?.statusCode)>=400)throw Error('Source read unavailable');
   const supplied=[page.url,page.metadata?.sourceURL,page.metadata?.url].filter(v=>v!==undefined&&v!==null).map(C.url),actual=supplied[0]||C.url(url),text=String(page.markdown||page.content||page.text||'').slice(0,60000);
   if(!actual||!D.buyerSourceReadLocation(candidate,url,page,{move:true})||!text.trim())throw Error('Source read empty or attribution metadata conflicts');
   const trace=page.researchTrace||raw.researchTrace||[];if(trace.length)trace.forEach(observe);else{const provider=({'direct-fallback':'direct','scrapling-fallback':'scrapling',firecrawl:'firecrawl'})[page.metadata?.source];if(provider)observe({provider,operation:'extract',status:'succeeded',results:1});}
   return readProjection({url:actual,markdown:text,links:Array.isArray(page.links)?page.links.slice(0,100):[],metadata:{sourceURL:actual,statusCode:200,source:page.metadata?.source||'unknown'},researchTrace:page.researchTrace||raw.researchTrace||[],sourceRead:true,extractedAt:new Date().toISOString()},url);
  });
  const allRows=async()=>{
   // Read bodies own factual attribution. A large search index must not evict
   // the completed company/staff pages merely because task hashes sort first.
   const tasks=await stmt(env,"SELECT kind,request_value,result_json FROM buyer_research_tasks WHERE job_id=? AND status='complete' AND kind IN ('read','search') ORDER BY CASE kind WHEN 'read' THEN 0 ELSE 1 END,updated_at DESC LIMIT 160",row.id).all();
   return tasks.results.flatMap(r=>{const value=parse(r.result_json);return r.kind==='read'?[readProjection(value,r.request_value)]:r.kind==='search'?value.rows||[]:[];}).slice(0,160);
  };
  const reassessRoles=(people=candidate.people||[])=>{if(candidate.buyerRolesChanged&&D.canReassessSavedBuyerRoles(candidate,people,input.profile))candidate.buyerRolesChanged=false;};
  const confirmNamed=()=>{
   reassessRoles();
   for(const person of candidate.people||[]){const email=D.acceptedOfficialBuyerEmail(candidate,person);if(email)person.publicEmailSourceCheck={version:2,status:'confirmed',email,url:person.publicEmailUrl,checkedAt:person.publicEmailEvidence.checkedAt};}
  };
  let acquiredRows=[];
  const acquirePeople=()=>{
   if(acquiredRows.length){candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),companyContacts:D.discoverCompanyContacts(acquiredRows,candidate,candidate.buyerDiscovery?.companyContacts||[])};candidate.people=D.matchPublicBuyerDetails(candidate.people||[],acquiredRows,candidate.domain,candidate.company);}
   const sources=candidate.buyerDiscovery?.companyContacts||[],dossier=C.buyers(candidate.buyerDiscovery?.companyDossier,candidate.company);
   const merged=D.mergeBuyerPool([...(candidate.buyerDiscovery?.pool||[]),...(candidate.people||[])],[...sources,...dossier],input.profile);
   const reconciled=D.reconcileBuyerEvidence({...candidate,people:merged},{trustedAgentSources:true});candidate.buyerDiscovery=reconciled.buyerDiscovery;candidate.publicResearch=reconciled.publicResearch;
   reassessRoles(merged);
   candidate.people=D.retainBuyerIdentities(reconciled.people,input.profile,candidate).filter(person=>input.scope!=='selected_buyers'||input.personIds.includes(String(person.id))).slice(0,10);
   candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),pool:reconciled.people.slice(0,30),opportunityRoles:input.roles};confirmNamed();
  };
  const diagnostics=parse(row.diagnostic_json,[]);
  if(rescopeOfficial)diagnostics.push({phase:'official',reason:'Resuming the contact-source objective after a legacy financial-archive limit; completed source tasks retained',at:new Date().toISOString()});
  const settleQuality=async()=>{
   const quality=input.paidResearch?(await publicBuyerJob(env,{...row,result_json:JSON.stringify(candidate)})).quality:D.buyerQualityAssessment(candidate,{confirmedEmail:p=>D.acceptedOfficialBuyerEmail(candidate,p)});
   const scopedComplete=input.scope==='selected_buyers'&&quality.researchPassed&&quality.aiReviewStatus==='complete'&&!(candidate.publicResearch.conflicts||[]).length;
   status=(quality.passed||scopedComplete)&&(!input.paidResearch||['complete','disabled'].includes(candidate.publicResearch?.paidResearch?.status))?'complete':'needs_review';
   if(status==='needs_review')diagnostics.push({phase:'quality',reason:quality.gaps.join(' · ').slice(0,600),at:new Date().toISOString()});
  };
  let status='queued';
  try{
   await guard();const context=await workspaceBuyerContext(env,row.workspace_id);if(context.hash!==input.workspaceContext)throw Object.assign(Error('The seller context changed'),{code:'CONTEXT_CHANGED'});
   const rows=await allRows(),phaseStart=clock(),remaining=Math.max(1000,windowMs-(clock()-start)-500);
   if(phase==='official'){
    await D.runOfficialContactResearch(candidate,{rows,search,readPage:read,signal:controller.signal,guard,force:false,maxDurationMs:Math.min(remaining,180000),seedUrls:(candidate.people||[]).flatMap(p=>[p.publicNameUrl,p.publicEmailUrl,p.publicPhoneUrl]).filter(url=>D.canonicalDomain(url)===candidate.domain),onCheckpoint:acquirePeople});acquiredRows=(await allRows()).filter(r=>r.sourceRead===true);acquirePeople();
    if(D.officialContactCoveragePassed(candidate)||Number(phaseRuns)>=2&&!changed)phase=nextPhase[phase];
   }else if(phase==='dossier'){
    try{
     const plan=D.buyerResearchPlan(candidate,input.profile);
     const result=await (services.dossier||researchWorkspaceDossier)(env,row.workspace_id,{company:candidate.company,domain:row.domain,seller:parse(D.buyerFitContext(input.profile)),roles:input.roles,formulas:plan.dossierFormulas,opportunity:candidate.buyerFit?.purchase||candidate.fitDescription||'',incremental:true},{signal:controller.signal,guard,readSource:read,authorization:{userId:row.requested_by,sessionTokenHash:row.session_hash},writeAuthority:()=>({sql:writeGuard,args:[row.id,lease,clock(),contextVersion]}),providerTimeoutMs:Math.min(remaining,180000)});
     candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),companyDossier:result};acquirePeople();
     if(result.status==='complete'||result.continuation===false){if(result.status!=='complete')diagnostics.push({phase,reason:'Bounded dossier attempt incomplete; continuing contact research with its evidence gaps retained',at:new Date().toISOString()});phase=nextPhase[phase];}
    }catch(error){if(error.code==='CANCELED'||error.code==='CONTEXT_CHANGED'||controller.signal.aborted)throw error;diagnostics.push({phase,reason:errorReason(error,phase),at:new Date().toISOString()});phase=nextPhase[phase];}
   }else if(phase==='identities'){
    if(input.scope==='selected_buyers'){phase=nextPhase[phase];}else{
    const plan=D.buyerResearchPlan(candidate,input.profile);
    for(const query of plan.queries.slice(0,6)){await guard();try{await search(query);}catch(error){if(error.code==='CANCELED'||controller.signal.aborted)throw error;}}
    const trace=D.tracePublicBuyers(await allRows(),candidate.company,input.profile);candidate.people=D.retainBuyerIdentities(D.mergeBuyerPool(candidate.people||[],trace.people,input.profile),input.profile,candidate).slice(0,10);acquirePeople();phase=nextPhase[phase];}
   }else if(phase==='contacts'){
    if(candidate.people?.length){
     scheduledContactWork=true;report=await D.runMandatoryBuyerResearch(candidate,{search,readPage:read,rows,guard,signal:controller.signal,recheckPlans:input.recheck?.plans,maxDurationMs:Math.min(remaining,input.recheck?Math.max(1,input.recheck.maxActiveMs-phaseMs):180000),observeTools:false,buyerAgentContext:D.buyerAgentContext(candidate,input.profile),accountability:report,crossCheck:async person=>task('independent',JSON.stringify([person.id,person.name,person.title,...(services.independent?[]:['grounded-low-v1'])]),async()=>{let result;try{result=await (services.independent?services.independent(person,controller.signal):searchWorkspaceBuyerContact(env,row.workspace_id,{company:candidate.company,domain:row.domain,person,signal:controller.signal}));}catch(error){observe({provider:'gemini',operation:'search',status:'failed',reason:'Independent research unavailable'});throw error;}if(result.status==='not_configured'||result.status==='unavailable'&&/not configured/i.test(result.reason||'')){observe({provider:'gemini',operation:'search',status:'skipped',reason:'Independent provider not configured'});return {...result,status:'not_configured'};}if(result.status!=='complete'||result.web_search===false){observe({provider:'gemini',operation:'search',status:'failed',reason:'Independent research unavailable'});throw Error('Independent research unavailable');}observe({provider:result.provider||'gemini',operation:'search',status:'succeeded',results:result.results?.length||0});return result;})});
     confirmNamed();
     const retryable=report.status!=='complete'&&!changed&&report.stopReason!=='time_budget'?(await stmt(env,"SELECT task_key FROM buyer_research_tasks WHERE job_id=? AND phase='contacts' AND status<>'complete' AND (status='running' OR attempts<2)",row.id).all()).results.filter(task=>contactTasks.has(task.task_key)).length:0;
     if(report.status==='complete'||!changed&&report.stopReason!=='time_budget'&&!retryable)phase=nextPhase[phase];
    }else{diagnostics.push({phase,reason:'No complete buyer identities were supported by the available sources',at:new Date().toISOString()});phase=nextPhase[phase];}
   }else if(phase==='review'){
    const supplied=D.safeBuyerReviewEvidence(D.buyerSupervisorEvidence(candidate.people,rows));candidate.publicResearch.reviewEvidence=supplied;
    candidate.publicResearch.buyerAgent=D.assessBuyerAgent(candidate,rows,D.buyerAgentContext(candidate,input.profile));
    const signature=D.buyerReviewSignature(candidate),body={company:candidate.company,buyerAgent:candidate.publicResearch.buyerAgent,people:candidate.people.map(p=>({id:p.id,name:p.publicName||p.name,role:p.title,employer:p.organization,email:p.publicEmail,email_source:p.publicEmailUrl,linkedin:p.publicLinkedinUrl||p.linkedin_url,checks:p.contactResearch?.checks})),evidence:supplied,quality:{depth:D.BUYER_CONTACT_RESEARCH_POLICY.version,research_status:report.status,checked_people:report.checkedPeople,official_pages:report.officialPages}};
    const review=await (services.review||reviewWorkspaceBuyerEvidence)(env,row.workspace_id,body,{signal:controller.signal,userId:row.requested_by,maxDurationMs:Math.min(45000,remaining)});await guard();
    candidate.publicResearch.aiReview=D.safeBuyerAiReview({status:review.supervisor?.status||'unavailable',provider:review.provider||'none',checkedAt:new Date().toISOString(),inputSignature:signature,reviewedPersonIds:review.supervisor?.reviewedPersonIds,findings:review.supervisor?.findings,summary:review.summary,reason:review.reason,conflicts:review.conflicts});
    candidate.publicResearch.conflicts=review.conflicts||[];phase=input.paidResearch?'paid':'done';
   }else if(phase==='paid'){
    if(deferSemanticStamp&&sourceScopeChanged){
     diagnostics.push({phase,reason:'Holding the original paid scope until guarded recovery completes the current free source plan',at:new Date().toISOString()});phase='done';
    }else{
    const member=await stmt(env,'SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?',row.workspace_id,row.requested_by).first();
    const paidGuard=async()=>guard();paidGuard.writeAuthority=()=>({sql:writeGuard,args:[row.id,lease,clock(),contextVersion]});
    const finished=await runBuyerPaidResearch(env,{workspaceId:row.workspace_id,userId:row.requested_by,role:member?.role},candidate,{intent:input.paidResearch,jobId:row.id,guard:paidGuard,signal:controller.signal,lookup:services.paidLookup});
    if(finished)phase='done';
    }
   }
   if(invocationExhausted){phase=row.phase;throw Object.assign(Error('Shared invocation query budget reached; saved work will continue'),{code:'TIME_BUDGET'});}
   await guard();phaseMs+=Math.max(1,clock()-phaseStart);phaseRuns=phase==='contacts'&&changed>0?0:phaseRuns+1;
   if(phase===row.phase&&(phaseExhausted(phase,phaseMs,phaseRuns)||input.recheck&&phase==='contacts'&&phaseMs>=input.recheck.maxActiveMs)){
    diagnostics.push({phase,reason:'Phase work budget reached; completed evidence retained',at:new Date().toISOString()});phase=nextPhase[phase];
   }
   if(phase!==row.phase){phaseMs=0;phaseRuns=0;}
   if(phase==='done')await settleQuality();
  }catch(error){
   const phaseAdvanced=phase!==row.phase;
   if(phaseAdvanced){phaseMs=0;phaseRuns=0;}
   if(error.code==='CANCELED'||error.code==='CONTEXT_CHANGED')status='canceled';
   else if(error.code==='LEASE_EXPIRED')status='queued';
   else if(controller.signal.aborted||error.code==='TIME_BUDGET'){status='queued';if(!phaseAdvanced){phaseMs+=Math.max(1,clock()-start);phaseRuns=phase==='contacts'&&changed>0?0:phaseRuns+1;if((phaseExhausted(phase,phaseMs,phaseRuns)||input.recheck&&phase==='contacts'&&phaseMs>=input.recheck.maxActiveMs)){diagnostics.push({phase,reason:'Phase time budget reached; saved work retained',at:new Date().toISOString()});phase=nextPhase[phase]||'done';phaseMs=0;phaseRuns=0;}}}
   else{status='needs_review';diagnostics.push({phase,reason:errorReason(error,phase),at:new Date().toISOString()});}
  }finally{
   accepting=false;clearTimeout(timer);controller.abort();
   // Count only actual completed read tasks in this job, including the official
   // phase before person research starts. Retained history is not a new read.
   const completedReads=(await allRows()).filter(r=>r.sourceRead===true&&D.canonicalDomain(r.url)===row.domain);
   report.officialPageReads=[...new Map([...(report.officialPageReads||[]),...completedReads.map(r=>({url:r.url,sourceRead:true,checkedAt:r.extractedAt}))].map(r=>[r.url,r])).values()].slice(0,120);
   report.officialPages=report.officialPageReads.length;
   candidate.publicResearch.accountability=report;candidate.publicResearch.officialPages=report.officialPages;
   if(status==='queued'&&phase==='done')await settleQuality();
   candidate.peopleStatus=candidate.people?.length?'complete':status==='queued'?'loading':'empty';
   candidate.publicContactStatus=['queued','running'].includes(status)?'loading':status==='complete'?'complete':'error';
   candidate.publicContactVersion='20261021-adaptive-depth-v3';
   let updated;
   try{updated=await scopedWrite(args=>stmt(env,`UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.executionContinuationVersion',?,'$.contactSchedulingVersion',?),status=?,phase=?,phase_ms=?,phase_runs=?,result_json=?,diagnostic_json=?,last_error='',lease_token=NULL,lease_until=0,next_at=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND lease_until>? AND status='running' AND ${authoritySql} AND COALESCE((SELECT version FROM customer_workspace_state WHERE workspace_id=buyer_research_jobs.workspace_id),0)=?`,deferSemanticStamp?Number(input.executionContinuationVersion||0):4,scheduledContactWork?1:Number(input.contactSchedulingVersion||0),status,phase,phaseMs,phaseRuns,JSON.stringify(candidate),JSON.stringify(diagnostics.slice(-20)),clock(),...args),true);}
   catch(error){
    updated={meta:{changes:0}};
    if(storageFailure(error)){status='needs_review';updated=await stmt(env,`UPDATE buyer_research_jobs SET status='needs_review',last_error='Workspace storage is full. Completed evidence is preserved; free space and resume.',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running'`,row.id,lease).run();}
    else if(['CANCELED','CONTEXT_CHANGED'].includes(error.code))status='canceled';
   }
   // Revocation cannot authorize a result write; only settle the stale job metadata.
   if(!updated.meta.changes)await stmt(env,"UPDATE buyer_research_jobs SET status=?,lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running'",status==='canceled'?'canceled':'queued',row.id,lease).run();
   results.push({id:row.id,status:updated.meta.changes?status:'discarded',phase,completedTasks:changed});
  }
  }finally{invocationBudget?.release(160);}
 }
 return results;
}
