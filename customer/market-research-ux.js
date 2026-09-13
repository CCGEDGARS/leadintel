(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelMarketResearchUx=api;if(root.document)api.install(root);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const STORAGE_KEY="leadintel_customer_v2_state";
  const API_BASE="https://leadintel-api.edgars-7e7.workers.dev";
  const MODE_COPY=Object.freeze({
    quick:Object.freeze({
      label:"Market Scan",
      description:"Fast validation of the strongest buying signals and opportunities in your selected market.",
      badge:""
    }),
    deep:Object.freeze({
      label:"Market Research",
      description:"Deeper research across companies, market activity, news, hiring, expansion and other relevant sources.",
      badge:"Recommended"
    }),
    intelligence:Object.freeze({
      label:"Market Intelligence",
      description:"Comprehensive investigation across multiple source types to uncover opportunities, patterns, competitors and hidden signals.",
      badge:""
    })
  });
  const BUTTONS=Object.freeze({quick:"run-market-research",deep:"run-detailed-research",intelligence:"run-market-intelligence"});
  const GROUP_LABELS=Object.freeze({
    "official-company":"Official & company sources",
    hiring:"Hiring & leadership",
    "news-media":"News & media",
    "registries-data":"Registries & public data",
    industry:"Industry & specialist sources",
    technology:"Technology signals",
    "growth-investment":"Growth & investment",
    other:"Other relevant sources"
  });

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function splitList(value){return [...new Set((Array.isArray(value)?value:String(value??"").split(/;|\n|\|/)).map(clean).filter(Boolean))];}
  function esc(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
  function normalizeMode(mode){return MODE_COPY[mode]?mode:"quick";}
  function sourceDiscoveryPolicy(mode){
    const selected=normalizeMode(mode);
    if(selected==="intelligence")return {mode:"discover-before-run",maxSites:15,grouped:true};
    if(selected==="deep")return {mode:"discover-before-run",maxSites:8,grouped:false};
    return {mode:"automatic",maxSites:0,grouped:false};
  }

  function marketContext(profile={}){
    const markets=splitList(profile.targetMarkets||profile.researchMarkets||profile.currentMarkets).join(" ")||"priority market";
    const focus=splitList(profile.priorityOffers).slice(0,3).join("; ")||clean(profile.marketFocus)||"commercial opportunities";
    const customer=clean(profile.idealCustomer)||"best-fit B2B customers";
    return {markets,focus,customer};
  }

  function activeSignalTerms(market={}){
    return (market.signals||[]).filter(item=>item&&item.active!==false)
      .sort((a,b)=>Number(b.weight||0)-Number(a.weight||0))
      .slice(0,5)
      .map(item=>clean(item.keywords)||clean(item.name))
      .filter(Boolean)
      .join(" ");
  }

  function buildSourceDiscoveryQueries(profile={},market={},mode="deep"){
    const selected=normalizeMode(mode);if(selected==="quick")return [];
    const {markets,focus,customer}=marketContext(profile);const signals=activeSignalTerms(market);
    const base=[
      "business news company announcements leadership changes",
      "jobs hiring leadership recruitment growth",
      "official company registry industry association expansion investment"
    ];
    const wide=[
      "industry publications trade associations specialist market sources",
      "technology CRM AI transformation company signals",
      "funding merger acquisition expansion executive appointments"
    ];
    const intents=selected==="intelligence"?[...base,...wide]:base;
    return intents.map(intent=>[markets,focus,customer,signals,intent].filter(Boolean).join(" "));
  }

  function safeOrigin(value){
    try{const url=new URL(clean(value));if(!["http:","https:"].includes(url.protocol))return "";return `${url.origin}/`;}catch{return "";}
  }

  function classifySource(url,title="",snippet=""){
    const text=clean(`${url} ${title} ${snippet}`).toLowerCase();
    if(/\b(job|jobs|career|careers|vacanc|hiring|recruit|cv\.|linkedin.*job|personāla|vakanc)/i.test(text))return "hiring";
    if(/\b(registry|register|company register|open data|data portal|annual report|uzņēmumu reģistr|atvērt\w* dat)/i.test(text))return "registries-data";
    if(/\b(association|trade association|industry association|federation|chamber|industry publication|specialist|asociāc|federāc|kamera)/i.test(text))return "industry";
    if(/\b(crm|erp|artificial intelligence|\bai\b|technology|software|digital transformation|automation|tehnoloģ|digitaliz)/i.test(text))return "technology";
    if(/\b(invest|funding|funded|capital|merger|acquisition|expansion|growth|fund|investment|investīc|finansēj|paplašin)/i.test(text))return "growth-investment";
    if(/\b(news|media|journal|press|business news|newspaper|ziņas|medij|žurnāl)/i.test(text))return "news-media";
    if(/\b(official|company|corporate|about us|investor relations|government|gov\.|municipal|ministr|official site)/i.test(text))return "official-company";
    return "other";
  }

  function rowsFromPayload(payload){
    const candidates=[payload?.results,payload?.data?.results,payload?.data,payload?.web,payload?.sources,payload];
    return candidates.find(Array.isArray)||[];
  }

  function normalizeDiscoveredSources(payloads=[],mode="deep"){
    const policy=sourceDiscoveryPolicy(mode);if(!policy.maxSites)return [];
    const seen=new Set(),result=[];
    for(const payload of payloads||[]){
      for(const row of rowsFromPayload(payload)){
        const url=safeOrigin(row?.url||row?.link);if(!url||seen.has(url))continue;
        seen.add(url);
        const hostname=(()=>{try{return new URL(url).hostname.replace(/^www\./,"");}catch{return url;}})();
        const title=clean(row?.title||row?.name)||hostname;
        const snippet=clean(row?.description||row?.snippet||row?.text||row?.content);
        result.push({url,name:title,hostname,reason:snippet||"Live web search identified this site as relevant to the planned market investigation.",category:classifySource(url,title,snippet)});
        if(result.length>=policy.maxSites)return result;
      }
    }
    return result;
  }

  function marketCardView(opportunity={},profile={}){
    return {
      market:clean(opportunity.marketLabel||opportunity.market)||splitList(profile.targetMarkets||profile.currentMarkets)[0]||"Selected market",
      commercialFocus:splitList(profile.priorityOffers).slice(0,3).join("; ")||clean(profile.marketFocus),
      targetCustomers:clean(profile.idealCustomer),
      status:opportunity.profileOnly?"Not researched yet":"Researched",
      showScore:!opportunity.profileOnly
    };
  }

  function renderSourceCard(item={}){
    return `<label class="source-discovery-card"><input type="checkbox" data-suggested-source="true" value="${esc(item.url)}"><span><strong>${esc(item.name||item.hostname||item.url)}</strong><small>${esc(item.reason||"Relevant live-discovered source.")}</small><code>${esc(item.url)}</code></span></label>`;
  }

  function renderDiscoveredSources(items=[],mode="deep"){
    const selected=normalizeMode(mode);const policy=sourceDiscoveryPolicy(selected);
    if(!items.length)return '<div class="source-discovery-empty">No specific source sites were confirmed in the discovery pass.</div>';
    if(!policy.grouped)return `<div class="source-discovery-list">${items.map(renderSourceCard).join("")}</div>`;
    const groups=new Map();for(const item of items){const key=item.category||"other";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
    return [...groups.entries()].map(([key,rows])=>`<section class="source-map-group"><h5>${esc(GROUP_LABELS[key]||GROUP_LABELS.other)}</h5><div class="source-discovery-list">${rows.map(renderSourceCard).join("")}</div></section>`).join("");
  }

  function readState(root){try{return JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||"{}");}catch{return {};}}

  function injectCss(root){
    if(root.document.getElementById("market-research-source-discovery-css"))return;
    const style=root.document.createElement("style");style.id="market-research-source-discovery-css";
    style.textContent=`
      .research-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px!important;align-items:stretch!important}
      .research-mode-choice{display:flex;min-width:0;flex-direction:column;gap:12px;position:relative;border-radius:16px;transition:transform .18s ease,box-shadow .18s ease}
      .research-mode-choice>button{width:100%;height:100%;min-height:148px;padding:24px 20px!important;border:2px solid #1b3029!important;border-radius:15px!important;background:#fff!important;color:#14231e!important;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:13px;box-shadow:0 5px 16px rgba(15,35,29,.06);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}
      .research-mode-choice>button:hover{transform:translateY(-3px);box-shadow:0 13px 28px rgba(15,35,29,.15);border-color:#0b5f4f!important}
      .research-mode-choice>button:focus-visible{outline:3px solid rgba(13,93,79,.28);outline-offset:3px}
      .research-mode-title{font-size:20px;font-weight:800;line-height:1.2;text-align:center}
      .research-mode-action{display:none!important}
      .research-mode-badge{position:static;padding:0;background:transparent;color:#b9cbc5;font:600 12px 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em}
      .research-mode-choice[data-research-mode="deep"]>button{background:#10261f!important;color:#fff!important;border-color:#10261f!important;box-shadow:0 10px 24px rgba(12,37,29,.2)}
            .research-mode-choice[data-research-mode="deep"]>button:hover{background:#16362c!important;border-color:#16362c!important}
      .research-mode-choice[data-research-mode="intelligence"]>button{border-color:#385047!important;box-shadow:0 4px 12px rgba(15,35,29,.05)}
      .research-mode-choice.is-selected>button{outline:2px solid #0d5d4f;outline-offset:3px}
      .research-mode-choice.is-selected .research-mode-title::after{content:' ✓';color:#0d5d4f}
      .research-mode-description{font-size:14px;line-height:1.5;color:#596762;padding:0 8px;max-width:38ch}
      .research-mode-hint{display:none!important}
      .opportunity-card.unresearched .opportunity-total{display:none!important}
      .pre-research-context{display:grid;gap:8px;margin-top:14px;grid-template-columns:repeat(2,minmax(0,1fr))}
      .pre-research-context>div{padding:10px 12px;border:1px solid #dfe6e2;border-radius:10px;background:#f8faf8}
      .pre-research-context small{display:block;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#67736f;margin-bottom:4px}
      .pre-research-context span{display:block;font-size:14px;line-height:1.45;color:#26322f}
      .source-discovery-status{padding:12px 14px;border:1px solid #dfe6e2;border-radius:10px;background:#f8faf8;color:#4f5b57;font-size:14px;line-height:1.45}
      .source-discovery-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
      .source-discovery-card{display:flex;gap:10px;padding:13px;border:1px solid #dfe6e2;border-radius:12px;background:#fff;align-items:flex-start}
      .source-discovery-card input{margin-top:3px}
      .source-discovery-card span{display:grid;gap:4px;min-width:0}
      .source-discovery-card strong{font-size:14px;color:#18251f}
      .source-discovery-card small{font-size:12px;line-height:1.4;color:#6b7773}
      .source-discovery-card code{font-size:11px;color:#006957;overflow-wrap:anywhere}
      .source-map-group{margin-top:14px}.source-map-group h5{margin:0;font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#006957}
      .source-discovery-empty{padding:12px;color:#697571;font-size:14px}
      @media(max-width:900px){.research-actions{grid-template-columns:1fr!important}.research-mode-choice{width:100%}.research-mode-choice>button{min-height:118px}.research-mode-description{max-width:none}.source-discovery-list,.pre-research-context{grid-template-columns:1fr}}
    `;
    root.document.head.appendChild(style);
  }

  function suppressLegacySuggestions(root){
    try{
      if(root.LeadIntelMarket?.buildSuggestedSources&&!root.LeadIntelMarket.__liveSourceDiscoveryOwned){
        root.LeadIntelMarket.buildSuggestedSources=()=>[];
        root.LeadIntelMarket.__liveSourceDiscoveryOwned=true;
      }
    }catch{}
  }

  function ensureModeChoices(root){
    const parent=root.document.querySelector(".research-actions");if(!parent)return;
    const selected=normalizeMode(readState(root)?.market?.researchMode);
    for(const [mode,id] of Object.entries(BUTTONS)){
      const button=root.document.getElementById(id);if(!button)continue;
      const view=MODE_COPY[mode];
      let wrapper=button.closest(".research-mode-choice");
      if(!wrapper){wrapper=root.document.createElement("div");wrapper.className="research-mode-choice";button.before(wrapper);wrapper.appendChild(button);}
      wrapper.dataset.researchMode=mode;wrapper.classList.toggle("is-selected",mode===selected);
      let desc=wrapper.querySelector(".research-mode-description");if(!desc){desc=root.document.createElement("div");desc.className="research-mode-description";wrapper.appendChild(desc);}
      if(desc.textContent!==view.description)desc.textContent=view.description;
      if(!/^Researching…$/i.test(clean(button.textContent))){
        const badge=view.badge?`<span class="research-mode-badge">${esc(view.badge)}</span>`:"";
        const markup=`<span class="research-mode-title">${esc(view.label)}</span>${badge}`;
        if(button.innerHTML!==markup)button.innerHTML=markup;
      }
      button.setAttribute("aria-pressed",mode===selected?"true":"false");
      if(button.getAttribute("aria-describedby")!==`${id}-description`)button.setAttribute("aria-describedby",`${id}-description`);
      if(desc.id!==`${id}-description`)desc.id=`${id}-description`;
    }
  }

  function cleanPreResearchCards(root){
    const state=readState(root),profile=state.profile||{};
    const markets=splitList(profile.targetMarkets||profile.currentMarkets||state.targetMarkets);
    root.document.querySelectorAll(".opportunity-card.unresearched").forEach((card,index)=>{
      card.querySelector(".opportunity-total")?.remove();
      const title=card.querySelector("h4");
      const view=marketCardView({market:markets[index]||markets[0]||"Selected market",profileOnly:true},profile);
      if(title&&title.textContent!==view.market)title.textContent=view.market;
      let context=card.querySelector(".pre-research-context");if(!context){context=root.document.createElement("div");context.className="pre-research-context";(title?.parentElement||card).appendChild(context);}
      const focus=view.commercialFocus||"Commercial focus not yet defined";const customer=view.targetCustomers||"Target customers not yet defined";
      const html=`<div><small>Commercial focus</small><span>${esc(focus)}</span></div><div><small>Target customers</small><span>${esc(customer)}</span></div>`;
      if(context.innerHTML!==html)context.innerHTML=html;
    });
  }

  async function waitForBridge(root,timeoutMs=3000){
    const started=Date.now();
    while(Date.now()-started<timeoutMs){
      if(root.LeadIntelServerBridge)return root.LeadIntelServerBridge;
      await new Promise(resolve=>root.setTimeout(resolve,50));
    }
    return root.LeadIntelServerBridge||null;
  }

  async function discoverSources(root,mode){
    const state=readState(root),profile={...(state.profile||{})},market=state.market||{};
    if(!profile.targetMarkets&&state.targetMarkets)profile.targetMarkets=state.targetMarkets;
    const queries=buildSourceDiscoveryQueries(profile,market,mode);
    if(!queries.length)return {items:[],unavailable:false};
    const bridge=await waitForBridge(root);
    if(!bridge?.session?.authenticated||!bridge?.workspace?.id)return {items:[],unavailable:true,reason:"Sign in to discover specific market sources."};
    const payloads=[];
    for(const query of queries){
      try{
        const response=await root.fetch(`${API_BASE}/api/ai/web-search?workspace_id=${encodeURIComponent(bridge.workspace.id)}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({query,max_results:5})});
        const payload=await response.json().catch(()=>({}));
        if(!response.ok){if(response.status===409)return {items:[],unavailable:true,reason:"OpenAI web-search source discovery is unavailable for this workspace."};continue;}
        payloads.push(payload);
      }catch{}
    }
    return {items:normalizeDiscoveredSources(payloads,mode),unavailable:false};
  }

  let discoveryGeneration=0;
  async function updatePreviewSources(root){
    const preview=root.document.getElementById("research-run-preview");if(!preview||preview.hidden)return;
    const state=readState(root),mode=normalizeMode(state.market?.researchMode);const policy=sourceDiscoveryPolicy(mode);
    const block=preview.querySelector(".research-suggested-block");if(!block)return;
    const list=root.document.getElementById("research-suggested-sources"),add=root.document.getElementById("add-suggested-sources");
    const heading=block.querySelector("div>span"),help=block.querySelector("div>small");
    if(mode==="quick"){
      block.hidden=false;if(heading)heading.textContent="Sources selected automatically";if(help)help.textContent="Market Scan chooses the strongest available source categories and sites automatically. No specific sites are pre-recommended.";
      if(list)list.innerHTML='<div class="source-discovery-status">Automatic source selection · no site-selection step is required for Market Scan.</div>';if(add)add.hidden=true;return;
    }
    block.hidden=false;if(add)add.hidden=false;
    if(heading)heading.textContent=policy.grouped?"Source Intelligence Map":"Live source discovery";
    if(help)help.textContent=policy.grouped?"LeadIntel is identifying and grouping the most relevant source sites for this market before the full investigation starts.":"LeadIntel is identifying relevant source sites for this market before the full research starts.";
    if(list)list.innerHTML='<div class="source-discovery-status">Discovering relevant market sources…</div>';
    const generation=++discoveryGeneration;const result=await discoverSources(root,mode);if(generation!==discoveryGeneration||preview.hidden)return;
    if(result.unavailable){if(list)list.innerHTML=`<div class="source-discovery-status">Source discovery unavailable. ${esc(result.reason||"")} LeadIntel will use the selected source categories; no specific sites have been pre-recommended.</div>`;if(add)add.hidden=true;return;}
    if(list)list.innerHTML=renderDiscoveredSources(result.items,mode);if(add)add.hidden=!result.items.length;
  }

  function install(root){
    if(!root?.document)return false;if(root.__LeadIntelMarketResearchUxInstalled)return true;root.__LeadIntelMarketResearchUxInstalled=true;
    injectCss(root);
    const refresh=()=>{suppressLegacySuggestions(root);ensureModeChoices(root);cleanPreResearchCards(root);};
    const start=()=>{
      refresh();
      const docObserver=new root.MutationObserver(mutations=>{
        const preview=root.document.getElementById("research-run-preview");
        const opened=mutations.some(mutation=>mutation.type==="attributes"&&mutation.attributeName==="hidden"&&mutation.target===preview&&!preview?.hidden);
        refresh();if(opened)void updatePreviewSources(root);
      });
      docObserver.observe(root.document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
      root.document.addEventListener("click",event=>{if(event.target?.closest?.("#run-market-research,#run-detailed-research,#run-market-intelligence"))root.setTimeout(()=>void updatePreviewSources(root),0);});
    };
    if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",start,{once:true});else start();
    return true;
  }

  return {MODE_COPY,sourceDiscoveryPolicy,buildSourceDiscoveryQueries,classifySource,normalizeDiscoveredSources,marketCardView,renderDiscoveredSources,discoverSources,install};
});
