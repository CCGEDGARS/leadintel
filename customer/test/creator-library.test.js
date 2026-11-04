const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setImmediate(r));
async function fixture(){
 const dom=new JSDOM('<aside><section id="host"></section></aside>',{url:'https://app.test/customer/',runScripts:'outside-only'}),w=dom.window;w.LeadIntelDialogs={confirm:async()=>true};w.eval(fs.readFileSync(require.resolve('../creator-library.js'),'utf8'));
 let current='owner|workspace',saved=[],active=[],calls=[],refreshes=0;
 const ui=w.LeadIntelCreatorLibrary.mount(w.document,{host:w.document.getElementById('host'),scope:()=>current,refresh:async()=>{refreshes++;},request:async(path,options={})=>{calls.push({path,...options});if(path==='/creator/unlock'){if(options.body.password!=='2468')throw Error('Incorrect creator PIN');return {expiresAt:Date.now()+900000};}if(path==='/creator/lock')return {ok:true};if(path==='/creator')return {scripts:saved,active};if(path.endsWith('/activate')){active=[{id:'phone:professional',creatorSource:{id:saved[0].id,revision:saved[0].revision},revision:1}];return {ok:true};}const body=options.body;const script={...body,id:path.split('/').at(-1),revision:body.expectedRevision+1};saved=[script];return {script};}});
 const find=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===text),field=text=>[...w.document.querySelectorAll('label')].find(l=>l.firstChild?.textContent===text)?.querySelector('input,textarea,select');
 async function click(text){find(text).click();await tick();await tick();}
 return {w,ui,calls,find,field,click,get saved(){return saved;},get refreshes(){return refreshes;},scope(value){current=value;}};
}
test('creator panel is hidden for customers; password is cleared and scope changes erase private editor',async()=>{
 const f=await fixture();try{f.ui.render(false);assert.equal(f.w.document.getElementById('creator-library').hidden,true);f.ui.render(true);assert.equal(f.w.document.getElementById('creator-library').open,false);const password=f.w.document.querySelector('[type=password]');password.value='2468';f.w.document.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();assert.equal(password.value,'');assert.ok(f.find('New script'));await f.click('New script');f.field('Original script (preserved as supplied)').value='Private original';f.scope('customer|other');f.ui.render(false);assert.equal(f.w.document.getElementById('creator-library').hidden,true);assert.equal(f.w.document.querySelector('textarea'),null);}finally{f.ui.destroy();f.w.close();}
});
test('manual original and pattern save as draft; activation is separate and refreshes generation catalogue',async()=>{
 const f=await fixture();try{f.ui.render(true);f.w.document.querySelector('[type=password]').value='2468';f.w.document.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();await f.click('New script');f.field('Script title').value='My call';f.field('Folder').value='phone';f.field('Original script (preserved as supplied)').value='My private original';f.field('Active script pattern').value='Hello {{firstName}}';f.w.document.querySelector('[type=checkbox]').checked=true;await f.click('Save draft');assert.equal(f.saved[0].original,'My private original');assert.equal(f.saved[0].body,'Hello {{firstName}}');assert.equal(f.calls.some(c=>c.path.endsWith('/activate')),false);await f.click('Activate version');assert.equal(f.refreshes,1);assert.ok(f.calls.find(c=>c.path.endsWith('/activate')&&c.body.expectedRevision===1));await f.click('Lock library');assert.equal(f.w.document.querySelector('textarea'),null);assert.ok(f.w.document.querySelector('[type=password]'));}finally{f.ui.destroy();f.w.close();}
});

test('compact disclosure sits directly after Writing Assistant and opens to a PIN without reading private sources',async()=>{
 const f=await fixture();try{
  f.ui.render(true);const d=f.w.document,panel=d.getElementById('creator-library'),pin=panel.querySelector('[type=password]');
  assert.equal(d.getElementById('host').nextElementSibling,panel);assert.equal(panel.parentElement.tagName,'ASIDE');
  assert.equal(panel.open,false);assert.equal(panel.querySelector('summary').textContent,'Creator Library');assert.equal(f.calls.length,0);
  panel.querySelector('summary').click();assert.equal(panel.open,true);
  assert.equal(pin.inputMode,'numeric');assert.equal(pin.maxLength,4);assert.equal(pin.minLength,4);assert.equal(pin.pattern,'[0-9]{4}');assert.equal(pin.closest('label').textContent,'PIN code');
  pin.value='0000';d.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();
  assert.equal(pin.value,'');assert.match(panel.textContent,/Incorrect creator PIN/);assert.equal(f.calls.some(c=>c.path==='/creator'),false);assert.equal(f.find('New script'),undefined);
  pin.value='2468';d.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();await tick();assert.ok(f.find('New script'));
  await f.click('Lock library');assert.equal(panel.open,false);assert.equal(panel.querySelector('textarea'),null);
  panel.querySelector('summary').click();assert.ok(panel.querySelector('[type=password]'));
 }finally{f.ui.destroy();f.w.close();}
});
