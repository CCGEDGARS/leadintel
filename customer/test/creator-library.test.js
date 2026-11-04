const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setImmediate(r));
async function fixture(config={}){
 const dom=new JSDOM('<aside><section id="host"></section></aside>',{url:'https://app.test/customer/',runScripts:'outside-only'}),w=dom.window;w.LeadIntelDialogs={confirm:async()=>true};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.eval(fs.readFileSync(require.resolve('../creator-library.js'),'utf8'));
 let current='owner|workspace',saved=[],active=[],calls=[],refreshes=0;
 const ui=w.LeadIntelCreatorLibrary.mount(w.document,{host:w.document.getElementById('host'),scope:()=>current,refresh:async()=>{refreshes++;},request:async(path,options={})=>{calls.push({path,...options});if(path==='/creator/unlock'){if(options.body.password!=='2468')throw Error('Incorrect creator PIN');return {expiresAt:Date.now()+900000};}if(path==='/creator/lock')return {ok:true};if(path==='/creator')return {scripts:saved,active};if(path.endsWith('/activate')){if(config.activateError)throw Error(config.activateError);active=[{id:'phone:professional',creatorSource:{id:saved[0].id,revision:saved[0].revision},revision:1}];return {ok:true};}const body=options.body;const script={...body,id:path.split('/').at(-1),revision:body.expectedRevision+1};saved=[script];return {script};}});
 const find=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===text),field=text=>[...w.document.querySelectorAll('label')].find(l=>l.firstChild?.textContent===text)?.querySelector('input,textarea,select');
 async function click(text){find(text).click();await tick();await tick();}
 return {w,ui,calls,find,field,click,get saved(){return saved;},get refreshes(){return refreshes;},scope(value){current=value;}};
}
test('creator panel is hidden for customers; password is cleared and scope changes erase private editor',async()=>{
 const f=await fixture();try{f.ui.render(false);assert.equal(f.w.document.getElementById('creator-library').hidden,true);f.ui.render(true);assert.equal(f.w.document.getElementById('creator-library').open,false);const password=f.w.document.querySelector('[type=password]');password.value='2468';f.w.document.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();assert.equal(password.value,'');assert.ok(f.find('New script'));await f.click('New script');f.field('Original script (preserved as supplied)').value='Private original';f.scope('customer|other');f.ui.render(false);assert.equal(f.w.document.getElementById('creator-library').hidden,true);assert.equal(f.w.document.querySelector('textarea'),null);}finally{f.ui.destroy();f.w.close();}
});
test('Save preserves the original and immediately activates the primary master and refreshes generation catalogue',async()=>{
 const f=await fixture();try{f.ui.render(true);f.w.document.querySelector('[type=password]').value='2468';f.w.document.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();await f.click('New script');f.field('Script title').value='My call';f.field('Folder').value='phone';f.field('Original script (preserved as supplied)').value='My private original';f.field('Active script pattern').value='Hello {{firstName}}';f.w.document.querySelector('[type=checkbox]').checked=true;await f.click('Save');assert.equal(f.saved[0].original,'My private original');assert.equal(f.saved[0].body,'Hello {{firstName}}');assert.equal(f.calls.some(c=>c.path.endsWith('/activate')),true);assert.equal(f.refreshes,1);assert.ok(f.calls.find(c=>c.path.endsWith('/activate')&&c.body.expectedRevision===1));await f.click('Lock library');assert.equal(f.w.document.querySelector('textarea'),null);assert.ok(f.w.document.querySelector('[type=password]'));}finally{f.ui.destroy();f.w.close();}
});

