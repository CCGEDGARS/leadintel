const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'..','research-costs.js'),'utf8');
function data(workspaceId='a'){
  return {workspaceId,period:{start:'2026-10-01T00:00:00Z',end:'2026-11-01T00:00:00Z'},confirmedSpend:[{currency:'USD',amountMicro:16119}],totalResearchCost:null,monetaryBudget:{amount:null},providers:[{provider:'treg',confirmedAmountMicro:16119,currency:'USD',confirmedReceipts:2,unknownReceipts:1,coverage:'Recorded Treg receipts only.'},{provider:'openai',cost:null,inputTokens:100,outputTokens:20,recordedEvents:1,coverage:'Monetary spend is not measured.'}],contacts:{newlyVerifiedTregUsable:1},costPerUsableContact:{amountMicro:16119,currency:'USD',denominator:1,coverage:'Recorded Treg spend only; not an all-in acquisition cost.'},limits:{status:'saved',dailyUsed:2,dailyLimit:3,monthlyUsed:8,monthlyLimit:30,maxPerCompany:1,day:'2026-10-24',month:'2026-10',enabled:true},notes:['Missing cost headers remain unknown.']};
}
function harness(request){const dom=new JSDOM('<div id="host"></div>',{url:'https://app.invalid',runScripts:'outside-only'});dom.window.eval(source);let workspace={id:'a'},session={authenticated:true,user:{id:'viewer-a'}};const host=dom.window.document.getElementById('host');const view=dom.window.LeadIntelResearchCosts.mount(host,{request,getWorkspace:()=>workspace,getSession:()=>session});return {dom,host,view,workspace(value){workspace={id:value};},session(value){session=value;},close(){view.destroy();dom.window.close();}};}
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('runtime renders confirmed small receipt amounts, unknown all-in costs and separate saved lookup-count caps',async()=>{
  const calls=[];const f=harness(async(url,options)=>{calls.push({url,options});return data();});try{
    await f.view.ready;assert.equal(calls.length,1);assert.match(calls[0].url,/^\/api\/research\/costs\?workspace_id=a&start=\d{4}-\d\d-01&end=/);assert.equal(calls[0].options.method,'GET');
    assert.match(f.host.textContent,/\$0\.016119/);assert.match(f.host.textContent,/Total research costUnknown · incomplete coverage/);assert.match(f.host.textContent,/Monetary budget: Not configured/);assert.match(f.host.textContent,/2 \/ 3 today/);assert.match(f.host.textContent,/8 \/ 30 this month/);assert.match(f.host.textContent,/100 in \/ 20 out/);assert.match(f.host.textContent,/end exclusive/);
    assert.equal(f.host.querySelectorAll('th').length,3);assert.equal(f.host.querySelector('[role=status]').textContent.startsWith('Incomplete'),true);
  }finally{f.close();}
});

test('unknown-only and empty periods never appear as $0; zero usable contacts does not invent a unit cost',async()=>{
  const payload=data();payload.confirmedSpend=[];payload.providers[0].confirmedAmountMicro=null;payload.providers[0].confirmedReceipts=0;payload.contacts.newlyVerifiedTregUsable=0;payload.costPerUsableContact.amountMicro=null;
  const f=harness(async()=>payload);try{await f.view.ready;assert.match(f.host.textContent,/Unknown · no confirmed amount/);assert.match(f.host.textContent,/Treg receipts per usable Treg contactUnknown/);assert.doesNotMatch(f.host.textContent,/\$0/);}finally{f.close();}
});

test('workspace switch clears the old report immediately and rejects a late cross-workspace response',async()=>{
  const requests=[];const f=harness(url=>{const pending=defer();requests.push({url,pending});return pending.promise;});try{
    requests[0].pending.resolve(data());await f.view.ready;assert.match(f.host.textContent,/0\.016119/);
    const old=f.view.refresh();f.workspace('b');f.dom.window.dispatchEvent(new f.dom.window.Event('leadintel:workspace-changed'));
    assert.doesNotMatch(f.host.textContent,/0\.016119/);assert.match(requests[2].url,/workspace_id=b/);
    const other=data('b');other.confirmedSpend=[{currency:'USD',amountMicro:90000}];requests[2].pending.resolve(other);await tick();assert.match(f.host.textContent,/\$0\.09/);
    requests[1].pending.resolve(data('a'));await old;assert.match(f.host.textContent,/\$0\.09/);assert.doesNotMatch(f.host.textContent,/Recorded receipt spend \(USD\)\$0\.016119/);
  }finally{f.close();}
});

