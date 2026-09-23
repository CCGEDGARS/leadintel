(function installLeadIntelTour(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root?.document)api.mount(root.document);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const CALENDLY_URL="https://calendly.com/edgars-7go/strategy-call-2";
  const stages=[
    {
      title:"Setup",
      nav:"Setup",
      navHint:"Company details and target markets",
      headline:"Give LeadIntel a clear starting point.",
      summary:"Add your company website and choose where you want to find opportunities.",
      what:"Set up the company source and markets LeadIntel will use in the workflow.",
      why:"A reliable source and a defined market help keep research relevant to your business.",
      action:"Activate your main company website and select at least one country or region. Add brand details or supporting material when useful.",
      next:"LeadIntel researches your company and prepares the Profile.",
      preview:{kicker:"STAGE 1 · SETUP",title:"Start with your company and market",subtitle:"Website and target markets",stats:[["Main website","Public company source"],["Target market","Where to find opportunities"],["Company materials","Optional evidence"]],panels:[["Website","Your company website is the primary public source for research."],["Markets","Choose one or more markets for the workflow."]]}
    },
    {
      title:"Profile",
      nav:"Profile",
      navHint:"Company evidence, customers and outcomes",
      headline:"Describe the customers you help and the outcomes they need.",
      summary:"Briefly describe your customers, the outcomes they need, and the events that can create demand. AI brings company evidence and your commercial input together in one profile to guide smart decisions and effective communication.",
      what:"Share who you serve, the problems they need to solve, the results they want, and the events that can signal demand.",
      why:"Your commercial input gives AI the context to interpret company evidence and build a useful profile.",
      action:"Review the research and guided questions. Correct anything inaccurate, fill in missing context, and approve the profile.",
      next:"Your profile helps shape who to pursue, what to watch for, and where opportunities may exist.",
      preview:{kicker:"STAGE 2 · PROFILE",title:"Bring company evidence and customer context together",subtitle:"A reviewed profile for smarter decisions",stats:[["Customer outcomes","What buyers need to achieve"],["Company evidence","Public and supplied sources"],["Profile status","Review before approval"]],panels:[["Commercial input","Describe customers, outcomes and demand events."],["Evidence review","Check claims and fill in missing context."]]}
    },
    {
      title:"Strategy",
      nav:"Strategy",
      navHint:"Who to pursue and what to watch for",
      headline:"Choose where to focus.",
      summary:"AI helps shape who to pursue, what to watch for, and where opportunities may exist.",
      what:"Set ideal customer profiles, activate relevant buying signals, and review market evidence.",
      why:"An approved strategy gives the company search clear fit and demand signals to evaluate.",
      action:"Choose the customer groups that fit, review signal themes, and approve the evidence-backed strategy.",
      next:"LeadIntel searches your selected markets for companies that fit the strategy you approved.",
      preview:{kicker:"STAGE 3 · STRATEGY",title:"Decide who to pursue and why",subtitle:"Ideal customers, signals and opportunities",stats:[["Ideal customer","A company worth prioritizing"],["Buying signals","Observable reasons to act"],["Market view","Evidence-backed hypotheses"]],panels:[["Target profile","Define the companies that fit your offer."],["Signal focus","Review the events that may indicate demand."]]}
    },
    {
      title:"Companies",
      nav:"Companies",
      navHint:"Find companies that fit your strategy",
      headline:"Find companies that fit your strategy.",
      summary:"AI searches your selected markets, checks the evidence, and identifies companies that fit the strategy you approved.",
      what:"LeadIntel finds and qualifies potential companies. You can also analyze existing customer websites to create a commercial profile and suggested customer groups.",
      why:"A profile based on customers you value can make search and prioritization more relevant. It is evidence to review, not a guarantee of fit.",
      action:"When useful, add customers with websites, analyze them, review the inferred group or groups, and activate only the segments that fit. A one-company profile is marked low confidence. Then review company evidence and save the best opportunities.",
      next:"Approved reference customers guide Companies search and ranking in the selected market as a soft preference. They do not exclude other companies or enter outreach. For a company you want to pursue, identify the people responsible for the relevant buying decision.",
      preview:{kicker:"STAGE 4 · COMPANIES",title:"Review companies that match your strategy",subtitle:"Evidence and market fit",stats:[["Company fit","Evidence for review"],["Market","Your selected target market"],["Status","Potential opportunity"]],panels:[["Company evidence","Check why a company appears in the results."],["Market fit","Review the evidence before saving an opportunity."]],rows:[["Company","Market fit","Review status"],["Potential company","Signal and profile match","Review evidence"],["Potential company","Market and offer match","Save to continue"]]}
    },
    {
      title:"Buyers",
      nav:"Buyers",
      navHint:"Identify and qualify relevant people",
      headline:"Find the people behind the buying decision.",
      summary:"LeadIntel qualifies relevant buyers and turns company evidence into a clear path to a relevant first message.",
      what:"Identify relevant buyer roles and qualify people using company, role and decision evidence.",
      why:"Knowing who owns or influences the decision helps make the next message relevant to the right person.",
      action:"Review buyer roles and the evidence behind each match. Confirm the relevant people before moving to Messages.",
      next:"LeadIntel uses company evidence and buyer context to help prepare a relevant first message.",
      preview:{kicker:"STAGE 5 · BUYERS",title:"Identify the people who own the decision",subtitle:"Buyer roles and evidence",stats:[["Relevant roles","Who may own the decision"],["Company context","Why this person may matter"],["Evidence","Review before messaging"]],panels:[["Buyer relevance","Check role fit and available evidence."],["Next step","Use verified context to shape a message."]],rows:[["Buyer","Relevant role","Review status"],["Potential buyer","Role and company match","Review evidence"],["Potential buyer","Decision owner hypothesis","Confirm relevance"]]}
    },
    {
      title:"Messages",
      nav:"Messages",
      navHint:"Turn company evidence into relevant messages",
      headline:"Prepare a relevant first message.",
      summary:"AI turns company and buyer evidence into a relevant first message for your review.",
      what:"Build a message approach and tailored scripts from approved company, strategy and buyer context.",
      why:"Specific, evidence-based communication helps the buyer see why a conversation is relevant.",
      action:"Review the message approach and draft, adjust language and tone, then approve the package.",
      next:"Approval prepares the message for delivery. You decide when to send.",
      preview:{kicker:"STAGE 6 · MESSAGES",title:"Build a message for this opportunity",subtitle:"Approach, draft and approval",stats:[["Opportunity","Why this company may fit"],["Message","Value and evidence for the buyer"],["Approval","Review before delivery"]],panels:[["Opening idea","Connect a relevant signal to a buyer outcome."],["Draft status","Review and approve the message package."]]}
    },
    {
      title:"Delivery",
      nav:"Delivery",
      navHint:"Send, record outcomes and learn",
      headline:"Deliver deliberately and learn from every outcome.",
      summary:"Set up meetings, record outcomes, and use what happens to improve the next cycle.",
      what:"Send approved messages, record replies and meetings, and keep commercial outcomes in one place.",
      why:"A consistent record shows which approaches create progress and what deserves a different approach.",
      action:"Review every message before sending. Log replies, meetings and the commercial outcome.",
      next:"Use what you learn to improve the next strategy and messages. Or book a strategy call to map the workflow to your business.",
      preview:{kicker:"STAGE 7 · DELIVERY",title:"Keep messages and outcomes connected",subtitle:"Delivery, replies and commercial learning",stats:[["Approved messages","Ready for an explicit send"],["Responses","Replies and meetings"],["Learning","Outcomes for future decisions"]],panels:[["Delivery status","Messages stay reviewable and controlled."],["Commercial timeline","Record replies, meetings and next steps."]]}
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
