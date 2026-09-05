const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('all entry points use a single URL for each research and identity module',()=>{
  const files=['index.html','app.js','process-map.js','company-research-ui.js','company-research-security.js'];
  const content=files.map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n');
  for(const file of ['business-identity.js','company-research-ui.js','company-research-engine.js','content-language.js']){
    const refs=content.match(new RegExp(file.replaceAll('.','\\.')+'\\?v=[a-zA-Z0-9-]+','g'))||[];
    assert.ok(refs.length>1,file+' must be checked across entry points');
    assert.equal(new Set(refs).size,1,file+' must not execute under multiple module identities');
  }
});
