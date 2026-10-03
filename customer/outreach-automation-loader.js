(function(root){
'use strict';
let loadPromise=null;
function loadAutomation(){
  if(loadPromise)return loadPromise;
  loadPromise=Promise.all([
    import('./outreach-automation-bridge.js?v=20260930-contact-suppression-v1').then(()=>import('./outreach-automation-ui.js?v=20261002-settings-v5&approved-workflow=20261001-v1&qualification=20261003-qualified-v2')),
    import('./outreach-automation-delivery-handoff.js?v=20260930-contact-suppression-v1')
  ]).catch(error=>{loadPromise=null;console.error('[LeadIntel] Outreach automation failed to load',error);return [];});
  return loadPromise;
}
function maybeLoad(step){if(Number(step)===1||Number(step)===7)void loadAutomation();}
function init(){
  root.addEventListener?.('leadintel:module-opened',event=>maybeLoad(event.detail?.step));
  let current=1;try{current=Number(JSON.parse(localStorage.getItem('leadintel_customer_v2_state')||'{}').step)||1;}catch{}
  maybeLoad(current);
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
root.LeadIntelOutreachAutomationLoader={loadAutomation};
})(typeof window!=='undefined'?window:globalThis);
