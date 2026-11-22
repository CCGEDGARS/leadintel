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
export function buyerCreditWindowKey(row={},input={}){return String(input.executionWindowStartedAt||row.created_at||'');}
const empty=()=>({reported:0,unreported:0,requests:0,unreportedRequests:0});
const add=(sum,value)=>{for(const key of Object.keys(sum))sum[key]+=Number(value[key])||0;return sum;};
export function createBuyerCreditMeter(env,jobId,windowKey){
  // A count that could not be written waits here and goes in with the next one, or when the slice ends.
  let pending=empty();
  const write=async()=>{
    if(!pending.requests)return;
    const batch=pending;pending=empty();
    try{
      await env.DB.prepare('INSERT INTO buyer_research_credits(job_id,window_started_at,reported,unreported,requests,unreported_requests) VALUES(?,?,?,?,?,?) ON CONFLICT(job_id,window_started_at) DO UPDATE SET reported=reported+excluded.reported,unreported=unreported+excluded.unreported,requests=requests+excluded.requests,unreported_requests=unreported_requests+excluded.unreported_requests,updated_at=CURRENT_TIMESTAMP').bind(jobId,windowKey,batch.reported,batch.unreported,batch.requests,batch.unreportedRequests).run();
    }catch{add(pending,batch);}
  };
  return {jobId,windowKey,
    async charge({reported=null,worstCase=0}={}){
      const known=reported!==null&&Number.isFinite(Number(reported))&&Number(reported)>=0;
      add(pending,{reported:known?Number(reported):0,unreported:known?0:Math.max(0,Number(worstCase)||0),requests:1,unreportedRequests:known?0:1});
      await write();
    },
    // The end of a processing slice: one more attempt for whatever is still waiting.
    flush:write};
}
export async function readBuyerCredits(env,jobId,windowKey){
  const rows=(await env.DB.prepare('SELECT window_started_at,reported,unreported,requests,unreported_requests FROM buyer_research_credits WHERE job_id=?').bind(jobId).all()).results||[];
  const sum=list=>{const total=list.reduce((all,row)=>add(all,{reported:row.reported,unreported:row.unreported,requests:row.requests,unreportedRequests:row.unreported_requests}),empty());return {...total,used:total.reported+total.unreported};};
  return {window:sum(rows.filter(row=>row.window_started_at===windowKey)),total:sum(rows)};
}
