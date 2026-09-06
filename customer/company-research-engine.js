(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelCompanyResearch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const QUESTION_IDS=["priority_offers","ideal_customer","lookalike_customers","buyer_roles","growth_markets","differentiation","buying_triggers","exclusions","opportunity_value","success_outcome"];
  const CONFIDENCE=new Set(["high","medium","low"]);
  const MAX_PUBLIC_QUERIES=3;
  const MAX_SOURCES=25;
  const AUTHORITATIVE_CATEGORIES=Object.freeze(["company","offers","proof","delivery","contact"]);

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function truncate(value,max=1200){const text=clean(value);return text.length>max?`${text.slice(0,max-1)}…`:text;}
  function safeUrl(value){
    try{
      const raw=clean(value);if(!raw)return "";
      const url=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);
      if(!["http:","https:"].includes(url.protocol))return "";
      url.hash="";
      return url.href;
    }catch{return "";}
  }
  function canonicalUrl(value){
    const url=safeUrl(value);if(!url)return "";
    try{const parsed=new URL(url);parsed.hostname=parsed.hostname.toLowerCase();if(parsed.pathname!=="/")parsed.pathname=parsed.pathname.replace(/\/+$/g,"")||"/";return parsed.href;}catch{return url;}
  }
  function hostname(value){try{return new URL(safeUrl(value)).hostname.replace(/^www\./,"");}catch{return "";}}
  function unique(list){const seen=new Set();return (list||[]).filter(value=>{const key=clean(value).toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;});}
  function normalizeMarkets(value){return unique(Array.isArray(value)?value:clean(value).split(/;|,|\n|\|/)).slice(0,12).map(clean);}

  function buildResearchQueries(input={},requestedLimit=MAX_PUBLIC_QUERIES){
    const domain=hostname(input.website);if(!domain)return [];
    const company=clean(input.companyName).slice(0,100);
    const identity=company&&company.toLowerCase()!==domain.toLowerCase()?`"${company}" ${domain}`:domain;
    const markets=normalizeMarkets(input.targetMarkets).slice(0,5).join(" ");
    const candidates=[
      {id:"company-offer",query:`${identity} products services customers case studies`},
      {id:"company-news",query:`${identity} news partnerships expansion investment ${markets}`.trim()},
      {id:"company-network",query:`${identity} LinkedIn company profile distributors partners ${markets}`.trim()}
    ];
    const limit=Math.max(0,Math.min(MAX_PUBLIC_QUERIES,Number(requestedLimit)||MAX_PUBLIC_QUERIES));
    return candidates.slice(0,limit);
  }

  function buildAuthoritativePageQueries(input={}){
    const domain=hostname(input.website);if(!domain)return [];
    const company=clean(input.companyName).slice(0,100);const identity=company?`"${company}" `:"";
    return [
      {id:"official-company",categories:["company","contact"],query:`site:${domain} ${identity}about company contact`},
      {id:"official-offer",categories:["offers","delivery"],query:`site:${domain} ${identity}products services solutions delivery installation warranty`},
      {id:"official-proof",categories:["proof"],query:`site:${domain} ${identity}projects references case studies customers`}
    ];
  }

  const PAGE_CATEGORY_PATTERNS=Object.freeze({
    contact:/\b(contact|contacts|kontakt|kontakti|sazin(?:āties|ieties)|rekvizīti|locations?|offices?)\b/i,
    proof:/\b(case[- ]?stud(?:y|ies)|projects?|references?|customers?|clients?|projekti|realizētie|atsauksmes|klienti)\b/i,
    delivery:/\b(delivery|installation|service|support|warranty|shipping|piegāde|uzstādīšana|serviss|garantija|apkalpošana)\b/i,
    offers:/\b(products?|services?|solutions?|catalog|shop|produkti|pakalpojumi|risinājumi|katalogs|preces)\b/i,
    company:/\b(about(?:[- ]us)?|company|history|mission|team|par[- ]?mums|uzņēmums|vēsture|komanda|misija)\b/i
  });
  function classifyPageCategory(source={},website=""){
    if(AUTHORITATIVE_CATEGORIES.includes(source.pageCategory))return source.pageCategory;
    const url=canonicalUrl(source.url);if(url&&url===canonicalUrl(website))return "company";
    let path="";try{path=decodeURIComponent(new URL(url).pathname).replace(/[\/_-]+/g," ");}catch{}
    const signal=clean(`${path} ${source.title||""}`);
    for(const category of ["contact","proof","delivery","offers","company"]){if(PAGE_CATEGORY_PATTERNS[category].test(signal))return category;}
    return "other";
  }
  function selectAuthoritativePageCandidates(rows=[],website="",requestedLimit=8){
    const limit=Math.max(1,Math.min(10,Number(requestedLimit)||8));const selected=[];const seenUrls=new Set();const seenCategories=new Set();
    for(const raw of rows||[]){
      const item=normalizeSource(raw,"link",raw?.query||"");if(!item||!sameDomain(item.url,website))continue;
      let pathname="";try{pathname=new URL(item.url).pathname;}catch{}
      if(/\.(?:png|jpe?g|gif|webp|svg|ico|avif|bmp|css|js|map|woff2?|ttf|eot|pdf)$/i.test(pathname))continue;
      const category=classifyPageCategory(item,website);if(category==="other"||seenCategories.has(category))continue;
      const key=canonicalUrl(item.url);if(seenUrls.has(key))continue;
      seenUrls.add(key);seenCategories.add(category);selected.push({...item,type:"link",pageCategory:category});
      if(selected.length>=limit)break;
    }
    return selected;
  }

  function rawResults(payload){
    if(Array.isArray(payload))return payload;
    if(Array.isArray(payload?.data))return payload.data;
    if(Array.isArray(payload?.data?.data))return payload.data.data;
    if(Array.isArray(payload?.results))return payload.results;
    if(Array.isArray(payload?.web))return payload.web;
    return [];
  }
  function normalizeSource(row={},type="public",query=""){
    const url=canonicalUrl(row.url||row.link||row.metadata?.sourceURL||row.metadata?.url);if(!url)return null;
    const title=truncate(row.title||row.metadata?.title||hostname(url),180);
    const rawText=row.markdown||row.content||row.description||row.snippet||row.text||"";
    const max=type==="public"?16000:30000;
    const text=String(rawText||"").replace(/\u0000/g,"").trim().slice(0,max);
    return {type:["website","link","public"].includes(type)?type:"public",url,title,text,query:truncate(query,500),status:"ready",pageCategory:AUTHORITATIVE_CATEGORIES.includes(row.pageCategory)?row.pageCategory:""};
  }
  function assignIds(rows){return rows.map((row,index)=>({...row,id:`S${index+1}`}));}
  function normalizeSearchResults(payload,queryMeta={}){
    const seen=new Set();const rows=[];
    for(const raw of rawResults(payload)){
      const item=normalizeSource(raw,"public",queryMeta.query||"");if(!item)continue;
      const key=canonicalUrl(item.url);if(seen.has(key))continue;seen.add(key);rows.push(item);
      if(rows.length>=MAX_SOURCES)break;
    }
    return assignIds(rows);
  }
  function mergeSources(official=[],publicRows=[],limit=MAX_SOURCES){
    const seen=new Set();const rows=[];
    const add=(raw,defaultType)=>{
      const item=normalizeSource(raw,raw?.type||defaultType,raw?.query||"");if(!item)return;
      const key=canonicalUrl(item.url);if(seen.has(key))return;seen.add(key);rows.push(item);
    };
    (official||[]).forEach(row=>add(row,row?.type||"website"));
    (publicRows||[]).forEach(row=>add(row,"public"));
    return assignIds(rows.slice(0,Math.max(1,Math.min(MAX_SOURCES,Number(limit)||MAX_SOURCES))));
  }

  const RESEARCH_LIMITS=Object.freeze({standard:{maxPages:25,maxChars:100000,maxPdfs:5},deep:{maxPages:50,maxChars:200000,maxPdfs:10}});
  const ASSET_EXTENSION=/\.(?:png|jpe?g|gif|webp|svg|ico|avif|bmp|css|js|map|woff2?|ttf|eot|pdf)$/i;
  function sameDomain(left,right){const a=hostname(left),b=hostname(right);return Boolean(a&&b&&a===b);}
  function filterResearchSources(sources=[],website,options={}){
    const limits=RESEARCH_LIMITS[options.depth]||RESEARCH_LIMITS.standard;
    const primary=[],supporting=[],excluded=[],seen=new Set();let chars=0;
    for(const source of Array.isArray(sources)?sources:[]){
      const item=normalizeSource(source,source?.type||"public",source?.query||"");if(!item)continue;
      const key=canonicalUrl(item.url);if(seen.has(key))continue;seen.add(key);
      const parsed=new URL(item.url);const asset=ASSET_EXTENSION.test(parsed.pathname)||/^image\//i.test(item.mimeType||"");
      if(asset){excluded.push({...item,reason:"Asset or non-content URL excluded."});continue;}
      if(!item.text.trim()){excluded.push({...item,reason:"No readable text returned."});continue;}
      if(chars+item.text.length>limits.maxChars){excluded.push({...item,reason:`Research character limit reached (${limits.maxChars}).`});continue;}
      chars+=item.text.length;
      if(sameDomain(item.url,website)&&primary.length<limits.maxPages)primary.push({...item,role:"primary"});
      else if(!sameDomain(item.url,website))supporting.push({...item,role:"supporting"});
      else excluded.push({...item,reason:`Research page limit reached (${limits.maxPages}).`});
    }
    const primaryWithIds=assignIds(primary);const supportingWithIds=assignIds(supporting.slice(0,MAX_SOURCES)).map((row,index)=>({...row,id:`S${primaryWithIds.length+index+1}`}));return {primary:primaryWithIds,supporting:supportingWithIds,excluded,limits,characters:chars};
  }
  function evaluateResearchQuality(input={}){
    const website=canonicalUrl(input.website);const primary=Array.isArray(input.primary)?input.primary:[];const supporting=Array.isArray(input.supporting)?input.supporting:[];
    const primaryWebsite=primary.filter(source=>sameDomain(source?.url,website)&&source?.type==="website"&&clean(source?.text));
    const foreignPrimary=primary.filter(source=>!sameDomain(source?.url,website));
    const checks={
      websiteProvided:Boolean(website),
      primaryDomainMatch:primaryWebsite.length>0,
      readablePrimaryEvidence:primary.some(source=>clean(source?.text)),
      noForeignPrimaryEvidence:foreignPrimary.length===0,
      supportingSeparated:supporting.every(source=>!sameDomain(source?.url,website)||source?.role!=="primary"),
      failures:Number(input.failures)||0
    };
    const categories=unique(primary.map(source=>classifyPageCategory(source,website)).filter(category=>AUTHORITATIVE_CATEGORIES.includes(category)));
    const missing=AUTHORITATIVE_CATEGORIES.filter(category=>!categories.includes(category));
    const minimumMet=categories.includes("company")&&categories.includes("offers")&&(categories.includes("proof")||categories.includes("delivery"));
    const coverage={categories,missing,score:Math.round(categories.length/AUTHORITATIVE_CATEGORIES.length*100),minimumMet,total:AUTHORITATIVE_CATEGORIES.length};
    const issues=[];const warnings=[];if(!checks.websiteProvided)issues.push("Company website is missing.");
    if(!checks.primaryDomainMatch)issues.push("Primary website evidence is missing.");
    if(!checks.readablePrimaryEvidence)issues.push("No readable primary evidence was collected.");
    if(!checks.noForeignPrimaryEvidence)issues.push("Foreign-domain evidence entered the primary evidence set.");
    if(!categories.includes("offers"))warnings.push("Offer or service evidence is missing; commercial claims require review.");
    if(!categories.includes("company"))warnings.push("Company-level identity evidence is missing.");
    if(!categories.includes("proof")&&!categories.includes("delivery"))warnings.push("Project/reference or delivery evidence is missing; high confidence is not permitted.");
    return {publishable:Boolean(checks.websiteProvided&&checks.primaryDomainMatch&&checks.readablePrimaryEvidence&&checks.noForeignPrimaryEvidence),checks,coverage,issues,warnings};
  }

  function capDraftConfidence(draft={},coverage={}){
    if(coverage?.minimumMet)return draft;
    const output={};for(const [id,row] of Object.entries(draft||{})){
      if(!row||typeof row!=="object"){output[id]=row;continue;}
      output[id]={...row,confidence:row.confidence==="high"?"medium":row.confidence,rationale:row.confidence==="high"?truncate(`${row.rationale||"Evidence found."} Authoritative company coverage incomplete; confidence capped.`,500):row.rationale};
    }
    return output;
  }

  function stripFence(text){return String(text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/," ").trim();}
  function parseAiDraft(text,validSourceIds=[]){
    let parsed;try{parsed=JSON.parse(stripFence(text));}catch{return {};}
    const fields=parsed&&typeof parsed==="object"?(parsed.fields&&typeof parsed.fields==="object"?parsed.fields:parsed):{};
    const valid=new Set((validSourceIds||[]).map(String));const output={};
    for(const id of QUESTION_IDS){
      const row=fields[id];if(!row||typeof row!=="object")continue;
      const confidence=clean(row.confidence).toLowerCase();if(!CONFIDENCE.has(confidence))continue;
      const value=truncate(row.value,1500);
      const sourceIds=unique(Array.isArray(row.source_ids)?row.source_ids:row.sourceIds||[]).map(String).filter(sourceId=>valid.has(sourceId)).slice(0,6);
      output[id]={value,confidence,sourceIds,rationale:truncate(row.rationale,500)};
    }
    return output;
  }

  function emptyDraftItem(){return {value:"",confidence:"low",sourceIds:[],rationale:"Insufficient explicit evidence."};}
  function evidenceText(sources){return (sources||[]).map(source=>`${clean(source.title)} ${clean(source.text)}`).join(" ");}
  function matchingSourceIds(sources,patterns){return unique((sources||[]).filter(source=>patterns.some(pattern=>pattern.test(`${source.title||""} ${source.text||""}`))).map(source=>source.id)).slice(0,6);}
  function confidenceFor(ids,preferHigh=false){if(!ids.length)return "low";if(preferHigh||ids.length>=2)return "high";return "medium";}
  function item(value,ids,rationale,preferHigh=false){const cleanValue=truncate(value,1500);return {value:cleanValue,confidence:cleanValue?confidenceFor(ids,preferHigh):"low",sourceIds:cleanValue?ids:[],rationale:cleanValue?rationale:"Insufficient explicit evidence."};}

  function offerFromTitles(sources){
    const candidates=[];let ids=[];
    for(const source of sources||[]){
      if(source.type!=="website"&&source.type!=="link")continue;
      const parts=String(source.title||"").split(/\s[|–—]\s|\s-\s/).map(clean).filter(part=>part.length>=4&&part.length<=110);
      if(parts.length>1){
        for(const part of parts.slice(1))if(!/home|about|contact|company|welcome/i.test(part)){candidates.push(part);ids.push(source.id);}
      }
    }
    return {value:unique(candidates).slice(0,3).join("; "),ids:unique(ids).slice(0,6)};
  }
  const INDUSTRIES=[
    ["Factories",/\bfactor(?:y|ies)\b/i],["Manufacturing",/\bmanufactur(?:er|ers|ing)\b/i],["Warehouses",/\bwarehouse(?:s)?\b/i],
    ["Food production",/\bfood (?:production|processing|manufacturing)\b/i],["Logistics",/\blogistics?\b/i],["Construction",/\bconstruction\b/i],
    ["Automotive",/\bautomotive\b/i],["Energy",/\benergy\b|\bpower generation\b/i],["Pharmaceutical",/\bpharma(?:ceutical)?s?\b/i],
    ["Healthcare",/\bhealthcare\b|\bhospitals?\b/i],["Retail",/\bretail(?:er|ers)?\b/i],["Real estate",/\breal estate\b|\bproperty developers?\b/i],
    ["Hospitality",/\bhospitality\b|\bhotels?\b/i],["Agriculture",/\bagricultur(?:e|al)\b/i]
  ];
  const ROLES=[
    ["CEO",/\bCEO\b|chief executive officer/i],["Procurement Director",/procurement director/i],["Procurement Manager",/procurement manager/i],
    ["Production Director",/production director/i],["Production Manager",/production manager/i],["Facility Manager",/facilit(?:y|ies) manager/i],
    ["Technical Director",/technical director/i],["Operations Director",/operations director/i],["Operations Manager",/operations manager/i],
    ["Purchasing Manager",/purchasing manager/i],["HR Director",/HR director|human resources director/i],["Managing Director",/managing director/i]
  ];
  const DIFFERENTIATORS=[
    ["Custom solutions",/custom(?:ized|ised|ization|isation)? solutions?|tailor(?:ed| made)/i],["Certified",/\bcertified\b|certification/i],
    ["ISO certified",/\bISO\s?\d{3,5}\b|ISO certified/i],["Fast delivery",/fast (?:delivery|lead time|response)/i],["Reliable delivery",/reliable (?:delivery|service|partner)/i],
    ["In-house capability",/in[- ]house/i],["Turnkey delivery",/turnkey/i],["Patented technology",/patent(?:ed)?/i],["Specialist expertise",/speciali[sz](?:ed|ation)|specialist expertise/i]
  ];
  const TRIGGERS=[
    ["Facility expansion or new site",/new factory|new facility|new site|facility expansion|capacity expansion|expansion project/i],
    ["Capital investment or modernization",/moderni[sz]ation|equipment upgrade|capital investment|capex|automation investment/i],
    ["Tender or procurement activity",/\btender\b|procurement|\bRFP\b|request for proposal/i],["Funding or investment",/funding|investment round|grant|financing/i],
    ["Strategic hiring",/hiring|recruiting|vacanc(?:y|ies)/i],["New market or export expansion",/market entry|export expansion|international expansion|new market/i],
    ["Regulatory or compliance change",/regulation|compliance change|new standard|directive/i],["Supplier or partner change",/supplier change|new supplier|vendor change|partner search/i],
    ["Product or service launch",/new product|product launch|new service|service launch/i]
  ];
  const LV_TAXONOMY=Object.freeze({
    "Factories":"Ražotnes","Manufacturing":"Ražošanas uzņēmumi","Warehouses":"Noliktavas","Food production":"Pārtikas ražošana","Logistics":"Loģistika","Construction":"Būvniecība","Automotive":"Autobūve","Energy":"Enerģētika","Pharmaceutical":"Farmācija","Healthcare":"Veselības aprūpe","Retail":"Mazumtirdzniecība","Real estate":"Nekustamais īpašums","Hospitality":"Viesmīlība","Agriculture":"Lauksaimniecība",
    "CEO":"Uzņēmumu vadītāji","Procurement Director":"Iepirkumu direktori","Procurement Manager":"Iepirkumu vadītāji","Production Director":"Ražošanas direktori","Production Manager":"Ražošanas vadītāji","Facility Manager":"Ēku un saimniecības vadītāji","Technical Director":"Tehniskie direktori","Operations Director":"Darbības direktori","Operations Manager":"Darbības vadītāji","Purchasing Manager":"Sagādes vadītāji","HR Director":"Personāla direktori","Managing Director":"Rīkotājdirektori",
    "Custom solutions":"Pielāgoti risinājumi","Certified":"Sertificēts piedāvājums","ISO certified":"ISO sertifikācija","Fast delivery":"Ātra piegāde","Reliable delivery":"Uzticama piegāde","In-house capability":"Pašu uzņēmuma kompetence","Turnkey delivery":"Pilna cikla piegāde","Patented technology":"Patentēta tehnoloģija","Specialist expertise":"Specializēta kompetence",
    "Facility expansion or new site":"Telpu paplašināšana vai jauna objekta izveide","Capital investment or modernization":"Kapitālieguldījumi vai modernizācija","Tender or procurement activity":"Iepirkums vai konkurss","Funding or investment":"Finansējums vai investīcijas","Strategic hiring":"Stratēģiska darbinieku piesaiste","New market or export expansion":"Jauna tirgus vai eksporta paplašināšana","Regulatory or compliance change":"Normatīvo vai atbilstības prasību izmaiņas","Supplier or partner change":"Piegādātāja vai partnera maiņa","Product or service launch":"Produkta vai pakalpojuma ieviešana"
  });
  function isLatvian(input={}){const language=clean(input.uiLanguage).toLowerCase();return language==='lv'||language.startsWith('lv-');}
  function resolveResearchLanguage(input={}){
    const selected=clean(input.selectorValue||input.storedValue||'lv').toLowerCase();
    if(selected==='en'||selected==='lv')return selected;
    return (Array.isArray(input.navigatorLanguages)?input.navigatorLanguages:[]).some(value=>clean(value).toLowerCase().startsWith('lv'))?'lv':'en';
  }
  function lvSourceText(value){const text=clean(value);return /[āčēģīķļņšūž]/i.test(text)||/\b(?:un|vai|ar|darba|biroja|mēbeles|noliktavu|ražotn|piegād|risinājum)\w*\b/i.test(text);}
  function taxonomyDraft(sources,library,lv=false){
    const labels=[];const ids=[];
    for(const [label,pattern] of library){const matched=matchingSourceIds(sources,[pattern]);if(matched.length){labels.push(lv?(LV_TAXONOMY[label]||label):label);ids.push(...matched);}}
    return {value:unique(labels).slice(0,5).join("; "),ids:unique(ids).slice(0,6)};
  }
  function buildEvidenceDraft(input={}){
    const sources=(input.sources||[]).filter(Boolean);const lv=isLatvian(input);const draft=Object.fromEntries(QUESTION_IDS.map(id=>[id,emptyDraftItem()]));
    const offers=offerFromTitles(sources);
    if(offers.value&&(!lv||lvSourceText(offers.value)))draft.priority_offers=item(offers.value,offers.ids,lv?"Atvasināts no oficiālo produktu vai pakalpojumu lapu nosaukumiem.":"Derived from official product/service page titles.",true);
    else {
      const text=evidenceText(sources);const match=text.match(/(?:we (?:provide|offer|manufacture|design|deliver)|speciali[sz]e in)\s+([^.!?]{8,150})/i);
      if(match&&(!lv||lvSourceText(match[1]))){const ids=matchingSourceIds(sources,[new RegExp(match[1].slice(0,30).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i")]);draft.priority_offers=item(match[1],ids,lv?"Iegūts no skaidri formulēta uzņēmuma piedāvājuma apraksta.":"Extracted from an explicit company offer statement.");}
    }
    const industries=taxonomyDraft(sources,INDUSTRIES,lv);
    draft.ideal_customer=item(industries.value,industries.ids,lv?"Savāktajos pierādījumos tieši minētās nozares vai klientu darbības vide.":"Industries/customer environments explicitly mentioned in collected evidence.");
    draft.growth_markets=item(industries.value,industries.ids,lv?"Pierādījumos tieši minētie segmenti; mērķa ģeogrāfiju lietotājs nosaka 1. solī.":"Segments explicitly mentioned in collected evidence; selected geography remains controlled in Step 1.");
    const roles=taxonomyDraft(sources,ROLES,lv);draft.buyer_roles=item(roles.value,roles.ids,lv?"Pierādījumos tieši minētās pircēju vai amata lomas.":"Buyer/job roles explicitly present in collected evidence.");
    const differentiators=taxonomyDraft(sources,DIFFERENTIATORS,lv);draft.differentiation=item(differentiators.value,differentiators.ids,lv?"Pierādījumos atrastie skaidri formulētie kompetences, sertifikācijas vai piegādes apgalvojumi.":"Explicit capability, certification or delivery claims found in evidence.");
    const triggers=taxonomyDraft(sources,TRIGGERS,lv);draft.buying_triggers=item(triggers.value,triggers.ids,lv?"Savāktajos pierādījumos konstatētās komerciālo pirkšanas signālu pazīmes.":"Commercial trigger language observed in collected evidence.");
    return draft;
  }

  function mergeDraft(currentAnswers={},draft={},previousMeta={}){
    const answers={};const meta={};
    for(const id of QUESTION_IDS){
      const current=clean(currentAnswers?.[id]);const row=draft?.[id]||emptyDraftItem();
      const previous=previousMeta[id];
      const replaceDraft=previous?.origin==="research"&&!previous.reviewed;
      if(current&&!replaceDraft){answers[id]=current;meta[id]=previous?{...previous}:{origin:"user",confidence:"",sourceIds:[],rationale:"Existing answer preserved."};continue;}
      const value=truncate(row.value,1500);answers[id]=value;
      meta[id]=value?{origin:"research",confidence:CONFIDENCE.has(row.confidence)?row.confidence:"low",sourceIds:unique(row.sourceIds||row.source_ids||[]).slice(0,6),rationale:truncate(row.rationale,500)}:{origin:"needs-input",confidence:"",sourceIds:[],rationale:"Insufficient evidence; customer input recommended."};
    }
    return {answers,meta};
  }

  function reviewActionState(row={}){
    if(clean(row.origin).toLowerCase()!=="research")return {visible:false,label:"",disabled:true};
    if(Boolean(row.reviewed))return {visible:true,label:"Accepted ✓",disabled:true};
    return {visible:true,label:"Accept",disabled:false};
  }

  function deriveCompanyName(sources=[],website=""){
    const official=(sources||[]).find(source=>source.type==="website")||(sources||[])[0];
    const title=clean(official?.title);if(title){const first=clean(title.split(/\s[|–—]\s|\s-\s/)[0]);if(first&&first.length<=100)return first;}
    const domain=hostname(website);return domain?domain.split(".")[0].replace(/[-_]+/g," ").replace(/\b\w/g,char=>char.toUpperCase()):"Company";
  }

  function buildAiPrompt(input={}){
    const sources=(input.sources||[]).slice(0,MAX_SOURCES);const docs=(input.documents||[]).filter(doc=>clean(doc?.text)).slice(0,5);
    const requestedLanguage=clean(input.uiLanguage).toLowerCase();
    const outputLanguage=requestedLanguage==="en"||requestedLanguage.startsWith("en")?"English":"Latvian";
    const sourceLines=sources.map(source=>`[${source.id}] ${source.title||source.url}\nURL: ${source.url}\n${String(source.text||"").slice(0,5000)}`).join("\n\n");
    const docLines=docs.map((doc,index)=>`[D${index+1}] PDF ${clean(doc.name)}\n${String(doc.text||"").slice(0,4000)}`).join("\n\n");
    const system="You are the LeadIntel evidence analyst. Use only supplied evidence. Never invent customers, prices, deal values, certifications, buyer roles, markets, exclusions or objectives. Return strict JSON only. If evidence is insufficient for a field, use an empty value. Every returned value must be written entirely in "+outputLanguage+"; do not mix languages or leave English business terminology inside Latvian output.";
    const schema=QUESTION_IDS.map(id=>`\"${id}\":{\"value\":\"\",\"confidence\":\"high|medium|low\",\"source_ids\":[\"S1\"],\"rationale\":\"brief evidence reason\"}`).join(",");
    const prompt=`Output language: ${outputLanguage}\nCompany website: ${safeUrl(input.website)}\nTarget markets selected by customer: ${normalizeMarkets(input.targetMarkets).join("; ")}\n\nFill only what the evidence supports. Write complete, ready-to-use answers in the requested output language, not notes or placeholders. Target-market geography is already user-controlled, so growth_markets should describe industries/segments/customer groups inside those markets. opportunity_value, success_outcome and exclusions must remain empty unless explicitly evidenced. Buyer roles may be inferred only when the evidence strongly supports the buying function; mark inference low or medium confidence.\n\nReturn exactly this shape: {\"fields\":{${schema}}}\n\nWEB EVIDENCE\n${sourceLines||"No readable web evidence."}\n\nDOCUMENT EVIDENCE\n${docLines||"No document evidence."}`;
    return {system,prompt};
  }

  return {QUESTION_IDS,MAX_PUBLIC_QUERIES,MAX_SOURCES,RESEARCH_LIMITS,AUTHORITATIVE_CATEGORIES,safeUrl,resolveResearchLanguage,buildResearchQueries,buildAuthoritativePageQueries,classifyPageCategory,selectAuthoritativePageCandidates,normalizeSearchResults,mergeSources,filterResearchSources,evaluateResearchQuality,capDraftConfidence,parseAiDraft,buildEvidenceDraft,mergeDraft,reviewActionState,deriveCompanyName,buildAiPrompt};
});
