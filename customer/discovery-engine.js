(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelDiscovery=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const CRM_STAGES=["Discovered","Qualified","Contact Found","Ready for Outreach","Contacted","Replied","Meeting","Proposal","Won","Lost"];
  const BLOCKED_HOSTS=[
    "linkedin.com","facebook.com","instagram.com","twitter.com","x.com","youtube.com","wikipedia.org","crunchbase.com",
    "reuters.com","bloomberg.com","forbes.com","businessinsider.com","yahoo.com","google.com","bing.com","duckduckgo.com",
    "glassdoor.com","indeed.com","tiktok.com","reddit.com"
  ];
  const TENDER_HOSTS=["eis.gov.lv","iub.gov.lv","procurement.gov.lv"];
  const DEFAULT_DISCOVERY_TARGET=10;
  const MAX_DISCOVERY_TARGET=50;
  const DISCOVERY_QUALITY_VERSION=3;
  const MINIMUM_DISCOVERY_FIT_SCORE=10;
  const DEFAULT_DISCOVERY_FUNNEL=Object.freeze({marketSearchesCompleted:0,marketSearchesTotal:0,evidencePages:0,companiesIdentified:0,officialDomainsResolved:0,companySitesChecked:0,verifiedCompanies:0,qualifiedCompanies:0,adaptiveFollowUpSearches:0,openAiFallbackSearches:0});
  const DEFAULT_DISCOVERY_STATE=Object.freeze({status:"idle",queries:[],rawResults:[],candidates:[],companyMentions:[],searchFailures:[],checkedCompanyDomains:[],lastSuccessfulRunAt:"",latestRunCandidateCount:0,retainedLastSuccessfulResults:false,extraction:{status:"idle",method:"",message:""},potentialMatches:[],funnel:DEFAULT_DISCOVERY_FUNNEL,pipeline:[],lastRunAt:"",qualityVersion:DISCOVERY_QUALITY_VERSION,needsRefresh:false});
  const MAX_DISCOVERY_FOLLOW_UP_QUERIES=4;
  const MAX_DISCOVERY_COMPANY_CHECKS=30;
  const STOPWORDS=new Set(["with","from","that","this","your","their","into","over","under","company","companies","business","businesses","priority","market","markets","customer","customers","service","services","product","products","industrial"]);
  const GENERIC_SIGNAL_TERMS=new Set(["new","product","products","service","services","launch","launched","launches","latest","update","updates","company","companies"]);
  const FIT_GENERIC_TERMS=new Set(["company","companies","business","businesses","industry","industries","industrial","manufacturing","manufacturer","manufacturers","production","producer","producers","factory","factories","facility","facilities","engineering","engineer","engineers","product","products","service","services","market","markets","customer","customers","equipment","project","projects","technology","technologies","solution","solutions","organization","organizations","employee","employees","custom","serial","sweden","swedish","sverige"]);
  const LOW_QUALITY_DISCOVERY_TITLE=/\b(?:\d+\s+top|top\s+\d+|top\s+(?:manufacturing|industrial|technology|business|company)\s+companies|best\s+(?:manufacturing|industrial|technology|business|company)\s+companies|companies\s+in\s+(?:sweden|sverige|finland|norway|denmark)|list\s+of\s+(?:top\s+)?\d+\s+companies|company\s+directory)\b/i;
  const LOW_QUALITY_DISCOVERY_HOSTS=["f6s.com","crunchbase.com","tracxn.com"];
  const MARKET_RULES=[
    {code:"se",suffixes:[".se"],searchNames:["Sweden","Sverige"],aliases:["sweden","swedish","sverige","svenska","zviedrija","zviedrijas","zviedru"]},
    {code:"fi",suffixes:[".fi"],searchNames:["Finland","Suomi"],aliases:["finland","finnish","suomi","somija","somijas","somu"]},
    {code:"no",suffixes:[".no"],searchNames:["Norway","Norge"],aliases:["norway","norwegian","norge","norsk","norvēģija","norvēģijas","norvēģu"]},
    {code:"dk",suffixes:[".dk"],searchNames:["Denmark","Danmark"],aliases:["denmark","danish","danmark","dansk","dānija","dānijas","dāņu"]},
    {code:"lv",suffixes:[".lv"],searchNames:["Latvia","Latvija"],aliases:["latvia","latvian","latvija","latvijas","latviešu"]},
    {code:"ee",suffixes:[".ee"],searchNames:["Estonia","Eesti"],aliases:["estonia","estonian","eesti","igaunija","igaunijas","igauņu"]},
    {code:"lt",suffixes:[".lt"],searchNames:["Lithuania","Lietuva"],aliases:["lithuania","lithuanian","lietuva","lietuvā","lietuviešu"]},
    {code:"de",suffixes:[".de"],searchNames:["Germany","Deutschland"],aliases:["germany","german","deutschland","deutsche","vācija","vācijas","vācu"]},
    {code:"gb",suffixes:[".uk",".co.uk"],searchNames:["United Kingdom","Britain"],aliases:["united kingdom","britain","british","england","english","apvienotā karaliste","lielbritānija","lielbritānijas"]},
    {code:"nl",suffixes:[".nl"],searchNames:["Netherlands","Nederland"],aliases:["netherlands","dutch","nederland","nīderlande","nīderlandes","holande"]},
    {code:"pl",suffixes:[".pl"],searchNames:["Poland","Polska"],aliases:["poland","polish","polska","polija","polijas","poļu"]},
    {code:"fr",suffixes:[".fr"],searchNames:["France"],aliases:["france","french","français","francija","francijas","franču"]},
    {code:"es",suffixes:[".es"],searchNames:["Spain","España"],aliases:["spain","spanish","españa","spānija","spānijas","spāņu"]},
    {code:"it",suffixes:[".it"],searchNames:["Italy","Italia"],aliases:["italy","italian","italia","itālija","itālijas","itāļu"]}
  ];
  const SIGNAL_CONCEPTS=[
    {match:/expan|capacity|new factor|new facilit|paplašin|jauna? ražot|jaudas palielin|utök|ny fabrik|produktionskapacitet/i,base:["new factory","new facility","capacity expansion","expanding production capacity"],local:{se:["ny fabrik","ny anläggning","utökar produktionskapaciteten","kapacitetsökning"]}},
    {match:/moderni|automat|equipment|iekārt|robot|digital transform|moderniser|ny utrustning/i,base:["modernization","automation investment","new equipment","equipment upgrade","robotics"],local:{se:["modernisering","automationsinvestering","ny utrustning","robotisering"]}},
    {match:/invest|funding|finansēj|ieguld|capital|finansier|investering/i,base:["investment","funding","capital investment","growth financing"],local:{se:["investering","finansiering","kapitalinvestering"]}},
    {match:/hiring|recruit|vacanc|pieņem darbā|darbiniek|vakanc|rekryter|anställ/i,base:["hiring","recruitment","new vacancies","team growth"],local:{se:["rekrytering","anställer","nya lediga tjänster"]}},
    {match:/relocat|pārcel|flyttar|nytt huvudkontor/i,base:["relocation","new headquarters","moving operations"],local:{se:["flyttar verksamheten","nytt huvudkontor"]}},
    {match:/acqui|merger|apvieno|iegād|förvärv|fusion/i,base:["acquisition","merger","company acquisition"],local:{se:["företagsförvärv","fusion"]}},
    {match:/leadership|management change|vadības mai|new director|appoint|ny vd|ledningsförändring/i,base:["leadership change","new CEO","new director","appointed"],local:{se:["ny vd","ny direktör","ledningsförändring","utsedd"]}},
    {match:/tender|procurement|iepirk|upphandling/i,base:["tender","procurement","contract award"],local:{se:["upphandling","anbud","kontraktstilldelning"]}}
  ];
  const GENERIC_COMPANY_TITLES=/^(?:home|welcome|about us|official site|services?|products?|solutions?|met[aā]la konstrukcijas|steel structures?|metal fabrication)$/i;
  const SELLER_LANGUAGE=/(?:\bwe (?:offer|provide|manufacture|produce|fabricate|supply|sell|deliver)\b|\bour (?:services|products|solutions)\b|\bfabrication services?\b|\bm[eē]s (?:pied[aā]v[aā]jam|ra[zž]ojam|izgatavojam|pieg[aā]d[aā]jam)\b|\bm[uū]su (?:pakalpojumi|produkti|produkcija)\b)/i;
  const SAME_OFFER_SELLER_ROLES=new Set(["manufacturer","manufacturers","supplier","suppliers","provider","providers","fabricator","fabricators","ražotājs","ražotāji","piegādātājs","piegādātāji","tillverkare","leverantör","leverantörer"]);
  const ROLE_GENERIC_WORDS=new Set(["chief","officer","director","manager","managing","head","vice","president","vp","senior","lead","leader","executive","global","regional","group"]);
  const SENIORITY_SCORE={owner:45,founder:45,c_suite:40,partner:35,vp:32,head:30,director:25,manager:15,senior:8};

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function clamp(value,min,max,fallback=min){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function splitList(value){
    if(Array.isArray(value))return [...new Set(value.map(clean).filter(Boolean))];
    return [...new Set(String(value??"").split(/\n|;|\||,/).map(clean).filter(Boolean))];
  }
  function slug(value){return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item";}
  function normalizeUrl(value){try{const u=new URL(clean(value));return ["http:","https:"].includes(u.protocol)?u.href:"";}catch{return "";}}
  function normalizeLinkedInUrl(value){
    const url=normalizeUrl(value);if(!url)return "";
    try{
      const parsed=new URL(url);
      if(!/(^|\.)linkedin\.com$/i.test(parsed.hostname)||!/^\/(?:in|pub)\//i.test(parsed.pathname))return "";
      parsed.search="";parsed.hash="";
      return parsed.href.replace(/\/$/,"");
    }catch{return "";}
  }
  function canonicalDomain(value){
    const url=normalizeUrl(value)||normalizeUrl(`https://${clean(value).replace(/^www\./i,"")}`);
    if(!url)return "";
    return new URL(url).hostname.toLowerCase().replace(/^www\./,"");
  }
  function isBlockedDomain(domain){
    const d=clean(domain).toLowerCase();
    return BLOCKED_HOSTS.some(host=>d===host||d.endsWith(`.${host}`));
  }
  function hasActiveSignals(marketState={}){return (marketState.signals||[]).some(signal=>signal&&signal.active!==false);}
  function isTenderSignal(signal={}){return /tender|procurement|iepirk/i.test([clean(signal.name),clean(signal.keywords)].join(" "));}
  function allowTenderDiscovery(marketState={}){return splitList(marketState.researchSourceTypes).some(type=>type.toLowerCase()==="tenders");}
  function isTenderSource(item={}){
    const domain=clean(item.domain)||canonicalDomain(item.url);
    const url=clean(item.url).toLowerCase();
    const text=[clean(item.title),clean(item.description),clean(item.text)].join(" ").toLowerCase();
    return TENDER_HOSTS.includes(domain)
      || (/\.gov\.[a-z]{2}$/.test(domain)&&/tender|procurement|iepirk|supplier|contract/.test(text))
      || /tender|procurement|iepirk|viewprocurem/.test(url)
      || /public procurement|procurement notice|iepirkuma/.test(text);
  }
  function isExcludedDiscoverySource(item={},profile={},marketState={}){
    const domain=clean(item.domain)||canonicalDomain(item.url);
    const own=canonicalDomain(profile.website||profile.companyWebsite||"");
    if(own&&(domain===own||domain.endsWith("."+own)))return true;
    const tendersAllowed=allowTenderDiscovery(marketState);
    if(!tendersAllowed&&isTenderSource(item))return true;
    if(/tender|procurement|iepirk/i.test(clean(profile.exclusions))&&isTenderSource(item))return true;
    return false;
  }
  function cleanEvidenceText(value){
    return clean(value)
      .replace(/!\[[^\]]*\]\([^)]*\)/g," ")
      .replace(/\[[^\]]+\]\((?:https?:\/\/)[^)]+\)/g," ")
      .replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?/gi," ")
      .replace(/[#*_`>|]/g," ")
      .replace(/\s+/g," ")
      .trim();
  }
  function displayFromDomain(domain){
    const base=clean(domain).split(".")[0].replace(/[-_]+/g," ");
    return base.replace(/\b\w/g,c=>c.toUpperCase())||"Company";
  }
  function companyFromTitle(title,domain){
    const first=clean(title).split(/\s+[|–—:]\s+|\s+-\s+/)[0];
    if(first&&first.length<=90&&!GENERIC_COMPANY_TITLES.test(first))return first;
    return displayFromDomain(domain);
  }
  function keywords(value){
    return [...new Set(clean(value).toLowerCase().replace(/[^a-z0-9āčēģīķļņšūžäöåüß\s-]/g," ").split(/\s+/).filter(word=>word.length>=4&&!STOPWORDS.has(word)))];
  }
  function evidenceText(item){return `${clean(item.title)} ${clean(item.description)} ${clean(item.text)}`.toLowerCase();}
  function marketScore(marketState,market){
    const opp=(marketState?.opportunities||[]).find(item=>item.active!==false&&clean(item.market).toLowerCase()===clean(market).toLowerCase());
    return clamp(opp?.score?.total,0,100,50);
  }
  function marketRule(value){
    const normalized=clean(value).toLowerCase();
    return MARKET_RULES.find(rule=>rule.aliases.some(alias=>normalized===alias||normalized.includes(alias)))||null;
  }
  function domainCountryRule(domain){
    const normalized=clean(domain).toLowerCase();
    return MARKET_RULES.find(rule=>rule.suffixes.some(suffix=>normalized.endsWith(suffix)))||null;
  }
  function marketSiteFilter(market){
    const rule=marketRule(market);
    return rule?`site:${rule.suffixes[0]}`:"";
  }
  function marketSearchNames(market){const rule=marketRule(market);return rule?rule.searchNames.join(" "):clean(market);}
  function evidenceTokens(value){return clean(value).normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];}
  function evidenceContainsTerm(haystack,term){
    const words=evidenceTokens(haystack);const wanted=evidenceTokens(term);
    if(!words.length||!wanted.length||wanted.length>words.length)return false;
    for(let start=0;start<=words.length-wanted.length;start++){
      if(wanted.every((word,index)=>words[start+index]===word))return true;
    }
    return false;
  }
  function isLowQualityDiscoveryEvidence(item={}){
    const sourceDomain=canonicalDomain(item.sourceDomain||item.url);
    return LOW_QUALITY_DISCOVERY_HOSTS.some(host=>sourceDomain===host||sourceDomain.endsWith(`.${host}`))
      ||LOW_QUALITY_DISCOVERY_TITLE.test(clean(item.title));
  }
  function trustedEvidence(candidate={}){return (candidate.evidence||[]).filter(item=>!isLowQualityDiscoveryEvidence(item));}
  function signalEvidenceTerms(signal={},market=""){
    const source=[clean(signal.name),clean(signal.keywords)].join(" ");
    const rule=marketRule(market);
    const concepts=SIGNAL_CONCEPTS.filter(concept=>concept.match.test(source));
    if(/(?:product|service).*(?:launch|release|introduc|roll.?out)|(?:launch|release|introduc|roll.?out).*(?:product|service)/i.test(source)){
      concepts.push({base:["product launch","service launch","new product launch","new service launch","launch of a new product","launch of a new service","launching a new product","launching a new service"]});
    }
    return [...new Set([
      ...concepts.flatMap(concept=>concept.base),
      ...concepts.flatMap(concept=>concept.local?.[rule?.code]||[]),
      ...splitList(signal.keywords),
      ...splitList(signal.name)
    ].map(term=>clean(term).toLowerCase()).filter(term=>{
      const words=evidenceTokens(term);
      return words.length>1||!GENERIC_SIGNAL_TERMS.has(words[0]);
    }))];
  }
  function cleanCompanyName(value){
    return clean(value).replace(/^["'“”‘’]+|["'“”‘’.,;:!?]+$/g,"").replace(/\s+(?:has|have)$/i,"").trim();
  }
  function validCompanyName(value){
    const name=cleanCompanyName(value);
    if(name.length<2||name.length>90||name.split(/\s+/).length>6)return false;
    if(/^(?:sweden|sverige|company|companies|industry|business|the company|the group|unique|new|official)$/i.test(name))return false;
    return /[a-zåäöāčēģīķļņšūž]/i.test(name);
  }
  function normalizedIdentity(value){return clean(value).toLowerCase().replace(/[^a-z0-9åäöāčēģīķļņšūž]+/g,"");}
  function domainMatchesCompany(domain,company){
    const host=canonicalDomain(domain);const root=host.split(".")[0];const compact=normalizedIdentity(company);
    const tokens=keywords(company).filter(token=>token.length>=4);
    return Boolean(compact&&(root.includes(compact)||compact.includes(root)))||tokens.some(token=>root.includes(normalizedIdentity(token)));
  }
  function extractCompanyMentions(results=[],maxCompanies=10){
    const limit=Math.max(1,Math.min(MAX_DISCOVERY_COMPANY_CHECKS,Number(maxCompanies)||10));
    const seen=new Set();const mentions=[];
    const action="(?:intends?|plans?|announc(?:es|ed|ing)?|invest(?:s|ed|ing)?|is investing|will build|builds?|expands?|opens?|launch(?:es|ed|ing)?|establishes?|hires?|unveil(?:s|ed|ing)?|introduc(?:es|ed|ing)|receiv(?:es|ed)|secures?|wins?|won|inaugurat(?:es|ed)|complet(?:es|ed)|planerar|investerar|bygger|utökar|öppnar|lanserar|etablerar|anställer|avslöjar|plāno|investē|būvē|paplašina|atver|izveido)";
    const pattern=new RegExp(`(?:^|[.!?]\\s+|\\n)([A-ZÅÄÖĀČĒĢĪĶĻŅŠŪŽ][A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9&.'’-]*(?:\\s+[A-ZÅÄÖĀČĒĢĪĶĻŅŠŪŽ][A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9&.'’-]*){0,5})\\s+${action}\\b`,"g");
    for(const item of results||[]){
      const sourceUrl=normalizeUrl(item?.url);if(!sourceUrl)continue;
      const market=clean(item?.market);const text=[clean(item?.description),clean(item?.title),clean(item?.text).slice(0,5000)].join("\n");
      for(const match of text.matchAll(pattern)){
        const company=cleanCompanyName(match[1]);const key=company.toLowerCase();
        if(!validCompanyName(company)||seen.has(key))continue;
        seen.add(key);mentions.push({company,market,sourceUrl});
        if(mentions.length>=limit)return mentions;
      }
    }
    return mentions;
  }
  function parseCompanyExtraction(value,evidence=[],maxCompanies=10){
    const limit=Math.max(1,Math.min(MAX_DISCOVERY_COMPANY_CHECKS,Number(maxCompanies)||10));
    const sourceUrls=new Set((evidence||[]).map(item=>normalizeUrl(item?.url)).filter(Boolean));
    let parsed=value;
    if(typeof value==="string"){
      const raw=value.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"").trim();
      try{parsed=JSON.parse(raw);}catch{return [];}
    }
    const rows=Array.isArray(parsed)?parsed:Array.isArray(parsed?.companies)?parsed.companies:[];
    const seen=new Set();const output=[];
    for(const row of rows){
      const company=cleanCompanyName(row?.company||row?.companyName);const sourceUrl=normalizeUrl(row?.sourceUrl||row?.source_url);const key=company.toLowerCase();
      const source=(evidence||[]).find(item=>normalizeUrl(item?.url)===sourceUrl);const sourceIdentity=normalizedIdentity([source?.title,source?.description,source?.text].join(" "));
      if(!validCompanyName(company)||!sourceUrls.has(sourceUrl)||!sourceIdentity.includes(normalizedIdentity(company))||seen.has(key))continue;
      seen.add(key);output.push({company,market:clean(row?.market)||clean((evidence||[]).find(item=>normalizeUrl(item?.url)===sourceUrl)?.market),sourceUrl});
      if(output.length>=limit)break;
    }
    return output;
  }
  function describeCompanyExtractionOutcome({provider="",fallback={},aiNames=0,textNames=0,responseOk=true,errorStatus=0,errorMessage=""}={}){
    const providerName={openai:"OpenAI",gemini:"Gemini",anthropic:"Anthropic"}[String(provider||"").toLowerCase()]||"Workspace AI";
    const aiCount=Math.max(0,Number(aiNames)||0);const textCount=Math.max(0,Number(textNames)||0);
    if(!responseOk){
      let issue=`${providerName} extraction failed`;
      if(fallback?.status==="failed")issue="OpenAI failed; Gemini fallback also failed";
      else if(fallback?.status==="not_configured")issue="OpenAI failed; Gemini fallback is not configured";
      else if(fallback?.status==="lookup_failed")issue="OpenAI failed; Gemini configuration could not be checked";
      else if(providerName==="OpenAI"&&(Number(errorStatus)===429||/quota|credit.?balance|billing/i.test(String(errorMessage||""))))issue="OpenAI quota or rate limit blocked extraction";
      return {status:"fallback",method:"Text fallback",message:`${issue}; built-in text matching recovered ${textCount} company name${textCount===1?"":"s"}.`};
    }
    const source=fallback?.used===true&&fallback?.provider==="gemini"
      ?`Gemini fallback after OpenAI ${({quota_or_rate_limit:"quota or rate limit",provider_outage:"provider outage",timeout:"timeout"}[fallback.reason]||"failure")}`
      :`${providerName} primary · no fallback`;
    if(aiCount)return {status:"ai",method:"AI",message:`${source} verified ${aiCount} company name${aiCount===1?"":"s"}${textCount?`; text matching added ${textCount} more`:""}.`};
    if(textCount)return {status:"ai",method:"AI",message:`${source} returned no source-verified names; text matching recovered ${textCount} company name${textCount===1?"":"s"}.`};
    return {status:"ai",method:"AI",message:`${source} found no source-verified company names; text matching found none.`};
  }
  function buildCompanyResolutionQueries(mentions=[],profile={},maxCompanies=10){
    const limit=Math.max(1,Math.min(MAX_DISCOVERY_COMPANY_CHECKS,Number(maxCompanies)||10));const own=canonicalDomain(profile.website||profile.companyWebsite||"");
    const seen=new Set();const queries=[];
    for(const mention of mentions||[]){
      const company=cleanCompanyName(mention?.company);const key=company.toLowerCase();if(!validCompanyName(company)||seen.has(key))continue;
      if(own&&key===displayFromDomain(own).toLowerCase())continue;
      seen.add(key);const market=clean(mention?.market);
      queries.push({id:`resolve-${slug(company)}`,kind:"resolution",company,market,sourceUrl:normalizeUrl(mention?.sourceUrl),offer:"",query:`"${company.replace(/"/g,"")}" ${marketSearchNames(market)} official company website`});
      if(queries.length>=limit)break;
    }
    return queries;
  }
  function evidenceSupportsTargetMarket(candidate={}){
    const requested=marketRule(candidate.market);
    if(!requested)return !clean(candidate.market)||clean(candidate.market).toLowerCase()==="priority market"||evidenceText({
      title:candidate.evidence?.map(item=>item.title).join(" "),
      description:candidate.evidence?.map(item=>item.description).join(" "),
      text:candidate.evidence?.map(item=>item.text).join(" ")
    }).includes(clean(candidate.market).toLowerCase());
    const actual=domainCountryRule(candidate.domain);
    if(actual&&actual.code!==requested.code)return false;
    if(actual&&actual.code===requested.code)return true;
    const evidenceCountries=(candidate.evidence||[]).map(item=>domainCountryRule(item.sourceDomain||canonicalDomain(item.url))).filter(Boolean);
    if(evidenceCountries.some(rule=>rule.code===requested.code))return true;
    const hay=(candidate.evidence||[]).map(evidenceText).join(" ");
    return requested.aliases.some(alias=>evidenceContainsTerm(hay,alias));
  }
  function isSameServiceSeller(candidate={},profile={}){
    const offerTerms=keywords(profile.priorityOffers).slice(0,20);
    if(!offerTerms.length)return false;
    const needed=Math.min(2,offerTerms.length);
    const statements=trustedEvidence(candidate).flatMap(item=>[item.title,item.description,item.text]
      .flatMap(value=>clean(value).split(/[.!?;\n]+/)).map(clean).filter(Boolean));
    return statements.some(statement=>{
      const overlap=offerTerms.filter(term=>evidenceContainsTerm(statement,term));
      if(overlap.length<needed)return false;
      if(SELLER_LANGUAGE.test(statement))return true;
      const words=evidenceTokens(statement);
      return overlap.some(term=>{
        const wanted=evidenceTokens(term);
        if(!wanted.length)return false;
        for(let start=0;start<=words.length-wanted.length;start++){
          if(!wanted.every((word,index)=>words[start+index]===word))continue;
          const end=start+wanted.length;
          if(words.slice(end,end+3).some(word=>SAME_OFFER_SELLER_ROLES.has(word)))return true;
          for(let roleIndex=Math.max(0,start-5);roleIndex<start;roleIndex++){
            if(SAME_OFFER_SELLER_ROLES.has(words[roleIndex])&&words[roleIndex+1]==="of")return true;
          }
        }
        return false;
      });
    });
  }

  function buildCandidateNarrative(candidate={},language='en'){
    const company=clean(candidate.company)||clean(candidate.domain)||'Company';
    const total=clamp(candidate?.score?.total,0,100,0);
    const sources=Array.isArray(candidate.evidence)?candidate.evidence.length:0;
    const signal=clean(candidate?.matchedSignals?.[0]?.name);
    if(String(language).toLowerCase()==='lv')return `${company} novērtējums ir ${total}/100, balstoties uz ${sources} publiski pieejam${sources===1?'u avotu':'iem avotiem'}${signal?` un konstatēto signālu “${signal}”`:''}. Vērtējums norāda uz izpētes prioritāti, nevis apstiprinātu pirkšanas nodomu.`;
    return `${company} is ranked ${total}/100 using ${sources} public evidence source${sources===1?'':'s'}${signal?` and the matched signal “${signal}”`:''}. The score indicates research priority, not confirmed buying intent.`;
  }

  function discoveryLimits(targetCount=DEFAULT_DISCOVERY_TARGET){
    const raw=Number(targetCount);
    const target=Number.isFinite(raw)&&raw>0?Math.max(1,Math.min(MAX_DISCOVERY_TARGET,Math.round(raw))):DEFAULT_DISCOVERY_TARGET;
    const queryCount=target<=10?6:target<=25?8:10;
    return {targetCount:target,queryCount,resultsPerQuery:8};
  }

  function buildDiscoveryQueries(profile={},marketState={},maxQueries=4,previousQueries=[]){
    const hasCompanyContext=Boolean(clean(profile.website)||clean(profile.companyName)||clean(profile.priorityOffers)||clean(profile.idealCustomer));
    if(!hasCompanyContext)return [];
    const limit=Math.max(1,Math.min(10,Number(maxQueries)||4));
    const activeOpps=(marketState.opportunities||[]).filter(item=>item.active!==false);
    const markets=activeOpps.length?activeOpps.map(item=>clean(item.market)).filter(Boolean):splitList(profile.targetMarkets).length?splitList(profile.targetMarkets):splitList(profile.currentMarkets);
    const activeIcps=(marketState.icps||[]).filter(item=>item.active!==false);
    const icpText=keywords(activeIcps.map(item=>clean(item.description)).filter(Boolean).join(" ")||profile.idealCustomer).filter(term=>!FIT_GENERIC_TERMS.has(term)).slice(0,3).join(" ");
    const painTerm=keywords(profile.customerPainPoints).filter(term=>term.length>=6&&!FIT_GENERIC_TERMS.has(term)).slice(0,2).join(" ");
    const offer=splitList(profile.priorityOffers)[0]||"commercial solution";
    const tendersAllowed=allowTenderDiscovery(marketState);
    const topSignals=(marketState.signals||[]).filter(item=>item.active!==false&&(tendersAllowed||!isTenderSignal(item))).sort((a,b)=>(Number(b.weight)||0)-(Number(a.weight)||0)).slice(0,3);
    const results=[];
    const attempted=new Set((Array.isArray(previousQueries)?previousQueries:[]).map(item=>clean(item?.query||item).toLowerCase()).filter(Boolean));
    const uniqueMarkets=[...new Set(markets.length?markets:["priority market"])];
    const queryVariants=[
      "company newsroom investment expansion production facility",
      "manufacturing company new factory capacity investment",
      "industrial company recruitment engineering expansion",
      "manufacturer modernization automation project news",
      "new production plant company announcement",
      "company investment equipment upgrade expansion",
      "industry news factory expansion manufacturers",
      "companies hiring production engineers new facility",
      "business journal industrial investment announcement",
      "company press release capacity increase",
      "industrial plant investment new production line",
      "manufacturing group hiring technicians new facility",
      "regional business news manufacturer expansion",
      "company annual report manufacturing investment",
      "industry association members expansion investment",
      "supplier customer announces new plant",
      "factory operator equipment upgrade project",
      "engineering employer hiring production expansion"
    ];
    for(const [variantIndex,variant] of queryVariants.entries()){
      for(const market of uniqueMarkets){
        if(results.length>=limit)break;
        const signalTerms=signalEvidenceTerms(topSignals[variantIndex%Math.max(topSignals.length,1)]||{},market).slice(0,2).join(" ");
        const query=[marketSearchNames(market),icpText,variantIndex===0?painTerm:"",signalTerms,variant,variantIndex%3===0?marketSiteFilter(market):""].filter(Boolean).join(" ");
        if(attempted.has(query.toLowerCase())||results.some(item=>item.query===query))continue;
        results.push({id:`discover-${slug(market)}-${results.length+1}`,market,query,offer});
      }
      if(results.length>=limit)break;
    }
    return results.length?results.slice(0,limit):previousQueries.length?buildDiscoveryQueries(profile,marketState,maxQueries,[]):[];
  }

  function buildDiscoveryFollowUpQueries(profile={},marketState={},attemptedQueries=[],maxQueries=MAX_DISCOVERY_FOLLOW_UP_QUERIES){
    const hasCompanyContext=Boolean(clean(profile.website)||clean(profile.companyName)||clean(profile.priorityOffers)||clean(profile.idealCustomer));
    if(!hasCompanyContext)return [];
    const limit=Math.max(0,Math.min(MAX_DISCOVERY_FOLLOW_UP_QUERIES,Number(maxQueries)||0));
    if(!limit)return [];
    const activeOpps=(marketState.opportunities||[]).filter(item=>item.active!==false);
    const markets=activeOpps.map(item=>clean(item.market)).filter(Boolean);
    const uniqueMarkets=[...new Set(markets.length?markets:splitList(profile.targetMarkets).length?splitList(profile.targetMarkets):splitList(profile.currentMarkets))];
    const activeIcps=(marketState.icps||[]).filter(item=>item.active!==false);
    const icpText=keywords(activeIcps.map(item=>clean(item.description)).filter(Boolean).join(" ")||profile.idealCustomer).filter(term=>!FIT_GENERIC_TERMS.has(term)).slice(0,3).join(" ");
    const signals=(marketState.signals||[]).filter(item=>item.active!==false&&(allowTenderDiscovery(marketState)||!isTenderSignal(item))).sort((a,b)=>(Number(b.weight)||0)-(Number(a.weight)||0));
    const attempted=new Set((Array.isArray(attemptedQueries)?attemptedQueries:[]).map(item=>clean(typeof item==="string"?item:item?.query).toLowerCase()).filter(Boolean));
    const variants=[
      "company press release new plant investment",
      "industry news manufacturer facility expansion",
      "hiring production engineer company expansion",
      "factory automation modernization investment company"
    ];
    const output=[];const seen=new Set(attempted);
    for(let variantIndex=0;variantIndex<variants.length;variantIndex++){
      for(const market of uniqueMarkets.length?uniqueMarkets:["priority market"]){
        if(output.length>=limit)break;
        const signalTerms=signalEvidenceTerms(signals[variantIndex%Math.max(signals.length,1)]||{},market).slice(0,2).join(" ");
        const query=[marketSearchNames(market),icpText,signalTerms,variants[variantIndex],variantIndex%3===1?marketSiteFilter(market):""].filter(Boolean).join(" ");
        const key=query.toLowerCase();if(seen.has(key))continue;
        seen.add(key);output.push({id:`discover-followup-${slug(market)}-${output.length+1}`,market,query,offer:""});
      }
      if(output.length>=limit)break;
    }
    return output;
  }

  function buildCandidateVerificationQueries(results=[],profile={},marketState={},maxCandidates=10){
    const limit=Math.max(1,Math.min(MAX_DISCOVERY_COMPANY_CHECKS,Number(maxCandidates)||10));
    const signals=activeSignals(marketState).filter(signal=>allowTenderDiscovery(marketState)||!isTenderSignal(signal)).sort((a,b)=>(Number(b.weight)||0)-(Number(a.weight)||0));
    const own=canonicalDomain(profile.website||profile.companyWebsite||"");
    const seen=new Set();
    const checks=[];
    for(const item of results||[]){
      const domain=clean(item?.domain)||canonicalDomain(item?.url);
      if(!domain||seen.has(domain)||isBlockedDomain(domain)||isExcludedDiscoverySource(item,profile,marketState))continue;
      seen.add(domain);
      if(own&&(domain===own||domain.endsWith(`.${own}`)))continue;
      const requested=marketRule(item.market);
      const actual=domainCountryRule(domain);
      if(requested&&actual&&requested.code!==actual.code)continue;
      const signalTerms=[...new Set(signals.flatMap(signal=>signalEvidenceTerms(signal,item.market)))].slice(0,10);
      if(!signalTerms.length)continue;
      const quotedSignals=signalTerms.map(term=>`"${term.replace(/"/g,"")}"`).join(" OR ");
      checks.push({
        id:`verify-${slug(domain)}`,domain,company:clean(item.company),sourceUrl:normalizeUrl(item.sourceUrl||""),market:clean(item.market),offer:"",kind:"verification",
        query:`site:${domain} (${quotedSignals}) company news expansion investment hiring facility contract`
      });
      if(checks.length>=limit)break;
    }
    return checks;
  }

  function rawSearchArray(payload={}){
    if(Array.isArray(payload?.data))return payload.data;
    if(Array.isArray(payload?.data?.web))return payload.data.web;
    if(Array.isArray(payload?.web))return payload.web;
    if(Array.isArray(payload?.results))return payload.results;
    return [];
  }

  function normalizeCompanySearchResults(payload={},queryMeta={}){
    return rawSearchArray(payload).slice(0,8).map(item=>{
      const url=normalizeUrl(item?.url||item?.link||"");
      if(!url)return null;
      const domain=canonicalDomain(url);
      if(!domain||isBlockedDomain(domain))return null;
      const verifiedDomain=canonicalDomain(queryMeta.domain||"");
      if(queryMeta.kind==="verification"&&verifiedDomain&&domain!==verifiedDomain&&!domain.endsWith(`.${verifiedDomain}`))return null;
      if(queryMeta.kind==="resolution"&&!domainMatchesCompany(domain,queryMeta.company))return null;
      const description=clean(item?.description||item?.snippet||"");
      const text=cleanEvidenceText(item?.markdown||item?.content||item?.text||description).slice(0,7000);
      return {
        queryId:clean(queryMeta.id),market:clean(queryMeta.market),query:clean(queryMeta.query),url,domain,
        company:["resolution","verification"].includes(queryMeta.kind)&&validCompanyName(queryMeta.company)?cleanCompanyName(queryMeta.company):companyFromTitle(item?.title,domain),title:clean(item?.title)||displayFromDomain(domain),description,text,
        sourceUrl:normalizeUrl(queryMeta.sourceUrl||""),
        date:clean(item?.publishedDate||item?.date||item?.published_at||item?.metadata?.publishedDate)
      };
    }).filter(Boolean);
  }

  function attributedCompanyEvidence(source,company){
    const name=cleanCompanyName(company);
    const segments=[source?.description,source?.text].flatMap(value=>cleanEvidenceText(value).split(/(?<=[.!?])\s+|\n+/)).map(clean).filter(Boolean);
    const selected=[];
    for(let index=0;index<segments.length;index++){
      if(!evidenceContainsTerm(segments[index],name))continue;
      selected.push(segments[index]);
      const next=segments[index+1];
      if(next&&/^(?:the (?:company|expansion|investment|project|manufacturer)|its|their|it)\b/i.test(next))selected.push(next);
    }
    if(selected.length)return selected.join(" ").slice(0,1500);
    const title=cleanEvidenceText(source?.title);
    return evidenceContainsTerm(title,name)&&!/(?:\band\b|\boch\b|&)/i.test(title)?title.slice(0,250):"";
  }

  function attachSourceEvidenceToResolvedCompanies(resolved=[],mentions=[],evidence=[]){
    const sourcesByUrl=new Map((evidence||[]).map(item=>[normalizeUrl(item?.url),item]).filter(([url])=>url));
    const linksByCompany=new Map();
    for(const mention of mentions||[]){
      const company=cleanCompanyName(mention?.company);const sourceUrl=normalizeUrl(mention?.sourceUrl);
      const source=sourcesByUrl.get(sourceUrl);if(!validCompanyName(company)||!source)continue;
      const attributed=attributedCompanyEvidence(source,company);
      if(!attributed)continue;
      const key=normalizedIdentity(company);const links=linksByCompany.get(key)||[];
      if(!links.some(item=>item.sourceUrl===sourceUrl))links.push({sourceUrl,source,attributed,market:clean(mention?.market)});
      linksByCompany.set(key,links);
    }
    const output=[];const seen=new Set();
    for(const official of resolved||[]){
      const domain=clean(official?.domain)||canonicalDomain(official?.url);const company=cleanCompanyName(official?.company);
      if(!domain||!validCompanyName(company)||!domainMatchesCompany(domain,company))continue;
      const officialUrl=normalizeUrl(official?.url);const officialKey=`${domain}|${officialUrl}`;
      if(officialUrl&&!seen.has(officialKey)){seen.add(officialKey);output.push({...official,domain,company,market:clean(official?.market)});}
      for(const link of linksByCompany.get(normalizedIdentity(company))||[]){
        const key=`${domain}|${link.sourceUrl}`;if(seen.has(key))continue;seen.add(key);
        output.push({
          queryId:clean(official?.queryId),query:clean(official?.query),market:link.market||clean(official?.market),
          url:link.sourceUrl,domain,company,title:link.attributed.slice(0,250),description:"",
          text:link.attributed,date:clean(link.source?.date),sourceDomain:canonicalDomain(link.sourceUrl)
        });
      }
    }
    return output;
  }

  function activeSignals(marketState){return (marketState?.signals||[]).filter(item=>item.active!==false);}
  function matchedSignalsForEvidence(signals,evidence,market=""){
    const sources=trustedEvidence({evidence});
    return signals.map(signal=>{
      const terms=signalEvidenceTerms(signal,market);
      const salesHiring=/(?:sales|commercial|account manager|sälj|försälj)/i.test(`${clean(signal.name)} ${clean(signal.keywords)}`)
        &&/(?:hir|recruit|vacanc|team|anställ|rekryter|growth|expan)/i.test(`${clean(signal.name)} ${clean(signal.keywords)}`);
      const matched=terms.filter(term=>sources.some(source=>{
        const text=evidenceText(source);
        if(!evidenceContainsTerm(text,term))return false;
        if(!salesHiring)return true;
        return /(?:sales|commercial|account manager|sälj|försälj).{0,80}(?:hir|recruit|vacanc|expan|growth|anställ|rekryter)|(?:hir|recruit|vacanc|expan|growth|anställ|rekryter).{0,80}(?:sales|commercial|account manager|sälj|försälj)/i.test(text);
      }));
      return matched.length?{id:clean(signal.id),name:clean(signal.name),weight:clamp(signal.weight,1,10,5),matchedTerms:matched.slice(0,5)}:null;
    }).filter(Boolean);
  }
  function fitScore(candidate,profile,marketState){
    const hay=trustedEvidence(candidate).map(evidenceText).join(" ");
    const source=[profile.idealCustomer,profile.priorityOffers,profile.customerPainPoints,...(marketState.icps||[]).filter(x=>x.active!==false).map(x=>`${x.description} ${x.offers}`)].join(" ");
    const terms=[...new Set(keywords(source).filter(term=>term.length>=5&&!FIT_GENERIC_TERMS.has(term)))].slice(0,40);
    const specificMatches=terms.filter(term=>evidenceContainsTerm(hay,term));
    const industrialContext=/manufactur|producer|production|industr|ra[zž]o[sš]an|tillverk|fabrik/i.test(source);
    const industrialEvidence=["manufacturer","manufacturing","producer","production","production capacity","factory","facility","plant","tillverkare","tillverkning","produktion","produktionskapacitet","produktionskapaciteten","fabrik","anläggning","ražotājs","ražotne"].some(term=>evidenceContainsTerm(hay,term));
    const metalworkingContext=/metal|met[aā]lapstr[aā]d|steel|t[eē]rauds/i.test(source);
    const metalworkingEvidence=["metalworking","metal fabrication","metal structures","steel structures","metal processing","metal components","metāla konstrukcijas","metālapstrāde"].some(term=>evidenceContainsTerm(hay,term));
    return Math.min(30,specificMatches.length*5+(industrialContext&&industrialEvidence?5:0)+(metalworkingContext&&metalworkingEvidence?5:0));
  }
  function signalScore(matched){
    if(!matched.length)return 0;
    return Math.min(25,Math.round(matched.reduce((sum,item)=>sum+item.weight,0)*1.8));
  }
  function evidenceScore(candidate){
    const evidence=trustedEvidence(candidate);
    if(!evidence.length)return 0;
    const sources=new Set(evidence.map(item=>clean(item.sourceDomain)||canonicalDomain(item.url)).filter(Boolean));
    const chars=evidence.reduce((sum,item)=>sum+clean(item.text).length+clean(item.description).length,0);
    return Math.min(20,4+sources.size*4+(chars>=1600?2:chars>=800?1:0));
  }
  function timingScore(candidate){
    const dates=trustedEvidence(candidate).map(item=>Date.parse(item.date)).filter(Number.isFinite);
    if(!dates.length)return 4;
    const age=Math.max(0,(Date.now()-Math.max(...dates))/86400000);
    return age<=30?15:age<=90?12:age<=365?8:5;
  }
  function valueScore(candidate,profile,marketState){
    const base=Math.round(marketScore(marketState,candidate.market)/12);
    return Math.min(10,base+(clean(profile.opportunityValue)?2:0));
  }

  function mergeCompanyCandidates(results=[],profile={},marketState={},maxCandidates=12){
    const candidateLimit=Math.max(1,Math.min(50,Number(maxCandidates)||12));
    const grouped=new Map();
    for(const item of results||[]){
      const domain=clean(item?.domain)||canonicalDomain(item?.url);
      if(!domain||isBlockedDomain(domain)||!normalizeUrl(item?.url))continue;
      if(isExcludedDiscoverySource(item,profile,marketState))continue;
      const current=grouped.get(domain)||{domain,company:clean(item.company)||displayFromDomain(domain),market:clean(item.market),website:`https://${domain}/`,evidence:[]};
      if(!current.market&&item.market)current.market=clean(item.market);
      if(current.company===displayFromDomain(domain)&&clean(item.company))current.company=clean(item.company);
      if(!current.evidence.some(e=>e.url===item.url))current.evidence.push({url:item.url,sourceDomain:clean(item.sourceDomain)||canonicalDomain(item.url),title:cleanEvidenceText(item.title),description:cleanEvidenceText(item.description),text:cleanEvidenceText(item.text).slice(0,7000),date:clean(item.date)});
      grouped.set(domain,current);
    }
    const signals=activeSignals(marketState);
    return [...grouped.values()].map(candidate=>{
      candidate.evidence=candidate.evidence.slice(0,5);
      candidate.matchedSignals=matchedSignalsForEvidence(signals,candidate.evidence,candidate.market);
      if(!candidate.matchedSignals.length)return null;
      if(!evidenceSupportsTargetMarket(candidate))return null;
      if(isSameServiceSeller(candidate,profile))return null;
      const fit=fitScore(candidate,profile,marketState);
      if(fit<MINIMUM_DISCOVERY_FIT_SCORE)return null;
      const score={
        fit,
        signal:signalScore(candidate.matchedSignals),
        evidence:evidenceScore(candidate),
        timing:timingScore(candidate),
        value:valueScore(candidate,profile,marketState)
      };
      score.total=score.fit+score.signal+score.evidence+score.timing+score.value;
      const credibleSources=new Set(trustedEvidence(candidate).map(item=>clean(item.sourceDomain)||canonicalDomain(item.url)).filter(Boolean)).size;
      const confidence=score.total>=75&&fit>=15&&score.evidence>=12&&credibleSources>=2?"High":score.total>=50&&credibleSources>=2?"Medium":"Low";
      return {...candidate,id:`company-${slug(candidate.domain)}`,score,confidence,qualified:true,marketVerified:true,buyerVerified:true,people:[],peopleStatus:"idle",saved:false};
    }).filter(Boolean).sort((a,b)=>{
      const signalDelta=(b.matchedSignals?.length||0)-(a.matchedSignals?.length||0);
      return signalDelta||b.score.total-a.score.total;
    }).slice(0,candidateLimit);
  }

  function buildPotentialCompanyCandidates(results=[],profile={},marketState={},qualifiedCandidates=[],maxCandidates=12){
    const limit=Math.max(1,Math.min(20,Number(maxCandidates)||12));
    const qualifiedDomains=new Set((qualifiedCandidates||[]).map(candidate=>canonicalDomain(candidate?.domain||candidate?.website)).filter(Boolean));
    const grouped=new Map();
    for(const item of results||[]){
      const domain=clean(item?.domain)||canonicalDomain(item?.url);
      const company=cleanCompanyName(item?.company)||companyFromTitle(item?.title,domain);
      if(!domain||!normalizeUrl(item?.url)||isBlockedDomain(domain)||!validCompanyName(company)||!domainMatchesCompany(domain,company))continue;
      if(qualifiedDomains.has(domain)||isExcludedDiscoverySource(item,profile,marketState))continue;
      const candidate=grouped.get(domain)||{domain,company,market:clean(item?.market),website:`https://${domain}/`,evidence:[]};
      if(!candidate.market&&item.market)candidate.market=clean(item.market);
      if(!candidate.evidence.some(evidence=>normalizeUrl(evidence.url)===normalizeUrl(item.url))){
        candidate.evidence.push({url:item.url,sourceDomain:clean(item.sourceDomain)||canonicalDomain(item.url),title:cleanEvidenceText(item.title),description:cleanEvidenceText(item.description),text:cleanEvidenceText(item.text).slice(0,2500),date:clean(item.date)});
      }
      grouped.set(domain,candidate);
    }
    return [...grouped.values()].map(candidate=>{
      candidate.evidence=candidate.evidence.slice(0,5);
      if(isSameServiceSeller(candidate,profile))return null;
      const matchedSignals=matchedSignalsForEvidence(activeSignals(marketState),candidate.evidence,candidate.market);
      const marketVerified=evidenceSupportsTargetMarket(candidate);
      const fitVerified=fitScore(candidate,profile,marketState)>=MINIMUM_DISCOVERY_FIT_SCORE;
      if(!matchedSignals.length&&!marketVerified&&!fitVerified)return null;
      const qualificationGaps=[];
      if(!marketVerified)qualificationGaps.push("Target market evidence is missing");
      if(!matchedSignals.length)qualificationGaps.push("No active buying signal was confirmed");
      if(!fitVerified)qualificationGaps.push("Target customer fit is not evidenced");
      return {id:`potential-${slug(candidate.domain)}`,company:candidate.company,domain:candidate.domain,website:candidate.website,market:candidate.market,qualified:false,marketVerified,fitVerified,buyerVerified:false,matchedSignals,evidence:candidate.evidence,qualificationGaps};
    }).filter(Boolean).sort((a,b)=>a.qualificationGaps.length-b.qualificationGaps.length||b.evidence.length-a.evidence.length).slice(0,limit);
  }

  function buildApolloPeopleSearchPayload(candidate={},profile={}){
    const domain=canonicalDomain(candidate.domain||candidate.website);
    const titles=splitList(profile.decisionMakers).slice(0,10);
    return {
      q_organization_domains_list:domain?[domain]:[],
      person_titles:titles,
      include_similar_titles:true,
      person_seniorities:["owner","founder","c_suite","partner","vp","head","director","manager"],
      page:1,per_page:10
    };
  }

  function normalizeApolloPeople(payload={}){
    const raw=Array.isArray(payload?.people)?payload.people:Array.isArray(payload?.contacts)?payload.contacts:Array.isArray(payload?.data?.people)?payload.data.people:[];
    return raw.slice(0,10).map(person=>{
      const name=clean(person?.name)||clean(`${person?.first_name||""} ${person?.last_name||""}`);
      return {
        id:clean(person?.id)||`person-${slug(name)}-${Math.random().toString(36).slice(2,7)}`,
        name:name||"Unknown person",title:clean(person?.title)||"Role not provided",seniority:clean(person?.seniority),
        organization:clean(person?.organization?.name||person?.organization_name),city:clean(person?.city),country:clean(person?.country),
        linkedin_url:normalizeLinkedInUrl(person?.linkedin_url||person?.linkedin_profile_url||person?.linkedin)
      };
    }).filter(item=>item.name!=="Unknown person"||item.title!=="Role not provided");
  }

  function roleAliasMatch(title,role){
    const t=clean(title).toLowerCase();const r=clean(role).toLowerCase().replace(/[^a-z]/g,"");
    const aliases={coo:["coo","chief operating officer"],ceo:["ceo","chief executive officer"],cfo:["cfo","chief financial officer"],cto:["cto","chief technology officer"],cmo:["cmo","chief marketing officer"],cro:["cro","chief revenue officer"]};
    return Boolean(aliases[r]?.some(alias=>t===alias||t.includes(alias)));
  }
  function roleSpecificTokens(value){
    return clean(value).toLowerCase().replace(/[^a-z0-9āčēģīķļņšūžäöåüß\s-]/g," ").split(/\s+/).filter(token=>token.length>=3&&!ROLE_GENERIC_WORDS.has(token));
  }
  function roleRelevance(person,roles){
    const title=clean(person?.title).toLowerCase();if(!title)return null;
    let best=null;
    roles.forEach((role,index)=>{
      const normalizedRole=clean(role).toLowerCase();const exact=title===normalizedRole||title.includes(normalizedRole)||roleAliasMatch(title,role);
      const wanted=new Set(roleSpecificTokens(role));const actual=new Set(roleSpecificTokens(title));
      const overlap=[...wanted].filter(token=>actual.has(token)).length;
      if(!exact&&!overlap)return;
      const base=exact?100-index*10:80-index*10;
      const score=base+Math.min(10,overlap*4)+(SENIORITY_SCORE[clean(person?.seniority).toLowerCase()]||0);
      if(!best||score>best.score)best={score,role,index,exact};
    });
    return best;
  }
  function selectDecisionMakers(people=[],profile={},limit=4){
    const roles=splitList(profile.decisionMakers).slice(0,10);if(!roles.length)return [];
    const cap=Math.max(1,Math.min(4,Number(limit)||4));
    return (Array.isArray(people)?people:[]).map((person,index)=>({person,relevance:roleRelevance(person,roles),index})).filter(item=>item.relevance).sort((a,b)=>b.relevance.score-a.relevance.score||a.index-b.index).slice(0,cap).map(item=>item.person);
  }

  function safeCandidate(candidate={}){
    const domain=canonicalDomain(candidate.domain||candidate.website);
    const website=normalizeUrl(candidate.website)|| (domain?`https://${domain}/`:"");
    const people=(Array.isArray(candidate.people)?candidate.people:[]).slice(0,4).map(p=>({id:clean(p?.id),name:clean(p?.name),title:clean(p?.title),seniority:clean(p?.seniority),organization:clean(p?.organization),city:clean(p?.city),country:clean(p?.country),linkedin_url:normalizeLinkedInUrl(p?.linkedin_url||p?.linkedin)}));
    return {
      id:clean(candidate.id)||`company-${slug(domain||candidate.company)}`,crmId:clean(candidate.crmId),company:clean(candidate.company)||displayFromDomain(domain),domain,website,
      market:clean(candidate.market),score:candidate.score&&typeof candidate.score==="object"?candidate.score:{total:0},confidence:["High","Medium","Low"].includes(candidate.confidence)?candidate.confidence:"Low",
      matchedSignals:(Array.isArray(candidate.matchedSignals)?candidate.matchedSignals:[]).slice(0,12),evidence:(Array.isArray(candidate.evidence)?candidate.evidence:[]).slice(0,5),
      qualified:candidate.qualified===true,marketVerified:candidate.marketVerified===true,buyerVerified:candidate.buyerVerified===true,
      people,peopleStatus:["idle","loading","complete","empty","error"].includes(candidate.peopleStatus)?candidate.peopleStatus:"idle",saved:Boolean(candidate.saved)
    };
  }

  function safePotentialCandidate(candidate={}){
    const domain=canonicalDomain(candidate.domain||candidate.website);
    const evidence=(Array.isArray(candidate.evidence)?candidate.evidence:[]).slice(0,5).map(item=>({
      url:normalizeUrl(item?.url),sourceDomain:clean(item?.sourceDomain)||canonicalDomain(item?.url),
      title:cleanEvidenceText(item?.title).slice(0,300),description:cleanEvidenceText(item?.description).slice(0,700),
      text:cleanEvidenceText(item?.text).slice(0,2500),date:clean(item?.date)
    })).filter(item=>item.url);
    const gaps=[...new Set((Array.isArray(candidate.qualificationGaps)?candidate.qualificationGaps:[]).map(clean).filter(Boolean))].slice(0,4);
    const people=(Array.isArray(candidate.people)?candidate.people:[]).slice(0,4).map(person=>({id:clean(person?.id),name:clean(person?.name),title:clean(person?.title),seniority:clean(person?.seniority),organization:clean(person?.organization),city:clean(person?.city),country:clean(person?.country),linkedin_url:normalizeLinkedInUrl(person?.linkedin_url||person?.linkedin)}));
    return {id:clean(candidate.id)||`potential-${slug(domain||candidate.company)}`,company:clean(candidate.company)||displayFromDomain(domain),domain,website:normalizeUrl(candidate.website)||(domain?`https://${domain}/`:""),market:clean(candidate.market),qualified:false,marketVerified:candidate.marketVerified===true,fitVerified:candidate.fitVerified===true,buyerVerified:false,matchedSignals:(Array.isArray(candidate.matchedSignals)?candidate.matchedSignals:[]).slice(0,12),evidence,qualificationGaps:gaps,people,peopleStatus:["idle","loading","complete","empty","error"].includes(candidate.peopleStatus)?candidate.peopleStatus:"idle",buyerSearchMode:candidate.buyerSearchMode==="user_selected_without_signal"?candidate.buyerSearchMode:""};
  }

  function isPotentialBuyerSearchAllowed(candidate={}){
    const gaps=Array.isArray(candidate.qualificationGaps)?candidate.qualificationGaps.map(clean).filter(Boolean):[];
    return Boolean(canonicalDomain(candidate.domain||candidate.website)
      &&candidate.qualified!==true
      &&candidate.marketVerified===true
      &&candidate.fitVerified===true
      &&gaps.length===1
      &&gaps[0]==="No active buying signal was confirmed");
  }

  function safeSearchFailure(failure={}){
    const phase=["searching","following","resolving","verifying"].includes(clean(failure.phase))?clean(failure.phase):"searching";
    const query=failure.queryMeta&&typeof failure.queryMeta==="object"?failure.queryMeta:{};
    const queryMeta={
      id:clean(query.id).slice(0,100),market:clean(query.market).slice(0,100),query:clean(query.query).slice(0,1000),
      company:clean(query.company).slice(0,160),domain:canonicalDomain(query.domain),sourceUrl:normalizeUrl(query.sourceUrl),
      kind:["resolution","verification"].includes(clean(query.kind))?clean(query.kind):"",offer:clean(query.offer).slice(0,200)
    };
    const reason=["timeout","rate_limit","quota_exhausted","provider_unavailable","network_error","auth_error","request_rejected","unknown_error"].includes(clean(failure.reason))?clean(failure.reason):"unknown_error";
    const status=clamp(Math.floor(Number(failure.status)||0),0,599,0);
    return {id:clean(failure.id)||`${phase}:${queryMeta.id||queryMeta.domain||"search"}`,phase,queryMeta,company:clean(failure.company||queryMeta.company).slice(0,160),domain:canonicalDomain(failure.domain||queryMeta.domain),reason,status};
  }

  function isActionableCandidate(candidate={}){
    return candidate.qualified===true&&candidate.marketVerified===true&&candidate.buyerVerified===true
      &&Array.isArray(candidate.matchedSignals)&&candidate.matchedSignals.length>0
      &&Array.isArray(candidate.evidence)&&candidate.evidence.length>0;
  }

  function safeCompanyMention(mention={}){
    return {company:cleanCompanyName(mention.company).slice(0,160),market:clean(mention.market).slice(0,100),sourceUrl:normalizeUrl(mention.sourceUrl)};
  }

  function upsertPipelineItem(pipeline=[],candidate={}){
    const safe=safeCandidate(candidate);if(!safe.domain)return [...pipeline];
    const list=(pipeline||[]).map(item=>({...item}));
    const index=list.findIndex(item=>canonicalDomain(item.domain||item.website)===safe.domain);
    const now=new Date().toISOString();
    if(index>=0){
      const existing=list[index];
      list[index]={...existing,...safe,id:existing.id||safe.id,stage:CRM_STAGES.includes(existing.stage)?existing.stage:"Discovered",savedAt:existing.savedAt||now,updatedAt:now};
    }else{
      list.unshift({...safe,stage:"Discovered",savedAt:now,updatedAt:now});
    }
    return list.slice(0,50);
  }

  function normalizePipelineItem(item={}){
    const safe=safeCandidate(item);
    return {...safe,stage:CRM_STAGES.includes(clean(item.stage))?clean(item.stage):"Discovered",savedAt:clean(item.savedAt),updatedAt:clean(item.updatedAt)};
  }
  function normalizeRaw(item={}){
    const url=normalizeUrl(item.url);const domain=clean(item.domain)||canonicalDomain(url);
    return {queryId:clean(item.queryId),market:clean(item.market),query:clean(item.query),url,domain,company:clean(item.company),title:clean(item.title),description:clean(item.description),text:String(item.text||"").slice(0,7000),date:clean(item.date)};
  }
  function discoveryOutcomeStatus({timedOut=false,failures=0,candidateCount=0}={}){
    const count=Math.max(0,Number(candidateCount)||0);
    if(timedOut||Number(failures)>0)return count?"partial":"error";
    return count?"complete":"no_results";
  }

  function zeroResultGuidance({evidenceCount=0,evidencePages=0,companiesIdentified=null,extractionStatus="idle",activeSignalCount=0,targetCount=10,researchMode="deep",adaptiveFollowUpSearches=0}={}){
    const evidence=Math.max(0,Number(evidenceCount)||0);
    const identified=Number(companiesIdentified);
    const signals=Math.max(0,Number(activeSignalCount)||0);
    const target=Math.max(1,Number(targetCount)||10);
    if(evidence>0&&companiesIdentified!==null&&companiesIdentified!==undefined&&Number.isFinite(identified)&&identified===0){
      const extractionUnavailable=extractionStatus==="fallback";
      return {
        primaryAction:extractionUnavailable?"open_ai_settings":"review_research",
        primaryLabel:extractionUnavailable?"Review AI settings":"Review Market Research",
        summary:`${evidence} evidence results${Number(evidencePages)>0?` across ${Number(evidencePages)} unique pages`:""} were checked, but no company names were identified. This is an extraction gap, not a confirmed no-match in the market.`,
        steps:extractionUnavailable
          ?["AI extraction was unavailable and built-in text matching found no company names. Review the workspace AI provider or credits, then rerun Companies.","The search results and any previously qualified companies remain available for review."]
          :["Review the source quality in Market Research, then run Companies again. LeadIntel only promotes company names supported by the collected evidence.","Keep the current result amount; a larger target does not repair an extraction gap."]
      };
    }
    const signalStep=signals<3
      ? "Open Strategy and activate at least 3 buying signals: capacity expansion, a new facility or investment, and hiring or outsourcing. Keep tender or procurement only when it is relevant."
      : "Open Strategy and broaden narrow ICP or signal keywords so they describe observable buyer events, not only one exact phrase.";
    const amountStep=target===10
      ? "Return to Companies, keep the search at 10 companies, and run it again. Increase the amount only after qualified results appear."
      : "Return to Companies, return to 10 companies, and run it again. Increase the amount only after qualified results appear.";
    const quickMode=clean(researchMode)==="quick";
    const steps=[signalStep,"Confirm that at least one active ICP describes the intended buyers, rather than companies that merely resemble your own supplier profile."];
    if(quickMode)steps.unshift("Quick Overview uses a smaller market evidence set. Run Market Research in Strategy, then run the Companies search again.");
    if(Number(adaptiveFollowUpSearches)>0)steps.push(`LeadIntel already broadened the search with ${Number(adaptiveFollowUpSearches)} follow-up searches. Public evidence may still be too limited to verify a qualified company.`);
    steps.push(amountStep);
    return {primaryAction:quickMode?"review_research":"review_strategy",primaryLabel:quickMode?"Review Market Research":"Review Strategy",summary:`${evidence} evidence results were checked. No company passed every active market and buying-signal check. A zero-result run can be a valid finding when qualifying public evidence is unavailable.`,steps};
  }

  function normalizeDiscoveryFunnel(value={}){
    const input=value&&typeof value==="object"?value:{};
    const count=key=>clamp(Math.floor(Number(input[key])||0),0,1000000,0);
    return {marketSearchesCompleted:count("marketSearchesCompleted"),marketSearchesTotal:count("marketSearchesTotal"),evidencePages:count("evidencePages"),companiesIdentified:count("companiesIdentified"),officialDomainsResolved:count("officialDomainsResolved"),companySitesChecked:count("companySitesChecked"),verifiedCompanies:count("verifiedCompanies"),qualifiedCompanies:count("qualifiedCompanies"),adaptiveFollowUpSearches:count("adaptiveFollowUpSearches"),openAiFallbackSearches:count("openAiFallbackSearches")};
  }

  function normalizeDiscoveryState(value={}){
    const input=value&&typeof value==="object"?value:{};
    const allowedStatus=new Set(["idle","running","complete","no_results","partial","error"]);
    const hadSearchResults=Boolean(
      clean(input.lastRunAt)
      ||(Array.isArray(input.queries)&&input.queries.length)
      ||(Array.isArray(input.rawResults)&&input.rawResults.length)
      ||(Array.isArray(input.candidates)&&input.candidates.length)
      ||(Array.isArray(input.potentialMatches)&&input.potentialMatches.length)
    );
    const needsRefresh=Number(input.qualityVersion||0)<DISCOVERY_QUALITY_VERSION&&hadSearchResults;
    const preserveInterruptedEvidence=input.status==="running"&&needsRefresh&&Array.isArray(input.rawResults)&&input.rawResults.length>0;
    const clearOldResults=needsRefresh&&!preserveInterruptedEvidence;
    const safeCandidates=(needsRefresh?[]:(Array.isArray(input.candidates)?input.candidates:[])).slice(0,50).map(safeCandidate).filter(item=>item.domain&&isActionableCandidate(item));
    const extraction=input.extraction&&typeof input.extraction==="object"?input.extraction:{};
    return {
      ...DEFAULT_DISCOVERY_STATE,
      status:clearOldResults&&input.status!=="running"?"idle":allowedStatus.has(input.status)?input.status:"idle",
      queries:(clearOldResults?[]:(Array.isArray(input.queries)?input.queries:[])).slice(0,14).map(q=>({id:clean(q.id),market:clean(q.market),query:clean(q.query),offer:clean(q.offer)})).filter(q=>q.id&&q.query),
      rawResults:(clearOldResults?[]:(Array.isArray(input.rawResults)?input.rawResults:[])).slice(0,20).map(normalizeRaw).filter(item=>item.url&&item.domain),
      candidates:safeCandidates,
      companyMentions:(Array.isArray(input.companyMentions)?input.companyMentions:[]).slice(0,MAX_DISCOVERY_COMPANY_CHECKS).map(safeCompanyMention).filter(item=>item.company&&item.sourceUrl),
      searchFailures:(Array.isArray(input.searchFailures)?input.searchFailures:[]).slice(0,MAX_DISCOVERY_COMPANY_CHECKS*2).map(safeSearchFailure),
      checkedCompanyDomains:[...new Set((Array.isArray(input.checkedCompanyDomains)?input.checkedCompanyDomains:[]).map(canonicalDomain).filter(Boolean))].slice(0,MAX_DISCOVERY_COMPANY_CHECKS),
      lastSuccessfulRunAt:needsRefresh?"":clean(input.lastSuccessfulRunAt||(safeCandidates.length&&["complete","partial"].includes(input.status)?input.lastRunAt:"")),
      latestRunCandidateCount:clamp(Math.floor(Number(input.latestRunCandidateCount??(safeCandidates.length?safeCandidates.length:0))||0),0,50,0),
      retainedLastSuccessfulResults:input.retainedLastSuccessfulResults===true&&!needsRefresh,
      extraction:{
        status:["idle","pending","ai","fallback"].includes(extraction.status)?extraction.status:"idle",
        method:["AI","Text fallback"].includes(extraction.method)?extraction.method:"",
        message:clean(extraction.message).slice(0,300)
      },
      potentialMatches:(needsRefresh?[]:(Array.isArray(input.potentialMatches)?input.potentialMatches:[])).slice(0,12).map(safePotentialCandidate).filter(item=>item.domain&&item.evidence.length&&item.qualificationGaps.length),
      funnel:normalizeDiscoveryFunnel(clearOldResults?{}:input.funnel),
      pipeline:(Array.isArray(input.pipeline)?input.pipeline:[]).slice(0,50).map(normalizePipelineItem).filter(item=>item.domain),
      lastRunAt:clearOldResults?"":clean(input.lastRunAt),
      qualityVersion:DISCOVERY_QUALITY_VERSION,
      needsRefresh:needsRefresh||input.needsRefresh===true
    };
  }

  function retainLastSuccessfulDiscoveryCandidates(state={},currentCandidates=[],completedAt=""){
    const current=(Array.isArray(currentCandidates)?currentCandidates:[]).slice(0,50).map(safeCandidate).filter(item=>item.domain&&isActionableCandidate(item));
    const previous=(Array.isArray(state.candidates)?state.candidates:[]).slice(0,50).map(safeCandidate).filter(item=>item.domain&&isActionableCandidate(item));
    const retained=current.length===0&&previous.length>0;
    const byDomain=new Map(previous.map(item=>[item.domain,item]));
    for(const item of current)byDomain.set(item.domain,item);
    const candidates=[...byDomain.values()].sort((a,b)=>(Number(b.score?.total)||0)-(Number(a.score?.total)||0)).slice(0,50);
    return {
      candidates,
      lastSuccessfulRunAt:current.length?clean(completedAt):clean(state.lastSuccessfulRunAt),
      latestRunCandidateCount:current.filter(item=>!previous.some(old=>old.domain===item.domain)).length,
      retainedLastSuccessfulResults:retained
    };
  }

  function recoverInterruptedDiscoveryState(value={}){
    const state=normalizeDiscoveryState(value);
    if(state.status!=="running")return state;
    return {...state,status:state.candidates.length||state.rawResults.length?"partial":"error"};
  }

  return {CRM_STAGES,DEFAULT_DISCOVERY_STATE,DISCOVERY_QUALITY_VERSION,discoveryLimits,buildDiscoveryQueries,buildDiscoveryFollowUpQueries,extractCompanyMentions,parseCompanyExtraction,describeCompanyExtractionOutcome,buildCompanyResolutionQueries,buildCandidateVerificationQueries,buildCandidateNarrative,normalizeCompanySearchResults,attachSourceEvidenceToResolvedCompanies,mergeCompanyCandidates,buildPotentialCompanyCandidates,buildApolloPeopleSearchPayload,normalizeApolloPeople,selectDecisionMakers,upsertPipelineItem,normalizeDiscoveryState,retainLastSuccessfulDiscoveryCandidates,recoverInterruptedDiscoveryState,discoveryOutcomeStatus,zeroResultGuidance,canonicalDomain,normalizeLinkedInUrl,isBlockedDomain,isLowQualityDiscoveryEvidence,hasActiveSignals,isActionableCandidate,isPotentialBuyerSearchAllowed};
});
