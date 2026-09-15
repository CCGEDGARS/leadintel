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

test('Customer V2 loads the proven AI Settings plus the customer-owned Apollo and Firecrawl extension',()=>{
  assert.match(processMap,/import ['"]\.\/ai-settings\.js\?v=20260915-active-tools-summary-v1['"]/);
  assert.match(processMap,/import ['"]\.\/service-settings-extension\.js\?v=20260915-mail-choice-v2['"]/);
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
  assert.match(js,/method:'PUT'/);
  assert.match(js,/method:'POST'/);
  assert.match(js,/method:'DELETE'/);
  assert.match(js,/Test & save/);
  assert.match(js,/Set as active/);
  assert.match(js,/Disconnect/);
});

test('AI engine summary exposes a prominent active status badge',()=>{
  assert.match(js,/ai-engine-active-line/);
  assert.match(js,/ai-active-badge/);
  assert.match(js,/>ACTIVE</);
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

test('AI provider status clearly separates a connected credential from the active provider',()=>{
  assert.match(js,/Connected means the API key is verified/i,'settings copy must define connected');
  assert.match(js,/Active means LeadIntel is currently using that provider/i,'settings copy must define active');
  assert.match(js,/configured\?'Connected':'Not connected'/,'configured non-active providers must be labelled Connected, not Verified');
  assert.match(js,/Set as active/,'activation control must describe the state change explicitly');
  assert.match(js,/Active provider/,'summary or button must name the active-provider concept explicitly');
  assert.doesNotMatch(js,/configured\?'Verified':'Not connected'/,'Verified must not be used as the card state for a merely connected provider');
  assert.match(css,/\.ai-provider-status\.connected/,'connected providers must have a distinct badge treatment');
});

test('Apollo and Firecrawl use owner-controlled workspace service routes and editable customer-key fields',()=>{
  assert.match(extension,/\/api\/integrations\/services\/status/);
  assert.match(extension,/\/api\/integrations\/services\/provider/);
  assert.match(extension,/data-service-key="\$\{config\.provider\}"/);
  assert.match(extension,/provider:'apollo'/);
  assert.match(extension,/provider:'firecrawl'/);
  assert.match(extension,/Customer key/);
  assert.match(extension,/LeadIntel managed fallback/);
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
  assert.match(js,/SETTINGS_VERSION='20260915-active-tools-summary-v1'/);
  assert.match(extension,/SETTINGS_VERSION='20260915-mail-choice-v2'/);
  assert.match(js,/link\.href=`ai-settings\.css\?v=\$\{SETTINGS_VERSION\}`/);
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
  assert.match(js,/Continue with Microsoft/);
  assert.match(extension,/function connectGoogle\(\)/);
  assert.match(extension,/data-service-action="google-signin"/);
  assert.match(extension,/Connect with Google/);
  assert.match(extension,/Creates or opens your private LeadIntel workspace/);
  assert.match(extension,/searchParams\.set\('settings','ai'\)/,'Google connection must preserve return to Settings');
  assert.match(extension,/bridge\(\)\?\.signIn\?\.\(\)/,'Google connection must reuse the secure server bridge OAuth flow');
});

test('Settings clearly changes data integrations from platform-only to customer-owned with managed fallback',()=>{
  assert.match(extension,/Data & intelligence integrations/);
  assert.match(extension,/Add your own Apollo and Firecrawl API keys/);
  assert.match(extension,/Customer-owned credential/);
  assert.match(extension,/serviceDetail/);
  assert.match(extension,/meta\.textContent=serviceDetail/,'customer-owned status must replace stale Platform managed metadata');
});

test('Settings retains the integration control centre and adds LeadIntel readiness for customer-owned services',()=>{
  assert.match(js,/id="integration-health-summary"/,'settings must expose a top-level integration health summary');
  assert.match(js,/id="test-all-integrations"/,'settings must provide one diagnostic action');
  assert.match(js,/Test all integrations/);
  assert.match(js,/id="integration-platform-grid"/);
  assert.match(js,/id="integration-communication-grid"/);
  for(const name of ['Apollo.io','Firecrawl','Google Account','Gmail'])assert.match(js,new RegExp(name.replace('.','\\.')));
  assert.match(extension,/LeadIntel readiness/);
  assert.match(extension,/LeadIntel readiness: \$\{Number\(aiReady\)\+1\+Number\(deliveryReady\)\+serviceReady\}\/5 connected/);
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
