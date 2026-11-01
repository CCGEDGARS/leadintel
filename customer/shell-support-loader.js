// The pure CRM mapper is needed by the bridge's post-verification migration.
import './crm-engine.js?v=20260828-master-crm-v1&commercial-evidence=20261002-v2&buyer-quality=20261002-v5&buyer-research=20261004-v3&public-contacts=20261004-v2&buyer-role-reload=20261020-v1&company-contact-record=20261020-v5&buyer-research-policy=20261020-v2&buyer-company-actions=20261021-v2&official-company-contacts=20261021-v4&company-assessment=20261021-v1&phone-lifecycle=20261029-v2&step5-audit=20261030-v1&companies-audit=20261031-v1';

const SUPPORT_MODULES=[
  './website-scanning-ui.js?v=20261018-v1&preferred-sources=20261018-v1',
  './website-input-sync.js?v=20261006-sender-identity-v1&setup-audit=20261030-v1',
  './custom-market-input-hygiene.js?v=20260903-password-manager-isolation-v5',
  './sync-conflict-hygiene.js?v=20260901-stale-blank-conflict-v1',
  './service-settings-extension.js?v=20260925-provider-credit-health-v1&tool-links=20261011-v1&optional-hunter=20261004-v1&contact-policy=20261004-v3&sharing-privacy=20261011-v1&alert-colours=20261011-v1&compact-apollo=20261012-v3-visible-key&workspace-auth=20261012-v1&customer-only-billing=20261012-v1&optional-verification=20261014-v1&app-dialogs=20261017-v1&contact-archive=20261020-v1&paid-settings-removed=20261021-v1&treg-paid-search=20261021-v1&badge-refresh=20261024-v1&paid-controls=20261029-v1&setup-audit=20261030-v1',
  './commercial-profile-adviser.js?v=20261101-v1',
  './step2-readiness-engine.js?v=20260924-friendly-workflow-labels-v1&profile-review=20261001-v2&profile-repair=20261002-v1&profile-adviser=20261101-v1',
  './company-brain.js?v=20261001-adaptive-business-context-v1&profile-review=20261001-v2&profile-repair=20261002-v1&profile-audit=20261030-v1&profile-adviser=20261101-v1',
  './step2-first-party-intelligence.js?v=20260909-first-party-step2-v1&profile-adviser=20261101-v1',
  './firecrawl-workspace-router.js?v=20260914-spinner-hard-stop-v1&adaptive-evidence=1&saving-mode=1&balanced-saving=1&research-pipeline=20260930-v1&scrapling-fallback=20261003-v1&customer-only-billing=20261012-v1',
  './linkedin-signals.js?v=20260907-public-index-v1',
  './company-research-security.js?v=20260916-latency-fix-v2&profile-audit=20261030-v1&messages-reliability=20261031-v1',
  './company-research-ui.js?v=20260926-guidance-status-v3&website-answer-handoff=20261012-v2&message-evidence=20261010-v1&research-pipeline=20260930-v1&scrapling-fallback=20261003-v1&customer-only-billing=20261012-v1&rescue=20261013-v1&profile-research-status=20261014-v2&research-lifecycle=20261018-v4&profile-audit=20261030-v1&messages-reliability=20261031-v1&profile-adviser=20261101-v2',
  './company-profile-handoff.js?v=20260924-friendly-workflow-labels-v1&in-place-handoff=20261024-v1&profile-audit=20261030-v1',
  './reference-customers.js?v=20260927-opportunity-map-durable-v1&target-segments=1&target-status=1&reference-discovery=5&reference-similarity=20260930-v1&research-quality=6&reference-save-stability=2&profile-audit=20261030-v1',
  './reference-customer-table-detection.js?v=20260911-reference-missing-info-v1',
  './reference-customer-smart-import.js?v=20260923-reference-interface-v1',
  './reference-customer-ai.js?v=20260911-invalid-json-recovery-v1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1&reference-similarity=20260930-v1&research-pipeline=20260930-v1&scrapling-fallback=20261003-v1&research-quality=6&reference-save-stability=2',
  './reference-customer-ui.js?v=20260927-opportunity-map-durable-v1&opportunity-context=1&target-segments=1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1&saving-mode=1&map-activation-guide=1&target-controls=1&target-save=1&target-status=1&reference-discovery=5&reference-similarity=20260930-v1&individual-profiles=6&reference-save-stability=2&company-workflow=20261001-v2&profile-market=20261001-v1&guidance-copy=20261001-v1&profile-audit=20261030-v1',
  './reference-customer-clear-list.js?v=20260923-reference-interface-v1&profile-audit=20261030-v1',
  './reference-customer-website-enrichment.js?v=20260923-reference-interface-v1&reference-discovery=5&profile-audit=20261030-v1',
  './reference-customer-ai-runtime.js?v=20260927-save-only-v1&target-research=1&saving-mode=1&map-activation-guide=1&target-controls=1&target-save=1&target-status=1&reference-discovery=5&reference-similarity=20260930-v1&research-pipeline=20260930-v1&scrapling-fallback=20261003-v1&reference-refresh=6&reference-save-stability=2&profile-market=20261001-v1&guidance-copy=20261001-v1&list-lifecycle=20261002-v1&qualification-context=20261020-v1&profile-audit=20261030-v1&reference-auto=20261101-v1',
  './reference-customer-launcher.js?v=20260927-opportunity-map-durable-v1&profile-ux=1&target-list-edit=1&opportunity-map=1&profile-source=1&inline-activate=1&target-research=1&saving-mode=1&reference-discovery=5&reference-similarity=20260930-v1&individual-profiles=6&reference-save-stability=2&company-workflow=20261001-v2&profile-market=20261001-v1&guidance-copy=20261001-v1&event-flow=20261012-v1&profile-audit=20261030-v1',
  './lookalike-discovery.js?v=20260930-contact-suppression-v1&opportunity-context=1&reference-discovery=5&reference-similarity=20260930-v1&company-evidence=20261002-v1&commercial-evidence=20261002-v2&buyer-quality=20261002-v5&qualification=20261003-qualified-v2&icp-intent=20261015-v1&profile-audit=20261030-v1&activation-gates=20261101-v1',
  './intelligence-sources-ui.js?v=20260924-friendly-workflow-labels-v1&reset-center=1&strategy=20261001-v2&app-dialogs=20261017-v1&monitoring-location=20261018-v1',
  './profile-action-runtime.js?v=20260924-friendly-workflow-labels-v1',
  './outreach-automation-loader.js?v=20261002-settings-v5&delivery-policy-recovery=1&approved-workflow=20261001-v1&qualification=20261003-qualified-v2&contact-policy=20261004-v3&sender-identity=20261006-v2&materials-order=20261012-v1&optional-verification=20261014-v1&automatic-limits=20261014-v1&app-dialogs=20261017-v1&contact-archive=20261020-v1&treg-paid-search=20261021-v1&delivery-experience=20261024-v1&delivery-records=20261024-v2&delivery-spacing=20261024-v2&messages-reliability=20261031-v1&delivery-reliability=20261031-v1'
];

