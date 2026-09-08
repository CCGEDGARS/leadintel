(function(root){
'use strict';
let loadPromise=null;
function loadAutomation(){
  if(loadPromise)return loadPromise;
  loadPromise=Promise.all([
    import('./outreach-automation-bridge.js?v=20260908-outreach-auto-v1'),
    import('./outreach-automation-ui.js?v=20260908-outreach-auto-ui-v1'),
    import('./outreach-automation-delivery-handoff.js?v=20260908-outreach-auto-handoff-v1')
  ]).catch(error=>{loadPromise=null;console.error('[LeadIntel] Outreach automation failed to load',error);return [];});
  return loadPromise;
}
function maybeLoad(step){if(Number(step)===7)void loadAutomation();}
function init(){
  root.addEventListener?.('leadintel:module-opened',event=>{if(Number(event.detail?.step)===7)void loadAutomation();});
  let current=1;try{current=Number(JSON.parse(localStorage.getItem('leadintel_customer_v2_state')||'{}').step)||1;}catch{}
  maybeLoad(current);
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
root.LeadIntelOutreachAutomationLoader={loadAutomation};
})(typeof window!=='undefined'?window:globalThis);
