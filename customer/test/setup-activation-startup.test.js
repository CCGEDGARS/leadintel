const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const MAIN='leadintel_customer_v2_state';

function harness(saved={}){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));
  const dom=new JSDOM(read('index.html'),{url:'https://leadintel.example/customer/',runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window,load=name=>w.eval(read(name));let init;
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.LeadIntelServerBridge={ready:true,session:{authenticated:true,user:{id:'user-a'}},workspace:{id:'workspace-a'}};
  w.LeadIntelAccountCache={current:()=>true,afterVerification:fn=>{init=fn;}};
  w.LeadIntelWorkspacePersistence={saveWorkspace:async()=>true};
  for(const name of ['content-language.js','step2-brief-schema.js','profile-engine.js','market-engine.js','targeting-policy.js','company-brain.js','workspace-isolation.js','website-activation.js'])load(name);
  w.localStorage.setItem(MAIN,JSON.stringify(saved));
  w.LeadIntelWebsiteActivation.ensureActivationUi();
  w.LeadIntelWebsiteActivation.render();
  // Optional shell modules can finish before authenticated app initialization.
  load('website-input-sync.js');
  w.eval(read('app.js').replace(/^import .*;\s*$/gm,'')+'\nwindow.__setupTest={getState:()=>state};');
  return {w,init:()=>init(),errors,state:()=>w.__setupTest.getState(),close:()=>w.close()};
}

test('Setup initializes and activates a company when optional source controls were removed before verification',async()=>{
  const h=harness();try{
    assert.equal(h.w.document.getElementById('additional-links'),null);
    assert.doesNotThrow(h.init,'an optional retired control must not abort all later journey bindings');
    const input=h.w.document.getElementById('company-website');input.focus();input.value='new-business.example';
    input.dispatchEvent(new h.w.Event('input',{bubbles:true}));
    input.dispatchEvent(new h.w.Event('change',{bubbles:true}));
    h.w.fetch=async()=>({ok:true,json:async()=>({data:{markdown:'Public business evidence',metadata:{title:'New Business'}}})});
    assert.equal(await h.w.LeadIntelWebsiteActivation.activateWebsite(),true);
    assert.equal(h.state().website,'https://new-business.example/','activation listeners must hydrate the app before navigation can save stale state');
    assert.equal(JSON.parse(h.w.localStorage.getItem(MAIN)).website,'https://new-business.example/');
    assert.equal(input.value,'new-business.example');
    assert.match(h.w.document.getElementById('website-activation-status').textContent,/Website active/);
    h.w.document.querySelector('[data-target-market]').click();
    assert.equal(JSON.parse(h.w.localStorage.getItem(MAIN)).website,'https://new-business.example/','the next Setup action must preserve the activated company');
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});

test('authenticated reload renders saved activation after restoring the website input',()=>{
  const url='https://saved-business.example/';
  const h=harness({website:url,websiteActivation:{status:'active',url,contentChars:24},scrapedSources:[{type:'website',url,title:'Saved Business',text:'Public business evidence',status:'ready'}]});
  try{
    assert.doesNotThrow(h.init);
    assert.equal(h.w.document.getElementById('company-website').value,'saved-business.example');
    assert.equal(h.w.LeadIntelWebsiteActivation.isCurrentWebsiteActive(url),true);
    assert.match(h.w.document.getElementById('website-activation-status').textContent,/Website active/);
    assert.equal(h.w.document.getElementById('activate-website').textContent,'Refresh website evidence');
    assert.deepEqual(h.errors,[]);
  }finally{h.close();}
});
