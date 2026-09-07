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
  const CARD_GROUPS=Object.freeze({
    medium:Object.freeze(["priorityOffers","idealCustomer"]),
    compact:Object.freeze(["lookalikeCustomers","decisionMakers","currentMarkets","targetMarkets"]),
    deep:Object.freeze(["marketFocus","customerPainPoints","buyingTriggers","commercialObjective"])
  });
  let observer=null;
  let queued=false;

  function fieldNode(root,key){
    return root?.document?.querySelector?.(`[data-profile-field="${key}"]`)?.closest?.(".profile-field")||null;
  }

  function markCard(node,tier){
    if(!node)return;
    node.classList?.add?.("commercial-context-card",`commercial-context-${tier}`);
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
    for(const [tier,keys] of Object.entries(CARD_GROUPS))for(const key of keys)markCard(fieldNode(root,key),tier);

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
      .profile-identity-grid .commercial-context-card{
        min-width:0;min-height:0;align-self:stretch;display:grid;gap:10px;
      }
      .profile-identity-grid .commercial-context-card>label{
        align-self:start;margin:0;
      }
      .profile-identity-grid .commercial-context-card textarea,
      .profile-identity-grid .commercial-context-card .pain-points-rendered{
        width:100%;min-width:0;min-height:0;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;
        scrollbar-width:thin;scrollbar-color:#b8c1bd transparent;
      }
      .profile-identity-grid .commercial-context-card textarea::-webkit-scrollbar,
      .profile-identity-grid .commercial-context-card .pain-points-rendered::-webkit-scrollbar{width:7px}
      .profile-identity-grid .commercial-context-card textarea::-webkit-scrollbar-thumb,
      .profile-identity-grid .commercial-context-card .pain-points-rendered::-webkit-scrollbar-thumb{background:#b8c1bd;border-radius:999px}
      .profile-identity-grid .commercial-context-card textarea::-webkit-scrollbar-track,
      .profile-identity-grid .commercial-context-card .pain-points-rendered::-webkit-scrollbar-track{background:transparent}
      .profile-identity-grid .commercial-context-card textarea[readonly]{
        resize:none!important;background:#fff;border:1px solid var(--line,#d8e0dc);border-radius:12px;
        padding:14px 16px;color:var(--ink,#10231d);line-height:1.55;box-shadow:none;cursor:default;
      }
      .profile-identity-grid .commercial-context-card textarea:not([readonly]){resize:vertical}

      .profile-identity-grid .commercial-context-medium{
        grid-template-rows:auto 92px;min-height:138px;
      }
      .profile-identity-grid .commercial-context-compact{
        grid-template-rows:auto 58px;min-height:112px;
      }
      .profile-identity-grid .commercial-context-deep{
        grid-template-rows:auto 250px 28px;min-height:326px;
      }
      .profile-identity-grid .commercial-context-medium textarea{height:92px;max-height:92px}
      .profile-identity-grid .commercial-context-compact textarea{height:58px;max-height:58px}
      .profile-identity-grid .commercial-context-deep textarea,
      .profile-identity-grid .commercial-context-deep .pain-points-rendered{
        height:250px;max-height:250px;margin:0;padding:14px 16px;
      }
      .profile-identity-grid .commercial-context-deep .pain-points-note{
        align-self:end;justify-self:stretch;margin:0;min-height:28px;box-sizing:border-box;
      }
      .profile-identity-grid .commercial-context-half{grid-column:auto!important}

      @media(max-width:900px){
        .profile-identity-grid .commercial-context-half{grid-column:1/-1!important}
        .profile-identity-grid .commercial-context-deep{grid-template-rows:auto 220px 28px;min-height:296px}
        .profile-identity-grid .commercial-context-deep textarea,
        .profile-identity-grid .commercial-context-deep .pain-points-rendered{height:220px;max-height:220px}
      }
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

  return {COMMERCIAL_CONTEXT_PAIRS,CARD_GROUPS,applyLayout,install};
});
