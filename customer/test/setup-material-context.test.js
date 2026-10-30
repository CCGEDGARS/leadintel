const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const materials=require('../company-materials.js');
const markup='<input id="pdf-input" type="file"><div id="company-material-list"></div><p id="company-material-status"></p>';
const card={id:'old',revision:1,filename:'Old account.pdf',kind:'pdf',status:'Ready'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};

test('material upload rejects an account change after ticket issuance before sending the file',async()=>{
 let current=true,calls=0;const ticket=deferred();
 const api=materials.createApi('w',async()=>{calls++;return calls===1?ticket.promise:Response.json({cards:[]});},()=>current);
 const pending=api.upload(new File(['private'],'private.pdf',{type:'application/pdf'}));
 current=false;ticket.resolve(Response.json({ticket:'old-account',uploadUrl:'https://leadintel-api.edgars-7e7.workers.dev/company-material-upload'}));
 await assert.rejects(pending,/changed|context/i);assert.equal(calls,1);
});

test('same-workspace account change clears material cards and rejects old list responses',async()=>{
 const dom=new JSDOM(markup),d=dom.window.document;let user='u1',calls=0;const old=deferred();
 const ui=materials.mount({document:d,currentWorkspace:()=> 'w',currentUser:()=>user,fetchImpl:async()=>++calls===1?old.promise:Response.json({cards:[]})});
 const pending=ui.sync();user='u2';await ui.sync();old.resolve(Response.json({cards:[card]}));await pending;
 assert.equal(calls,2);assert.doesNotMatch(d.getElementById('company-material-list').textContent,/Old account/);
 ui.destroy();dom.window.close();
});

test('material deletion confirmation cannot move to a different user in the same workspace',async()=>{
 const dom=new JSDOM(markup),d=dom.window.document;let user='u1',deletes=0;const approval=deferred();
 const ui=materials.mount({document:d,currentWorkspace:()=> 'w',currentUser:()=>user,confirm:()=>approval.promise,fetchImpl:async(url,options)=>{if(options.method==='DELETE')deletes++;return Response.json({cards:[card]});}});
 await ui.sync();d.querySelector('[data-material-delete]').click();user='u2';approval.resolve(true);await settle();
 assert.equal(deletes,0);ui.destroy();dom.window.close();
});

test('an invalidated browser account cannot consume an old material upload ticket while bridge IDs lag',async()=>{
 const dom=new JSDOM(markup,{url:'https://app.test'}),w=dom.window;let active=true,posts=0;const ticket=deferred(),started=deferred();
 w.localStorage.setItem('leadintel_account_context_v1','ticket-a');w.LeadIntelAccountCache={current:()=>active};
 const ui=materials.mount({document:w.document,currentWorkspace:()=> 'w',currentUser:()=> 'u',fetchImpl:async(url,options)=>{
  if(url.includes('upload-ticket')){started.resolve();return ticket.promise;}
  if(url.includes('company-material-upload'))posts++;
  return Response.json({cards:[]});
 }});await ui.sync();const pending=ui.upload([new File(['private'],'source.pdf',{type:'application/pdf'})]);await started.promise;
 active=false;w.localStorage.setItem('leadintel_account_context_v1','ticket-b');ticket.resolve(Response.json({ticket:'old',uploadUrl:'https://leadintel-api.edgars-7e7.workers.dev/company-material-upload'}));await pending;
 assert.equal(posts,0);ui.destroy();w.close();
});