test('workspace identity is checked even when the caller forgets to dispatch a switch event',async()=>{
  const pending=defer(),f=harness(()=>pending.promise);try{f.workspace('b');pending.resolve(data('a'));await f.view.ready;assert.match(f.host.textContent,/Workspace or account changed/);assert.doesNotMatch(f.host.textContent,/0\.016119/);}finally{f.close();}
});

test('A to B to A ignores the first A response even after the workspace ID matches again',async()=>{
  const requests=[];const f=harness(()=>{const pending=defer();requests.push(pending);return pending.promise;});try{
    f.workspace('b');f.dom.window.dispatchEvent(new f.dom.window.Event('leadintel:workspace-changed'));
    f.workspace('a');f.dom.window.dispatchEvent(new f.dom.window.Event('leadintel:workspace-changed'));
    const fresh=data('a');fresh.confirmedSpend=[{currency:'USD',amountMicro:90000}];requests[2].resolve(fresh);await tick();assert.match(f.host.textContent,/\$0\.09/);
    requests[0].resolve(data('a'));await f.view.ready;requests[1].resolve(data('b'));await tick();assert.match(f.host.textContent,/\$0\.09/);assert.doesNotMatch(f.host.textContent,/Recorded receipt spend \(USD\)\$0\.016119/);
  }finally{f.close();}
});

test('account replacement within the same workspace refuses stale data; unauthenticated scope does not request costs',async()=>{
  const pending=defer(),f=harness(()=>pending.promise);try{f.session({authenticated:true,user:{id:'viewer-b'}});pending.resolve(data('a'));await f.view.ready;assert.match(f.host.textContent,/Workspace or account changed/);assert.doesNotMatch(f.host.textContent,/0\.016119/);}finally{f.close();}
  let calls=0;const signedOut=harness(async()=>{calls++;return data();});try{await signedOut.view.ready;signedOut.session({authenticated:false,user:null});await signedOut.view.refresh();assert.equal(calls,1);assert.match(signedOut.host.textContent,/Select a workspace/);assert.doesNotMatch(signedOut.host.textContent,/0\.016119/);}finally{signedOut.close();}
});

test('period submission reuses the authenticated request and safely renders provider coverage text',async()=>{
  const calls=[];const payload=data();payload.providers[0].coverage='<img src=x onerror="window.bad=true">';const f=harness(async url=>{calls.push(url);return payload;});try{
    await f.view.ready;assert.equal(f.host.querySelector('img'),null);assert.match(f.host.textContent,/<img src=x/);assert.equal(f.dom.window.bad,undefined);
    f.host.querySelector('[name=start]').value='2026-09-01';f.host.querySelector('[name=end]').value='2026-10-01';f.host.querySelector('form').dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.match(calls[1],/start=2026-09-01&end=2026-10-01/);
    f.host.querySelector('[name=end]').value='2026-08-01';await f.view.refresh();assert.equal(calls.length,2);assert.match(f.host.textContent,/Choose a valid period/);assert.equal(f.host.querySelector('button').disabled,false);
  }finally{f.close();}
});

test('failed requests clear stale numbers, expose no server error secrets and permit retry; destroy ignores pending responses',async()=>{
  let fail=false;const f=harness(async()=>{if(fail)throw Error('private-api-token');return data();});try{
    await f.view.ready;fail=true;await f.view.refresh();assert.doesNotMatch(f.host.textContent,/private-api-token|0\.016119/);assert.match(f.host.textContent,/unavailable/);assert.equal(f.host.querySelector('button').disabled,false);
    fail=false;await f.view.refresh();assert.match(f.host.textContent,/0\.016119/);
  }finally{f.close();}
  const pending=defer(),gone=harness(()=>pending.promise);gone.view.destroy();pending.resolve(data());await gone.view.ready;assert.equal(gone.host.children.length,0);gone.dom.window.close();
});

test('mismatched workspace payload is refused and Response-shaped results are supported',async()=>{
  const f=harness(async()=>data('other'));try{await f.view.ready;assert.match(f.host.textContent,/unavailable/);assert.doesNotMatch(f.host.textContent,/0\.016119/);}finally{f.close();}
  const response=harness(async()=>Response.json(data()));try{await response.view.ready;assert.match(response.host.textContent,/0\.016119/);}finally{response.close();}
  const bridge=harness(async()=>({response:{ok:true},payload:data()}));try{await bridge.view.ready;assert.match(bridge.host.textContent,/0\.016119/);}finally{bridge.close();}
});