async function loadSupportModules(){
  const crmResults=[];
  try{await import('./crm-presentation.js?v=20260924-crm-evidence-activity-v1&buyer-research=20261004-v3&public-contacts=20261004-v2&contact-archive=20261020-v1&contact-data-retention=20261021-v1&finish-core=20261024-v1&crm-action-safety=20261024-v1');crmResults.push({status:'fulfilled'});}
  catch(reason){crmResults.push({status:'rejected',reason});}
  for(const source of ['./crm-priorities.js?v=20261024-crm-daily-priorities-v1','./commercial-insights-loader.js?v=20261024-finish-core-v1']){try{await import(source);crmResults.push({status:'fulfilled'});}catch(reason){crmResults.push({status:'rejected',reason});}}
  try{await import('./crm-ui.js?v=20260928-crm-buyer-recovery-v1&page-procedures=20261010-v1&app-dialogs=20261017-v1&contact-archive=20261020-v1&buyer-company-actions=20261021-v2&contact-data-retention=20261021-v1&finish-core=20261024-v1&crm-action-safety=20261024-v1');crmResults.push({status:'fulfilled'});}
  catch(reason){crmResults.push({status:'rejected',reason});}
  const results=[...crmResults,...await Promise.allSettled(SUPPORT_MODULES.map(source=>import(source)))];
  const failed=results.filter(result=>result.status==='rejected');
  if(failed.length)console.warn(`LeadIntel: ${failed.length} optional module${failed.length===1?'':'s'} did not load.`,failed);
  window.dispatchEvent(new CustomEvent('leadintel:support-modules-ready',{detail:{loaded:results.length-failed.length,failed:failed.length}}));
}

window.addEventListener('load',()=>{
  if(window.LeadIntelAccountCache)window.LeadIntelAccountCache.afterVerification(loadSupportModules);else void loadSupportModules();
},{once:true});
