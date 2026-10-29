const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const jsPath=path.join(root,'ai-settings.js');
const cssPath=path.join(root,'ai-settings.css');
const extensionPath=path.join(root,'service-settings-extension.js');
const extensionCssPath=path.join(root,'service-settings-extension.css');
const js=fs.existsSync(jsPath)?fs.readFileSync(jsPath,'utf8'):'';
const css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';
const extension=fs.existsSync(extensionPath)?fs.readFileSync(extensionPath,'utf8'):'';
const extensionCss=fs.existsSync(extensionCssPath)?fs.readFileSync(extensionCssPath,'utf8'):'';

test('Customer V2 loads AI Settings plus the customer-owned service extension',()=>{
  assert.match(processMap,/import ['"]\.\/ai-settings\.js\?v=20260915-model-choice-v1&app-dialogs=20261017-v1&badge-refresh=20261024-v1&paid-controls=20261029-v1['"]/);
  assert.match(processMap,/import ['"]\.\/service-settings-extension\.js\?v=20260925-provider-credit-health-v1&optional-hunter=20261004-v1&app-dialogs=20261017-v1&badge-refresh=20261024-v1&paid-controls=20261029-v1['"]/);
  assert.equal(fs.existsSync(jsPath),true,'ai-settings.js must exist');
  assert.equal(fs.existsSync(extensionPath),true,'service-settings-extension.js must exist');
  assert.match(js,/id="open-settings"/);
  assert.match(js,/id="ai-settings-drawer"/);
  for(const provider of [["openai","OpenAI"],["anthropic","Anthropic"],["gemini","Google Gemini"]])assert.match(js,new RegExp(`provider:'${provider[0]}'[\\s\\S]*name:'${provider[1]}'`));
  for(const provider of [["apollo","Apollo.io"],["firecrawl","Firecrawl"]])assert.match(extension,new RegExp(`provider:'${provider[0]}'[\\s\\S]*name:'${provider[1].replace('.','\\.')}'`));
});

test('AI Settings supports status, test-and-save, activation and disconnect through workspace backend routes',()=>{
  assert.match(js,/\/api\/integrations\/ai\/status/);
  assert.match(js,/\/api\/integrations\/ai\/provider/);
  assert.match(js,/\/api\/integrations\/ai\/activate/);
  assert.match(js,/method:updatingModel\?'PATCH':'PUT'/);
  assert.match(js,/method:'POST'/);
  assert.match(js,/method:'DELETE'/);
  assert.match(js,/Test & save/);
  assert.match(js,/Make main engine/);
  assert.match(js,/Disconnect/);
});

test('AI engine summary exposes a prominent active status badge',()=>{
  assert.match(js,/ai-engine-active-line/);
  assert.match(js,/ai-active-badge/);
  assert.match(js,/>MAIN ENGINE</);
  assert.match(css,/ai-active-badge/);
});

test('Active tools summary is status-only and keeps account sign-out on the selected account card',()=>{
  assert.match(js,/function activeToolsSummary\(active\)/);
  assert.match(js,/Active tools/);
  assert.match(js,/active-tools-list/);
  assert.match(js,/Manage every connection in its card below/);
  assert.doesNotMatch(js,/function workspaceAccessControls/);
  assert.match(js,/function workspaceProviderAction\(provider\)[\s\S]*data-settings-signout/);
  assert.match(css,/\.active-tools-list/);
  assert.match(css,/\.active-tool-chip/);
});

test('model selection is a curated list per provider: strongest, balanced (recommended) and low cost, no free-text model IDs',()=>{
  // CTO decision 2026-10-25: LeadIntel decides which models a workspace may use; prices shown per 1M tokens.
  assert.match(js,/data-ai-model-choice/);
  assert.doesNotMatch(js,/data-ai-model-mode|data-ai-custom-model|Advanced · custom model ID/);
  for(const id of ['gpt-6-astra','gpt-6.1-sol','gpt-6-luna','claude-fable-5-1','claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5','gemini-3.1-pro-preview','gemini-3.8-flash','gemini-2.5-flash-lite'])assert.match(js,new RegExp(`id:'${id.replace(/\./g,'\\.')}'`));
  assert.match(js,/function modelOptionLabel\(entry\)\{return `\$\{entry\.label\} · \$\{entry\.role\} · \$\$\{entry\.input\} \/ \$\$\{entry\.output\} per 1M tokens`;\}/);
  assert.match(js,/· saved earlier</,'a model saved before the list stays selectable');
  assert.match(js,/role:'balanced · recommended',input:'2\.00',output:'10\.00'\}/);
  assert.match(js,/method:updatingModel\?'PATCH':'PUT'/);
  assert.match(js,/configured\?'Save & test model':'Test & save'/);
  assert.doesNotMatch(js,/Fast & economical|Highest quality/);
  assert.match(css,/\.ai-custom-model\[hidden\]/);
  assert.match(css,/select:focus-visible/);
});

test('AI provider status clearly separates a connected credential from the active provider',()=>{
  assert.match(js,/Connected means the API key is verified/i,'settings copy must define connected');
  assert.match(js,/Main engine means LeadIntel uses that provider/i,'settings copy must define active');
  assert.match(js,/configured\?'Connected · inactive':'Not connected'/,'configured non-active providers must be labelled Connected, not Verified');
  assert.match(js,/Make main engine/,'activation control must describe the state change explicitly');
  assert.match(js,/Main engine/,'summary or button must name the active-provider concept explicitly');
  assert.doesNotMatch(js,/configured\?'Verified':'Not connected'/,'Verified must not be used as the card state for a merely connected provider');
  assert.match(css,/\.ai-provider-status\.connected/,'connected providers must have a distinct badge treatment');
});

test('Service integrations use owner-controlled workspace routes and editable customer-key fields',()=>{
  assert.match(extension,/\/api\/integrations\/services\/status/);
  assert.match(extension,/\/api\/integrations\/services\/provider/);
  assert.match(extension,/data-service-key="\$\{config\.provider\}"/);
  assert.match(extension,/provider:'apollo'/);
  assert.match(extension,/provider:'firecrawl'/);
  assert.match(extension,/Your account · billed by provider/);
  assert.doesNotMatch(extension,/LeadIntel managed fallback/);
  assert.match(extension,/Replace key/);
  assert.match(extension,/Disconnect/);
});

test('raw API keys are transient browser values and never persisted by either settings module',()=>{
  for(const source of [js,extension]){
    assert.doesNotMatch(source,/localStorage/);
    assert.doesNotMatch(source,/sessionStorage/);
    assert.doesNotMatch(source,/setItem\s*\(/);
  }
  assert.match(js,/type="password"/);
  assert.match(extension,/type="password"/);
  assert.match(js,/\.value=''/);
  assert.match(extension,/input\.value=''/);
  assert.doesNotMatch(extension,/APOLLO_API_KEY|FIRECRAWL_API_KEY|OAUTH_TOKEN_ENCRYPTION_KEY/);
});

test('settings assets are cache-busted and controls have individual borders and focus treatment',()=>{
  assert.match(js,/SETTINGS_VERSION='20261014-microsoft-all-entrypoints-v5'/);
  assert.match(js,/provider:'openai',name:'OpenAI',model:'gpt-6\.1-sol'/);
  assert.match(extension,/SETTINGS_VERSION='20261012-visible-apollo-key-v1'/);
  assert.match(js,/link\.href=`ai-settings\.css\?v=\$\{SETTINGS_VERSION\}&tool-links=20261011-v1&alert-colours=20261011-v1&uniform-actions=20261012-v1&account-layout=20261012-v1`/);
  assert.match(extension,/link\.href=`service-settings-extension\.css\?v=\$\{SETTINGS_VERSION\}`/);
  assert.equal(fs.existsSync(cssPath),true,'ai-settings.css must exist');
  assert.equal(fs.existsSync(extensionCssPath),true,'service-settings-extension.css must exist');
  assert.match(css,/\.ai-settings-btn[\s\S]*border:\s*1px solid/i);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\.ai-settings-btn:disabled/);
});

test('AI provider save failures stay visible inside the provider card and do not clear the transient key',()=>{
  assert.match(js,/providerErrors/,'provider-specific errors must be tracked in transient memory');
  assert.match(js,/ai-provider-error/,'provider cards must render an inline error area');
  assert.match(js,/providerErrors\[provider\]=error\.message/,'save failures must populate the inline provider error');
  const saveStart=js.indexOf('async function saveProvider(provider)');
  const activateStart=js.indexOf('async function activateProvider(provider)');
  assert.ok(saveStart>=0&&activateStart>saveStart,'saveProvider function must be present before activateProvider');
  const saveFlow=js.slice(saveStart,activateStart);
  assert.doesNotMatch(saveFlow,/busy=provider;render\(\)/,'saving must not re-render the card before the request finishes');
  assert.match(saveFlow,/api\('\/api\/integrations\/ai\/provider'/,'save flow must call the provider endpoint');
  assert.match(css,/\.ai-provider-error[\s\S]*color:\s*var\(--ai-danger\)/i,'inline provider errors must be visibly styled');
});

test('service provider failures stay inline and a failed save does not clear the key field',()=>{
  assert.match(extension,/const errors=Object\.create\(null\)/);
  assert.match(extension,/data-service-error/);
  const saveStart=extension.indexOf('async function saveService(provider,button)');
  const disconnectStart=extension.indexOf('async function disconnectService(provider)');
  assert.ok(saveStart>=0&&disconnectStart>saveStart);
  const saveFlow=extension.slice(saveStart,disconnectStart);
  assert.match(saveFlow,/input\.value=''/,'successful service save must clear transient key');
  assert.match(saveFlow,/catch\(cause\)[\s\S]*errors\[provider\]/,'failed save must preserve the field and show an error');
});

test('AI Settings supports a direct ?settings=ai deep link that opens the drawer automatically',()=>{
  assert.match(js,/URLSearchParams\(window\.location\.search\)/,'settings module must inspect the page query string');
  assert.match(js,/\.get\(['"]settings['"]\)===['"]ai['"]/,'settings=ai must be the explicit deep-link contract');
  assert.match(js,/openDrawer\(\)/,'direct settings link must open the existing secure settings drawer');
});

test('signed-out Settings exposes Google and Microsoft onboarding while retaining the Google Account card',()=>{
  assert.match(js,/id="ai-settings-signin"/,'signed-out summary must render direct sign-in choices');
  assert.match(js,/Continue with Google/);
  assert.match(js,/Sign in with Microsoft/);
  assert.match(extension,/function connectGoogle\(\)/);
  assert.match(extension,/data-service-action="google-signin"/);
  assert.match(extension,/Connect with Google/);
  assert.match(extension,/Creates or opens your private LeadIntel workspace/);
  assert.match(extension,/searchParams\.set\('settings','ai'\)/,'Google connection must preserve return to Settings');
  assert.match(extension,/bridge\(\)\?\.signIn\?\.\(\)/,'Google connection must reuse the secure server bridge OAuth flow');
});

test('Settings clearly changes data integrations from platform-only to customer-owned without managed fallback',()=>{
  assert.match(extension,/Data & intelligence integrations/);
  assert.match(extension,/Firecrawl reads public websites for research; Treg finds and verifies buyer work e-mails and researches phone numbers with separate permissions/);
  assert.match(extension,/No shared paid-service fallback is available/);
  assert.match(extension,/Customer-owned credential/);
  assert.match(extension,/serviceDetail/);
  assert.match(extension,/meta\.textContent=observed\?\.detail\|\|serviceDetail/,'live Firecrawl failures must take precedence over the saved credential metadata');
});

test('Settings retains the integration control centre and adds LeadIntel readiness for customer-owned services',()=>{
  assert.match(js,/id="integration-health-summary"/,'settings must expose a top-level integration health summary');
  assert.match(js,/id="test-all-integrations"/,'settings must provide one diagnostic action');
  assert.match(js,/Test all integrations/);
  assert.match(js,/id="integration-platform-grid"/);
  assert.match(js,/id="integration-communication-grid"/);
  for(const name of ['Firecrawl','Google Account','Gmail'])assert.match(js,new RegExp(name.replace('.','\\.')));
  assert.match(extension,/LeadIntel readiness/);
  assert.match(extension,/optional tools connected/);
  assert.doesNotMatch(extension,/\}\/6 connected/,'readiness no longer divides a growing numerator by a fixed 6');
});

test('service diagnostics use verification status and never run research or enrichment just to test settings',()=>{
  assert.match(extension,/status\$\{verify\?'\?verify=1':''\}/,'Apollo and Firecrawl diagnostics should use backend verification status');
  assert.match(js,/\/api\/integrations\/gmail\/status/,'Gmail health should use its existing status endpoint');
  assert.doesNotMatch(extension,/\/api\/ai\/(generate|web-search)/,'service diagnostic must not spend AI usage');
  assert.doesNotMatch(extension,/firecrawl-(search|scrape|crawl|map)/,'service diagnostic must not trigger Firecrawl research');
  assert.doesNotMatch(extension,/enrich-contact/,'service diagnostic must not trigger Apollo enrichment');
});

test('service settings observer only re-decorates when the host UI removed customer controls',()=>{
  assert.match(extension,/function needsDecoration\(\)/);
  assert.match(extension,/MutationObserver\(\(\)=>\{if\(needsDecoration\(\)\)queueDecorate\(\);\}\)/);
  assert.match(extension,/if\(!force&&!needsDecoration\(\)\)return/);
});

test('integration control centre has dedicated readable service-card and Google connection styling',()=>{
  assert.match(css,/\.integration-health-summary/);
  assert.match(css,/\.integration-card/);
  assert.match(css,/\.integration-status/);
  assert.match(css,/\.integration-grid/);
  assert.match(extensionCss,/\.service-provider-card/);
  assert.match(extensionCss,/\.service-source/);
  assert.match(extensionCss,/\.service-readiness-note/);
  assert.match(extensionCss,/\.google-connect-panel/);
  assert.match(extensionCss,/@media\s*\(max-width:/);
});

test('Integration Control Centre offers Microsoft workspace access and Microsoft 365 mail controls',()=>{
  assert.match(js,/data-settings-signin="google"/,'Google must remain an explicit workspace sign-in choice');
  assert.match(js,/data-settings-signin="microsoft"/,'Microsoft must be an explicit workspace sign-in choice');
  assert.match(js,/bridge\(\)\?\.signIn\?\.\(provider\)/,'the selected identity provider must be passed to the server bridge');
  assert.match(js,/data-integration="microsoft-account"/,'communication status must include Microsoft workspace identity');
  assert.match(js,/data-integration="microsoft-mail"/,'communication status must include Microsoft 365 mail');
  assert.match(js,/data-microsoft-mail-action="connect"/,'Microsoft mail must be connectable from Settings');
  assert.match(js,/data-microsoft-mail-action="disconnect"/,'Microsoft mail must be disconnectable from Settings');
  assert.match(js,/send-only/i,'Settings must explain that Microsoft cannot read the inbox');
  assert.match(css,/\.workspace-signin-options/,'the two sign-in choices must have responsive layout styling');
  assert.match(css,/\.microsoft-mail-actions/,'Microsoft mail controls must have dedicated layout styling');
});

test('Test & save confirmation names the provider, the cost scale and what happens to the main engine',()=>{
  const start=js.indexOf('function providerSaveConfirmation(');
  assert.ok(start>=0,'providerSaveConfirmation helper must exist');
  const end=js.indexOf('\n}',start);
  const helper=new Function(`${js.slice(start,end+2)}; return providerSaveConfirmation;`)();
  const first=helper({name:'OpenAI',model:'gpt-6.1-sol',configured:false,hasMain:false});
  assert.equal(first.options.title,'Test & save OpenAI');
  assert.equal(first.options.action,'Test & save');
  assert.match(first.message,/one tiny test request to OpenAI with gpt-6.1-sol/);
  assert.match(first.message,/a few tokens, billed to your key, well under a cent/);
  assert.match(first.message,/OpenAI becomes your main engine/);
  assert.doesNotMatch(first.message,/existing main engine stays/);
  const second=helper({name:'Anthropic',model:'claude-fable-5-1',configured:false,hasMain:true});
  assert.match(second.message,/current main engine stays selected/);
  assert.match(second.message,/switch to Anthropic/);
  assert.doesNotMatch(second.message,/becomes your main engine/);
  const retest=helper({name:'OpenAI',model:'gpt-6.1-sol',configured:true,hasMain:true});
  assert.match(retest.message,/saved model changes only if the test succeeds/);
  assert.doesNotMatch(retest.message,/stays selected|becomes your main engine/);
  const saveStart=js.indexOf('async function saveProvider(provider)');
  const saveFlow=js.slice(saveStart,js.indexOf('async function activateProvider(provider)'));
  assert.match(saveFlow,/const hasMain=status\.providers\.some\(p=>p\.active\)/,'the save flow must read whether a main engine exists before asking');
  assert.match(saveFlow,/providerSaveConfirmation\(\{name:config\.name,model,configured,hasMain\}\)/);
  assert.match(saveFlow,/LeadIntelDialogs\?\.confirm\(confirmation\.message,confirmation\.options\)/);
  assert.doesNotMatch(saveFlow,/small paid API request|existing main engine stays/);
});

test('Active tools lists every customer-owned tool that is ready, from the fast status before verification completes',()=>{
  const start=js.indexOf('function activeToolItemsFrom(');
  assert.ok(start>=0,'activeToolItemsFrom helper must exist');
  const end=js.indexOf('\n}',start);
  const helper=new Function(`${js.slice(start,end+2)}; return activeToolItemsFrom;`)();
  const rows=[{provider:'apollo',configured:false,source:'none',state:'neutral'},{provider:'firecrawl',configured:true,source:'customer',state:'good'},{provider:'hunter',configured:true,source:'customer',state:'good'},{provider:'treg',configured:true,source:'customer',state:'good'}];
  const active={name:'OpenAI',model:'gpt-6.1-sol'};
  const cold=helper({active,integrations:{},serviceRows:rows,calendly:{connected:true}});
  assert.deepEqual(cold.map(i=>i.name),['OpenAI','Firecrawl','Treg','Calendly']);
  assert.deepEqual(cold.map(i=>i.state),['ACTIVE','READY','READY','CONNECTED']);
  const verifiedBad=helper({active,integrations:{firecrawl:{source:'customer',state:'bad'}},serviceRows:rows,calendly:null});
  assert.deepEqual(verifiedBad.map(i=>i.name),['OpenAI','Treg'],'a failed verification hides Firecrawl even when the cached row says good');
  const platform=helper({active:null,integrations:{gmail:{state:'good'}},serviceRows:[{provider:'apollo',configured:true,source:'platform',state:'good'}],calendly:{connected:false}});
  assert.deepEqual(platform.map(i=>i.name),['Gmail'],'platform-owned rows are not the customer\'s tools');
  const apollo=helper({active:null,integrations:{},serviceRows:[{provider:'apollo',configured:true,source:'customer',state:'good'}],calendly:null});
  assert.deepEqual(apollo.map(i=>i.name),['Apollo.io']);
  assert.match(js,/function activeToolItems\(active\)\{[\s\S]{0,400}LeadIntelServiceIntegrationStatus[\s\S]{0,300}LeadIntelCalendlyStatus/);
  assert.match(js,/addEventListener\('leadintel:service-status',\(\)=>\{renderIntegrationMonitoring\(\);renderActiveToolsSummary\(\);\}\)/);
  assert.match(js,/addEventListener\('leadintel:calendly-status',\(\)=>renderActiveToolsSummary\(\)\)/);
  assert.match(extension,/window\.LeadIntelCalendlyStatus=/);
  assert.match(extension,/new CustomEvent\('leadintel:calendly-status'\)/);
});

test('one definition of critical: main engine, sign-in, sending mailbox and Firecrawl drive the health line, the Test all toast and the cold load',()=>{
  const start=js.indexOf('function criticalChecksFrom(');
  assert.ok(start>=0,'criticalChecksFrom helper must exist');
  const end=js.indexOf('\n}',start);
  const helper=new Function(`${js.slice(start,end+2)}; return criticalChecksFrom;`)();
  const checks=helper({activeAi:true,identity:true,deliveryReady:false,firecrawlGood:true});
  assert.deepEqual(checks.map(check=>check.key),['ai','identity','delivery','firecrawl']);
  assert.deepEqual(checks.map(check=>check.ok),[true,true,false,true]);
  assert.match(js,/function criticalChecks\(\)\{[\s\S]{0,700}LeadIntelServiceIntegrationStatus[\s\S]{0,400}criticalChecksFrom\(/,'the live check falls back to the fast Firecrawl row before verification');
  assert.match(js,/const critical=criticalChecks\(\)\.map\(check=>check\.ok\);const healthy=critical\.filter\(Boolean\)\.length;/);
  const testAll=js.slice(js.indexOf('async function testAllIntegrations('),js.indexOf('async function handleProviderAction('));
  assert.match(testAll,/const checks=criticalChecks\(\);toast\(`\$\{checks\.filter\(check=>check\.ok\)\.length\}\/\$\{checks\.length\} critical checks passing`\)/);
  assert.doesNotMatch(testAll,/apollo/,'Apollo is optional and never a critical check');
  assert.doesNotMatch(js,/\/5 critical checks passing/);
  const readiness=extension.slice(extension.indexOf('function decorateReadiness('),extension.indexOf('function decorateGoogleCard('));
  assert.match(readiness,/config\.provider!=='firecrawl'/,'optional tools exclude Firecrawl, which is critical');
  assert.match(readiness,/calendlyStatus\.connected/);
  assert.match(readiness,/\.replace\(\/[^)]*optional tools connected/,'re-decoration strips its own suffix before appending');
  assert.doesNotMatch(readiness,/aiReady|deliveryReady|serviceReady/,'the extension no longer recomputes the critical checks from the DOM');
  assert.match(readiness,/Firecrawl needs attention/,'an observed Firecrawl failure still stays visible');
});

test('a failed AI status check keeps the last known engines and says so; before the first answer the cards say Checking, not Not connected',()=>{
  const start=js.indexOf('function providerStateLabel(');
  assert.ok(start>=0,'providerStateLabel helper must exist');
  const end=js.indexOf('\n}',start);
  const label=new Function(`${js.slice(start,end+2)}; return providerStateLabel;`)();
  assert.equal(label({current:{pending:true},provider:'openai'}),'Checking…');
  assert.equal(label({current:null,provider:'openai'}),'Not connected');
  assert.equal(label({current:{configured:true,active:true},provider:'openai'}),'Main engine');
  assert.equal(label({current:{configured:true,active:false},provider:'anthropic'}),'Connected · inactive');
  assert.equal(label({current:{configured:true,active:false},provider:'gemini'}),'Connected · specialist');
  assert.equal(label({current:{configured:true,active:false,credit_issue:{code:'credits_exhausted'}},provider:'openai'}),'Credits exhausted');
  assert.equal(label({current:{configured:true,active:true},paymentIssue:true,provider:'openai'}),'Payment required');
  assert.equal(label({current:{pending:true},paymentIssue:true,provider:'openai'}),'Payment required','a payment failure outranks the pending state');
  const refreshStart=js.indexOf('async function refreshStatus(');
  const refresh=js.slice(refreshStart,refreshStart+1100);
  assert.doesNotMatch(refresh,/catch\(error\)\{[^}]*status=\{role:workspace\(\)\?\.role\|\|'',providers:\[\]\}/,'a failed check must not erase the last known providers');
  assert.match(refresh,/statusUnavailable=String\(error\.message\|\|error\)/);
  assert.match(refresh,/statusKnown=true;statusUnavailable='';/);
  assert.match(js,/could not be checked just now/);
  assert.match(js,/function providerCard\(config,current\)\{/,'the card signature stays as sandboxed tests slice it');
  assert.match(js,/providerStateLabel\(\{current,paymentIssue,provider:config\.provider\}\)/);
  assert.match(js,/providerCard\(config,providerState\(config\.provider\)\|\|\(statusKnown\?null:\{pending:true\}\)\)/,'the live renderer marks rows pending until the first status answer');
  assert.match(js,/leadintel:workspace-changed[^\n]{0,200}statusKnown=false;statusUnavailable='';/);
});
