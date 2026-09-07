(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelCommercialContextLayout=api;if(root.document)api.install(root);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const COMMERCIAL_CONTEXT_PAIRS=Object.freeze([
    Object.freeze(["marketFocus","customerPainPoints"]),
    Object.freeze(["buyingTriggers","commercialObjective"])
  ]);
  let observer=null;
  let queued=false;

  function fieldNode(root,key){
    return root?.document?.querySelector?.(`[data-profile-field="${key}"]`)?.closest?.(".profile-field")||null;
  }

  function markHalf(node){
    if(!node)return;
    node.classList?.remove?.("wide","identity-wide");
    node.classList?.add?.("commercial-context-half");
  }

  function placeAfter(anchor,node){
    if(!anchor||!node)return;
    if(anchor.nextElementSibling===node)return;
    anchor.after?.(node);
  }

  function applyLayout(root){
    const marketFocus=fieldNode(root,"marketFocus");
    const painPoints=fieldNode(root,"customerPainPoints");
    const buyingTriggers=fieldNode(root,"buyingTriggers");
    const commercialObjective=fieldNode(root,"commercialObjective");
    if(!marketFocus||!painPoints||!buyingTriggers||!commercialObjective)return false;

    for(const node of [marketFocus,painPoints,buyingTriggers,commercialObjective])markHalf(node);
    placeAfter(marketFocus,painPoints);
    placeAfter(buyingTriggers,commercialObjective);
    return true;
  }

  function injectCss(root){
    const document=root?.document;if(!document?.head||document.getElementById?.("commercial-context-layout-css"))return;
    const style=document.createElement("style");
    style.id="commercial-context-layout-css";
    style.textContent=`
      .profile-identity-grid .commercial-context-half{grid-column:auto!important;min-width:0;align-self:stretch;display:flex;flex-direction:column}
      .profile-identity-grid .commercial-context-half textarea{flex:1;min-height:132px;resize:vertical}
      .profile-identity-grid .commercial-context-half .pain-points-rendered{flex:1;box-sizing:border-box}
      @media(max-width:900px){.profile-identity-grid .commercial-context-half{grid-column:1/-1!important}}
    `;
    document.head.appendChild(style);
  }

  function schedule(root){
    if(queued)return;queued=true;
    const run=()=>{queued=false;applyLayout(root);};
    if(typeof root.requestAnimationFrame==="function")root.requestAnimationFrame(run);else root.setTimeout?.(run,0);
  }

  function install(root){
    injectCss(root);
    applyLayout(root);
    if(observer||typeof root.MutationObserver!=="function")return;
    const target=root.document.getElementById?.("profile-editor")||root.document.body;
    if(!target)return;
    observer=new root.MutationObserver(()=>schedule(root));
    observer.observe(target,{childList:true,subtree:true});
    root.addEventListener?.("leadintel:module-opened",()=>schedule(root));
  }

  return {COMMERCIAL_CONTEXT_PAIRS,applyLayout,install};
});
