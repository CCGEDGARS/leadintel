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
  const FIND_INFO_LABEL='Find Missing Info';
  const ANALYZE_LABEL='Analyze customer list';
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const norm=value=>clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const STOPWORDS=new Set(['company','co','corporation','corp','inc','incorporated','limited','ltd','llc','group','holding','holdings','sia','as','ab','oy','ou','uab','gmbh','sarl','bv','plc','the']);
  const BLOCKED_HOSTS=['linkedin.com','facebook.com','instagram.com','twitter.com','x.com','wikipedia.org','crunchbase.com','zoominfo.com','bloomberg.com','opencorporates.com','yelp.com','tripadvisor.com','glassdoor.com','dnb.com','kompass.com','saraksts.lv'];

  function needsWebsite(row={}){return Boolean(clean(row.companyName)&&!clean(row.website));}
  function needsCompanyName(row={}){return Boolean(!clean(row.companyName)&&clean(row.website));}
  function needsInfo(row={}){return needsWebsite(row)||needsCompanyName(row);}
  function rootUrl(value){try{const url=new URL(/^https?:\/\//i.test(clean(value))?clean(value):`https://${clean(value)}`);return `${url.protocol}//${url.hostname.replace(/^www\./i,'')}/`;}catch{return '';}}
  function hostname(value){try{return new URL(rootUrl(value)).hostname.replace(/^www\./i,'').toLowerCase();}catch{return '';}}
  function blocked(host){return BLOCKED_HOSTS.some(item=>host===item||host.endsWith(`.${item}`));}
  function companyTokens(name){return norm(name).split(' ').filter(token=>token.length>=3&&!STOPWORDS.has(token));}
  function tokenCoverage(text,tokens){if(!tokens.length)return 0;const hay=norm(text);return tokens.filter(token=>hay.includes(token)).length/tokens.length;}
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
  function companyNameFromPayload(payload={}){
    const data=payload?.data||payload;
    const title=clean(data?.metadata?.title||data?.title||payload?.metadata?.title);
    if(!title)return '';
    const candidate=clean(title.split(/\s+(?:\||–|—|::)\s+|\s+-\s+/)[0]).replace(/\s+(?:official website|homepage)$/i,'').trim();
    if(candidate.length<2||candidate.length>120||/^(home|welcome|official website)$/i.test(candidate))return '';
    return candidate;
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
  async function identifyCompanyName(root,row){
    const response=await root.fetch(`${FIRECRAWL_PROXY}/firecrawl-scrape`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:row.website,formats:['markdown'],onlyMainContent:true,timeout:25000})});
    const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(payload?.error)||`Website lookup returned ${response.status}`);
    return companyNameFromPayload(payload);
  }
  function install(root){
    const document=root.document;if(!document)return;
    const Ref=()=>root.LeadIntelReferenceCustomers;
    function readState(){try{return JSON.parse(root.localStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
    function writeState(state){const Reference=Ref();if(Reference?.persistReferenceWorkspaceState)return Reference.persistReferenceWorkspaceState(root,state,{render:true});root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));root.dispatchEvent(new root.CustomEvent('leadintel:reference-customers-updated'));root.LeadIntelReferenceCustomerUI?.render?.();try{const pending=root.LeadIntelServerBridge?.saveNow?.();if(pending&&typeof pending.then==='function')void Promise.resolve(pending).catch(()=>null);}catch{}return state;}
    function setTwoLineLabel(button,label,firstLine,secondLine){
      if(!button)return;
      button.setAttribute('aria-label',label);
      button.innerHTML=`<span>${firstLine}<br>${secondLine}</span>`;
    }
    function setFindIdleLabel(button){
      if(!button)return;
      const state=readState(),rows=Array.isArray(state.referenceCustomers?.rows)?state.referenceCustomers.rows:[];
      const missingCount=rows.filter(needsInfo).length;
      button.setAttribute('aria-label',missingCount?`${FIND_INFO_LABEL}: ${missingCount} records`:FIND_INFO_LABEL);
      button.textContent=missingCount?`Find Missing Info (${missingCount})`:FIND_INFO_LABEL;
      button.disabled=!missingCount;
    }
    function setAnalyzeIdleLabel(button){setTwoLineLabel(button,ANALYZE_LABEL,'Analyze customer','list');}
    function ensureActionStatus(){
      const actions=document.querySelector('#reference-customer-modal .reference-analysis-actions');if(!actions)return null;
      let node=document.getElementById('reference-action-status');
      if(!node){node=document.createElement('div');node.id='reference-action-status';node.className='reference-import-status';node.setAttribute('aria-live','polite');node.style.cssText='flex:1 1 100%;width:100%;margin-top:8px;';actions.appendChild(node);}
      return node;
    }
    function setStatus(message){
      const text=clean(message);const top=document.getElementById('reference-import-status');if(top)top.textContent=text;
      const local=ensureActionStatus();if(local)local.textContent=text;
    }
    function ensureUx(){
      const modal=document.getElementById('reference-customer-modal');if(!modal)return;
      const guide=modal.querySelector('.reference-format-guide p');if(guide)guide.innerHTML='<b>Company Name or Website is required.</b> LeadIntel can find a missing official website or identify a missing company name before analysis.';
      const manualWebsite=modal.querySelector('#reference-manual-website');if(manualWebsite)manualWebsite.placeholder='Website (optional)';
      const empty=modal.querySelector('.reference-empty');if(empty)empty.textContent='Upload a customer list with a Company Name, Website, or both. LeadIntel can find missing information.';
      const importActions=modal.querySelector('.reference-import-actions');
      if(importActions){
        let button=importActions.querySelector('#reference-find-websites')||modal.querySelector('#reference-find-websites');
        if(!button){button=document.createElement('button');button.type='button';button.id='reference-find-websites';button.className='secondary-btn';}
        const clear=importActions.querySelector('#reference-clear-list');
        if(clear)clear.insertAdjacentElement('afterend',button);else{const pdf=importActions.querySelector('.reference-pdf-fallback');if(pdf)importActions.insertBefore(button,pdf);else importActions.appendChild(button);}
        setFindIdleLabel(button);
      }
      const analyze=modal.querySelector('#reference-analyze');if(analyze&&!analyze.disabled)setAnalyzeIdleLabel(analyze);
      ensureActionStatus();
    }
    async function enrich(button){
      const ref=Ref();if(!ref?.normalizeReferenceState)throw new Error('Reference Customer Intelligence is not ready. Reload and try again.');
      let state=readState();state.referenceCustomers=ref.normalizeReferenceState(state.referenceCustomers||{});
      const missing=state.referenceCustomers.rows.filter(needsInfo).slice(0,MAX_ENRICH);
      if(!missing.length){setStatus('All reference customers have company names and websites.');return;}
      button.disabled=true;button.textContent='Finding missing info…';let websitesFound=0,namesFound=0,checked=0,failed=0;let firstError='';
      try{
        for(const row of missing){
          setStatus(`Finding missing info… ${checked}/${missing.length} checked · ${websitesFound+namesFound} found`);
          try{
            if(needsWebsite(row)){
              const match=await searchOfficialWebsite(root,row);checked++;
              if(match){row.website=match.url;row.domain=hostname(match.url);row.status='ready';row.reviewed=true;websitesFound++;}else failed++;
            }else{
              const companyName=await identifyCompanyName(root,row);checked++;
              if(companyName){row.companyName=companyName;row.status='needs_review';row.reviewed=false;namesFound++;}else failed++;
            }
          }catch(error){checked++;failed++;if(!firstError)firstError=clean(error?.message)||'Information search failed';}
        }
        state.referenceCustomers=ref.normalizeReferenceState({...state.referenceCustomers,rows:state.referenceCustomers.rows,segments:[],activeSegmentIds:[],activeIds:[],activated:false,dna:null});
        await writeState(state);
        if(!websitesFound&&!namesFound&&firstError)setStatus(`Unable to find missing information: ${firstError}`);
        else setStatus(`Find Missing Info complete · ${websitesFound} website${websitesFound===1?'':'s'} found · ${namesFound} company name${namesFound===1?'':'s'} identified · ${failed} need review.${missing.length===MAX_ENRICH?' Run again to continue with the remaining records.':''}`);
        root.LeadIntelReferenceCustomerLibraryUI?.openEditor?.();
      }finally{button.disabled=false;setFindIdleLabel(button);ensureUx();}
    }
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('[data-reference-customers-manage]'))[0,50,200].forEach(delay=>root.setTimeout(ensureUx,delay));
      const button=event.target?.closest?.('#reference-find-websites');if(!button)return;event.preventDefault();event.stopPropagation();enrich(button).catch(error=>{button.disabled=false;setFindIdleLabel(button);setStatus(clean(error?.message)||'Unable to find missing websites');});
    });
    root.addEventListener('leadintel:reference-customers-updated',()=>root.setTimeout(ensureUx,0));
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>root.setTimeout(ensureUx,0),{once:true});else root.setTimeout(ensureUx,0);
  }
  return {needsWebsite,needsCompanyName,needsInfo,companyNameFromPayload,selectOfficialWebsite,extractCandidates,install};
});
