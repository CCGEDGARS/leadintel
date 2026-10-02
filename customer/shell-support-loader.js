const SUPPORT_MODULES=[
  './state-budget.js?v=20260826-state-budget-500kb&research-sync=20261002-v1',
  './website-input-sync.js?v=20260930-setup-focus-v1',
  './custom-market-input-hygiene.js?v=20260903-password-manager-isolation-v5',
  './crm-engine.js?v=20260828-master-crm-v1&commercial-evidence=20261002-v2&buyer-quality=20261002-v3',
  './sync-conflict-hygiene.js?v=20260901-stale-blank-conflict-v1',
  './service-settings-extension.js?v=20260925-provider-credit-health-v1',
  './step2-readiness-engine.js?v=20260924-friendly-workflow-labels-v1&profile-review=20261001-v2&profile-repair=20261002-v1',
  './company-brain.js?v=20261001-adaptive-business-context-v1&profile-review=20261001-v2&profile-repair=20261002-v1',
  './step2-first-party-intelligence.js?v=20260909-first-party-step2-v1',
  './firecrawl-workspace-router.js?v=20260914-spinner-hard-stop-v1&adaptive-evidence=1&saving-mode=1&balanced-saving=1&research-pipeline=20260930-v1',
  './linkedin-signals.js?v=20260907-public-index-v1',
  './company-research-security.js?v=20260916-latency-fix-v2',
  './company-research-ui.js?v=20260926-guidance-status-v3&research-pipeline=20260930-v1',
  './company-profile-handoff.js?v=20260924-friendly-workflow-labels-v1',
  './reference-customers.js?v=20260927-opportunity-map-durable-v1&target-segments=1&target-status=1&reference-discovery=5&reference-similarity=20260930-v1&research-quality=6&reference-save-stability=2',
  './reference-customer-table-detection.js?v=20260911-reference-missing-info-v1',
  './reference-customer-smart-import.js?v=20260923-reference-interface-v1',
  './reference-customer-ai.js?v=20260911-invalid-json-recovery-v1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1&reference-similarity=20260930-v1&research-pipeline=20260930-v1&research-quality=6&reference-save-stability=2',
  './reference-customer-ui.js?v=20260927-opportunity-map-durable-v1&opportunity-context=1&target-segments=1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1&saving-mode=1&map-activation-guide=1&target-controls=1&target-save=1&target-status=1&reference-discovery=5&reference-similarity=20260930-v1&individual-profiles=6&reference-save-stability=2&company-workflow=20261001-v2&profile-market=20261001-v1&guidance-copy=20261001-v1',
  './reference-customer-clear-list.js?v=20260923-reference-interface-v1',
  './reference-customer-website-enrichment.js?v=20260923-reference-interface-v1&reference-discovery=5',
  './reference-customer-ai-runtime.js?v=20260927-save-only-v1&target-research=1&saving-mode=1&map-activation-guide=1&target-controls=1&target-save=1&target-status=1&reference-discovery=5&reference-similarity=20260930-v1&research-pipeline=20260930-v1&reference-refresh=6&reference-save-stability=2&profile-market=20261001-v1&guidance-copy=20261001-v1&list-lifecycle=20261002-v1',
  './reference-customer-launcher.js?v=20260927-opportunity-map-durable-v1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1&saving-mode=1&reference-discovery=5&reference-similarity=20260930-v1&individual-profiles=6&reference-save-stability=2&company-workflow=20261001-v2&profile-market=20261001-v1&guidance-copy=20261001-v1',
  './lookalike-discovery.js?v=20260930-contact-suppression-v1&opportunity-context=1&reference-discovery=5&reference-similarity=20260930-v1&company-evidence=20261002-v1&commercial-evidence=20261002-v2&buyer-quality=20261002-v3&qualification=20261002-v1',
  './intelligence-sources-ui.js?v=20260924-friendly-workflow-labels-v1&reset-center=1&strategy=20261001-v2',
  './profile-action-runtime.js?v=20260924-friendly-workflow-labels-v1',
  './outreach-automation-loader.js?v=20260930-contact-suppression-v1&delivery-policy-recovery=1&approved-workflow=20261001-v1&qualification=20261002-v1'
];

async function loadSupportModules(){
  const crmResults=[];
  try{await import('./crm-presentation.js?v=20260924-crm-evidence-activity-v1');crmResults.push({status:'fulfilled'});}
  catch(reason){crmResults.push({status:'rejected',reason});}
  try{await import('./crm-ui.js?v=20260928-crm-buyer-recovery-v1');crmResults.push({status:'fulfilled'});}
  catch(reason){crmResults.push({status:'rejected',reason});}
  const results=[...crmResults,...await Promise.allSettled(SUPPORT_MODULES.map(source=>import(source)))];
  const failed=results.filter(result=>result.status==='rejected');
  if(failed.length)console.warn(`LeadIntel: ${failed.length} optional module${failed.length===1?'':'s'} did not load.`,failed);
  window.dispatchEvent(new CustomEvent('leadintel:support-modules-ready',{detail:{loaded:results.length-failed.length,failed:failed.length}}));
}

window.addEventListener('load',()=>{void loadSupportModules();},{once:true});
