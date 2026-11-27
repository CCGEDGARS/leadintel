import {checkFreeEmails} from './firecrawl-buyer-email.js';
import {websiteStaffCards} from './website-contact-staff.js';
import {savedFastResearch} from './fast-research-evidence.js';
import {planBuyerSearch} from './buyer-search-plan.js';
import {buyerRunWindow,BUYER_RUN_WINDOW_REASON} from './buyer-research-window.js';
import {allowFullResearch} from './research-strategy.js';
import {stmt,parse,authoritySql,standaloneBuyerDiscovery,lost,workspaceBuyerContext,readBuyerJob,publicBuyerJob,recoverInterruptedContactJob} from './buyer-research-store.js';
import {runBuyerPaidResearch,workEmailSearchComplete,PAID_PRIORITY_RESEARCH_REQUIRED} from './buyer-paid-research.js';
import {storageFailure} from './workspace-storage.js';
import {loadBuyerContactContext} from './buyer-contact-context.js';
import {sha256} from './security.js';
import {researchWorkspaceDossier} from './company-dossier.js';
import {findPublicBuyerContactPages,searchManagementIndex} from './website-management.js';
import {createBuyerSourceSearch,searchPublicPeople} from './buyer-source-search.js';
import {unheldProfilePeople,unresolvedProfileUrls,publicPeopleQueries,publicPeopleCountry,isPublicProfileRow,collapseSameRecords} from './public-profile-people.js';
import {PERPLEXITY_MAX_RESULTS} from './perplexity-request.js';
import {buyerCreditWindowKey,buyerCreditLimitFor,createBuyerCreditMeter,readBuyerCredits} from './buyer-research-credits.js';
import {fetchDirectPublicPage,readPublicBuyerPage,searchWorkspaceApolloPeople,requireWorkspaceServiceCredential} from './service-integrations.js';
import {discoverApolloBuyerIdentities} from './buyer-apollo-discovery.js';
import {reviewWorkspaceBuyerEvidence,searchWorkspaceBuyerContact} from './ai-routes.js';
import {lookupCompanyManagement,registerManagementPage} from './company-registry.js';
import '../../customer/discovery-engine.js';
import '../../customer/company-dossier.js';
const D=globalThis.LeadIntelDiscovery,C=globalThis.LeadIntelCompanyDossier;
const phaseBudget={official:180000,dossier:360000,identities:90000,contacts:180000,review:45000,paid:360000};
// The public engine's 180s deadline bounds one pass. Scheduler slices resume
// that same finite task plan; their accumulated wall time is not completion.
const phaseExhausted=(phase,ms,runs)=>runs>=18||(!['official','contacts'].includes(phase)&&ms>=phaseBudget[phase]);
const standardPhaseOrder={official:'dossier',dossier:'identities',identities:'contacts',contacts:'review',review:'paid',paid:'done'};
const errorReason=(error,phase)=>`${phase}: ${error?.name==='TimeoutError'?'provider deadline reached':/\((?:4|5)\d{2}\)/.test(error?.message||'')?'provider HTTP '+error.message.match(/\((\d{3})\)/)[1]:error?.code==='TIME_BUDGET'||error?.name==='AbortError'?'time budget reached':error?.status===401||error?.status===403?'authorization changed':/limit|budget/i.test(error?.message||'')?'bounded work limit reached':'provider or source unavailable'}`;
const jsonSize=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
const resultRows=result=>Array.isArray(result)?result:result?.results||[];
const searchRows=(rows,limit=8)=>rows.slice(0,limit).map(r=>({url:C.url(r.url),title:String(r.title||'').slice(0,400),description:String(r.description||r.text||'').slice(0,1800),markdown:String(r.markdown||r.content||'').slice(0,6000),evidenceKind:r.evidenceKind||'search_excerpt',buyerSource:r.buyerSource,searchProvider:r.searchProvider,...(r.sourceRead===true?{sourceRead:true,extractedAt:r.extractedAt||new Date().toISOString()}:{}),...(r.metadata?{metadata:{sourceURL:r.metadata.sourceURL,url:r.metadata.url,statusCode:r.metadata.statusCode}}:{})})).filter(r=>r.url);
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
  const adoptLegacyJob=input.peopleFirst==null&&!input.paidResearch&&standaloneBuyerDiscovery(input);
  if(adoptLegacyJob){input.peopleFirst=true;input.freeDiscovery=true;}
  if(input.fullResearch){input.freeDiscovery=false;input.meteredPublicResearchApproved=true;}
  const siteOnly=input.freeDiscovery===true;
  const freeContactChecks=siteOnly&&input.publicContactChecks===true;
  const allowedFreePhase=phase=>['official','identities'].includes(phase)||freeContactChecks&&phase==='contacts';
  const peopleFirst=input.peopleFirst&&standaloneBuyerDiscovery(input);
  const nextPhase=input.fullResearch?{...standardPhaseOrder,official:'identities',identities:'dossier',dossier:'contacts',review:'done'}:peopleFirst?{...standardPhaseOrder,official:'identities',identities:'contacts',contacts:input.dossierPassFinished?'review':'dossier',dossier:'review'}:standardPhaseOrder;
  const {contactOptions}=await loadBuyerContactContext(env,{workspaceId:row.workspace_id},reconciledCandidate);
  // A stale legacy paid slice first settles through the existing paid evidence
  // gate. Keep it eligible for terminal recovery, which captures its original
  // own-CRM scope before a fresh review changes that scope.
  const officialPlan=reconciledCandidate.buyerDiscovery?.officialContactInventory?.research,sourceScopeChanged=row.phase!=='official'&&officialPlan&&officialPlan.status!=='complete'&&officialPlan.discoveryScope!==D.OFFICIAL_CONTACT_RESEARCH_POLICY.scopeVersion;
  const deferSemanticStamp=row.phase==='paid'&&(sourceScopeChanged||Number(input.executionContinuationVersion||0)<4&&(originalCandidate.publicResearch?.aiReview?.inputSignature!==D.buyerReviewSignature(reconciledCandidate)||!D.buyerResearchCoveragePassed(reconciledCandidate,{contactOptions})));
  const candidate=deferSemanticStamp?originalCandidate:reconciledCandidate,controller=new AbortController();let invocationExhausted=false,activeTaskReservations=0,accepting=true,phase=row.phase,phaseMs=row.phase_ms,phaseRuns=row.phase_runs,changed=0,contextVersion=-1;
  const rescopeOfficial=sourceScopeChanged&&!deferSemanticStamp&&!input.recheck;
  if(adoptLegacyJob||siteOnly&&!allowedFreePhase(phase)){phase=row.phase='official';phaseMs=0;phaseRuns=0;}
  if(rescopeOfficial){phase=row.phase='official';phaseMs=0;phaseRuns=0;}
  const runWindow=buyerRunWindow(row,input,clock()),windowPause=()=>Object.assign(Error(BUYER_RUN_WINDOW_REASON),{code:'RUN_WINDOW'});
  const timer=setTimeout(()=>controller.abort(runWindow.remainingMs<=windowMs?windowPause():Object.assign(Error('Job processing slice ended'),{code:'TIME_BUDGET'})),Math.max(1,Math.min(windowMs,runWindow.remainingMs)));
  const guard=async({checkpoint=false}={})=>{
   if(!checkpoint&&!activeTaskReservations&&invocationBudget&&!invocationBudget.hasRoom(32)){invocationExhausted=true;throw Object.assign(Error('Shared invocation query budget reached; saved work will continue'),{code:'TIME_BUDGET'});}
   if(!checkpoint&&(runWindow.expired||clock()>=Date.parse(runWindow.deadlineAt)))throw windowPause();
   if(!checkpoint&&(!accepting||controller.signal.aborted))throw Object.assign(Error('Processing slice stopped'),{code:'TIME_BUDGET'});
   const live=await stmt(env,`SELECT status,lease_token,lease_until,CASE WHEN ${authoritySql} THEN 1 ELSE 0 END authorized FROM buyer_research_jobs WHERE id=?`,row.id).first();
   if(!live||live.status!=='running'||live.lease_token!==lease||!live.authorized)throw lost();
   if(live.lease_until<=clock())throw Object.assign(Error('Processing lease expired'),{code:'LEASE_EXPIRED'});
   const version=Number((await stmt(env,'SELECT version FROM customer_workspace_state WHERE workspace_id=?',row.workspace_id).first())?.version)||0;
   if(contextVersion!==version){const context=await workspaceBuyerContext(env,row.workspace_id,input.taskId);if(context.hash!==input.workspaceContext)throw Object.assign(Error('The seller context changed'),{code:'CONTEXT_CHANGED'});contextVersion=context.version;}
  };
  const writeGuard=`EXISTS(SELECT 1 FROM buyer_research_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>? AND ${authoritySql} AND COALESCE((SELECT version FROM customer_workspace_state WHERE workspace_id=buyer_research_jobs.workspace_id),0)=?)`;
  const current=async(checkpoint=false)=>{await guard({checkpoint});return [row.id,lease,clock(),contextVersion];};
  let scheduledContactWork=false,paidContinuation=null,apolloIdentityChecked=Number(input.apolloIdentityVersion||0)>=1;
  input.apolloIdentityReceipts=Array.isArray(input.apolloIdentityReceipts)?input.apolloIdentityReceipts.slice(0,4):[];
  let report=candidate.publicResearch?.accountability||D.createBuyerResearchAccountability();candidate.publicResearch={...(candidate.publicResearch||{}),accountability:report,researchScope:input.scope,researchedPersonIds:input.personIds};
  const observe=entry=>D.recordBuyerResearchTool(report,entry);
  // What this job's own Firecrawl requests cost is counted per run window (one explicit start or resume).
  // When the window has reached what a company of this size usually needs, the next Firecrawl request is refused
  // and the slice ends as a pause (stage 2). A count that cannot be read holds nothing back.
  const creditWindow=buyerCreditWindowKey(row,input);let creditSpent=0;
  try{creditSpent=(await readBuyerCredits(env,row.id,creditWindow)).window.counted;}catch{ /* counting never stops a job */ }
  const creditMeter=createBuyerCreditMeter(env,row.id,creditWindow,{spent:creditSpent,limit:()=>buyerCreditLimitFor(env,row.workspace_id,input.scope==='selected_buyers'?(input.personIds||[]).length:(candidate.people||[]).length),onLimit:error=>controller.abort(error)});
  const nativeSearch=freeContactChecks?((query,{signal})=>(services.publicIndex||searchManagementIndex)(query,AbortSignal.any([signal,AbortSignal.timeout(6000)]),fetchDirectPublicPage)):services.search||createBuyerSourceSearch(env,row.workspace_id,{guard,observe,signal:controller.signal,meter:creditMeter});
  const scopedWrite=async(build,checkpoint=false)=>{for(let attempt=0;attempt<3;attempt++){const args=await current(checkpoint),result=await build(args).run();if(result.meta.changes)return result;}throw lost();};
  let fastEvidence=null;
  const inflightTasks=new Map(),contactTasks=new Set();
  const readProjection=(value,requested)=>D.buyerSourceReadLocation(candidate,requested,value)?{...value,sourceRead:true}:{url:value.url,metadata:{sourceURL:value.metadata?.sourceURL,url:value.metadata?.url,statusCode:value.metadata?.statusCode},sourceRead:false};
  // Full research keeps a metered dispatch whose outcome is unknown and never sends it again.
  const retainsDispatch=value=>Boolean(input.fullResearch)&&!value.startsWith('Apollo people search')&&!value.startsWith('Free public index');
  const executeTaskBody=async(kind,value,operation,{phase:taskPhase=phase}={})=>{
   await guard();const key=await sha256(kind+'|'+value),prior=await stmt(env,'SELECT * FROM buyer_research_tasks WHERE job_id=? AND task_key=?',row.id,key).first();
   if(taskPhase==='contacts')contactTasks.add(key);
   if(prior?.status==='complete'){const result=parse(prior.result_json);return kind==='read'?{...readProjection(result,value),reused:true}:result;}
   if(kind==='read'&&fastEvidence?.pages.has(value))return {...readProjection(fastEvidence.pages.get(value),value),reused:true};
   if(kind==='search'&&fastEvidence?.index.has(value))return fastEvidence.index.get(value);
   // A worker that lost its lease after a metered dispatch cannot establish
   // whether the provider billed it. Keep that receipt for review.
   const potentiallyMetered=retainsDispatch(value);
   if(potentiallyMetered&&prior?.status==='running'){
    throw Object.assign(Error('A prior provider request has no confirmed outcome. Its dispatch was retained.'),{code:'UNCERTAIN_DISPATCH'});
   }
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
   const count=await stmt(env,'SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND phase=?',row.id,taskPhase).first();if(!prior&&Number(count?.n)>=384)throw Object.assign(Error('Research task budget reached'),{code:'TASK_LIMIT'});
   const reserved=await scopedWrite(args=>stmt(env,`INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts) SELECT ?,?,?,?,?,'running',1 WHERE ${writeGuard} ON CONFLICT(job_id,task_key) DO UPDATE SET attempts=?,status='running',updated_at=CURRENT_TIMESTAMP WHERE (buyer_research_tasks.status='running' OR attempts<2) AND ${writeGuard}`,row.id,key,kind,taskPhase,String(value).slice(0,4000),...args,attempts+1,...args));
   if(!reserved.meta.changes)throw lost();
   try{
    const result=await operation();await guard();if(jsonSize(result)>160000)throw Error('Source task response exceeds bounded storage');
    const saved=await scopedWrite(args=>stmt(env,`UPDATE buyer_research_tasks SET status='complete',result_json=?,error='',updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND task_key=? AND ${writeGuard}`,JSON.stringify(result),row.id,key,...args));
    if(!saved.meta.changes)throw lost();changed++;return result;
   }catch(error){
    // A refusal at the credit limit ends the whole slice as a pause, whoever raised it.
    if(error.code==='CREDIT_LIMIT'&&!controller.signal.aborted)controller.abort(error);
    // Do not let an expired, canceled or revoked worker record a late receipt.
    if(!potentiallyMetered&&accepting&&!controller.signal.aborted&&!['TIME_BUDGET','RUN_WINDOW','CREDIT_LIMIT','LEASE_EXPIRED','CANCELED','CONTEXT_CHANGED'].includes(error.code))await stmt(env,`UPDATE buyer_research_tasks SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND task_key=? AND ${writeGuard}`,errorReason(error,kind),row.id,key,row.id,lease,clock(),contextVersion).run();
    throw error;
   }
  };
  // Reserve a bounded task before dispatch. Its guards still enforce time,
  // lease and identity while the reserved query room permits receipt saving.
  const executeTask=async(kind,value,operation,options)=>{
   if(invocationBudget&&!invocationBudget.admit(64)){invocationExhausted=true;throw Object.assign(Error('Shared invocation query budget reached; saved work will continue'),{code:'TIME_BUDGET'});}
   activeTaskReservations++;
   try{return await executeTaskBody(kind,value,operation,options);}
   finally{activeTaskReservations--;invocationBudget?.release(64);}
  };
  const task=(kind,value,operation,options)=>{const key=kind+'|'+value;if(inflightTasks.has(key))return inflightTasks.get(key);const pending=executeTask(kind,value,operation,options);inflightTasks.set(key,pending);pending.finally(()=>{if(inflightTasks.get(key)===pending)inflightTasks.delete(key);}).catch(()=>{});return pending;};
  const search=async query=>restoreSearch(await task('search',query,async()=>{
   let rows;try{rows=await nativeSearch(query,{signal:controller.signal,diversify:Boolean(input.recheck&&Object.values(input.recheck.plans).some(plan=>plan.queries.includes(query))||input.recheck&&candidate.people.some(person=>D.buyerGmailResearchQueries(candidate,person).includes(query)))});}catch(error){if(services.search)for(const entry of error.researchTrace||[])observe(entry);throw error;}
   if(!Array.isArray(rows))throw Error('Search response is invalid');
   if(services.search){const trace=rows.researchTrace||[];if(trace.length)trace.forEach(observe);else for(const provider of new Set([...(rows.searchProviders||[]),...rows.map(r=>r.searchProvider||r.buyerSource)].filter(Boolean)))observe({provider,operation:'search',status:'succeeded',results:rows.length});}
   const normalized=searchRows(rows);
   return {rows:normalized,providers:rows.searchProviders||[],researchTrace:rows.researchTrace||[]};
  }));
  // B3, 26 Nov 2026: the company's public people queries, each on its own with the target's country bias, answered with
  // the workspace's own Perplexity key (live, five queries sharing one request's 20 results drifted to a namesake abroad).
  // Only metered Expand research reaches the phase that calls it; a workspace without the key sends nothing. Each answer
  // is a reusable task receipt that keeps only personal profile and directory person rows.
  const searchPeople=async()=>{
   const queries=publicPeopleQueries(candidate,input.roles||[],{D});if(!queries.length)return;
   let lookup=services.peopleSearch;
   if(!lookup){
    let credential;try{credential=await requireWorkspaceServiceCredential(env,row.workspace_id,'perplexity');}catch{return;}
    if(!credential?.apiKey)return;
    const country=publicPeopleCountry(candidate.market);
    lookup=(query,signal)=>searchPublicPeople(env,row.workspace_id,query,{credential,country,observe,signal});
   }
   for(const query of queries){
    try{await task('search','Public people · '+query,async()=>{const found=await lookup(query,controller.signal);return {rows:searchRows((Array.isArray(found)?found:[]).filter(isPublicProfileRow),PERPLEXITY_MAX_RESULTS),providers:['perplexity']};});}
    catch(error){if(error.code==='CANCELED'||controller.signal.aborted)throw error;}
   }
  };
  const read=async url=>task('read',C.url(url),async()=>{
   let raw;try{raw=await (services.read||(siteOnly?((url,signal)=>fetchDirectPublicPage(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])})):null)||((url,signal)=>readPublicBuyerPage(env,row.workspace_id,url,{signal,totalTimeoutMs:18000,directTimeoutMs:3000,firecrawlTimeoutMs:12000,preferFirecrawl:input.fullResearch&&D.canonicalDomain(url)===row.domain,meter:creditMeter})))(url,controller.signal);}catch(error){for(const entry of error.researchTrace||[])observe(entry);throw error;}
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
   const tasks=await stmt(env,"SELECT kind,request_value,result_json FROM buyer_research_tasks WHERE job_id=? AND status='complete' AND kind IN ('read','search') AND (kind='read' OR json_type(result_json,'$.rows')='array') ORDER BY CASE kind WHEN 'read' THEN 0 ELSE 1 END,updated_at DESC LIMIT 160",row.id).all();
   const savedRows=tasks.results.flatMap(r=>{const value=parse(r.result_json);return r.kind==='read'?[readProjection(value,r.request_value)]:r.kind==='search'?value.rows||[]:[];});
   const existing=new Set(savedRows.filter(r=>r.sourceRead).map(r=>r.url));
   return [...(fastEvidence?.pages.values()||[])].filter(r=>!existing.has(r.url)).concat(savedRows).slice(0,200);
  };
  const reassessRoles=(people=candidate.people||[])=>{if(candidate.buyerRolesChanged&&D.canReassessSavedBuyerRoles(candidate,people,input.profile))candidate.buyerRolesChanged=false;};
  const confirmNamed=()=>{
   reassessRoles();
   for(const person of candidate.people||[]){const email=D.acceptedOfficialBuyerEmail(candidate,person);if(email)person.publicEmailSourceCheck={version:2,status:'confirmed',email,url:person.publicEmailUrl,checkedAt:person.publicEmailEvidence.checkedAt};}
  };
  let acquiredRows=[];
  const parsedBodies=new Map();
  const acquirePeople=()=>{
   const newPages=acquiredRows.filter(page=>page.markdown&&parsedBodies.get(page.url)!==page.markdown);
   for(const page of newPages)parsedBodies.set(page.url,page.markdown);
   if(newPages.length){candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),companyContacts:D.discoverCompanyContacts(newPages,candidate,candidate.buyerDiscovery?.companyContacts||[])};candidate.people=D.matchPublicBuyerDetails(candidate.people||[],acquiredRows,candidate.domain,candidate.company);}
   const sources=[...(candidate.buyerDiscovery?.companyContacts||[]),...newPages.filter(r=>r.sourceRead&&typeof r.markdown==='string'&&D.canonicalDomain(r.url)===candidate.domain).flatMap(page=>websiteStaffCards(page,candidate))],dossier=C.buyers(candidate.buyerDiscovery?.companyDossier,candidate.company);
   const merged=D.mergeBuyerPool([...(candidate.buyerDiscovery?.pool||[]),...(candidate.people||[])],[...sources,...dossier],input.profile);
   const reconciled=D.reconcileBuyerEvidence({...candidate,people:merged},{trustedAgentSources:true});candidate.buyerDiscovery=reconciled.buyerDiscovery;candidate.publicResearch=reconciled.publicResearch;
   reassessRoles(merged);
   candidate.people=D.retainBuyerIdentities(reconciled.people,input.profile,candidate).filter(person=>input.scope!=='selected_buyers'||input.personIds.includes(String(person.id))).slice(0,10);
   candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),pool:reconciled.people.slice(0,30),opportunityRoles:input.roles};confirmNamed();
  };
  const addIdentities=people=>{
   candidate.buyerDiscovery.pool=D.mergeBuyerPool(candidate.buyerDiscovery.pool||candidate.people||[],people,input.profile);
   acquirePeople();
  };
  const resolveDirectoryNames=async(searchSources,sourceRows)=>{
   const pending=(candidate.buyerDiscovery?.pool||[]).filter(person=>person.identitySource==='apollo'&&person.identityStatus==='pending');
   const relevant=D.selectDecisionMakers(pending,input.profile,4);
   if(!relevant.length)return;
   const resolved=await D.resolvePendingBuyerIdentities(relevant,sourceRows,candidate,input.profile,searchSources);
   await guard();
   const confirmed=resolved.people.filter(person=>person.identityStatus==='confirmed');
   if(confirmed.length)addIdentities(confirmed);
   candidate.buyerDiscovery.resultDiagnostics=[...(candidate.buyerDiscovery.resultDiagnostics||[]),...resolved.diagnostics].slice(-500);
  };
  const diagnostics=parse(row.diagnostic_json,[]);
  if(rescopeOfficial)diagnostics.push({phase:'official',reason:'Resuming the contact-source objective after a legacy financial-archive limit; completed source tasks retained',at:new Date().toISOString()});
  const settleQuality=async()=>{
   const quality=input.paidResearch?(await publicBuyerJob(env,{...row,result_json:JSON.stringify(candidate)})).quality:D.buyerQualityAssessment(candidate,{contactOptions});
   const scopedComplete=input.scope==='selected_buyers'&&quality.researchPassed&&quality.aiReviewStatus==='complete'&&!(candidate.publicResearch.conflicts||[]).length;
   if(input.paidResearch?.workEmailSearch){
    const completed=quality.aiReviewStatus==='complete'&&workEmailSearchComplete(candidate,input.paidResearch,contactOptions);
    status=completed?'complete':'needs_review';
    if(!completed)diagnostics.push({phase:'paid',reason:candidate.publicResearch?.paidResearch?.status==='blocked'?candidate.publicResearch.paidResearch.reason:'Work-email search finished with one or more unresolved buyer checks or addresses.',at:new Date().toISOString()});
    return;
   }
   status=(quality.passed||scopedComplete)&&(!input.paidResearch||['complete','disabled'].includes(candidate.publicResearch?.paidResearch?.status))?'complete':'needs_review';
   if(status==='needs_review')diagnostics.push({phase:'quality',reason:quality.gaps.join(' · ').slice(0,600),at:new Date().toISOString()});
  };
  let status='queued';
  try{
   await guard();const context=await workspaceBuyerContext(env,row.workspace_id,input.taskId);if(context.hash!==input.workspaceContext)throw Object.assign(Error('The seller context changed'),{code:'CONTEXT_CHANGED'});
   if(input.fullResearch||input.meteredPublicResearchApproved)await allowFullResearch(env,row.workspace_id);
   if(standaloneBuyerDiscovery(input)&&!input.paidResearch){
    fastEvidence=await savedFastResearch(env,row.workspace_id,candidate);
    if(fastEvidence?.pages.size&&!diagnostics.some(d=>d.code==='fast_evidence'&&d.jobId===fastEvidence.jobId)){
     diagnostics.push({phase,code:'fast_evidence',jobId:fastEvidence.jobId,reason:'Reused '+fastEvidence.pages.size+' saved Fast research pages',at:new Date().toISOString()});
    }
   }
   const rows=await allRows(),phaseStart=clock(),remaining=Math.max(1000,windowMs-(clock()-start)-500);
   if(fastEvidence?.staff?.length)addIdentities(fastEvidence.staff);
   if(fastEvidence?.pages.size||!candidate.people?.length&&rows.some(r=>r.sourceRead)){acquiredRows=rows.filter(r=>r.sourceRead);acquirePeople();}
    if(fastEvidence?.active&&input.fullResearch)throw Object.assign(Error('Waiting for Fast research to finish its source checks.'),{code:'FAST_RESEARCH_ACTIVE'});
   if(input.scope!=='selected_buyers'&&!apolloIdentityChecked&&['identities','contacts','review','paid'].includes(phase)){
    const before=new Set((candidate.people||[]).map(person=>person.id));
    const directory=await discoverApolloBuyerIdentities({candidate,profile:input.profile,task,guard,record:observe,observed:input.apolloIdentityReceipts,savedDirectory:fastEvidence?.directory,
      search:payload=>(services.apollo?services.apollo(payload,controller.signal,{workspaceId:row.workspace_id,userId:row.requested_by,guard}):searchWorkspaceApolloPeople(env,row.workspace_id,payload,{userId:row.requested_by,signal:controller.signal,guard,beforeDispatch:()=>{if(windowMs-(clock()-start)<15000)throw Object.assign(Error('Apollo discovery deferred to the next processing slice'),{code:'TIME_BUDGET'});}}))});
    apolloIdentityChecked=true;
    candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),pool:D.mergeBuyerPool(candidate.buyerDiscovery?.pool||candidate.people||[],directory.people,input.profile),
      resultDiagnostics:[...(candidate.buyerDiscovery?.resultDiagnostics||[]),...directory.diagnostics].slice(-500),providerStatus:{...(candidate.buyerDiscovery?.providerStatus||{}),identity:{status:directory.status,results:directory.results,accepted:directory.people.length}}};
    if(directory.people.length)acquirePeople();
    if(['review','paid'].includes(phase)&&(candidate.people||[]).some(person=>!before.has(person.id))){phase='contacts';phaseMs=0;phaseRuns=0;}
   }
   // The national business register names the registered management: independent company evidence for a
   // leadership role where the website names nobody. It runs once the official pages have been read (a number
   // printed on them identifies the company best). The answer is kept as a read receipt (the person's source)
   // and, only after that receipt is saved, as a marker in the candidate, so slices and resumes reuse it.
   // The step never fails the job: an outage or a refused receipt is retried once and then left.
   const register=candidate.buyerDiscovery?.registerManagement;
   // A register answer saved before it carried the company's city is asked once more for it (free).
   if(input.scope!=='selected_buyers'&&!['official','done'].includes(phase)&&(!register||register.status==='unavailable'&&Number(register.attempts)<2||register.status==='found'&&!register.city&&Number(register.attempts)<2)){
    const before=new Set((candidate.people||[]).map(person=>person.id)),sliceEnds=error=>controller.signal.aborted||['TIME_BUDGET','RUN_WINDOW','CREDIT_LIMIT','LEASE_EXPIRED','CANCELED','CONTEXT_CHANGED'].includes(error?.code);let answer,added=false;
    try{answer=await (services.registry||lookupCompanyManagement)({market:candidate.market,company:candidate.company,website:candidate.website||candidate.domain,pages:rows.filter(source=>source.sourceRead===true).map(source=>({url:source.url,text:String(source.markdown||'')}))},{signal:controller.signal});}
    catch(error){if(sliceEnds(error))throw error;answer={status:'unavailable'};}
    await guard();
    let outcome=['found','unsupported','ambiguous','not_found','protected'].includes(answer?.status)?answer.status:'unavailable';
    const page=outcome==='found'&&answer.active!==false?registerManagementPage(candidate.company,answer):{people:0},url=page.people?C.url(answer.source?.url):'';
    if(url)try{
     const receipt=await task('read',url,async()=>({url,markdown:page.markdown,links:[],sourceType:'registry',metadata:{sourceURL:url,statusCode:200,source:'registry'},sourceRead:true,extractedAt:new Date().toISOString()}),{phase:'official'});
     if(receipt?.sourceType==='registry')added=true;else outcome='unavailable';
    }catch(error){if(sliceEnds(error))throw error;outcome='unavailable';}
    // Asking a found register again only for its city never turns the saved answer into a failure.
    const cityOnly=register?.status==='found'&&outcome!=='found';
    candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),registerManagement:cityOnly?{...register,attempts:Number(register.attempts||0)+1}:{status:outcome,id:String(answer?.id||'').slice(0,40),people:added?page.people:0,attempts:Number(register?.attempts||0)+1,checkedAt:new Date().toISOString(),...(outcome==='found'&&answer?.city?{city:String(answer.city).slice(0,80)}:{})}};
    if(added){
     acquiredRows=(await allRows()).filter(source=>source.sourceRead===true);acquirePeople();
     if(['review','paid'].includes(phase)&&(candidate.people||[]).some(person=>!before.has(person.id))){phase='contacts';phaseMs=0;phaseRuns=0;}
    }
   }
   if(phase==='official'){
    await D.runOfficialContactResearch(candidate,{rows,search,readPage:read,signal:controller.signal,guard,peopleFirst,siteOnly,force:false,maxDurationMs:Math.min(remaining,180000),seedUrls:(candidate.people||[]).flatMap(p=>[p.publicNameUrl,p.publicEmailUrl,p.publicPhoneUrl]).filter(url=>D.canonicalDomain(url)===candidate.domain),onCheckpoint:({rows:checkpointRows})=>{if(checkpointRows.some(r=>r.sourceRead&&r.markdown&&parsedBodies.get(r.url)!==r.markdown)){acquiredRows=checkpointRows.filter(r=>r.sourceRead);acquirePeople();}}});acquiredRows=(await allRows()).filter(r=>r.sourceRead===true);acquirePeople();
    if(siteOnly||D.officialContactCoveragePassed(candidate)||Number(phaseRuns)>=2&&!changed)phase=nextPhase[phase];
   }else if(phase==='dossier'){
    if(candidate.buyerDiscovery?.companyDossier?.status==='complete'){phase=nextPhase[phase];}
    else if(phaseMs>=phaseBudget.dossier){diagnostics.push({phase,reason:'Company research time limit reached; continuing buyer checks with saved evidence',at:new Date().toISOString()});phase=nextPhase[phase];}
    else try{
     const plan=D.buyerResearchPlan(candidate,input.profile);
     const result=await (services.dossier||researchWorkspaceDossier)(env,row.workspace_id,{company:candidate.company,domain:row.domain,seller:parse(D.buyerFitContext(input.profile)),roles:input.roles,formulas:plan.dossierFormulas,opportunity:candidate.buyerFit?.purchase||candidate.fitDescription||'',incremental:true},{signal:controller.signal,guard,readSource:read,authorization:{userId:row.requested_by,sessionTokenHash:row.session_hash},writeAuthority:()=>({sql:writeGuard,args:[row.id,lease,clock(),contextVersion]}),providerTimeoutMs:Math.min(remaining,180000)});
     candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),companyDossier:result};acquirePeople();
     if(result.status==='complete'||result.continuation===false){if(result.status!=='complete')diagnostics.push({phase,reason:'Bounded dossier attempt incomplete; continuing contact research with its evidence gaps retained',at:new Date().toISOString()});phase=nextPhase[phase];}
    }catch(error){if(error.code==='CANCELED'||error.code==='CONTEXT_CHANGED'||controller.signal.aborted)throw error;diagnostics.push({phase,reason:errorReason(error,phase),at:new Date().toISOString()});phase=nextPhase[phase];}
   }else if(phase==='identities'){
    if(siteOnly){
     acquiredRows=(await allRows()).filter(source=>source.sourceRead===true);acquirePeople();
     const indexReport=await findPublicBuyerContactPages(candidate,{
      profile:input.profile,
      addIdentities,resolveDirectoryNames:searchSources=>resolveDirectoryNames(searchSources,acquiredRows),
      index:query=>task('search','Free public index | '+query,async()=>{
       const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(6000)]);
       const hits=await (services.publicIndex||searchManagementIndex)(query,signal,fetchDirectPublicPage);
       return {hits:hits.slice(0,8).map(hit=>({url:C.url(hit.url),title:String(hit.title||'').slice(0,250),description:String(hit.description||'').slice(0,550)}))};
      }),
      read,
      refresh:async()=>{acquiredRows=(await allRows()).filter(source=>source.sourceRead===true);acquirePeople();},
      interrupted:error=>controller.signal.aborted||['TIME_BUDGET','RUN_WINDOW','LEASE_EXPIRED','CANCELED','CONTEXT_CHANGED'].includes(error.code)
     });
     for(const person of candidate.people||[]){
      const published=D.gmailResearchMatches(person,candidate,acquiredRows);
      if(published.length)person.gmailMatches=[...new Map([...(person.gmailMatches||[]),...published].map(match=>[match.email,match])).values()].slice(0,8);
     }
     report.status='partial';
     if(freeContactChecks&&candidate.people?.length){
      phase='contacts';diagnostics.push({phase:'identities',reason:indexReport,at:new Date().toISOString()});
     }else{
      status='needs_review';diagnostics.push({phase,code:'free_discovery_finished',reason:indexReport,at:new Date().toISOString()});
     }
    }else if(input.scope==='selected_buyers'){phase=nextPhase[phase];}else{
    const plan=D.buyerResearchPlan(candidate,input.profile);
    let strategy=null;
    if(input.fullResearch)try{strategy=await task('independent','Full research query plan',async()=>{
     const options={candidate,profile:input.profile,queries:plan.queries,pages:rows,signal:controller.signal};
     try{return await (services.plan||planBuyerSearch)(env,row.workspace_id,options);}
     catch(error){
      if(controller.signal.aborted||['CANCELED','CONTEXT_CHANGED','LEASE_EXPIRED','TIME_BUDGET','RUN_WINDOW','CREDIT_LIMIT'].includes(error.code))throw error;
      await guard();
      return {queries:plan.queries.slice(0,3),findMorePeople:true,provider:'rules',unavailable:errorReason(error,'planning')};
     }
    });}catch(error){
     if(controller.signal.aborted||!['UNCERTAIN_DISPATCH','TASK_LIMIT'].includes(error.code))throw error;
     strategy={queries:plan.queries.slice(0,3),findMorePeople:true,provider:'rules',unavailable:'earlier planning request has no usable answer'};
     if(!diagnostics.some(d=>d.code==='planner_fallback'))diagnostics.push({phase,code:'planner_fallback',reason:'Used the saved research questions after the planning request failed to return a usable answer.',at:new Date().toISOString()});
    }
    if(strategy&&!diagnostics.some(d=>d.code==='query_plan'))diagnostics.push({phase,code:'query_plan',reason:'Search plan · '+strategy.provider+' · '+strategy.queries.length+' targeted queries'+(strategy.unavailable?' · planning model: '+strategy.unavailable:''),at:new Date().toISOString()});
    for(const query of (strategy?strategy.queries:plan.queries.slice(0,6))){await guard();try{await search(query);}catch(error){if(error.code==='CANCELED'||controller.signal.aborted)throw error;}}
    if(!strategy||strategy.findMorePeople)await searchPeople();
    const identityRows=await allRows();
    await resolveDirectoryNames(search,identityRows);
    const trace=D.tracePublicBuyers(identityRows,candidate.company,{...input.profile,companyDomain:candidate.domain});
    const profileRows=[...identityRows];
    for(const url of unresolvedProfileUrls(identityRows,candidate,D)){
     try{const page=await read(url);if(page?.sourceRead)profileRows.push(page);}
     catch(error){if(controller.signal.aborted||['TIME_BUDGET','RUN_WINDOW','LEASE_EXPIRED','CONTEXT_CHANGED','CANCELED','CREDIT_LIMIT'].includes(error.code))throw error;}
    }
    const profiled=unheldProfilePeople(profileRows,candidate,{D});
    // Profile people join the pool first, as the free index's identities do: the ten shown are ranked from everyone
    // found, and a person ranked below them stays in the pool instead of being dropped.
    if(profiled.length)candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),pool:D.mergeBuyerPool(candidate.buyerDiscovery?.pool||candidate.people||[],profiled,input.profile)};
    candidate.people=D.retainBuyerIdentities(D.mergeBuyerPool(candidate.people||[],[...trace.people,...profiled],input.profile),input.profile,candidate).slice(0,10);acquirePeople();phase=nextPhase[phase];}
   }else if(phase==='contacts'){
    if(candidate.people?.length){
     if(input.emailWaterfallVersion&&(input.fullResearch||freeContactChecks||input.recheck)){
      const selected=D.mandatoryBuyerResearchPriorities(candidate.people,candidate,{contactOptions}).filter(person=>D.sourcedBuyerIdentity(person,candidate)&&D.qualifyBuyer(person,{decisionMakers:person.matchedBuyerRole||person.title},candidate).eligible).slice(0,4);
      const context={workspaceId:row.workspace_id,userId:row.requested_by,guard,writeAuthority:()=>({sql:writeGuard,args:[row.id,lease,clock(),contextVersion]})};
      await checkFreeEmails(env,context,candidate,contactOptions.companyId,selected,{confirmedEmail:contactOptions.confirmedEmail,lookup:services.emailWaterfall,signal:controller.signal,refresh:!!input.recheck,jobId:row.id});
     }
     scheduledContactWork=true;report=await D.runMandatoryBuyerResearch(candidate,{search,readPage:read,rows,guard,signal:controller.signal,contactOptions,rankedPriorities:input.fullResearch===true||freeContactChecks,recheckPlans:input.recheck?.plans,maxDurationMs:Math.min(remaining,input.recheck?Math.max(1,input.recheck.maxActiveMs-phaseMs):180000),observeTools:false,buyerAgentContext:D.buyerAgentContext(candidate,input.profile),accountability:report,crossCheck:freeContactChecks?undefined:async person=>task('independent',JSON.stringify([person.id,person.name,person.title,...(services.independent?[]:['grounded-low-v1'])]),async()=>{let result;try{result=await (services.independent?services.independent(person,controller.signal):searchWorkspaceBuyerContact(env,row.workspace_id,{company:candidate.company,domain:row.domain,person,signal:controller.signal}));}catch(error){observe({provider:'gemini',operation:'search',status:'failed',reason:'Independent research unavailable'});throw error;}if(result.status==='not_configured'||result.status==='unavailable'&&/not configured/i.test(result.reason||'')){observe({provider:'gemini',operation:'search',status:'skipped',reason:'Independent provider not configured'});return {...result,status:'not_configured'};}if(result.status!=='complete'||result.web_search===false){observe({provider:'gemini',operation:'search',status:'failed',reason:'Independent research unavailable'});throw Error('Independent research unavailable');}observe({provider:result.provider||'gemini',operation:'search',status:'succeeded',results:result.results?.length||0});return result;})});
     confirmNamed();
     // A retained dispatch is not sent again, so it is not work this phase can still retry.
     const retryable=report.status!=='complete'&&!changed&&report.stopReason!=='time_budget'?(await stmt(env,"SELECT task_key,status,request_value FROM buyer_research_tasks WHERE job_id=? AND phase='contacts' AND status<>'complete' AND (status='running' OR attempts<2)",row.id).all()).results.filter(task=>contactTasks.has(task.task_key)&&!(task.status==='running'&&retainsDispatch(task.request_value))).length:0;
     if(report.status==='complete'||!changed&&report.stopReason!=='time_budget'&&!retryable){
      phase=nextPhase[phase];
     }
    }else{diagnostics.push({phase,reason:'No complete buyer identities were supported by the available sources',at:new Date().toISOString()});phase=nextPhase[phase];}
   }else if(phase==='review'){
    // The HTTP wake owns 18s; the configured reviewer and its fallback own 45s.
    // Yield before dispatch instead of spending a shortened failed attempt.
    if(!services.review&&windowMs-(clock()-start)<46000)throw Object.assign(Error('AI evidence review queued for a full processing slice'),{code:'PHASE_DEFERRED'});
    const supplied=D.safeBuyerReviewEvidence(D.buyerSupervisorEvidence(candidate.people,rows));candidate.publicResearch.reviewEvidence=supplied;
    candidate.publicResearch.buyerAgent=D.assessBuyerAgent(candidate,rows,D.buyerAgentContext(candidate,input.profile));
    const signature=D.buyerReviewSignature(candidate),body={company:candidate.company,buyerAgent:candidate.publicResearch.buyerAgent,people:candidate.people.map(p=>({id:p.id,name:p.publicName||p.name,role:p.title,employer:p.organization,email:p.publicEmail,email_source:p.publicEmailUrl,linkedin:p.publicLinkedinUrl||p.linkedin_url,checks:p.contactResearch?.checks})),evidence:supplied,quality:{depth:D.BUYER_CONTACT_RESEARCH_POLICY.version,research_status:report.status,checked_people:report.checkedPeople,official_pages:report.officialPages}};
    const runReview=()=>(services.review||reviewWorkspaceBuyerEvidence)(env,row.workspace_id,body,{signal:controller.signal,userId:row.requested_by,maxDurationMs:Math.min(45000,remaining)});
    const review=input.fullResearch?await task('independent','Full research review · '+signature,runReview):await runReview();await guard();
    for(const entry of review.researchTrace||[])observe(entry);
    candidate.publicResearch.aiReview=D.safeBuyerAiReview({status:review.supervisor?.status||'unavailable',provider:review.provider||'none',checkedAt:new Date().toISOString(),inputSignature:signature,reviewedPersonIds:review.supervisor?.reviewedPersonIds,findings:review.supervisor?.findings,summary:review.summary,reason:review.reason,conflicts:review.conflicts});
    candidate.publicResearch.conflicts=review.conflicts||[];phase=input.paidResearch?'paid':'done';
   }else if(phase==='paid'){
    if(deferSemanticStamp&&sourceScopeChanged){
     diagnostics.push({phase,reason:'Holding the original paid scope until guarded recovery completes the current free source plan',at:new Date().toISOString()});phase='done';
    }else{
    const member=await stmt(env,'SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?',row.workspace_id,row.requested_by).first();
    const paidGuard=async()=>guard();paidGuard.writeAuthority=()=>({sql:writeGuard,args:[row.id,lease,clock(),contextVersion]});
    const finished=await runBuyerPaidResearch(env,{workspaceId:row.workspace_id,userId:row.requested_by,role:member?.role,firecrawlMeter:{charge:cost=>creditMeter.charge(cost)}},candidate,{intent:input.paidResearch,jobId:row.id,guard:paidGuard,signal:controller.signal,lookup:services.paidLookup,onContinuation:scope=>{paidContinuation=scope;}});
    if(!finished&&candidate.publicResearch.paidResearch.code===PAID_PRIORITY_RESEARCH_REQUIRED){phase='contacts';diagnostics.push({phase,reason:'Completing the newly displayed buyer’s deeper public checks before resuming the saved paid attempt',at:new Date().toISOString()});}
    else if(finished)phase='done';
    }
   }
   if(invocationExhausted){phase=row.phase;throw Object.assign(Error('Shared invocation query budget reached; saved work will continue'),{code:'TIME_BUDGET'});}
   await guard();phaseMs+=Math.max(1,clock()-phaseStart);phaseRuns=phase==='contacts'&&changed>0?0:phaseRuns+1;
   if(status==='queued'&&phase===row.phase&&(phaseExhausted(phase,phaseMs,phaseRuns)||input.recheck&&phase==='contacts'&&phaseMs>=input.recheck.maxActiveMs)){
    diagnostics.push({phase,reason:'Phase work budget reached; completed evidence retained',at:new Date().toISOString()});phase=nextPhase[phase];
   }
   if(phase!==row.phase){phaseMs=0;phaseRuns=0;}
   if(phase==='done')await settleQuality();
  }catch(error){
   const phaseAdvanced=phase!==row.phase;
   if(phaseAdvanced){phaseMs=0;phaseRuns=0;}
   if(error.code==='RUN_WINDOW'||controller.signal.reason?.code==='RUN_WINDOW'){status='needs_review';report.status=report.status==='complete'?'complete':'partial';report.stopReason='run_window';diagnostics.push({phase,code:'run_window',reason:BUYER_RUN_WINDOW_REASON,at:new Date().toISOString()});}
   else if(error.code==='CREDIT_LIMIT'||controller.signal.reason?.code==='CREDIT_LIMIT'){
    // The pause keeps the phase the slice started in: an engine step that swallowed the refusal may have moved on.
    phase=row.phase;status='needs_review';report.status=report.status==='complete'?'complete':'partial';report.stopReason='credit_limit';diagnostics.push({phase,code:'credit_limit',reason:(error.code==='CREDIT_LIMIT'?error:controller.signal.reason).message,at:new Date().toISOString()});}
   else if(error.code==='FAST_RESEARCH_ACTIVE'){
    status='queued';if(diagnostics.at(-1)?.code!==error.code)diagnostics.push({phase,code:error.code,reason:error.message,at:new Date().toISOString()});
   }else if(error.code==='FULL_RESEARCH_DISABLED'){
    status='needs_review';diagnostics.push({phase,code:error.code,reason:error.message,at:new Date().toISOString()});
   }else if(error.code==='CANCELED'||error.code==='CONTEXT_CHANGED')status='canceled';
   else if(error.code==='LEASE_EXPIRED'||error.code==='PHASE_DEFERRED')status='queued';
   else if(controller.signal.aborted||error.code==='TIME_BUDGET'){status='queued';if(!phaseAdvanced){phaseMs+=Math.max(1,clock()-start);phaseRuns=phase==='contacts'&&changed>0?0:phaseRuns+1;if((phaseExhausted(phase,phaseMs,phaseRuns)||input.recheck&&phase==='contacts'&&phaseMs>=input.recheck.maxActiveMs)){diagnostics.push({phase,reason:'Phase time budget reached; saved work retained',at:new Date().toISOString()});phase=nextPhase[phase]||'done';phaseMs=0;phaseRuns=0;}}}
   else{status='needs_review';diagnostics.push({phase,reason:['TASK_REQUIRED_CHECK','UNCERTAIN_DISPATCH'].includes(error.code)?error.message:errorReason(error,phase),at:new Date().toISOString()});}
  }finally{
   accepting=false;clearTimeout(timer);controller.abort();await creditMeter.flush();
   // Count only actual completed read tasks in this job, including the official
   // phase before person research starts. Retained history is not a new read.
   const completedReads=(await allRows()).filter(r=>r.sourceRead===true&&D.canonicalDomain(r.url)===row.domain);
   report.officialPageReads=[...new Map([...(report.officialPageReads||[]),...completedReads.map(r=>({url:r.url,sourceRead:true,checkedAt:r.extractedAt}))].map(r=>[r.url,r])).values()].slice(0,120);
   report.officialPages=report.officialPageReads.length;
   candidate.publicResearch.accountability=report;candidate.publicResearch.officialPages=report.officialPages;
   if(peopleFirst&&row.phase==='dossier'&&phase==='review'){
    input.dossierPassFinished=true;
    // A dossier can supply another named manager. Reuse completed checks when researching that person.
    const before=new Set((originalCandidate.people||[]).map(D.buyerIdentity));
    if((candidate.people||[]).some(person=>!before.has(D.buyerIdentity(person))))phase='contacts';
   }
   if(input.taskId&&status!=='canceled'&&phase!==row.phase){
    const requiredGap=row.phase==='official'&&!D.officialContactCoveragePassed(candidate)?'Official website checks are incomplete':row.phase==='dossier'&&candidate.buyerDiscovery?.companyDossier?.status!=='complete'?'Required company dossier is incomplete':row.phase==='identities'&&!candidate.people?.length?'No supported decision-maker identities were found':row.phase==='contacts'&&!D.buyerResearchCoveragePassed(candidate,{contactOptions})?'Mandatory contact checks are incomplete':row.phase==='review'&&candidate.publicResearch?.aiReview?.status!=='complete'?'AI evidence review is incomplete':'';
    if(requiredGap){phase=row.phase;status='needs_review';diagnostics.push({phase,code:'task_required_check',reason:requiredGap,at:new Date().toISOString()});}
   }
   if(freeContactChecks&&status==='queued'&&row.phase==='contacts'&&phase!=='contacts'){
    status='needs_review';phase='contacts';diagnostics.push({phase,code:'free_discovery_finished',reason:'Public contact checks finished within the free research allowance. See each field for its coverage.',at:new Date().toISOString()});
   }
   if(siteOnly&&status==='queued'&&!allowedFreePhase(phase)){phase='identities';phaseMs=0;phaseRuns=0;}
   if(status==='queued'&&phase==='done')await settleQuality();
   // One identity record is saved once, however many copies earlier slices or the browser's list carried in.
   candidate.people=collapseSameRecords(candidate.people);
   if(Array.isArray(candidate.buyerDiscovery?.pool))candidate.buyerDiscovery={...candidate.buyerDiscovery,pool:collapseSameRecords(candidate.buyerDiscovery.pool)};
   candidate.peopleStatus=candidate.people?.length?'complete':status==='queued'?'loading':'empty';
   candidate.publicContactStatus=['queued','running'].includes(status)?'loading':status==='complete'?'complete':'error';
   candidate.publicContactVersion='20261021-adaptive-depth-v3';
   // The user may have requested contact checks after this worker loaded the
   // identity-only plan. Compare the saved flags at commit under the same lease.
   const finishedFreePass=siteOnly&&status==='needs_review'&&diagnostics.at(-1)?.code==='free_discovery_finished';
   let updated;
   try{updated=await scopedWrite(args=>stmt(env,`UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.freeDiscovery',json(?),'$.peopleFirst',json(?),'$.dossierPassFinished',?,'$.executionContinuationVersion',?,'$.contactSchedulingVersion',?,'$.apolloIdentityVersion',?,'$.apolloIdentityReceipts',json(?),'$.paidResearch',json(?)),status=CASE WHEN ? AND (json_extract(input_json,'$.fullResearch')=1 OR (? AND json_extract(input_json,'$.publicContactChecks')=1)) THEN 'queued' ELSE ? END,phase=?,phase_ms=?,phase_runs=?,result_json=?,diagnostic_json=?,last_error='',lease_token=NULL,lease_until=0,next_at=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND lease_until>? AND status='running' AND ${authoritySql} AND COALESCE((SELECT version FROM customer_workspace_state WHERE workspace_id=buyer_research_jobs.workspace_id),0)=?${paidContinuation?' AND EXISTS(SELECT 1 FROM crm_intelligence WHERE workspace_id=? AND company_id=? AND research_snapshot_json=? AND evidence_json=?)':''}`,JSON.stringify(Boolean(input.freeDiscovery)),JSON.stringify(input.peopleFirst??null),input.dossierPassFinished?1:0,deferSemanticStamp?Number(input.executionContinuationVersion||0):4,scheduledContactWork?1:Number(input.contactSchedulingVersion||0),apolloIdentityChecked?1:0,JSON.stringify(input.apolloIdentityReceipts),JSON.stringify(input.paidResearch||null),Number(finishedFreePass),Number(!freeContactChecks),status,phase,phaseMs,phaseRuns,JSON.stringify(candidate),JSON.stringify(diagnostics.slice(-20)),clock()+(fastEvidence?.active&&input.fullResearch?15000:0),...args,...(paidContinuation?[row.workspace_id,input.paidResearch.companyId,paidContinuation.row.research_snapshot_json,paidContinuation.row.evidence_json]:[])),true);}
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

