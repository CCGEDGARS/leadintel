// Per-workspace gate in front of every Firecrawl search/scrape call made with a customer's key.
// Firecrawl counts rate limits per TEAM per minute per endpoint (docs.firecrawl.dev/rate-limits), so the only
// place that sees every request of one customer key — all tabs, all devices — is this Worker. The gate:
//  1. admits at most the plan's requests per sliding minute (previous+current window approximation held in ONE
//     D1 row per workspace+kind; the plan is read from the credit-usage data saved with the key),
//  2. lets callers WAIT for the next free slot (bounded by their own deadline) instead of failing,
//  3. remembers the "retry after" announced by an upstream 429 so concurrent requests stop hammering an
//     exhausted limit (and stop burning credits on half-finished runs).
// Every storage problem fails open: a D1 hiccup must never block research the customer asked and pays for.
export const FIRECRAWL_WINDOW_MS=60000;
export const FIRECRAWL_DEFAULT_RETRY_AFTER_MS=30000;
export const FIRECRAWL_MAX_RETRY_AFTER_MS=120000;
const MIN_RETRY_AFTER_MS=250,RESERVE_ATTEMPTS=16;
// Monthly plan credits → requests per minute on /search and /scrape and concurrent browsers
// (docs.firecrawl.dev/rate-limits + /billing, read 2026-10-23). Credits are the only plan signal the
// credit-usage endpoint returns, so a plan is identified by its monthly allotment. The LARGEST plan whose
// allotment is ≤ the reported credits wins: a Free key topped up to 1 500 credits still has Free limits, and
// an allotment no current plan has (legacy 3 000) gets the limits of the plan below it — being too slow costs
// nothing, being too fast costs 429s.
export const FIRECRAWL_PLAN_LIMITS=Object.freeze([
  Object.freeze({name:'Free',credits:1000,search:10,scrape:10,concurrency:2}),
  Object.freeze({name:'Hobby',credits:5000,search:100,scrape:100,concurrency:5}),
  Object.freeze({name:'Standard',credits:100000,search:500,scrape:500,concurrency:25}),
  Object.freeze({name:'Growth',credits:500000,search:5000,scrape:5000,concurrency:50}),
  Object.freeze({name:'Scale',credits:1000000,search:10000,scrape:10000,concurrency:100}),
]);
export function firecrawlPlanLimits(planCredits){
  const credits=Number(planCredits);
  if(!Number.isFinite(credits)||credits<=0)return null; // unknown plan: reactive mode only (upstream 429 blocks)
  let match=FIRECRAWL_PLAN_LIMITS[0];
  for(const plan of FIRECRAWL_PLAN_LIMITS)if(credits>=plan.credits)match=plan;
  return match;
}
export function firecrawlPlanFromRow(row){
  let metadata={};try{metadata=JSON.parse(row?.metadata_json||'{}')||{};}catch{return null;}
  return firecrawlPlanLimits(metadata.plan_credits);
}
const clampRetry=ms=>Math.max(MIN_RETRY_AFTER_MS,Math.min(FIRECRAWL_MAX_RETRY_AFTER_MS,Math.round(Number(ms)||0)));
// Weighted count of the sliding minute ending at `now`: the previous window counts proportionally to how much
// of it still overlaps the last 60 s.
function slidingEstimate(prev,count,windowStart,now){return prev*Math.max(0,1-(now-windowStart)/FIRECRAWL_WINDOW_MS)+count;}
// Reserves ONE request atomically (optimistic update guarded by the row values that were read). Returns
// {allowed,retryAfterMs,reason,estimate}. Refusals never change the row, so waiting callers do not inflate it.
export async function reserveFirecrawlRequest(env,workspaceId,kind,{limit=null,now=Date.now()}={}){
  try{
    for(let attempt=0;attempt<RESERVE_ATTEMPTS;attempt++){
      const row=await env.DB.prepare('SELECT window_started_at,count,prev_count,blocked_until FROM firecrawl_rate_gate WHERE workspace_id=? AND kind=?').bind(workspaceId,kind).first();
      if(!row){await env.DB.prepare('INSERT OR IGNORE INTO firecrawl_rate_gate(workspace_id,kind,window_started_at,count,prev_count) VALUES(?,?,?,0,0)').bind(workspaceId,kind,now).run();continue;}
      const blockedUntil=Number(row.blocked_until)||0;
      if(blockedUntil>now)return {allowed:false,retryAfterMs:blockedUntil-now,reason:'upstream_429',estimate:null};
      let windowStart=Number(row.window_started_at)||now,count=Number(row.count)||0,prev=Number(row.prev_count)||0;
      const elapsed=now-windowStart;
      if(elapsed>=2*FIRECRAWL_WINDOW_MS){prev=0;count=0;windowStart=now;}
      else if(elapsed>=FIRECRAWL_WINDOW_MS){prev=count;count=0;windowStart+=FIRECRAWL_WINDOW_MS;}
      const estimate=slidingEstimate(prev,count+1,windowStart,now);
      if(limit!=null&&Number.isFinite(Number(limit))&&estimate>Number(limit)){
        const inWindow=now-windowStart,free=Number(limit)-count-1;
        // Wait until the previous window has decayed enough for one slot, or until the current window rolls over.
        const decayWait=prev>0&&free>=0?Math.ceil(FIRECRAWL_WINDOW_MS*(1-free/prev))-inWindow:Infinity;
        const rolloverWait=FIRECRAWL_WINDOW_MS-inWindow;
        return {allowed:false,retryAfterMs:clampRetry(Math.min(decayWait,rolloverWait)),reason:'plan_limit',estimate};
      }
      const written=await env.DB.prepare('UPDATE firecrawl_rate_gate SET window_started_at=?,count=?,prev_count=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND kind=? AND window_started_at=? AND count=?').bind(windowStart,count+1,prev,workspaceId,kind,row.window_started_at,row.count).run();
      if(Number(written?.meta?.changes)===1)return {allowed:true,retryAfterMs:0,reason:'admitted',estimate};
    }
    return {allowed:false,retryAfterMs:MIN_RETRY_AFTER_MS,reason:'contention',estimate:null};
  }catch{return {allowed:true,retryAfterMs:0,reason:'storage_error',estimate:null};}
}
// Records an upstream 429: nobody on this workspace+kind goes to Firecrawl before `now+retryAfterMs`.
// A longer existing block is kept. Returns the block end (epoch ms).
export async function recordFirecrawlRateLimit(env,workspaceId,kind,retryAfterMs,{now=Date.now()}={}){
  const until=now+Math.max(1000,Math.min(FIRECRAWL_MAX_RETRY_AFTER_MS,Math.round(Number(retryAfterMs))||FIRECRAWL_DEFAULT_RETRY_AFTER_MS));
  try{await env.DB.prepare('INSERT INTO firecrawl_rate_gate(workspace_id,kind,window_started_at,count,prev_count,blocked_until) VALUES(?,?,?,0,0,?) ON CONFLICT(workspace_id,kind) DO UPDATE SET blocked_until=MAX(COALESCE(firecrawl_rate_gate.blocked_until,0),excluded.blocked_until),updated_at=CURRENT_TIMESTAMP').bind(workspaceId,kind,now,until).run();}catch{}
  return until;
}
// Firecrawl announces the wait in a Retry-After header and/or in the message ("… retry after 43 s").
export function parseRetryAfterMs(response,payload,{now=Date.now()}={}){
  const header=response?.headers?.get?.('Retry-After');
  if(header){const seconds=Number(header);if(Number.isFinite(seconds)&&seconds>0)return clampRetry(seconds*1000);const date=Date.parse(header);if(Number.isFinite(date))return clampRetry(date-now);}
  const text=typeof payload==='string'?payload:JSON.stringify(payload||'');
  const match=/retry after (\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?)?\b/i.exec(text);
  if(match){const n=Number(match[1]),unit=(match[2]||'s').toLowerCase();return clampRetry(unit.startsWith('ms')||unit.startsWith('milli')?n:unit.startsWith('m')?n*60000:n*1000);}
  return FIRECRAWL_DEFAULT_RETRY_AFTER_MS;
}
const defaultSleep=(ms,signal)=>new Promise(resolve=>{const timer=setTimeout(resolve,ms);signal?.addEventListener?.('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
// Waits for a slot while the caller's deadline allows. Returns {allowed,waitedMs,retryAfterMs,reason,aborted}.
export async function acquireFirecrawlSlot(env,workspaceId,kind,{limit=null,signal,deadlineMs=0,now=()=>Date.now(),sleep=defaultSleep}={}){
  const started=now();let waitedMs=0;
  for(;;){
    if(signal?.aborted)return {allowed:false,aborted:true,waitedMs,retryAfterMs:0,reason:'aborted'};
    const slot=await reserveFirecrawlRequest(env,workspaceId,kind,{limit,now:now()});
    if(slot.allowed)return {...slot,aborted:false,waitedMs};
    const remaining=Number(deadlineMs)-(now()-started);
    if(!(slot.retryAfterMs<=remaining))return {...slot,aborted:false,waitedMs};
    await sleep(slot.retryAfterMs,signal);waitedMs+=slot.retryAfterMs;
  }
}
