(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelReferenceCustomerWebsiteEnrichment=api;
  if(root&&root.document)api.install(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  'use strict';
  const STORAGE_KEY='leadintel_customer_v2_state';
  const FIRECRAWL_PROXY='https://apollo-proxy.edgars-7e7.workers.dev';
  const MAX_ENRICH=25;
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const norm=value=>clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const STOPWORDS=new Set(['company','co','corporation','corp','inc','incorporated','limited','ltd','llc','group','holding','holdings','sia','as','ab','oy','ou','uAB','gmbh','sarl','bv','plc','the']);
  const BLOCKED_HOSTS=['linkedin.com','facebook.com','instagram.com','twitter.com','x.com','wikipedia.org','crunchbase.com','zoominfo.com','bloomberg.com','opencorporates.com','yelp.com','tripadvisor.com','glassdoor.com','dnb.com','kompass.com','saraksts.lv'];

  function needsWebsite(row={}){return Boolean(clean(row.companyName)&&!clean(row.website));}
  function rootUrl(value){try{const url=new URL(/^https?:\/\//i.test(clean(value))?clean(value):`https://${clean(value)}`);return `${url.protocol}//${url.hostname.replace(/^www\./i,'')}/`;}catch{return '';}}
  function hostname(value){try{return new URL(rootUrl(value)).hostname.replace(/^www\./i,'').toLowerCase();}catch{return '';}}
  function blocked(host){return BLOCKED_HOSTS.some(item=>host===item||host.endsWith(`.${item}`));}
  function companyTokens(name){return norm(name).split(' ').filter(token=>token.length>=3&&!STOPWORDS.has(token));}
  function tokenCoverage(text,tokens){if(!tokens.length)return 0;const hay=` ${norm(text)} `;return tokens.filter(token=>hay.includes(` ${token} `)||norm(text).includes(token)).length/tokens.length;}
  function domainTokenMatches(host,tokens){const compact=host.split('.')[0].replace(/[^a-z0-9]/g,'');return tokens.filter(token=>compact.includes(token.replace(/[^a-z0-9]/g,''))).length;}
  function candidateScore(row,candidate={}){
    const url=rootUrl(candidate.url||candidate.link||candidate.sourceURL||candidate?.metadata?.sourceURL);const host=hostname(url);if(!url||!host||blocked(host))return null;
    const tokens=companyTokens(row.companyName);if(!tokens.length)return null;
    const domainMatches=domainTokenMatches(host,tokens);const titleCoverage=tokenCoverage(candidate.title||candidate.name||'',tokens);const descriptionCoverage=tokenCoverage(candidate.description||candidate.snippet||candidate.content||'',tokens);
    const country=norm(row.country);const countryBonus=country&&norm(`${candidate.title||''} ${candidate.description||candidate.snippet||''}`).includes(country)?1:0;
    const score=domainMatches*4+titleCoverage*3+descriptionCoverage+countryBonus;
    if(domainMatches<1||titleCoverage<0.5||score<6)return null;
    return {url,host,score};
  }
  function selectOfficialWebsite(row={},candidates=[]){
    const unique=new Map();
    for(const candidate of candidates||[]){const scored=candidateScore(row,candidate);if(!scored)continue;const current=unique.get(scored.host);if(!current||scored.score>current.score)unique.set(scored.host,scored);}
    const ranked=[...unique.values()].sort((a,b)=>b.score-a.score||a.host.localeCompare(b.host));if(!ranked.length)return null;
    const top=ranked[0],second=ranked[1];if(second&&top.score-second.score<2&&top.score<9)return null;
    return {url:top.url,confidence:'high',score:top.score};
  }
  function extractCandidates(payload={}){
    const pools=[payload?.data,payload?.data?.web,payload?.web,payload?.results,payload?.items];const items=[];
    for(const pool of pools){if(Array.isArray(pool))items.push(...pool);}
    return items.filter(item=>item&&typeof item==='object');
  }
  async function searchOfficialWebsite(root,row){
    const query=`"${clean(row.companyName)}" official website${clean(row.country)?` ${clean(row.country)}`:''}`;
    const response=await root.fetch(`${FIRECRAWL_PROXY}/firecrawl-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,limit:5})});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(payload?.error)||`Website search returned ${response.status}`);
    return selectOfficialWebsite(row,extractCandidates(payload));
  }
  function install(root){
    const document=root.document;if(!document)return;
    const Ref=()=>root.LeadIntelReferenceCustomers;
    function readState(){try{return JSON.parse(root.localStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
    async function writeState(state){root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));await root.LeadIntelServerBridge?.saveNow?.().catch(()=>null);root.dispatchEvent(new root.CustomEvent('leadintel:reference-customers-updated'));root.LeadIntelReferenceCustomerUI?.render?.();}
    function setStatus(message){const node=document.getElementById('reference-import-status');if(node)node.textContent=message;}
    async function enrich(button){
      const ref=Ref();if(!ref?.normalizeReferenceState)throw new Error('Reference Customer Intelligence is not ready. Reload and try again.');
      let state=readState();state.referenceCustomers=ref.normalizeReferenceState(state.referenceCustomers||{});
      const missing=state.referenceCustomers.rows.filter(needsWebsite).slice(0,MAX_ENRICH);
      if(!missing.length){setStatus('All reference customers already have websites.');return;}
      button.disabled=true;let found=0,checked=0,failed=0;
      for(const row of missing){
        setStatus(`Finding official websites… ${checked}/${missing.length} checked · ${found} found`);
        try{
          const match=await searchOfficialWebsite(root,row);checked++;
          if(match){row.website=match.url;row.domain=hostname(match.url);row.status='ready';row.reviewed=true;found++;}else failed++;
        }catch{checked++;failed++;}
      }
      state.referenceCustomers=ref.normalizeReferenceState({...state.referenceCustomers,rows:state.referenceCustomers.rows,segments:[],activeSegmentIds:[],activeIds:[],activated:false,dna:null});
      await writeState(state);
      setStatus(`${found} official website${found===1?'':'s'} found and verified · ${failed} still need review.${missing.length===MAX_ENRICH?' Run again to continue with the remaining companies.':''}`);
      button.disabled=false;
    }
    document.addEventListener('click',event=>{const button=event.target?.closest?.('#reference-find-websites');if(!button)return;event.preventDefault();event.stopPropagation();enrich(button).catch(error=>{button.disabled=false;setStatus(clean(error?.message)||'Unable to find missing websites');});});
  }
  return {needsWebsite,selectOfficialWebsite,extractCandidates,install};
});
