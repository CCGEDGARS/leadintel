const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const proxy=fs.readFileSync(path.join(__dirname,'..','..','proxy.js'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'..','..','backend','src','security.js'),'utf8');

test('both backend boundaries recognize only LeadIntel Vercel preview hosts',()=>{
  const pattern=/\^leadintel\(\?:-git\)\?-/;
  assert.match(proxy,pattern);
  assert.match(backend,pattern);
  for(const source of [proxy,backend]){
    assert.match(source,/ccgedgars-projects\\\.vercel\\\.app/);
    assert.match(source,/url\.protocol === ['"]https:['"]/);
    assert.match(source,/!url\.port/);
  }
});

test('the provider proxy keeps an explicit production allowlist',()=>{
  assert.match(proxy,/https:\/\/leadintel\.ccgroup\.lv/);
  assert.match(proxy,/ALLOWED_ORIGINS\.has\(origin\)/);
});
