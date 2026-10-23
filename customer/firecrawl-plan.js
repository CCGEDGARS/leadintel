(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LeadIntelFirecrawlPlan=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  // Firecrawl prices and rate limits as published (docs.firecrawl.dev/billing and /rate-limits, read 2026-10-23):
  // 1 credit per scraped page; a search costs 2 credits per 10 results (rounded up) plus 1 credit per result it
  // scrapes; limits are requests per minute per endpoint and depend on the plan, which the credit-usage endpoint
  // only reveals through the monthly allotment. The backend gate (firecrawl-rate-gate.js) uses the same table, so
  // the minutes shown here are the minutes a run will actually take once it is paced to the plan.
  const PLANS=Object.freeze([
    Object.freeze({name:'Free',credits:1000,search:10,scrape:10}),
    Object.freeze({name:'Hobby',credits:5000,search:100,scrape:100}),
    Object.freeze({name:'Standard',credits:100000,search:500,scrape:500}),
    Object.freeze({name:'Growth',credits:500000,search:5000,scrape:5000}),
    Object.freeze({name:'Scale',credits:1000000,search:10000,scrape:10000}),
  ]);
  // The largest plan whose allotment is at or below the reported credits: a Free key topped up to 1 500 keeps
  // Free limits. Unknown or zero credits → null (no plan claim is made).
  function planFromCredits(planCredits){
    const credits=Number(planCredits);
    if(!Number.isFinite(credits)||credits<=0)return null;
    let match=PLANS[0];for(const plan of PLANS)if(credits>=plan.credits)match=plan;
    return match;
  }
  function planFromStatus(status){
    const list=Array.isArray(status?.providers)?status.providers:Array.isArray(status)?status:Object.values(status||{});
    const firecrawl=list.find(item=>item&&typeof item==='object'&&item.provider==='firecrawl');
    const metadata=firecrawl?.metadata&&typeof firecrawl.metadata==='object'?firecrawl.metadata:{};
    const remaining=Number(metadata.remaining_credits);
    return {plan:planFromCredits(metadata.plan_credits),remainingCredits:Number.isFinite(remaining)?remaining:null};
  }
  function creditsForSearch(results=10,{scrapeResults=true}={}){
    const n=Math.max(1,Math.floor(Number(results)||1));
    return 2*Math.ceil(n/10)+(scrapeResults?n:0);
  }
  // {searches, resultsPerSearch, pages, scrapeResults} → upper bound of credits for a run.
  function estimateCredits({searches=0,resultsPerSearch=10,pages=0,scrapeResults=true}={}){
    const s=Math.max(0,Math.floor(Number(searches)||0)),p=Math.max(0,Math.floor(Number(pages)||0));
    return s*creditsForSearch(resultsPerSearch,{scrapeResults})+p;
  }
  // Minutes the run needs once every request is paced to the plan (the gate serialises per endpoint and minute).
  function minutesOnPlan({searches=0,pages=0}={},plan){
    if(!plan)return null;
    const s=Math.max(0,Number(searches)||0),p=Math.max(0,Number(pages)||0);
    return Math.max(1,Math.ceil(Math.max(s/plan.search,p/plan.scrape)));
  }
  const number=value=>new Intl.NumberFormat('en-GB').format(Math.round(Number(value)||0));
  // One sentence for a paid button: credits always, minutes and plan only when the plan is known.
  function describe(run,plan,{remainingCredits=null}={}){
    const credits=estimateCredits(run);
    let text=`up to ${number(credits)} Firecrawl credit${credits===1?'':'s'}`;
    const minutes=minutesOnPlan(run,plan);
    if(plan&&minutes!=null)text+=` · about ${minutes} min on the ${plan.name} plan (${number(plan.search)} searches/min)`;
    if(Number.isFinite(Number(remainingCredits))&&remainingCredits!=null){
      const left=Number(remainingCredits);
      text+=left<credits?` · only ${number(left)} remaining — this run may stop early`:` · ${number(left)} remaining`;
    }
    return {credits,minutes,text};
  }
  return {PLANS,planFromCredits,planFromStatus,creditsForSearch,estimateCredits,minutesOnPlan,describe};
});
