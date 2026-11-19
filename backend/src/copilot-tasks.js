import '../../customer/research-task-model.js';
import '../../customer/company-lists.js';
import {savedFlowRow,savedFlowPayload} from './saved-flow-store.js';
import {sha256} from './security.js';
import {readAdditionalContactPolicy} from './additional-contact-services.js';
import {startCompanyList,readCompanyList,saveRows} from './company-lists.js';
import {startBuyerJob,readBuyerJob,publicBuyerJob,commandBuyerJob} from './buyer-research-store.js';
import {loadBuyerContactContext} from './buyer-contact-context.js';
const T=globalThis.LeadIntelResearchTasks,M=globalThis.LeadIntelCompanyLists,D=globalThis.LeadIntelDiscovery;
const sql=(env,q,...args)=>env.DB.prepare(q).bind(...args),parse=(v,f={})=>{try{return JSON.parse(v)||f;}catch{return f;}};
const fail=(message,status=409)=>Object.assign(Error(message),{status});
const active=s=>['queued','running'].includes(s);
const authority=`EXISTS(SELECT 1 FROM sessions s JOIN workspace_members m ON m.user_id=s.user_id WHERE s.token_hash=copilot_research_tasks.session_hash AND s.user_id=copilot_research_tasks.requested_by AND s.expires_at>datetime('now') AND m.workspace_id=copilot_research_tasks.workspace_id AND m.role IN ('owner','researcher','sales'))`;
const countries=(()=>{const names=new Intl.DisplayNames(['en'],{type:'region'}),out=[];for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=names.of(code);if(name!==code)out.push(name);}return out;})();
export async function taskOptions(env,w,flowId){
 const {results:flows=[]}=await sql(env,'SELECT id,name,revision FROM saved_flows WHERE workspace_id=? ORDER BY created_at,id LIMIT 10',w).all();
 const row=flowId&&await savedFlowRow(env,w,flowId),payload=row?await savedFlowPayload(env,row):{main:{}},main=payload.main||{},available=M.options(main),policy=await readAdditionalContactPolicy(env,w);
 // Freeze only research context, not message drafts, delivery controls or credentials.
 const frozen=Object.fromEntries(['website','profile','answers','targetMarkets','market','referenceCustomers','referenceCustomerPortfolio'].filter(k=>main[k]!==undefined).map(k=>[k,main[k]]));
 if(frozen.market)frozen.market={...Object.fromEntries(['icps','deletedSignalIds','opportunities','researchContextStale'].filter(k=>Object.hasOwn(frozen.market,k)).map(k=>[k,frozen.market[k]])),signals:frozen.market.signals||[],strategy:frozen.market.strategy,positioning:frozen.market.positioning};
 const fingerprint=await sha256(JSON.stringify([row?.id,row?.revision,available,frozen,policy]));
 return {flows,available,policy,main:frozen,fingerprint,flowMissing:!row,flowName:row?.name||''};
}
function defaults(input,o){
 const p={mode:'any',profileMode:'any',buyerCount:0,phoneEvidence:'none',...T.answers(input)};
 if(!p.markets?.length&&o.available.markets?.length)p.markets=o.available.markets;
 if(p.profileIds===undefined)p.profileIds=p.signalIds?.includes('lookalike')?[o.available.profiles.find(p=>p.type==='lookalike')?.id||'icp-lookalike']:o.available.profiles.filter(p=>p.active&&p.ready).map(p=>p.id);
 if(p.signalIds)p.signalIds=p.signalIds.filter(id=>id!=='lookalike');
 if(p.signalMode===undefined)p.signalMode=p.signalIds?.length?'require':p.profileIds.some(id=>o.available.profiles.find(p=>p.id===id)?.type==='trigger-led')?'boost':'off';
 if(p.signalMode==='off')p.signalIds=[];else if(p.signalIds===undefined)p.signalIds=o.available.buyingSignals.map(s=>s.id);
 if(p.budget===undefined)p.budget=M.recommendedBudget(p.count);
 if(p.referenceIds===undefined){const ready=o.available.references.filter(r=>r.ready&&r.active!==false);p.referenceIds=ready.length<=15?ready.map(r=>r.id):[];}
 if(p.buyerCount>0){if(p.buyerCompanies===undefined)p.buyerCompanies=Math.min(p.count||1,10);if(p.count===1)p.buyerScope='per_company';if(!p.roles?.length)p.roles=String(o.main.answers?.buyer_roles||o.main.profile?.decisionMakers||'').split(/[,;\n]/).map(v=>v.trim()).filter(Boolean);}
 if(!p.buyerCount)p.paidMode='off';
 return p;
}
function questions(plan,o){
 const q=T.questions(plan,o.available,o);
 if(plan.profileIds&&Number.isInteger(plan.count)&&plan.markets?.length&&Number.isInteger(plan.budget)){try{M.configuration(plan,o.available);}catch(e){if(!q.some(item=>item.title===e.message))q.push({field:/reference/i.test(e.message)?'referenceIds':/signal/i.test(e.message)?'signalIds':'profileIds',title:e.message});}}
 if(plan.signalIds?.some(id=>!(plan.profileIds?o.available.buyingSignals:o.available.signals).find(s=>s.id===id)))q.push({field:'signalIds',title:'A selected signal is no longer available. Choose the signals to research.'});
 if(plan.buyerCount>0&&plan.paidMode==='saved_policy'&&(o.policy.provider!=='treg'||(plan.phoneEvidence!=='none'?!o.policy.phoneEnabled:!o.policy.enabled)))q.push({field:'paidMode',title:'The required paid channel is not enabled for the supported automatic provider (Treg). Review Setup, or choose public research only.'});
 return q;
}
async function rowFor(env,w,id){return sql(env,'SELECT * FROM copilot_research_tasks WHERE workspace_id=? AND id=?',w,id).first();}
export async function readResearchTask(env,w,id){
 const row=await rowFor(env,w,id);if(!row)return null;const input=parse(row.input_json),state=parse(row.state_json),list=state.listId?await readCompanyList(env,w,state.listId):null;
 const results=(list?.results||[]).map(r=>({...r,buyers:state.people?.[r.domain]||[]}));
 return {id:row.id,revision:row.revision,status:row.status,plan:input.plan,flowName:input.flowName,questions:state.questions||[],options:state.options||{},blocker:state.blocker||(row.last_error?T.issue({code:row.last_error,message:row.last_error==='storage_full'?'Workspace storage is full. Free storage before continuing.':'Task processing failed. Review saved progress before continuing.'}):null),results,progress:list?.progress||{count:0,target:input.plan.count,reason:'Review the task before starting'},phase:state.phase||'review',buyerProgress:state.buyerProgress||'',listId:state.listId||'',saved:Boolean(list?.saved),receipts:list?.receipts||[],updatedAt:row.updated_at};
}
function namedCriteria(raw,o,text){
 const words=String(text||'').toLowerCase();if(!words)return raw;
 const named=(o.main.market?.signals||o.available.signals).filter(signal=>[signal.name,signal.id].filter(Boolean).some(name=>new RegExp('\\b'+String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(words))).map(signal=>o.available.signals.find(s=>s.id==='lookalike'&&s.sourceId===signal.id)?'lookalike':signal.id);
 if(named.length){raw={...raw,signalIds:[...new Set([...(raw.signalIds||[]),...named])]};if(raw.signalMode===undefined&&named.some(id=>id!=='lookalike'))raw.signalMode='require';}
 else if(!raw.signalIds&&/\bsignals?\b/i.test(words))raw={...raw,signalIds:[]};
 if(raw.profileIds===undefined){const named=o.available.profiles.filter(p=>new RegExp('\\b'+p.type+'(?: profile| icp)?\\b','i').test(words));if(named.length)raw={...raw,profileIds:named.map(p=>p.id)};}
 return raw;
}
async function prepared(env,w,raw){
 const o=await taskOptions(env,w,raw.flowId);raw=namedCriteria(raw,o,raw.sourceText);
 const plan=defaults(raw,o),q=questions(plan,o);
 return {input:{plan,flowName:o.flowName,fingerprint:o.fingerprint,paidPolicy:o.policy,main:o.main},state:{questions:q,options:{flows:o.flows,...o.available,policy:o.policy},phase:'review',blocker:q.length?T.issue({code:'context',message:q.map(v=>v.title).join(' ')}):null},status:q.length?'draft':'ready'};
}
export async function planResearchTask(env,{workspaceId:w,conversationId,userId,sessionHash,message,canFollowUp=false}){
 const isNew=T.requested(message);if(!isNew&&!canFollowUp)return null;
 const o=await taskOptions(env,w),extracted=T.extract(message,countries),matches=extracted.flowQuery?o.flows.filter(f=>f.name.toLowerCase()===extracted.flowQuery.toLowerCase()):[];
 if(!isNew){
  const pending=await sql(env,"SELECT * FROM copilot_research_tasks WHERE workspace_id=? AND conversation_id=? AND status IN ('draft','ready') ORDER BY rowid DESC LIMIT 1",w,conversationId).first();
  if(!pending)return null;
  if(extracted.flowQuery)extracted.flowId=matches.length===1?matches[0].id:'';
  const context=await taskOptions(env,w,extracted.flowId??parse(pending.input_json).plan.flowId);Object.assign(extracted,namedCriteria(extracted,context,message));
  if(!Object.keys(extracted).length)return null;
  const task=await commandResearchTask(env,w,{id:userId,hash:sessionHash},pending.id,{action:'update',revision:pending.revision,answers:T.answers(extracted)});
  const answer='I updated the research plan. Review the task details and remaining questions before selecting Run reviewed task.';
  await sql(env,`INSERT INTO copilot_messages(id,workspace_id,conversation_id,role,content,metadata_json) VALUES(?,?,?,'assistant',?,?)`,crypto.randomUUID(),w,conversationId,answer,JSON.stringify({research_task:{id:task.id}})).run();return {conversation_id:conversationId,answer,research_task:task,sources:[]};
 }
 const raw={...extracted,flowId:matches.length===1?matches[0].id:o.flows.length===1&&!extracted.flowQuery?o.flows[0].id:''};
 const data=await prepared(env,w,{...raw,sourceText:message});if(extracted.flowQuery&&!raw.flowId)data.state.blocker=T.issue({code:'context',message:`No unique saved Flow named “${extracted.flowQuery}” was found. Choose the intended Flow.`});
 if((await sql(env,'SELECT COUNT(*) n FROM copilot_research_tasks WHERE workspace_id=?',w).first()).n>=50)throw fail('Keep up to 50 research tasks. Delete an unused conversation first.');
 const id=crypto.randomUUID();await sql(env,`INSERT INTO copilot_research_tasks(id,workspace_id,conversation_id,requested_by,session_hash,input_json,state_json,status) VALUES(?,?,?,?,?,?,?,?)`,id,w,conversationId,userId,sessionHash,JSON.stringify(data.input),JSON.stringify(data.state),data.status).run();
 const answer='Review this research task and answer the questions below. Research starts only when you select Run reviewed task. Public web services may use subscription credits; paid contact research follows your saved permissions and limits.';
 await sql(env,`INSERT INTO copilot_messages(id,workspace_id,conversation_id,role,content,metadata_json) VALUES(?,?,?,'assistant',?,?)`,crypto.randomUUID(),w,conversationId,answer,JSON.stringify({research_task:{id}})).run();
 await sql(env,'UPDATE copilot_conversations SET updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND id=?',w,conversationId).run();
 return {conversation_id:conversationId,answer,research_task:await readResearchTask(env,w,id),sources:[]};
}
async function stopChildren(env,row){
 await sql(env,"UPDATE company_lists SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1 WHERE workspace_id=? AND json_extract(input_json,'$.taskId')=? AND status IN ('queued','running') AND NOT EXISTS(SELECT 1 FROM copilot_research_tasks WHERE id=? AND status='running')",row.workspace_id,row.id,row.id).run();
 await sql(env,"UPDATE buyer_research_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1 WHERE workspace_id=? AND json_extract(input_json,'$.taskId')=? AND status IN ('queued','running') AND NOT EXISTS(SELECT 1 FROM copilot_research_tasks WHERE id=? AND status='running')",row.workspace_id,row.id,row.id).run();
}
export async function commandResearchTask(env,w,user,id,body){
 if(Object.keys(body).some(k=>!['action','revision','answers'].includes(k)))throw fail('Unsupported task field.',400);
 const row=await rowFor(env,w,id);if(!row)throw fail('Research task not found.',404);if(row.revision!==body.revision)throw fail('Task changed. Reload its saved progress before continuing.');
 let input=parse(row.input_json),state=parse(row.state_json),status=row.status;
 if(body.action==='update'){
  if(!['draft','ready'].includes(status))throw fail('This task has started. Create a new task to change its scope.');
  if(Object.keys(body.answers||{}).some(k=>!Object.hasOwn(T.answers(body.answers),k)))throw fail('Unsupported task answer.',400);
  if(Array.isArray(body.answers?.referenceIds)&&body.answers.referenceIds.length>15)throw fail('Choose up to 15 analyzed references for this task.',400);
  const a=T.answers(body.answers),changed=a.flowId!==undefined&&a.flowId!==input.plan.flowId,raw={...input.plan,...a};if(changed){for(const k of ['profileIds','signalIds','signalMode','referenceIds'])delete raw[k];raw.marketOverride=false;}
  const data=await prepared(env,w,raw);input=data.input;state=data.state;status=data.status;
 }else if(body.action==='run'){
  if(status!=='ready')throw fail('Answer the task questions before running.');
  const o=await taskOptions(env,w,input.plan.flowId);if(o.fingerprint!==input.fingerprint)throw fail('The Flow or provider policy changed. Review the task again before running.');
  if(questions(input.plan,o).length)throw fail('Task prerequisites changed. Review the task.');
  M.configuration({...input.plan,name:'Ask LeadIntel · '+input.flowName},o.available);
  // Geography overrides belong to the task only; never switch or save the active Flow.
  if(input.plan.profileIds){input.main.market||={};input.main.market.icps=o.available.profiles.map(p=>({...p,active:input.plan.profileIds.includes(p.id)}));input.main.market.signals=(input.main.market.signals||[]).map(s=>({...s,active:input.plan.signalMode!=='off'&&input.plan.signalIds.includes(s.id)}));}
  input.main.targetMarkets=input.plan.markets;input.main.profile={...input.main.profile,targetMarkets:input.plan.markets.join('; ')};
  status='running';state.phase='companies';state.blocker=null;state.people={};state.buyerIndex=0;
 }else if(body.action==='pause'){
  if(status!=='running')throw fail('Task is not running.');status='paused';state.blocker=null;
 }else if(['resume','extend'].includes(body.action)){
  if(!['paused','blocked'].includes(status))throw fail('Only stopped tasks can continue.');
  // Resume never silently increases the original company-operation allowance.
  if(state.listId){const list=await readCompanyList(env,w,state.listId);if(list&&list.progress.operations>=list.progress.allowance){if(body.action!=='extend')throw fail('The reviewed operation allowance is exhausted. Review an additional allowance to continue.');state.allowanceTarget=list.progress.operations+input.plan.budget;}else if(body.action==='extend')throw fail('The current research allowance has not been exhausted.');}
  const evidenceOnly=state.blocker?.code==='shortfall';status='running';state.blocker=null;state.resume=!evidenceOnly;
 }else throw fail('Unsupported task command.',400);
 const other=status==='running'&&await sql(env,"SELECT id FROM copilot_research_tasks WHERE workspace_id=? AND status='running' AND id<>?",w,id).first();if(other)throw fail('Another research task is running. Pause or finish it first.');
 const result=await sql(env,`UPDATE copilot_research_tasks SET last_error=NULL,input_json=?,state_json=?,status=?,requested_by=?,session_hash=?,lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND workspace_id=? AND revision=? AND EXISTS(SELECT 1 FROM sessions sess JOIN workspace_members mem ON mem.user_id=sess.user_id WHERE sess.token_hash=? AND sess.user_id=? AND sess.expires_at>datetime('now') AND mem.workspace_id=? AND mem.role IN ('owner','researcher','sales'))`,JSON.stringify(input),JSON.stringify(state),status,user.id,user.hash,id,w,row.revision,user.hash,user.id,w).run();if(!result.meta.changes)throw fail('Task changed before the command was saved.');
 if(status==='paused')await stopChildren(env,row);
 return readResearchTask(env,w,id);
}
export async function taskBuyers(env,w,candidate,plan){
 const {contactOptions}=await loadBuyerContactContext(env,{workspaceId:w},candidate);
 return (candidate.people||[]).filter(p=>D.qualifyBuyer(p,{decisionMakers:plan.roles},candidate).eligible).map(p=>{
  const contact=contactOptions.contactForPerson(p),phone=D.confirmedBuyerPhone(candidate,p,contact,contactOptions),provider=phone&&contact.phone_status==='verified'&&contact.phone_number===phone&&['apollo','treg'].includes(contact.source);
  return {id:p.id,name:p.publicName||p.name,role:p.title,phone,phoneStatus:phone?(provider?'provider_verified':'named_public_source'):'unconfirmed',phoneSource:phone?(provider?contact.source:p.publicPhoneUrl):'',relevance:D.qualifyBuyer(p,{decisionMakers:plan.roles},candidate).total};
 }).filter(p=>plan.phoneEvidence==='none'||p.phone&&(plan.phoneEvidence!=='provider_verified'||p.phoneStatus==='provider_verified')).sort((a,b)=>b.relevance-a.relevance).slice(0,plan.buyerCount);
}
export async function runResearchTasks(env,{now=Date.now(),jobId}={}){
 const budget=env.bookInvocationBudget;if(budget&&!budget.admit(50))return [];
 let row;const token=crypto.randomUUID();
 try{
  row=await sql(env,`UPDATE copilot_research_tasks SET lease_token=?,lease_until=? WHERE id=(SELECT id FROM copilot_research_tasks WHERE status='running' AND lease_until<? ${jobId?'AND id=?':''} ORDER BY updated_at,rowid LIMIT 1) RETURNING *`,token,now+45000,now,...(jobId?[jobId]:[])).first();if(!row)return [];
  const {plan,main}=parse(row.input_json),s=parse(row.state_json),w=row.workspace_id,user={id:row.requested_by,hash:row.session_hash,sessionTokenHash:row.session_hash,role:(await sql(env,'SELECT role FROM workspace_members WHERE workspace_id=? AND user_id=?',w,row.requested_by).first())?.role,taskId:row.id};
  const guard=async()=>{if(!await sql(env,`SELECT id FROM copilot_research_tasks WHERE id=? AND lease_token=? AND status='running' AND ${authority}`,row.id,token).first())throw fail('Research authorization changed.',403);};
  const checkpoint=async(status='running')=>{const changed=await sql(env,`UPDATE copilot_research_tasks SET state_json=?,status=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running' AND ${authority}`,JSON.stringify(s),status,row.id,token).run();if(!changed.meta.changes)throw fail('Research authorization changed.',403);};
  try{
   await guard();
   if(!s.listId){
    const list=await startCompanyList(env,w,user,{...plan,name:'Ask LeadIntel · '+parse(row.input_json).flowName},{taskId:row.id,id:row.id+'-companies',options:M.options(main)});
    await guard();s.listId=list.id;await checkpoint();return [row.id];
   }
   const list=await readCompanyList(env,w,s.listId);if(!list)throw fail('The saved company list is unavailable.');
   if(active(list.status))return [row.id];
   if(list.status!=='complete'){
    if(s.resume){await guard();const stateRow=await sql(env,'SELECT state_json FROM company_lists WHERE id=? AND workspace_id=?',list.id,w).first(),ls=parse(stateRow.state_json);ls.reason='Continuing the reviewed task';ls.failureCode='';ls.failures=0;ls.retryKey='';ls.nextAttemptAt=0;if(s.allowanceTarget)ls.allowance=Math.max(ls.allowance,s.allowanceTarget);if(ls.phase==='exhausted')throw fail('The selected research plan is exhausted. Review the criteria.');await sql(env,"UPDATE company_lists SET status='queued',state_json=?,last_error=NULL,requested_by=?,session_hash=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM copilot_research_tasks WHERE id=? AND status='running' AND lease_token=?)",JSON.stringify(ls),user.id,user.hash,list.id,list.revision,row.id,token).run();s.resume=false;delete s.allowanceTarget;await checkpoint();return [row.id];}
    throw Object.assign(fail(list.progress.reason||'Company research did not reach the requested count.'),{code:list.failureCode});
   }
   if(!plan.buyerCount){s.phase='done';s.blocker=null;await checkpoint('complete');return [row.id];}
   s.phase='buyers';s.people||={};s.buyerIndex||=0;
   const total=list.results.slice(0,s.buyerIndex).reduce((n,c)=>n+(s.people[c.domain]?.length||0),0);
   if(s.buyerIndex>=plan.buyerCompanies||plan.buyerScope==='total'&&total>=plan.buyerCount){s.phase='done';s.blocker=null;await checkpoint('complete');return [row.id];}
   const company=list.results[s.buyerIndex];if(!company)throw fail('Ranked company context is missing.');
   if(plan.paidMode==='saved_policy'&&JSON.stringify(await readAdditionalContactPolicy(env,w))!==JSON.stringify(s.options.policy))throw fail('Paid provider permissions or limits changed. Create a new reviewed task to use the changed policy.');
   if(!s.buyerJobId){
    const previous=await readBuyerJob(env,w,{domain:company.domain});if(previous&&active(previous.status)&&parse(previous.input_json).taskId!==row.id)throw fail('Another buyer job is running for '+company.company+'. Finish or pause it before continuing.');
    // Buyer research has an explicit CRM handoff in the reviewed Run summary.
    const listRow=await sql(env,'SELECT * FROM company_lists WHERE workspace_id=? AND id=?',w,list.id).first();await guard();const [saved]=await saveRows(env,listRow,user,company.domain);await guard();
    const job=previous&&parse(previous.input_json).taskId===row.id?previous:await startBuyerJob(env,w,user,{candidate:{...saved,market:company.market,buyerRoles:plan.roles},paidResearch:plan.paidMode==='saved_policy',resumeIncomplete:true},{taskId:row.id,email:plan.phoneEvidence==='none',phone:plan.phoneEvidence!=='none',buyerCount:plan.buyerCount});
    await guard();s.buyerJobId=job.id;s.buyerProgress='Researching decision-makers at '+company.company;await checkpoint();return [row.id];
   }
   const job=await readBuyerJob(env,w,{id:s.buyerJobId});if(!job)throw fail('Saved buyer research is unavailable.');
   if(active(job.status)){const view=await publicBuyerJob(env,job);s.buyerProgress=company.company+' · '+view.progress.label;await checkpoint();return [row.id];}
   const view=await publicBuyerJob(env,job),people=await taskBuyers(env,w,view.candidate,{...plan,buyerCount:plan.buyerScope==='total'?Math.max(0,plan.buyerCount-total):plan.buyerCount});s.people[company.domain]=people;
   const researchPassed=view.quality.researchPassed&&view.quality.aiReviewStatus==='complete',paid=view.candidate.publicResearch?.paidResearch;
   if(!researchPassed||paid&&['blocked','failed','pending'].includes(paid.status)){
    if(s.resume){await guard();await commandBuyerJob(env,w,user,{action:'resume',jobId:job.id,expectedRevision:job.revision});s.resume=false;await checkpoint();return [row.id];}
    throw Object.assign(fail(paid?.reason||view.diagnostics.at(-1)?.reason||view.quality.gaps.join(' · ')||'Required research checks remain incomplete.'),{code:paid?.code});
   }
   if(people.length<plan.buyerCount&&plan.buyerScope==='per_company'||plan.buyerScope==='total'&&s.buyerIndex+1>=plan.buyerCompanies&&total+people.length<plan.buyerCount)throw Object.assign(fail(`Only ${people.length} decision-makers at ${company.company} meet the requested evidence. Review saved results and the missing phone or role evidence.`),{code:'shortfall'});
   s.buyerIndex++;s.buyerJobId='';s.resume=false;await checkpoint();
  }catch(e){
   s.blocker=T.issue({code:e.code||e.status,message:e.status?e.message:'A required provider check failed. The exact cause is not yet confirmed. Review connections and saved results.'});
   if(e.code==='shortfall')s.blocker.code='shortfall';
   const alive=await sql(env,`SELECT id FROM copilot_research_tasks WHERE id=? AND lease_token=? AND status='running' AND ${authority}`,row.id,token).first();
   if(alive)await checkpoint('blocked');else await sql(env,"UPDATE copilot_research_tasks SET status='blocked',state_json=json_set(state_json,'$.blocker',json(?)),revision=revision+1 WHERE id=? AND lease_token=? AND status='running'",JSON.stringify(T.issue({code:'connection',message:'Research permission changed. Sign in and review access before continuing.'})),row.id,token).run();
   await stopChildren(env,row);
  }
  return [row.id];
 }catch(e){if(row){await sql(env,"UPDATE copilot_research_tasks SET status='blocked',last_error=?,revision=revision+1 WHERE id=? AND lease_token=? AND status='running'",/WORKSPACE_STORAGE_FULL/.test(e.message)?'storage_full':'processing_failed',row.id,token).run();await stopChildren(env,row);return [row.id];}throw e;}finally{if(row)await sql(env,'UPDATE copilot_research_tasks SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?',row.id,token).run();budget?.release(50);}
}
