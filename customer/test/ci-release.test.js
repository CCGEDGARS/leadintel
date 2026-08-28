const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const backend=fs.readFileSync(path.join(root,'.github/workflows/backend-ci.yml'),'utf8');
const customer=fs.readFileSync(path.join(root,'.github/workflows/customer-ci.yml'),'utf8');
const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');

test('backend and customer CI protect main CRM releases',()=>{
  assert.match(backend,/branches:\s*[\s\S]*-\s*['"]?main['"]?/);
  assert.match(customer,/branches:\s*[\s\S]*-\s*['"]?main['"]?/);
  assert.match(backend,/node --check src\/crm\.js/);
  assert.match(backend,/node --check src\/crm-routes\.js/);
  assert.match(customer,/node --check customer\/crm-engine\.js/);
  assert.match(customer,/node --check customer\/crm-ui\.js/);
});

test('customer CI contains no retired GitHub Pages workflow dependency',()=>{
  assert.doesNotMatch(customer,/deploy-pages\.yml/);
});

test('README names current Vercel customer workspace and Cloudflare D1 backend',()=>{
  assert.match(readme,/https:\/\/leadintel\.ccgroup\.lv\/customer\//);
  assert.match(readme,/Vercel/i);
  assert.match(readme,/Cloudflare Worker \+ D1/i);
  assert.doesNotMatch(readme,/GitHub Pages fallback/i);
  assert.doesNotMatch(readme,/Production root:[^\n]*redirects to V2/i);
});
