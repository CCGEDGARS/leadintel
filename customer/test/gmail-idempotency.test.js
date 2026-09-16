const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
test('Gmail idempotency includes the complete recipient when earlier input is long',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../production-gmail-ui.js'),'utf8').replace(/\}\)\(typeof window!==['"]undefined['"]\?window:globalThis\);\s*$/,'root.keyForTest=deterministicKey;})(typeof window!==\'undefined\'?window:globalThis);');
  const window={};vm.runInNewContext(source,{window,document:{readyState:'loading',addEventListener(){}},crypto:webcrypto,TextEncoder});
  const pkg={domain:`${'very-long-domain-segment-'.repeat(8)}example.com`,approvedAt:'2026-09-05'};
  const first=await window.keyForTest(pkg,'first.person@example.com');
  const second=await window.keyForTest(pkg,'second.person@example.com');
  assert.notEqual(first,second);assert.match(first,/^gmail-[a-f0-9]{64}$/);
});
