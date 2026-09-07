(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelLinkedInSignals=api;if(root.LeadIntelMarket)api.install(root.LeadIntelMarket,root.document||null);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const clean=value=>String(value??"").replace(/\s+/g," ").trim();
  const split=value=>Array.isArray(value)?value.map(clean).filter(Boolean):String(value??"").split(/\n|;|\|/).map(clean).filter(Boolean);
  const linkedinHost=value=>{try{return /(^|\.)linkedin\.com$/i.test(new URL(value).hostname);}catch{return false;}};
  function classifyLinkedInEvidence(url){return linkedinHost(url)?"linkedin-public-index":"public-web";}
  function apolloLinkedInProvenance(url){return linkedinHost(url)?"apollo-linkedin-url":"";}
  function modeLimit(mode){return mode==="intelligence"?5:mode==="deep"?3:0;}
  function buildLinkedInQueries(profile={},signals=[],input={}){
    const mode=String(input.mode||"quick");if(modeLimit(mode)===0)return [];
    const sourceTypes=split(input.sourceTypes).map(v=>v.toLowerCase());if(!sourceTypes.includes("linkedin"))return [];
    const markets=split(profile.researchMarkets||profile.targetMarkets||profile.currentMarkets);const market=markets[0]||"priority market";
    const roles=split(profile.decisionMakers).slice(0,3).join(" OR ")||"Sales Director OR Commercial Director OR CEO";
    const offer=split(profile.priorityOffers)[0]||"commercial growth";
    const active=(signals||[]).filter(s=>s?.active!==false).slice(0,4).flatMap(s=>split(String(s.keywords||s.name||"").replace(/,/g,";"))).slice(0,5).join(" OR ")||"growth OR transformation";
    const year=new Date().getUTCFullYear();
    const families=[
      {id:"linkedin-leadership",query:`site:linkedin.com/in OR site:linkedin.com/company ${market} (${roles}) appointed OR new OR promoted OR joined ${year}`},
      {id:"linkedin-hiring",query:`site:linkedin.com/jobs/view OR site:linkedin.com/company ${market} hiring sales team growth recruitment ${offer} ${year}`},
      {id:"linkedin-activity",query:`site:linkedin.com/company ${market} (${active}) expansion OR launch OR transformation OR AI OR CRM ${year}`},
      {id:"linkedin-role-identity",query:`site:linkedin.com/in ${market} (${roles}) ${offer} ${year}`},
      {id:"linkedin-company-growth",query:`site:linkedin.com/company ${market} growth investment expansion sales ${year}`}
    ];
    return families.slice(0,modeLimit(mode)).map((item,index)=>({id:`${item.id}-${index+1}`,market,offer,sourceType:"linkedin",sourceKind:"linkedin-public-index",query:item.query}));
  }
  function install(marketApi,doc){
    if(!marketApi||marketApi.__linkedinSignalsInstalled)return marketApi;
    marketApi.__linkedinSignalsInstalled=true;
    const originalBuild=marketApi.buildResearchQueries?.bind(marketApi);
    const originalFilter=marketApi.filterResearchSourceTypes?.bind(marketApi);
    const originalNormalize=marketApi.normalizeSearchResults?.bind(marketApi);
    const originalMerge=marketApi.mergeResearchResults?.bind(marketApi);
    const originalState=marketApi.normalizeMarketState?.bind(marketApi);
    if(originalBuild)marketApi.buildResearchQueries=(profile,signals,input={})=>{
      const requested=split(input.sourceTypes);const linkedin=buildLinkedInQueries(profile,signals,input);
      const base=originalBuild(profile,signals,{...input,sourceTypes:requested.filter(type=>type!=="linkedin")});
      if(!linkedin.length)return base;
      const max=marketApi.RESEARCH_MODES?.[input.mode]?.maxQueries||base.length+linkedin.length;
      return [...base.slice(0,Math.max(0,max-linkedin.length)),...linkedin].slice(0,max);
    };
    if(originalFilter)marketApi.filterResearchSourceTypes=(types,signals)=>{
      const requested=split(types);const base=originalFilter(requested.filter(type=>type!=="linkedin"),signals);
      return requested.includes("linkedin")?[...base,"linkedin"]:[...base];
    };
    if(originalNormalize)marketApi.normalizeSearchResults=(payload,queryMeta={},provider="")=>originalNormalize(payload,queryMeta,provider).map(item=>({...item,sourceKind:queryMeta.sourceType==="linkedin"&&linkedinHost(item.url)?"linkedin-public-index":classifyLinkedInEvidence(item.url)}));
    if(originalMerge)marketApi.mergeResearchResults=(...groups)=>originalMerge(...groups).map(item=>({...item,sourceKind:linkedinHost(item.url)?"linkedin-public-index":item.sourceKind||"public-web"}));
    if(originalState)marketApi.normalizeMarketState=input=>{
      const state=originalState(input);const requested=split(input?.researchSourceTypes);
      if(requested.includes("linkedin")&&!state.researchSourceTypes.includes("linkedin"))state.researchSourceTypes=[...state.researchSourceTypes,"linkedin"];
      state.researchResults=(state.researchResults||[]).map(item=>({...item,sourceKind:linkedinHost(item.url)?"linkedin-public-index":item.sourceKind||"public-web"}));
      return state;
    };
    if(doc)installUi(doc);
    return marketApi;
  }
  function installUi(doc){
    const ensure=()=>{
      const fieldset=doc.getElementById("research-source-types");if(!fieldset||fieldset.querySelector('input[value="linkedin"]'))return;
      const label=doc.createElement("label");label.className="linkedin-public-signals";label.innerHTML='<input type="checkbox" value="linkedin"> LinkedIn public signals';
      const note=doc.createElement("small");note.className="linkedin-public-note";note.textContent="Uses public LinkedIn-indexed pages only; LeadIntel does not bypass LinkedIn login restrictions.";
      fieldset.insertBefore(label,fieldset.querySelector("small")||null);fieldset.appendChild(note);
      const input=label.querySelector("input");const mode=doc.getElementById("research-mode");
      const sync=()=>{const deep=mode&&mode.value!=="quick";input.disabled=!deep;if(!input.dataset.touched)input.checked=Boolean(deep);};
      input.addEventListener("change",()=>{input.dataset.touched="1";});mode?.addEventListener("change",sync);sync();
    };
    ensure();if(typeof MutationObserver!=="undefined")new MutationObserver(ensure).observe(doc.body||doc.documentElement,{childList:true,subtree:true});
  }
  return {buildLinkedInQueries,classifyLinkedInEvidence,apolloLinkedInProvenance,install,installUi};
});
