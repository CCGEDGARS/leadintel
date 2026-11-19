const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const options=M.options({
 targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},
 market:{icps:[{id:'core',type:'core',active:true},{id:'trigger',type:'trigger-led',active:true}],
  signals:[{id:'expansion',name:'Expansion',active:true}]}
});
const criteria=M.configuration({profileIds:['core'],signalMode:'off',count:10,markets:['Denmark']},options);
function list(status='running',revision=1){
 const results=[['Zinc',80],['Amber',60]].map(([company,score])=>({
  company,domain:company.toLowerCase()+'.example',website:'https://'+company.toLowerCase()+'.example/',
  score,fitScore:score,signalBonus:0,matches:[{name:'Core',kind:'profile',strength:score,score,url:'https://source.example/'}],
  checkedAt:'2026-11-19T12:00:00Z'
 }));
 return {id:'one',name:'Manufacturers',criteria,status,revision,results,receipts:[],progress:{count:2,target:10,checked:2,operations:8,allowance:10}};
}
function setup(t,respond){
 const dom=new JSDOM('<main id="step-5"><section class="discovery-panel"></section></main>',{runScripts:'outside-only',url:'https://app.example/'}),w=dom.window;
 t.after(()=>w.close());
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 let scheduled;
 w.MutationObserver=class{observe(){}};
 w.setTimeout=(fn,ms)=>{assert.equal(ms,5000);scheduled=fn;return 1;};
 w.clearTimeout=()=>{scheduled=null;};
 w.fetch=async(url,request)=>{
  const params=new URL(url).searchParams,body=request.body&&JSON.parse(request.body);
  const result=params.has('options')?{options}:await respond(params,body);
  return {ok:!result.error,json:async()=>result};
 };
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const find=selector=>w.document.querySelector(selector);
 return {w,find,poll:()=>scheduled(),scheduled:()=>scheduled,
  async click(command){find('[data-cl="'+command+'"]').click();await tick();},
  change(name,value){const el=find('[name="'+name+'"]');el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));}
 };
}
test('Review reports missing required triggers at the action and shows the effective optional mode with the chosen allowance',async t=>{
 let request;
 const h=setup(t,(_params,body)=>{request=body;return {error:'Strategy changed. Reopen Build company list.'};});
 await h.click('new');h.find('[name="signal"]').click();
 h.change('budget','10');await h.click('review');
 const error=h.find('#company-list-form-error');
 assert.equal(error.hidden,false);assert.equal(h.w.document.activeElement,error);
 assert.match(error.textContent,/signal/i);assert.equal(h.find('[data-cl="start"]'),null);
 h.find('[name="profile"][value="trigger"]').click();assert.equal(error.hidden,true);
 assert.equal(h.find('#company-list-optional-signals').hidden,false);
 assert.match(h.find('#company-list-allowance-note').textContent,/10 companies takes at least 32 operations/);
 await h.click('review');
 assert.match(h.find('#company-list-preview').textContent,/Profiles only/);
 assert.match(h.find('#company-list-preview').textContent,/Up to 10 research operations/);
 assert.equal(h.w.document.activeElement,h.find('#company-list-preview h4'));
 await h.click('start');assert.equal(request.count,10);assert.equal(request.budget,10);
 assert.equal(error.hidden,false);assert.equal(h.w.document.activeElement,error);
 assert.match(error.textContent,/Strategy changed/);
 h.change('preset','custom');h.change('count','1');
 assert.equal(h.find('#company-list-allowance-note').hidden,true);
 assert.equal(h.find('[name="budget"]').value,'10');assert.equal(h.find('[data-cl="start"]'),null);
 h.change('signalMode','require');await h.click('review');
 assert.equal(error.hidden,false);assert.equal(h.find('[data-cl="start"]'),null);
});
test('a delayed running status cannot restore a paused list or its timer; a deleted list clears stale actions',async t=>{
 let read=0,releasePoll,removed=false;
 const h=setup(t,(_params,body)=>{
  if(body){assert.deepEqual(body,{action:'pause',id:'one',revision:1});return {list:list('canceled',2)};}
  if(++read===2)return new Promise(resolve=>{releasePoll=()=>resolve({list:list()});});
  return {list:removed?null:list()};
 });
 await h.w.LeadIntelCompanyListUI.open('one');
 const pending=h.poll();await tick();await h.click('pause');
 assert.match(h.find('.cl-result-heading').textContent,/Paused/);
 releasePoll();await pending;
 assert.match(h.find('.cl-result-heading').textContent,/Paused/);assert.equal(h.scheduled(),null);
 removed=true;await h.click('refresh');
 assert.match(h.find('#company-list-content').textContent,/deleted/);assert.equal(h.find('[data-cl="buyer"]'),null);
});
test('sorting preserves the open evidence for the same company and labels the displayed order',async t=>{
 const h=setup(t,()=>({list:list('complete',3)}));
 await h.w.LeadIntelCompanyListUI.open('one');
 const top=()=>h.find('tbody tr td strong').textContent;
 assert.equal(top(),'Zinc');
 assert.match(h.find('tbody tr').textContent,/Profile fit 80\/90 · Signal bonus \+0\/10/);
 assert.match(h.find('[data-detail="company:zinc.example"]').textContent,/Assessed strength 80\/100 · Profile fit 80\/90/);
 h.find('[data-detail="company:zinc.example"]').open=true;
 const sort=async key=>{h.find('[data-sort="'+key+'"]').click();await tick();};
 await sort('company');assert.equal(top(),'Amber');assert.equal(h.find('th[aria-sort]').getAttribute('aria-sort'),'ascending');
 assert.equal(h.find('[data-detail="company:zinc.example"]').open,true);
 assert.equal(h.find('[data-detail="company:amber.example"]').open,false);
 await sort('company');assert.equal(top(),'Zinc');assert.equal(h.find('th[aria-sort]').getAttribute('aria-sort'),'descending');
 await sort('score');assert.equal(top(),'Zinc');
});
