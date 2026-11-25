const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

// Call with a customer, 24 Nov 2026, and the same remark the next morning: while a list is researched the panel showed
// the word "running" at the far right and three numbers. "Anyone looking from outside does not understand whether
// something has started or not", and nothing said how long it would take. A running list now says so itself: a moving
// mark with "Researching…", a clock, what the last operation was and how long ago, and a rough time left. All of it is
// read from the list's own receipts and counts; no extra request is made.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{for(let i=0;i<6;i++)await tick();};
const options=M.options({targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},market:{icps:[{id:'core',type:'core',active:true}],signals:[]}});
const criteria=M.configuration({profileIds:['core'],signalMode:'off',count:10,markets:['Denmark']},options);
const T0=Date.parse('2026-11-25T07:18:18Z');   // the list's created_at below, as the server writes it (UTC, no zone)
const receipt=(operation,target,secondsAfterStart,status='complete')=>({id:1,operation,target,status,at:new Date(T0+secondsAfterStart*1000).toISOString()});
function list(change={}){
 const {kept=0,receipts=[],status='running',progress={},keptAt=()=>102,...rest}=change;
 const results=Array.from({length:kept},(_,i)=>({company:'Works '+i,domain:'works'+i+'.example',website:'https://works'+i+'.example/',score:80-i,fitScore:80-i,signalBonus:0,matches:[{name:'Core',kind:'profile',strength:80,score:80,url:'https://source.example/'}],checkedAt:new Date(T0+keptAt(i)*1000).toISOString()}));
 return {id:'one',name:'Steel',criteria,status,revision:1,results,receipts,createdAt:'2026-11-25 07:18:18',updatedAt:'2026-11-25 07:20:00',progress:{count:kept,target:10,checked:kept+3,operations:40,allowance:400,reason:'',phase:'reviewing',nextAttemptAt:0,...progress},...rest};
}
// Opens the panel on the given list at the given moment. `now` can be moved; `second()` lets one second's tick run.
async function open(t,first,secondsAfterStart,respond=()=>({})){
 const w=new JSDOM('<main id="step-5"><section class="discovery-panel"><div id="company-search-context"></div></section></main>',{runScripts:'outside-only',url:'https://app.example/'}).window;
 t.after(()=>w.close());
 const clock={now:T0+secondsAfterStart*1000};let ticker=null,cleared=0;
 w.Date.now=()=>clock.now;
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;w.MutationObserver=class{observe(){}};
 w.setTimeout=()=>1;w.clearTimeout=()=>{};
 w.setInterval=(fn,ms)=>{assert.equal(ms,1000,'the live line moves once a second');assert.equal(ticker,null,'only one clock runs');ticker=fn;return 7;};
 w.clearInterval=id=>{if(id===7&&ticker){ticker=null;cleared++;}};
 w.LeadIntelDialogs={confirm:async()=>true};
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 let shown=first;
 w.fetch=async(url,request={})=>{const params=new URL(url).searchParams,body=request.body&&JSON.parse(request.body);const answer=params.has('options')?{options}:body?await respond(body):params.get('id')?{list:shown}:{lists:[shown]};if(answer.list)shown=answer.list;return {ok:!answer.error,status:200,json:async()=>answer};};
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
 w.document.querySelector('[data-cl="lists"]').click();await settle();
 w.document.querySelector('[data-cl="open"]').click();await settle();
 const find=selector=>w.document.querySelector(selector);
 const part=name=>find('[data-cl-live] [data-live="'+name+'"]')?.textContent??null;
 return {w,find,part,clock,live:()=>find('[data-cl-live]'),running:()=>Boolean(ticker),cleared:()=>cleared,
  second(n=1){for(let i=0;i<n;i++){clock.now+=1000;ticker();}},
  async click(command){find('[data-cl="'+command+'"]').click();await settle();}};
}

