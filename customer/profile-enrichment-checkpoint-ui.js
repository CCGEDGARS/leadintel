(()=>{
  "use strict";
  const MAIN_STORAGE_KEY="leadintel_customer_v2_state";
  const RESEARCH_META_KEY="leadintel_customer_v2_research_meta_v1";
  let bypassOnce=false;
  let returnFocus=null;

  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||"{}");}catch{return {};}}
  function model(){return window.LeadIntelProfileEnrichmentCheckpoint;}
  function domain(value){
    const raw=String(value||"").trim();
    if(!raw)return "";
    try{return new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).hostname.replace(/^www\./i,"").toLowerCase();}
    catch{return raw.replace(/^https?:\/\//i,"").replace(/^www\./i,"").split("/")[0].toLowerCase();}
  }
  function fallbackPending({website,researchMeta={},referenceCustomers={}}){
    const researchReady=Boolean(researchMeta.generatedAt&&domain(website)&&domain(website)===domain(researchMeta.website));
    const lookalikeReady=Boolean(referenceCustomers.activated&&referenceCustomers.dna&&Number(referenceCustomers.dna.activeCount)>0);
    return [!researchReady&&"company-research",!lookalikeReady&&"lookalike-audience"].filter(Boolean);
  }
  function pendingItems(){
    const state=readJson(MAIN_STORAGE_KEY);
    const input={website:state.website,researchMeta:readJson(RESEARCH_META_KEY),referenceCustomers:state.referenceCustomers};
    return model()?.pending(input)||fallbackPending(input);
  }

  function ensureDialog(){
    let modal=document.getElementById("profile-enrichment-checkpoint");
    if(modal)return modal;
    modal=document.createElement("div");
    modal.id="profile-enrichment-checkpoint";
    modal.className="profile-enrichment-checkpoint";
    modal.hidden=true;
    modal.innerHTML=`<div class="profile-enrichment-backdrop" data-enrichment-close></div>
      <section class="profile-enrichment-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-enrichment-title" aria-describedby="profile-enrichment-copy">
        <header><div><span class="eyebrow">Recommended before Step 3</span><h2 id="profile-enrichment-title">Improve your Intelligence Profile</h2><p id="profile-enrichment-copy">These optional steps give LeadIntel stronger evidence and a more accurate picture of the companies you want to win. You can complete them now or continue with the information already available.</p></div><button class="profile-enrichment-close" type="button" data-enrichment-close aria-label="Close">×</button></header>
        <div class="profile-enrichment-options">
          <article data-enrichment-item="company-research"><span class="profile-enrichment-number">01</span><div><h3>Research your company</h3><p>LeadIntel analyses your website and public evidence to strengthen your offers, customer problems, proof points and positioning.</p><em>Recommended · usually up to 1 minute</em></div><button class="secondary-btn" type="button" data-run-company-research>Run Company Research</button></article>
          <article data-enrichment-item="lookalike-audience"><span class="profile-enrichment-number">02</span><div><h3>Build a Lookalike Audience</h3><p>Add your best existing customers so LeadIntel can recognize shared patterns and prioritize similar companies in Discovery.</p><em>High impact · optional</em></div><button class="secondary-btn" type="button" data-build-lookalike>Build Lookalike Audience</button></article>
        </div>
        <footer><button class="secondary-btn" type="button" data-enrichment-close>Back</button><button class="primary-btn" type="button" data-continue-without-enrichment>Continue Without Enrichment <span aria-hidden="true">→</span></button></footer>
      </section>`;
    document.body.appendChild(modal);
    modal.addEventListener("click",handleDialogClick);
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!modal.hidden)closeDialog();});
    return modal;
  }

  function openDialog(pending,button){
    const modal=ensureDialog();returnFocus=button||document.activeElement;
    const companyResearchMissing=pending.includes("company-research");
    const lookalikeMissing=pending.includes("lookalike-audience");
    modal.querySelector('[data-enrichment-item="company-research"]').hidden=!companyResearchMissing;
    modal.querySelector('[data-enrichment-item="lookalike-audience"]').hidden=!lookalikeMissing;
    modal.hidden=false;document.body.classList.add("profile-enrichment-open");
    modal.querySelector("[data-enrichment-item]:not([hidden]) button, [data-continue-without-enrichment]")?.focus();
  }
  function closeDialog(){
    const modal=document.getElementById("profile-enrichment-checkpoint");if(!modal)return;
    modal.hidden=true;document.body.classList.remove("profile-enrichment-open");returnFocus?.focus?.();
  }
  function toast(message){const node=document.getElementById("toast");if(!node)return;node.textContent=message;node.classList.add("show");setTimeout(()=>node.classList.remove("show"),2600);}
  function clickAvailable(selector,fallback){
    const target=document.querySelector(selector);closeDialog();
    if(target){target.click();target.scrollIntoView?.({behavior:"smooth",block:"center"});}
    else toast(fallback);
  }
  function handleDialogClick(event){
    if(event.target.closest("[data-enrichment-close]")){closeDialog();return;}
    if(event.target.closest("[data-run-company-research]")){clickAvailable("#rerun-company-research","Company Research is still loading. Please try again.");return;}
    if(event.target.closest("[data-build-lookalike]")){clickAvailable("[data-reference-customers-manage]","Lookalike Audience is still loading. Please try again.");return;}
    if(event.target.closest("[data-continue-without-enrichment]")){
      const button=document.getElementById("analyze-company");closeDialog();bypassOnce=true;if(button)button.click();
    }
  }
  function interceptProfileAction(event){
    if(bypassOnce){bypassOnce=false;return;}
    const pending=pendingItems();if(!pending.length)return;
    event.preventDefault();event.stopImmediatePropagation();openDialog(pending,event.currentTarget);
  }
  function init(){
    const button=document.getElementById("analyze-company");if(!button||button.dataset.enrichmentCheckpointBound)return;
    button.dataset.enrichmentCheckpointBound="true";
    button.addEventListener("click",interceptProfileAction,true);
  }
  init();
})();
