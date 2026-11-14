const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../account-cache.js'),'utf8');
function runtime(indexedDB){
 const timers=new Map();let nextTimer=0;
 const values=new Map([['leadintel_customer_v2_workspace','w1'],['leadintel_customer_v2_state','private saved draft']]),attrs=new Map(),message={textContent:''};
 const localStorage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const root={localStorage,indexedDB,URL,console,crypto:{randomUUID:()=> 'test-id'},location:{href:'https://example.test/customer/',search:''},document:{documentElement:{setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},getElementById:()=>message},setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,root);return {root,values,attrs,message,api:root.LeadIntelAccountCache,fireTimeout:()=>[...timers.values()][0]?.()};
}
function failingOpen(error,{blocked=false}={}){return {open(){const request={error};queueMicrotask(()=>blocked?request.onblocked?.({target:request}):request.onerror?.({target:request}));return request;}};}
function failingTransaction(error,{requestFailure=false,synchronous=false}={}){return {open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){if(synchronous)throw error;const tx={error:requestFailure?null:error,objectStore:()=>{const fail=()=>{queueMicrotask(()=>requestFailure?tx.onerror?.({target:{error}}):tx.onabort?.({target:tx}));return {};};return {put:fail,get:fail};},abort(){}};return tx;}};request.onsuccess?.();});return request;}};}
const privateCause=name=>({name,message:'PRIVATE company draft https://private.example/secret',path:'/private/customer',code:'private-value'});
for(const [label,indexedDB,phase,name] of [
 ['database open request',failingOpen(privateCause('SecurityError')),'archive_open','SecurityError'],
 ['database open exception',{open(){throw privateCause('InvalidStateError');}},'archive_open','InvalidStateError'],
 ['database blocked',failingOpen(null,{blocked:true}),'archive_open_blocked','Error'],
 ['write request',failingTransaction(privateCause('QuotaExceededError'),{requestFailure:true}),'archive_write_request','QuotaExceededError'],
 ['transaction abort',failingTransaction(privateCause('AbortError')),'archive_write_transaction','AbortError'],
 ['transaction creation',failingTransaction(privateCause('InvalidStateError'),{synchronous:true}),'archive_write_transaction','InvalidStateError'],
 ['unknown error name',failingOpen(privateCause('PRIVATE NAME')),'archive_open','Error']
])test('browser archive diagnostic safely identifies '+label,async()=>{
 const r=runtime(indexedDB),before=new Map(r.values);let failure;
 await assert.rejects(r.api.saveRecoverySnapshot({workspace_id:'w1',server_version:1,data:{draft:'private'}}),error=>{failure=error;return true;});
 assert.equal(failure.code,'browser_archive_unavailable');assert.equal(failure.phase,phase);assert.equal(failure.name,name);
 assert.doesNotMatch(JSON.stringify(failure)+failure.message,/PRIVATE|private\.example|private-value|\/private\/customer/);
 assert.deepEqual(r.values,before,'failed backup keeps the active local draft');
 r.api.failed(failure);assert.equal(r.attrs.get('data-account-check'),'error');
 assert.match(r.message.textContent,new RegExp(phase));assert.ok(r.message.textContent.includes(name));
 assert.doesNotMatch(r.message.textContent,/PRIVATE|private\.example|private-value/);
});

for(const [nativeName,detail,category] of [
 ['Error','Insufficient disk space to store PRIVATE value','quota'],
 ['UnknownError','The serialized value is too large: PRIVATE','value_too_large'],
 ['UnknownError','Operation timed out for PRIVATE','timeout'],
 ['AbortError','PRIVATE transaction stopped','aborted'],
 ['SecurityError','PRIVATE browser policy','security'],
 ['Error','PRIVATE arbitrary failure','unknown']
])test('archive errors classify '+category+' without retaining cause text',async()=>{
 const r=runtime(failingTransaction({name:nativeName,message:detail},{requestFailure:true}));let failure;
 await assert.rejects(r.api.saveRecoverySnapshot({workspace_id:'w1'}),error=>{failure=error;return true;});
 assert.equal(failure.category,category);assert.doesNotMatch(JSON.stringify(failure)+failure.message,/PRIVATE/);
 r.api.failed(failure);assert.ok(r.message.textContent.includes(category));assert.doesNotMatch(r.message.textContent,/PRIVATE/);
});

test('read request failures retain bounded native metadata and block recovery',async()=>{
 const r=runtime(failingTransaction(privateCause('NotFoundError'),{requestFailure:true}));
 await assert.rejects(r.api.readRecoverySnapshot('leadintel_workspace_snapshot_v1:w1:1:saved'),error=>error.code==='browser_archive_unavailable'&&error.name==='NotFoundError'&&error.phase==='archive_read_request');
 assert.equal(r.values.get('leadintel_customer_v2_state'),'private saved draft');
});

test('an open timeout identifies its phase without turning an abort into success',async()=>{
 const r=runtime({open:()=>({})}),pending=r.api.saveRecoverySnapshot({workspace_id:'w1'});
 r.fireTimeout();
 await assert.rejects(pending,error=>error.code==='browser_archive_unavailable'&&error.name==='TimeoutError'&&error.phase==='archive_open_timeout'&&error.category==='timeout');
});

test('a transaction timeout is reported before synchronous abort events',async()=>{
 let aborted=false;const r=runtime({open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={error:{name:'AbortError'},objectStore:()=>({put(){}}),abort(){aborted=true;tx.onabort?.();}};return tx;}};request.onsuccess();});return request;}});
 const pending=r.api.saveRecoverySnapshot({workspace_id:'w1'});await new Promise(resolve=>setImmediate(resolve));r.fireTimeout();
 await assert.rejects(pending,error=>error.name==='TimeoutError'&&error.phase==='archive_write_timeout'&&error.category==='timeout');assert.equal(aborted,true);
});

test('recovery UI accepts only known archive metadata fields',()=>{
 const r=runtime(null);r.api.failed({code:'browser_archive_unavailable',name:'PRIVATE name',phase:'PRIVATE phase',category:'PRIVATE category',message:'PRIVATE value',requestPath:'https://private.example/secret'});
 assert.match(r.message.textContent,/Error \/ archive \/ unknown/);
 assert.doesNotMatch(r.message.textContent,/PRIVATE|private\.example/);
});
