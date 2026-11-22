// What one Buyers job spends at Firecrawl, counted where the requests are sent. One explicit start or resume of a
// job (its run window) owns one count. Requests whose cost Firecrawl did not report are counted apart, at the most
// they can have cost, so a missing figure is never shown as zero. Counting only: nothing here stops a job.
// 21 Nov 2026: one run for one small company spent about 2,700 credits; the platform's receipts saw 1,151.
export const BUYER_CREDIT_BASE=100;
export const BUYER_CREDIT_PER_PERSON=100;
// The spend a run of this size is expected to stay under: about thirteen searches for the company and thirteen
// for each person, at about four credits each, doubled. One to ten people.
export function buyerRunCreditLimit(people){
  const count=Math.floor(Number(people));
  return BUYER_CREDIT_BASE+BUYER_CREDIT_PER_PERSON*Math.max(1,Math.min(10,Number.isFinite(count)?count:1));
}
// Stage 2 (22 Nov 2026): when the count of a run window has reached that figure, the next Firecrawl request of the
// job is not sent and the job pauses; a resume starts a new window and a new count.
export const BUYER_CREDIT_LIMIT_CODE='CREDIT_LIMIT';
export const buyerCreditLimitReason=(used,limit)=>`Research paused after using about ${used} Firecrawl credits; a company of this size usually needs up to ${limit}. Saved checks and contacts are retained. Resume unfinished research when ready.`;
// BUYER_CREDIT_LIMIT_TEST="<workspace id>:<credits>" lowers the limit of that one workspace, so the pause can be
// seen in a live test workspace. It never raises a limit and never applies to another workspace.
export function buyerCreditLimitFor(env,workspaceId,people){
  const limit=buyerRunCreditLimit(people),raw=String(env?.BUYER_CREDIT_LIMIT_TEST||''),at=raw.lastIndexOf(':'),lower=raw.slice(at+1);
  return at>0&&raw.slice(0,at)===String(workspaceId)&&/^\d+$/.test(lower)&&Number(lower)>0?Math.min(limit,Number(lower)):limit;
}
export function buyerCreditWindowKey(row={},input={}){return String(input.executionWindowStartedAt||row.created_at||'');}
const empty=()=>({reported:0,unreported:0,unreportedEstimate:0,requests:0,unreportedRequests:0});
const add=(sum,value)=>{for(const key of Object.keys(sum))sum[key]+=Number(value[key])||0;return sum;};
// `spent` is what earlier slices of the same run window have counted; `limit` (a function, read at every request)
// is what the window may reach; `onLimit` is told once, when the first request is refused.
export function createBuyerCreditMeter(env,jobId,windowKey,{spent=0,limit=null,onLimit=null}={}){
  // A count that could not be written waits here and goes in with the next one, or when the slice ends.
  let pending=empty(),used=Math.max(0,Number(spent)||0),told=false;
  const write=async()=>{
    if(!pending.requests)return;
    const batch=pending;pending=empty();
    try{
      await env.DB.prepare('INSERT INTO buyer_research_credits(job_id,window_started_at,reported,unreported,unreported_estimate,requests,unreported_requests) VALUES(?,?,?,?,?,?,?) ON CONFLICT(job_id,window_started_at) DO UPDATE SET reported=reported+excluded.reported,unreported=unreported+excluded.unreported,unreported_estimate=unreported_estimate+excluded.unreported_estimate,requests=requests+excluded.requests,unreported_requests=unreported_requests+excluded.unreported_requests,updated_at=CURRENT_TIMESTAMP').bind(jobId,windowKey,batch.reported,batch.unreported,batch.unreportedEstimate,batch.requests,batch.unreportedRequests).run();
    }catch{add(pending,batch);}
  };
  return {jobId,windowKey,
    // Toward the limit a request with no reported cost counts at its ordinary price (`estimate`), not at the most
    // it can have cost: such a request was interrupted, and the two measured ones were billed one credit each.
    async charge({reported=null,worstCase=0,estimate=worstCase}={}){
      const known=reported!==null&&Number.isFinite(Number(reported))&&Number(reported)>=0;
      const cost={reported:known?Number(reported):0,unreported:known?0:Math.max(0,Number(worstCase)||0),unreportedEstimate:known?0:Math.max(0,Number(estimate)||0),requests:1,unreportedRequests:known?0:1};
      used+=cost.reported+cost.unreportedEstimate;add(pending,cost);
      await write();
    },
    // Asked before a request is sent. The runner ends the slice at the first refusal, which interrupts requests
    // still in flight, as every slice end does; Firecrawl may still bill those (about one credit each, measured).
    admit(){
      const ceiling=typeof limit==='function'?Number(limit()):NaN;
      if(!Number.isFinite(ceiling)||used<ceiling)return;
      const error=Object.assign(Error(buyerCreditLimitReason(used,ceiling)),{code:BUYER_CREDIT_LIMIT_CODE});
      if(!told){told=true;try{onLimit?.(error);}catch{ /* The refusal itself is what stops the request. */ }}
      throw error;
    },
    // The end of a processing slice: one more attempt for whatever is still waiting.
    flush:write};
}
export async function readBuyerCredits(env,jobId,windowKey){
  const rows=(await env.DB.prepare('SELECT window_started_at,reported,unreported,unreported_estimate,requests,unreported_requests FROM buyer_research_credits WHERE job_id=?').bind(jobId).all()).results||[];
  const sum=list=>{const total=list.reduce((all,row)=>add(all,{reported:row.reported,unreported:row.unreported,unreportedEstimate:row.unreported_estimate,requests:row.requests,unreportedRequests:row.unreported_requests}),empty());return {...total,used:total.reported+total.unreported,counted:total.reported+total.unreportedEstimate};};
  return {window:sum(rows.filter(row=>row.window_started_at===windowKey)),total:sum(rows)};
}
