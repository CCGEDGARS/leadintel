const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const plain=value=>JSON.parse(JSON.stringify(value));
async function setup(){
 const dom=new JSDOM('<section id="message-studio"><details></details></section><div id="mw-book-toggles"><input type="checkbox" data-book-slot="1"></div><p id="mw-book-status"></p>',{runScripts:'outside-only'}),w=dom.window;
 let sync,rows=[1,2,3,4].map(slot=>({id:'book'+slot,slot,filename:'book'+slot+'.txt',status:'Ready',revision:slot,active:slot===1,coverage:{total:10,readable:8,unreadable:2}})),revision=1;
 const callbacks=[],writes=[];
 w.setInterval=fn=>sync=fn;w.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'w1'}};w.LeadIntelWritingReferences=require('../writing-references-ui.js');
 w.LeadIntelWritingReferencesApi={createWritingReferencesApi:({workspaceId,onResult})=>{callbacks.push(onResult);return {list:async()=>{const result={cards:workspaceId==='w1'?rows:[{id:'other',slot:1,filename:'other.txt',status:'Ready',revision:1,active:true}],referenceRevision:revision};onResult(result);return result;},patch:async(id,body)=>{writes.push({id,body});throw Error('Session selection must not write settings');}};}};
 w.eval(fs.readFileSync(require.resolve('../writing-references-loader.js'),'utf8'));await tick();
 return {dom,w,selection:w.LeadIntelWritingReferenceSelection,writes,callbacks,sync,setRows(value){rows=value;},publish(value){rows=value;callbacks.at(-1)({cards:rows,referenceRevision:++revision});},close(){w.close();}};
}
test('session starts with no books despite saved active flags and reset clears only transient choices',async()=>{
 const a=await setup();try{const s=a.selection;assert.deepEqual(plain(s.sessionSnapshot().sourceRefs),[]);assert.deepEqual(plain(s.snapshot().sourceRefs),[{id:'book1',revision:1}]);assert.equal(s.sessionSnapshot().cards[0].active,false);assert.equal(await s.toggleSession('book1'),true);assert.deepEqual(plain(s.sessionSnapshot().sourceRefs),[{id:'book1',revision:1}]);assert.deepEqual(plain(s.sessionSnapshot().cards[0].coverage),{total:10,readable:8,unreadable:2});assert.equal(s.resetSession(),true);assert.deepEqual(plain(s.sessionSnapshot().sourceRefs),[]);assert.deepEqual(plain(s.snapshot().sourceRefs),[{id:'book1',revision:1}]);assert.deepEqual(a.writes,[]);}finally{a.close();}
});
test('session allows zero through three Ready books and invalidates generation without persisting activation',async()=>{
 const a=await setup();try{const events=[];a.w.addEventListener('leadintel:writing-references-changed',e=>events.push(e.detail));const s=a.selection;for(const id of ['book1','book2','book3'])assert.equal(await s.toggleSession(id),true);assert.equal(await s.toggleSession('book4'),false);assert.equal(await s.toggleSession('missing'),false);assert.deepEqual(plain(s.sessionSnapshot().sourceRefs),[{id:'book1',revision:1},{id:'book2',revision:2},{id:'book3',revision:3}]);assert.equal(await s.toggleSession('book2'),true);assert.equal(await s.toggleSession('book4'),true);assert.equal(events.length,5);s.resetSession();assert.equal(events.length,6);s.resetSession();assert.equal(events.length,6);assert.deepEqual(a.writes,[]);}finally{a.close();}
});
test('focus refresh preserves session books while removed and incomplete sources are pruned',async()=>{
 const a=await setup();try{const s=a.selection;await s.toggleSession('book1');await s.toggleSession('book2');a.w.dispatchEvent(new a.w.Event('focus'));await tick();assert.equal(s.sessionSnapshot().sourceRefs.length,2);a.publish([{id:'book2',slot:2,filename:'replacement.pdf',status:'Processing',revision:5,active:false},{id:'book3',slot:3,status:'Ready',revision:3,active:false}]);assert.deepEqual(plain(s.sessionSnapshot().sourceRefs),[]);assert.equal(await s.toggleSession('book2'),false);assert.deepEqual(a.writes,[]);}finally{a.close();}
});
test('workspace switch clears session sources immediately and rejects stale callbacks including returning to the same workspace',async()=>{
 const a=await setup();try{const s=a.selection;await s.toggleSession('book1');const old=a.callbacks[0];a.w.LeadIntelServerBridge.workspace.id='w2';assert.deepEqual(plain(s.sessionSnapshot().cards),[]);assert.equal(await s.toggleSession('book1'),false);a.sync();await tick();assert.deepEqual(plain(s.sessionSnapshot().sourceRefs),[]);assert.equal(s.sessionSnapshot().cards[0].id,'other');old({cards:[{id:'private',slot:1,status:'Ready',active:true}],referenceRevision:99});assert.equal(s.sessionSnapshot().cards[0].id,'other');a.w.LeadIntelServerBridge.workspace.id='w1';a.sync();await tick();old({cards:[{id:'private',slot:1,status:'Ready',active:true}],referenceRevision:99});assert.equal(s.sessionSnapshot().cards.some(c=>c.id==='private'),false);assert.deepEqual(plain(s.sessionSnapshot().sourceRefs),[]);}finally{a.close();}
});
test('legacy setup has no active-book switches while settings retain book management',async()=>{
 const a=await setup();try{const d=a.w.document;assert.equal(d.querySelector('[data-book-slot]'),null);assert.equal(d.querySelector('[data-active],.wr-activation,input[type=checkbox]'),null);assert.doesNotMatch(d.getElementById('writing-reference-cards').textContent,/Use this book|Choose one active book/);assert.equal(d.querySelectorAll('[data-delete]').length,3);assert.ok(d.querySelector('[data-upload]'));assert.match(d.getElementById('writing-reference-cards').textContent,/What AI learned/);}finally{a.close();}
});
