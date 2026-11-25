const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

// Live, 24 Nov 2026: a customer's list stopped on the spending limit of their Anthropic account and the panel said
// "A research service is temporarily unavailable". Nobody in the call could tell which service, or why. The server now
// keeps which provider refused and how; the panel says it: the provider by name, what happened, what to do.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{for(let i=0;i<6;i++)await tick();};
const options=M.options({targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},market:{icps:[{id:'core',type:'core',active:true}],signals:[]}});
const criteria=M.configuration({profileIds:['core'],signalMode:'off',count:10,markets:['Denmark']},options);
const SERVER='A research service is temporarily unavailable. Completed work is retained. Automatic retries stopped after three attempts. Check connections and resume.';
const list=(change={})=>({id:'one',name:'Steel',criteria,status:'incomplete',revision:1,results:[],receipts:[],createdAt:'2026-11-25 07:18:18',updatedAt:'2026-11-25 07:20:00',failureCode:'provider_temporary',failureCause:null,...change,
 progress:{count:0,target:10,checked:78,operations:255,allowance:400,reason:SERVER,phase:'retrying',nextAttemptAt:0,...change.progress}});
async function shown(t,item){
 const w=new JSDOM('<main id="step-5"><section class="discovery-panel"><div id="company-search-context"></div></section></main>',{runScripts:'outside-only',url:'https://app.example/'}).window;
 t.after(()=>w.close());
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;w.MutationObserver=class{observe(){}};
 w.setTimeout=()=>1;w.clearTimeout=()=>{};w.setInterval=()=>7;w.clearInterval=()=>{};
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 w.fetch=async url=>{const params=new URL(url).searchParams,answer=params.has('options')?{options}:params.get('id')?{list:item}:{lists:[item]};return {ok:true,status:200,json:async()=>answer};};
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
 w.document.querySelector('[data-cl="lists"]').click();await settle();
 w.document.querySelector('[data-cl="open"]').click();await settle();
 const message=w.document.querySelector('#company-list-content [role="status"]');
 return {text:message.textContent,blocker:message.classList.contains('cl-blocker'),button:w.document.querySelector('[data-cl="resume"]')?.textContent||''};
}

test('a stopped list names the provider, says what happened and what to do',async t=>{
 for(const [name,failureCause,sentence] of [
  ['spending limit',{provider:'Anthropic',kind:'spending_limit',status:400,code:'billing_hard_limit_reached'},"Anthropic stopped: your account's spending limit is reached. Raise it in the Anthropic console, then resume. Your results are kept."],
  ['no credit',{provider:'OpenAI',kind:'credits',status:429,code:'insufficient_quota'},'OpenAI has no credit left on your key. Add credit in the OpenAI console, then resume. Your results are kept.'],
  ['search credits',{provider:'Firecrawl',kind:'credits',status:402},'Firecrawl has no credit left on your key. Add credit in the Firecrawl console, then resume. Your results are kept.'],
  ['key rejected',{provider:'OpenAI',kind:'key',status:401,code:'invalid_api_key'},'OpenAI rejected the API key (error 401 · invalid_api_key). Check the key in Settings, then resume. Your results are kept.'],
  ['rate limit',{provider:'OpenAI',kind:'rate_limit',status:429},'OpenAI is limiting how fast requests may be sent. Wait a minute, then resume. Your results are kept.'],
  ['no answer',{provider:'Anthropic',kind:'unavailable',status:529,code:'overloaded_error'},"Anthropic did not answer (error 529 · overloaded_error). This is on Anthropic's side. Try again in a few minutes. Your results are kept."],
  ['no answer, no status',{provider:'Gemini',kind:'unavailable'},"Gemini did not answer. This is on Gemini's side. Try again in a few minutes. Your results are kept."],
  ['refused request',{provider:'Anthropic',kind:'refused',status:400,code:'invalid_request_error'},'Anthropic refused the request (error 400 · invalid_request_error). Your results are kept. Send this line to LeadIntel support.']]){
  await t.test(name,async t=>{
   const h=await shown(t,list({failureCause}));
   assert.equal(h.text,sentence);assert.equal(h.blocker,true,'it is shown as a stop');
   assert.equal(h.button,'Resume within remaining allowance');
  });
 }
});

test('while the list retries by itself the sentence says so',async t=>{
 const waiting=await shown(t,list({status:'queued',failureCause:{provider:'Anthropic',kind:'unavailable',status:529},progress:{reason:'A research service is temporarily unavailable. Completed work is retained. Retrying automatically (1/2); no extra allowance is granted.'}}));
 assert.equal(waiting.text,'Anthropic did not answer (error 529). The search retries by itself.');
 const limited=await shown(t,list({status:'queued',failureCause:{provider:'OpenAI',kind:'rate_limit',status:429}}));
 assert.equal(limited.text,'OpenAI is limiting how fast requests may be sent. The search continues by itself.');
});

test('without a named provider the server\'s own sentence stays',async t=>{
 assert.equal((await shown(t,list())).text,SERVER);
 assert.equal((await shown(t,list({failureCause:{provider:'',kind:'unavailable'}}))).text,SERVER);
 assert.equal((await shown(t,list({failureCause:{provider:'Anthropic',kind:'something new'}}))).text,SERVER);
});

test('a provider name is shown as text, never as markup',async t=>{
 const h=await shown(t,list({failureCause:{provider:'<img src=x>',kind:'credits',code:'<b>'}}));
 assert.match(h.text,/^<img src=x> has no credit left/);
});
