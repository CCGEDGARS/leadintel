(function(root, factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelProfile=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const Brief=(typeof globalThis!=="undefined"&&globalThis.LeadIntelStep2Brief)||(typeof require==="function"?require("./step2-brief-schema.js"):null);
  const QUESTION_IDS=Brief?.FIELD_IDS||[
    "priority_offers","ideal_customer","buyer_roles","exclusions","buying_outcomes",
    "buying_triggers","value_proposition","differentiation","proof_points","objections"
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
  function normalizeHttpsUrl(value){
    const raw=clean(value);if(!raw)return "";
    try{const url=new URL(raw);return url.protocol==="https:"&&!url.username&&!url.password?url.href:"";}catch{return "";}
  }
  function normalizeBrandColor(value){const color=clean(value).toLowerCase();return /^#[0-9a-f]{6}$/.test(color)?color:"";}
  function sourceBranding(source={}){
    const logoUrl=normalizeHttpsUrl(source.logoUrl);const primaryColor=normalizeBrandColor(source.primaryColor);const branding={};
    if(logoUrl)branding.logoUrl=logoUrl;if(primaryColor)branding.primaryColor=primaryColor;return branding;
  }
  function deriveBranding(sources=[]){
    const result={};for(const source of sources||[]){const branding=sourceBranding(source);if(!result.logoUrl&&branding.logoUrl)result.logoUrl=branding.logoUrl;if(!result.primaryColor&&branding.primaryColor)result.primaryColor=branding.primaryColor;if(result.logoUrl&&result.primaryColor)break;}return result;
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
    let score=0;
    if(normalizeUrl(input.website))score+=15;
    if(normalizeTargetMarkets(input.targetMarkets).length)score+=15;
    QUESTION_IDS.forEach(id=>{if(clean(answers[id]))score+=7;});
    if((input.additionalLinks||[]).some(normalizeUrl))score+=1;
    if((input.documents||[]).some(d=>clean(d?.text)||clean(d?.name)))score+=1;
    return Math.min(100,score);
  }
  function recommendSignals(answerText,sourceText){
    const combined=`${clean(answerText)} ${clean(sourceText)}`;
    const priorityScore={High:3,Medium:2,Low:1};
    const matched=SIGNAL_LIBRARY
      .map((signal,index)=>({...signal,matchScore:signal.patterns.filter(pattern=>pattern.test(combined)).length,index}))
      .filter(signal=>signal.matchScore>0)
      .sort((a,b)=>b.matchScore-a.matchScore-(priorityScore[a.priority]||0)+(priorityScore[b.priority]||0)||a.index-b.index);
    const defaults=["facility-expansion","capital-investment","market-entry","hiring"].map(id=>SIGNAL_LIBRARY.find(x=>x.id===id));
    return uniqueObjects([...matched,...defaults],"id").slice(0,5).map(({matchScore,index,...item})=>({...item,reason:signalReason(item,combined)}));
  }
  function mergeSignalRecommendations(existing,recommended){
    return uniqueObjects([...(Array.isArray(existing)?existing:[]),...(Array.isArray(recommended)?recommended:[])],"id").slice(0,5);
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
    if(!clean(answers.buying_outcomes))gaps.push("The customer problem or desired business outcome is not defined.");
    if(!clean(answers.value_proposition))gaps.push("The value proposition is not defined.");
    if(!clean(answers.differentiation))gaps.push("Competitive differentiation is not clear.");
    if(!clean(answers.buying_triggers))gaps.push("Buying triggers are not defined.");
    if(!clean(answers.proof_points))gaps.push("No approved proof point is available for outreach.");
    if(!clean(answers.objections))gaps.push("Common buyer objections are not defined.");
    if(!(scrapedSources||[]).length)gaps.push("No website evidence was successfully collected.");
    if(!(documents||[]).some(d=>clean(d.text)))gaps.push("No document text is available for supporting evidence.");
    return gaps;
  }
  function sourceMatchesWebsite(source,website){
    const target=normalizeUrl(website);const candidate=normalizeUrl(source?.url);if(!target||!candidate)return false;
    try{return new URL(target).hostname.replace(/^www\./i,"").toLowerCase()===new URL(candidate).hostname.replace(/^www\./i,"").toLowerCase();}catch{return false;}
  }
  const COMPANY_DESCRIPTION_RE=/\b(?:piedāvā|nodrošina|specializējas|apkalpo|ražo|izstrādā|piegādā|provid(?:e|es|ed|ing)|offer(?:s|ed|ing)?|speciali[sz](?:e|es|ed|ing)|manufactur(?:e|es|ed|ing)|deliver(?:s|ed|ing)?|serv(?:e|es|ed|ing))\b/i;
  const PRODUCT_DETAIL_RE=/\b(?:instrumentu\s+skapis|skapis|galds|krēsls|plaukts|ratiņi|modelis|artikuls|supply|tool\s+cabinet|cabinet|chair|desk|shelf|product)\b/i;
  function evidenceScope(source={}){
    if(source.type==="document")return "document";
    const text=clean(`${source.title||""} ${source.text||""}`);
    if(COMPANY_DESCRIPTION_RE.test(text))return "company";
    if(PRODUCT_DETAIL_RE.test(text))return "product";
    return "supporting";
  }
  function evidenceSourceRecord(source,index){
    const scope=evidenceScope(source);
    const labels={company:"Company-level evidence",product:"Limited product evidence",document:"Supporting document",supporting:"Supporting page evidence"};
    const supports={company:["Company identity","Offer portfolio"],product:["Priority offer"],document:["Supporting context"],supporting:["Supporting context"]};
    const url=normalizeUrl(source.url);
    let host="";try{host=new URL(url).hostname.replace(/^www\./i,"");}catch{}
    return {
      id:`E${index+1}`,
      type:scope==="document"?"PDF":source.type==="website"?"Official website":"Official page",
      title:clean(source.title||source.name)||host||`Evidence source ${index+1}`,
      url,
      scope,
      pageCategory:["company","offers","proof","delivery","contact"].includes(source.pageCategory)?source.pageCategory:"",
      scopeLabel:labels[scope],
      confidence:scope==="product"?"High source confidence · narrow scope":scope==="company"?"High source confidence":"Supporting evidence",
      excerpt:truncate(firstSentence(source.text)||clean(source.text),360),
      supports:supports[scope]
    };
  }
  function buildEvidenceSources(scrapedSources=[],documents=[]){
    const sources=[...(scrapedSources||[]).filter(source=>clean(source?.text)),...(documents||[]).filter(doc=>clean(doc?.text)).map(doc=>({type:"document",name:doc.name,title:doc.name,text:doc.text,url:""}))];
    return sources.map(evidenceSourceRecord);
  }
  function evidenceCoverage(records=[]){
    if(!records.length)return {level:"none",label:"No evidence collected",message:"No readable public or document evidence was collected."};
    const companyWide=records.filter(record=>record.scope==="company").length;
    const narrow=records.filter(record=>record.scope==="product").length;
    const categories=unique(records.map(record=>record.pageCategory).filter(Boolean));
    const minimumMet=categories.includes("company")&&categories.includes("offers")&&(categories.includes("proof")||categories.includes("delivery"));
    if(records.length===1&&narrow===1)return {level:"limited",label:"Limited coverage",message:"Only one narrow product claim was collected. It supports a priority offer but does not support the complete company profile."};
    if(!companyWide)return {level:"limited",label:"Limited coverage",message:"The collected sources provide supporting or product-level facts, but no company-wide description has been verified."};
    if(categories.length&&!minimumMet)return {level:"partial",label:"Partial coverage",message:`${categories.length}/5 authoritative company areas were verified. Add offer and project/reference or delivery evidence before treating the complete profile as strongly supported.`,categories,minimumMet};
    if(companyWide===1&&records.length===1)return {level:"partial",label:"Partial coverage",message:"One company-level source was collected. Add product, case-study or document evidence to strengthen the profile.",categories,minimumMet};
    return {level:"supported",label:"Supported coverage",message:`${records.length} sources provide company-level and supporting evidence for this profile.`,categories,minimumMet:categories.length?minimumMet:true};
  }
  function sourceSummary(scrapedSources=[],documents=[]){
    const website=scrapedSources.filter(x=>x.type==="website"&&clean(x.text)).length;
    const additionalLinks=scrapedSources.filter(x=>x.type==="link"&&clean(x.text)).length;
    const documentCount=documents.filter(x=>clean(x.text)).length;
    return {website,additionalLinks,documents:documentCount,total:website+additionalLinks+documentCount};
  }
  function buildCompanyIntelligenceProfile(input={}){
    const migrated=Brief?.migrateState?Brief.migrateState(input):input;
    const answers=Object.fromEntries(QUESTION_IDS.map(id=>[id,clean(migrated.answers?.[id])]));
    const profileFields=Brief?.profileFields?Brief.profileFields(answers):{
      priorityOffers:answers.priority_offers,idealCustomer:answers.ideal_customer,decisionMakers:answers.buyer_roles,
      exclusions:answers.exclusions,customerPainPoints:answers.buying_outcomes,buyingOutcomes:answers.buying_outcomes,
      buyingTriggers:answers.buying_triggers,valueProposition:answers.value_proposition,differentiation:answers.differentiation,
      proofPoints:answers.proof_points,commonObjections:answers.objections
    };
    const scraped=(input.scrapedSources||[]).filter(x=>x&&clean(x.text)&&sourceMatchesWebsite(x,input.website));
    const documents=(input.documents||[]).filter(x=>x&&clean(x.name));
    const combined=sourceText(scraped,documents);
    const legacyMarketFocus=clean(migrated.legacyStrategyContext?.growthMarkets||input.answers?.growth_markets);
    const selectedTargetMarkets=normalizeTargetMarkets(input.targetMarkets).length?normalizeTargetMarkets(input.targetMarkets):normalizeTargetMarkets(legacyMarketFocus);
    const researchMarkets=expandTargetMarkets(selectedTargetMarkets);
    const currentMarkets=detectCountries(combined).filter(country=>!researchMarkets.some(target=>target.toLowerCase()===country.toLowerCase()));
    const evidenceDigest=deriveEvidenceDigest(scraped,documents);
    const evidenceSources=buildEvidenceSources(scraped,documents);
    const companyName=inferCompanyName(scraped,input.website);
    const companyOverview=deriveCompanyOverview(scraped,documents);
    const branding=deriveBranding(scraped);
    return {
      version:2,
      generatedAt:new Date().toISOString(),
      companyName,
      website:normalizeUrl(input.website),
      companyOverview:companyOverview||evidenceDigest||`LeadIntel has limited public evidence for ${companyName}. Strategic answers are used as the primary context until more evidence is added.`,
      ...profileFields,
      currentMarkets,
      targetMarkets:selectedTargetMarkets.join("; "),
      researchMarkets,
      marketFocus:legacyMarketFocus,
      opportunityValue:clean(migrated.advancedScoring?.opportunityValue),
      commercialObjective:clean(migrated.workspaceGoals?.successOutcome),
      mission:buildMission(),
      recommendedSignals:recommendSignals(answers.buying_triggers,combined),
      informationGaps:informationGaps(answers,scraped,documents),
      completeness:calculateCompleteness({...input,targetMarkets:selectedTargetMarkets}),
      evidenceDigest,
      evidenceSources,
      evidenceCoverage:evidenceCoverage(evidenceSources),
      sourceSummary:sourceSummary(scraped,documents),
      ...branding
    };
  }
  function normalizeSavedState(value={}){
    const migrated=Brief?.migrateState?Brief.migrateState(value):value;
    const answers={}; QUESTION_IDS.forEach(id=>{answers[id]=clean(migrated.answers?.[id]);});
    const explicitTargets=normalizeTargetMarkets(value.targetMarkets);
    const legacyMarketFocus=clean(migrated.legacyStrategyContext?.growthMarkets||value.answers?.growth_markets);
    const targetMarkets=explicitTargets.length?explicitTargets:normalizeTargetMarkets(legacyMarketFocus);
    const docs=Array.isArray(value.documents)?value.documents.slice(0,5).map(d=>({name:clean(d?.name).slice(0,180),size:Number(d?.size)||0,text:String(d?.text||"").slice(0,25000),status:clean(d?.status)||"ready"})).filter(d=>d.name):[];
    const scrapedSources=Array.isArray(value.scrapedSources)?value.scrapedSources.slice(0,25).map(s=>({type:s?.type==="link"?"link":"website",url:normalizeUrl(s?.url),title:clean(s?.title).slice(0,180),text:String(s?.text||"").slice(0,30000),status:clean(s?.status)||"ready",pageCategory:["company","offers","proof","delivery","contact"].includes(s?.pageCategory)?s.pageCategory:"",...sourceBranding(s)})).filter(s=>s.url):[];
    const profile=value.profile&&typeof value.profile==="object"?{
      ...value.profile,
      mission:buildMission(),
      targetMarkets:clean(value.profile.targetMarkets)||targetMarkets.join("; "),
      researchMarkets:Array.isArray(value.profile.researchMarkets)&&value.profile.researchMarkets.length?expandTargetMarkets(value.profile.researchMarkets):expandTargetMarkets(targetMarkets),
      marketFocus:clean(value.profile.marketFocus)||legacyMarketFocus,
      recommendedSignals:mergeSignalRecommendations(
        value.profile.recommendedSignals,
        recommendSignals(clean(answers.buying_triggers)||clean(value.profile.buyingTriggers),sourceText(scrapedSources,docs))
      )
    }:null;
    if(profile){
      delete profile.logoUrl;delete profile.primaryColor;Object.assign(profile,deriveBranding(scrapedSources));
      const regeneratedOverview=deriveCompanyOverview(scrapedSources,docs);
      const regeneratedDigest=deriveEvidenceDigest(scrapedSources,docs);
      const companyName=knownCompanyName(value.website)||clean(profile.companyName)||inferCompanyName(scrapedSources,value.website);
      if(knownCompanyName(value.website))profile.companyName=companyName;
      if(hasAssetNoise(profile.companyOverview)||hasEvidenceNavigationNoise(profile.companyOverview))profile.companyOverview=regeneratedOverview||regeneratedDigest||`LeadIntel has limited public evidence for ${companyName}. Strategic answers are used as the primary context until more evidence is added.`;
      if(hasAssetNoise(profile.evidenceDigest))profile.evidenceDigest=regeneratedDigest;
      profile.evidenceSources=buildEvidenceSources(scrapedSources,docs);
      profile.evidenceCoverage=evidenceCoverage(profile.evidenceSources);
      profile.sourceSummary=sourceSummary(scrapedSources,docs);
    }
    return {
      step:[1,2,3,4,5,6,7].includes(Number(value.step))?Number(value.step):1,
      website:normalizeUrl(value.website),
      targetMarkets,
      additionalLinks:unique((value.additionalLinks||[]).map(normalizeUrl).filter(Boolean)).slice(0,8),
      documents:docs,
      answers,
      answerStatus:migrated.answerStatus||{},
      step2BriefSchemaVersion:migrated.step2BriefSchemaVersion,
      legacyStrategyContext:migrated.legacyStrategyContext||{},
      advancedScoring:migrated.advancedScoring||{},
      workspaceGoals:migrated.workspaceGoals||{},
      scrapedSources,
      profile,
      approved:Boolean(value.approved),
      ...(value.campaignStudio&&typeof value.campaignStudio==="object"&&!Array.isArray(value.campaignStudio)?{campaignStudio:value.campaignStudio}:{}),
      ...(value.referenceCustomers&&typeof value.referenceCustomers==="object"?{referenceCustomers:value.referenceCustomers}:{}),
      ...(value.referenceCustomerPortfolio&&typeof value.referenceCustomerPortfolio==="object"?{referenceCustomerPortfolio:value.referenceCustomerPortfolio}:{})
    };
  }

  function recommendedSignalsForProfile(profile={}){
    const answers=[profile.buyingTriggers,profile.priorityOffers,profile.idealCustomer].filter(clean).join(" ");
    const evidence=[profile.companyOverview,profile.differentiation].filter(clean).join(" ");
    return recommendSignals(answers,evidence);
  }
  return {recommendedSignalsForProfile,QUESTION_IDS,COUNTRIES,MARKET_REGIONS,SIGNAL_LIBRARY,normalizeUrl,normalizeTargetMarkets,expandTargetMarkets,canBuildProfile,canAccessModule,calculateCompleteness,buildEvidenceSources,evidenceCoverage,buildCompanyIntelligenceProfile,normalizeSavedState,splitList};
});