test('a running list says that it is running, for how long, and what it did last',async t=>{
 const h=await open(t,list({receipts:[receipt('search','steel manufacturers Denmark',5),receipt('page_read','https://www.steelinfo.dk/staal-gruppen/',249)]}),252);
 assert.ok(h.live(),'the live line is shown');
 assert.equal(h.live().classList.contains('cl-live-waiting'),false);
 assert.ok(h.find('[data-cl-live] .cl-live-dot'),'with its moving mark');
 assert.equal(h.part('head'),'Researching…');
 assert.equal(h.part('clock'),'Running 4:12');
 assert.equal(h.part('now'),'Now: reading steelinfo.dk · 3 s ago');
 assert.equal(h.part('estimate'),'Time left appears after the first two matches');
});

test('the clock and the "ago" move every second without a new status read',async t=>{
 const h=await open(t,list({receipts:[receipt('page_read','https://steelinfo.dk/',58)]}),59);
 assert.equal(h.part('clock'),'Running 0:59');assert.equal(h.part('now'),'Now: reading steelinfo.dk · 1 s ago');
 h.second();
 assert.equal(h.part('clock'),'Running 1:00');assert.equal(h.part('now'),'Now: reading steelinfo.dk · 2 s ago');
 h.second(65);
 assert.equal(h.part('clock'),'Running 2:05');assert.equal(h.part('now'),'Now: reading steelinfo.dk · 1 min ago');
});

test('each kind of operation is named in plain words',async t=>{
 for(const [operation,target,line] of [
  ['analysis','https://www.krak.dk/steel/firmaer','Now: assessing krak.dk · 0 s ago'],
  ['evidence_review','https://rustfri.dk/staalproduktion/','Now: reviewing the evidence of rustfri.dk · 0 s ago'],
  ['register_check','Give Steel A/S','Now: checking the business register for Give Steel A/S · 0 s ago'],
  ['search','site:example.dk stålproduktion','Now: searching the web · 0 s ago'],
  ['analysis','search plan','Now: planning the searches · 0 s ago']]){
  await t.test(operation+' '+target,async t=>{const h=await open(t,list({receipts:[receipt(operation,target,30)]}),30);assert.equal(h.part('now'),line);});
 }
 await t.test('before the first operation',async t=>{const h=await open(t,list(),2);assert.equal(h.part('now'),'Now: preparing the search');});
 await t.test('a company name is shown as text, never as markup',async t=>{
  const h=await open(t,list({receipts:[receipt('register_check','<img src=x onerror=alert(1)> A/S',30)]}),30);
  assert.equal(h.find('[data-cl-live] img'),null);assert.match(h.part('now'),/<img src=x/);
 });
});

test('from two matches on, the time left is worked out from the pace so far',async t=>{
 const two=await open(t,list({kept:2,receipts:[receipt('page_read','https://a.example/',239)]}),240);
 assert.equal(two.part('estimate'),'Estimated 12–20 min left at this pace','4 minutes for 2 companies, 8 to go');
 const nine=await open(t,list({kept:9,receipts:[receipt('page_read','https://a.example/',269)]}),270);
 assert.equal(nine.part('estimate'),'Estimated 1–2 min left at this pace','never less than a minute');
 const one=await open(t,list({kept:1,receipts:[receipt('page_read','https://a.example/',239)]}),240);
 assert.equal(one.part('estimate'),'Time left appears after the first two matches','one match is not a pace');
});

test('a list of another size does not borrow the figure measured for ten',async t=>{
 const big=M.configuration({profileIds:['core'],signalMode:'off',count:50,markets:['Denmark']},options);
 const h=await open(t,list({criteria:big}),30);
 assert.equal(h.part('estimate'),'Time left appears after the first two matches');
});

test('a list that waits for its next attempt says that it waits',async t=>{
 const h=await open(t,list({status:'queued',progress:{phase:'retrying',reason:'A research service is temporarily unavailable. Completed work is retained. Retrying automatically (1/2); no extra allowance is granted.'},receipts:[receipt('analysis','https://a.example/',100,'failed')]}),130);
 assert.equal(h.live().classList.contains('cl-live-waiting'),true);
 assert.equal(h.part('head'),'Waiting to retry…');
 assert.equal(h.part('clock'),'Running 2:10');
 assert.equal(h.part('now'),'','nothing is being worked on while it waits');
});

