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
  const DEFAULT_DISCOVERY_STATE=Object.freeze({status:"idle",queries:[],rawResults:[],candidates:[],pipeline:[],lastRunAt:""});
  const STOPWORDS=new Set(["with","from","that","this","your","their","into","over","under","company","companies","business","businesses","priority","market","markets","customer","customers","service","services","product","products","industrial"]);
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
  const SELLER_LANGUAGE=/(?:\bwe (?:offer|provide|manufacture|produce|fabricate|supply)\b|\bour (?:services|products|solutions)\b|\bmanufacturer\b|\bsupplier\b|\bfabrication services?\b|\bm[eē]s (?:pied[aā]v[aā]jam|ra[zž]ojam|izgatavojam|pieg[aā]d[aā]jam)\b|\bm[uū]su (?:pakalpojumi|produkti|produkcija)\b|\bra[zž]ot[aā]js\b|\bpieg[aā]d[aā]t[aā]js\b|\bizgatavo[sš]ana\b|\bmont[aā][zž]a\b)/i;
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
  function signalEvidenceTerms(signal={},market=""){
    const source=[clean(signal.name),clean(signal.keywords)].join(" ");
    const rule=marketRule(market);
    const concepts=SIGNAL_CONCEPTS.filter(concept=>concept.match.test(source));
    return [...new Set([
      ...concepts.flatMap(concept=>concept.base),
      ...concepts.flatMap(concept=>concept.local?.[rule?.code]||[]),
      ...splitList(signal.keywords||signal.name)
    ].map(term=>clean(term).toLowerCase()).filter(Boolean))];
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
    const limit=Math.max(1,Math.min(20,Number(maxCompanies)||10));
    const seen=new Set();const mentions=[];
    const action="(?:intends?|plans?|announc(?:es|ed)|invests?|is investing|will build|builds?|expands?|opens?|launches?|establishes?|hires?|planerar|investerar|bygger|utökar|öppnar|lanserar|etablerar|anställer|plāno|investē|būvē|paplašina|atver|izveido)";
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
    const limit=Math.max(1,Math.min(20,Number(maxCompanies)||10));
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
  function buildCompanyResolutionQueries(mentions=[],profile={},maxCompanies=10){
    const limit=Math.max(1,Math.min(20,Number(maxCompanies)||10));const own=canonicalDomain(profile.website||profile.companyWebsite||"");
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
    const hay=(candidate.evidence||[]).map(evidenceText).join(" ");
    return requested.aliases.some(alias=>hay.includes(alias));
  }
  function isSameServiceSeller(candidate={},profile={}){
    const offerTerms=keywords(profile.priorityOffers).slice(0,20);
    if(!offerTerms.length)return false;
    const hay=(candidate.evidence||[]).map(evidenceText).join(" ");
    const overlap=offerTerms.filter(term=>hay.includes(term)).length;
    const needed=Math.min(2,offerTerms.length);
    return overlap>=needed&&SELLER_LANGUAGE.test(hay);
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
    const queryCount=target<=10?4:target<=25?8:10;
    return {targetCount:target,queryCount,resultsPerQuery:5};
  }

  function buildDiscoveryQueries(profile={},marketState={},maxQueries=4){
    const hasCompanyContext=Boolean(clean(profile.website)||clean(profile.companyName)||clean(profile.priorityOffers)||clean(profile.idealCustomer));
    if(!hasCompanyContext)return [];
    const limit=Math.max(1,Math.min(10,Number(maxQueries)||4));
    const activeOpps=(marketState.opportunities||[]).filter(item=>item.active!==false);
    const markets=activeOpps.length?activeOpps.map(item=>clean(item.market)).filter(Boolean):splitList(profile.targetMarkets).length?splitList(profile.targetMarkets):splitList(profile.currentMarkets);
    const activeIcps=(marketState.icps||[]).filter(item=>item.active!==false);
    const icpText=activeIcps.map(item=>clean(item.description)).filter(Boolean).join(" ")||clean(profile.idealCustomer);
    const painTerms=keywords(profile.customerPainPoints).slice(0,6).join(" ");
    const offer=splitList(profile.priorityOffers)[0]||"commercial solution";
    const tendersAllowed=allowTenderDiscovery(marketState);
    const topSignals=(marketState.signals||[]).filter(item=>item.active!==false&&(tendersAllowed||!isTenderSignal(item))).sort((a,b)=>(Number(b.weight)||0)-(Number(a.weight)||0)).slice(0,3);
    const results=[];
    const uniqueMarkets=[...new Set(markets.length?markets:["priority market"])];
    const queryVariants=[
      "buyer organization customer official website",
      "commercial buyers official website",
      "companies expanding facilities official website",
      "new office warehouse production site official website",
      "hiring expansion investment official website",
      "organizations seeking office furniture official website",
      "business growth expansion official website",
      "local companies official website",
      "facility modernization official website",
      "corporate buyers official website"
    ];
    for(const variant of queryVariants){
      for(const market of uniqueMarkets){
        if(results.length>=limit)break;
        const signalTerms=[...new Set(topSignals.flatMap(item=>signalEvidenceTerms(item,market)))].slice(0,8).join(" ");
        const query=[marketSearchNames(market),icpText,painTerms,signalTerms,clean(profile.buyingTriggers),variant,marketSiteFilter(market)].filter(Boolean).join(" ");
        if(results.some(item=>item.query===query))continue;
        results.push({id:`discover-${slug(market)}-${results.length+1}`,market,query,offer});
      }
      if(results.length>=limit)break;
    }
    return results.slice(0,limit);
  }

  function buildCandidateVerificationQueries(results=[],profile={},marketState={},maxCandidates=10){
    const limit=Math.max(1,Math.min(20,Number(maxCandidates)||10));
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
        id:`verify-${slug(domain)}`,domain,market:clean(item.market),offer:"",kind:"verification",
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
    return rawSearchArray(payload).slice(0,5).map(item=>{
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
        company:queryMeta.kind==="resolution"&&validCompanyName(queryMeta.company)?cleanCompanyName(queryMeta.company):companyFromTitle(item?.title,domain),title:clean(item?.title)||displayFromDomain(domain),description,text,
        date:clean(item?.publishedDate||item?.date||item?.published_at||item?.metadata?.publishedDate)
      };
    }).filter(Boolean);
  }

  function activeSignals(marketState){return (marketState?.signals||[]).filter(item=>item.active!==false);}
  function matchedSignalsForEvidence(signals,evidence,market=""){
    const hay=evidence.map(evidenceText).join(" ");
    return signals.map(signal=>{
      const terms=signalEvidenceTerms(signal,market);
      const matched=terms.filter(term=>hay.includes(term));
      return matched.length?{id:clean(signal.id),name:clean(signal.name),weight:clamp(signal.weight,1,10,5),matchedTerms:matched.slice(0,5)}:null;
    }).filter(Boolean);
  }
  function fitScore(candidate,profile,marketState){
    const hay=candidate.evidence.map(evidenceText).join(" ");
    const source=[profile.idealCustomer,profile.priorityOffers,profile.customerPainPoints,...(marketState.icps||[]).filter(x=>x.active!==false).map(x=>`${x.description} ${x.offers}`)].join(" ");
    const terms=keywords(source).slice(0,30);
    const matches=terms.filter(term=>hay.includes(term)).length;
    const marketMatch=clean(candidate.market)&&hay.includes(clean(candidate.market).toLowerCase());
    return Math.min(30,8+Math.min(17,matches*3)+(marketMatch?5:0));
  }
  function signalScore(matched){
    if(!matched.length)return 0;
    return Math.min(25,Math.round(matched.reduce((sum,item)=>sum+item.weight,0)*1.8));
  }
  function evidenceScore(candidate){
    const count=candidate.evidence.length;
    const chars=candidate.evidence.reduce((sum,item)=>sum+clean(item.text).length+clean(item.description).length,0);
    return Math.min(20,6+count*5+(chars>=1200?4:chars>=400?2:0));
  }
  function timingScore(candidate){
    const dates=candidate.evidence.map(item=>Date.parse(item.date)).filter(Number.isFinite);
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
      if(!current.evidence.some(e=>e.url===item.url))current.evidence.push({url:item.url,title:cleanEvidenceText(item.title),description:cleanEvidenceText(item.description),text:cleanEvidenceText(item.text).slice(0,7000),date:clean(item.date)});
      grouped.set(domain,current);
    }
    const signals=activeSignals(marketState);
    return [...grouped.values()].map(candidate=>{
      candidate.evidence=candidate.evidence.slice(0,5);
      candidate.matchedSignals=matchedSignalsForEvidence(signals,candidate.evidence,candidate.market);
      if(!candidate.matchedSignals.length)return null;
      if(!evidenceSupportsTargetMarket(candidate))return null;
      if(isSameServiceSeller(candidate,profile))return null;
      const score={
        fit:fitScore(candidate,profile,marketState),
        signal:signalScore(candidate.matchedSignals),
        evidence:evidenceScore(candidate),
        timing:timingScore(candidate),
        value:valueScore(candidate,profile,marketState)
      };
      score.total=score.fit+score.signal+score.evidence+score.timing+score.value;
      const confidence=score.total>=75&&candidate.matchedSignals.length&&candidate.evidence.length>=1?"High":score.total>=50?"Medium":"Low";
      return {...candidate,id:`company-${slug(candidate.domain)}`,score,confidence,qualified:true,marketVerified:true,buyerVerified:true,people:[],peopleStatus:"idle",saved:false};
    }).filter(Boolean).sort((a,b)=>{
      const signalDelta=(b.matchedSignals?.length||0)-(a.matchedSignals?.length||0);
      return signalDelta||b.score.total-a.score.total;
    }).slice(0,candidateLimit);
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
      id:clean(candidate.id)||`company-${slug(domain||candidate.company)}`,company:clean(candidate.company)||displayFromDomain(domain),domain,website,
      market:clean(candidate.market),score:candidate.score&&typeof candidate.score==="object"?candidate.score:{total:0},confidence:["High","Medium","Low"].includes(candidate.confidence)?candidate.confidence:"Low",
      matchedSignals:(Array.isArray(candidate.matchedSignals)?candidate.matchedSignals:[]).slice(0,12),evidence:(Array.isArray(candidate.evidence)?candidate.evidence:[]).slice(0,5),
      qualified:candidate.qualified===true,marketVerified:candidate.marketVerified===true,buyerVerified:candidate.buyerVerified===true,
      people,peopleStatus:["idle","loading","complete","empty","error"].includes(candidate.peopleStatus)?candidate.peopleStatus:"idle",saved:Boolean(candidate.saved)
    };
  }

  function isActionableCandidate(candidate={}){
    return candidate.qualified===true&&candidate.marketVerified===true&&candidate.buyerVerified===true
      &&Array.isArray(candidate.matchedSignals)&&candidate.matchedSignals.length>0
      &&Array.isArray(candidate.evidence)&&candidate.evidence.length>0;
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
  function normalizeDiscoveryState(value={}){
    const input=value&&typeof value==="object"?value:{};
    const allowedStatus=new Set(["idle","running","complete","partial","error"]);
    return {
      ...DEFAULT_DISCOVERY_STATE,
      status:allowedStatus.has(input.status)?input.status:"idle",
      queries:(Array.isArray(input.queries)?input.queries:[]).slice(0,10).map(q=>({id:clean(q.id),market:clean(q.market),query:clean(q.query),offer:clean(q.offer)})).filter(q=>q.id&&q.query),
      rawResults:(Array.isArray(input.rawResults)?input.rawResults:[]).slice(0,20).map(normalizeRaw).filter(item=>item.url&&item.domain),
      candidates:(Array.isArray(input.candidates)?input.candidates:[]).slice(0,12).map(safeCandidate).filter(item=>item.domain&&isActionableCandidate(item)),
      pipeline:(Array.isArray(input.pipeline)?input.pipeline:[]).slice(0,50).map(normalizePipelineItem).filter(item=>item.domain),
      lastRunAt:clean(input.lastRunAt)
    };
  }

  function recoverInterruptedDiscoveryState(value={}){
    const state=normalizeDiscoveryState(value);
    if(state.status!=="running")return state;
    return {...state,status:state.candidates.length||state.rawResults.length?"partial":"error"};
  }

  return {CRM_STAGES,DEFAULT_DISCOVERY_STATE,discoveryLimits,buildDiscoveryQueries,extractCompanyMentions,parseCompanyExtraction,buildCompanyResolutionQueries,buildCandidateVerificationQueries,buildCandidateNarrative,normalizeCompanySearchResults,mergeCompanyCandidates,buildApolloPeopleSearchPayload,normalizeApolloPeople,selectDecisionMakers,upsertPipelineItem,normalizeDiscoveryState,recoverInterruptedDiscoveryState,canonicalDomain,normalizeLinkedInUrl,isBlockedDomain,hasActiveSignals,isActionableCandidate};
});
