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

function productionFetch({ customerHtml, discoveryUi, sessionStatus=401, privateSettingsStatus=401,storageStatus=401 }) {
  return async url => {
    const parsed = new URL(String(url));
    if(parsed.hostname==='apollo-proxy.edgars-7e7.workers.dev'&&parsed.pathname==='/api/health')return response({json:{billing:'customer_only'}});
    if(['/customer/website-scanning-ui.js','/customer/website-scanning.js','/customer/release-freshness.js','/customer/outreach-automation-ui.js','/customer/campaign-research.js','/customer/campaign-plan.js','/customer/email-campaign-ui.js','/customer/email-campaigns.js','/customer/app.js'].includes(parsed.pathname))return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});if((parsed.pathname==='/api/email-campaigns'||parsed.pathname==='/api/email-campaigns/companies'))return response({status:401,json:{error:'Authentication required'}});if(parsed.pathname==='/customer/firecrawl-workspace-router.js')return response({text:fs.readFileSync(path.join(root,'customer/firecrawl-workspace-router.js'),'utf8')});
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
      return response({ json: { ...config.backendHealth.json } });
    }
    if (parsed.pathname === '/customer/website-input-sync.js') {
      return response({ text: 'toVisibleWebsite syncVisibleWebsite displayChanged' });
    }
    if (parsed.pathname === '/customer/approved-workflow-ui.js') { return response({text:fs.readFileSync(path.join(root,'customer/approved-workflow-ui.js'),'utf8')}); }
    if (parsed.pathname === '/customer/first-party-research.js') { return response({text:fs.readFileSync(path.join(root,'customer/first-party-research.js'),'utf8')}); }
    if (parsed.pathname === '/customer/discovery-engine.js') { return response({text:fs.readFileSync(path.join(root,'customer/discovery-engine.js'),'utf8')}); }
    if (['/customer/confirmation-dialog.js','/customer/confirmation-dialog.css','/customer/approved-reference-scripts.js','/customer/follow-up-assistant.js','/customer/follow-up-assistant-ui.js','/customer/follow-up-assistant.css','/customer/website-activation.js','/customer/company-research-ui.js','/customer/market-engine.js','/customer/event-campaign-ui.js','/customer/event-campaigns.js','/customer/event-campaigns.css','/customer/process-map.js','/customer/writing-assistant.js','/customer/writing-assistant-ui.js','/customer/writing-assistant-context.js','/customer/writing-assistant.css','/customer/writing-references-ui.js','/customer/workspace-storage-ui.js','/customer/workspace-storage.css','/customer/attention-centre.js','/customer/app.js','/customer/shell-support-loader.js','/customer/message-facts.js','/customer/tool-account-links.js','/customer/ai-settings.css','/customer/subject-editor.js','/customer/my-flows-ui.js','/customer/my-flows.js','/customer/message-evidence.js','/customer/company-research-engine.js','/customer/page-quality.js','/customer/page-quality-ui.js','/customer/page-quality.css','/customer/production-gmail-ui.js','/customer/crm-ui.js','/customer/content-materials.js','/customer/ai-settings.js','/customer/personal-linkedin.js','/customer/copilot-loader.js','/customer/copilot-ui.js','/customer/message-editor.js','/customer/message-translations.js','/customer/message-workspace.js','/customer/message-workspace.css','/customer/personal-template-library.js','/customer/message-studio.js','/customer/state-budget.js','/customer/journey-progress.js','/customer/outreach-engine.js','/customer/outreach-ui.js','/customer/contact-confirmation-policy.js','/customer/service-settings-extension.js','/customer/workspace-sync.js','/customer/workspace-persistence.js','/customer/server-bridge.js'].includes(parsed.pathname)) return response({text:fs.readFileSync(path.join(root,parsed.pathname.slice(1)),'utf8')});
    if (parsed.pathname === '/customer/discovery-ui.js') {
      return response({ text: discoveryUi });
    }
    if (parsed.pathname === '/customer/') {
      return response({ text: customerHtml });
    }
    if (parsed.pathname === '/') {
      return response({ text: 'Commercial Intelligence Contact Intelligence href="customer/" href="LeadIntel.html"' });
    }
    return response({ status: 404, text: 'missing' });
  };
}