test('a list that is not being researched shows no live line and runs no clock',async t=>{
 for(const status of ['complete','incomplete','canceled']){
  await t.test(status,async t=>{const h=await open(t,list({status,kept:2}),600);assert.equal(h.live(),null);assert.equal(h.running(),false);});
 }
 await t.test('a running list that finishes stops its clock',async t=>{
  const h=await open(t,list({kept:9}),300,body=>{assert.equal(body.action,'pause');return {list:list({status:'canceled',kept:9})};});
  assert.equal(h.running(),true);
  await h.click('pause');
  assert.equal(h.live(),null);assert.equal(h.running(),false);assert.equal(h.cleared(),1);
 });
});

test('after "continue" the clock counts the run that was just started, not the time since the list was created',async t=>{
 const h=await open(t,list({status:'incomplete',kept:1,progress:{operations:200,allowance:200}}),1800,body=>{assert.equal(body.action,'resume');return {list:list({status:'queued',kept:1,progress:{operations:200,allowance:400}})};});
 assert.equal(h.live(),null);
 await h.click('resume');
 assert.equal(h.part('clock'),'Running 0:00');
 h.second(7);assert.equal(h.part('clock'),'Running 0:07');
});

// Live, 25 Nov 2026, release 1088435a: two seconds after "Keep searching" the line said "Now: assessing steelinfo.dk ·
// 18 min ago · Estimated 1–2 min left at this pace" — the last operation of the earlier run, and a pace worked out from
// the two companies that run had found.
test('right after "continue" the line does not show the earlier run\'s last operation or its pace',async t=>{
 const before=[receipt('analysis','https://steelinfo.dk/',700)];
 const h=await open(t,list({status:'incomplete',kept:2,receipts:before,progress:{operations:200,allowance:200}}),1800,()=>({list:list({status:'queued',kept:2,receipts:before,progress:{operations:200,allowance:400}})}));
 await h.click('resume');
 assert.equal(h.part('now'),'Now: continuing the search');
 assert.equal(h.part('estimate'),'Time left appears after the first two matches','two matches of the earlier run are not this run\'s pace');
 h.second(5);
 assert.equal(h.part('clock'),'Running 0:05');assert.equal(h.part('now'),'Now: continuing the search');
});

test('after "continue" the time left follows the matches of the run that is going on',async t=>{
 const during=[receipt('analysis','https://steelinfo.dk/',700),receipt('page_read','https://new.example/',2035)];
 const h=await open(t,list({status:'incomplete',kept:2,progress:{operations:200,allowance:200}}),1800,
  ()=>({list:list({status:'running',kept:4,keptAt:i=>i<2?102:1800+60*(i-1),receipts:during,progress:{operations:260,allowance:400}})}));
 await h.click('resume');h.second(240);
 assert.equal(h.part('clock'),'Running 4:00');
 assert.equal(h.part('now'),'Now: reading new.example · 5 s ago');
 assert.equal(h.part('estimate'),'Estimated 9–15 min left at this pace','2 new companies in 4 minutes, 6 to go');
});

test('restoring the workspace reads the remembered active run without a new start',async t=>{
 const h=await open(t,list(),60);
 const bridge=h.w.LeadIntelServerBridge;
 const reads=[];
 h.w.fetch=async(url,request)=>{
  reads.push([request.method,new URL(url).searchParams.get('workspace_id')]);
  return {ok:true,json:async()=>({list:list()})};
 };
 bridge.workspace.id='other';
 h.w.dispatchEvent(new h.w.Event('leadintel:account-changed'));await settle();
 assert.equal(h.live(),null);
 bridge.workspace.id='workspace';
 h.w.dispatchEvent(new h.w.Event('leadintel:account-changed'));await settle();
 assert.equal(h.part('clock'),'Running 1:00');
 assert.deepEqual(reads,[['GET','workspace']]);
});

test('a scheduled retry counts down locally',async t=>{
 const h=await open(t,list({progress:{phase:'retrying',nextAttemptAt:T0+90000}}),60);
 assert.equal(h.part('estimate'),'Next retry in 0:30');
 h.second(3);
 assert.equal(h.part('estimate'),'Next retry in 0:27');
});
