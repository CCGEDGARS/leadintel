const test=require('node:test'),assert=require('node:assert/strict'),UI=require('../company-dossier-ui.js'),D=require('../company-dossier.js');
test('a stalled dossier request reaches a finite deadline and aborts its transport',async()=>{
 let signal;const start=Date.now();
 await assert.rejects(UI.research({company:'Example',domain:'example.com'},{},{timeoutMs:25,pollMs:5,request:(_,s)=>{signal=s;return new Promise(()=>{});}}),/timed out/i);
 assert.ok(Date.now()-start<500);assert.equal(signal.aborted,true);
});
test('pending dossier reports actual checkpoint counts and ignores a different company context',async()=>{
 const candidate={company:'Example',domain:'example.com'},body={company:'Example',domain:'example.com',seller:{},roles:[],opportunity:'',formulas:[]};
 const events=[];let reads=0;
 const checkpoint=D.reconcile([] ,body);checkpoint.contextKey=D.contextKey(body);checkpoint.checkedAt=new Date(Date.now()+1000).toISOString();
 await assert.rejects(UI.research(candidate,{},{timeoutMs:35,pollMs:5,onProgress:p=>events.push(p),readProgress:async()=>{reads++;return {...checkpoint,contextKey:'different'};},request:()=>new Promise(()=>{})}),/timed out/i);
 assert.ok(reads>0);assert.ok(events.some(p=>p.elapsedSeconds>=0));assert.ok(events.every(p=>!p.providers?.length));assert.equal(candidate.buyerDiscovery?.companyDossier,undefined);
});
test('canceling a stalled dossier settles promptly without polling or late writes',async()=>{
 const controller=new AbortController(),candidate={company:'Example',domain:'example.com'};let calls=0;
 const work=UI.research(candidate,{},{signal:controller.signal,timeoutMs:1000,pollMs:5,onProgress:()=>calls++,request:()=>new Promise(()=>{})});controller.abort();
 await assert.rejects(work,/cancel/i);const before=calls;await new Promise(r=>setTimeout(r,15));assert.equal(calls,before);assert.equal(candidate.buyerDiscovery,undefined);
});
test('matching current checkpoints expose provider counts without promoting partial facts',async()=>{
 const body={company:'Example',domain:'example.com',seller:{},roles:[],opportunity:'',formulas:[]},candidate={company:'Example',domain:'example.com'},events=[];
 const checkpoint=D.reconcile([{provider:'openai',status:'partial',webSearch:true,searchFamilies:[{name:'leadership',kind:'leadership',status:'complete',attempts:1,completedAt:new Date().toISOString(),query:'CURRENT LEADERSHIP AND PROJECT DOSSIER Example',results:[{url:'https://example.com/team'}]},{name:'contacts',kind:'contacts',status:'attempted',query:'Example contacts',results:[]}],facts:[],people:[],channels:[],sources:[],gaps:[]}],body);
 await assert.rejects(UI.research(candidate,{},{timeoutMs:30,pollMs:5,onProgress:p=>events.push(p),readProgress:async()=>({dossier:checkpoint,updatedAt:new Date().toISOString()}),request:()=>new Promise(()=>{})}),/timed out/i);
 assert.ok(events.some(p=>p.providers?.some(r=>r.provider==='openai'&&r.completed===1)));assert.equal(candidate.buyerDiscovery?.companyDossier,undefined);
});
test('live progress updates preserve other company inputs, disclosures and focus',()=>{
 const {JSDOM}=require('jsdom'),fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 const dom=new JSDOM('<article data-buyer-company="example.com"><section class="buyer-research-progress"><p>Old progress</p></section><details open><summary>Dossier</summary><input value="draft source URL"></details></article>');
 const input=dom.window.document.querySelector('input');input.focus();
 const ctx={document:dom.window.document,canonicalDomain:x=>x,buyerResearchProgressHtml:()=>'<section class="buyer-research-progress"><p>New progress</p></section>'};vm.createContext(ctx);
 const start=source.indexOf('function refreshBuyerProgress('),end=source.indexOf('function buyerResearchProgressHtml(',start);assert.ok(start>=0,'progress has a scoped renderer');vm.runInContext(source.slice(start,end),ctx);
 ctx.refreshBuyerProgress({domain:'example.com'});assert.equal(input.value,'draft source URL');assert.equal(dom.window.document.activeElement,input);assert.equal(dom.window.document.querySelector('details').open,true);assert.match(dom.window.document.querySelector('.buyer-research-progress').textContent,/New progress/);
});
