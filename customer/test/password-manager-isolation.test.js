const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const ai=fs.readFileSync(path.join(root,'ai-settings.js'),'utf8');
const services=fs.readFileSync(path.join(root,'service-settings-extension.js'),'utf8');
const market=fs.readFileSync(path.join(root,'custom-market-input-hygiene.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('closed Settings drawer never leaves API credential password controls mounted in the page',()=>{
  assert.match(ai,/function settingsDrawerOpen\(\)/,'AI settings must know whether the drawer is actually visible');
  assert.match(ai,/function unmountCredentialControls\(\)/,'AI settings must explicitly remove credential controls when closed');
  assert.match(ai,/if\(!settingsDrawerOpen\(\)\)\{unmountCredentialControls\(\);return;/,'hidden Settings must not render provider credential fields');
  assert.match(ai,/function closeDrawer\([\s\S]*unmountCredentialControls\(\)/,'closing Settings must purge credential inputs from the DOM');
  assert.match(services,/function settingsDrawerOpen\(\)/,'service extension must share the drawer visibility contract');
  assert.match(services,/if\(!settingsDrawerOpen\(\)\)return false;/,'hidden Settings must not request service-card decoration');
  assert.match(services,/function decorateCards\(\)\{[\s\S]*if\(!settingsDrawerOpen\(\)\)return;/,'hidden Settings must not mount Apollo or Firecrawl key inputs');
});

test('API key inputs are marked as non-login secrets for password-manager heuristics',()=>{
  for(const [label,source] of [['AI',ai],['service',services]]){
    assert.match(source,/autocomplete="new-password"/,`${label} API-key input must not advertise a reusable login password`);
    assert.match(source,/data-form-type="other"/,`${label} API-key input must opt out of form-login classification`);
    assert.match(source,/data-lpignore="true"/,`${label} API-key input must opt out of LastPass-style credential capture`);
    assert.match(source,/data-1p-ignore="true"/,`${label} API-key input must opt out of 1Password-style credential capture`);
  }
});

test('custom market control remains non-credential and the fixed guard is cache-busted',()=>{
  assert.match(market,/setAttribute\("data-form-type","other"\)/);
  assert.match(market,/setAttribute\("data-lpignore","true"\)/);
  assert.match(market,/setAttribute\("data-1p-ignore","true"\)/);
  assert.match(processMap,/custom-market-input-hygiene\.js\?v=20260903-password-manager-isolation-v5/);
});
