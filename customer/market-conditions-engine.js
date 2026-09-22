(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelMarketConditions=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const clean=value=>String(value??"").replace(/\s+/g," ").trim();
  const unique=values=>[...new Set(values.map(clean).filter(Boolean))];
  const organisation=item=>clean(item.organisation)||(()=>{try{return new URL(item.url).hostname.replace(/^www\./,"");}catch{return "Unknown source";}})();
  const evidenceItem=item=>({title:clean(item.title)||"Source evidence",url:clean(item.url),organisation:organisation(item),date:clean(item.date)});
  const host=value=>{try{return new URL(value).hostname.replace(/^www\./,"").toLowerCase();}catch{return "";}};
  const officialHost=value=>/(^|\.)(europa\.eu|ec\.europa\.eu|eurostat\.ec\.europa\.eu|oecd\.org|worldbank\.org|gov\.[a-z]{2}|govt\.[a-z]{2}|stat\.[a-z]{2}|statistics\.[a-z]{2})$/i.test(host(value));
  const fingerprint=item=>clean(`${item.title||""} ${item.text||item.description||""}`).toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(word=>word.length>3).slice(0,24).sort().join(" ");
  function scoreEvidence(item={},now=Date.now()){
    let score=20;const domain=host(item.url);const parsed=Date.parse(item.date);const age=Number.isFinite(parsed)?Math.max(0,(now-parsed)/86400000):null;
    if(item.official===true||officialHost(item.url))score+=30;
    else if(/(university|institute|association|chamber|research|statistic)/i.test(`${domain} ${organisation(item)}`))score+=18;
    else if(domain)score+=8;
    if(age!==null)score+=age<=90?20:age<=365?12:age<=730?4:-8;
    if(clean(item.text).length>=800)score+=15;else if(clean(item.text).length>=250)score+=8;
    if(clean(item.date))score+=5;if(clean(item.title))score+=2;
    return Math.max(0,Math.min(100,score));
  }
  function assessEvidence(results=[],options={}){
    const now=Date.parse(options.now)||Date.now();const seenUrls=new Set(),seenFingerprints=new Set();let duplicatesRemoved=0;
    const ranked=[];
    for(const raw of Array.isArray(results)?results:[]){
      const item={...raw};const url=clean(item.url);const baseFingerprint=fingerprint(item);const family=clean(item.indicatorFamily||item.researchCategory);const fp=baseFingerprint?`${item.official===true||officialHost(url)?"official":"other"}:${family}:${baseFingerprint}`:"";
      if(!url||seenUrls.has(url)||(fp&&seenFingerprints.has(fp))){duplicatesRemoved++;continue;}
      seenUrls.add(url);if(fp)seenFingerprints.add(fp);
      ranked.push({...item,qualityScore:scoreEvidence(item,now),sourceClass:item.official===true||officialHost(url)?"official":/news|press|media/i.test(`${item.researchCategory} ${host(url)}`)?"media":"industry"});
    }
    ranked.sort((a,b)=>b.qualityScore-a.qualityScore);
    return {results:ranked,duplicatesRemoved,organisations:unique(ranked.map(organisation)),domains:unique(ranked.map(item=>host(item.url))),sourceClasses:unique(ranked.map(item=>item.sourceClass))};
  }

  function extractStructuredEvidence(results=[]){
    const funding=[],pricing=[],competitors=[],indicators=[];
    for(const item of results){
      const text=clean(`${item.title||""} ${item.description||""} ${item.text||""}`);const category=clean(item.researchCategory);
      if(category==="funding"&&(item.official===true||officialHost(item.url))){
        const status=/\b(closed|expired|applications? closed)\b/i.test(text)?"closed":/\b(open|applications? (?:are )?open|apply (?:by|before)|deadline)\b/i.test(text)?"open":"unknown";
        const deadline=text.match(/(?:deadline|apply (?:by|before))[:\s-]*((?:\d{1,2}\s+)?[A-Z][a-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1]||"";
        const eligibility=text.match(/(?:eligible|eligibility)[:\s-]*([^.;]{3,160})/i)?.[1]||"";
        funding.push({name:clean(item.title)||"Official funding programme",status,deadline,eligibility,url:item.url,source:evidenceItem(item)});
      }
      const price=inferredPricing(item);if(price)pricing.push({...price,url:item.url,source:evidenceItem(item)});
      if(category==="competition")competitors.push({name:clean(item.title),url:item.url,source:evidenceItem(item)});
      const direction=inferDirection(item);if(direction)indicators.push({direction,family:inferFamily(item),source:evidenceItem(item)});
    }
    return {funding,pricing,competitors,indicators};
  }

  function buildQualityGate(results=[],options={}){
    const mode=["quick","deep","intelligence"].includes(options.mode)?options.mode:"deep";const assessed=assessEvidence(results,options);
    const categories=new Set(assessed.results.map(item=>clean(item.researchCategory)||"commercial"));const gaps=[];
    const minSources=mode==="intelligence"?8:mode==="deep"?5:2;const minDomains=mode==="intelligence"?5:mode==="deep"?3:2;
    if(assessed.results.length<minSources)gaps.push("evidence volume");
    if(assessed.domains.length<minDomains||assessed.sourceClasses.length<2)gaps.push("source diversity");
    if(mode!=="quick")for(const category of ["direction","competition","funding","pricing","commercial"])if(!categories.has(category))gaps.push(category);
    const average=assessed.results.length?Math.round(assessed.results.reduce((sum,item)=>sum+item.qualityScore,0)/assessed.results.length):0;
    const passed=gaps.length===0&&average>=50;const confidence=passed&&assessed.organisations.length>=3&&average>=65?"High":assessed.results.length>=2&&average>=40?"Medium":"Low";
    return {passed,confidence,score:average,gaps:[...new Set(gaps)],sourceCount:assessed.results.length,domainCount:assessed.domains.length,duplicatesRemoved:assessed.duplicatesRemoved};
  }

  function buildAdaptivePlan(input={}){
    const mode=input.mode||"quick";if(mode==="quick")return {queries:[],gaps:[]};
    const results=Array.isArray(input.results)?input.results:[];const categories=new Set(results.map(item=>clean(item.researchCategory)));const gaps=[];
    for(const category of ["direction","competition","funding","pricing","commercial"])if(!categories.has(category)||results.filter(item=>clean(item.researchCategory)===category).length<2)gaps.push(category);
    const intents={direction:"official statistics sector output orders employment latest",competition:"competitor landscape market share supplier positioning",funding:"official EU and national funding open calls eligibility deadline",pricing:"public pricing hourly rate contract value comparable examples",commercial:"current buyer projects investments tenders and demand signals"};
    const limit=mode==="intelligence"?6:4;const market=clean(input.market)||"target market",offer=clean(input.offer)||"priority offer";
    return {gaps,queries:gaps.slice(0,limit).map((category,index)=>({id:`adaptive-${category}-${index+1}`,market,offer,researchCategory:category,sourceType:category==="funding"?"investments":category==="direction"?"registries":"news",query:`${market} ${offer} ${intents[category]}`}))};
  }

  function inferDirection(item={}){
    const explicit=clean(item.direction).toLowerCase();
    if(["accelerating","growing","stable","contracting"].includes(explicit))return explicit;
    const text=`${clean(item.title)} ${clean(item.description)} ${clean(item.text)}`.toLowerCase();
    if(/declin|contract|falling|downturn|layoff|insolvenc/.test(text))return "contracting";
    if(/accelerat|record growth|surging|rapid growth/.test(text))return "accelerating";
    if(/growth|growing|increase|expansion|rising|more vacancies/.test(text))return "growing";
    if(/stable|unchanged|flat|steady/.test(text))return "stable";
    return "";
  }
  function inferFamily(item={}){
    if(clean(item.indicatorFamily))return clean(item.indicatorFamily).toLowerCase();
    const text=`${clean(item.query)} ${clean(item.title)} ${clean(item.description)}`.toLowerCase();
    if(/job|hiring|employment|vacanc/.test(text))return "employment";
    if(/order|tender|procurement/.test(text))return "orders";
    if(/invest|funding|permit/.test(text))return "investment";
    if(/output|production|export|revenue/.test(text))return "output";
    return "other";
  }
  function classifyDirection(results=[]){
    const indicators=results.map(item=>({...evidenceItem(item),direction:inferDirection(item),family:inferFamily(item)})).filter(item=>item.direction);
    const families=unique(indicators.map(item=>item.family));
    const organisations=unique(indicators.map(item=>item.organisation));
    const directions=unique(indicators.map(item=>item.direction));
    if(indicators.length<2||families.length<2||organisations.length<2)return {label:"Insufficient evidence",confidence:"Low",summary:"More independent indicators are needed before describing the market direction.",evidence:indicators};
    if(directions.includes("contracting")&&directions.some(value=>value==="growing"||value==="accelerating"))return {label:"Mixed",confidence:"Low",summary:"The available indicators point in different directions.",evidence:indicators};
    const accelerating=indicators.filter(item=>item.direction==="accelerating").length;
    const positive=indicators.filter(item=>item.direction==="accelerating"||item.direction==="growing").length;
    if(families.length>=3&&organisations.length>=2&&accelerating>=2)return {label:"Accelerating",confidence:"High",summary:"Multiple independent indicator families show strengthening momentum.",evidence:indicators};
    if(positive>=2)return {label:"Growing",confidence:families.length>=3?"High":"Medium",summary:"Independent indicators support a growing market.",evidence:indicators};
    if(indicators.every(item=>item.direction==="contracting"))return {label:"Contracting",confidence:families.length>=3?"High":"Medium",summary:"Independent indicators point to weakening demand.",evidence:indicators};
    return {label:"Stable",confidence:"Medium",summary:"The available indicators do not show a clear directional shift.",evidence:indicators};
  }

  function isOfficialFunding(item={}){
    if(item.official===true)return true;
    try{return /(^|\.)(europa\.eu|ec\.europa\.eu|gov\.|government\.|eu$)/i.test(new URL(item.url).hostname);}catch{return false;}
  }
  function classifyFunding(results=[]){
    const active=[],closed=[];
    for(const item of results){
      if(!isOfficialFunding(item))continue;
      const text=`${clean(item.title)} ${clean(item.description)} ${clean(item.text)}`;
      const inferred=/\b(open|applications? (?:are )?open|apply (?:by|before)|deadline)\b/i.test(text)?{name:clean(item.title)||"Official funding programme",status:"open"}:/\b(closed|expired|applications? closed)\b/i.test(text)?{name:clean(item.title)||"Official funding programme",status:"closed"}:null;
      const funding=item.funding||inferred;if(!funding)continue;
      const record={...funding,source:evidenceItem(item)};
      const status=clean(funding.status).toLowerCase();
      (status==="open"||status==="active"?active:closed).push(record);
    }
    return {active,closed,summary:active.length?`${active.length} verified active funding ${active.length===1?"programme":"programmes"}.`:"No active official funding programme was verified."};
  }
  function inferredPricing(item={}){
    if(item.pricing)return item.pricing;
    const text=`${clean(item.title)} ${clean(item.description)} ${clean(item.text)}`;
    const euro=text.match(/(?:€\s*([\d,.]+)|([\d,.]+)\s*EUR)\s*(?:\/|per\s+)?(hour|hr|day|project)?/i);
    if(!euro)return null;
    const amount=Number(String(euro[1]||euro[2]).replace(/,/g,""));if(!Number.isFinite(amount))return null;
    const rawUnit=clean(euro[3]||"").toLowerCase();const unit=/^(hour|hr)$/.test(rawUnit)?"hour":rawUnit;
    return unit?{amount,currency:"EUR",unit}:null;
  }
  function classifyPricing(results=[]){
    const examples=results.map(item=>({item,pricing:inferredPricing(item)})).filter(({pricing})=>pricing&&Number.isFinite(Number(pricing.amount))).map(({item,pricing})=>({amount:Number(pricing.amount),currency:clean(pricing.currency).toUpperCase(),unit:clean(pricing.unit).toLowerCase(),source:evidenceItem(item)}));
    const keys=unique(examples.map(item=>`${item.currency}/${item.unit}`));
    const range=examples.length>=2&&keys.length===1?{minimum:Math.min(...examples.map(item=>item.amount)),maximum:Math.max(...examples.map(item=>item.amount)),currency:examples[0].currency,unit:examples[0].unit}:null;
    return {examples,range,summary:range?`Observed range: ${range.minimum}–${range.maximum} ${range.currency} per ${range.unit}.`:examples.length?"Pricing examples were found, but there is not enough comparable evidence for a reliable range.":"No comparable public pricing evidence was verified."};
  }
  function categoryEvidence(results,category){return results.filter(item=>clean(item.researchCategory)===category).map(evidenceItem);}
  function buildPack(results=[]){
    const list=Array.isArray(results)?results:[];
    const assessed=assessEvidence(list);const structured=extractStructuredEvidence(assessed.results);
    return {
      version:2,generatedAt:new Date().toISOString(),quality:buildQualityGate(assessed.results,{mode:"deep"}),structured,
      direction:classifyDirection(assessed.results.filter(item=>clean(item.researchCategory)==="direction"||item.direction||item.indicatorFamily)),
      competition:{summary:"Use the cited sources to compare visible competitors, positioning and underserved segments.",evidence:categoryEvidence(assessed.results,"competition")},
      funding:classifyFunding(assessed.results.filter(item=>clean(item.researchCategory)==="funding"||item.funding)),
      pricing:classifyPricing(assessed.results.filter(item=>clean(item.researchCategory)==="pricing"||item.pricing)),
      demand:{summary:"Prioritise recurring buyer needs that are supported by current evidence.",evidence:categoryEvidence(assessed.results,"commercial")},
      advice:{focus:["Lead with the strongest verified demand signal.","Use evidence as context, not as a claim about the buyer."],resistance:["Avoid overstating market growth or funding availability.","Expect buyers to ask for proof, timing and commercial relevance."]}
    };
  }
  function normalizePack(value){return value&&(value.version===1||value.version===2)?value:null;}
  return {buildPack,normalizePack,classifyDirection,classifyFunding,classifyPricing,assessEvidence,extractStructuredEvidence,buildQualityGate,buildAdaptivePlan,scoreEvidence};
});
