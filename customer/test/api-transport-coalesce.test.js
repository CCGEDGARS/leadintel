const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
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
  const window=load(async()=>{calls++;await gate;return json({calls});});
  const a=window.fetch('/api/integrations/services/status?workspace_id=w1');
  const b=window.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/integrations/services/status?workspace_id=w1');
  const c=window.fetch('/api/integrations/services/status?workspace_id=w1',{method:'GET'});
  release();
  const bodies=await Promise.all([a,b,c].map(p=>p.then(r=>r.json())));
  assert.equal(calls,1,'three simultaneous identical GETs reach the server once');
  assert.deepEqual(bodies,[{calls:1},{calls:1},{calls:1}]);
  await window.fetch('/api/integrations/services/status?workspace_id=w1');
  assert.equal(calls,2,'a GET issued after the shared one completed is a fresh request');
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
