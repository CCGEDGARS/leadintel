const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');
const T=require('../target-criteria.js');

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const options=M.options({targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},market:{icps:[{id:'core',type:'core',active:true}],signals:[]}});
function setup(t,respond,{withCriteria=true}={}){
 const dom=new JSDOM('<main id="step-5"><section class="discovery-panel"><div id="company-search-context"></div></section></main>',{runScripts:'outside-only',url:'https://app.example/'}),w=dom.window;
 t.after(()=>w.close());
 w.LeadIntelCompanyLists=M;if(withCriteria)w.LeadIntelTargetCriteria=T;w.AbortSignal=AbortSignal;
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 w.MutationObserver=class{observe(){}};w.setTimeout=()=>1;w.clearTimeout=()=>{};
 w.fetch=async(url,request)=>{
  const params=new URL(url).searchParams,body=request.body&&JSON.parse(request.body);
  const result=params.has('options')?{options}:await respond(params,body);
  return {ok:!result.error,json:async()=>result};
 };
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const find=selector=>w.document.querySelector(selector);
 return {w,find,
  async click(command){find('[data-cl="'+command+'"]').click();await tick();},
  type(name,value){const el=find('[name="'+name+'"]');el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));},
  tick(selector){const el=find(selector);el.click();el.dispatchEvent(new w.Event('change',{bubbles:true}));}
 };
}
const started=body=>({list:{id:'one',name:'Sized',criteria:M.configuration(body,options),status:'queued',revision:1,results:[],receipts:[],progress:{count:0,target:10,checked:0,operations:0,allowance:200}}});

test('the form collects size evidence and filters only by selected industry and registry settings',async t=>{
 let request;const h=setup(t,(_p,body)=>{request=body;return started(body);});
 await h.click('new');
 assert.match(h.find('#company-list-target-fields legend').textContent,/industry and business register/i);
 assert.equal(h.find('[name="registryOnly"]').checked,false);
 assert.match(h.find('[name="industry"][value="25"]').closest('label').textContent,/Fabricated metal products/);
 assert.equal(h.w.document.querySelectorAll('[name="industry"]').length,T.DIVISIONS.length);

 h.type('budget','10');h.tick('[name="registryOnly"]');
 h.tick('[name="industry"][value="25"]');h.tick('[name="industry"][value="24"]');
 assert.match(h.find('#company-list-allowance-note').textContent,/10 companies takes at least 42 operations/,'one register check per company is counted');
 await h.click('review');
 const preview=h.find('#company-list-preview').textContent;
 assert.match(preview,/turnover.*evidence/i);assert.match(preview,/industry divisions 24, 25/);
 await h.click('start');
 assert.deepEqual(request.target,{collectSizeEvidence:true,industries:['24','25'],registryOnly:true});
 assert.equal(request.budget,10);
});

test('the default collects evidence without requiring register membership or size thresholds',async t=>{
 let request;const h=setup(t,(_p,body)=>{request=body;return started(body);});
 await h.click('new');assert.equal(h.find('[name="employeesMin"]'),null);assert.equal(h.find('[name="revenueMin"]'),null);
 await h.click('review');await h.click('start');
 assert.deepEqual(request.target,{collectSizeEvidence:true,industries:[],registryOnly:false});
});

test('without the criteria module the form stays as it was',async t=>{
 const h=setup(t,()=>({}),{withCriteria:false});
 await h.click('new');assert.equal(h.find('#company-list-target-fields'),null);
});

