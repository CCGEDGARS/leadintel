import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;

// Every actual attempt has a durable task receipt. Applied receipt IDs are
// checkpointed with the candidate so a resumed slice cannot double-count it.
export async function discoverApolloBuyerIdentities({candidate,profile,task,search,guard,record,observed}){
  const query=async payload=>{
    for(let attempt=1;attempt<=2;attempt++){
      const key=`Apollo people search · ${candidate.domain} · ${payload.companyNameFallback?'company name':'domain'} · attempt ${attempt}`;
      let result;try{result=await task('search',key,async()=>{
        await guard();
        try{
          const response=await search(payload);await guard();
          return {status:'succeeded',executed:true,people:(response.people||[]).slice(0,25),reason:'Identity-only discovery · 0 API credits; contact reveal is separate'};
        }catch(cause){
          await guard();
          if(['TIME_BUDGET','RUN_WINDOW','LEASE_EXPIRED','CANCELED','CONTEXT_CHANGED'].includes(cause.code))throw cause;
          const code=/^SERVICE_APOLLO_[A-Z_]+$/.test(cause.code||'')?cause.code:'SERVICE_APOLLO_UNAVAILABLE';
          const skipped=cause.executed===false;
          return {status:skipped?'skipped':'failed',executed:!skipped,people:[],code,reason:skipped?code==='SERVICE_APOLLO_DISCOVERY_DISABLED'?'Apollo people discovery is disabled':'Connect your Apollo key in Settings for free people discovery':'Apollo free people discovery was unavailable',httpStatus:cause.httpStatus||null};
        }
      },{phase:'identities'});}catch(cause){if(cause.code!=='TASK_LIMIT')throw cause;result={status:'skipped',executed:false,people:[],code:'SERVICE_APOLLO_TASK_LIMIT',reason:'Apollo discovery skipped: bounded task allowance reached'};}
      if(!observed.includes(key)){
        record({provider:'apollo',operation:'identity',status:result.status,results:result.people.length,reason:result.reason,httpStatus:result.httpStatus,code:result.code});
        observed.push(key);
      }
      if(result.status!=='failed'||attempt===2||['SERVICE_APOLLO_AUTH_FAILED','SERVICE_APOLLO_RATE_LIMIT'].includes(result.code))return result;
    }
  };
  const first=await query(D.buildApolloPeopleSearchPayload(candidate,profile));
  const fallback=first.status==='succeeded'&&first.people.length<2?await query(D.buildApolloPeopleSearchPayload(candidate,profile,{companyNameFallback:true})):null;
  const people=[...(first.people||[]),...(fallback?.people||[])];
  const trace=D.traceIdentityBuyers({people},candidate,{...profile,collectAllCompanyContacts:true});
  return {people:trace.people,diagnostics:trace.diagnostics,status:first.status==='succeeded'?'complete':first.status==='skipped'?'not_configured':'failed',results:people.length};
}
