const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'release-integrity.config.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(root, '.github/workflows/release-integrity.yml'), 'utf8');
const corePath = path.join(root, 'scripts/release-integrity-core.mjs');
const SHA = '0123456789abcdef0123456789abcdef01234567';

async function loadCore() {
  return import(`${pathToFileURL(corePath).href}?test=${Date.now()}-${Math.random()}`);
}

function response({ status = 200, json, text } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return json; },
    async text() { return text ?? JSON.stringify(json ?? {}); }
  };
}

function productionFetch({ customerHtml, discoveryUi, diagnosticsStatus=401, sessionStatus=401, privateSettingsStatus=401,storageStatus=401, premiumCss }) {
  return async url => {
    const parsed = new URL(String(url));
    if(['/customer/evidence-policy.js','/customer/strategy-integrity.js','/customer/market-conditions-engine.js','/customer/market.css','/customer/intelligence-profile-runtime.js','/customer/canonical-profile-runtime.js','/customer/reference-customers.js'].includes(parsed.pathname))return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if(parsed.pathname==='/customer/setup-operation-trace.js')return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if(['/customer/background-task-centre.js','/customer/additional-contact-services.js'].includes(parsed.pathname))return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if(parsed.pathname==='/customer/premium.css')return response({text:premiumCss ?? fs.readFileSync(path.join(root,'customer/premium.css'),'utf8')});
    if(parsed.pathname==='/customer/styles.css')return response({text:fs.readFileSync(path.join(root,'customer/styles.css'),'utf8')});
    if(parsed.pathname==='/customer/conversation-workflow-ui.js')return response({text:fs.readFileSync(path.join(root,'customer/conversation-workflow-ui.js'),'utf8')});
    if(parsed.pathname==='/api/conversation-workflows')return response({status:401,json:{error:'Authentication required'}});
    if(['/customer/app-shell.css','/customer/language-pack-catalogue.js','/customer/message-translation-ui.js','/customer/company-materials.js','/customer/storyselling-ui.js','/customer/storyselling-native.js','/customer/original-scripts.js','/customer/original-scripts-ui.js'].includes(parsed.pathname))return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if(['/api/language-packs','/api/integrations/translation/google','/api/company-materials','/api/story-bank','/api/workspace-skills'].includes(parsed.pathname))return response({status:401,json:{error:'Authentication required'}});
    if(['/customer/rich-text.js','/customer/rich-text-editor.js','/customer/rich-text.css'].includes(parsed.pathname))return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if(['/api/integrations/google-calendar/status','/api/integrations/microsoft-calendar/status'].includes(parsed.pathname))return response({status:401,json:{error:'Sign in to connect your calendar'}});
    if(parsed.pathname==='/customer/message-draft-history.js')return response({text:fs.readFileSync(path.join(root,'customer/message-draft-history.js'),'utf8')});
    if(parsed.pathname==='/customer/message-meeting-options.js')return response({text:fs.readFileSync(path.join(root,'customer/message-meeting-options.js'),'utf8')});
    if(parsed.pathname==='/api/operations/diagnostics')return response({status:diagnosticsStatus,json:{error:'Authentication required'}});
    if(parsed.hostname==='apollo-proxy.edgars-7e7.workers.dev'&&parsed.pathname==='/api/health')return response({json:{billing:'customer_only'}});
    if(['/customer/content-language.js','/customer/delivery-engine.js','/customer/outreach-automation.css','/customer/conversation-ui.js','/customer/delivery-ui.js','/customer/qualification-worker.js','/customer/qualification-display.js','/customer/reference-customer-portfolio.js','/customer/workspace-codec-worker.js','/customer/website-scanning-ui.js','/customer/website-scanning.js','/customer/release-freshness.js','/customer/outreach-automation-ui.js','/customer/campaign-research.js','/customer/campaign-plan.js','/customer/email-campaign-ui.js','/customer/email-campaigns.js','/customer/app.js'].includes(parsed.pathname))return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});if((parsed.pathname==='/api/email-campaigns'||parsed.pathname==='/api/email-campaigns/companies'))return response({status:401,json:{error:'Authentication required'}});if(parsed.pathname==='/customer/firecrawl-workspace-router.js')return response({text:fs.readFileSync(path.join(root,'customer/firecrawl-workspace-router.js'),'utf8')});
    if(parsed.pathname==='/api/conversations')return response({status:401,json:{error:'Authentication required'}});
    if(parsed.pathname==='/api/storage/status')return response({status:storageStatus,json:{error:'Authentication required'}});
    if(['/api/storage/checkout','/api/webhooks/stripe/storage'].includes(parsed.pathname))return response({status:405,json:{error:'Method not allowed'}});
    if (['/api/customer/state','/api/integrations/calendly/status'].includes(parsed.pathname)) return response({status:privateSettingsStatus,json:{error:'Authentication required'}});
    if(['/api/follow-up-assistant/context','/api/follow-up-assistant/save'].includes(parsed.pathname))return response({status:401,json:{error:'Authentication required'}});
    if(parsed.pathname==='/api/flows')return response({status:401,json:{error:'Authenticated workspace membership required'}});
    if (parsed.pathname === '/api/session') return response({status:sessionStatus,json:{authenticated:false}});
    if (['/api/script-library/inmail-draft','/api/integrations/gmail/test-send','/api/script-library','/api/writing-references','/api/content-materials'].includes(parsed.pathname)) return response({status:401,json:{error:'Authentication required'}});
    if (['/customer/linkedin-inmail-ui.js','/customer/linkedin-inmail-engine.js','/customer/approved-linkedin-inmail.js','/customer/test-email-ui.js','/customer/test-email.css','/customer/channel-scripts.js','/customer/channel-scripts.css'].includes(parsed.pathname)) return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if (parsed.pathname === '/customer/writing-references-loader.js') return response({text:fs.readFileSync(path.join(root,'customer/writing-references-loader.js'),'utf8')});
    if (parsed.pathname === '/customer/writing-references-ui.js') return response({text:fs.readFileSync(path.join(root,'customer/writing-references-ui.js'),'utf8')});
    if (parsed.pathname === '/customer/api-transport.js' || parsed.pathname === '/customer/account-cache.js') return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if (parsed.pathname === '/release.json') {
      return response({ json: { service: 'leadintel-customer', commit: SHA, ref: 'main' } });
    }
    if (parsed.hostname === 'leadintel-api.edgars-7e7.workers.dev') {
      return response({ json: { ...config.backendHealth.json,storyselling_version:'storyselling-v1' } });
    }
    if (parsed.pathname === '/customer/website-input-sync.js') {
      return response({ text: 'toVisibleWebsite syncVisibleWebsite displayChanged' });
    }
    if (parsed.pathname === '/customer/approved-workflow-ui.js') { return response({text:fs.readFileSync(path.join(root,'customer/approved-workflow-ui.js'),'utf8')}); }
    if (parsed.pathname === '/customer/first-party-research.js') { return response({text:fs.readFileSync(path.join(root,'customer/first-party-research.js'),'utf8')}); }
    if (['/customer/additional-contact-policy.js','/customer/additional-contact-services.js'].includes(parsed.pathname))return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if(parsed.pathname==='/customer/lookalike-discovery.js')return response({text:fs.readFileSync(path.join(root,'customer/lookalike-discovery.js'),'utf8')});
    if (parsed.pathname === '/customer/attention-centre-model.js') return response({text:fs.readFileSync(path.join(root,'customer/attention-centre-model.js'),'utf8')});
    if (['/customer/discovery-engine.js','/customer/crm-engine.js'].includes(parsed.pathname)) { return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')}); }
    if (['/customer/confirmation-dialog.js','/customer/confirmation-dialog.css','/customer/approved-reference-scripts.js','/customer/follow-up-assistant.js','/customer/follow-up-assistant-ui.js','/customer/follow-up-assistant.css','/customer/website-activation.js','/customer/company-research-ui.js','/customer/market-engine.js','/customer/event-campaign-ui.js','/customer/event-campaigns.js','/customer/event-campaigns.css','/customer/process-map.js','/customer/writing-assistant.js','/customer/writing-workspace.js','/customer/writing-assistant-ui.js','/customer/writing-assistant-context.js','/customer/writing-assistant.css','/customer/writing-references-ui.js','/customer/workspace-storage-ui.js','/customer/workspace-storage.css','/customer/attention-centre.js','/customer/app.js','/customer/shell-support-loader.js','/customer/message-facts.js','/customer/tool-account-links.js','/customer/ai-settings.css','/customer/subject-editor.js','/customer/my-flows-ui.js','/customer/my-flows.js','/customer/message-evidence.js','/customer/company-research-engine.js','/customer/page-quality.js','/customer/page-quality-ui.js','/customer/page-quality.css','/customer/production-gmail-ui.js','/customer/crm-ui.js','/customer/content-materials.js','/customer/ai-settings.js','/customer/personal-linkedin.js','/customer/copilot-loader.js','/customer/copilot-ui.js','/customer/copilot-api.js','/customer/message-editor.js','/customer/message-translations.js','/customer/message-workspace.js','/customer/message-workspace.css','/customer/personal-template-library.js','/customer/message-studio.js','/customer/state-budget.js','/customer/journey-progress.js','/customer/outreach-engine.js','/customer/outreach-ui.js','/customer/contact-confirmation-policy.js','/customer/service-settings-extension.js','/customer/workspace-sync.js','/customer/workspace-persistence.js','/customer/server-bridge.js'].includes(parsed.pathname)) return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if(['/customer/translation-preview.js','/customer/outreach-automation-delivery-handoff.js','/customer/research-brief.js','/customer/company-dossier.js','/customer/company-dossier-ui.js'].includes(parsed.pathname))return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if(parsed.pathname==='/customer/discovery.css')return response({text:fs.readFileSync(path.join(root,'customer/discovery.css'),'utf8')});
    if (parsed.pathname === '/customer/discovery-ui.js') {
      return response({ text: discoveryUi });
    }
    if (parsed.pathname === '/customer/topbar.js') return response({ text: fs.readFileSync(path.join(root, 'customer/topbar.js'), 'utf8') });
    // The admin page (2026-10-25) is proven from the real files, like the production root.
    if (parsed.pathname === '/admin/') return response({ text: fs.readFileSync(path.join(root, 'admin/index.html'), 'utf8') });
    if (parsed.pathname === '/admin/admin.js') return response({ text: fs.readFileSync(path.join(root, 'admin/admin.js'), 'utf8') });
    if (parsed.pathname === '/customer/') {
      return response({ text: customerHtml });
    }
    if (parsed.pathname === '/customer/access-gate.js') return response({ text: fs.readFileSync(path.join(root, 'customer/access-gate.js'), 'utf8') });
    if (parsed.pathname === '/') {
      // The production root is the invitation-only sign-in page; the proof reads the real file.
      return response({ text: fs.readFileSync(path.join(root, 'index.html'), 'utf8') });
    }
    return response({ status: 404, text: 'missing' });
  };
}

