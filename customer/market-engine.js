(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelMarket=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const DEFAULT_MARKET_STATE=Object.freeze({
    icps:[],signals:[],researchQueries:[],researchResults:[],opportunities:[],
    researchStatus:"idle",lastResearchAt:"",strategyApproved:false,strategyApprovedAt:""
  });

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function clamp(value,min,max,fallback=min){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function slug(value){return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item";}
  function splitList(value){
    if(Array.isArray(value))return [...new Set(value.map(clean).filter(Boolean))];
    return [...new Set(String(value??"").split(/\n|;|\|/).map(clean).filter(Boolean))];
  }
  function normalizeUrl(value){try{const url=new URL(clean(value));return ["http:","https:"].includes(url.protocol)?url.href:"";}catch{return "";}}
  function priorityWeight(priority){return /^high$/i.test(clean(priority))?9:/^medium$/i.test(clean(priority))?7:/^low$/i.test(clean(priority))?5:6;}
  function defaultKeywords(signal){
    const name=clean(signal?.name).replace(/\bor\b/gi,";").replace(/\band\b/gi,";");
    return [...new Set(name.split(/;|,/).map(clean).filter(Boolean))].join("; ");
  }
  function effectiveResearchMarkets(profile={}){
    const expanded=splitList(profile.researchMarkets);
    if(expanded.length)return expanded;
    const selected=splitList(profile.targetMarkets);
    return selected.length?selected:splitList(profile.currentMarkets);
  }

  function buildIcpCandidates(profile={}){
    const targetMarkets=clean(profile.targetMarkets)||splitList(profile.currentMarkets).join("; ")||"Priority markets not yet defined";
    const common={
      targetMarkets,
      buyerRoles:clean(profile.decisionMakers),
      value:clean(profile.opportunityValue),
      exclusions:clean(profile.exclusions),
      offers:clean(profile.priorityOffers),
      active:true
    };
    const result=[{
      id:"icp-core",type:"core",name:"Core ICP",...common,
      description:clean(profile.idealCustomer)||"Companies matching the approved ideal-customer definition.",
      rationale:`Directly reflects the approved ideal customer, buying roles, priority offers and commercial value for ${targetMarkets}.`
    }];
    if(clean(profile.lookalikeCustomers))result.push({
      id:"icp-lookalike",type:"lookalike",name:"Lookalike ICP",...common,
      description:`Companies with business characteristics similar to ${clean(profile.lookalikeCustomers)}.`,
      rationale:`Use ${clean(profile.lookalikeCustomers)} as commercial anchors, then look for similar organizations in ${targetMarkets}.`
    });
    result.push({
      id:"icp-trigger-led",type:"trigger-led",name:"Trigger-led ICP",...common,
      description:`Companies that fit the core profile and are currently showing relevant buying signals.`,
      rationale:`Prioritize organizations where ${clean(profile.buyingTriggers)||"a relevant buying trigger"} is visible now.`
    });
    return result;
  }

  function normalizeSignal(signal={}){
    return {
      id:clean(signal.id)||`signal-${slug(signal.name)}`,
      name:clean(signal.name)||"Unnamed signal",
      active:signal.active!==false,
      priority:["High","Medium","Low"].includes(clean(signal.priority))?clean(signal.priority):"Medium",
      weight:clamp(signal.weight,1,10,priorityWeight(signal.priority)),
      keywords:clean(signal.keywords)||defaultKeywords(signal),
      reason:clean(signal.reason)||"Customer-defined commercial trigger."
    };
  }

  function normalizeSignals(profileSignals=[],savedSignals=[]){
    const savedMap=new Map((savedSignals||[]).map(item=>[clean(item?.id),item]));
    const result=[];
    for(const seed of profileSignals||[]){
      const id=clean(seed?.id)||`signal-${slug(seed?.name)}`;
      result.push(normalizeSignal({...seed,id,...(savedMap.get(id)||{})}));
      savedMap.delete(id);
    }
    for(const saved of savedMap.values())result.push(normalizeSignal(saved));
    return result.slice(0,20);
  }

  function addCustomSignal(signals=[],input={}){
    const name=clean(input.name);
    if(!name)return {signals:[...signals],added:false,error:"Signal name is required"};
    const normalizedName=name.toLowerCase();
    if((signals||[]).some(item=>clean(item.name).toLowerCase()===normalizedName))return {signals:[...signals],added:false,error:"Signal already exists"};
    const item=normalizeSignal({
      id:`custom-${slug(name)}-${Date.now().toString(36).slice(-5)}`,
      name,active:true,priority:clean(input.priority)||"Medium",weight:input.weight,keywords:input.keywords,reason:"Customer-added signal."
    });
    return {signals:[...signals,item].slice(0,20),added:true,error:""};
  }

  function buildResearchQueries(profile={},signals=[],maxQueries=4){
    const limit=Math.max(1,Math.min(4,Number(maxQueries)||4));
    const markets=effectiveResearchMarkets(profile);
    const offers=splitList(profile.priorityOffers).length?splitList(profile.priorityOffers):["commercial opportunity"];
    const active=(signals||[]).filter(item=>item.active!==false).sort((a,b)=>Number(b.weight)-Number(a.weight));
    const signalTerms=active.slice(0,3).map(item=>splitList(String(item.keywords||"").replace(/,/g,";"))[0]||item.name).filter(Boolean).join(" ");
    const marketFocus=clean(profile.marketFocus);
    const results=[];
    for(const market of (markets.length?markets:["priority market"])){
      for(const offer of offers){
        if(results.length>=limit)break;
        const query=[market,offer,marketFocus,clean(profile.idealCustomer),signalTerms,"investment expansion tender 2026"].filter(Boolean).join(" ");
        results.push({id:`q-${slug(market)}-${results.length+1}`,market,offer,query});
      }
      if(results.length>=limit)break;
    }
    return results;
  }

  function normalizeSearchResults(payload={},queryMeta={}){
    const raw=Array.isArray(payload?.data)?payload.data:Array.isArray(payload?.data?.web)?payload.data.web:Array.isArray(payload?.web)?payload.web:Array.isArray(payload?.results)?payload.results:[];
    return raw.slice(0,5).map(item=>{
      const url=normalizeUrl(item?.url||item?.link||"");
      if(!url)return null;
      const description=clean(item?.description||item?.snippet||"");
      const body=clean(item?.markdown||item?.content||item?.text||description);
      return {
        queryId:clean(queryMeta.id),market:clean(queryMeta.market),query:clean(queryMeta.query),
        url,title:clean(item?.title)||new URL(url).hostname,description,
        text:body.slice(0,5000),date:clean(item?.publishedDate||item?.date||item?.published_at||item?.metadata?.publishedDate)
      };
    }).filter(Boolean);
  }

  function recentScore(evidence){
    if(!evidence.length)return 6;
    const now=Date.now();
    const ages=evidence.map(item=>Date.parse(item.date)).filter(Number.isFinite).map(ts=>Math.max(0,(now-ts)/86400000));
    if(!ages.length)return 12;
    const age=Math.min(...ages);
    return age<=30?20:age<=90?16:age<=365?12:8;
  }
  function intentScore(signals,evidence){
    if(!evidence.length)return 6;
    const hay=evidence.map(item=>`${item.title} ${item.description} ${item.text}`).join(" ").toLowerCase();
    let weighted=0;
    for(const signal of signals.filter(item=>item.active!==false)){
      const terms=String(signal.keywords||signal.name||"").split(/;|,|\|/).map(clean).filter(Boolean);
      if(terms.some(term=>hay.includes(term.toLowerCase())))weighted+=Math.max(1,Number(signal.weight)||1);
    }
    return Math.min(20,8+Math.round(weighted/3));
  }
  function valueScore(value){
    const text=clean(value);if(!text)return 8;
    const numeric=(text.match(/[\d][\d.,\s]*/g)||[]).length;
    return Math.min(20,14+Math.min(4,numeric)+( /[€$£]/.test(text)?2:0));
  }
  function fitScore(profile,icps){
    const active=(icps||[]).filter(item=>item.active!==false).length;
    const completeness=clamp(profile?.completeness,0,100,60);
    return Math.min(20,Math.round(completeness/6)+Math.min(4,active));
  }

  function buildMarketOpportunities(profile={},icps=[],signals=[],researchResults=[]){
    const markets=effectiveResearchMarkets(profile);
    const offer=splitList(profile.priorityOffers)[0]||"priority offer";
    return (markets.length?markets:["Priority market"]).slice(0,6).map(market=>{
      const evidence=(researchResults||[]).filter(item=>clean(item.market).toLowerCase()===clean(market).toLowerCase()).slice(0,5);
      const score={
        fit:fitScore(profile,icps),
        intent:intentScore(signals,evidence),
        timing:recentScore(evidence),
        value:valueScore(profile.opportunityValue),
        evidence:evidence.length?Math.min(20,6+evidence.length*4):3
      };
      score.total=score.fit+score.intent+score.timing+score.value+score.evidence;
      const confidence=evidence.length>=2&&score.total>=75?"High":evidence.length>=1||score.total>=55?"Medium":"Low";
      return {
        id:`opp-${slug(market)}`,market,title:`${market}: ${offer}`,
        hypothesis:`Prioritize ${clean(profile.idealCustomer)||"high-fit companies"} in ${market} where ${clean(profile.buyingTriggers)||"a relevant buying signal"} creates a timely reason to evaluate ${offer}.`,
        rationale:`Fit is based on the approved ICP and exclusions. Intent and timing rise only when live evidence matches active signals.`,
        score,confidence,evidence,profileOnly:evidence.length===0,active:true
      };
    }).sort((a,b)=>b.score.total-a.score.total);
  }

  function normalizeMarketState(value={}){
    const input=value&&typeof value==="object"?value:{};
    const signals=(Array.isArray(input.signals)?input.signals:[]).slice(0,20).map(normalizeSignal);
    const icps=(Array.isArray(input.icps)?input.icps:[]).slice(0,3).map(item=>({
      id:clean(item?.id)||`icp-${slug(item?.name)}`,type:clean(item?.type)||"custom",name:clean(item?.name)||"ICP",active:item?.active!==false,
      description:clean(item?.description),targetMarkets:clean(item?.targetMarkets),buyerRoles:clean(item?.buyerRoles),value:clean(item?.value),exclusions:clean(item?.exclusions),offers:clean(item?.offers),rationale:clean(item?.rationale)
    }));
    const researchQueries=(Array.isArray(input.researchQueries)?input.researchQueries:[]).slice(0,4).map(item=>({id:clean(item?.id),market:clean(item?.market),offer:clean(item?.offer),query:clean(item?.query)})).filter(item=>item.id&&item.query);
    const researchResults=(Array.isArray(input.researchResults)?input.researchResults:[]).slice(0,20).map(item=>({
      queryId:clean(item?.queryId),market:clean(item?.market),query:clean(item?.query),url:normalizeUrl(item?.url),title:clean(item?.title),description:clean(item?.description),text:String(item?.text||"").slice(0,5000),date:clean(item?.date)
    })).filter(item=>item.url);
    const opportunities=(Array.isArray(input.opportunities)?input.opportunities:[]).slice(0,12).map(item=>({...item,id:clean(item?.id),market:clean(item?.market),title:clean(item?.title),active:item?.active!==false})).filter(item=>item.id);
    const allowed=new Set(["idle","running","complete","partial","error"]);
    return {
      ...DEFAULT_MARKET_STATE,icps,signals,researchQueries,researchResults,opportunities,
      researchStatus:allowed.has(input.researchStatus)?input.researchStatus:"idle",
      lastResearchAt:clean(input.lastResearchAt),strategyApproved:Boolean(input.strategyApproved),strategyApprovedAt:clean(input.strategyApprovedAt)
    };
  }

  return {DEFAULT_MARKET_STATE,effectiveResearchMarkets,buildIcpCandidates,normalizeSignals,addCustomSignal,buildResearchQueries,normalizeSearchResults,buildMarketOpportunities,normalizeMarketState,splitList};
});
