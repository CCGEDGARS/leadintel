const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

// 24–25 Nov 2026, customer call and the morning after. Two things made every list stop with a sentence nobody
// understood ("Research allowance reached. Completed matches are retained. Resume grants the displayed additional
// allowance."): (1) the form recommended 20 operations a company, while kept companies cost 22–43 operations each in
// four measured lists of ten (215, 325, 390, 434) and five companies with the recommended 100 stopped at 2 of 5;
// (2) the stop spoke in the platform's own terms. The recommendation is now 40 a company, and a list that used its
// allowance says in plain words what it found and offers one button.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{for(let i=0;i<6;i++)await tick();};
const options=M.options({targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},market:{icps:[{id:'core',type:'core',active:true}],signals:[]}});
function list({kept=2,count=5,budget=200,checked=22,operations=200,allowance=200,status='incomplete',reason='Research allowance reached. Completed matches are retained. Resume grants the displayed additional allowance.'}={}){
 const criteria=M.configuration({profileIds:['core'],signalMode:'off',count,budget,markets:['Denmark']},options);
 const results=Array.from({length:kept},(_,i)=>({company:'Works '+i,domain:'works'+i+'.example',website:'https://works'+i+'.example/',score:80-i,fitScore:80-i,signalBonus:0,matches:[{name:'Core',kind:'profile',strength:80,score:80,url:'https://source.example/'}],checkedAt:'2026-11-25T07:20:00Z'}));
 return {id:'one',name:'Steel',criteria,status,revision:1,results,receipts:[],createdAt:'2026-11-25 07:18:18',updatedAt:'2026-11-25 07:20:00',progress:{count:kept,target:count,checked,operations,allowance,reason,phase:'reviewing',nextAttemptAt:0}};
}
async function panel(t,shown,respond=()=>({})){
 const w=new JSDOM('<main id="step-5"><section class="discovery-panel"><div id="company-search-context"></div></section></main>',{runScripts:'outside-only',url:'https://app.example/'}).window;
 t.after(()=>w.close());
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;w.MutationObserver=class{observe(){}};
 w.setTimeout=()=>1;w.clearTimeout=()=>{};w.setInterval=()=>7;w.clearInterval=()=>{};
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 w.fetch=async(url,request={})=>{const params=new URL(url).searchParams,body=request.body&&JSON.parse(request.body);const answer=params.has('options')?{options}:body?await respond(body):params.get('id')?{list:shown}:{lists:shown?[shown]:[]};return {ok:!answer.error,status:200,json:async()=>answer};};
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
 const find=selector=>w.document.querySelector(selector);
 const click=async command=>{find('[data-cl="'+command+'"]').click();await settle();};
 if(shown){await click('lists');await click('open');}
 return {find,click};
}

test('the recommended allowance is forty operations a company, never under a hundred, never over the limit',()=>{
 assert.equal(M.recommendedBudget(10),400);
 assert.equal(M.recommendedBudget(5),200);
 assert.equal(M.recommendedBudget(1),100);
 assert.equal(M.recommendedBudget(50),2000);
 assert.equal(M.recommendedBudget(200),5000);
});

test('the list form opens without an operation limit',async t=>{
 const h=await panel(t,null);await h.click('new');
 assert.equal(h.find('[name="preset"]').value,'10');
 assert.equal(h.find('[name="budget"]').value,'');
});

test('a list that used its allowance says what it found, in plain words, and offers one button',async t=>{
 let sent;
 const h=await panel(t,list(),body=>{sent=body;return {list:list({status:'queued',allowance:400})};});
 const message=h.find('#company-list-content [role="status"]');
 assert.equal(message.textContent,'The search paused: 2 of 5 companies found so far, 22 pages checked. Your results are kept.');
 assert.equal(message.classList.contains('cl-paused'),true);
 assert.equal(message.classList.contains('cl-blocker'),false,'a pause is not an error');
 assert.doesNotMatch(h.find('#company-list-content').textContent,/allowance reached|Resume grants/i);
 assert.equal(h.find('[data-cl="resume"]').textContent,'Keep searching');
 assert.equal(h.find('#company-list-content .cl-continue-note').textContent,'Continues toward your target with the saved criteria.');
 await h.click('resume');
 assert.equal(sent.action,'resume');
});

test('one company and one page are written in the singular',async t=>{
 const h=await panel(t,list({kept:1,checked:1}));
 assert.equal(h.find('#company-list-content [role="status"]').textContent,'The search paused: 1 of 5 companies found so far, 1 page checked. Your results are kept.');
});

test('a list that stopped for another reason keeps its own reason and its own button',async t=>{
 const reason='A research provider has insufficient credits. Check its billing in Settings, then resume; completed matches are retained.';
 const h=await panel(t,list({operations:120,allowance:400,reason}));
 const message=h.find('#company-list-content [role="status"]');
 assert.equal(message.textContent,reason);
 assert.equal(message.classList.contains('cl-blocker'),true);
 assert.equal(h.find('[data-cl="resume"]').textContent,'Resume within remaining allowance');
 assert.equal(h.find('#company-list-content .cl-continue-note'),null);
});

test('a finished list shows neither the pause nor the button',async t=>{
 const h=await panel(t,list({kept:5,status:'complete',operations:200,allowance:200,reason:'Requested number of matching companies reached'}));
 assert.equal(h.find('#company-list-content [role="status"]').textContent,'Requested number of matching companies reached');
 assert.equal(h.find('[data-cl="resume"]'),null);assert.equal(h.find('#company-list-content .cl-continue-note'),null);
});