const storageEntries=['topbar.js','account-cache.js','ai-settings.js','attention-centre.js','api-transport.js'].map(name=>fs.readFileSync(path.join(root,'customer/index.html'),'utf8').match(new RegExp('src="('+name.replaceAll('.','\\.')+'[^"]+)'))[0]).join('\n');
const workflowEntries=fs.readFileSync(path.join(root,'customer/index.html'),'utf8').split('\n').filter(line=>/conversation-workflow-ui\.js|conversation\.css/.test(line)).join('\n');
const shell = 'delivery-reliability=20261031-v1 messages-reliability=20261031-v1 buyers-audit=20261031-v1 companies-audit=20261031-v1 strategy-integrity.js?strategy-audit=20261030-v1 profile-audit=20261030-v1 setup-audit=20261030-v1 setup-operation-trace.js?v=20261030-v1 step5-audit=20261030-v1 buyer-routing=20261030-v1 status-recovery=20261030-v1 recording-review=20261030-v1 '+workflowEntries+'\n'+'book-skills=20261027-v1 mentor=20261027-v1 Company materials, references and success stories 5 PDFs + 10 images company-materials.js?v=20261026-v1 '+'data-target-market="Kazakhstan" kazakhstan-support=20261024-v1 admin-entry=20261026-v1 copilot-loader.js?v=20261011-business-research-v2&sidebar-flows=20261011-v1&classic-button=20261026-v4&history=20261027-v2&activity=20261026-v1&memory=20261026-v1&attention=20261026-v1&streaming=20261026-v1 meeting-options=20261025-v1 rich-text.js?v=20261025-v1 rich-text-editor.js?v=20261025-v1 rich-text.css?v=20261025-v1&compact-controls=20261025-v2&link-actions=20261025-v1 delivery-records=20261024-v2 conversation-ui.js?v=20261023-v1 conversation.css?v=20261027-workflows-v1 writing-workspace=20261023-v1 sync-recovery-overflow=20261022-v1 research-brief.js?v=20261022-v4 shared-message-brief=20261022-v2 messages-audit=20261021-v1 company-dossier.js?v=20261021-v4 company-dossier-ui.js?v=20261021-v5 formula-execution=20261021-v2 buyer-polish=20261021-v2 buyer-polish=20261021-v1 confirm-contact-data=20261021-v1 company-assessment=20261021-v1 official-company-contacts=20261021-v4 buyer-force-refresh=20261021-v2 saved-buyer-resume=20261021-v1 '+'confirmation-dialog.js?v=20261021-v1 confirmation-dialog.css?v=20261021-v1 buyer-crm-close=20261021-v1 buyer-company-remove=20261021-v2 buyer-company-actions=20261021-v2 buyer-supervisor=20261021-v4&buyer-gmail=20261021-v2 buyer-email-button=20261021-v1 buyer-research-policy=20261021-v3 company-contact-record=20261020-v5 workspace-save=20261020-v1 buyer-runtime-recovery=20261020-v1 treg-paid-search=20261021-v1 paid-email-phone=20261021-v1 additional-contact-services.js?v=20261019-v1 '+fs.readFileSync(path.join(root,'customer/index.html'),'utf8').match(/<script src="state-budget\.js[^"]*"><\/script>/)[0]+'\n'+'audit-monitoring=20261015-v1 audit-delivery=20261015-v1 email-campaign-ui.js?v=20261014-v1 email-campaigns.css?v=20261014-v1 email-campaigns=20261014-v1\nassistant-window=20261015-v3 content-library=20261015-v2 step6-rescue=20261013-v11\n'+storageEntries+'\n'+'event-flow=20261012-v1 feature-focus monitoring-feature '+'id="account-recovery" Try again startup-recovery=20261011-v1 archive-storage=20261011-v2 indexed-snapshot=20261011-v1 id="account-recovery-message" placeholder="Your first and last name" sharing-privacy=20261011-v1 codec-loader=20261011-v1&snapshot-quota=20261011-v1 text-compression=20261011-v3 bundle-sync=20261011-v1 <script defer src="message-evidence.js?v=20261010-evidence-v3"></script> subject-evidence=20261010-v5 LeadIntel — Build Your Commercial Intelligence Strategy id="company-website" <script defer src="page-quality.js?v=20261010-v1"></script><script defer src="page-quality-ui.js?v=20261010-v1"></script> page-procedures=20261010-v1';
const boundedDiscoveryRuntime = [
 "function buyerHydrationScope( function buyerHydrationSameIdentity( function buyerHydrationContact( Saved CRM buyer identity conflicts with retained local work.",
 "function captureBuyerAction( function buyerActionCurrent( selectionOwner:token data-person-id=",
 "async function confirmPublicBuyerSource( requireBuyerAction(owner) researchOwner",
 "saveHunter:async prepare:async accept:async",
 "function companyActionCandidate( function claimCompanySelection( data-company-key= function validateCompanySave(",
 "async function awaitDiscoveryRun( activeDiscoveryTaskId===taskId persistence:'failed'",
 "function companyStrategyCurrent( function retainDiscoveryEvidence( candidate.evidence=retainDiscoveryEvidence(candidate.evidence||[]",
 "function scheduleSavedBuyerPublicChecks(){ incomplete saved work requires explicit Refresh.",
 "strategySignature:window.LeadIntelStrategyIntegrity?.signature(main) strategyCurrent:window.LeadIntelStrategyIntegrity?.status(main)?.current",
 "Array.isArray(main.referenceCustomerPortfolio?.lists)?null",
 "selectedInputKey()===expectedPeopleKey pending.owners",
 "manualContact:!automatic if(!manualContact&&ownerIsCurrent() personId:button.dataset.personId",
 "data-review-buyer-sync title:'CRM connection refreshed'",
  'writing-mentors=20261017-v1&messages-audit=20261021-v1',
  'buyer-public-summary data-contact-channel= View profile ↗ officialPageReads buyer-polish=20261021-v2 Checking public contact evidence public searches',
  'Building company dossier /api/ai/company-dossier companyDossier:',
  "discovery-assessment-gaps company assessments failure.detail|| buyerFitIssueCode:cachedFit(c)?.buyerFitIssueCode",
  'async function refreshOfficialCompanyContacts( data-refresh-company-contacts= published email routes inventoryRestored Read this source first Company contact sources company-published-routes Official linking page Resume company contacts data-official-contact-url if(candidate.people?.length&&LeadIntelDiscovery.buyerResearchCoveragePassed(candidate))continue;',
  "alternativeAction:'Save to CRM' choice==='alternative' Company saved to CRM · removed from the Buyers list Research changed during saving.",
  'function saveSelectedBuyerCompany( function removeSelectedBuyerCompany( b.deleteCrmCompany(company.id) Saved ✓ data-remove-buyer-company= Remove completely',
 'Possible match · Unconfirmed Name-based Gmail patterns Gmail research ·',
 'function buyerQualitySupervisorHtml( priority buyers have confirmed company emails AI supervisor: checking research coverage',
  "channel==='gmail'?person.contactResearch?.checks?.gmail||{status:'not_searched'}",
  'function buyerResearchAccountabilityHtml( Mandatory depth: Adaptive deep researchTrace runMandatoryBuyerResearch(candidate,',
  'function prospectContactControls( Confirm data buyer-email-confirmed data-prospect-enrich-email function hydratePublishedCompanyEmails( function confirmPublishedCompanyContacts(',
  'function qualificationContext(){ previous.raw===raw qualificationContextCache={raw,scope,dependencies,profile,market:main.market||{}}',
  'CRM refresh request_timeout crm-refresh:',
  'const waitForRun=async operation=> BUYER_RESEARCH_CANCELED Cross-checking buyer evidence with grounded web research scopeIsCurrent',
  'function navigateBackFromDiscoveryStage() if(currentJourneyFocus()==="buyers"){setJourneyFocus("companies");renderAll();return;} $("back-to-strategy")?.addEventListener("click",navigateBackFromDiscoveryStage)',
  'async function discoverCampaign leadIntelScopeValid campaignPlan.results=runCandidates',
  'A new search does not replace your saved selections. This search has finished.',
  'window.LeadIntelCampaignModuleLoader=async step outreach-ui.js?v=${OUTREACH_ASSET_VERSION}&style-application=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&writing-assistant=20261012-v1',
  'function buyerContinuationIssue( function pointToBuyerRequirement( guided-primary-action acquisitionFailed=false Completed buyer research stages',
  'const DISCOVERY_REQUEST_TIMEOUT_MS=25000;',
  'const DISCOVERY_RUN_TIMEOUT_MIN_MS=120000;',
  'function discoveryRunTimeoutMs(',
  'async function withDiscoveryDeadline( const firstPool= const fitCache=new Map(); Checking purchasing fit maxDurationMs:DISCOVERY_REQUEST_TIMEOUT_MS*2 Completed evidence was kept. company-verification=20261019-v3 discovery.lastSuccessfulRunAt=discovery.lastRunAt; company-ranked-list=20261019-v1 function restoreCheckedCompanyResearch() Checked · Manual review',
  'function ensureDiscoveryMounted(){}',
  'id="clear-company-results">Clear search results',
  'function clearCompanySearchResults(){}',
  'pipeline:discovery.pipeline',
  'delete meta.lastCompanyRun',
  'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};',
  'initDiscoveryWhenReady();',
  'companyResearchIncomplete=true;',
  'Research incomplete',
  'Buyer research saved locally',
  'Company website verification:',
  'buyer-contacts-v23-company-record Resume incomplete checks Identity discovery',
  'async function confirmResearchedPublicEmails await confirmResearchedPublicEmails(candidate,controller.signal,researchWorkspace,canContinue,owner) contextGuard,researchOwner',
  'function buyerResearchCandidates( function buyerReviewEvidence( target:10,shortfall',
  "typeof response.text==='function'?response.text() Optional evidence review unavailable; individual source checks are retained timeoutMs:Math.min(DISCOVERY_REQUEST_TIMEOUT_MS,12000)",
  'const rolesRefreshBlocked= Saved people remain visible for review. candidate.people=rolesRefreshBlocked?candidate.people||[]:shortlist.people;',
  'Buying committee coverage incomplete 2 + 2 buying committee represented data-research-executive 20261020-public-company-record-v1',
  'function companyReviewBatchPlan( async function reviewNextCompanyBatch( function renderCompanyReviewBatch( review-next-companies companies awaiting review batch-review=20261020-v1',
  'function rankedCheckedCompanies(){ function companyCandidateCardHtml( company-other-results Show other companies · shortlist-display=20261020-v1',
  'const deferredMentions= const followUpProfile= function renderSearchPreferences() company-search-preferences profileForQueries.searchFeedback= search-relevance=20261020-v1',
  'all-style-facts=20261022-v1',
  'buyer-actions=20261005-email-gate-v1 buyer-confirm-needed buyer-proceed-ready >Proceed data-recheck-buyer >E-mail >Phone async function recheckBuyerContact( Researching available free sources personIds:[String(person.id)],force:true A confirmed company or personal email for this person',
  'buyer-selection=20261005-bridge-v1 function selectedEmailBuyer( Synchronization conflict: resolve the workspace versions above before selecting a recipient. scriptBuyer:choice,activeJourneyStage:6,visibleStep:6 data-buyer-selection-check await loadOutreachModules();',
  'const supplied=LeadIntelDiscovery.safeBuyerReviewEvidence(LeadIntelDiscovery.buyerSupervisorEvidence(candidate.people,rows)) buyerResearchCandidates automatic contact research for all retained people top 4 ranked recommendations Contact checks complete: data-research-buyer data-research-remaining Unverified email patterns Profile matched automatically Phone source needs rechecking function matchBuyerRoleEvidence( publicPhoneSourceCheck',
  "type:'contact.linkedin_confirmed' channel:'linkedin' async function recheckBuyerEmailSources("
  ,'function buyerAgentHtml( Recheck with Buyer Agent Identity / employer: Company trigger:'
].join('\n');