test('compact disclosure sits directly after Writing Assistant and opens to a PIN without reading private sources',async()=>{
 const f=await fixture();try{
  f.ui.render(true);const d=f.w.document,panel=d.getElementById('creator-library'),dialog=d.getElementById('creator-library-dialog'),pin=dialog.querySelector('[type=password]');
  assert.equal(d.getElementById('host').nextElementSibling,panel);assert.equal(panel.parentElement.tagName,'ASIDE');
  assert.equal(panel.open,false);assert.equal(panel.querySelector('summary').textContent,'Creator Library');assert.equal(f.calls.length,0);
  panel.querySelector('summary').click();assert.equal(dialog.open,true);
  assert.equal(pin.inputMode,'numeric');assert.equal(pin.maxLength,4);assert.equal(pin.minLength,4);assert.equal(pin.pattern,'[0-9]{4}');assert.equal(pin.closest('label').textContent,'PIN code');
  pin.value='0000';d.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();
  assert.equal(pin.value,'');assert.match(dialog.textContent,/Incorrect creator PIN/);assert.equal(f.calls.some(c=>c.path==='/creator'),false);assert.equal(f.find('New script'),undefined);
  pin.value='2468';d.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();await tick();assert.ok(f.find('New script'));
  await f.click('Lock library');assert.equal(panel.open,false);assert.equal(dialog.querySelector('textarea'),null);
  panel.querySelector('summary').click();assert.ok(dialog.querySelector('[type=password]'));
 }finally{f.ui.destroy();f.w.close();}
});

test('wide dialog preserves an unsaved original on Close and Escape; workspace changes close and clear it',async()=>{
 const f=await fixture();try{
  f.ui.render(true);const d=f.w.document,trigger=d.querySelector('#creator-library>summary'),dialog=d.getElementById('creator-library-dialog');
  trigger.click();assert.equal(dialog.open,true);assert.equal(dialog.parentElement,d.body);assert.equal(d.activeElement,dialog.querySelector('[type=password]'));
  dialog.querySelector('[type=password]').value='2468';d.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();await f.click('New script');
  const original=f.field('Original script (preserved as supplied)');original.value='An unsaved original to keep';original.dispatchEvent(new f.w.Event('input'));
  dialog.querySelector('[aria-label="Close Creator Library"]').click();assert.equal(dialog.open,false);assert.equal(d.activeElement,trigger);assert.equal(trigger.getAttribute('aria-expanded'),'false');
  trigger.click();assert.equal(dialog.open,true);assert.equal(f.field('Original script (preserved as supplied)'),original);assert.equal(original.value,'An unsaved original to keep');
  dialog.dispatchEvent(new f.w.Event('cancel',{cancelable:true}));assert.equal(dialog.open,false);assert.equal(original.value,'An unsaved original to keep');
  trigger.click();f.scope('owner|another-workspace');f.ui.render(true);assert.equal(dialog.open,false);assert.equal(dialog.querySelector('textarea'),null);assert.ok(dialog.querySelector('[type=password]'));
  f.ui.destroy();assert.equal(d.getElementById('creator-library-dialog'),null);assert.equal(d.getElementById('creator-library'),null);
 }finally{f.w.close();}
});

async function newReviewedScript(f){
 f.ui.render(true);f.w.document.querySelector('[type=password]').value='2468';f.w.document.querySelector('form').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();await f.click('New script');
 f.field('Script title').value='My call';f.field('Folder').value='phone';f.field('Original script (preserved as supplied)').value='Preserved original';f.field('Active script pattern').value='Hello {{firstName}}';
}
test('Save requires review and does not publish unchecked wording',async()=>{
 const f=await fixture();try{await newReviewedScript(f);await f.click('Save');assert.equal(f.saved.length,0);assert.equal(f.refreshes,0);assert.match(f.w.document.querySelector('[role=status]').textContent,/tick the confirmation/);}finally{f.ui.destroy();f.w.close();}
});
test('failed activation preserves source and reports failure instead of claiming primary save; retry uses saved revision',async()=>{
 const options={activateError:'The active master changed.'},f=await fixture(options);try{await newReviewedScript(f);f.w.document.querySelector('[type=checkbox]').checked=true;await f.click('Save');assert.equal(f.saved[0].revision,1);assert.equal(f.refreshes,0);assert.equal(f.field('Active script pattern').value,'Hello {{firstName}}');assert.match(f.w.document.querySelector('[role=status]').textContent,/primary master was not updated/);
 options.activateError='';f.w.document.querySelector('[type=checkbox]').checked=true;await f.click('Save');assert.equal(f.saved[0].revision,2);assert.equal(f.refreshes,1);assert.equal(f.calls.filter(c=>c.path.endsWith('/activate')).at(-1).body.expectedRevision,2);assert.match(f.w.document.querySelector('[role=status]').textContent,/Saved as the mandatory primary master/);
 }finally{f.ui.destroy();f.w.close();}
});
test('saving an edited active source uses its current master revision',async()=>{
 const f=await fixture();try{await newReviewedScript(f);f.w.document.querySelector('[type=checkbox]').checked=true;await f.click('Save');f.field('Active script pattern').value='Updated {{firstName}}';f.w.document.querySelector('[type=checkbox]').checked=true;await f.click('Save');assert.equal(f.saved[0].body,'Updated {{firstName}}');assert.equal(f.calls.filter(c=>c.path.endsWith('/activate')).at(-1).body.expectedCoreRevision,1);assert.equal(f.refreshes,2);}finally{f.ui.destroy();f.w.close();}
});

