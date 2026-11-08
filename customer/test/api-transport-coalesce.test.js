const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const http=require('node:http');
const path=require('node:path');
const root=path.join(__dirname,'..','..');
function load(fetchImpl){
  const window={location:{origin:'https://leadintel.ccgroup.lv'},fetch:fetchImpl,URL,Request,Response};
  vm.runInNewContext(fs.readFileSync(path.join(root,'customer/api-transport.js'),'utf8'),{window,URL,Request,Response});
  return window;
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

test('concurrent identical first-party GETs share one request and every caller reads the full body',async()=>{
  let calls=0;let release;const gate=new Promise(resolve=>{release=resolve;});
  const window=load(async()=>{const mine=++calls;await gate;return json({calls:mine});});
  const a=window.fetch('/api/integrations/services/status?workspace_id=w1');
  const b=window.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/integrations/services/status?workspace_id=w1');
  const c=window.fetch('/api/integrations/services/status?workspace_id=w1',{method:'GET'});
  const d=window.fetch('/api/integrations/services/status?workspace_id=w1',{credentials:'include',headers:{'Accept':'application/json','Content-Type':'application/json'},signal:new AbortController().signal});
  release();
  const bodies=await Promise.all([a,b,c,d].map(p=>p.then(r=>r.json())));
  assert.equal(calls,2,'ordinary startup reads share, while a bounded reader owns its request');
  assert.deepEqual(bodies,[{calls:1},{calls:1},{calls:1},{calls:2}]);
  await window.fetch('/api/integrations/services/status?workspace_id=w1');
  assert.equal(calls,3,'a GET issued after the shared one completed is a fresh request');
});

test('different URLs, writes, custom headers and non-API requests are never merged',async()=>{
  let calls=0;const window=load(async()=>{calls++;return json({calls});});
  await Promise.all([
    window.fetch('/api/integrations/services/status?workspace_id=w1'),
    window.fetch('/api/integrations/services/status?verify=1&workspace_id=w1'),
    window.fetch('/api/integrations/services/status?workspace_id=w2'),
    window.fetch('/api/customer/state?workspace_id=w1',{method:'PUT',body:'{}'}),
    window.fetch('/api/customer/state?workspace_id=w1',{method:'PUT',body:'{}'}),
    window.fetch('/api/integrations/services/status?workspace_id=w1',{headers:{'X-LeadIntel-Research-Mode':'saving'}}),
    window.fetch('/release.json?check=1'),
    window.fetch('/release.json?check=1'),
  ]);
  assert.equal(calls,8);
});

test('an aborted leader does not sink the followers: they fall back to their own request',async()=>{
  let calls=0;let release;const gate=new Promise(resolve=>{release=resolve;});
  const window=load(async(_,options)=>{calls++;const mine=calls;await gate;if(mine===1)throw Object.assign(new Error('aborted'),{name:'AbortError'});return json({calls:mine});});
  const leader=window.fetch('/api/approved-workflow?workspace_id=w1');
  const follower=window.fetch('/api/approved-workflow?workspace_id=w1');
  release();
  await assert.rejects(leader,/aborted/);
  assert.deepEqual(await follower.then(r=>r.json()),{calls:2});
  assert.equal(calls,2);
});

test('transports whose fetch returns a plain object stay compatible (no clone required for a lone caller)',async()=>{
  const window=load(async()=>({ok:true}));
  assert.deepEqual(await window.fetch('/api/session'),{ok:true});
});

test('aborting a polling reader cannot abort a concurrent cancellation status read',async()=>{
  const responses=[];let finish=false;
  const server=http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'application/json'});
    res.write('{"status":');
    responses.push(res);if(finish)res.end('"running"}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const window=load((url,options)=>fetch(new URL(new URL(url,'https://leadintel.ccgroup.lv').pathname,origin),options));
  const polling=new AbortController(),canceling=new AbortController();
  try{
    const first=window.fetch('/api/buyers/research?job_id=j1',{signal:polling.signal});
    const second=window.fetch('/api/buyers/research?job_id=j1',{signal:canceling.signal});
    const firstBody=(await first).json();
    const canceled=assert.rejects(firstBody,{name:'AbortError'});
    polling.abort();
    finish=true;for(const res of responses)res.end('"running"}');
    await canceled;
    assert.deepEqual(await second.then(r=>r.json()),{status:'running'},'the cancellation reader owns its own response lifetime');
  }finally{
    polling.abort();canceling.abort();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});