const storageEntries=['account-cache.js','ai-settings.js','attention-centre.js','api-transport.js'].map(name=>fs.readFileSync(path.join(root,'customer/index.html'),'utf8').match(new RegExp('src="('+name.replaceAll('.','\\.')+'[^"]+)'))[0]).join('\n');
const shell = fs.readFileSync(path.join(root,'customer/index.html'),'utf8').match(/<script src="state-budget\.js[^"]*"><\/script>/)[0]+'\n'+'audit-monitoring=20261015-v1 audit-delivery=20261015-v1 email-campaign-ui.js?v=20261014-v1 email-campaigns.css?v=20261014-v1 email-campaigns=20261014-v1\nassistant-window=20261015-v3 content-library=20261015-v2 step6-rescue=20261013-v11\n'+storageEntries+'\n'+'event-flow=20261012-v1 feature-focus monitoring-feature '+'id="account-recovery" Try again startup-recovery=20261011-v1 archive-storage=20261011-v2 indexed-snapshot=20261011-v1 id="account-recovery-message" placeholder="Your first and last name" sharing-privacy=20261011-v1 codec-loader=20261011-v1&snapshot-quota=20261011-v1 text-compression=20261011-v3 bundle-sync=20261011-v1 <script defer src="message-evidence.js?v=20261010-evidence-v3"></script> subject-evidence=20261010-v5 LeadIntel — Build Your Commercial Intelligence Strategy id="company-website" <script defer src="page-quality.js?v=20261010-v1"></script><script defer src="page-quality-ui.js?v=20261010-v1"></script> page-procedures=20261010-v1';
const boundedDiscoveryRuntime = [
  'async function discoverCampaign leadIntelScopeValid campaignPlan.results=runCandidates',
  'A new search does not replace your saved selections. This search has finished.',
  'window.LeadIntelCampaignModuleLoader=async step outreach-ui.js?v=${OUTREACH_ASSET_VERSION}&style-application=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1&writing-assistant=20261012-v1',
  'const DISCOVERY_REQUEST_TIMEOUT_MS=25000;',
  'const DISCOVERY_RUN_TIMEOUT_MIN_MS=120000;',
  'function discoveryRunTimeoutMs(',
  'async function withDiscoveryDeadline( const firstPool= const fitCache=new Map(); Checking purchasing fit maxDurationMs:DISCOVERY_REQUEST_TIMEOUT_MS*2 Completed evidence was kept.',
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
  'buyer-contacts-v21-full-roster Resume incomplete checks Identity discovery',
  'function buyerResearchCandidates( function buyerReviewEvidence( target:10,shortfall',
  "typeof response.text==='function'?response.text() Optional evidence review unavailable; individual source checks are retained timeoutMs:Math.min(DISCOVERY_REQUEST_TIMEOUT_MS,12000)",
  'const rolesRefreshBlocked= Saved people remain visible for review. candidate.people=rolesRefreshBlocked?candidate.people||[]:shortlist.people;',
  'Buying committee coverage incomplete 2 + 2 buying committee represented data-research-executive 20261005-committee-2plus2-v1',
  'buyer-actions=20261005-email-gate-v1 buyer-confirm-needed buyer-proceed-ready Select &amp; proceed LinkedIn messages are created inside Confirm LinkedIn.',
  'buyer-selection=20261005-bridge-v1 function selectedEmailBuyer( Synchronization conflict: recipient selection was not saved. scriptBuyer:choice,activeJourneyStage:6,visibleStep:6 data-buyer-selection-check await loadOutreachModules();',
  'const passages=candidate.people.slice(0,10) buyerResearchCandidates contact research attempted for all retained people top 4 ranked recommendations Contact checks complete: data-research-buyer data-research-remaining Unverified email patterns Profile matched automatically Phone source needs rechecking function matchBuyerRoleEvidence( publicPhoneSourceCheck',
  "type:'contact.linkedin_confirmed' channel:'linkedin' async function recheckBuyerEmailSources("
].join('\n');

