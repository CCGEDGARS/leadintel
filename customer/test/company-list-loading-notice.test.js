const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

// Measured live on 23 Nov 2026: "Open saved lists" answered after about 4 seconds and "Build company list" showed its
// form after about 6, and in between the panel showed nothing, so a working button looked dead.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const options=M.options({targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},market:{icps:[{id:'core',type:'core',active:true}],signals:[]}});
function setup(t){
 const w=new JSDOM('<main id="step-5"><section class="discovery-panel"><div id="company-search-context"></div></section></main>',{runScripts:'outside-only',url:'https://app.example/'}).window;
 t.after(()=>w.close());
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;w.MutationObserver=class{observe(){}};w.setTimeout=()=>1;w.clearTimeout=()=>{};
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 const waiting=[];
 w.fetch=(url)=>new Promise(resolve=>waiting.push({url:String(url),answer:body=>resolve({ok:!body.error,json:async()=>body})}));
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const $=id=>w.document.getElementById(id);
 return {w,waiting,notice:()=>$('company-list-notice').textContent,content:()=>$('company-list-content').textContent,press:command=>w.document.querySelector('[data-cl="'+command+'"]').click()};
}
const settle=async()=>{for(let i=0;i<6;i++)await tick();};

test('Open saved lists says it is loading until the lists arrive, then shows them and clears the line',async t=>{
 const page=setup(t);await settle();
 while(page.waiting.length)page.waiting.shift().answer({lists:[]});await settle();
 page.press('lists');await settle();
 assert.equal(page.w.document.getElementById('cl-history-lists').textContent,'Loading saved lists…');
 assert.equal(page.w.document.getElementById('cl-history-lists').getAttribute('aria-busy'),'true');
 page.waiting.shift().answer({lists:[{id:'one',name:'Denmark steel',status:'complete',progress:{count:3,target:10}}]});await settle();
 assert.equal(page.notice(),'');
 assert.match(page.w.document.getElementById('cl-history-lists').textContent,/Denmark steel/);
});

test('Build company list says it is loading the criteria until the form is there',async t=>{
 const page=setup(t);await settle();
 while(page.waiting.length)page.waiting.shift().answer({lists:[]});await settle();
 page.press('new');await settle();
 assert.equal(page.notice(),'Loading the list criteria…');
 assert.equal(page.w.document.getElementById('company-list-form'),null);
 while(page.waiting.length)page.waiting.shift().answer({options});await settle();
 assert.ok(page.w.document.getElementById('company-list-form'),'the form is shown');
 assert.equal(page.notice(),'');
});

test('a failed request replaces the loading line with the error and keeps it',async t=>{
 const page=setup(t);await settle();
 while(page.waiting.length)page.waiting.shift().answer({lists:[]});await settle();
 page.press('lists');await settle();
 page.waiting.shift().answer({error:'Company lists are temporarily unavailable.'});await settle();
 assert.equal(page.w.document.getElementById('cl-history-lists').textContent,'Company lists are temporarily unavailable.');
});