test('Save reaches the real registry and reopened customer catalogue for every channel',async()=>{
 const {storageDb}=await import('../../backend/test/workspace-storage-fixture.mjs');
 const {handleScriptLibraryRoute}=await import('../../backend/src/script-library-routes.js');
 const {sha256}=await import('../../backend/src/security.js');
 const DB=storageDb(),env={DB,ADMIN_EMAIL:'owner@example.test',ADMIN_PASSWORD:'2468',CREATOR_LIBRARY_PASSWORD:'2468'};
 DB.raw.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,'storage-owner','2099-01-01')").run(await sha256('creator-save-test'));
 const dom=new JSDOM('<section id="host"></section>',{url:'https://app.test/customer/',runScripts:'outside-only'}),w=dom.window;
 let cookie='',catalogue=null,refreshes=0;
 async function request(path='',options={}){
  const response=await handleScriptLibraryRoute(new Request('https://app.test/api/script-library'+path+'?workspace_id=storage-w1',{method:options.method||'GET',headers:{Cookie:'leadintel_session=creator-save-test; '+cookie,'Content-Type':'application/json'},...(options.body?{body:JSON.stringify(options.body)}:{})}),env);
  if(response.headers.has('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];
  const result=await response.json();if(!response.ok)throw Error(result.error);return result;
 }
 w.LeadIntelDialogs={confirm:async()=>true};w.eval(fs.readFileSync(require.resolve('../creator-library.js'),'utf8'));
 const ui=w.LeadIntelCreatorLibrary.mount(w.document,{host:w.document.getElementById('host'),scope:()=> 'owner|storage-w1',request,refresh:async()=>{catalogue=await request();refreshes++;}});
 const find=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===text);
 const field=text=>[...w.document.querySelectorAll('label')].find(l=>l.firstChild?.textContent===text)?.querySelector('input,textarea,select');
 async function until(fn){for(let i=0;i<200&&!fn();i++)await new Promise(r=>setTimeout(r,5));assert.ok(fn(),w.document.querySelector('[role=status]').textContent);}
 try{
  ui.render(true);w.document.querySelector('[type=password]').value='2468';w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>find('New script'));
  let count=0;
  for(const channel of ['email','linkedin','phone']){
   find('New script').click();await tick();field('Script title').value='Reviewed '+channel;field('Folder').value=channel;field('Original script (preserved as supplied)').value='Exact supplied '+channel+' original';field('Email subject pattern').value=channel==='email'?'Hello {{firstName}}':'';field('Active script pattern').value='Hello {{firstName}}. Exact '+channel+' wording.';w.document.querySelector('[type=checkbox]').checked=true;count++;find('Save').click();await until(()=>refreshes===count);
   const active=catalogue.core.find(r=>r.id===channel+':professional');assert.equal(active.body,'Hello {{firstName}}. Exact '+channel+' wording.');assert.ok(active.creatorSource);assert.equal(active.builtin,false);
   const reopened=await request(),again=reopened.core.find(r=>r.id===active.id);assert.deepEqual(again,active);
   const sources=await request('/creator');assert.equal(sources.scripts.find(r=>r.id===active.creatorSource.id).original,'Exact supplied '+channel+' original');
  }
 }finally{ui.destroy();w.close();DB.raw.close();}
});
