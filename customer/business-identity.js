(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelBusinessIdentity=api;if(root.document)api.install(root);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const STORAGE_KEY="leadintel_customer_v2_state";
  let originals=null;
  let installed=false;
  let layoutObserver=null;
  let layoutQueued=false;

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  const NAVIGATION_LABELS=[/\bUZZIN\\u0100T\s+VAIR\\u0100K\b/gi,/\b(?:LEARN|READ|VIEW)\s+MORE\b/gi,/\bGET\s+IN\s+TOUCH\b/gi,/\bCONTACT\s+US\b/gi];
  function stripNavigationNoise(value){
    return String(value??"").replace(new RegExp(NAVIGATION_LABELS.map(pattern=>pattern.source).join("|"),"gi")," ").replace(/\s+/g," ").trim();
  }
  function hasNavigationNoise(value){
    const text=String(value??"");
    return NAVIGATION_LABELS.some(pattern=>{pattern.lastIndex=0;return pattern.test(text);});
  }
  function stripNoise(value){
    return clean(String(value??"")
      .replace(/!\[[^\]]*\]\([^)]+\)/gi," ")
      .replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)]+\)/gi," $1 ")
      .replace(/https?:\/\/\S+/gi," ")
      .replace(/\b\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?\b/gi," ")
      .replace(/<[^>]+>/g," ")
      .replace(/[#*_`>|]/g," "))
      .replace(new RegExp(NAVIGATION_LABELS.map(pattern=>pattern.source).join("|"),"gi")," ");
  }
  function neutral(value){
    return stripNoise(value)
      .replace(/\bmy\b/gi,"the company's")
      .replace(/\bI\b/g,"the company")
      .replace(/^\s*we\s+/i,"the company ")
      .replace(/\bour\b/gi,"the company's")
      .replace(/\s+/g," ")
      .trim();
  }
  function sentence(value){const text=clean(value);return text&&!/[.!?]$/.test(text)?`${text}.`:text;}
  function lowerFirst(value){const text=clean(value);return text?text.charAt(0).toLowerCase()+text.slice(1):"";}
  function words(value){return clean(value).split(/\s+/).filter(Boolean);}
  function limitWords(value,max){const list=words(value);return list.length<=max?clean(value):`${list.slice(0,max).join(" ").replace(/[,:;.-]+$/,"")}…`;}
  function readStatus(input,id){return clean(input?.answerStatus?.[id]).toLowerCase();}
  function hasEvidence(input={}){return (input.scrapedSources||[]).some(item=>clean(item?.text))||(input.documents||[]).some(item=>clean(item?.text));}
  function identityValue(value){
    const text=neutral(value);
    return hasNavigationNoise(value)?"":text;
  }
  function splitOffers(value){return identityValue(value).replace(/\s*;\s*/g,", ");}

  function deriveIdentity(profile={},input={}){
    const company=neutral(profile.companyName)||"The company";
    const offers=splitOffers(profile.priorityOffers);
    const customer=identityValue(profile.idealCustomer);
    const outcomes=identityValue(profile.buyingOutcomes);
    const differentiation=identityValue(profile.differentiation);
    const diffStatus=readStatus(input,"differentiation");
    const diffConfirmed=Boolean(differentiation)&&diffStatus!=="draft"&&diffStatus!=="missing";

    const summary=[];
    if(offers)summary.push(`${company} is a business focused on ${lowerFirst(offers)}`);
    else if(profile.companyOverview)summary.push(neutral(profile.companyOverview));
    if(customer)summary.push(`It primarily serves ${lowerFirst(customer)}`);
    if(outcomes)summary.push(`Customers engage ${company} to ${lowerFirst(outcomes)}`);
    if(diffConfirmed)summary.push(`Its positioning is differentiated by ${lowerFirst(differentiation)}`);
    const businessSummary=limitWords(summary.map(sentence).join(" "),130);

    let uniqueSellingProposition="";
    let uspStatus="Proposed · confirmation recommended";
    if(customer&&outcomes&&offers){
      uniqueSellingProposition=`${company} helps ${lowerFirst(customer)} ${lowerFirst(outcomes)} through ${lowerFirst(offers)}`;
      if(diffConfirmed)uniqueSellingProposition+=`, differentiated by ${lowerFirst(differentiation)}`;
      uniqueSellingProposition=sentence(uniqueSellingProposition);
    }else if(customer&&offers){
      uniqueSellingProposition=sentence(`${company} serves ${lowerFirst(customer)} through ${lowerFirst(offers)}`);
    }else if(offers){
      uniqueSellingProposition=sentence(`${company} provides ${lowerFirst(offers)}`);
    }
    if(diffConfirmed){
      if(diffStatus==="user")uspStatus="Customer-confirmed";
      else if(diffStatus==="accepted")uspStatus="Evidence-backed · accepted";
      else uspStatus="Confirmed";
    }

    const pitch=[];
    if(customer&&outcomes)pitch.push(`We help ${lowerFirst(customer)} ${lowerFirst(outcomes)}`);
    else if(customer&&offers)pitch.push(`We help ${lowerFirst(customer)} through ${lowerFirst(offers)}`);
    else if(offers)pitch.push(`We provide ${lowerFirst(offers)}`);
    if(offers&&customer&&outcomes)pitch.push(`${company} provides ${lowerFirst(offers)}`);
    if(diffConfirmed)pitch.push(`Our approach is differentiated by ${lowerFirst(differentiation)}`);
    const elevatorPitch=limitWords(pitch.map(sentence).join(" "),90);

    const positioningInputs=[offers,customer,outcomes,diffConfirmed?differentiation:""] .filter(Boolean).length;
    const positioningConfidence=positioningInputs===4&&hasEvidence(input)?"High":positioningInputs>=3?"Medium":"Needs confirmation";
    return {businessSummary,uniqueSellingProposition,elevatorPitch,uspStatus,positioningConfidence};
  }

  function patchProfileEngine(engine,root=null){
    if(!engine||engine.__businessIdentityPatched)return engine;
    originals={buildCompanyIntelligenceProfile:engine.buildCompanyIntelligenceProfile,normalizeSavedState:engine.normalizeSavedState};
    engine.buildCompanyIntelligenceProfile=function(input={}){
      const profile=originals.buildCompanyIntelligenceProfile(input);
      return {...profile,...deriveIdentity(profile,input)};
    };
    engine.normalizeSavedState=function(value={}){
      const normalized=originals.normalizeSavedState(value);
      if(!normalized.profile||typeof normalized.profile!=="object")return normalized;
      for(const key of ["priorityOffers","idealCustomer","buyingOutcomes","differentiation"]){
        if(hasNavigationNoise(normalized.profile[key]))normalized.profile[key]="";
      }
      const identity=deriveIdentity(normalized.profile,normalized);
      for(const key of ["businessSummary","uniqueSellingProposition","elevatorPitch"]){
        if(!clean(normalized.profile[key])||hasNavigationNoise(normalized.profile[key]))normalized.profile[key]=identity[key];
      }
      if(!clean(normalized.profile.uspStatus))normalized.profile.uspStatus=identity.uspStatus;
      if(!clean(normalized.profile.positioningConfidence))normalized.profile.positioningConfidence=identity.positioningConfidence;
      return normalized;
    };
    engine.deriveBusinessIdentity=deriveIdentity;
    engine.__businessIdentityPatched=true;
    return engine;
  }

  function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function readState(root){try{return JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||"{}");}catch{return {};}}
  function injectStyles(root){
    if(root.document.getElementById("business-identity-style"))return;
    const style=root.document.createElement("style");style.id="business-identity-style";style.textContent=`
      #profile-editor.profile-identity-layout{display:block}
      .profile-identity-section{margin:0 0 22px;padding:22px;border:1px solid var(--line,#d8e0dc);border-radius:18px;background:rgba(255,255,255,.58)}
      .profile-identity-section.primary{background:rgba(232,244,239,.45);border-color:rgba(22,107,87,.24)}
      .profile-identity-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:16px}
      .profile-identity-head div{display:grid;gap:4px}
      .profile-identity-head span{font:600 12px/1.2 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--accent,#0f6b58)}
      .profile-identity-head strong{font-size:20px;color:var(--ink,#10231d)}
      .profile-identity-head p{margin:0;max-width:620px;color:var(--muted,#6f7d77);font-size:14px}
      .profile-identity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .profile-identity-grid .profile-field.wide,.profile-identity-grid .identity-wide{grid-column:1/-1}
      .profile-identity-section .profile-field{margin:0}
      .identity-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      .identity-meta span{display:inline-flex;align-items:center;padding:6px 9px;border:1px solid var(--line,#d8e0dc);border-radius:999px;font:600 11px/1 'IBM Plex Mono',monospace;color:var(--muted,#6f7d77);background:#fff}
      @media(max-width:820px){.profile-identity-grid{grid-template-columns:1fr}.profile-identity-head{display:grid}.profile-identity-grid .profile-field.wide,.profile-identity-grid .identity-wide{grid-column:auto}}
    `;root.document.head.appendChild(style);
  }
  function createField(root,key,label,value,readOnly,wide=true){
    const wrap=root.document.createElement("div");wrap.className=`profile-field ${wide?"wide":""} identity-${key}`;
    const lab=root.document.createElement("label");lab.htmlFor=`profile-${key}`;lab.textContent=label;
    const textarea=root.document.createElement("textarea");textarea.id=`profile-${key}`;textarea.dataset.profileField=key;textarea.rows=wide?3:2;textarea.readOnly=readOnly;textarea.value=clean(value);
    wrap.append(lab,textarea);return wrap;
  }
  function section(root,title,subtitle,primary=false){
    const node=root.document.createElement("section");node.className=`profile-identity-section${primary?" primary":""}`;node.dataset.profileIdentitySection=title.toLowerCase().replace(/\s+/g,"-");
    const head=root.document.createElement("div");head.className="profile-identity-head";head.innerHTML=`<div><span>${esc(title)}</span><strong>${esc(title)}</strong></div><p>${esc(subtitle)}</p>`;
    const grid=root.document.createElement("div");grid.className="profile-identity-grid";node.append(head,grid);return {node,grid};
  }
  function needsLayout(editor){
    if(!editor)return false;
    if(editor.querySelector(":scope > .profile-field"))return true;
    if(!editor.querySelector('[data-profile-field="businessSummary"]'))return true;
    if(!editor.querySelector('[data-profile-field="uniqueSellingProposition"]'))return true;
    if(!editor.querySelector('[data-profile-field="elevatorPitch"]'))return true;
    const outcomes=editor.querySelector('[data-profile-field="buyingOutcomes"]');
    if(outcomes&&!outcomes.closest('[data-profile-identity-section="commercial-context"]'))return true;
    return false;
  }
  function layoutProfile(root){
    const editor=root.document.getElementById("profile-editor");if(!editor||!needsLayout(editor))return;
    const state=readState(root);const profile=state.profile;if(!profile||typeof profile!=="object")return;
    const derived=root.LeadIntelProfile?.deriveBusinessIdentity?.(profile,state)||deriveIdentity(profile,state);
    const sample=editor.querySelector("textarea[data-profile-field]");const readOnly=sample?sample.readOnly:true;
    const existing=[...editor.querySelectorAll(".profile-field")];
    const byKey=new Map(existing.map(node=>[node.querySelector("[data-profile-field]")?.dataset.profileField,node]).filter(([key])=>key));
    const take=key=>byKey.get(key)||null;
    byKey.get("companyOverview")?.remove();byKey.delete("companyOverview");

    let summary=take("businessSummary");if(!summary)summary=createField(root,"businessSummary","Business summary",profile.businessSummary||derived.businessSummary,readOnly,true);
    let usp=take("uniqueSellingProposition");if(!usp)usp=createField(root,"uniqueSellingProposition","USP / value proposition",profile.uniqueSellingProposition||derived.uniqueSellingProposition,readOnly,true);
    let pitch=take("elevatorPitch");if(!pitch)pitch=createField(root,"elevatorPitch","Elevator pitch",profile.elevatorPitch||derived.elevatorPitch,readOnly,true);

    const business=section(root,"Business identity","A concise factual view of what the company does, what it sells and who it serves.",true);business.grid.append(summary);
    const positioning=section(root,"Commercial positioning","Why the ideal customer should choose this company instead of a credible alternative.");positioning.grid.append(usp);
    const diff=take("differentiation");if(diff)positioning.grid.append(diff);
    const meta=root.document.createElement("div");meta.className="identity-meta identity-wide";meta.innerHTML=`<span>${esc(profile.uspStatus||derived.uspStatus||"Proposed · confirmation recommended")}</span><span>${esc(profile.positioningConfidence||derived.positioningConfidence||"Needs confirmation")} confidence</span>`;positioning.grid.append(meta);
    const sales=section(root,"Sales message","A short persuasive explanation that can be used in conversation and adapted for outreach.");sales.grid.append(pitch);
    const context=section(root,"Commercial context","The confirmed inputs LeadIntel uses for targeting, qualification and signal discovery.");
    const contextOrder=["priorityOffers","idealCustomer","buyingOutcomes","lookalikeCustomers","decisionMakers","currentMarkets","targetMarkets","marketFocus","buyingTriggers","exclusions","opportunityValue","commercialObjective"];
    const used=new Set(["companyOverview","businessSummary","uniqueSellingProposition","elevatorPitch","differentiation"]);
    for(const key of contextOrder){const node=take(key);if(node){context.grid.append(node);used.add(key);}}
    for(const [key,node] of byKey){if(!used.has(key))context.grid.append(node);}

    editor.replaceChildren(business.node,positioning.node,sales.node,context.node);editor.classList.add("profile-identity-layout");
  }
  function queueLayout(root){if(layoutQueued)return;layoutQueued=true;setTimeout(()=>{layoutQueued=false;layoutProfile(root);},0);}
  function watchProfile(root){
    const editor=root.document.getElementById("profile-editor");if(!editor||typeof MutationObserver==="undefined")return;
    if(layoutObserver)layoutObserver.disconnect();layoutObserver=new MutationObserver(()=>queueLayout(root));layoutObserver.observe(editor,{childList:true,subtree:true});
  }
  function install(root){
    if(installed)return;installed=true;injectStyles(root);patchProfileEngine(root.LeadIntelProfile,root);watchProfile(root);queueLayout(root);
    root.addEventListener("leadintel:module-opened",event=>{if(Number(event.detail?.step)===3){setTimeout(()=>queueLayout(root),0);setTimeout(()=>queueLayout(root),80);}});
    root.addEventListener("leadintel:workspace-changed",()=>queueLayout(root));
    root.addEventListener("leadintel:server-ready",()=>queueLayout(root));
    root.document.getElementById("edit-profile")?.addEventListener("click",()=>setTimeout(()=>queueLayout(root),0));
  }

  return {deriveIdentity,patchProfileEngine,layoutProfile,install,hasNavigationNoise,stripNavigationNoise};
});