test('production proof accepts the bounded staged Discovery runtime', async () => {
  const { verifyRelease, VERDICTS } = await loadCore();
  const proof = await verifyRelease({
    config,
    expectedSha: SHA,
    ciConclusion: 'success',
    ciRunId: '199',
    fetchImpl: productionFetch({
      customerHtml: `${shell}<script defer src="discovery-ui.js?v=current&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1"></script>`,
      discoveryUi: boundedDiscoveryRuntime
    }),
    nonce: 'intended-timeout-contract'
  });

  assert.equal(proof.verdict, VERDICTS.PROVEN, proof.failures.join('\n'));
});

test('production proof rejects anonymous access to private settings and workspace state',async()=>{
  const {verifyRelease,VERDICTS}=await loadCore();
  const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'privacy',fetchImpl:productionFetch({customerHtml:`${shell}<script defer src="discovery-ui.js?v=current&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1"></script>`,discoveryUi:boundedDiscoveryRuntime,privateSettingsStatus:200}),nonce:'anonymous-access-regression'});
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
      customerHtml: `${shell}<script defer src="discovery-ui.js?v=current&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1"></script>`,
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
      customerHtml: `${shell}<script defer src="discovery-ui.js?v=current&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1"></script>`,
      discoveryUi: [
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
  const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'201',fetchImpl:productionFetch({customerHtml:`${shell}<script defer src="discovery-ui.js?v=current&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1"></script>`,discoveryUi:boundedDiscoveryRuntime,sessionStatus:404}),nonce:'missing-session-proxy'});
  assert.notEqual(proof.verdict,VERDICTS.PROVEN);assert.ok(proof.failures.some(f=>f.includes('first-party-api-session')));
});

test('production proof blocks a missing controlled message editor asset',async()=>{
 const {verifyRelease,VERDICTS}=await loadCore(),base=productionFetch({customerHtml:`${shell}<script defer src="discovery-ui.js?v=current&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1"></script>`,discoveryUi:boundedDiscoveryRuntime});
 const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'203',fetchImpl:url=>new URL(url).pathname==='/customer/message-editor.js'?Promise.resolve(response({status:404,text:'missing'})):base(url),nonce:'missing-editor'});
 assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);assert.match(proof.failures.join(' '),/controlled-message-editor/);
});

test('production proof blocks a missing mandatory page-check engine',async()=>{
 const {verifyRelease,VERDICTS}=await loadCore(),normal=productionFetch({customerHtml:`${shell}<script defer src="discovery-ui.js?v=current&blank-preparation=20261011-v1&step6-recovery=20261011-v1&step6-subject=20261011-v1"></script>`,discoveryUi:boundedDiscoveryRuntime});const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'201',fetchImpl:async url=>new URL(String(url)).pathname==='/customer/page-quality.js'?response({status:404,text:'missing'}):normal(url),nonce:'page-check-missing'});assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);assert.ok(proof.failures.some(message=>message.includes('mandatory-page-checks-engine')));
});

test('production proof rejects anonymous access to script library',async()=>{
 const {verifyRelease,VERDICTS}=await loadCore(),normal=productionFetch({customerHtml:shell,discoveryUi:boundedDiscoveryRuntime});
 const proof=await verifyRelease({config,expectedSha:SHA,ciConclusion:'success',ciRunId:'script-auth',fetchImpl:async url=>new URL(String(url)).pathname==='/api/script-library'?response({status:200,json:{core:[]}}):normal(url),nonce:'script-auth'});
 assert.equal(proof.verdict,VERDICTS.BLOCKED_SMOKE_CHECK);assert.equal(proof.smokeChecks.find(c=>c.id==='script-library-auth').passed,false);
});
