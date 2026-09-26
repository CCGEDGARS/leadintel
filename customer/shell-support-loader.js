const SUPPORT_MODULES=[
  './state-budget.js?v=20260826-state-budget-500kb',
  './website-input-sync.js?v=20260901-saved-state-v2',
  './custom-market-input-hygiene.js?v=20260903-password-manager-isolation-v5',
  './crm-engine.js?v=20260828-master-crm-v1',
  './sync-conflict-hygiene.js?v=20260901-stale-blank-conflict-v1',
  './service-settings-extension.js?v=20260925-provider-credit-health-v1',
  './step2-readiness-engine.js?v=20260924-friendly-workflow-labels-v1',
  './company-brain.js?v=20260924-workspace-profile-english-v1',
  './step2-first-party-intelligence.js?v=20260909-first-party-step2-v1',
  './firecrawl-workspace-router.js?v=20260914-spinner-hard-stop-v1&adaptive-evidence=1',
  './linkedin-signals.js?v=20260907-public-index-v1',
  './company-research-security.js?v=20260916-latency-fix-v2',
  './company-research-ui.js?v=20260926-guidance-status-v3',
  './company-profile-handoff.js?v=20260924-friendly-workflow-labels-v1',
  './reference-customers.js?v=20260924-reference-consensus-v1&target-segments=1',
  './reference-customer-table-detection.js?v=20260911-reference-missing-info-v1',
  './reference-customer-smart-import.js?v=20260923-reference-interface-v1',
  './reference-customer-ai.js?v=20260911-invalid-json-recovery-v1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1',
  './reference-customer-ui.js?v=20260924-reference-consensus-v1&opportunity-context=1&target-segments=1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1',
  './reference-customer-clear-list.js?v=20260923-reference-interface-v1',
  './reference-customer-website-enrichment.js?v=20260923-reference-interface-v1',
  './reference-customer-ai-runtime.js?v=20260926-profile-review-action-v3&target-research=1',
  './reference-customer-launcher.js?v=20260923-reference-interface-v1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1',
  './lookalike-discovery.js?v=20260924-reference-consensus-v1&opportunity-context=1',
  './intelligence-sources-ui.js?v=20260924-friendly-workflow-labels-v1&reset-center=1',
  './profile-action-runtime.js?v=20260924-friendly-workflow-labels-v1',
  './outreach-automation-loader.js?v=20260916-brand-outreach-v2'
];

async function loadSupportModules(){
  const crmResults=[];
  try{await import('./crm-presentation.js?v=20260924-crm-evidence-activity-v1');crmResults.push({status:'fulfilled'});}
  catch(reason){crmResults.push({status:'rejected',reason});}
  try{await import('./crm-ui.js?v=20260924-crm-evidence-activity-v1');crmResults.push({status:'fulfilled'});}
  catch(reason){crmResults.push({status:'rejected',reason});}
  const results=[...crmResults,...await Promise.allSettled(SUPPORT_MODULES.map(source=>import(source)))];
  const failed=results.filter(result=>result.status==='rejected');
  if(failed.length)console.warn(`LeadIntel: ${failed.length} optional module${failed.length===1?'':'s'} did not load.`,failed);
  window.dispatchEvent(new CustomEvent('leadintel:support-modules-ready',{detail:{loaded:results.length-failed.length,failed:failed.length}}));
}

window.addEventListener('load',()=>{void loadSupportModules();},{once:true});
