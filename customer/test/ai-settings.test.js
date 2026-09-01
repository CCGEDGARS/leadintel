const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const jsPath=path.join(root,'ai-settings.js');
const cssPath=path.join(root,'ai-settings.css');
const js=fs.existsSync(jsPath)?fs.readFileSync(jsPath,'utf8'):'';
const css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';

test('Customer V2 loads a Settings drawer for exactly three customer-owned AI providers',()=>{
  assert.match(processMap,/import ['"]\.\/ai-settings\.js\?v=20260824-ai-providers['"]/);
  assert.equal(fs.existsSync(jsPath),true,'ai-settings.js must exist');
  assert.match(js,/id="open-settings"/);
  assert.match(js,/id="ai-settings-drawer"/);
  assert.match(js,/provider:'openai'[\s\S]*name:'OpenAI'/);
  assert.match(js,/provider:'anthropic'[\s\S]*name:'Anthropic'/);
  assert.match(js,/provider:'gemini'[\s\S]*name:'Google Gemini'/);
  const providerDefinitions=[...js.matchAll(/provider:'(openai|anthropic|gemini)'/g)].map(match=>match[1]);
  assert.deepEqual([...new Set(providerDefinitions)].sort(),['anthropic','gemini','openai']);
});

test('AI Settings supports status, test-and-save, activation and disconnect through workspace backend routes',()=>{
  assert.match(js,/\/api\/integrations\/ai\/status/);
  assert.match(js,/\/api\/integrations\/ai\/provider/);
  assert.match(js,/\/api\/integrations\/ai\/activate/);
  assert.match(js,/method:'PUT'/);
  assert.match(js,/method:'POST'/);
  assert.match(js,/method:'DELETE'/);
  assert.match(js,/Test & save/);
  assert.match(js,/Use this provider/);
  assert.match(js,/Disconnect/);
});

test('raw provider API keys are transient browser values and never persisted',()=>{
  assert.doesNotMatch(js,/localStorage/);
  assert.doesNotMatch(js,/sessionStorage/);
  assert.doesNotMatch(js,/setItem\s*\(/);
  assert.match(js,/type="password"/);
  assert.match(js,/\.value=''/);
});

test('AI settings CSS is cache-busted and controls have individual borders and focus treatment',()=>{
  assert.match(js,/SETTINGS_VERSION='20260824-ai-providers'/);
  assert.match(js,/link\.href=`ai-settings\.css\?v=\$\{SETTINGS_VERSION\}`/);
  assert.equal(fs.existsSync(cssPath),true,'ai-settings.css must exist');
  assert.match(css,/\.ai-settings-btn[\s\S]*border:\s*1px solid/i);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\.ai-settings-btn:disabled/);
});

test('provider save failures stay visible inside the provider card and do not clear the transient key',()=>{
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

test('AI Settings supports a direct ?settings=ai deep link that opens the drawer automatically',()=>{
  assert.match(js,/URLSearchParams\(window\.location\.search\)/,'settings module must inspect the page query string');
  assert.match(js,/\.get\(['"]settings['"]\)===['"]ai['"]/,'settings=ai must be the explicit deep-link contract');
  assert.match(js,/openDrawer\(\)/,'direct settings link must open the existing secure settings drawer');
});
