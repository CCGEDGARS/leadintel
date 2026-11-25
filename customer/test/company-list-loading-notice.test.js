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

test('review and edit are local and only the explicit start sends research',async t=>{
 const p=setup(t);await settle();
 p.press('new');await settle();p.waiting.shift().answer({options});await settle();
 const form=p.w.document.querySelector('#company-list-form');
 p.press('review');await settle();
 assert.equal(form.querySelector('#cl-edit-fields').hidden,true);
 assert.equal(form.querySelector('[data-cl="start"]').textContent,'Start research for 10 companies');
 p.press('edit');await settle();
 assert.equal(form.querySelector('#cl-edit-fields').hidden,false);
 form.elements.preset.value='5';
 form.elements.preset.dispatchEvent(new p.w.Event('change',{bubbles:true}));
 p.press('review');await settle();
 assert.equal(form.querySelector('[data-cl="start"]').textContent,'Start research for 5 companies');
 assert.equal(p.waiting.length,0);
 p.press('start');p.press('start');await settle();
 assert.equal(p.waiting.length,1);
});

test('history opens on CRM lists and keeps drafts and archived searches folded',async t=>{
 const page=setup(t);await settle();page.press('lists');await settle();
 const base={progress:{count:0,target:10},name:'My company list',updatedAt:'2026-11-25 09:00:00'};
 page.waiting.shift().answer({lists:[
  {...base,id:'a',saved:true,progress:{count:7,target:10}},
  {...base,id:'b',status:'incomplete'},
  {...base,id:'c',kind:'search_snapshot',name:'Company search'}
 ]});await settle();
 const groups=[...page.w.document.querySelectorAll('.cl-history-group')];
 assert.deepEqual(groups.map(g=>g.firstElementChild.textContent),['Saved lists (1)','Drafts (1)','Saved search copies (1)']);
 assert.equal(groups[1].open,false);assert.equal(groups[2].open,false);
 assert.match(groups[1].textContent,/Untitled draft/);
 assert.match(groups[0].textContent,/7 companies/);
});

test('library deletes the selected same-name draft by id only after confirmation',async t=>{
 const p=setup(t);await settle();p.press('lists');await settle();
 const draft={name:'My company list',status:'incomplete',criteria:{},revision:7,progress:{count:0,target:10}};
 const lists=['a','b'].map(id=>({...draft,id}));
 p.waiting.shift().answer({lists});await settle();
 const buttons=[...p.w.document.querySelectorAll('.cl-library-row')];
 assert.equal(buttons.length,2);
 assert.deepEqual([...buttons[1].querySelectorAll('[data-cl]')].map(b=>b.dataset.cl),['open','row-resume','row-delete']);
 const writes=[];
 p.w.fetch=async(url,opts)=>{
  const id=new URL(url).searchParams.get('id');
  if(opts.body)writes.push(JSON.parse(opts.body));
  return {ok:true,json:async()=>id?{list:lists.find(l=>l.id===id)}:{lists}};
 };
 const remove=buttons[1].querySelector('[data-cl="row-delete"]');
 p.w.LeadIntelDialogs={confirm:async()=>false};remove.click();await settle();
 assert.equal(writes.length,0);
 p.w.LeadIntelDialogs.confirm=async()=>true;remove.click();await settle();
 assert.deepEqual(writes,[{action:'delete',id:'b',revision:7}]);
 assert.equal(p.w.document.querySelector('#prior-company-search').open,true);
});
