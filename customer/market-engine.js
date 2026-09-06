(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelMarket=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const DEFAULT_MARKET_STATE=Object.freeze({
    icps:[],signals:[],researchQueries:[],researchResults:[],opportunities:[],
    researchStatus:"idle",researchSourceStatus:{openai:"idle",firecrawl:"idle"},lastResearchAt:"",researchMode:"quick",researchHistory:[],monitoring:{enabled:false,frequency:"weekly",researchDepth:"deep",minimumScore:70,sourceTypes:["news","tenders","jobs","investments","company"],signalIds:[],customSources:[]},strategyApproved:false,strategyApprovedAt:""
  });

  const RESEARCH_MODES=Object.freeze({
    quick:Object.freeze({maxQueries:4,resultsPerQuery:5,maxStoredResults:20}),
    deep:Object.freeze({maxQueries:12,resultsPerQuery:8,maxStoredResults:80})
  });
  const SOURCE_TYPES=Object.freeze({
    news:"news announcement expansion relocation modernisation",
    tenders:"tender procurement public procurement contract",
    jobs:"hiring vacancies recruitment growth",
    investments:"investment expansion funding construction development",
    company:"official company website project reference case study",
    registries:"business registry annual report financial results"
  });

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function clamp(value,min,max,fallback=min){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function slug(value){return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item";}
  function splitList(value){
    if(Array.isArray(value))return [...new Set(value.map(clean).filter(Boolean))];
    return [...new Set(String(value??"").split(/\n|;|\|/).map(clean).filter(Boolean))];
  }
  function normalizeUrl(value){try{const url=new URL(clean(value));return ["http:","https:"].includes(url.protocol)?url.href:"";}catch{return "";}}
  function canonicalUrl(value){
    try{
      const url=new URL(clean(value));if(!["http:","https:"].includes(url.protocol))return "";
      url.hash="";url.hostname=url.hostname.toLowerCase();url.pathname=url.pathname.replace(/\/+$/,"")||"/";
      return url.pathname==="/"&&!url.search?url.origin:url.href;
    }catch{return "";}
  }
  function normalizeProviders(value){
    const allowed=new Set(["openai","firecrawl"]),seen=new Set();
    const input=Array.isArray(value)?value:[value];
    input.map(item=>clean(item).toLowerCase()).filter(item=>allowed.has(item)).forEach(item=>seen.add(item));
    return ["openai","firecrawl"].filter(item=>seen.has(item));
  }
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

  function isLv(language){return String(language||'en').toLowerCase()==='lv';}

  function buildIcpCandidates(profile={},language='en'){
    const lv=isLv(language);
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
      id:"icp-core",type:"core",name:lv?"Pamata ideālā klienta profils":"Core ICP",...common,
      description:clean(profile.idealCustomer)||(lv?"Uzņēmumi, kas atbilst apstiprinātajai ideālā klienta definīcijai.":"Companies matching the approved ideal-customer definition."),
      rationale:lv?`Tieši atspoguļo apstiprināto ideālā klienta profilu, pircēju lomas, prioritāros piedāvājumus un komerciālo vērtību tirgos: ${targetMarkets}.`:`Directly reflects the approved ideal customer, buying roles, priority offers and commercial value for ${targetMarkets}.`
    }];
    if(clean(profile.lookalikeCustomers))result.push({
      id:"icp-lookalike",type:"lookalike",name:lv?"Līdzīgo uzņēmumu profils":"Lookalike ICP",...common,
      description:lv?`Uzņēmumi ar līdzīgām darbības pazīmēm kā ${clean(profile.lookalikeCustomers)}.`:`Companies with business characteristics similar to ${clean(profile.lookalikeCustomers)}.`,
      rationale:lv?`Izmantot ${clean(profile.lookalikeCustomers)} kā komerciālos atskaites punktus un meklēt līdzīgas organizācijas tirgos: ${targetMarkets}.`:`Use ${clean(profile.lookalikeCustomers)} as commercial anchors, then look for similar organizations in ${targetMarkets}.`
    });
    result.push({
      id:"icp-trigger-led",type:"trigger-led",name:lv?"Pirkšanas signālos balstīts profils":"Trigger-led ICP",...common,
      description:lv?"Uzņēmumi, kas atbilst pamata profilam un pašlaik uzrāda atbilstošus pirkšanas signālus.":`Companies that fit the core profile and are currently showing relevant buying signals.`,
      rationale:lv?`Prioritizēt organizācijas, kurās pašlaik ir novērojams: ${clean(profile.buyingTriggers)||"atbilstošs pirkšanas signāls"}.`:`Prioritize organizations where ${clean(profile.buyingTriggers)||"a relevant buying trigger"} is visible now.`
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

  function researchOptions(input){
    if(typeof input==="number")return {mode:"quick",maxQueries:Math.max(1,Math.min(4,input)),sourceTypes:["news"]};
    const mode=input?.mode==="deep"?"deep":"quick";const rules=RESEARCH_MODES[mode];
    return {mode,maxQueries:rules.maxQueries,sourceTypes:splitList(input?.sourceTypes).filter(type=>SOURCE_TYPES[type]).slice(0,6)};
  }
  function buildResearchQueries(profile={},signals=[],input={mode:"quick"}){
    const options=researchOptions(input);const limit=options.maxQueries;
    const markets=effectiveResearchMarkets(profile);
    const offers=splitList(profile.priorityOffers).length?splitList(profile.priorityOffers):["commercial opportunity"];
    const active=(signals||[]).filter(item=>item.active!==false).sort((a,b)=>Number(b.weight)-Number(a.weight));
    const signalTerms=active.slice(0,options.mode==="deep"?8:3).flatMap(item=>splitList(String(item.keywords||"").replace(/,/g,";")).slice(0,2)).filter(Boolean);
    const marketFocus=clean(profile.marketFocus);
    const results=[];const categories=options.sourceTypes.length?options.sourceTypes:(options.mode==="deep"?["news","tenders","jobs","investments","company","registries"]:["news","tenders"]);
    const combinations=[];
    for(const market of (markets.length?markets:["priority market"]))for(const offer of offers)for(const sourceType of categories)combinations.push({market,offer,sourceType});
    for(let index=0;results.length<limit;index++){
      const base=combinations[index%combinations.length];const cycle=Math.floor(index/combinations.length);const signal=signalTerms[(index+cycle)%Math.max(1,signalTerms.length)]||clean(profile.buyingTriggers)||"business opportunity";
      const query=[base.market,base.offer,marketFocus,clean(profile.idealCustomer),signal,SOURCE_TYPES[base.sourceType],new Date().getUTCFullYear()].filter(Boolean).join(" ");
      if(results.some(item=>item.query===query)){
        if(index>limit*4)break;
        continue;
      }
      results.push({id:`q-${slug(base.market)}-${results.length+1}`,market:base.market,offer:base.offer,sourceType:base.sourceType,query});
    }
    return results;
  }

  function normalizeMonitoring(value={}){
    const frequency=["daily","weekly","monthly"].includes(value.frequency)?value.frequency:"weekly";
    const sourceTypes=splitList(value.sourceTypes).filter(type=>SOURCE_TYPES[type]).slice(0,6);
    return {enabled:Boolean(value.enabled),frequency,researchDepth:value.researchDepth==="quick"?"quick":"deep",minimumScore:clamp(value.minimumScore,1,100,70),sourceTypes:sourceTypes.length?sourceTypes:["news","tenders","jobs","investments","company"],signalIds:splitList(value.signalIds).slice(0,20),customSources:splitList(value.customSources).map(normalizeUrl).filter(Boolean).slice(0,20),lastRunAt:clean(value.lastRunAt),nextRunAt:clean(value.nextRunAt)};
  }
  function appendResearchHistory(history=[],run={}){
    const item={id:clean(run.id)||`research-${Date.now()}`,mode:run.mode==="deep"?"deep":"quick",status:["complete","partial","error"].includes(run.status)?run.status:"error",sourceCount:Math.max(0,Number(run.sourceCount)||0),queryCount:Math.max(0,Number(run.queryCount)||0),completedAt:clean(run.completedAt)||new Date().toISOString()};
    return [item,...(Array.isArray(history)?history:[]).filter(existing=>clean(existing?.id)!==item.id)].slice(0,20);
  }

  function getMarketJourneyState(value={}){
    const researched=Boolean(clean(value.lastResearchAt))&&value.researchStatus!=="running";
    const active=researched&&Boolean(value.strategyApproved);
    return {
      stage:active?"active":researched?"review":"research",
      researched,
      showScore:researched,
      showActivation:researched,
      showMonitoring:active,
      researchLabel:researched?"Rerun market research":"Run quick research"
    };
  }

  function normalizeSearchResults(payload={},queryMeta={},sourceProvider=""){
    const raw=Array.isArray(payload?.data)?payload.data:Array.isArray(payload?.data?.web)?payload.data.web:Array.isArray(payload?.web)?payload.web:Array.isArray(payload?.results)?payload.results:[];
    return raw.slice(0,8).map(item=>{
      const url=canonicalUrl(item?.url||item?.link||"");
      if(!url)return null;
      const description=clean(item?.description||item?.snippet||"");
      const body=clean(item?.markdown||item?.content||item?.text||description);
      return {
        queryId:clean(queryMeta.id),market:clean(queryMeta.market),query:clean(queryMeta.query),
        url,title:clean(item?.title)||new URL(url).hostname,description,
        text:body.slice(0,5000),date:clean(item?.publishedDate||item?.date||item?.published_at||item?.metadata?.publishedDate),
        sourceProviders:normalizeProviders([...(Array.isArray(item?.sourceProviders)?item.sourceProviders:[]),sourceProvider])
      };
    }).filter(Boolean);
  }

  function mergeResearchResults(...groups){
    const merged=new Map();
    for(const item of groups.flatMap(group=>Array.isArray(group)?group:[])){
      const url=canonicalUrl(item?.url);if(!url)continue;
      const next={
        queryId:clean(item?.queryId),market:clean(item?.market),query:clean(item?.query),url,
        title:clean(item?.title),description:clean(item?.description),text:String(item?.text||"").slice(0,5000),date:clean(item?.date),
        sourceProviders:normalizeProviders(item?.sourceProviders)
      };
      const current=merged.get(url);
      if(!current){merged.set(url,next);continue;}
      current.queryId=current.queryId||next.queryId;current.market=current.market||next.market;current.query=current.query||next.query;
      current.title=current.title||next.title;current.description=current.description||next.description;current.text=current.text||next.text;current.date=current.date||next.date;
      current.sourceProviders=normalizeProviders([...(current.sourceProviders||[]),...(next.sourceProviders||[])]);
    }
    return [...merged.values()];
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

  function buildMarketOpportunities(profile={},icps=[],signals=[],researchResults=[],language='en'){
    const lv=isLv(language);
    const markets=effectiveResearchMarkets(profile);
    const offer=splitList(profile.priorityOffers)[0]||"priority offer";
    return (markets.length?markets:["Priority market"]).slice(0,6).map(market=>{
      const evidence=(researchResults||[]).filter(item=>clean(item.market).toLowerCase()===clean(market).toLowerCase()).slice(0,5);
      const score=evidence.length?{
        fit:fitScore(profile,icps),
        intent:intentScore(signals,evidence),
        timing:recentScore(evidence),
        value:valueScore(profile.opportunityValue),
        evidence:Math.min(20,6+evidence.length*4)
      }:{fit:0,intent:0,timing:0,value:0,evidence:0};
      score.total=score.fit+score.intent+score.timing+score.value+score.evidence;
      const confidence=evidence.length>=2&&score.total>=75?"High":evidence.length>=1||score.total>=55?"Medium":"Low";
      return {
        id:`opp-${slug(market)}`,market,title:`${market}: ${offer}`,
        hypothesis:lv?`Prioritizēt ${clean(profile.idealCustomer)||"augstas atbilstības uzņēmumus"} tirgū ${market}, kuros ${clean(profile.buyingTriggers)||"atbilstošs pirkšanas signāls"} rada savlaicīgu pamatu izvērtēt piedāvājumu: ${offer}.`:`Prioritize ${clean(profile.idealCustomer)||"high-fit companies"} in ${market} where ${clean(profile.buyingTriggers)||"a relevant buying signal"} creates a timely reason to evaluate ${offer}.`,
        rationale:lv?`Atbilstība ir balstīta apstiprinātajā ideālā klienta profilā un izslēgšanas kritērijos. Nodoma un laika novērtējums pieaug tikai tad, ja aktuālie pierādījumi atbilst aktīvajiem signāliem.`:`Fit is based on the approved ICP and exclusions. Intent and timing rise only when live evidence matches active signals.`,
        score,confidence,evidence,profileOnly:evidence.length===0,active:true
      };
    }).sort((a,b)=>b.score.total-a.score.total);
  }

  function localizeGeneratedState(market={},profile={},language='en'){
    const next=normalizeMarketState(market);const target=isLv(language)?'lv':'en';
    const generatedIcps={en:buildIcpCandidates(profile,'en'),lv:buildIcpCandidates(profile,'lv')};
    const byLanguage=locale=>new Map(generatedIcps[locale].map(item=>[item.id,item]));
    const enIcps=byLanguage('en'),lvIcps=byLanguage('lv'),targetIcps=byLanguage(target);
    const stored=next.contentVariants&&typeof next.contentVariants==='object'?next.contentVariants:{};
    next.icps=next.icps.map(item=>{
      const wanted=targetIcps.get(item.id),en=enIcps.get(item.id),lv=lvIcps.get(item.id);if(!wanted||!en||!lv)return item;
      const updated={...item};
      const currentVariant=stored.icps?.[item.id]?.[next.contentLanguage||'en']||{};
      for(const field of ['name','description','rationale'])if(item[field]===en[field]||item[field]===lv[field]||item[field]===currentVariant[field])updated[field]=wanted[field];
      return updated;
    });
    const variants={
      en:new Map(buildMarketOpportunities(profile,next.icps,next.signals,next.researchResults,'en').map(item=>[item.id,item])),
      lv:new Map(buildMarketOpportunities(profile,next.icps,next.signals,next.researchResults,'lv').map(item=>[item.id,item]))
    };
    next.opportunities=next.opportunities.map(item=>{
      const wanted=variants[target].get(item.id),en=variants.en.get(item.id),lv=variants.lv.get(item.id);if(!wanted||!en||!lv)return item;
      const updated={...item};
      const currentVariant=stored.opportunities?.[item.id]?.[next.contentLanguage||'en']||{};
      for(const field of ['title','hypothesis','rationale'])if(item[field]===en[field]||item[field]===lv[field]||item[field]===currentVariant[field])updated[field]=wanted[field];
      return updated;
    });
    next.contentVariants={icps:{},opportunities:{}};
    for(const item of variants.en.values())next.contentVariants.opportunities[item.id]={en:{title:item.title,hypothesis:item.hypothesis,rationale:item.rationale},lv:{title:variants.lv.get(item.id)?.title||'',hypothesis:variants.lv.get(item.id)?.hypothesis||'',rationale:variants.lv.get(item.id)?.rationale||''}};
    for(const item of enIcps.values())next.contentVariants.icps[item.id]={en:{name:item.name,description:item.description,rationale:item.rationale},lv:{name:lvIcps.get(item.id)?.name||'',description:lvIcps.get(item.id)?.description||'',rationale:lvIcps.get(item.id)?.rationale||''}};
    next.contentLanguage=target;return next;
  }

  function normalizeMarketState(value={}){
    const input=value&&typeof value==="object"?value:{};
    const signals=(Array.isArray(input.signals)?input.signals:[]).slice(0,20).map(normalizeSignal);
    const icps=(Array.isArray(input.icps)?input.icps:[]).slice(0,3).map(item=>({
      id:clean(item?.id)||`icp-${slug(item?.name)}`,type:clean(item?.type)||"custom",name:clean(item?.name)||"ICP",active:item?.active!==false,
      description:clean(item?.description),targetMarkets:clean(item?.targetMarkets),buyerRoles:clean(item?.buyerRoles),value:clean(item?.value),exclusions:clean(item?.exclusions),offers:clean(item?.offers),rationale:clean(item?.rationale)
    }));
    const researchMode=input.researchMode==="deep"?"deep":"quick";
    const researchQueries=(Array.isArray(input.researchQueries)?input.researchQueries:[]).slice(0,RESEARCH_MODES[researchMode].maxQueries).map(item=>({id:clean(item?.id),market:clean(item?.market),offer:clean(item?.offer),sourceType:clean(item?.sourceType),query:clean(item?.query)})).filter(item=>item.id&&item.query);
    const researchResults=(Array.isArray(input.researchResults)?input.researchResults:[]).slice(0,RESEARCH_MODES[researchMode].maxStoredResults).map(item=>({
      queryId:clean(item?.queryId),market:clean(item?.market),query:clean(item?.query),url:canonicalUrl(item?.url),title:clean(item?.title),description:clean(item?.description),text:String(item?.text||"").slice(0,5000),date:clean(item?.date),sourceProviders:normalizeProviders(item?.sourceProviders)
    })).filter(item=>item.url);
    const opportunities=(Array.isArray(input.opportunities)?input.opportunities:[]).slice(0,12).map(item=>{
      const hasEvidence=Array.isArray(item?.evidence)&&item.evidence.length>0;
      return {...item,id:clean(item?.id),market:clean(item?.market),title:clean(item?.title),active:item?.active!==false,profileOnly:!hasEvidence,score:hasEvidence?item.score:{fit:0,intent:0,timing:0,value:0,evidence:0,total:0}};
    }).filter(item=>item.id);
    const allowed=new Set(["idle","running","complete","partial","error"]),sourceAllowed=new Set(["idle","running","complete","partial","error","unavailable"]);
    const rawSourceStatus=input.researchSourceStatus&&typeof input.researchSourceStatus==="object"?input.researchSourceStatus:{};
    const researchSourceStatus={openai:sourceAllowed.has(rawSourceStatus.openai)?rawSourceStatus.openai:"idle",firecrawl:sourceAllowed.has(rawSourceStatus.firecrawl)?rawSourceStatus.firecrawl:"idle"};
    return {
      ...DEFAULT_MARKET_STATE,icps,signals,researchQueries,researchResults,opportunities,researchSourceStatus,
      researchStatus:allowed.has(input.researchStatus)?input.researchStatus:"idle",researchMode,
      researchHistory:(Array.isArray(input.researchHistory)?input.researchHistory:[]).slice(0,20).map(item=>({id:clean(item?.id),mode:item?.mode==="deep"?"deep":"quick",status:clean(item?.status),sourceCount:Math.max(0,Number(item?.sourceCount)||0),queryCount:Math.max(0,Number(item?.queryCount)||0),completedAt:clean(item?.completedAt)})).filter(item=>item.id),monitoring:normalizeMonitoring(input.monitoring),
      lastResearchAt:clean(input.lastResearchAt),strategyApproved:Boolean(input.strategyApproved),strategyApprovedAt:clean(input.strategyApprovedAt),contentLanguage:['en','lv'].includes(input.contentLanguage)?input.contentLanguage:'',contentVariants:input.contentVariants&&typeof input.contentVariants==='object'?input.contentVariants:{}
    };
  }

  return {DEFAULT_MARKET_STATE,RESEARCH_MODES,SOURCE_TYPES,effectiveResearchMarkets,buildIcpCandidates,normalizeSignals,addCustomSignal,buildResearchQueries,normalizeSearchResults,mergeResearchResults,buildMarketOpportunities,localizeGeneratedState,normalizeMarketState,normalizeMonitoring,appendResearchHistory,getMarketJourneyState,splitList};
});
