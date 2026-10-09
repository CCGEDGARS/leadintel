(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelFirstPartyResearch=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EvidencePolicy=typeof module==='object'&&module.exports?require('./evidence-policy.js'):globalThis.LeadIntelEvidencePolicy;
  const PROXY='https://apollo-proxy.edgars-7e7.workers.dev';
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  function host(url){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}}
  function usableText(value){const text=clean(value);return (!EvidencePolicy||EvidencePolicy.usable({text}))&&text.length>=120&&!/^(?:access denied|just a moment|verify you are human|checking your browser|enable javascript and cookies)/i.test(text)&&!(/(?:captcha|cloudflare ray id|verify you are human)/i.test(text)&&text.length<1000);}
  function selectInternalLinks(page={},website,purpose='company',limit=4){
    const origin=host(website),urls=new Map();
    const matches=[...String(page.text||page.markdown||'').matchAll(/\[([^\]]*)\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)].map(m=>({url:m[2],title:m[1]}));
    for(const item of [...(page.links||[]),...matches]){
      const raw=typeof item==='string'?item:item?.url||item?.href;let url;try{url=new URL(raw,website);}catch{continue;}
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||host(url.href)!==origin)continue;
      url.hash='';if(url.search||/\.(?:jpg|jpeg|png|gif|svg|zip|mp4|pdf|docx?)$/i.test(url.pathname)||/privacy|cookie|terms|login|signin|cart|checkout/i.test(url.pathname))continue;
      const normalized=url.href.replace(/\/$/,'');if(normalized===String(website).replace(/\/$/,''))continue;
      let path=url.pathname;try{path=decodeURI(path);}catch{}const label=path+' '+clean(item?.title||'');
      const company=/product|service|capabilit|manufactur|production|solution|project|case|customer|about|produkt|tjänst|tjanst|tillverk|lösning|losning|referens|om-oss/i.test(label);
      const people=/contact|kontakt|team|people|leadership|management|ledning|organisation|organization|about|om-oss/i.test(label);
      const locale=/^\/(?:en(?:[-_][a-z]{2})?|english)(?:\/|$)/i.test(path);
      const commercial=/product|capabilit|manufactur|production|produkt|tillverk/i.test(label);
      const score=(purpose==='buyers'?people?10:company?2:0:purpose==='verification'?/contact|kontakt/i.test(label)?11:company?10:people?3:0:commercial?16:company?12:locale?10:people?1:0);
      if(score)urls.set(normalized,{url:url.href,score});
    }
    return [...urls.values()].sort((a,b)=>b.score-a.score||a.url.localeCompare(b.url)).slice(0,Math.max(0,Math.min(6,limit))).map(x=>x.url);
  }
  async function collectWebsiteEvidence({website,purpose='company',maxPages=5,fetchImpl=globalThis.fetch,signal,maxDurationMs=0}={}){
    const domain=host(website);if(!domain)throw new Error('A company website is required');if(signal?.aborted)throw signal.reason||Object.assign(new Error('Research cancelled'),{name:'AbortError'});
    const parentSignal=signal,budgetController=new AbortController();
    const abortParent=()=>budgetController.abort(parentSignal.reason);if(parentSignal?.aborted)abortParent();else parentSignal?.addEventListener('abort',abortParent,{once:true});
    const budgetTimer=maxDurationMs>0?setTimeout(()=>budgetController.abort(new DOMException('Company website check deadline reached','TimeoutError')),maxDurationMs):null;
    signal=budgetController.signal;
    const pages=[],issues=[];
    try{
    async function read(url){
      const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);
      if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(()=>controller.abort(),25000);let stop;const cancelled=new Promise((_,reject)=>{stop=()=>reject(controller.signal.reason||Object.assign(new Error('Research cancelled'),{name:'AbortError'}));if(controller.signal.aborted)stop();else controller.signal.addEventListener('abort',stop,{once:true});});
      try{
        const response=await Promise.race([fetchImpl(`${PROXY}/firecrawl-scrape`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,formats:['markdown','links'],onlyMainContent:purpose!=='buyers',timeout:25000}),signal:controller.signal}),cancelled]);
        const payload=await Promise.race([response.json().catch(()=>({})),cancelled]);if(!response.ok)throw Object.assign(new Error(`Website extraction failed (${response.status})`),{status:response.status});
        const data=payload.data||payload,actual=data.metadata?.sourceURL||data.metadata?.url||url;
        if(host(actual)!==domain)throw new Error('Website redirected outside the company domain');
        const text=String(data.markdown||data.content||'').trim().slice(0,60000);
        if((EvidencePolicy&&!EvidencePolicy.usable(data))||!usableText(text))throw new Error('Insufficient readable company evidence');
        return {url:actual,title:clean(data.metadata?.title||data.title)||domain,text,...(EvidencePolicy?.publication(data)||{}),statusCode:Number(data.metadata?.statusCode)||200,links:data.links||[],provider:response.headers?.get?.('X-LeadIntel-Extractor')||data.metadata?.source||'firecrawl',fetchedAt:new Date().toISOString()};
      }finally{clearTimeout(timer);controller.signal.removeEventListener('abort',stop);signal?.removeEventListener('abort',abort);}
    }
    const home=await read(website);pages.push(home);
    const pageLimit=Math.max(1,Math.min(8,Number(maxPages)||5));
    const visited=new Set([home.url.replace(/\/$/,'')]),queue=selectInternalLinks(home,home.url,purpose,6).map(url=>({url,depth:1}));
    while(queue.length&&pages.length<pageLimit&&visited.size<pageLimit+3){
      if(signal?.aborted)break;
      const next=queue.shift(),key=next.url.replace(/\/$/,'');if(visited.has(key))continue;visited.add(key);
      try{const page=await read(next.url);pages.push(page);
        if(next.depth<2){const links=selectInternalLinks(page,page.url,purpose,6).filter(url=>!visited.has(url.replace(/\/$/,'')));queue.unshift(...links.map(url=>({url,depth:next.depth+1})));}
      }catch(error){issues.push({url:next.url,reason:clean(error.message)});}
    }
    if(parentSignal?.aborted)throw parentSignal.reason||Object.assign(new Error('Research cancelled'),{name:'AbortError'});
    if(signal.aborted&&!issues.length)issues.push({url:website,reason:'Company website check deadline reached'});
    return {domain,pages,issues,coverage:{pagesRead:pages.length,pagesPlanned:visited.size,partial:issues.length>0}};
    }finally{clearTimeout(budgetTimer);parentSignal?.removeEventListener('abort',abortParent);}
  }
  function selectEvidenceText(text,budget){
    const blocks=String(text||'').split(/\n+/).map(clean).filter(Boolean);
    const substantive=blocks.filter(block=>/(manufactur|produc|equipment|machin|develop|capabilit|steel|metal|weld|assembly|mining|construction|harvest|forestry|crane|lift|tillverk|produkt)/i.test(block)&&block.replace(/\[[^\]]*\]\([^)]*\)/g,'').length>=40);
    return clean([...substantive,...blocks.filter(block=>!substantive.includes(block))].join(' ')).slice(0,budget);
  }
  function boundedSources(pages=[],budget=12000){
    const usable=pages.filter(page=>page.url&&usableText(page.text));const perPage=Math.floor(budget/Math.max(1,usable.length));
    return usable.map(page=>({url:page.url,title:page.title,text:selectEvidenceText(page.text,perPage),provider:page.provider,date:page.date||'',dateSource:page.dateSource||'unknown',fetchedAt:page.fetchedAt}));
  }
  function parseQueryPlan(text,markets=[],limit=8){
    let raw;try{raw=JSON.parse(String(text).replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,''));}catch{return [];}
    const allowed=new Set(markets.map(clean)),seen=new Set(),out=[];
    for(const row of Array.isArray(raw?.queries)?raw.queries:[]){const market=clean(row.market),query=clean(row.query),language=clean(row.language);if(!allowed.has(market)||query.length<8||query.length>500||!language||seen.has(query.toLowerCase()))continue;seen.add(query.toLowerCase());out.push({id:`local-${out.length+1}`,market,query,language,discoveryRoute:row.discoveryRoute==='lookalike'?'lookalike':'signal',lookalike:row.discoveryRoute==='lookalike',kind:'market',planningMethod:'AI query translation'});if(out.length>=limit)break;}
    return out;
  }
  async function planLocalQueries({profile={},model,markets=[],workspaceId,limit=8,fetchImpl=globalThis.fetch,signal}={}){
    if(!workspaceId||!markets.length)return [];
    const refs=(model?.models?.length?model.models:[model]).flatMap(m=>m?.dna?.referenceProfiles||[]).map(ref=>({company:ref.companyName,traits:ref.dimensions}));
    const context={researchPriority:profile.discoveryPriority||'balanced',buyingSignals:profile.buyingTriggers||'',offers:profile.priorityOffers,idealCustomer:profile.idealCustomer,exclusions:profile.exclusions,references:profile.discoveryPriority==='signals'?[]:refs};
    const response=await fetchImpl(`https://leadintel-api.edgars-7e7.workers.dev/api/ai/generate?workspace_id=${encodeURIComponent(workspaceId)}`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({task:'discovery-query-planning',system:'Plan public company discovery queries. Translation is search planning, not verified evidence. Return JSON only.',prompt:`Create up to ${limit} diverse short company discovery queries for markets ${JSON.stringify(markets)}. Use both the native business language of each market and English. Prioritize broad industry, production model and specific capabilities in separate query families. Start with one English and one native-language query per market before deeper variants. Include the market in every query. ${profile.discoveryPriority==='signals'?'Use ONLY relevant current buying-event discovery. Do not perform reference/lookalike discovery.':profile.discoveryPriority==='lookalike'?'Use ONLY reference-customer lookalike discovery based on their purchasing needs. Buying signals enrich discovered companies later; do not add unrelated event-led discovery.':'Use 60% reference-customer discovery and 40% relevant buying-event discovery; tag every query discoveryRoute lookalike or signal.'} Never combine unrelated industries, invent company names, or add tender queries. Return {"queries":[{"market":"exact supplied market","language":"language code","discoveryRoute":"lookalike or signal","query":""}]}. Context: ${JSON.stringify(context).slice(0,10000)}`,max_output_tokens:1800})});
    if(!response.ok)throw new Error('Local-language query planning unavailable');const data=await response.json();const planned=parseQueryPlan(data.text,markets,limit),mode=profile.discoveryPriority||'balanced';return planned.filter(q=>mode==='balanced'||(mode==='lookalike'?q.lookalike:!q.lookalike));
  }
  return {selectEvidenceText,usableText,selectInternalLinks,collectWebsiteEvidence,boundedSources,parseQueryPlan,planLocalQueries};
});
