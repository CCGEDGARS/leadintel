const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const Materials=require('../content-materials.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const w=new JSDOM('<details id="mw-content-materials"><summary>My content <span id="mw-content-count"></span></summary></details>',{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 w.eval(fs.readFileSync(require.resolve('../content-materials.js'),'utf8'));
 let cards=[],refs=[],fail=false,next=0;const calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,...options});const body=options.body?JSON.parse(options.body):null,id=url.match(/content-materials\/([^?]+)/)?.[1];if(fail&&options.method!=='GET')return {ok:false,json:async()=>({error:'Storage unavailable'})};
  if(options.method==='POST')cards.push({id:'note-'+(++next),...body,revision:1});if(options.method==='PATCH')cards=cards.map(c=>c.id===id?{...c,...body,revision:c.revision+1}:c);if(options.method==='DELETE')cards=cards.filter(c=>c.id!==id);
  return {ok:true,json:async()=>({cards:JSON.parse(JSON.stringify(cards))})};
 };
 const ui=w.LeadIntelContentMaterials.mount(w.document,{fetchImpl,selected:()=>refs,select:r=>{refs=r}});ui.update('w1');
 return {w,ui,calls,get refs(){return refs},set fail(value){fail=value},get cards(){return cards}};
}
test('materials save, select for a message, edit selection revisions and delete with cancellation',async()=>{
 const h=fixture();await settle();const q=id=>h.w.document.getElementById(id);
 q('mw-content-add').click();q('mw-content-title').value='Opening';q('mw-content-body').value='A useful paragraph';q('mw-content-form').dispatchEvent(new h.w.Event('submit',{cancelable:true}));await settle();
 assert.equal(q('mw-content-form').hidden,true);assert.equal(h.cards.length,1);assert.match(q('mw-content-status').textContent,/saved to your workspace/);
 let check=q('mw-content-list').querySelector('input');check.click();assert.deepEqual(JSON.parse(JSON.stringify(h.refs)),[{id:'note-1',revision:1}]);
 q('mw-content-list').querySelector('button').click();q('mw-content-body').value='Edited paragraph';q('mw-content-form').dispatchEvent(new h.w.Event('submit',{cancelable:true}));await settle();assert.equal(h.refs[0].revision,2);
 const remove=()=>[...q('mw-content-list').querySelectorAll('button')].find(b=>b.textContent==='Delete');remove().click();[...q('mw-content-list').querySelectorAll('button')].find(b=>b.textContent==='Cancel').click();assert.equal(h.cards.length,1);
 remove().click();[...q('mw-content-list').querySelectorAll('button')].find(b=>b.textContent==='Delete item').click();await settle();assert.equal(h.cards.length,0);assert.equal(h.refs.length,0);q('mw-content-refresh').click();await settle();assert.match(q('mw-content-list').textContent,/No materials yet/);
 assert.ok(h.calls.every(c=>c.credentials==='include'&&c.url.includes('workspace_id=w1')));
});
test('failed material saves preserve text and edit form for retry; a workspace switch clears private text',async()=>{
 const h=fixture();await settle();const q=id=>h.w.document.getElementById(id);q('mw-content-add').click();q('mw-content-title').value='Keep this';q('mw-content-body').value='My unsaved paragraph';h.fail=true;q('mw-content-form').dispatchEvent(new h.w.Event('submit',{cancelable:true}));await settle();
 assert.equal(q('mw-content-form').hidden,false);assert.equal(q('mw-content-body').value,'My unsaved paragraph');assert.match(q('mw-content-status').textContent,/Storage unavailable/);h.ui.update('w2');assert.equal(q('mw-content-body').value,'');assert.equal(q('mw-content-form').hidden,true);
});
test('API rejects generation provenance for removed or revised materials',async()=>{
 const api=Materials.createApi('w1',async()=>({ok:true,json:async()=>({cards:[{id:'a',revision:2}]})}));await assert.rejects(api.assertCurrent([{id:'a',revision:1}]),/changed/);await api.assertCurrent([{id:'a',revision:2}]);
});
