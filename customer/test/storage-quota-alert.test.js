const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('a failed first-party storage save emits a workspace-scoped alert without consuming the response',async()=>{
 const w=new JSDOM('<html></html>',{url:'https://app.test/customer/',runScripts:'outside-only'}).window;
 try{const response={status:507,marker:'original'};w.fetch=async()=>response;let detail;w.addEventListener('leadintel:storage-quota-rejected',e=>detail=e.detail);w.eval(fs.readFileSync(require.resolve('../api-transport.js'),'utf8'));
  assert.equal(await w.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/customer/state?workspace_id=w1'),response);assert.equal(detail?.workspaceId,'w1');
  detail=null;await w.fetch('https://other.test/api/customer/state?workspace_id=w2');assert.equal(detail,null);
 }finally{w.close();}
});