test('production proof accepts the bounded staged Discovery runtime', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  const proof = await verifyRelease({
    config,
    expectedSha: SHA,
    ciConclusion: 'success',
    ciRunId: '199',
    fetchImpl: productionFetch({
      customerHtml: `${shell}<script defer src="qualification-display.js?v=20261020-v1"></script><script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1&stage-back=20261020-v1&qualification-context=20261020-v3"></script>`,
      discoveryUi: boundedDiscoveryRuntime
    }),
    nonce: 'intended-timeout-contract'
  });

  assert.equal(proof.verdict, VERDICTS.PROVEN, proof.failures.join('\n'));
});

test('production proof rejects the old stage back handler and a cached entry', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  for (const stale of ['runtime', 'entry']) {
    const proof = await verifyRelease({
      config, expectedSha: SHA, ciConclusion: 'success', ciRunId: 'navigation',
      fetchImpl: productionFetch({
        customerHtml: `${shell}<script defer src="qualification-display.js?v=20261020-v1"></script><script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1${stale === 'entry' ? '' : '&stage-back=20261020-v1&qualification-context=20261020-v3'}"></script>`,
        discoveryUi: stale === 'runtime' ? boundedDiscoveryRuntime.replace('$("back-to-strategy")?.addEventListener("click",navigateBackFromDiscoveryStage)', '$("back-to-strategy")?.addEventListener("click",showStrategyStep)') : boundedDiscoveryRuntime
      }),
      nonce: `stale-stage-back-${stale}`
    });
    assert.equal(proof.verdict, VERDICTS.BLOCKED_SMOKE_CHECK);
    const gate = stale === 'runtime' ? 'company-stage-back-navigation' : 'company-stage-back-entry';
    assert.equal(proof.smokeChecks.find(check => check.id === gate).passed, false);
  }
});

