(function(root, factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelProfile=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const QUESTION_IDS=[
    "priority_offers","ideal_customer","lookalike_customers","buyer_roles","growth_markets",
    "differentiation","buying_triggers","exclusions","opportunity_value","success_outcome"
  ];
  const COUNTRIES=["Latvia","Estonia","Lithuania","Finland","Sweden","Norway","Denmark","Poland","Germany","France","Netherlands","Belgium","Spain","Italy","United Kingdom","Ireland","United States","Canada","Austria","Switzerland","Czech Republic","Slovakia"];
  const SIGNAL_LIBRARY=[
    {id:"facility-expansion",name:"Facility expansion or new site",priority:"High",patterns:[/new factory/i,/new facility/i,/new site/i,/capacity expansion/i,/expansion/i,/construction/i]},
    {id:"capital-investment",name:"Capital investment or modernization",priority:"High",patterns:[/moderni[sz]ation/i,/equipment/i,/capex/i,/investment/i,/automation/i,/upgrade/i]},
    {id:"tender",name:"Tender or procurement activity",priority:"High",patterns:[/tender/i,/procurement/i,/rfp/i,/request for proposal/i,/public contract/i]},
    {id:"funding",name:"Funding or investment round",priority:"Medium",patterns:[/funding/i,/fundraise/i,/investment round/i,/grant/i,/financing/i]},
    {id:"hiring",name:"Strategic hiring",priority:"Medium",patterns:[/hiring/i,/recruit/i,/head of/i,/director/i,/manager/i]},
    {id:"market-entry",name:"New market or export expansion",priority:"High",patterns:[/new market/i,/market entry/i,/export/i,/international expansion/i,/distribution/i]},
    {id:"leadership-change",name:"Leadership or ownership change",priority:"Medium",patterns:[/new ceo/i,/appointed/i,/leadership change/i,/acquisition/i,/merger/i,/new owner/i]},
    {id:"regulatory",name:"Regulatory or compliance change",priority:"Medium",patterns:[/regulation/i,/compliance/i,/certification/i,/directive/i,/standard/i]},
    {id:"supplier-change",name:"Supplier or partner change",priority:"Medium",patterns:[/supplier/i,/vendor/i,/partner/i,/sourcing/i,/shortage/i]},
    {id:"product-launch",name:"Product or service launch",priority:"Medium",patterns:[/launch/i,/new product/i,/new service/i,/portfolio/i]}
  ];

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function normalizeUrl(value){
    const raw=clean(value); if(!raw)return "";
    try{
      const withProtocol=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;
      const url=new URL(withProtocol);
      if(!["https:","http:"].includes(url.protocol))return "";
      url.hash="";
      return url.href;
    }catch{return "";}
  }
  function canBuildProfile(input={}){return Boolean(normalizeUrl(input.website));}
  function canAccessModule(input={},step=1){
    const moduleNumber=Number(step)||1;
    if(moduleNumber===1)return true;
    return moduleNumber>=2&&moduleNumber<=7&&canBuildProfile(input);
  }
  function unique(list){return [...new Set((list||[]).map(clean).filter(Boolean))];}
  function splitList(value){return unique(clean(value).split(/\n|;|,|\||•/).map(clean));}
  function truncate(value,max=1200){const text=clean(value);return text.length>max?`${text.slice(0,max-1)}…`:text;}
  function firstSentence(text){
    const cleaned=clean(text).replace(/[#*_`>\[\]]/g," ").replace(/\s+/g," ");
    if(!cleaned)return "";
    const parts=cleaned.split(/(?<=[.!?])\s+/).filter(s=>s.length>45);
    return truncate(parts[0]||cleaned,360);
  }
  function detectCountries(text){
    const hay=` ${clean(text).toLowerCase()} `;
    return COUNTRIES.filter(country=>hay.includes(country.toLowerCase()));
  }
  function calculateCompleteness(input={}){
    const answers=input.answers||{};
    const required=QUESTION_IDS.filter(id=>id!=="lookalike_customers");
    let score=0;
    if(normalizeUrl(input.website))score+=10;
    required.forEach(id=>{if(clean(answers[id]))score+=9;});
    if(clean(answers.lookalike_customers))score+=4;
    if((input.additionalLinks||[]).some(normalizeUrl))score+=2;
    if((input.documents||[]).some(d=>clean(d?.text)||clean(d?.name)))score+=3;
    return Math.min(100,score);
  }
  function recommendSignals(answerText,sourceText){
    const combined=`${clean(answerText)} ${clean(sourceText)}`;
    const matched=SIGNAL_LIBRARY.filter(signal=>signal.patterns.some(pattern=>pattern.test(combined)));
    const defaults=["facility-expansion","capital-investment","tender","market-entry"].map(id=>SIGNAL_LIBRARY.find(x=>x.id===id));
    return uniqueObjects([...matched,...defaults],"id").slice(0,8).map(item=>({...item,reason:signalReason(item,combined)}));
  }
  function uniqueObjects(items,key){const seen=new Set();return items.filter(item=>item&&!seen.has(item[key])&&seen.add(item[key]));}
  function signalReason(signal,text){
    if(signal.patterns.some(p=>p.test(text)))return "Matches a declared buying trigger or supporting source evidence.";
    if(signal.id==="tender")return "Useful for detecting active purchase intent in formal procurement.";
    if(signal.id==="market-entry")return "Relevant for identifying companies entering or expanding in target markets.";
    return "Common high-value commercial trigger for B2B opportunity discovery.";
  }
  function inferCompanyName(scrapedSources,website){
    const primary=(scrapedSources||[]).find(x=>x.type==="website")||(scrapedSources||[])[0];
    const title=clean(primary?.title).replace(/\s+[|–—-]\s+.*$/,"");
    if(title)return title.slice(0,90);
    try{return new URL(normalizeUrl(website)).hostname.replace(/^www\./,"");}catch{return "Company";}
  }
  function deriveEvidenceDigest(scrapedSources,documents){
    const web=(scrapedSources||[]).map(s=>firstSentence(s.text)).filter(Boolean).slice(0,3);
    const docs=(documents||[]).map(d=>firstSentence(d.text)).filter(Boolean).slice(0,2);
    return truncate([...web,...docs].join(" "),1100);
  }
  function sourceText(scrapedSources,documents){return [...(scrapedSources||[]).map(s=>s.text||""),...(documents||[]).map(d=>d.text||"")].join(" ");}
  function buildMission(answers){
    const offer=splitList(answers.priority_offers)[0]||"priority offer";
    const customer=truncate(answers.ideal_customer||"high-fit companies",100);
    const markets=truncate(answers.growth_markets||"selected markets",90);
    const outcome=truncate(answers.success_outcome||"create qualified commercial opportunities",130);
    return `Find and prioritize ${customer} in ${markets} that have evidence-backed reasons to buy ${offer}, with the commercial goal to ${outcome.replace(/^to\s+/i,"")}.`;
  }
  function informationGaps(answers,scrapedSources,documents){
    const gaps=[];
    if(!clean(answers.buyer_roles))gaps.push("Decision-maker roles are not defined.");
    if(!clean(answers.opportunity_value))gaps.push("Typical commercial value of a good opportunity is missing.");
    if(!clean(answers.differentiation))gaps.push("Competitive differentiation is not clear.");
    if(!clean(answers.buying_triggers))gaps.push("Buying triggers are not defined.");
    if(!(scrapedSources||[]).length)gaps.push("No website evidence was successfully collected.");
    if(!(documents||[]).some(d=>clean(d.text)))gaps.push("No document text is available for supporting evidence.");
    return gaps;
  }
  function buildCompanyIntelligenceProfile(input={}){
    const answers=Object.fromEntries(QUESTION_IDS.map(id=>[id,clean(input.answers?.[id])]));
    const scraped=(input.scrapedSources||[]).filter(x=>x&&clean(x.text));
    const documents=(input.documents||[]).filter(x=>x&&clean(x.name));
    const combined=sourceText(scraped,documents);
    const currentMarkets=detectCountries(combined).filter(country=>!splitList(answers.growth_markets).includes(country));
    const evidenceDigest=deriveEvidenceDigest(scraped,documents);
    const companyName=inferCompanyName(scraped,input.website);
    return {
      version:1,
      generatedAt:new Date().toISOString(),
      companyName,
      website:normalizeUrl(input.website),
      companyOverview:evidenceDigest||`LeadIntel has limited public evidence for ${companyName}. Strategic answers are used as the primary context until more evidence is added.`,
      priorityOffers:answers.priority_offers,
      idealCustomer:answers.ideal_customer,
      lookalikeCustomers:answers.lookalike_customers,
      decisionMakers:answers.buyer_roles,
      currentMarkets,
      targetMarkets:answers.growth_markets,
      differentiation:answers.differentiation,
      buyingTriggers:answers.buying_triggers,
      exclusions:answers.exclusions,
      opportunityValue:answers.opportunity_value,
      commercialObjective:answers.success_outcome,
      mission:buildMission(answers),
      recommendedSignals:recommendSignals(answers.buying_triggers,combined),
      informationGaps:informationGaps(answers,scraped,documents),
      completeness:calculateCompleteness(input),
      evidenceDigest,
      sourceSummary:{website:scraped.filter(x=>x.type==="website").length,additionalLinks:scraped.filter(x=>x.type==="link").length,documents:documents.filter(x=>clean(x.text)).length,total:scraped.length+documents.filter(x=>clean(x.text)).length}
    };
  }
  function normalizeSavedState(value={}){
    const answers={}; QUESTION_IDS.forEach(id=>{answers[id]=clean(value.answers?.[id]);});
    const docs=Array.isArray(value.documents)?value.documents.slice(0,5).map(d=>({name:clean(d?.name).slice(0,180),size:Number(d?.size)||0,text:String(d?.text||"").slice(0,25000),status:clean(d?.status)||"ready"})).filter(d=>d.name):[];
    return {
      step:[1,2,3].includes(Number(value.step))?Number(value.step):1,
      website:normalizeUrl(value.website),
      additionalLinks:unique((value.additionalLinks||[]).map(normalizeUrl).filter(Boolean)).slice(0,8),
      documents:docs,
      answers,
      scrapedSources:Array.isArray(value.scrapedSources)?value.scrapedSources.slice(0,12).map(s=>({type:s?.type==="link"?"link":"website",url:normalizeUrl(s?.url),title:clean(s?.title).slice(0,180),text:String(s?.text||"").slice(0,30000),status:clean(s?.status)||"ready"})).filter(s=>s.url):[],
      profile:value.profile&&typeof value.profile==="object"?value.profile:null,
      approved:Boolean(value.approved)
    };
  }

  return {QUESTION_IDS,SIGNAL_LIBRARY,normalizeUrl,canBuildProfile,canAccessModule,calculateCompleteness,buildCompanyIntelligenceProfile,normalizeSavedState,splitList};
});