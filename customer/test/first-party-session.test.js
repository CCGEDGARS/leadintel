const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..','..');
test('all authenticated worker API requests use first-party cookies, preserving request options',async()=>{
  const calls=[];const window={location:{origin:'https://leadintel.ccgroup.lv'},fetch:async(...args)=>{calls.push(args);return {ok:true};},URL,Request};
  vm.runInNewContext(fs.readFileSync(path.join(root,'customer/api-transport.js'),'utf8'),{window,URL,Request});
  const options={method:'POST',body:'{"workspace":"one"}',headers:{'Idempotency-Key':'request-1'},credentials:'include'};
  await window.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/customer/state?workspace_id=one',options);
  assert.equal(calls[0][0],'https://leadintel.ccgroup.lv/api/customer/state?workspace_id=one');assert.equal(calls[0][1].body,options.body);assert.equal(calls[0][1].credentials,'include');
  await window.fetch('https://example.com/api/data');assert.equal(calls[1][0],'https://example.com/api/data');
  await window.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/customer/brand-assets/public-id');assert.match(calls[2][0],/^https:\/\/leadintel.ccgroup.lv\/api\//);
});
test('first-party transport loads before every integration and sign-in starts on the app origin',()=>{
  const html=fs.readFileSync(path.join(root,'customer/index.html'),'utf8');assert.ok(html.indexOf('api-transport.js')<html.indexOf('<script defer'));
  const bridge=fs.readFileSync(path.join(root,'customer/server-bridge.js'),'utf8');assert.match(bridge,/LeadIntelApiTransport\?\.firstPartyUrl\(legacy\)/);
});

test('both Vercel root modes include the first-party API function',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'customer/vercel.json'),'utf8'));
  assert.ok(config.rewrites.some(r=>r.source==='/api/:route*'&&r.destination==='/api/backend?route=:route*'));
  assert.ok(fs.existsSync(path.join(root,'customer/api/backend.mjs')));
  assert.match(fs.readFileSync(path.join(root,'scripts/build-vercel-static.sh'),'utf8'),/rm -rf \.vercel-static\/customer\/api/);
});