test('production proof rejects anonymous access to private settings and workspace state',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'privacy',fetchImpl:productionFetch({customerHtml:`${shell}<script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1"></script>`,discoveryUi:boundedDiscoveryRuntime,privateSettingsStatus:200}),nonce:'anonymous-access-regression'});
  assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);
  for(const id of ['shared-link-anonymous-state-denied','shared-link-anonymous-booking-denied'])assert.equal(proof.smokeChecks.find(check=>check.id===id).passed,false);
});

test('production proof blocks the former module-graph Discovery bootstrap', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  const proof = await verifyRelease({
    config,
    expectedSha: SHA,
    ciConclusion: 'success',
    ciRunId: '200',
    fetchImpl: productionFetch({
      customerHtml: `${shell}<script type="module" src="discovery-ui.js?v=old"></script>`,
      discoveryUi: `import "./content-variants.js";\n${boundedDiscoveryRuntime}`
    }),
    nonce: 'module-regression'
  });

  assert.equal(proof.verdict, VERDICTS.BLOCKED_SMOKE_CHECK);
  assert.match(proof.failures.join(' '), /discovery-bootstrap/i);
});

test('production proof blocks a Discovery runtime without a hard stop', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  const proof = await verifyRelease({
    config,
    expectedSha: SHA,
    ciConclusion: 'success',
    ciRunId: '201',
    fetchImpl: productionFetch({
      customerHtml: `${shell}<script defer src="qualification-display.js?v=20261020-v1"></script><script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1"></script>`,
      discoveryUi: 'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};\ninitDiscoveryWhenReady();'
    }),
    nonce: 'timeout-regression'
  });

  assert.equal(proof.verdict, VERDICTS.BLOCKED_SMOKE_CHECK);
  assert.match(proof.failures.join(' '), /discovery-runtime/i);
});

