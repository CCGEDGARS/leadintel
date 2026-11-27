import {FIRECRAWL_RECEIPT_EVENT,FIRECRAWL_PURPOSES} from './firecrawl-request.js';

const DAY=86400000,MAX_ROWS=10000;
const parse=value=>{try{return JSON.parse(value||'{}')||{};}catch{return {};}};
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const kinds=new Set(['search','scrape','enrich']);
const outcomes=new Set(['succeeded','failed','credits_exhausted','rate_limited_upstream','rate_limited_locally','interrupted','network_error']);
const labels={interactive_research:'interactive research',buyer_research:'buyer research',company_list:'company lists',company_dossier:'company dossiers',website_contacts:'website contacts',assistant_research:'Ask LeadIntel research',market_monitoring:'market monitoring',approved_workflow:'approved workflows',source_health:'source checks',email_source_check:'email-source checks'};
export function isFirecrawlUsageQuestion(question,conversation=[]){
  const q=String(question||'');
  const provider=/fire\s*crawl|firacrawl|firacracwl/i;
  const usage=/credits?|quota|balance|billing|usage|spent|spend|consum|ran out|run out|exhaust|burn|charged|duplicat|retr(?:y|ies)|кредит|расход|баланс|kredīt|kredit|patēriņ/i;
  if(!usage.test(q))return false;
  // Pricing and future workload estimates still use the ordinary adviser. Account
  // consumption cannot be established by web research; diagnose it from receipts.
  if(/\b(?:price|pricing|plans?|subscriptions?|buy|purchase|top.?up|upgrade|cost)\b/i.test(q)&&!/\b(?:why|used|usage|spent|consum\w*|ran out|run out|exhaust\w*|burn\w*|remaining|balance|deduct\w*|charged|disappear\w*)\b/i.test(q))return false;
  return provider.test(q)||(!/openai|apollo|hunter|treg|anthropic|gemini/i.test(q)&&conversation.slice(-4).some(m=>m.role==='user'&&provider.test(String(m.content||''))));
}
export function firecrawlUsageWindow(question='',now=Date.now()){
  const q=String(question),iso=/\b(20\d{2}-\d{2}-\d{2})\b/.exec(q);
  if(iso){const from=Date.parse(iso[1]+'T00:00:00Z');if(Number.isFinite(from)&&new Date(from).toISOString().slice(0,10)===iso[1])return {from,to:Math.min(now,from+DAY),label:iso[1]+' (UTC)'};}
  const duration=/\b(\d{1,4})\s*(minutes?|mins?|hours?|hrs?|days?)\b/i.exec(q);
  const ms=duration?Math.max(60000,Math.min(30*DAY,Number(duration[1])*(/^d/i.test(duration[2])?DAY:/^h/i.test(duration[2])?3600000:60000))):/\btoday\b/i.test(q)?now-Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z'):600000;
  return {from:now-ms,to:now,label:duration?'last '+(ms%DAY===0?ms/DAY+' days':ms%3600000===0?ms/3600000+' hours':Math.round(ms/60000)+' minutes'):/\btoday\b/i.test(q)?'today (UTC)':'last 10 minutes'};
}
function safeReceipt(row){
  const v=parse(row.metadata_json),at=Date.parse(row.created_at);
  if(v.version!==1||!Number.isFinite(at)||!kinds.has(v.kind)||!outcomes.has(v.outcome)||typeof v.sent!=='boolean')return null;
  return {at,kind:v.kind,outcome:v.outcome,sent:v.sent,purpose:FIRECRAWL_PURPOSES.includes(v.purpose)?v.purpose:'interactive_research',fingerprint:/^[a-f0-9]{64}$/.test(v.fingerprint||'')?v.fingerprint:null,reportedCredits:finite(v.reportedCredits),estimatedCredits:finite(v.estimatedCredits),results:finite(v.results)||0};
}
function total(rows){
  const sent=rows.filter(r=>r.sent),reported=sent.filter(r=>r.reportedCredits!==null),purposes={},fingerprints=new Map();
  for(const r of sent){purposes[r.purpose]=(purposes[r.purpose]||0)+1;if(r.fingerprint)fingerprints.set(r.fingerprint,(fingerprints.get(r.fingerprint)||0)+1);}
  return {requests:sent.length,searches:sent.filter(r=>r.kind==='search').length,scrapes:sent.filter(r=>r.kind==='scrape').length,enrichments:sent.filter(r=>r.kind==='enrich').length,localBlocks:rows.length-sent.length,failed:sent.filter(r=>r.outcome!=='succeeded').length,rateLimited:sent.filter(r=>r.outcome==='rate_limited_upstream').length,creditFailures:sent.filter(r=>r.outcome==='credits_exhausted').length,reportedCredits:reported.reduce((n,r)=>n+r.reportedCredits,0),reportedRequests:reported.length,unreportedRequests:sent.length-reported.length,estimatedCredits:sent.reduce((n,r)=>n+(r.estimatedCredits||0),0),repeatedRequests:[...fingerprints.values()].reduce((n,count)=>n+Math.max(0,count-1),0),purposes:Object.entries(purposes).map(([purpose,requests])=>({purpose,requests})).sort((a,b)=>b.requests-a.requests)};
}
export async function readFirecrawlUsage(env,workspaceId,{question='',now=Date.now()}={}){
  const period=firecrawlUsageWindow(question,now),since=Math.max(now-30*DAY,Math.min(period.from,now-DAY));
  const [events,balance]=await Promise.allSettled([
    Promise.resolve().then(()=>env.DB?.prepare('SELECT metadata_json,created_at FROM audit_events WHERE workspace_id=? AND event_type=? AND created_at>=? ORDER BY created_at DESC,rowid DESC LIMIT ?').bind(workspaceId,FIRECRAWL_RECEIPT_EVENT,new Date(since).toISOString().slice(0,10),MAX_ROWS+1).all()),
    Promise.resolve().then(()=>env.DB?.prepare("SELECT metadata_json,verified_at FROM workspace_service_integrations WHERE workspace_id=? AND provider='firecrawl'").bind(workspaceId).first())
  ]);
  const available=events.status==='fulfilled'&&Array.isArray(events.value?.results),raw=available?events.value.results:[],truncated=raw.length>=MAX_ROWS,records=raw.slice(0,MAX_ROWS).map(safeReceipt).filter(Boolean),row=balance.status==='fulfilled'?balance.value:null,meta=parse(row?.metadata_json);
  const savedBalance=meta.remaining_credits!=null&&String(meta.remaining_credits).trim()!==''&&Number.isFinite(Number(meta.remaining_credits))?Number(meta.remaining_credits):null;
  return {available,checkedAt:new Date(now).toISOString(),period:{label:period.label,from:new Date(period.from).toISOString(),to:new Date(period.to).toISOString()},selected:total(records.filter(r=>r.at>=period.from&&r.at<=period.to)),last24Hours:total(records.filter(r=>r.at>=now-DAY&&r.at<=now)),truncated,retentionDays:30,recordedRows:records.length,earliestScannedAt:records.length?new Date(Math.min(...records.map(r=>r.at))).toISOString():null,balance:{remainingCredits:savedBalance,checkedAt:Number.isFinite(Date.parse(meta.credits_checked_at||row?.verified_at))?new Date(meta.credits_checked_at||row.verified_at).toISOString():null,live:false},coverage:'Recorded LeadIntel requests in this workspace only. Earlier activity, missing receipts, other apps and other workspaces using the same Firecrawl account are not fully covered. Estimates are not billed credits; provider logs are the billing reference. Repeated identical requests may be intentional and do not establish an error.'};
}
export function firecrawlUsageAnswer(report){
  const s=report.selected,b=report.balance,lines=[`Firecrawl usage — ${report.period.label}.`];
  if(!report.available)lines.push('Usage records are unavailable, so I cannot determine what was spent or whether there was an error.');
  else if(!s.requests&&!s.localBlocks)lines.push('No detailed request receipts were found for this period. This does not prove zero usage: older activity was not fully recorded.');
  else{
    lines.push(`Recorded Firecrawl attempts: ${s.requests} (searches: ${s.searches}; page extractions: ${s.scrapes}${s.enrichments?'; buyer email lookups: '+s.enrichments:''}).${s.localBlocks?' '+s.localBlocks+' requests were held locally without contacting Firecrawl.':''}`);
    lines.push(s.reportedRequests?`${s.reportedCredits} credits were explicitly reported by Firecrawl across ${s.reportedRequests} request${s.reportedRequests===1?'':'s'}. ${s.unreportedRequests?s.unreportedRequests+' requests have no reported amount; the total charge is unknown.':'This covers these recorded requests only.'}`:'Firecrawl did not report credit amounts for these requests. The actual charge is unknown.');
    if(s.unreportedRequests)lines.push(`The standard-operation estimate is ${s.estimatedCredits} credits for the recorded attempts. It is not a measured charge; PDF pages and provider options can cost more, and failed attempts may not be billed.`);
    if(s.purposes.length)lines.push('Recorded activity: '+s.purposes.slice(0,5).map(r=>`${labels[r.purpose]} ${r.requests}`).join('; ')+'.');
    if(s.repeatedRequests)lines.push(`${s.repeatedRequests} repeated identical request${s.repeatedRequests===1?' needs':'s need'} review. Repeats can be deliberate refreshes; this alone does not prove a retry bug.`);
    if(s.failed)lines.push(`${s.failed} requests failed or were interrupted; ${s.creditFailures} reported a credit/payment problem and ${s.rateLimited} reported a rate limit. A rate limit alone does not mean exhausted credits.`);
  }
  lines.push('Coverage is limited to retained LeadIntel records (up to 30 days); older or missing receipts and other apps are not included.');
  if(report.truncated)lines.push('The record limit was reached; these counts are incomplete.');
  if(b.remainingCredits!==null)lines.push(`Last saved balance: ${b.remainingCredits} credits${b.checkedAt?' (checked '+b.checkedAt+')':''}. This is not a live balance.`);
  lines.push('Public-source research still consumes provider credits; a search that extracts several results can use multiple credits.');
  lines.push('Compare the same period in Firecrawl Usage and Logs, including other apps sharing the account. Use Stop/Pause on active research or Monitoring to stop further work. After a top-up, recheck Firecrawl in Settings → Data sources.');
  lines.push('This check used saved records only and made no paid research or AI calls.');
  return lines.join('\n\n');
}