test('each kept company shows the register entry and one reason per criterion',async t=>{
 const criteria=M.configuration({profileIds:['core'],signalMode:'off',count:10,markets:['Denmark'],target:{employees:{min:25,max:250},industries:['25']}},options);
 const row=(company,target)=>({company,domain:company.toLowerCase()+'.example',website:'https://'+company.toLowerCase()+'.example/',score:80,fitScore:80,signalBonus:0,matches:[{name:'Core',kind:'profile',strength:80,score:80,url:'https://source.example/',reason:'Fabricator',quote:'Builds steel structures'}],checkedAt:'2026-11-20T12:00:00Z',...(target?{target}:{})});
 const results=[
  row('Registered',{register:{registry:'DK-CVR',id:'11111111',name:'REGISTERED A/S',city:'Give',marketingProtected:true,source:{name:'CVR',url:'https://register.example/11111111',checkedAt:'2026-11-20T12:00:00.000Z'}},checks:[{key:'registry',status:'match',detail:'Registered: REGISTERED A/S (DK-CVR 11111111) Give'},{key:'industry',status:'match',detail:'25.11 Manufacture of metal structures'},{key:'employees',status:'match',detail:'120 employees (within 25–250)'}]}),
  row('Unchecked',{register:null,checks:[{key:'registry',status:'unknown',detail:'The business register could not be checked'},{key:'industry',status:'unknown',detail:'Industry not checked without a register entry'},{key:'employees',status:'unknown',detail:'Employee count not checked without a register entry'}]}),
  row('Legacy')
 ];
 const h=setup(t,()=>({list:{id:'one',name:'Sized',criteria,status:'complete',revision:2,results,receipts:[],progress:{count:3,target:10,checked:3,operations:14,allowance:200}}}));
 await h.w.LeadIntelCompanyListUI.open('one');await tick();
 const block=domain=>h.find('[data-detail="company:'+domain+'"] .cl-target');
 const registered=block('registered.example');
 assert.match(registered.textContent,/Company evidence/);
 assert.deepEqual([...registered.querySelectorAll('li')].map(li=>[li.dataset.targetStatus,li.textContent]),[
  ['match','Confirmed · Business register: Registered: REGISTERED A/S (DK-CVR 11111111) Give'],
  ['match','Confirmed · Industry: 25.11 Manufacture of metal structures'],
  ['match','Confirmed · Employees: 120 employees (within 25–250)']]);
 assert.equal(registered.querySelector('a').href,'https://register.example/11111111');
 assert.match(registered.textContent,/registered marketing protection/i);
 const unchecked=block('unchecked.example');
 assert.ok([...unchecked.querySelectorAll('li')].every(li=>li.dataset.targetStatus==='unknown'&&li.textContent.startsWith('Not confirmed · ')));
 assert.doesNotMatch(unchecked.textContent,/marketing protection/i);assert.equal(unchecked.querySelector('a'),null);
 assert.equal(block('legacy.example'),null);
});

test('AI suggestions respect manual choices and only reviewed divisions reach the search',async t=>{
 let submitted,aiCalls=0;
 const h=setup(t,(_query,body)=>{
  if(body.task){aiCalls++;const prompt=JSON.parse(body.prompt);assert.equal(prompt.context.targeting.idealCustomer,'Manufacturers');
   return {text:JSON.stringify({suggestions:[{code:'25',reason:'Fabrication work.'},{code:'33',reason:'Maintenance work.'},{code:'33',reason:'Duplicate.'},{code:'XX',reason:'Unknown.'}]})};}
  submitted=body;return started(body);
 });
 await h.click('new');h.tick('[name="industry"][value="24"]');await h.click('suggest-industries');
 assert.equal(h.w.document.querySelectorAll('[data-industry-choice]').length,2);
 assert.equal(h.find('#cl-industry-count').textContent,'3 selected');
 h.tick('[data-industry-choice="33"]');assert.equal(h.find('[name="industry"][value="33"]').checked,false);
 await h.click('review');assert.equal(submitted,undefined);await h.click('start');
 assert.deepEqual(submitted.target.industries,['24','25']);assert.equal(aiCalls,1);
});

test('a late suggestion cannot apply after the requested work changes',async t=>{
 let finish,requested;
 const h=setup(t,(_q,body)=>{requested=JSON.parse(body.prompt).context;return new Promise(resolve=>{finish=resolve;});});
 await h.click('new');h.type('industryFocus','Subcontracted welding');
 h.tick('[name="industry"][value="24"]');await h.click('suggest-industries');
 assert.equal(requested.workRequested,'Subcontracted welding');
 h.type('industryFocus','Equipment repair');
 finish({text:JSON.stringify({suggestions:[{code:'25',reason:'Welding work'}]})});await tick();
 assert.equal(h.find('[name="industry"][value="25"]').checked,false);
 assert.equal(h.find('[name="industry"][value="24"]').checked,true);
 assert.match(h.find('#cl-industry-status').textContent,/Targeting changed/);
});

test('the picker caps suggestions at fifteen and leaves manual selection available after an AI failure',async t=>{
 let fail=true;
 const h=setup(t,()=>fail?{error:'Workspace AI unavailable'}:{text:JSON.stringify({suggestions:T.DIVISIONS.slice(0,20).map(d=>({code:d.code,reason:'The selected offer fits this sector.'}))})});
 await h.click('new');await h.click('suggest-industries');assert.match(h.find('#cl-industry-status').textContent,/Workspace AI unavailable/);
 h.tick('[name="industry"][value="96"]');fail=false;await h.click('suggest-industries');
 assert.equal(h.w.document.querySelectorAll('[data-industry-choice]').length,15);
 assert.equal(h.find('#cl-industry-count').textContent,'16 selected');
});