test('production proof blocks a Discovery runtime that performs hidden-stage startup work', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  const proof = await verifyRelease({
    config,
    expectedSha: SHA,
    ciConclusion: 'success',
    ciRunId: '202',
    fetchImpl: productionFetch({
      customerHtml: `${shell}<script defer src="qualification-display.js?v=20261020-v1"></script><script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1"></script>`,
      discoveryUi: [
        'function buyerContinuationIssue( function pointToBuyerRequirement( guided-primary-action acquisitionFailed=false Completed buyer research stages',
  'const DISCOVERY_REQUEST_TIMEOUT_MS=25000;',
        'const DISCOVERY_RUN_TIMEOUT_MIN_MS=120000;',
        'function discoveryRunTimeoutMs(',
  'async function withDiscoveryDeadline( const firstPool= const fitCache=new Map(); Checking purchasing fit maxDurationMs:DISCOVERY_REQUEST_TIMEOUT_MS*2 Completed evidence was kept.',
        'window.LeadIntelDiscoveryUI={open:openDiscoveryFromHandoff};',
        'initDiscoveryWhenReady();'
      ].join('\n')
    }),
    nonce: 'stage-isolation-regression'
  });

  assert.equal(proof.verdict, VERDICTS.BLOCKED_SMOKE_CHECK);
  assert.match(proof.failures.join(' '), /discovery-runtime/i);
});

