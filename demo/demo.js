(function installLeadIntelTour(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root?.document)api.mount(root.document);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const CALENDLY_URL="https://calendly.com/edgars-7go/strategy-call-2";
  const stages=[
    {
      title:"Company & Market",
      nav:"Company & Market",
      navHint:"Your company and target markets",
      headline:"Start with your company and the markets you want to reach.",
      summary:"Give LeadIntel a clear starting point: what your company does and where you want to find opportunities.",
      what:"Set your company website and choose the target markets for this workflow.",
      why:"A reliable source and a defined market help keep the research relevant to your business.",
      action:"Activate your main company website and select at least one country or region. Add brand details or supporting material when useful.",
      next:"LeadIntel researches your company and builds the commercial context for the next stage.",
      preview:{kicker:"STAGE 1 · COMPANY & MARKET",title:"Give LeadIntel a starting point",subtitle:"Company source and target market",stats:[["Main website","Public company source"],["Target market","Where to find opportunities"],["Company materials","Optional evidence"]],panels:[["Website","Your company website is the primary public source for research."],["Markets","Choose one or more markets for the workflow."]]}
    },
    {
      title:"Commercial Context",
      nav:"Commercial Context",
      navHint:"Targeting, signals and campaign brief",
      headline:"Explain the commercial reality behind your offer.",
      summary:"Describe the customers you help, the outcomes they need, and the events that can create demand.",
      what:"Capture your offer, customer problem, ideal buyers, observable buying signals and campaign context.",
      why:"Clear commercial context gives research and messaging a reason to focus on the right opportunities.",
      action:"Review the guided questions, add what you know, and choose a research depth that fits the evidence you need.",
      next:"LeadIntel uses this context to prepare an evidence-backed Intelligence Profile for your review.",
      preview:{kicker:"STAGE 2 · COMMERCIAL CONTEXT",title:"Describe the buying situation",subtitle:"Targeting, signals and campaign brief",stats:[["Customer problem","The job buyers need done"],["Buying signals","Events that can precede demand"],["Campaign brief","What the conversation should focus on"]],panels:[["Customer outcomes","A short description of the change buyers want."],["Observable events","Expansion, hiring, tenders or other relevant triggers."]]}
    },
    {
      title:"Intelligence Profile",
      nav:"Intelligence Profile",
      navHint:"Evidence-backed company profile",
      headline:"Review the picture LeadIntel builds about your company.",
      summary:"Bring company evidence and your commercial input together in one profile that can guide later decisions.",
      what:"The profile organizes your offer, strengths, customers, markets and relevant evidence into a working source of truth.",
      why:"Market Strategy and outreach need an accurate understanding of your business before they can be tailored.",
      action:"Review the evidence and interpretation, correct gaps, then approve the profile before building your strategy.",
      next:"Your approved profile becomes the foundation for ideal-customer targeting and market strategy.",
      preview:{kicker:"STAGE 3 · INTELLIGENCE PROFILE",title:"Review your commercial profile",subtitle:"Evidence and company context in one place",stats:[["Company evidence","Public and supplied sources"],["Core strengths","What differentiates your offer"],["Profile status","Review before approval"]],panels:[["What LeadIntel understands","Company, offer, customer outcome and proof."],["Evidence review","Check claims and fill in missing context."]]}
    },
    {
      title:"Market Strategy",
      nav:"Market Strategy",
      navHint:"Ideal customers, signals and opportunity",
      headline:"Turn company context into market decisions.",
      summary:"Shape who to pursue, what to watch for and where an opportunity may exist.",
      what:"Build and review ideal-customer profiles, buying signals and market opportunity hypotheses.",
      why:"A market strategy gives Company Discovery a clear direction and helps explain why a company may fit.",
      action:"Choose the customer groups that fit, review signal themes and verify the evidence behind each hypothesis.",
      next:"Approved targeting and signals guide the search and qualification work in Company Discovery.",
      preview:{kicker:"STAGE 4 · MARKET STRATEGY",title:"Decide who to pursue and why",subtitle:"ICPs, signals and opportunities",stats:[["Ideal customer","A company worth prioritizing"],["Buying signals","Observable reasons to act"],["Market view","Evidence-backed hypotheses"]],panels:[["Target profile","Define the companies that fit your offer."],["Signal focus","Review the events that may indicate demand."]]}
    },
    {
      title:"Company Discovery",
      nav:"Company Discovery",
      navHint:"Companies and decision-makers",
      headline:"Find companies that fit the strategy you approved.",
      summary:"Search the selected markets, check the evidence and identify the people who may own the relevant decision.",
      what:"Company Discovery finds and qualifies potential companies. You can also analyze existing customer websites to create a commercial profile and suggested customer groups.",
      why:"A profile based on customers you value can make search and prioritization more relevant. It is evidence to review, not a guarantee of fit.",
      action:"Add customers with websites, analyze the list, review the inferred group or groups, then activate only the segments that fit. A one-company profile is marked low confidence.",
      next:"The selected profile guides Discovery queries and ranking in your Step 1 market as a soft preference. It does not exclude other companies or add references to outreach.",
      preview:{kicker:"STAGE 5 · COMPANY DISCOVERY",title:"Review matching companies",subtitle:"Companies and decision-makers",stats:[["Company fit","Evidence for review"],["Market","Your selected target market"],["People","Relevant decision-maker roles"]],panels:[["Company evidence","Check why a company appears in the results."],["Decision-makers","Review role relevance and identity evidence."]],rows:[["Company","Market fit","Review status"],["Potential company","Signal and profile match","Review evidence"],["Potential company","Market and offer match","Check decision-makers"]]}
    },
    {
      title:"Campaign Studio",
      nav:"Campaign Studio",
      navHint:"Scenarios, scripts and approval",
      headline:"Turn company evidence into a relevant first message.",
      summary:"Build a campaign package around the opportunity, the buyer and the value you can credibly offer.",
      what:"Campaign Studio creates tailored scenarios, talking points and outreach drafts from approved company and market context.",
      why:"Specific, evidence-based communication makes it easier for a buyer to see why the conversation is relevant.",
      action:"Review the scenario and scripts, choose the communication language, make edits and approve the final package.",
      next:"Approval prepares the opportunity for delivery. Sending remains a separate, explicit action.",
      preview:{kicker:"STAGE 6 · CAMPAIGN STUDIO",title:"Build a message for this opportunity",subtitle:"Scenarios, scripts and approval",stats:[["Opportunity","Why this company may fit"],["Message","Value and evidence for the buyer"],["Approval","Review before delivery"]],panels:[["Opening idea","Connect a relevant signal to a buyer outcome."],["Draft status","Review and approve the campaign package."]]}
    },
    {
      title:"Delivery & Learning",
      nav:"Delivery & Learning",
      navHint:"Outreach, outcomes and learning",
      headline:"Deliver deliberately, record the outcome and learn.",
      summary:"Keep outreach under your control and make each response useful to the next decision.",
      what:"Send approved messages through connected tools, track replies and meetings, and record commercial outcomes.",
      why:"A consistent record helps your team understand what is working and what deserves a different approach.",
      action:"Review each approved message before sending. Update the opportunity when a reply, meeting or outcome occurs.",
      next:"Use the results to sharpen your targeting, evidence and next campaign. Or book a strategy call to map the workflow to your business.",
      preview:{kicker:"STAGE 7 · DELIVERY & LEARNING",title:"Keep outreach and outcomes connected",subtitle:"Delivery, replies and commercial learning",stats:[["Approved outreach","Ready for an explicit send"],["Responses","Replies and meetings"],["Learning","Outcomes for future decisions"]],panels:[["Delivery status","Messages stay reviewable and controlled."],["Commercial timeline","Record replies, meetings and next steps."]]}
    }
  ];

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function escapeHtml(value){return clean(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));}
  function normalizeIndex(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(stages.length-1,Math.floor(number))):0;}
  function screenMarkup(stage){
    const stats=(stage.preview.stats||[]).map(([title,description])=>`<div class="mock-stat"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></div>`).join("");
    const panels=(stage.preview.panels||[]).map(([title,description],index)=>`<section class="mock-panel"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p>${index===0?'<div class="mock-line"></div><div class="mock-line short"></div>':'<span class="mock-pill">For review</span><span class="mock-pill">Evidence-based</span>'}</section>`).join("");
    const rows=stage.preview.rows?`<div class="mock-table">${stage.preview.rows.map(row=>`<div class="mock-row">${row.map(item=>`<span>${escapeHtml(item)}</span>`).join("")}</div>`).join("")}</div>`:"";
    return `<div class="mock-topbar"><span class="mock-brand"><i class="mock-mark"></i>LeadIntel workspace</span><span class="mock-top-meta"><span>Workspace preview</span><span>Sample layout</span></span></div><div class="mock-body"><aside class="mock-side"><p class="mock-side-label">Workflow</p>${stages.map((item,index)=>`<div class="mock-side-row${item===stage?" active":""}">${String(index+1).padStart(2,"0")} &nbsp; ${escapeHtml(item.nav)}</div>`).join("")}</aside><section class="mock-content"><span class="mock-kicker">${escapeHtml(stage.preview.kicker)}</span><h3 class="mock-title">${escapeHtml(stage.preview.title)}</h3><p class="mock-subtitle">${escapeHtml(stage.preview.subtitle)}</p><div class="mock-stats">${stats}</div><div class="mock-columns">${panels}</div>${rows}<div class="mock-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></section></div>`;
  }
  function mount(doc){
    const nav=doc.getElementById("tour-stage-nav"),progress=doc.getElementById("progress-nav"),preview=doc.getElementById("workspace-preview");
    const previous=doc.getElementById("previous-stage"),next=doc.getElementById("next-stage");
    if(!nav||!progress||!preview)return;
    let activeIndex=0;
    nav.innerHTML=stages.map((stage,index)=>`<button class="stage-nav-button" type="button" data-tour-index="${index}"${index===0?' aria-current="step"':''}><span class="stage-nav-number">${String(index+1).padStart(2,"0")}</span><span class="stage-nav-copy"><strong>${escapeHtml(stage.nav)}</strong><small>${escapeHtml(stage.navHint)}</small></span></button>`).join("");
    progress.innerHTML=stages.map((stage,index)=>`<button class="progress-step" type="button" data-tour-index="${index}" aria-label="Stage ${index+1}: ${escapeHtml(stage.nav)}"${index===0?' aria-current="step"':''}><span class="progress-step-dot">${index+1}</span></button>`).join("");
    function render(){
      const stage=stages[activeIndex],number=String(activeIndex+1).padStart(2,"0"),last=activeIndex===stages.length-1;
      doc.getElementById("stage-kicker").textContent=`STAGE ${activeIndex+1} OF ${stages.length}`;
      doc.getElementById("progress-title").textContent=stage.title;
      doc.getElementById("progress-count").textContent=`${number} / ${String(stages.length).padStart(2,"0")}`;
      doc.getElementById("guide-kicker").textContent=`STAGE ${activeIndex+1} · ${stage.title.toUpperCase()}`;
      doc.getElementById("guide-title").textContent=stage.headline;
      doc.getElementById("guide-summary").textContent=stage.summary;
      doc.getElementById("guide-number").textContent=number;
      doc.getElementById("guide-what").textContent=stage.what;
      doc.getElementById("guide-why").textContent=stage.why;
      doc.getElementById("guide-action").textContent=stage.action;
      doc.getElementById("guide-next").textContent=stage.next;
      preview.innerHTML=screenMarkup(stage);
      doc.getElementById("profile-note").hidden=activeIndex!==4;
      doc.getElementById("final-callout").hidden=!last;
      previous.disabled=activeIndex===0;
      next.hidden=last;
      doc.getElementById("control-hint").textContent=last?"You’ve reached the end of the guided tour.":`Next: ${stages[activeIndex+1].title}`;
      for(const button of doc.querySelectorAll("[data-tour-index]")){
        if(Number(button.dataset.tourIndex)===activeIndex)button.setAttribute("aria-current","step");
        else button.removeAttribute("aria-current");
      }
    }
    function goTo(value){activeIndex=normalizeIndex(value);render();}
    nav.addEventListener("click",event=>{const button=event.target.closest("[data-tour-index]");if(button)goTo(button.dataset.tourIndex);});
    progress.addEventListener("click",event=>{const button=event.target.closest("[data-tour-index]");if(button)goTo(button.dataset.tourIndex);});
    previous.addEventListener("click",()=>goTo(activeIndex-1));
    next.addEventListener("click",()=>goTo(activeIndex+1));
    doc.addEventListener("keydown",event=>{
      if(event.altKey||event.ctrlKey||event.metaKey||event.target?.matches?.("input,textarea,select,[contenteditable=true]"))return;
      if(event.key==="ArrowLeft"&&activeIndex>0)goTo(activeIndex-1);
      if(event.key==="ArrowRight"&&activeIndex<stages.length-1)goTo(activeIndex+1);
    });
    render();
  }
  return {CALENDLY_URL,stages,normalizeIndex,mount};
});
