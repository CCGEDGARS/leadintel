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
  const COUNTRIES=["Latvia","Estonia","Lithuania","Finland","Sweden","Norway","Denmark","Iceland","Poland","Germany","France","Netherlands","Belgium","Luxembourg","Spain","Italy","United Kingdom","Ireland","United States","Canada","Austria","Switzerland","Czech Republic","Slovakia","Hungary"];
  const MARKET_REGIONS=Object.freeze({
    Baltics:["Latvia","Lithuania","Estonia"],
    Nordics:["Sweden","Finland","Norway","Denmark","Iceland"],
    Scandinavia:["Sweden","Norway","Denmark"],
    DACH:["Germany","Austria","Switzerland"],
    Benelux:["Belgium","Netherlands","Luxembourg"]
  });
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
  const BUSINESS_DESCRIPTION_RE=/\b(?:provid(?:e|es|ed|ing)|offer(?:s|ed|ing)?|speciali[sz](?:e|es|ed|ing)|design(?:s|ed|ing)?|manufactur(?:e|es|ed|ing)|develop(?:s|ed|ing)?|deliver(?:s|ed|ing)?|help(?:s|ed|ing)?|serv(?:e|es|ed|ing)|build(?:s|ing)?|creat(?:e|es|ed|ing)|suppl(?:y|ies|ied|ying)|produc(?:e|es|ed|ing)|support(?:s|ed|ing)?|train(?:s|ed|ing)?|consult(?:s|ed|ing)?|operat(?:e|es|ed|ing)|focus(?:es|ed|ing)|work(?:s|ed|ing)? with)\b/i;

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
  function unique(list){return [...new Set((list||[]).map(clean).filter(Boolean))];}
  function splitList(value){
    if(Array.isArray(value))return unique(value);
    return unique(clean(value).split(/\n|;|,|\||•/).map(clean));
  }
  function canonicalMarket(value){
    const item=clean(value).slice(0,100);if(!item)return "";
    const country=COUNTRIES.find(name=>name.toLowerCase()===item.toLowerCase());if(country)return country;
    const region=Object.keys(MARKET_REGIONS).find(name=>name.toLowerCase()===item.toLowerCase());if(region)return region;
    return item;
  }
  function normalizeTargetMarkets(value){
    const result=[];const seen=new Set();
    for(const raw of splitList(value)){
      const item=canonicalMarket(raw);const key=item.toLowerCase();
      if(!item||seen.has(key))continue;
      seen.add(key);result.push(item);
      if(result.length>=12)break;
    }
    return result;
  }
  function expandTargetMarkets(value){
    const result=[];const seen=new Set();
    for(const market of normalizeTargetMarkets(value)){
      const expanded=MARKET_REGIONS[market]||[market];
      for(const item of expanded){const key=item.toLowerCase();if(!seen.has(key)){seen.add(key);result.push(item);}}
    }
    return result;
  }
  function canBuildProfile(input={}){return Boolean(normalizeUrl(input.website)&&normalizeTargetMarkets(input.targetMarkets).length);}
  function canAccessModule(input={},step=1){
    const moduleNumber=Number(step)||1;
    if(moduleNumber===1)return true;
    return moduleNumber>=2&&moduleNumber<=7&&canBuildProfile(input);
  }
  function truncate(value,max=1200){const text=clean(value);return text.length>max?`${text.slice(0,max-1)}…`:text;}
  const NAVIGATION_LABEL_RE=/\bUZZINĀT\s+VAIRĀK\b|\b(?:LEARN|READ|VIEW)\s+MORE\b|\bGET\s+IN\s+TOUCH\b|\bCONTACT\s+US\b/gi;
  const NAVIGATION_FRAGMENT_RE=/\bRealizētie\s+projekti\b|\bUzņēmumi,?\s+kas\s+izvēlas(?:\s+mūsu)?\s+risinājumus\b|\bCase\s+studies\b|\bCompanies\s+that\s+choose\s+us\b/i;
  function cleanEvidenceText(text){
    return String(text??"")
      .replace(/!\[[^\]]*\]\((?:https?:\/\/|data:)[^)]+\)/gi," ")
      .replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)]+\)/gi," $1 ")
      .replace(/\((?:https?:\/\/)[^)]+\)/gi," ")
      .replace(/https?:\/\/[^\s)\]]+/gi," ")
      .replace(/\b\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?\b/gi," ")
      .replace(/[#*_`>|]/g," ")
      .replace(NAVIGATION_LABEL_RE,". ")
      .replace(/\bRealizētie\s+projekti\s*[–—-]\s*iedvesma\s+tavai\s+darba\s+videi\b/gi,". ")
      .replace(/\bUzņēmumi,?\s+kas\s+izvēlas(?:\s+mūsu)?\s+risinājumus\b/gi,". ")
      .replace(/\bCase\s+studies\s*[–—-][^.!?]*/gi,". ")
      .replace(/\bCompanies\s+that\s+choose\s+us\b/gi,". ")
      .replace(/\s+/g," ")
      .trim();
  }
  function hasEvidenceNavigationNoise(value){return NAVIGATION_FRAGMENT_RE.test(String(value??""));}
  function hasAssetNoise(value){
    const text=String(value??"");
    return /!\[[^\]]*\]\(|(?:images\.)?squarespace-cdn\.com|https?:\/\/[^\s)\]]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^\s)\]]*)?|\b\S+\.(?:png|jpe?g|gif|webp|svg)(?:[?#]\S*)?/i.test(text);
  }
  function normalizeEvidenceSentence(value){
    return clean(value).replace(/^(?:(?:[A-Z][A-Z0-9&/+.-]{1,})\s+){1,5}(?=[A-Z][a-z])/,'').trim();
  }
  function evidenceSentences(text){
    const cleaned=cleanEvidenceText(text);if(!cleaned)return [];
    return cleaned.split(/(?<=[.!?])\s+/).map(normalizeEvidenceSentence).filter(sentence=>sentence.length>45).slice(0,24);
  }
  function firstSentence(text){
    const cleaned=cleanEvidenceText(text);if(!cleaned)return "";
    const parts=evidenceSentences(cleaned);const descriptive=parts.find(sentence=>BUSINESS_DESCRIPTION_RE.test(sentence));
    return truncate(descriptive||parts[0]||cleaned,360);
  }
  function detectCountries(text){
    const hay=` ${clean(text).toLowerCase()} `;
    return COUNTRIES.filter(country=>hay.includes(country.toLowerCase()));
  }
  function calculateCompleteness(input={}){
    const answers=input.answers||{};
    const required=QUESTION_IDS.filter(id=>id!=="lookalike_customers");
    let score=0;
    if(normalizeUrl(input.website))score+=20;
    if(normalizeTargetMarkets(input.targetMarkets).length)score+=20;
    required.forEach(id=>{if(clean(answers[id]))score+=6;});
    if(clean(answers.lookalike_customers))score+=4;
    if((input.additionalLinks||[]).some(normalizeUrl))score+=1;
    if((input.documents||[]).some(d=>clean(d?.text)||clean(d?.name)))score+=1;
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
  function knownCompanyName(website){
    const hostnameValue=(()=>{try{return new URL(normalizeUrl(website)).hostname.replace(/^www\./i,"").toLowerCase();}catch{return "";}})();
    return {"ajprodukti.lv":"AJ Produkti"}[hostnameValue]||"";
  }
  function inferCompanyName(scrapedSources,website){
    const known=knownCompanyName(website);if(known)return known;
    const primary=(scrapedSources||[]).find(x=>x.type==="website")||(scrapedSources||[])[0];
    const title=clean(primary?.title).replace(/\s+[|–—-]\s+.*$/,"");
    if(title)return title.slice(0,90);
    try{return new URL(normalizeUrl(website)).hostname.replace(/^www\./,"");}catch{return "Company";}
  }
  function deriveCompanyOverview(scrapedSources,documents){
    const candidates=[...(scrapedSources||[]).map(source=>source?.text||""),...(documents||[]).map(doc=>doc?.text||"")]
      .flatMap(evidenceSentences)
      .filter(Boolean);
    const descriptive=unique(candidates.filter(sentence=>BUSINESS_DESCRIPTION_RE.test(sentence)));
    const fallback=unique(candidates);
    return truncate((descriptive.length?descriptive:fallback).slice(0,2).join(" "),650);
  }
  function deriveEvidenceDigest(scrapedSources,documents){
    const web=(scrapedSources||[]).map(s=>firstSentence(s.text)).filter(Boolean).slice(0,3);
    const docs=(documents||[]).map(d=>firstSentence(d.text)).filter(Boolean).slice(0,2);
    return truncate(unique([...web,...docs]).join(" "),1100);
  }
  function sourceText(scrapedSources,documents){return [...(scrapedSources||[]).map(s=>s.text||""),...(documents||[]).map(d=>d.text||"")].join(" ");}
  function buildMission(){return "Find qualified B2B opportunities, connect with decision-makers, and close more deals through evidence-backed commercial intelligence.";}
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
  function sourceMatchesWebsite(source,website){
    const target=normalizeUrl(website);const candidate=normalizeUrl(source?.url);if(!target||!candidate)return false;
    try{return new URL(target).hostname.replace(/^www\./i,"").toLowerCase()===new URL(candidate).hostname.replace(/^www\./i,"").toLowerCase();}catch{return false;}
  }
  function buildCompanyIntelligenceProfile(input={}){
    const answers=Object.fromEntries(QUESTION_IDS.map(id=>[id,clean(input.answers?.[id])]));
    const scraped=(input.scrapedSources||[]).filter(x=>x&&clean(x.text)&&sourceMatchesWebsite(x,input.website));
    const documents=(input.documents||[]).filter(x=>x&&clean(x.name));
    const combined=sourceText(scraped,documents);
    const selectedTargetMarkets=normalizeTargetMarkets(input.targetMarkets).length?normalizeTargetMarkets(input.targetMarkets):normalizeTargetMarkets(answers.growth_markets);
    const researchMarkets=expandTargetMarkets(selectedTargetMarkets);
    const currentMarkets=detectCountries(combined).filter(country=>!researchMarkets.some(target=>target.toLowerCase()===country.toLowerCase()));
    const evidenceDigest=deriveEvidenceDigest(scraped,documents);
    const companyName=inferCompanyName(scraped,input.website);
    const companyOverview=deriveCompanyOverview(scraped,documents);
    return {
      version:2,
      generatedAt:new Date().toISOString(),
      companyName,
      website:normalizeUrl(input.website),
      companyOverview:companyOverview||evidenceDigest||`LeadIntel has limited public evidence for ${companyName}. Strategic answers are used as the primary context until more evidence is added.`,
      priorityOffers:answers.priority_offers,
      idealCustomer:answers.ideal_customer,
      lookalikeCustomers:answers.lookalike_customers,
      decisionMakers:answers.buyer_roles,
      currentMarkets,
      targetMarkets:selectedTargetMarkets.join("; "),
      researchMarkets,
      marketFocus:answers.growth_markets,
      differentiation:answers.differentiation,
      buyingTriggers:answers.buying_triggers,
      exclusions:answers.exclusions,
      opportunityValue:answers.opportunity_value,
      commercialObjective:answers.success_outcome,
      mission:buildMission(),
      recommendedSignals:recommendSignals(answers.buying_triggers,combined),
      informationGaps:informationGaps(answers,scraped,documents),
      completeness:calculateCompleteness({...input,targetMarkets:selectedTargetMarkets}),
      evidenceDigest,
      sourceSummary:{website:scraped.filter(x=>x.type==="website").length,additionalLinks:scraped.filter(x=>x.type==="link").length,documents:documents.filter(x=>clean(x.text)).length,total:scraped.length+documents.filter(x=>clean(x.text)).length}
    };
  }
  function normalizeSavedState(value={}){
    const answers={}; QUESTION_IDS.forEach(id=>{answers[id]=clean(value.answers?.[id]);});
    const explicitTargets=normalizeTargetMarkets(value.targetMarkets);
    const targetMarkets=explicitTargets.length?explicitTargets:normalizeTargetMarkets(answers.growth_markets);
    const docs=Array.isArray(value.documents)?value.documents.slice(0,5).map(d=>({name:clean(d?.name).slice(0,180),size:Number(d?.size)||0,text:String(d?.text||"").slice(0,25000),status:clean(d?.status)||"ready"})).filter(d=>d.name):[];
    const scrapedSources=Array.isArray(value.scrapedSources)?value.scrapedSources.slice(0,25).map(s=>({type:s?.type==="link"?"link":"website",url:normalizeUrl(s?.url),title:clean(s?.title).slice(0,180),text:String(s?.text||"").slice(0,30000),status:clean(s?.status)||"ready"})).filter(s=>s.url):[];
    const profile=value.profile&&typeof value.profile==="object"?{
      ...value.profile,
      mission:buildMission(),
      targetMarkets:clean(value.profile.targetMarkets)||targetMarkets.join("; "),
      researchMarkets:Array.isArray(value.profile.researchMarkets)&&value.profile.researchMarkets.length?expandTargetMarkets(value.profile.researchMarkets):expandTargetMarkets(targetMarkets),
      marketFocus:clean(value.profile.marketFocus)||answers.growth_markets
    }:null;
    if(profile){
      const regeneratedOverview=deriveCompanyOverview(scrapedSources,docs);
      const regeneratedDigest=deriveEvidenceDigest(scrapedSources,docs);
      const companyName=knownCompanyName(value.website)||clean(profile.companyName)||inferCompanyName(scrapedSources,value.website);
      if(knownCompanyName(value.website))profile.companyName=companyName;
      if(hasAssetNoise(profile.companyOverview)||hasEvidenceNavigationNoise(profile.companyOverview))profile.companyOverview=regeneratedOverview||regeneratedDigest||`LeadIntel has limited public evidence for ${companyName}. Strategic answers are used as the primary context until more evidence is added.`;
      if(hasAssetNoise(profile.evidenceDigest))profile.evidenceDigest=regeneratedDigest;
    }
    return {
      step:[1,2,3,4,5,6,7].includes(Number(value.step))?Number(value.step):1,
      website:normalizeUrl(value.website),
      targetMarkets,
      additionalLinks:unique((value.additionalLinks||[]).map(normalizeUrl).filter(Boolean)).slice(0,8),
      documents:docs,
      answers,
      scrapedSources,
      profile,
      approved:Boolean(value.approved)
    };
  }

  return {QUESTION_IDS,COUNTRIES,MARKET_REGIONS,SIGNAL_LIBRARY,normalizeUrl,normalizeTargetMarkets,expandTargetMarkets,canBuildProfile,canAccessModule,calculateCompleteness,buildCompanyIntelligenceProfile,normalizeSavedState,splitList};
});