test('release integrity re-verifies production automatically every fifteen minutes', () => {
  assert.match(workflow, /schedule:\s*\n\s*- cron:\s*['"]\*\/15 \* \* \* \*['"]/);
  assert.match(workflow, /id:\s*scheduled_ci/);
  assert.match(workflow, /github\.event_name == 'schedule'/);
  assert.match(workflow, /actions\/workflows\/customer-ci\.yml\/runs/);
});

 test('production proof blocks a missing first-party session proxy',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'201',fetchImpl:productionFetch({customerHtml:`${shell}<script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1"></script>`,discoveryUi:boundedDiscoveryRuntime,sessionStatus:404}),nonce:'missing-session-proxy'});
  assert.notEqual(proof.verdict,VERDICTS.PROVEN);assert.ok(proof.failures.some(f=>f.includes('first-party-api-session')));
});

test('production proof blocks a missing controlled message editor asset',async()=>{
 const {verifyRelease,VERDICTS}=await loadCore(),base=productionFetch({customerHtml:`${shell}<script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1"></script>`,discoveryUi:boundedDiscoveryRuntime});
 const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'203',fetchImpl:url=>new URL(url).pathname==='/customer/message-editor.js'?Promise.resolve(response({status:404,text:'missing'})):base(url),nonce:'missing-editor'});
 assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);assert.match(proof.failures.join(' '),/controlled-message-editor/);
});

