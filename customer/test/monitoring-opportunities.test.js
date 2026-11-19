const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),Model=require('../monitoring-model.js');
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
function fixture(){
 const dom=new JSDOM('<header></header>',{url:'https://app.example/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;let tick,time=Date.now(),rows=[],token=0,summaryWait=null,scope={authenticated:true,id:'one'};
 w.Date.now=()=>time;w.setInterval=fn=>{tick=fn;};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const file of ['monitoring-model.js','monitoring-inbox.js'])w.eval(fs.readFileSync(require.resolve('../'+file),'utf8'));
 const calls=[],counts=()=>({opportunities:rows.filter(f=>f.status==='new'&&Model.isOpportunity(f)).length,needsReview:rows.filter(f=>f.status==='new'&&!Model.isOpportunity(f)).length,total:rows.length,changeToken:String(token)});
 const api=async(path,opts={})=>{calls.push([path,opts.method||'GET']);if(path.endsWith('/summary')){const value=counts();if(summaryWait)return new Promise(resolve=>{summaryWait.resolve=()=>resolve(value);});return value;}
  if(path.includes('/inbox?'))return {...counts(),findings:rows,role:'owner',templates:[],monitors:[{id:'legacy',name:'Court monitor',frequency:'daily',enabled:true,lastSuccessfulAt:'2026-11-18T10:00:00Z',nextRunAt:'2099-11-20T10:00:00Z',latestRun:{status:'failed',error:'provider_credits_exhausted'}}]};
  const finding=rows.find(f=>path.endsWith('/'+f.id));if(opts.method==='PATCH'){finding.status=JSON.parse(opts.body).status;token++;return {updated:true};}return {finding,subjects:[],messages:[],versions:[]};};
 w.LeadIntelMonitoringInbox.configure({api,capture:()=>scope,current:value=>scope===value,settings(){}});
 const add=(id,qualified)=>{rows.unshift({id,purpose:'court',title:'Case '+id,status:'new',revision:1,event:{sourceUrl:'https://public.example/'+id,publishedAt:'2026-11-19',access:'read'},assessment:{relevant:qualified,meetsThreshold:qualified,score:qualified?85:20,matchedTerms:qualified?['commercial']:[],gaps:qualified?[]:['Missing party identity']}});token++;};
 return {w,dom,calls,add,pulse:async()=>{time+=61000;tick();await settle();},deferSummary:()=>summaryWait={},release:()=>{summaryWait.resolve();summaryWait=null;},switchWorkspace:()=>scope={authenticated:true,id:'two'}};
}
test('automatic arrivals, separate counts, explicit review and reopening use saved lifecycle without implicit writes',async()=>{
 const f=fixture();try{f.add('verify',false);await f.w.LeadIntelMonitoringInbox.open();assert.equal(f.w.document.querySelector('[data-monitor-inbox-badge]').textContent,'');assert.match(f.w.document.querySelector('[data-mi-count]').textContent,/1 need verification/);assert.match(f.w.document.querySelector('.mi-health-error').textContent,/attention/);assert.match(f.w.document.querySelector('[data-mi-health]').textContent,/credits are exhausted/);
 f.add('opportunity',true);await f.pulse();assert.equal(f.w.document.querySelector('[data-mi="finding"]').dataset.id,'opportunity');assert.equal(f.w.document.querySelector('[data-monitor-inbox-badge]').textContent,'1');assert.match(f.w.document.querySelector('.mi-opportunity').textContent,/Published: 2026-11-19 · Relevance: 85\/100/);
 f.w.document.querySelector('[data-mi="finding"]').click();await settle();assert.equal(f.w.document.querySelector('[data-monitor-inbox-badge]').textContent,'1');assert.ok(f.calls.every(([,method])=>method==='GET'));
 f.w.LeadIntelMonitoringInbox.close();await f.w.LeadIntelMonitoringInbox.open();assert.equal(f.w.document.querySelector('[data-monitor-inbox-badge]').textContent,'1');f.w.document.querySelector('[data-mi="finding"]').click();await settle();f.w.document.querySelector('[data-mi="review"]').click();await settle();assert.equal(f.w.document.querySelector('[data-monitor-inbox-badge]').textContent,'');assert.equal(f.calls.filter(([,method])=>method==='PATCH').length,1);
 }finally{f.dom.window.close();}
});
test('a delayed summary cannot restore counts after manual review or expose another workspace',async()=>{
 const f=fixture();try{f.add('opportunity',true);await f.w.LeadIntelMonitoringInbox.open();f.deferSummary();await f.pulse();f.w.document.querySelector('[data-mi="finding"]').click();await settle();f.release();await settle();f.w.document.querySelector('[data-mi="review"]').click();await settle();assert.equal(f.w.document.querySelector('[data-monitor-inbox-badge]').textContent,'');f.deferSummary();await f.pulse();f.switchWorkspace();f.release();await f.pulse();assert.equal(f.w.document.querySelector('dialog').open,false);assert.equal(f.w.document.querySelector('[data-monitor-inbox-badge]').textContent,'');}finally{f.dom.window.close();}
});
test('monitor health distinguishes incomplete, overdue, paused and successful empty checks',()=>{
 const base={enabled:true,frequency:'daily',nextRunAt:'2026-11-19T09:00:00Z',lastSuccessfulAt:'2026-11-18T09:00:00Z'};
 assert.equal(Model.monitorHealth({...base,latestRun:{status:'completed'}},Date.parse('2026-11-19T11:00:00Z')).blocked,true);
 assert.equal(Model.monitorHealth({...base,enabled:false,latestRun:{status:'completed'}}).blocked,false);
 assert.match(Model.monitorHealth({...base,latestRun:{status:'partial',error:'1 research queries failed'}}).issue,/incomplete/);
 assert.equal(Model.monitorHealth({...base,nextRunAt:'2099-01-01',latestRun:{status:'completed'}}).blocked,false);
 const e=Model.extractEvents({url:'https://court.example/',sourceRead:true,text:'Case number: X1\nHearing date: 2026-12-10\nClaimant (company): Example Ltd'},{purpose:'court'})[0];assert.equal(e.publishedAt,'','hearing date is not a publication date');
});
