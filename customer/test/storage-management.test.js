const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function setup(){
 const w=new JSDOM('<body><button id="open">Open</button><div data-research-reports></div></body>',{url:'https://app.test/customer/',runScripts:'outside-only'}).window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.LeadIntelServerBridge={ready:true,session:{authenticated:true,user:{id:'u1'}},workspace:{id:'w1',role:'owner'}};
 return w;
}
test('storage manager saves preferences; deletion requires confirmation and uses the displayed revision',async()=>{
 const w=setup(),calls=[];let allow=false,exists=true,policy={auto_report_copies:true,revision:0};
 w.LeadIntelDialogs={confirm:async()=>allow};let refreshed=0;w.LeadIntelStorage={refresh:()=>refreshed++};
 w.fetch=async(url,options)=>{calls.push({url,options});let result;
  if(url.includes('/preferences')){if(options.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.revision,policy.revision);policy={auto_report_copies:body.auto_report_copies,revision:policy.revision+1};}result={workspace_id:'w1',preferences:policy};}
  else if(url.includes('/files'))result={workspace_id:'w1',files:exists?[{id:'a',kind:'material',name:'<Unsafe>.pdf',bytes:2000000,measured:true,status:'Ready',revision:7}]:[]};
  else{assert.equal(options.method,'DELETE');assert.equal(JSON.parse(options.body).expectedRevision,7);exists=false;result={cards:[]};}
  return {ok:true,json:async()=>result};
 };
 try{
  w.eval(source('workspace-storage-management.js'));w.LeadIntelStorageManagement.open();await tick();
  assert.match(w.document.querySelector('dialog').textContent,/<Unsafe>\.pdf/);assert.equal(w.document.querySelector('unsafe'),null);
  const input=w.document.querySelector('[data-auto-reports]');input.checked=false;input.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();assert.equal(policy.auto_report_copies,false);
  w.document.querySelector('[data-delete-file]').click();await tick();assert.equal(calls.filter(c=>c.options.method==='DELETE').length,0);
  allow=true;w.document.querySelector('[data-delete-file]').click();await tick();await tick();assert.equal(exists,false);assert.equal(refreshed,1);assert.match(w.document.querySelector('dialog').textContent,/No uploaded/);
  w.document.querySelector('[data-storage-close]').click();w.LeadIntelStorageManagement.open();await tick();assert.equal(w.document.querySelector('[data-auto-reports]').checked,false);
 }finally{w.close();}
});
test('switching workspace during deletion confirmation never deletes the previous file',async()=>{
 const w=setup();let confirm,calls=0;
 w.LeadIntelDialogs={confirm:()=>new Promise(resolve=>confirm=resolve)};
 w.fetch=async(url,options)=>{if(options.method==='DELETE')calls++;return {ok:true,json:async()=>url.includes('/files')?{workspace_id:'w1',files:[{id:'a',name:'Saved book',kind:'book',status:'Ready',revision:1}]}:{workspace_id:'w1',preferences:{auto_report_copies:true,revision:0}}};};
 try{w.eval(source('workspace-storage-management.js'));w.LeadIntelStorageManagement.open();await tick();w.document.querySelector('[data-delete-file]').click();w.LeadIntelServerBridge.workspace.id='w2';w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));confirm(true);await tick();assert.equal(calls,0);assert.equal(w.document.querySelector('dialog').open,false);}finally{w.close();}
});
function reports(w,{allowed=async()=>false}={}){
 let state={profile:{companyName:'Acme'},market:{lastResearchAt:'2026-11-19',researchStatus:'complete',researchResults:[{url:'https://example.test',title:'Evidence'}],researchReports:[]}},saves=0;
 w.LeadIntelStorageManagement={reportCopiesAllowed:allowed};w.eval(source('research-report.js'));
 const ui=w.LeadIntelResearchReport.install({getState:()=>state,save:()=>saves++,onStrategy:()=>{}});
 return {ui,get state(){return state;},replace:next=>state=next,get saves(){return saves;}};
}
test('manual-only reports preserve evidence, allow explicit saves, avoid duplicates and survive reload',async()=>{
 const w=setup();try{const f=reports(w);assert.equal(await f.ui.capture(),false);assert.equal(f.saves,0);assert.equal(f.state.market.researchResults.length,1);assert.equal(await f.ui.capture({manual:true}),true);assert.equal(f.saves,1);assert.equal(await f.ui.capture({manual:true}),false);const saved=JSON.parse(JSON.stringify(f.state));f.replace(saved);f.ui.render();assert.equal(saved.market.researchReports.length,1);assert.match(w.document.body.textContent,/already saved/);}finally{w.close();}
});
test('failed policy checks, empty results and delayed responses never create unwanted snapshots',async()=>{
 const w=setup();try{let finish;const f=reports(w,{allowed:()=>new Promise(resolve=>finish=resolve)});const pending=f.ui.capture();f.replace(JSON.parse(JSON.stringify(f.state)));finish(true);assert.equal(await pending,false);assert.equal(f.saves,0);
 w.LeadIntelStorageManagement.reportCopiesAllowed=async()=>{throw Error('offline');};assert.equal(await f.ui.capture(),false);assert.match(w.document.body.textContent,/could not be checked/);
 f.state.market.researchResults=[];w.LeadIntelStorageManagement.reportCopiesAllowed=async()=>true;assert.equal(await f.ui.capture(),false);assert.equal(f.saves,0);
 }finally{w.close();}
});
test('a harmless market normalization during preference loading saves into the current state',async()=>{
 const w=setup();try{let finish;const f=reports(w,{allowed:()=>new Promise(resolve=>finish=resolve)});const old=f.state.market,pending=f.ui.capture();f.state.market=JSON.parse(JSON.stringify(old));finish(true);assert.equal(await pending,true);assert.equal(f.state.market.researchReports.length,1);assert.equal(old.researchReports.length,0);assert.equal(f.saves,1);}finally{w.close();}
});
test('a storage outage is visible as an error, never as an empty file inventory',async()=>{
 const w=setup();w.fetch=async()=>{throw Error('Storage connection unavailable');};
 try{w.eval(source('workspace-storage-management.js'));w.LeadIntelStorageManagement.open();await tick();assert.match(w.document.querySelector('dialog').textContent,/File list unavailable/);assert.doesNotMatch(w.document.querySelector('dialog').textContent,/No uploaded company files/);assert.equal(w.document.querySelector('[data-storage-message]').dataset.error,'true');assert.equal(w.document.querySelector('[data-auto-reports]').disabled,true);}finally{w.close();}
});
