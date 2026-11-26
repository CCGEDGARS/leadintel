import {spendLedger,spendIncrement} from './company-list-spend.js';
import '../../customer/company-lists.js';
import {sha256,cookieValue} from './security.js';
import {getCustomerState} from './customer-state.js';
import {runCompanyListJobs} from './company-list-research.js';
export {runCompanyListJobs} from './company-list-research.js';
import {storageErrorResponse} from './workspace-storage.js';
import {upsertCrmCompany} from './crm.js';
const M=globalThis.LeadIntelCompanyLists;
const sql=(env,q,...v)=>env.DB.prepare(q).bind(...v),parse=(v,f={})=>{try{return JSON.parse(v);}catch{return f;}};
const active=s=>['queued','running'].includes(s),fail=(m,status=409)=>Object.assign(Error(m),{status});
const clean=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
export async function companyListOptions(env,workspaceId){const options=M.options((await getCustomerState(env,workspaceId)).payload?.main||{});return {...options,contextFingerprint:await sha256(JSON.stringify(options))};}
function publicList(row,s){if(!row)return null;const criteria=parse(row.input_json);return {id:row.id,name:criteria.name,criteria,status:row.status,saved:Boolean(row.saved),revision:row.revision,results:criteria.kind==='search_snapshot'?M.inScoreOrder(s.results||[]):M.ranked(s.results||[]),progress:{reasoningSpend:s.reasoningSpend||null,runToTarget:!criteria.taskId&&Boolean(criteria.runToTarget),mainResearcher:s.mainResearcher||null,run:s.run||null,count:s.resultCount??s.results?.length??0,target:criteria.count,operations:s.operations||0,allowance:s.allowance||criteria.budget,checked:s.checked||0,reason:row.last_error==='storage_full'?'Workspace storage is full. Completed research is retained; free storage before resuming.':s.reason||'',phase:s.phase||'planning',nextAttemptAt:s.nextAttemptAt||0,pending:s.pendingCount??s.pending?.length??0,operationTotals:s.operationTotals||null},failureCode:s.failureCode||row.last_error||'',failureCause:s.failureCause&&s.failureCause.for===s.failureCode?{provider:s.failureCause.provider,kind:s.failureCause.kind,...(s.failureCause.status&&{status:s.failureCause.status}),...(s.failureCause.code&&{code:s.failureCause.code})}:null,receipts:s.receipts||[],incompleteChecks:(s.reviews||[]).filter(r=>r.status!=='resolved'),createdAt:row.created_at,updatedAt:row.updated_at};}
async function loadEvidence(env,row,entries){
 const refs=entries.filter(r=>r.evidenceId);
 if(!refs.length)return entries;
 const stored=new Map();
 for(let i=0;i<refs.length;){
  // Keep both SQL parameter count and aggregate response size bounded. A single
  // unusually detailed company travels by itself.
  const batch=[];let bytes=0;
  while(i<refs.length&&batch.length<20){
   const ref=refs[i],size=ref.evidenceBytes||512*1024;
   if(batch.length&&bytes+size>512*1024)break;
   batch.push(ref.evidenceId);bytes+=size;i++;
  }
  const params=batch.map(()=>'?').join(',');
  const {results}=await sql(env,`SELECT evidence_id,result_json FROM company_list_evidence WHERE workspace_id=? AND list_id=? AND evidence_id IN (${params})`,row.workspace_id,row.id,...batch).all();
  for(const r of results)stored.set(r.evidence_id,JSON.parse(r.result_json));
 }
 return entries.map(entry=>{
  if(!entry.evidenceId)return entry;
  const evidence=stored.get(entry.evidenceId);
  if(!evidence||evidence.domain!==entry.domain)throw Object.assign(fail('The saved list changed while loading evidence. Refresh the list.'),{code:'list_revision_changed'});
  return evidence;
 });
}
export async function readCompanyList(env,workspaceId,id){
 // Re-read the owner once if a replacement or deletion raced the evidence read.
 for(let attempt=0;;attempt++){
  const row=await sql(env,'SELECT * FROM company_lists WHERE workspace_id=? AND id=?',workspaceId,id).first();if(!row)return null;
  const state=parse(row.state_json);
  try{state.results=await loadEvidence(env,row,state.results||[]);return publicList(row,state);}
  catch(cause){if(attempt||cause.code!=='list_revision_changed')throw cause;}
 }
}
async function saveSearchSnapshot(env,workspaceId,user,body){
 const snapshot=M.normalizeSearchSnapshot(body.snapshot),fingerprint=await sha256(JSON.stringify(snapshot));
 if(body.fingerprint!==fingerprint)throw fail('Company results changed. Save the current list again.');
 const id='search_'+await sha256(workspaceId+'\0'+fingerprint);
 const criteria={kind:'search_snapshot',name:clean(body.name,120)||'Company search',fingerprint,count:snapshot.rows.length,context:snapshot.context};
 const state={phase:'saved',results:snapshot.rows,reason:'Saved search results. Review status is preserved; buying intent is unconfirmed.'};
 // Content-addressed snapshots make retry after a lost response idempotent.
 // No provider call or CRM qualification is authorized by saving a list.
 await sql(env,`INSERT OR IGNORE INTO company_lists(id,workspace_id,requested_by,session_hash,input_json,state_json,status)
 SELECT ?,?,?,?,?,?,'complete' WHERE (SELECT COUNT(*) FROM company_lists WHERE workspace_id=?)<50
 AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.user_id=? AND m.workspace_id=? AND m.role IN ('owner','researcher','sales'))`,id,workspaceId,user.id,user.hash,JSON.stringify(criteria),JSON.stringify(state),workspaceId,user.hash,user.id,workspaceId).run();
 const saved=await readCompanyList(env,workspaceId,id);if(!saved)throw fail('The list could not be saved. Check workspace access or delete an unused list if you have reached the 50-list limit.');return saved;
}
async function access(request,env,workspaceId){const token=cookieValue(request,'leadintel_session');if(!token)throw fail('Sign in to use company lists.',401);const hash=await sha256(token),row=await sql(env,"SELECT s.user_id,m.role FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.workspace_id=?",hash,workspaceId).first();if(!row||!['owner','researcher','sales'].includes(row.role))throw fail('Workspace research access required.',403);return {id:row.user_id,role:row.role,hash};}
export async function startCompanyList(env,workspaceId,user,raw,trusted=null){
 const options=trusted?.options||await companyListOptions(env,workspaceId);
 if(!trusted&&Object.hasOwn(raw,'profileIds')&&raw.contextFingerprint!==options.contextFingerprint)throw fail('Strategy profiles, signals or references changed. Reopen Build company list and review the current criteria.');
 if(!trusted&&options.profileConfigurationPresent&&!Object.hasOwn(raw,'profileIds'))throw fail('Reload Build company list to choose the active targeting profiles and buying signals.');
 const criteria=M.configuration(raw,options);if(raw.minimumScore===80)criteria.minimumScore=80;
 if(trusted?.taskId)criteria.taskId=trusted.taskId;
 else if(raw.budget==null)criteria.runToTarget=true;
 if(trusted?.id){const retained=await readCompanyList(env,workspaceId,trusted.id);if(retained)return retained;}
 const count=await sql(env,'SELECT COUNT(*) n FROM company_lists WHERE workspace_id=?',workspaceId).first();if(count.n>=50)throw fail('Keep up to 50 company lists. Delete an unused list before creating another.');
 const existing=await sql(env,"SELECT id FROM company_lists WHERE workspace_id=? AND status IN ('queued','running')",workspaceId).first();if(existing)throw fail('A company list is already building. Open it or pause it first.');
 if(trusted?.taskId&&!await sql(env,"SELECT id FROM copilot_research_tasks WHERE id=? AND workspace_id=? AND status='running'",trusted.taskId,workspaceId).first())throw fail('Task research authorization changed.',403);
 const id=trusted?.id||crypto.randomUUID(),state={sizeEvidenceRecoveryApplied:true,registerRecoveryApplied:true,run:{startedAt:Date.now(),baseline:0,milestones:{}},phase:'planning',results:[],partial:{},queries:[],queryIndex:0,round:0,pending:[],seen:[],checked:0,operations:0,allowance:criteria.budget,receipts:[],reason:'Preparing the selected criteria'};
 await sql(env,`INSERT INTO company_lists(id,workspace_id,requested_by,session_hash,input_json,state_json) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.user_id=? AND m.workspace_id=? AND m.role IN ('owner','researcher','sales'))`,id,workspaceId,user.id,user.hash,JSON.stringify(criteria),JSON.stringify(state),user.hash,user.id,workspaceId).run();
 const saved=await readCompanyList(env,workspaceId,id);if(!saved)throw fail('Research authorization changed.',403);return saved;
}
export async function saveRows(env,row,user,domain,cursor=0){
 const state=parse(row.state_json),criteria=parse(row.input_json);
 // The index contains the same score, match count and company used by ranked().
 // Hydrate only the selected company or the current twenty-row save batch.
 const selected=domain?state.results.filter(r=>r.domain===domain):M.ranked(state.results.map(r=>r.evidenceId?{...r,matches:{length:r.matchCount}}:r)).slice(cursor,cursor+20);
 const rows=await loadEvidence(env,row,selected);if(!rows.length)throw fail('No completed company matches to save.',400);
 const guard=async()=>{const alive=await sql(env,`SELECT id FROM company_lists WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.user_id=? AND m.workspace_id=? AND m.role IN ('owner','researcher','sales'))`,row.id,row.workspace_id,row.revision,user.hash,user.id,row.workspace_id).first();if(!alive)throw fail('The list changed. Reload before saving.');};
 const parentGuard=user.taskId?" AND EXISTS(SELECT 1 FROM copilot_research_tasks WHERE id=? AND workspace_id=? AND status='running')":'',parentArgs=user.taskId?[user.taskId,row.workspace_id]:[];
 const writeAuthority=()=>({sql:"EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.user_id=? AND m.workspace_id=? AND m.role IN ('owner','researcher','sales')) AND EXISTS(SELECT 1 FROM company_lists WHERE id=? AND workspace_id=? AND revision=?)"+parentGuard,args:[user.hash,user.id,row.workspace_id,row.id,row.workspace_id,row.revision,...parentArgs]});
 const context={workspaceId:row.workspace_id,userId:user.id,role:user.role,guard,writeAuthority};
 const saved=[];for(const r of rows){await guard();const existing=await sql(env,'SELECT id,lifecycle_status,deleted_at FROM crm_companies WHERE workspace_id=? AND normalized_domain=?',row.workspace_id,r.domain).first();
  if(existing?.deleted_at||['suppressed','archived'].includes(existing?.lifecycle_status)){if(domain)throw fail('This CRM company is archived or suppressed. Review it in CRM first.');continue;}
  // List membership and its evidence stay in company_lists; existing CRM research,
  // contacts, scores and user edits are never replaced by a list snapshot.
  const record=existing||((await upsertCrmCompany(env.DB,context,{company:{company_name:r.company,website:r.website,country:r.market,source:'signal_company_list'},intelligence_scope:'company',intelligence:{research_snapshot:{companyList:{id:row.id,score:r.score,fitScore:r.fitScore,signalScore:r.signalScore,signalBonus:r.signalBonus,matchedProfiles:r.profileMatches,matchedSignals:r.signalMatches||r.matches,criteriaSummary:M.criteriaSummary(criteria),identity:r.identity,locationEvidence:r.locationEvidence,commercialFit:r.commercialFit,quality:r.quality,audit:r.audit,buyingIntent:'unconfirmed'}}}})).company);
  if(record?.id)saved.push({...r,crmId:record.id});
 }
 return saved;
}
export async function handleCompanyListsRoute(request,env,cors={},ctx){
 const u=new URL(request.url);if(u.pathname!=='/api/company-lists')return null;
 const respond=(v,status=200)=>Response.json(v,{status,headers:{...cors,'Cache-Control':'no-store'}});
 try{const workspaceId=u.searchParams.get('workspace_id');if(!workspaceId||workspaceId.length>160)throw fail('Workspace required.',400);const user=await access(request,env,workspaceId);
  if(request.method==='GET'){
   if(u.searchParams.has('options'))return respond({options:await companyListOptions(env,workspaceId)});
   if(u.searchParams.has('search_snapshot')){const fingerprint=u.searchParams.get('search_snapshot');if(!/^[a-f0-9]{64}$/.test(fingerprint))throw fail('Invalid saved-list reference.',400);return respond({list:await readCompanyList(env,workspaceId,'search_'+await sha256(workspaceId+'\0'+fingerprint))});}
   if(u.searchParams.has('id'))return respond({list:await readCompanyList(env,workspaceId,u.searchParams.get('id'))});
   const rows=await sql(env,`SELECT id,status,saved,revision,created_at,updated_at,last_error,
    json_object('name',json_extract(input_json,'$.name'),'kind',json_extract(input_json,'$.kind'),'crmList',json_extract(input_json,'$.crmList'),'taskId',json_extract(input_json,'$.taskId'),'runToTarget',json_extract(input_json,'$.runToTarget'),'count',json_extract(input_json,'$.count'),'budget',json_extract(input_json,'$.budget')) AS input_json,
    json_object('reasoningSpend',json_extract(state_json,'$.reasoningSpend'),'run',json_extract(state_json,'$.run'),'resultCount',json_array_length(state_json,'$.results'),'pendingCount',json_array_length(state_json,'$.pending'),'operations',json_extract(state_json,'$.operations'),'allowance',json_extract(state_json,'$.allowance'),'checked',json_extract(state_json,'$.checked'),'reason',json_extract(state_json,'$.reason'),'phase',json_extract(state_json,'$.phase'),'nextAttemptAt',json_extract(state_json,'$.nextAttemptAt'),'operationTotals',json_extract(state_json,'$.operationTotals')) AS state_json
    FROM company_lists WHERE workspace_id=? ORDER BY created_at DESC,rowid DESC LIMIT 50`,workspaceId).all();return respond({lists:(rows.results||[]).map(row=>{const l=publicList(row,parse(row.state_json));return {id:l.id,name:l.name,kind:l.criteria.kind,taskOwned:Boolean(l.criteria.taskId),crmList:Boolean(l.criteria.crmList||l.saved),status:l.status,saved:l.saved,progress:l.progress,updatedAt:l.updatedAt};})});
  }
  if(request.method!=='POST')throw fail('Method not allowed.',405);
  const text=await request.text();if(text.length>1024*1024)throw fail('List request is too large.',413);const body=parse(text,null);if(!body||typeof body!=='object')throw fail('List request required.',400);if(body.action!=='snapshot'&&text.length>24000)throw fail('List request is too large.',413);
  let list,nextCursor=null;if(body.action==='snapshot')list=await saveSearchSnapshot(env,workspaceId,user,body);
  else if(body.action==='start')list=await startCompanyList(env,workspaceId,user,body);
  else{
   const row=await sql(env,'SELECT * FROM company_lists WHERE workspace_id=? AND id=?',workspaceId,String(body.id||'')).first();if(!row)throw fail('Company list not found.',404);
   if(parse(row.input_json).kind==='search_snapshot'&&body.action!=='delete')throw fail('This is a saved search copy. Continue company review and buyer selection in Companies.',400);
   if(parse(row.input_json).taskId&&body.action==='extend')throw fail('Create a new list to extend task-owned research.');
   if(parse(row.input_json).taskId&&['pause','resume','delete','buyer'].includes(body.action)){
    const parent=await sql(env,'SELECT status FROM copilot_research_tasks WHERE id=? AND workspace_id=?',parse(row.input_json).taskId,workspaceId).first();
    if(parent&&(body.action!=='buyer'||parent.status==='running'))throw fail(body.action==='delete'?'Delete the task conversation before deleting its retained company list.':'Pause or continue this research task in Ask LeadIntel.');
    if(!parent&&body.action==='resume')throw fail('This task was deleted. Create a new reviewed list; saved results can still be exported or saved in CRM.');
   }
   if(row.revision!==body.revision)throw fail('The list progressed in another session. Refresh and try again.');
   if(!['extend','pause','resume','save','delete','buyer'].includes(body.action))throw fail('Unknown list action.',400);
   if(active(row.status)&&['save','delete','buyer'].includes(body.action))throw fail('Pause research before saving, deleting or selecting companies.');
   const s=parse(row.state_json),criteria=parse(row.input_json);
   if(row.saved)criteria.crmList=true; // Preserve membership for lists saved before this flag existed.
   if(body.action==='buyer'){const [candidate]=await saveRows(env,row,user,body.domain);return respond({candidate});}
   if(body.action==='save'){
    if(!criteria.crmList&&body.name!==undefined){
     if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>120)throw fail('Enter a list name of up to 120 characters.',400);
     criteria.name=body.name.trim();
    }
    const cursor=Number(body.cursor||0);if(!Number.isInteger(cursor)||cursor<0||cursor>=s.results.length||(cursor!==0&&cursor!==(s.saveCursor||0)))throw fail('Invalid save position.',400);await saveRows(env,row,user,undefined,cursor);nextCursor=cursor+20<s.results.length?cursor+20:null;s.saveCursor=nextCursor||0;if(nextCursor===null)criteria.crmList=true;const result=await sql(env,`UPDATE company_lists SET saved=?,input_json=?,state_json=?,revision=revision+1 WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.user_id=? AND m.workspace_id=? AND m.role IN ('owner','researcher','sales'))`,nextCursor===null?1:0,JSON.stringify(criteria),JSON.stringify(s),row.id,workspaceId,row.revision,user.hash,user.id,workspaceId).run();if(!result.meta.changes)throw fail('List changed while saving; completed CRM saves are retained.');}
   else if(body.action==='delete'){const deleted=await sql(env,`DELETE FROM company_lists WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.user_id=? AND m.workspace_id=? AND m.role IN ('owner','researcher','sales'))`,row.id,workspaceId,row.revision,user.hash,user.id,workspaceId).run();if(!deleted.meta.changes)throw fail('The list changed. Reload before deleting.');return respond({deleted:true});}
   else{
    const extending=body.action==='extend';
    if(extending){
     if(active(row.status)||!s.results.length)throw fail('Pause research and find at least one company before adjusting this list.');
     if(!Number.isInteger(body.additional)||body.additional<1||s.results.length+body.additional>200)throw fail('Choose an additional count within the 200-company list limit.',400);
     if(criteria.taskId)throw fail('Use the parent task to manage this research.');
     criteria.count=s.results.length+body.additional;
     criteria.runToTarget=true;
     s.saveCursor=0;
     s.phase='researching';
     s.noProgressRounds=0;
     s.round=0;
     s.roundStart=null;
    }
    if(body.action==='resume'&&active(row.status))throw fail('This list is already running.');
    if(body.action==='resume'&&row.status==='complete')throw fail('This list has reached its target.');
    if(body.action==='resume'&&criteria.minimumScore&&criteria.target&&!s.registerRecoveryApplied){
     const queued=new Set([...s.pending.map(task=>M.domain(task.url)),...s.results.map(match=>match.domain)]);
     const recover=[];
     for(const review of s.reviews||[]){
      const url=M.url(review.url),domain=M.domain(url);
      if(!domain||queued.has(domain)||review.status!=='needs_evidence'||!review.company)continue;
      if(!/^Required evidence missing:.*(?:register could not be checked|Revenue not published in the register)/i.test(review.reason))continue;
      queued.add(domain);recover.push({url});
     }
     s.pending.unshift(...recover);
     s.registerRecoveryApplied=true;
    }
    if(body.action==='resume'&&criteria.target&&!s.sizeEvidenceRecoveryApplied){
     const queued=new Set([...s.pending.map(task=>M.domain(task.url)),...s.results.map(match=>match.domain)]);
     for(const review of s.reviews||[]){
      const url=M.url(review.url),domain=M.domain(url);
      if(!domain||queued.has(domain)||!review.company)continue;
      if(!/^(?:Required evidence missing|Outside the target criteria):.*(?:employees?|revenue|turnover|minimum)/i.test(review.reason))continue;
      queued.add(domain);s.pending.push({url});
     }
     s.sizeEvidenceRecoveryApplied=true;
    }
    if(criteria.taskId&&body.action==='resume'&&s.failureCode==='research_spend'){
     if(body.additionalReasoningUsd!==1)throw fail('Approve the additional $1 reasoning allowance before resuming.',400);
     const ledger=spendLedger(s);ledger.limit=Math.max(ledger.limit,ledger.used)+spendIncrement;
    }
    if(criteria.taskId&&body.action==='resume'&&s.failureCode==='search_budget'){
     if(body.additionalGroundedQueries!==3)throw fail('Approve three additional AI web searches before resuming.',400);
     s.groundedLimit=(s.groundedLimit??3)+3;
    }
    if(!criteria.taskId&&body.action==='resume'&&['research_spend','research_yield','search_budget','allowance'].includes(s.failureCode))criteria.runToTarget=true;
    if(s.failureCode==='research_yield'||extending)s.yieldBaseline={checked:s.checked||0,matches:s.results.length};
    if(body.action==='resume'||extending){s.recoveryProbe=Boolean(s.failureCause?.status>=500||s.failureCode==='registry_offline');s.run={startedAt:Date.now(),baseline:s.results.length,milestones:{}};const other=await sql(env,"SELECT id FROM company_lists WHERE workspace_id=? AND status IN ('queued','running') AND id<>?",workspaceId,row.id).first();if(other)throw fail('Pause the other running list first.');if(s.operations>=s.allowance)s.allowance=s.operations+criteria.budget;s.nextAttemptAt=0;s.retryKey='';s.failures=0;s.failureCode='';s.modelStreak=0;s.searchStreak=0;s.reason='Continuing saved research';if(s.phase==='exhausted'){s.phase='planning';s.round=0;s.noProgressRounds=0;s.roundStart=null;}}
    else s.reason='Paused by you; completed research is retained';
    const result=await sql(env,`UPDATE company_lists SET last_error=NULL,saved=0,input_json=?,status=?,state_json=?,requested_by=?,session_hash=?,lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now') AND m.user_id=? AND m.workspace_id=? AND m.role IN ('owner','researcher','sales'))`,JSON.stringify(criteria),body.action==='resume'||extending?'queued':'canceled',JSON.stringify(s),user.id,user.hash,row.id,workspaceId,row.revision,user.hash,user.id,workspaceId).run();if(!result.meta.changes)throw fail('The list changed. Refresh and try again.');
   }
   list=await readCompanyList(env,workspaceId,row.id);
  }
  if(active(list.status)&&ctx?.waitUntil)ctx.waitUntil(runCompanyListJobs(env,{jobId:list.id,windowMs:25000}).catch(()=>{}));return respond({list,nextCursor});
 }catch(e){return storageErrorResponse(e,cors)||respond({error:e.status?e.message:'Company list could not be updated. Saved results are retained.'},e.status||503);}
}