test('production proof blocks a missing mandatory page-check engine',async()=>{
 const {verifyRelease,VERDICTS}=await loadCore(),normal=productionFetch({customerHtml:`${shell}<script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1"></script>`,discoveryUi:boundedDiscoveryRuntime});const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'201',fetchImpl:async url=>new URL(String(url)).pathname==='/customer/page-quality.js'?response({status:404,text:'missing'}):normal(url),nonce:'page-check-missing'});assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);assert.ok(proof.failures.some(message=>message.includes('mandatory-page-checks-engine')));
});

test('production proof rejects anonymous access to script library',async()=>{
 const {verifyRelease,VERDICTS}=await loadCore(),normal=productionFetch({customerHtml:shell,discoveryUi:boundedDiscoveryRuntime});
 const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'script-auth',fetchImpl:async url=>new URL(String(url)).pathname==='/api/script-library'?response({status:200,json:{core:[]}}):normal(url),nonce:'script-auth'});
 assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);assert.equal(proof.smokeChecks.find(c=>c.id==='script-library-auth').passed,false);
});

// A cached visual asset must not be labelled as the intended production revision.
test('production proof rejects stale control styles and an unversioned entry', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  for (const stale of ['styles', 'entry']) {
    const proof = await verifyRelease({
      config, expectedSha: SHA, ciConclusion: 'success', ciRunId: 'control-polish',
      fetchImpl: productionFetch({
        customerHtml: `${stale === 'entry' ? shell.replace('recording-review=20261030-v1', '') : shell}<script defer src="qualification-display.js?v=20261020-v1"></script><script defer src="discovery-ui.js?v=current&all-style-facts=20261022-v1&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&search-relevance=20261020-v1&shortlist-display=20261020-v1&batch-review=20261020-v1&stage-back=20261020-v1&qualification-context=20261020-v3"></script>`,
        discoveryUi: boundedDiscoveryRuntime,
        ...(stale === 'styles' ? {premiumCss: '/* Cached stylesheet */'} : {})
      }), nonce: `stale-control-${stale}`
    });
    assert.equal(proof.verdict, VERDICTS.BLOCKED_SMOKE_CHECK);
    assert.equal(proof.smokeChecks.find(check => check.id === `recording-review-${stale}`).passed, false);
  }
});

test('production proof rejects anonymous operations diagnostics even if all other release artifacts match',async()=>{
 const {verifyRelease,VERDICTS}=await loadCore();const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'operations-auth',fetchImpl:productionFetch({customerHtml:shell,discoveryUi:boundedDiscoveryRuntime,diagnosticsStatus:200}),nonce:'operations-auth'});
 assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);assert.equal(proof.smokeChecks.find(check=>check.id==='operations-diagnostics-auth').passed,false);
});
