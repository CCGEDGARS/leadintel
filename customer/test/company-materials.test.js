const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');let api={};try{api=require('../company-materials.js');}catch{}
const markup='<label id="upload-zone"><input id="pdf-input" type="file" multiple></label><div id="company-material-list"></div><p id="company-material-status"></p>';
const card={id:'one',filename:'Customer reference.png',kind:'image',status:'Ready',revision:2,analysis:{summary:'Practical training',evidence:[{location:'image:1',quote:'Useful workshop.'}]}};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
test('durable company material interface exists',()=>assert.equal(typeof api.mount,'function'));
test('upload API uses authenticated one-time authorization and sends originals directly without browser state storage',async()=>{
 const calls=[],file=new File(['%PDF-test'],'test.pdf',{type:'application/pdf'}),fetchImpl=async(url,options)=>{calls.push({url,options});return Response.json(calls.length===1?{ticket:'single-use',uploadUrl:'https://leadintel-api.edgars-7e7.workers.dev/company-material-upload'}:{cards:[card]});};
 await api.createApi('w1',fetchImpl).upload(file);assert.match(calls[0].url,/workspace_id=w1/);assert.equal(calls[0].options.credentials,'include');assert.equal(calls[1].options.credentials,'omit');assert.equal(await calls[1].options.body.get('file').text(),'%PDF-test');
 await assert.rejects(api.createApi('w1',async()=>Response.json({uploadUrl:'https://evil.test/company-material-upload'})).upload(file),/endpoint/);
});
test('loads saved files, shows source review and original link, supports retry and confirmed deletion',async()=>{
 const dom=new JSDOM(markup,{url:'https://app.test'}),d=dom.window.document;let cards=[card],workspace='w1',deleted=0;
 const fetchImpl=async(url,options={})=>{if(options.method==='DELETE'){deleted++;cards=[];}if(url.includes('/extracted'))return Response.json({...card,sections:[{location:'image:1',text:'Useful workshop.'}]});return Response.json({cards});};
 const ui=api.mount({document:d,currentWorkspace:()=>workspace,fetchImpl,confirm:async()=>true});await ui.sync();assert.match(d.getElementById('company-material-list').textContent,/Customer reference.png/);assert.match(d.querySelector('a').href,/\/original\?workspace_id=w1/);
 d.querySelector('[data-material-review]').click();await settle();assert.match(d.getElementById('company-material-list').textContent,/Useful workshop/);
 d.querySelector('[data-material-delete]').click();await settle();assert.equal(deleted,1);assert.ok(!d.getElementById('company-material-list').textContent.includes(card.filename));
 cards=[{...card,status:'Needs attention',error:'Check clarity'}];await ui.sync({refresh:true});assert.ok(d.querySelector('[data-material-retry]'));ui.destroy();dom.window.close();
});
test('stale workspace responses never appear in the new workspace and cancel leaves originals intact',async()=>{
 const dom=new JSDOM(markup),d=dom.window.document;let workspace='w1',resolve,deleted=0;
 const fetchImpl=(url,options={})=>{if(options.method==='DELETE')deleted++;return url.includes('workspace_id=w1')?new Promise(r=>resolve=r):Promise.resolve(Response.json({cards:[]}));};
 const ui=api.mount({document:d,currentWorkspace:()=>workspace,fetchImpl,confirm:async()=>false});const pending=ui.sync();workspace='w2';await ui.sync();resolve(Response.json({cards:[card]}));await pending;assert.ok(!d.getElementById('company-material-list').textContent.includes(card.filename));assert.equal(deleted,0);ui.destroy();dom.window.close();
});
test('heading, separate limits, image formats and processing help are shipped together',()=>{const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');assert.match(html,/<h3>Company materials, references and success stories<\/h3>/);assert.match(html,/image\/jpeg,image\/png/);assert.match(html,/5 PDFs.*10 images/);assert.match(html,/company-materials\.js/);});

test('file selection and drop are wired independently of main app startup and cannot double-upload',async()=>{
 const dom=new JSDOM(markup,{url:'https://app.test'}),d=dom.window.document;let uploads=0,legacy=0;
 const fetchImpl=async(url,options={})=>{if(url.includes('upload-ticket'))return Response.json({ticket:'once',uploadUrl:'https://leadintel-api.edgars-7e7.workers.dev/company-material-upload'});if(url.includes('/company-material-upload'))uploads++;return Response.json({cards:[]});};
 const ui=api.mount({document:d,currentWorkspace:()=> 'w1',fetchImpl});await ui.sync();
 const input=d.getElementById('pdf-input');input.addEventListener('change',()=>legacy++);
 Object.defineProperty(input,'files',{value:[new File(['%PDF-sample'],'brochure.pdf',{type:'application/pdf'})]});input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await settle();
 assert.equal(uploads,1);assert.equal(legacy,0);
 const drop=new dom.window.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(drop,'dataTransfer',{value:{files:input.files}});d.getElementById('upload-zone').dispatchEvent(drop);await settle();assert.equal(uploads,2);
 ui.destroy();dom.window.close();
});
