const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('all entry points use a single URL for each research and identity module',()=>{
  const files=['index.html','app.js','process-map.js','company-research-ui.js','company-research-security.js','delivery-ui.js'];
  const content=files.map(f=>{const source=fs.readFileSync(path.join(__dirname,'..',f),'utf8');const version=source.match(/ASSET_VERSION=["']([^"']+)/)?.[1];return version?source.replace(/asset\('([^']+)'\)/g,(_,asset)=>`${asset}?v=${version}`):source;}).join('\n');
  for(const file of ['business-identity.js','company-research-ui.js','company-research-engine.js','content-language.js','content-variants.js','server-bridge.js']){
    const refs=content.match(new RegExp(file.replaceAll('.','\\.')+'\\?v=[a-zA-Z0-9-]+','g'))||[];
    assert.ok(refs.length>1,file+' must be checked across entry points');
    assert.equal(new Set(refs).size,1,file+' must not execute under multiple module identities');
  }
});
