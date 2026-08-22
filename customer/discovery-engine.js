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
  const DEFAULT_DISCOVERY_STATE=Object.freeze({status:"idle",queries:[],rawResults:[],candidates:[],pipeline:[],lastRunAt:""});
  const STOPWORDS=new Set(["with","from","that","this","your","their","into","over","under","company","companies","business","businesses","priority","market","markets","customer","customers","service","services","product","products","industrial"]);

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function clamp(value,min,max,fallback=min){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function splitList(value){
    if(Array.isArray(value))return [...new Set(value.map(clean).filter(Boolean))];
    return [...new Set(String(value??"").split(/\n|;|\||,/).map(clean).filter(Boolean))];
  }
  function slug(value){return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item";}
  function normalizeUrl(value){try{const u=new URL(clean(value));return ["http:","https:"].includes(u.protocol)?u.href:"";}catch{return "";}}
  function canonicalDomain(value){
    const url=normalizeUrl(value)||normalizeUrl(`https://${clean(value).replace(/^www\./i,"")}`);
    if(!url)return "";
    return new URL(url).hostname.toLowerCase().replace(/^www\./,"");
  }
  function isBlockedDomain(domain){
    const d=clean(domain).toLowerCase();
    return BLOCKED_HOSTS.some(host=>d===host||d.endsWith(`.${host}`));
  }
  function displayFromDomain(domain){
    const base=clean(domain).split(".")[0].replace(/[-_]+/g," ");
    return base.replace(/\b\w/g,c=>c.toUpperCase())||"Company";
  }
  function companyFromTitle(title,domain){
    const first=clean(title).split(/\s+[|–—:]\s+|\s+-\s+/)[0];
    if(first&&first.length<=90&&!/^(home|welcome|about us|official site)$/i.test(first))return first;
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

  function buildDiscoveryQueries(profile={},marketState={},maxQueries=4){
    if(!marketState?.strategyApproved)return [];
    const limit=Math.max(1,Math.min(4,Number(maxQueries)||4));
    const activeOpps=(marketState.opportunities||[]).filter(item=>item.active!==false);
    const markets=activeOpps.length?activeOpps.map(item=>clean(item.market)).filter(Boolean):splitList(profile.targetMarkets);
    const activeIcps=(marketState.icps||[]).filter(item=>item.active!==false);
    const icpText=activeIcps.map(item=>clean(item.description)).filter(Boolean).join(" ")||clean(profile.idealCustomer);
    const offer=splitList(profile.priorityOffers)[0]||"commercial solution";
    const topSignals=(marketState.signals||[]).filter(item=>item.active!==false).sort((a,b)=>(Number(b.weight)||0)-(Number(a.weight)||0)).slice(0,3);
    const signalTerms=topSignals.map(item=>splitList(item.keywords)[0]||clean(item.name)).filter(Boolean).join(" ");
    const results=[];
    for(const market of [...new Set(markets.length?markets:["priority market"])]){
      if(results.length>=limit)break;
      const query=[market,icpText,offer,signalTerms,"manufacturer company official site"].filter(Boolean).join(" ");
      results.push({id:`discover-${slug(market)}-${results.length+1}`,market,query,offer});
    }
    if(results.length<limit&&markets[0]){
      const extra=[markets[0],offer,clean(profile.buyingTriggers),"company expansion investment official website"].filter(Boolean).join(" ");
      if(!results.some(item=>item.query===extra))results.push({id:`discover-${slug(markets[0])}-${results.length+1}`,market:markets[0],query:extra,offer});
    }
    return results.slice(0,limit);
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
      const description=clean(item?.description||item?.snippet||"");
      const text=clean(item?.markdown||item?.content||item?.text||description).slice(0,7000);
      return {
        queryId:clean(queryMeta.id),market:clean(queryMeta.market),query:clean(queryMeta.query),url,domain,
        company:companyFromTitle(item?.title,domain),title:clean(item?.title)||displayFromDomain(domain),description,text,
        date:clean(item?.publishedDate||item?.date||item?.published_at||item?.metadata?.publishedDate)
      };
    }).filter(Boolean);
  }

  function activeSignals(marketState){return (marketState?.signals||[]).filter(item=>item.active!==false);}
  function matchedSignalsForEvidence(signals,evidence){
    const hay=evidence.map(evidenceText).join(" ");
    return signals.map(signal=>{
      const terms=splitList(signal.keywords||signal.name).map(term=>term.toLowerCase()).filter(Boolean);
      const matched=terms.filter(term=>hay.includes(term));
      return matched.length?{id:clean(signal.id),name:clean(signal.name),weight:clamp(signal.weight,1,10,5),matchedTerms:matched.slice(0,5)}:null;
    }).filter(Boolean);
  }
  function fitScore(candidate,profile,marketState){
    const hay=candidate.evidence.map(evidenceText).join(" ");
    const source=[profile.idealCustomer,profile.priorityOffers,...(marketState.icps||[]).filter(x=>x.active!==false).map(x=>`${x.description} ${x.offers}`)].join(" ");
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

  function mergeCompanyCandidates(results=[],profile={},marketState={}){
    const grouped=new Map();
    for(const item of results||[]){
      const domain=clean(item?.domain)||canonicalDomain(item?.url);
      if(!domain||isBlockedDomain(domain)||!normalizeUrl(item?.url))continue;
      const current=grouped.get(domain)||{domain,company:clean(item.company)||displayFromDomain(domain),market:clean(item.market),website:`https://${domain}/`,evidence:[]};
      if(!current.market&&item.market)current.market=clean(item.market);
      if(current.company===displayFromDomain(domain)&&clean(item.company))current.company=clean(item.company);
      if(!current.evidence.some(e=>e.url===item.url))current.evidence.push({url:item.url,title:clean(item.title),description:clean(item.description),text:String(item.text||"").slice(0,7000),date:clean(item.date)});
      grouped.set(domain,current);
    }
    const signals=activeSignals(marketState);
    return [...grouped.values()].map(candidate=>{
      candidate.evidence=candidate.evidence.slice(0,5);
      candidate.matchedSignals=matchedSignalsForEvidence(signals,candidate.evidence);
      const score={
        fit:fitScore(candidate,profile,marketState),
        signal:signalScore(candidate.matchedSignals),
        evidence:evidenceScore(candidate),
        timing:timingScore(candidate),
        value:valueScore(candidate,profile,marketState)
      };
      score.total=score.fit+score.signal+score.evidence+score.timing+score.value;
      const confidence=score.total>=75&&candidate.matchedSignals.length&&candidate.evidence.length>=1?"High":score.total>=50?"Medium":"Low";
      return {...candidate,id:`company-${slug(candidate.domain)}`,score,confidence,people:[],peopleStatus:"idle",saved:false};
    }).sort((a,b)=>b.score.total-a.score.total).slice(0,12);
  }

  function buildApolloPeopleSearchPayload(candidate={},profile={}){
    const domain=canonicalDomain(candidate.domain||candidate.website);
    const titles=splitList(profile.decisionMakers).slice(0,10);
    return {
      q_organization_domains_list:domain?[domain]:[],
      person_titles:titles,
      include_similar_titles:true,
      person_seniorities:["c_suite","vp","head","director","manager"],
      page:1,per_page:5
    };
  }

  function normalizeApolloPeople(payload={}){
    const raw=Array.isArray(payload?.people)?payload.people:Array.isArray(payload?.contacts)?payload.contacts:Array.isArray(payload?.data?.people)?payload.data.people:[];
    return raw.slice(0,5).map(person=>{
      const name=clean(person?.name)||clean(`${person?.first_name||""} ${person?.last_name||""}`);
      return {
        id:clean(person?.id)||`person-${slug(name)}-${Math.random().toString(36).slice(2,7)}`,
        name:name||"Unknown person",title:clean(person?.title)||"Role not provided",seniority:clean(person?.seniority),
        organization:clean(person?.organization?.name||person?.organization_name),city:clean(person?.city),country:clean(person?.country)
      };
    }).filter(item=>item.name!=="Unknown person"||item.title!=="Role not provided");
  }

  function safeCandidate(candidate={}){
    const domain=canonicalDomain(candidate.domain||candidate.website);
    const website=normalizeUrl(candidate.website)|| (domain?`https://${domain}/`:"");
    const people=(Array.isArray(candidate.people)?candidate.people:[]).slice(0,5).map(p=>({id:clean(p?.id),name:clean(p?.name),title:clean(p?.title),seniority:clean(p?.seniority),organization:clean(p?.organization),city:clean(p?.city),country:clean(p?.country)}));
    return {
      id:clean(candidate.id)||`company-${slug(domain||candidate.company)}`,company:clean(candidate.company)||displayFromDomain(domain),domain,website,
      market:clean(candidate.market),score:candidate.score&&typeof candidate.score==="object"?candidate.score:{total:0},confidence:["High","Medium","Low"].includes(candidate.confidence)?candidate.confidence:"Low",
      matchedSignals:(Array.isArray(candidate.matchedSignals)?candidate.matchedSignals:[]).slice(0,12),evidence:(Array.isArray(candidate.evidence)?candidate.evidence:[]).slice(0,5),
      people,peopleStatus:["idle","loading","complete","empty","error"].includes(candidate.peopleStatus)?candidate.peopleStatus:"idle",saved:Boolean(candidate.saved)
    };
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
      queries:(Array.isArray(input.queries)?input.queries:[]).slice(0,4).map(q=>({id:clean(q.id),market:clean(q.market),query:clean(q.query),offer:clean(q.offer)})).filter(q=>q.id&&q.query),
      rawResults:(Array.isArray(input.rawResults)?input.rawResults:[]).slice(0,20).map(normalizeRaw).filter(item=>item.url&&item.domain),
      candidates:(Array.isArray(input.candidates)?input.candidates:[]).slice(0,12).map(safeCandidate).filter(item=>item.domain),
      pipeline:(Array.isArray(input.pipeline)?input.pipeline:[]).slice(0,50).map(normalizePipelineItem).filter(item=>item.domain),
      lastRunAt:clean(input.lastRunAt)
    };
  }

  return {CRM_STAGES,DEFAULT_DISCOVERY_STATE,buildDiscoveryQueries,normalizeCompanySearchResults,mergeCompanyCandidates,buildApolloPeopleSearchPayload,normalizeApolloPeople,upsertPipelineItem,normalizeDiscoveryState,canonicalDomain,isBlockedDomain};
});
