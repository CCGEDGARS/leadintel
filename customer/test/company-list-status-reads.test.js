const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

// While a list is researched the page asks for its state every five seconds. On 23 Nov 2026 such reads of a running
// buyer research were dropped 11 times in 26 minutes (the gateway's 502, reads without an answer). The list panel
// ended its watching at the first one: the progress stood still and only "Use Refresh to retry." was left, while the
// research went on at the server. The buyer panel got this repair the same day (`buyer-research-jobs.js`).
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{for(let i=0;i<8;i++)await tick();};
const options=M.options({targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},market:{icps:[{id:'core',type:'core',active:true}],signals:[]}});
const criteria=M.configuration({profileIds:['core'],signalMode:'off',count:10,markets:['Denmark']},options);
function list(status,count=2){
 const results=[['Zinc',80],['Amber',60],['Brass',55]].slice(0,count).map(([company,score])=>({company,domain:company.toLowerCase()+'.example',website:'https://'+company.toLowerCase()+'.example/',score,fitScore:score,signalBonus:0,matches:[{name:'Core',kind:'profile',strength:score,score,url:'https://source.example/'}],checkedAt:'2026-11-19T12:00:00Z'}));
 return {id:'one',name:'Manufacturers',criteria,status,revision:1,results,receipts:[],progress:{count,target:10,checked:count,operations:8,allowance:100}};
}
const answered=body=>({ok:!body.error,status:body.error?409:200,json:async()=>body});
const gatewayText=status=>({ok:status===200,status,json:async()=>{throw new SyntaxError('Unexpected token \'L\', "LeadIntel "... is not valid JSON');}});
const refusalPage=status=>({ok:false,status,json:async()=>{throw new SyntaxError('Unexpected token \'<\'');}});
const noNetwork=()=>{throw new TypeError('Failed to fetch');};
const noAnswerInTime=()=>{throw Object.assign(new Error('The operation was aborted due to timeout'),{name:'TimeoutError'});};
// The page is opened on a running list; then every status read is answered by the next entry of `reads`.
async function watch(t,reads){
 const w=new JSDOM('<main id="step-5"><section class="discovery-panel"><div id="company-search-context"></div></section></main>',{runScripts:'outside-only',url:'https://app.example/'}).window;
 t.after(()=>w.close());
 const timers=[],sent=[];let watching=false;
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;w.MutationObserver=class{observe(){}};
 w.setTimeout=(fn,ms)=>{timers.push({fn,ms,live:true});return timers.length;};
 w.clearTimeout=id=>{if(timers[id-1])timers[id-1].live=false;};
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 w.fetch=async(url,init={})=>{
  const params=new URL(url).searchParams;
  if(watching&&params.get('id')){sent.push(init.method||'GET');const next=reads.shift();if(!next)throw new Error('the test has no answer for another status read');return next();}
  return answered(params.has('options')?{options}:params.get('id')?{list:list('running')}:{lists:[list('running')]});
 };
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
 w.document.querySelector('[data-cl="lists"]').click();await settle();
 w.document.querySelector('[data-cl="open"]').click();await settle();
 watching=true;
 const $=id=>w.document.getElementById(id);
 return {sent,notice:()=>$('company-list-notice').textContent,rows:()=>w.document.querySelectorAll('[data-cl="buyer"]').length,
  waiting:()=>timers.filter(timer=>timer.live&&timer.ms===5000).length,
  // Lets the five seconds pass: runs the one pending status read, if there is one.
  async turn(){const timer=timers.find(timer=>timer.live&&timer.ms===5000);if(!timer)return false;timer.live=false;await timer.fn();await settle();return true;}};
}
const STOPPED='The research may still be running. Use Refresh to see where it is.';

test('a status read that is not answered is asked again and the progress goes on',async t=>{
 for(const [name,miss] of [['no network',noNetwork],['no answer in time',noAnswerInTime],['gateway text with 502',()=>gatewayText(502)],['gateway text with 503',()=>gatewayText(503)],['gateway text with 504',()=>gatewayText(504)],['cut-off answer with 200',()=>gatewayText(200)]]){
  await t.test(name,async t=>{
   const page=await watch(t,[miss,()=>answered({list:list('running',3)})]);
   assert.equal(page.rows(),2);assert.equal(page.waiting(),1,'setup: one status read is waiting');
   assert.equal(await page.turn(),true);
   assert.equal(page.notice(),'','nothing is reported for one missed read');
   assert.equal(page.waiting(),1,'the next read is waiting');
   assert.equal(await page.turn(),true);
   assert.equal(page.rows(),3,'the third company appears');assert.equal(page.notice(),'');
   assert.equal(page.waiting(),1,'and the watching goes on');
  });
 }
});

test('eight missed reads in a row end the watching with a line that says what to do; seven do not',async t=>{
 const page=await watch(t,[...Array(7).fill(noNetwork),()=>answered({list:list('running',3)}),...Array(8).fill(()=>gatewayText(502))]);
 for(let i=0;i<7;i++)await page.turn();
 assert.equal(page.notice(),'');assert.equal(page.waiting(),1);
 await page.turn();assert.equal(page.rows(),3,'an answered read starts the count again');
 for(let i=0;i<7;i++)await page.turn();
 assert.equal(page.notice(),'');assert.equal(page.waiting(),1,'seven after an answer are still asked again');
 await page.turn();
 assert.equal(page.notice(),STOPPED);assert.equal(page.waiting(),0,'no further read is waiting');
 assert.equal(page.rows(),3,'what was shown stays');
});

test('a refusal is shown at once and is not asked again',async t=>{
 for(const [name,refusal,line] of [
  ['the server says why',()=>answered({error:'Company lists are temporarily unavailable.'}),'Company lists are temporarily unavailable. Use Refresh to retry.'],
  ['sign-in page with 401',()=>refusalPage(401),null],['forbidden page with 403',()=>refusalPage(403),null],['missing with 404',()=>refusalPage(404),null],['rate-limit page with 429',()=>refusalPage(429),null],['server error page with 500',()=>refusalPage(500),null],
  ['an error of the page itself',()=>{throw new Error('Sign in and select a workspace first.');},'Sign in and select a workspace first. Use Refresh to retry.'],
  ['a programming error that is not a failed request',()=>{throw Object.assign(new TypeError('x is not a function'),{code:'BUG'});},'x is not a function Use Refresh to retry.']]){
  await t.test(name,async t=>{
   const page=await watch(t,[refusal]);
   await page.turn();
   assert.match(page.notice(),/Use Refresh to retry\.$/);if(line)assert.equal(page.notice(),line);
   assert.equal(page.waiting(),0,'the watching ended');assert.equal(page.sent.length,1);
  });
 }
});

test('watching only reads: no request other than GET is ever repeated',async t=>{
 const page=await watch(t,[noNetwork,noAnswerInTime,()=>gatewayText(502),()=>answered({list:list('running',3)})]);
 for(let i=0;i<4;i++)await page.turn();
 assert.deepEqual(page.sent,['GET','GET','GET','GET']);
});

test('a list that finished or was deleted meanwhile ends the watching as before',async t=>{
 const done=await watch(t,[noNetwork,()=>answered({list:list('complete',3)})]);
 await done.turn();await done.turn();
 assert.equal(done.rows(),3);assert.equal(done.waiting(),0);assert.equal(done.notice(),'');
 const gone=await watch(t,[()=>gatewayText(502),()=>answered({})]);
 await gone.turn();await gone.turn();
 assert.equal(gone.waiting(),0);
});
