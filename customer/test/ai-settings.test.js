const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const jsPath=path.join(root,'ai-settings.js');
const cssPath=path.join(root,'ai-settings.css');
const js=fs.existsSync(jsPath)?fs.readFileSync(jsPath,'utf8'):'';
const css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';

test('Customer V2 exposes a Settings drawer for exactly three customer-owned AI providers',()=>{
  assert.match(index,/id="open-settings"/);
  assert.match(index,/id="ai-settings-drawer"/);
  assert.equal(fs.existsSync(jsPath),true,'ai-settings.js must exist');
  assert.match(js,/provider:'openai'[\s\S]*name:'OpenAI'/);
  assert.match(js,/provider:'anthropic'[\s\S]*name:'Anthropic'/);
  assert.match(js,/provider:'gemini'[\s\S]*name:'Google Gemini'/);
  assert.doesNotMatch(js,/provider:'[^']+'[\s\S]*provider:'[^']+'[\s\S]*provider:'[^']+'[\s\S]*provider:'[^']+'/,'only three first-class providers should be rendered');
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
  assert.match(js,/input\.value=''/);
});

test('AI settings assets are cache-busted and controls have individual borders and focus treatment',()=>{
  assert.match(index,/ai-settings\.css\?v=20260824-ai-providers/);
  assert.match(index,/ai-settings\.js\?v=20260824-ai-providers/);
  assert.equal(fs.existsSync(cssPath),true,'ai-settings.css must exist');
  assert.match(css,/\.ai-settings-btn[\s\S]*border:\s*1px solid/i);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\.ai-settings-btn:disabled/);
});
