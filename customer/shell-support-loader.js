const SUPPORT_MODULES=[
  './state-budget.js?v=20260826-state-budget-500kb',
  './website-input-sync.js?v=20260901-saved-state-v2',
  './custom-market-input-hygiene.js?v=20260903-password-manager-isolation-v5',
  './crm-engine.js?v=20260828-master-crm-v1',
  './sync-conflict-hygiene.js?v=20260901-stale-blank-conflict-v1',
  './crm-ui.js?v=20260905-app-audit-v2',
  './service-settings-extension.js?v=20260915-mail-choice-v2',
  './step2-readiness-engine.js?v=20260916-commercial-brief-v1',
  './company-brain.js?v=20260909-step2-first-party-v1',
  './step2-first-party-intelligence.js?v=20260909-first-party-step2-v1',
  './firecrawl-workspace-router.js?v=20260914-spinner-hard-stop-v1',
  './linkedin-signals.js?v=20260907-public-index-v1',
  './company-research-security.js?v=20260916-latency-fix-v2',
  './company-research-ui.js?v=20260918-research-handoff-v1',
  './company-profile-handoff.js?v=20260826-intelligence-autofill-v1',
  './reference-customers.js?v=20260911-reference-missing-info-v1',
  './reference-customer-table-detection.js?v=20260911-reference-missing-info-v1',
  './reference-customer-smart-import.js?v=20260910-reference-smart-import-v3',
  './reference-customer-ai.js?v=20260911-invalid-json-recovery-v1',
  './reference-customer-ui.js?v=20260911-reference-missing-info-v1',
  './reference-customer-clear-list.js?v=20260909-reference-actions-v2',
  './reference-customer-website-enrichment.js?v=20260911-reference-missing-info-v1',
  './reference-customer-ai-runtime.js?v=20260911-reference-missing-info-v1',
  './reference-customer-launcher.js?v=20260911-reference-open-v2',
  './lookalike-discovery.js?v=20260910-reference-portfolio-v1',
  './intelligence-sources-ui.js?v=20260915-preferred-sources-v1',
  './profile-action-runtime.js?v=20260912-bottom-profile-actions-v1',
  './outreach-automation-loader.js?v=20260916-brand-outreach-v2'
];

async function loadSupportModules(){
  const results=await Promise.allSettled(SUPPORT_MODULES.map(source=>import(source)));
  const failed=results.filter(result=>result.status==='rejected');
  if(failed.length)console.warn(`LeadIntel: ${failed.length} optional module${failed.length===1?'':'s'} did not load.`,failed);
  window.dispatchEvent(new CustomEvent('leadintel:support-modules-ready',{detail:{loaded:results.length-failed.length,failed:failed.length}}));
}

window.addEventListener('load',()=>{void loadSupportModules();},{once:true});
