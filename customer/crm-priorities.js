(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelCrmPriorities=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const identity=s=>JSON.stringify([s?.authenticated===true,s?.workspaceId||'',s?.userId||'']);
 const eligible=c=>Boolean(c?.id&&c.pipeline_stage&&!['Won','Lost'].includes(c.pipeline_stage)&&!['archived','suppressed','customer'].includes(c.lifecycle_status));
 const day=(value,timezone)=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}catch{return null;}};
 function derivePriorities({companies=[],conversations=[],details={},now=Date.now()}={}){
  const clock=new Date(now).getTime(),result={due:[],review:[],blocked:[],upcoming:[]};
  for(const c of conversations){
   const base={conversationId:c.id,companyId:c.companyId,domain:c.domain,recipient:c.recipient,title:c.subject||c.recipient||c.domain||'Tracked conversation',nextAction:c.nextAction||'Review the saved conversation',timezone:c.timezone||'UTC'};
   const pending=c.task?.status&&c.task.status!=='done',dueAt=c.task?.dueAt||c.dueAt,stamp=Date.parse(dueAt),blocked=['suppressed','bounced'].includes(c.status)||['needs_review','paused','failed','ambiguous'].includes(c.plan?.status)||Boolean(c.syncError||c.crmSyncError);
   if(blocked)result.blocked.push({...base,kind:'conversation_blocked',label:c.status==='suppressed'?'Outreach stopped · rejection / opt-out':c.status==='bounced'?'Address review needed':c.plan?.status==='needs_review'?'Follow-ups held for review':'Conversation check needs review',reason:c.plan?.error||c.syncError||c.crmSyncError||c.reason||'Review the saved state before further outreach.'});
   if(pending){
    const item={...base,kind:'reminder',label:'Internal review task',dueAt};
    if(Number.isFinite(stamp)){
     if(stamp<clock)result.due.push({...item,timing:'overdue'});
     else if(day(stamp,c.timezone)&&day(stamp,c.timezone)===day(clock,c.timezone))result.due.push({...item,timing:'today'});
     else result.upcoming.push({...item,timing:'upcoming'});
    }else if(!blocked)result.review.push({...item,kind:c.latestReply?'reply':'review',label:c.latestReply?'Reply needs review':'Next action needs review'});
   }else if(!c.task&&c.latestReply&&c.status==='needs_review'&&!blocked)result.review.push({...base,kind:'reply',label:'Reply needs review'});
   if(c.plan?.status==='active'){
    const step=(c.plan.steps||[]).filter(s=>['queued','sending'].includes(s.status)&&Number.isFinite(Date.parse(s.scheduledAt))).sort((a,b)=>Date.parse(a.scheduledAt)-Date.parse(b.scheduledAt))[0];
    if(step){const stamp=Date.parse(step.scheduledAt),item={...base,kind:'scheduled',label:'Approved follow-up schedule',dueAt:step.scheduledAt,nextAction:'Review the approved schedule and latest Gmail check; delivery safeguards still apply.'};if(stamp<clock)result.due.push({...item,timing:'overdue'});else if(day(stamp,c.timezone)&&day(stamp,c.timezone)===day(clock,c.timezone))result.due.push({...item,timing:'today'});else result.upcoming.push({...item,timing:'upcoming'});}
   }
  }
  for(const c of companies){const detail=details[c.id];if(!eligible(c)||!detail||!Array.isArray(detail.contacts))continue;const contacts=detail.contacts.filter(x=>!x.archived_at);if(!contacts.some(x=>String(x.work_email||x.normalized_email||'').trim()))result.blocked.push({kind:'no_email',companyId:c.id,title:c.company_name||c.normalized_domain||'Saved company',label:'No email saved',reason:contacts.length?'Saved contacts have no email address.':'No active contacts are saved.',nextAction:'Open the company and review decision-makers and contact evidence.'});}
  const sort=(a,b)=>(Date.parse(a.dueAt)||Infinity)-(Date.parse(b.dueAt)||Infinity)||String(a.title).localeCompare(String(b.title))||String(a.conversationId||a.companyId).localeCompare(String(b.conversationId||b.companyId));
  Object.values(result).forEach(rows=>rows.sort(sort));return result;
 }
 function createController({capture,listCompanies,listConversations,getCompany,onChange=()=>{},now=()=>Date.now(),contactLimit=20}={}){
  let version=0,key='',state;
  const empty=()=>({loading:false,loaded:false,companies:[],conversations:[],details:{},errors:{companies:false,conversations:false},companyHasMore:false,contactChecked:0,contactFailed:0,contactEligible:0,updatedAt:null,priorities:derivePriorities()});
  state=empty();
  const emit=()=>onChange(state);
  function reset(){++version;key=identity(capture?.());state=empty();emit();}
  const current=(token,scopeKey)=>{if(token!==version)return false;if(scopeKey!==identity(capture?.())){reset();return false;}return true;};
  async function refresh(){
   const scope=capture?.()||{},next=identity(scope);if(key!==next){reset();key=next;}
   const token=++version;state=empty();if(!scope.authenticated||!scope.workspaceId||!scope.userId){emit();return;}state.loading=true;emit();
   const read=async fn=>fn();
   const results=await Promise.allSettled([read(()=>listCompanies({limit:100})),read(()=>listConversations())]);
   if(!current(token,next))return;
   const [companyResult,conversationResult]=results;
   if(companyResult.status==='fulfilled'&&companyResult.value?.ok!==false&&Array.isArray(companyResult.value?.companies)){state.companies=companyResult.value.companies;state.companyHasMore=Boolean(companyResult.value.next_cursor);}else state.errors.companies=true;
   if(conversationResult.status==='fulfilled'&&conversationResult.value?.ok!==false&&Array.isArray(conversationResult.value?.conversations))state.conversations=conversationResult.value.conversations;else state.errors.conversations=true;
   const candidates=state.companies.filter(eligible);state.contactEligible=candidates.length;
   for(let index=0;index<Math.min(candidates.length,contactLimit);index+=4){
    if(!current(token,next))return;
    const batch=candidates.slice(index,Math.min(index+4,contactLimit));const details=await Promise.allSettled(batch.map(c=>read(()=>getCompany(c.id))));
    if(!current(token,next))return;
    details.forEach((r,i)=>{if(r.status==='fulfilled'&&r.value?.ok!==false&&Array.isArray(r.value?.contacts)){state.details[batch[i].id]=r.value;state.contactChecked++;}else state.contactFailed++;});
   }
   if(!current(token,next))return;state.loading=false;state.loaded=true;state.updatedAt=new Date(now()).toISOString();state.priorities=derivePriorities({...state,now:now()});emit();
  }
  return {refresh,reset,snapshot:()=>{if(key!==identity(capture?.()))reset();return state;}};
 }
 return {derivePriorities,createController};
});
