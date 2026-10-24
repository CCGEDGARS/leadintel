const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
// 23.10 live defect: after a successful Firecrawl "Test & save" the card badge kept "NOT CONNECTED" and readiness did not move
// until a later refresh, because decorateCards() prefers the cached LeadIntelIntegrationHealth label over the fresh row.
test('a saved or removed service key drops the stale health observation and asks for a re-check',()=>{
  const ext=read('service-settings-extension.js');
  assert.match(ext,/function credentialChanged\(provider\)\{if\(window\.LeadIntelIntegrationHealth&&provider in window\.LeadIntelIntegrationHealth\)window\.LeadIntelIntegrationHealth\[provider\]=null;window\.dispatchEvent\(new CustomEvent\('leadintel:service-credential-changed',\{detail:\{provider\}\}\)\);\}/);
  assert.match(ext,/Provider verification failed'\);if\(input\)input\.value='';credentialChanged\(provider\);await refreshServiceStatus\(false\);/,'save path');
  assert.match(ext,/Unable to disconnect provider'\);errors\[provider\]='';credentialChanged\(provider\);await refreshServiceStatus\(false\);/,'disconnect path');
  assert.match(ext,/addEventListener\('leadintel:integration-health',\(\)=>queueDecorate\(true\)\)/,'re-decorate when the health check lands');
  const ai=read('ai-settings.js');
  assert.match(ai,/window\.LeadIntelIntegrationHealth=\{apollo,firecrawl\};window\.dispatchEvent\(new CustomEvent\('leadintel:integration-health'\)\);/);
  assert.match(ai,/addEventListener\('leadintel:service-credential-changed',\(\)=>\{if\(signedIn\(\)\)void refreshIntegrationStatus\(\);\}\)/);
  for(const file of ['shell-support-loader.js','process-map.js'])assert.match(read(file),/service-settings-extension\.js\?[^'"]*badge-refresh=20261024-v1/,file);
  assert.match(read('index.html'),/ai-settings\.js\?[^"]*badge-refresh=20261024-v1/);
  assert.match(read('process-map.js'),/ai-settings\.js\?[^'"]*badge-refresh=20261024-v1/);
});
