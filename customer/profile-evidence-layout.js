(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelProfileEvidenceLayout=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const STYLE_ID="leadintel-profile-evidence-dashboard-style";

  function injectCss(doc=document){
    if(!doc||doc.getElementById(STYLE_ID))return;
    const style=doc.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .profile-lower-grid{grid-template-columns:1fr!important;gap:14px!important}
      .profile-evidence-panel,.profile-gaps-panel{min-width:0}
      .profile-evidence-panel .source-summary{margin-bottom:2px}
      .profile-evidence-panel .evidence-source-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px!important;align-items:stretch}
      .profile-evidence-panel .evidence-source-card{height:100%;display:flex;flex-direction:column}
      .profile-evidence-panel .evidence-source-card>p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:5;overflow:hidden;max-height:7.75em}
      .profile-evidence-panel .evidence-source-meta{margin-top:auto}
      .profile-gaps-panel{background:#fbfcfa}
      .profile-gaps-panel .section-title{max-width:760px}
      .profile-gaps-panel .gap-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin:16px 0 14px}
      .profile-gaps-panel .gap-item{min-width:0;padding:10px 12px;border:1px solid #e5e9e5;border-left:3px solid #d5b25e;border-radius:9px;background:#fff;line-height:1.45}
      .profile-gaps-panel .gap-item.good{border-left-color:#69a978}
      .profile-gaps-panel .text-btn{margin-top:2px}
      @media(max-width:980px){.profile-evidence-panel .evidence-source-list{grid-template-columns:1fr!important}}
      @media(max-width:760px){.profile-gaps-panel .gap-list{grid-template-columns:1fr!important}}
    `;
    doc.head.appendChild(style);
  }

  function apply(rootNode=document){
    if(!rootNode)return false;
    const grid=rootNode.querySelector?.(".profile-lower-grid");
    if(!grid)return false;
    const children=[...grid.children].filter(node=>node?.classList?.contains("panel"));
    if(children[0])children[0].classList.add("profile-evidence-panel");
    if(children[1])children[1].classList.add("profile-gaps-panel");
    return Boolean(children[0]||children[1]);
  }

  function install(doc=document){
    if(!doc)return false;
    injectCss(doc);
    const run=()=>apply(doc);
    if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",run,{once:true});else run();
    if(typeof MutationObserver!=="undefined"){
      const observer=new MutationObserver(()=>{if(!doc.querySelector(".profile-evidence-panel"))apply(doc);});
      observer.observe(doc.documentElement||doc,{childList:true,subtree:true});
    }
    return true;
  }

  if(typeof window!=="undefined"&&typeof document!=="undefined")install(document);
  return {STYLE_ID,injectCss,apply,install};
});
