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
  const NAVIGATION_LABELS=[/\bUZZINĀT\s+VAIRĀK\b/gi,/\b(?:LEARN|READ|VIEW)\s+MORE\b/gi,/\bGET\s+IN\s+TOUCH\b/gi,/\bCONTACT\s+US\b/gi];
  const NAVIGATION_FRAGMENTS=[/\bRealizētie\s+projekti\b/i,/\bUzņēmumi,?\s+kas\s+izvēlas(?:\s+mūsu)?\s+risinājumus\b/i,/\bCase\s+studies\b/i,/\bCompanies\s+that\s+choose\s+us\b/i];
  function stripNavigationNoise(value){
    return String(value??"").replace(new RegExp(NAVIGATION_LABELS.map(pattern=>pattern.source).join("|"),"gi")," ").replace(/\s+/g," ").trim();
  }
  function hasNavigationNoise(value){
    const text=String(value??"");
    return NAVIGATION_LABELS.some(pattern=>{pattern.lastIndex=0;return pattern.test(text);})||NAVIGATION_FRAGMENTS.some(pattern=>pattern.test(text));
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
  function scorePercent(values){return Math.round(values.filter(Boolean).length/values.length*100);}
  function deriveAnalysis(profile={},input={},context={}){
    const company=context.company||identityValue(profile.companyName)||"The company";
    const offers=context.offers||splitOffers(profile.priorityOffers);
    const customer=context.customer||identityValue(profile.idealCustomer);
    const outcomes=context.outcomes||identityValue(profile.buyingOutcomes);
    const differentiation=context.differentiation||identityValue(profile.differentiation);
    const buyers=identityValue(profile.decisionMakers);
    const evidence=hasEvidence(input);
    const status=readStatus(input,"differentiation")==="user"||readStatus(input,"differentiation")==="accepted"?"Confirmed":"Proposed · confirmation recommended";
    const positioningStatement=customer&&offers&&outcomes
      ? `For ${lowerFirst(customer)}, ${company} provides ${lowerFirst(offers)} to ${lowerFirst(outcomes)}.`
      : `The positioning hypothesis for ${company} requires confirmation of the ideal customer, offer and commercial outcome.`;
    const frameworks={
      goldenCircle:{why:outcomes||"Clarify the customer outcome this company creates.",how:differentiation||"Clarify the approach or proof that makes the company preferable.",what:offers||"Clarify the priority product or service."},
      valueProposition:positioningStatement,
      fab:{features:offers||"Priority offer not confirmed.",advantages:differentiation||"Competitive advantage not confirmed.",benefits:outcomes||"Customer benefit not confirmed."}
    };
    const scores={
      commercialClarity:scorePercent([offers,customer,outcomes,differentiation]),
      icpSpecificity:scorePercent([customer,buyers,outcomes]),
      positioningStrength:scorePercent([offers,outcomes,differentiation]),
      evidenceConfidence:scorePercent([evidence,Boolean(input.scrapedSources?.length),Boolean(input.documents?.length)])
    };
    const diagnosis= scores.commercialClarity>=75
      ? "The commercial story is sufficiently defined for targeting and message development."
      : "The commercial story is still a working hypothesis. Confirm the missing inputs before treating the positioning as final.";
    return {status,positioningStatement,diagnosis,scores,frameworks};
  }

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
    const analysis=deriveAnalysis(profile,input,{company,offers,customer,outcomes,differentiation});
    if(!uniqueSellingProposition)uniqueSellingProposition=analysis.frameworks.valueProposition;
    return {businessSummary,uniqueSellingProposition,elevatorPitch,uspStatus,positioningConfidence,analysis};
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
      .profile-analysis-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .profile-analysis-card{padding:16px;border:1px solid var(--line,#d8e0dc);border-radius:14px;background:#fff;min-height:110px}
      .profile-analysis-card strong{display:block;color:var(--ink,#10231d);font-size:14px;margin-bottom:8px}
      .profile-analysis-card span{display:block;color:var(--muted,#6f7d77);font-size:13px;line-height:1.45}
      .profile-analysis-card .analysis-score{font:700 26px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent,#0f6b58);margin-bottom:8px}
      @media(max-width:1020px){.profile-analysis-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.profile-analysis-grid{grid-template-columns:1fr}}
      .identity-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      .identity-meta span{display:inline-flex;align-items:center;padding:6px 9px;border:1px solid var(--line,#d8e0dc);border-radius:999px;font:600 11px/1 'IBM Plex Mono',monospace;color:var(--muted,#6f7d77);background:#fff}
      @media(max-width:820px){.profile-identity-grid{grid-template-columns:1fr}.profile-identity-head{display:grid}.profile-identity-grid .profile-field.wide,.profile-identity-grid .identity-wide{grid-column:auto}}
    `;root.document.head.appendChild(style);
  }
  function createInsightCard(root,title,value,score){
    const node=root.document.createElement("div");node.className="profile-analysis-card";
    const heading=root.document.createElement("strong");heading.textContent=title;
    const text=root.document.createElement("span");text.textContent=clean(value)||"Needs confirmation.";
    node.append(heading);
    if(score!==undefined){const scoreNode=root.document.createElement("div");scoreNode.className="analysis-score";scoreNode.textContent=\`${score}%\`;node.append(scoreNode);}
    node.append(text);return node;
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
    const analysis=section(root,"Commercial analysis","What LeadIntel currently understands, how strong the evidence is, and what still requires confirmation.");
    const analysisData=derived.analysis||deriveAnalysis(profile,state);
    analysis.grid.classList.add("profile-analysis-grid");
    analysis.grid.append(
      createInsightCard(root,"Commercial clarity",analysisData.diagnosis,analysisData.scores?.commercialClarity),
      createInsightCard(root,"ICP specificity","How clearly the ideal customer, buyer and outcome are defined.",analysisData.scores?.icpSpecificity),
      createInsightCard(root,"Positioning strength","How clearly the offer, outcome and differentiation connect.",analysisData.scores?.positioningStrength),
      createInsightCard(root,"Evidence confidence","Coverage of website, documents and supporting evidence.",analysisData.scores?.evidenceConfidence),
      createInsightCard(root,"Positioning statement",analysisData.positioningStatement)
    );
    const frameworks=section(root,"Commercial frameworks","Structured models that turn the evidence into usable sales and marketing language.");
    frameworks.grid.classList.add("profile-analysis-grid");
    frameworks.grid.append(
      createInsightCard(root,"Golden Circle · Why",analysisData.frameworks?.goldenCircle?.why),
      createInsightCard(root,"Golden Circle · How",analysisData.frameworks?.goldenCircle?.how),
      createInsightCard(root,"Golden Circle · What",analysisData.frameworks?.goldenCircle?.what),
      createInsightCard(root,"Value proposition",analysisData.frameworks?.valueProposition),
      createInsightCard(root,"FAB · Features",analysisData.frameworks?.fab?.features),
      createInsightCard(root,"FAB · Advantages",analysisData.frameworks?.fab?.advantages),
      createInsightCard(root,"FAB · Benefits",analysisData.frameworks?.fab?.benefits)
    );
    const positioning=section(root,"Commercial positioning","Why the ideal customer should choose this company instead of a credible alternative.");positioning.grid.append(usp);
    const diff=take("differentiation");if(diff)positioning.grid.append(diff);
    const meta=root.document.createElement("div");meta.className="identity-meta identity-wide";meta.innerHTML=`<span>${esc(profile.uspStatus||derived.uspStatus||"Proposed · confirmation recommended")}</span><span>${esc(profile.positioningConfidence||derived.positioningConfidence||"Needs confirmation")} confidence</span>`;positioning.grid.append(meta);
    const sales=section(root,"Sales message","A short persuasive explanation that can be used in conversation and adapted for outreach.");sales.grid.append(pitch);
    const context=section(root,"Commercial context","The confirmed inputs LeadIntel uses for targeting, qualification and signal discovery.");
    const contextOrder=["priorityOffers","idealCustomer","buyingOutcomes","lookalikeCustomers","decisionMakers","currentMarkets","targetMarkets","marketFocus","buyingTriggers","exclusions","opportunityValue","commercialObjective"];
    const used=new Set(["companyOverview","businessSummary","uniqueSellingProposition","elevatorPitch","differentiation"]);
    for(const key of contextOrder){const node=take(key);if(node){context.grid.append(node);used.add(key);}}
    for(const [key,node] of byKey){if(!used.has(key))context.grid.append(node);}

    editor.replaceChildren(business.node,analysis.node,frameworks.node,positioning.node,sales.node,context.node);editor.classList.add("profile-identity-layout");
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
