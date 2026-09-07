(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelMarketResearchReviewUx=api;if(root.document)api.install(root);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const STORAGE_KEY="leadintel_customer_v2_state";
  const MODE_META=Object.freeze({
    quick:Object.freeze({depth:"Fast",capacity:"up to 20 evidence sources",summary:"Focused validation of the strongest active opportunities.",themes:["Strongest buying signals","Company growth & expansion","Sales-team hiring and change"]}),
    deep:Object.freeze({depth:"Detailed",capacity:"up to 80 evidence sources",summary:"Broader commercial research with live source discovery and cross-signal validation.",themes:["Active buying signals","Leadership changes","Hiring & team growth","Commercial transformation","Company expansion","Relevant market news"]}),
    intelligence:Object.freeze({depth:"Comprehensive",capacity:"up to 200 evidence sources",summary:"Widest investigation with a multi-source intelligence map and cross-source pattern detection.",themes:["Active buying signals","Leadership & hiring","Expansion & investment","Technology transformation","Competitor activity","Industry & specialist sources","Official & registry evidence","Cross-source patterns"]})
  });

  function readState(root){try{return JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||"{}");}catch{return {};}}
  function mode(root){const value=readState(root)?.market?.researchMode;return MODE_META[value]?value:"quick";}
  function esc(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}

  function injectCss(root){
    if(root.document.getElementById("market-research-review-ux-css"))return;
    const style=root.document.createElement("style");style.id="market-research-review-ux-css";
    style.textContent=`
      .research-plan-card{border:1px solid #dfe6e2;border-radius:12px;background:#f8faf8;padding:16px;margin-bottom:12px}
      .research-plan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px}
      .research-plan-head span,.research-plan-themes-title{font:600 11px 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#60706b}
      .research-plan-head strong{display:block;font-size:17px;color:#17241f;margin-top:4px}
      .research-plan-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .research-plan-badges b{font:600 11px 'IBM Plex Mono',monospace;border:1px solid #d6dfda;border-radius:999px;padding:7px 9px;background:#fff;color:#355047}
      .research-plan-summary{margin:0 0 13px;color:#53615d;font-size:14px;line-height:1.5}
      .research-plan-themes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
      .research-plan-theme{padding:9px 11px;border:1px solid #e1e7e3;border-radius:9px;background:#fff;font-size:13px;color:#26342f}
      .exact-searches{border-top:1px solid #e1e7e3;padding-top:12px}
      .exact-searches summary{cursor:pointer;font-weight:700;color:#0d6453;list-style:none;display:inline-flex;align-items:center;gap:7px}
      .exact-searches summary::-webkit-details-marker{display:none}.exact-searches summary::after{content:'↓';font-weight:600}
      .exact-searches[open] summary::after{content:'↑'}
      .exact-searches ol{margin-top:12px;color:#5c6864;font-size:12px;line-height:1.5;padding-left:22px}
      .source-discovery-complete{margin:0 0 10px;padding:9px 11px;border-radius:9px;background:#edf7f2;color:#176b57;font-weight:700;font-size:13px}
      @media(max-width:760px){.research-plan-head{display:block}.research-plan-badges{justify-content:flex-start;margin-top:10px}.research-plan-themes{grid-template-columns:1fr}}
    `;
    root.document.head.appendChild(style);
  }

  function enhanceResearchPlan(root){
    const preview=root.document.getElementById("research-run-preview");if(!preview||preview.hidden)return;
    const wrapper=preview.querySelector(".research-preview-queries");const list=root.document.getElementById("research-preview-queries");if(!wrapper||!list)return;
    const selected=mode(root),meta=MODE_META[selected];
    let card=wrapper.querySelector(".research-plan-card");
    if(!card){
      card=root.document.createElement("div");card.className="research-plan-card";
      wrapper.insertBefore(card,wrapper.firstChild);
      const oldLabel=[...wrapper.children].find(el=>el.tagName==="SPAN");if(oldLabel)oldLabel.hidden=true;
      let details=wrapper.querySelector("details.exact-searches");
      if(!details){details=root.document.createElement("details");details.className="exact-searches planned-searches";const summary=root.document.createElement("summary");summary.textContent="View exact searches";details.appendChild(summary);details.appendChild(list);wrapper.appendChild(details);}
    }
    card.innerHTML=`<div class="research-plan-head"><div><span>Research Plan</span><strong>${esc(meta.depth)} investigation</strong></div><div class="research-plan-badges"><b>${esc(meta.depth)}</b><b>${esc(meta.capacity)}</b></div></div><p class="research-plan-summary">${esc(meta.summary)}</p><div class="research-plan-themes-title">Investigation themes</div><div class="research-plan-themes">${meta.themes.map(item=>`<div class="research-plan-theme">${esc(item)}</div>`).join("")}</div>`;
  }

  function updateSourceCount(root){
    const list=root.document.getElementById("research-suggested-sources");if(!list)return;
    list.querySelector(".source-discovery-complete")?.remove();
    const cards=list.querySelectorAll(".source-discovery-card");
    if(!cards.length)return;
    const status=root.document.createElement("div");status.className="source-discovery-complete";status.textContent=`${cards.length} relevant sources found · review, include or exclude before starting.`;list.prepend(status);
  }

  function refresh(root){enhanceResearchPlan(root);updateSourceCount(root);}

  function install(root){
    if(!root?.document)return false;if(root.__LeadIntelMarketResearchReviewUxInstalled)return true;root.__LeadIntelMarketResearchReviewUxInstalled=true;injectCss(root);
    const scheduled=new WeakSet();
    const schedule=target=>{if(target&&scheduled.has(target))return;if(target)scheduled.add(target);root.setTimeout(()=>{if(target)scheduled.delete(target);refresh(root);},0);};
    root.document.addEventListener("click",event=>{
      if(event.target.closest?.("#run-market-research,#run-detailed-research,#run-market-intelligence,#edit-research-settings"))schedule(root.document.getElementById("research-run-preview"));
    });
    const preview=root.document.getElementById("research-run-preview");if(preview&&typeof root.MutationObserver!=="undefined"){
      const observer=new root.MutationObserver(()=>schedule(preview));observer.observe(preview,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
    }
    schedule(preview);return true;
  }

  return {MODE_META,enhanceResearchPlan,updateSourceCount,install};
});
