(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelMarketResearchGuard=api;if(root.document)api.install(root);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const STORAGE_KEY="leadintel_customer_v2_state";
  const PROFILE_CONTEXT_LABEL="Company profile context · not a market research result";
  const BUTTON_IDS=Object.freeze(["run-market-research","run-detailed-research","run-market-intelligence"]);
  const BUTTON_META=Object.freeze({
    "run-market-research":Object.freeze({mode:"quick",label:"Quick Overview"}),
    "run-detailed-research":Object.freeze({mode:"deep",label:"Market Research"}),
    "run-market-intelligence":Object.freeze({mode:"intelligence",label:"Deep Analysis"})
  });
  let activated=false;
  let observer=null;
  let queued=false;

  function injectCss(root){
    const document=root?.document;if(!document?.head||document.getElementById("market-research-guard-css"))return;
    const style=document.createElement("style");style.id="market-research-guard-css";
    style.textContent=`
      .research-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important;align-items:start!important}
      .research-mode-choice{display:grid!important;grid-template-rows:96px minmax(86px,auto)!important;gap:10px!important;width:100%!important;min-width:0!important}
      .research-mode-choice>button{box-sizing:border-box!important;width:100%!important;height:96px!important;min-height:96px!important;max-height:96px!important;margin:0!important;padding:16px 18px!important;align-self:start!important}
      .research-mode-description{box-sizing:border-box!important;margin:0!important;padding:0 6px!important;min-height:86px!important;max-width:none!important}
      .research-actions.research-mode-idle .research-mode-choice>button{background:#fff!important;color:#17241f!important;border:1px solid #d7dfda!important;box-shadow:none!important}
      .research-actions.research-mode-activated .research-mode-choice>button{background:#fff!important;color:#17241f!important;border:1px solid #d7dfda!important;box-shadow:none!important}
      .research-actions.research-mode-activated .research-mode-choice.research-mode-selected>button{background:#10231c!important;color:#fff!important;border-color:#10231c!important;box-shadow:0 10px 24px rgba(16,35,28,.10)!important}
      .profile-context-note{margin:10px 0 0;font:600 11px/1.35 'IBM Plex Mono',monospace;letter-spacing:.035em;color:#6b7773;text-transform:uppercase}
      @media(max-width:900px){.research-actions{grid-template-columns:1fr!important}.research-mode-choice{grid-template-rows:76px auto!important}.research-mode-choice>button{height:76px!important;min-height:76px!important;max-height:76px!important}.research-mode-description{min-height:0!important}}
    `;
    document.head.appendChild(style);
  }

  function actions(root){return root?.document?.querySelector?.(".research-actions")||null;}
  function preview(root){return root?.document?.getElementById?.("research-run-preview")||null;}
  function readState(root){try{return JSON.parse(root?.localStorage?.getItem?.(STORAGE_KEY)||"{}");}catch{return {};}}
  function runningButtonId(root){
    const market=readState(root)?.market||{};if(market.researchStatus!=="running")return "";
    return BUTTON_IDS.find(id=>BUTTON_META[id].mode===market.researchMode)||"run-market-research";
  }

  function hidePreview(panel){
    if(!panel)return;
    if(!panel.hidden)panel.hidden=true;
    panel.setAttribute?.("aria-hidden","true");
  }

  function setIdle(root){
    activated=false;
    const group=actions(root);if(group){group.classList.add("research-mode-idle");group.classList.remove("research-mode-activated");}
    for(const id of BUTTON_IDS){const button=root.document.getElementById(id);button?.closest?.(".research-mode-choice")?.classList?.remove?.("research-mode-selected");button?.setAttribute?.("aria-pressed","false");}
    hidePreview(preview(root));
  }

  function setActivated(root,id){
    activated=true;
    const group=actions(root);if(group){group.classList.remove("research-mode-idle");group.classList.add("research-mode-activated");}
    for(const buttonId of BUTTON_IDS){const button=root.document.getElementById(buttonId);const selected=buttonId===id;button?.closest?.(".research-mode-choice")?.classList?.toggle?.("research-mode-selected",selected);button?.setAttribute?.("aria-pressed",selected?"true":"false");}
  }

  function syncRunningState(root){
    const activeId=runningButtonId(root);if(!activeId)return false;
    setActivated(root,activeId);
    for(const id of BUTTON_IDS){
      const button=root.document.getElementById(id);if(!button)continue;
      button.disabled=true;
      const label=id===activeId?"Researching…":BUTTON_META[id].label;
      if(button.textContent!==label)button.textContent=label;
    }
    return true;
  }

  function protectPreview(root){
    const panel=preview(root);if(!panel)return;
    if(!activated)hidePreview(panel);
    else if(!panel.hidden)panel.removeAttribute?.("aria-hidden");
  }

  function labelProfileContext(root){
    root.document.querySelectorAll?.(".opportunity-card.unresearched").forEach(card=>{
      const context=card.querySelector?.(".pre-research-context");if(!context)return;
      let note=card.querySelector?.(".profile-context-note");
      if(!note){note=root.document.createElement("div");note.className="profile-context-note";context.before?.(note);}
      if(note.textContent!==PROFILE_CONTEXT_LABEL)note.textContent=PROFILE_CONTEXT_LABEL;
    });
  }

  function refresh(root){syncRunningState(root);protectPreview(root);labelProfileContext(root);}
  function schedule(root){if(queued)return;queued=true;const run=()=>{queued=false;refresh(root);};if(typeof root.requestAnimationFrame==="function")root.requestAnimationFrame(run);else root.setTimeout?.(run,0);}

  function install(root){
    if(!root?.document)return false;if(root.__LeadIntelMarketResearchGuardInstalled)return true;root.__LeadIntelMarketResearchGuardInstalled=true;
    injectCss(root);setIdle(root);refresh(root);
    root.document.addEventListener?.("click",event=>{
      const target=event.target?.closest?.("button,a,[role='button']")||event.target;
      const id=target?.id||"";
      if(BUTTON_IDS.includes(id)){setActivated(root,id);root.setTimeout?.(()=>refresh(root),0);return;}
      const panel=target?.closest?.("#research-run-preview");
      if(panel&&/^close$/i.test(String(target?.textContent||"").trim())){setIdle(root);}
    },true);
    if(typeof root.MutationObserver==="function"){
      observer=new root.MutationObserver(()=>schedule(root));
      observer.observe(root.document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","class"]});
    }
    root.addEventListener?.("leadintel:module-opened",()=>{if(!syncRunningState(root))setIdle(root);schedule(root);});
    return true;
  }

  return {STORAGE_KEY,BUTTON_IDS,BUTTON_META,install,setIdle,setActivated,runningButtonId,syncRunningState,protectPreview};
});
