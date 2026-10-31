const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..'),config=JSON.parse(fs.readFileSync(path.join(root,'release-integrity.config.json'),'utf8'));
const targets=new Set(['app.js','delivery-engine.js','delivery-ui.js','discovery-ui.js','email-campaign-ui.js','outreach-automation-delivery-handoff.js','outreach-automation-loader.js','outreach-automation-ui.js','outreach-engine.js','outreach-ui.js','process-map.js','production-gmail-ui.js','server-bridge.js','setup-operation-trace.js','shell-support-loader.js']);
test('Delivery static entry and recursive browser loader references all invalidate their changed dependency',()=>{
 let references=0;for(const name of fs.readdirSync(path.join(root,'customer')).filter(name=>/\.(js|html|css)$/.test(name))){const source=fs.readFileSync(path.join(root,'customer',name),'utf8');
  for(const match of source.matchAll(/(['"`])([^'"`\s<>]*?\.js(?:\?[^'"`\s<>]*)?)\1/g)){const url=match[2],base=url.split('?')[0].split('/').at(-1),before=source.slice(Math.max(0,match.index-35),match.index);if(!targets.has(base)||/(?:require|asset)\s*\(\s*$/.test(before)||!url.includes('?'))continue;references++;assert.ok(url.includes('delivery-reliability=20261031-v1'),`${name} -> ${base}`);}
 }
 assert.ok(references>=18);const lazy=fs.readFileSync(path.join(root,'customer/delivery-ui.js'),'utf8');assert.ok(lazy.includes('`${path}?v=${ASSET_VERSION}&messages-reliability=20261031-v1&delivery-reliability=20261031-v1`'));
});
test('browser cache invalidation never appends query tokens to CommonJS module resolution',()=>{for(const name of fs.readdirSync(path.join(root,'customer')).filter(name=>name.endsWith('.js'))){const source=fs.readFileSync(path.join(root,'customer',name),'utf8');for(const match of source.matchAll(/\brequire\(\s*(['"])([^'"]+)\1\s*\)/g))assert.ok(!match[2].includes('delivery-reliability='),name);}});
test('Delivery release artifact checks match actual local files and require source, receipt, activation, diagnostics and cache controls',()=>{
 const gates=config.smokeChecks.slice(config.smokeChecks.findIndex(check=>check.id==='delivery-canonical-source-authority')).filter(check=>check.id.startsWith('delivery-'));assert.equal(gates.length,11);
 for(const gate of gates){const file=gate.url==='/customer/'?'customer/index.html':gate.url.slice(1),source=fs.readFileSync(path.join(root,file),'utf8');for(const marker of gate.contains)assert.ok(source.includes(marker),`${gate.id}: ${marker}`);}
 assert.equal(config.backendHealth.json.delivery_integrity_version,'20261031-delivery-v1');assert.equal(config.backendHealth.json.operational_diagnostics_version,'20261031-operations-v1');
 const auth=config.smokeChecks.find(check=>check.id==='operations-diagnostics-auth');assert.equal(auth.status,401);assert.match(auth.url,/\/api\/operations\/diagnostics\?workspace_id=audit-unauth$/);
});
