const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

// Call with a customer, 24 Nov 2026: "put five, so that it does not spend money" — and the smallest size the form
// offered was ten; five existed only behind "Custom". A first list is a trial, and every company costs reasoning calls
// on the customer's own key. The form now offers five. It still opens on ten.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const options=M.options({targetMarkets:['Denmark'],answers:{ideal_customer:'Manufacturers'},market:{icps:[{id:'core',type:'core',active:true}],signals:[]}});
function open(t,respond=()=>({})){
 const w=new JSDOM('<main id="step-5"><section class="discovery-panel"><div id="company-search-context"></div></section></main>',{runScripts:'outside-only',url:'https://app.example/'}).window;
 t.after(()=>w.close());
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;w.MutationObserver=class{observe(){}};
 w.setTimeout=()=>1;w.clearTimeout=()=>{};
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 w.fetch=async(url,request)=>{const params=new URL(url).searchParams,body=request.body&&JSON.parse(request.body);const result=params.has('options')?{options}:await respond(params,body);return {ok:!result.error,status:200,json:async()=>result};};
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const find=selector=>w.document.querySelector(selector);
 return {find,async click(command){find('[data-cl="'+command+'"]').click();await tick();await tick();},
  change(name,value){const el=find('[name="'+name+'"]');el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));}};
}

test('the list form offers five companies and still opens on ten',async t=>{
 const h=open(t);await h.click('new');
 const sizes=h.find('[name="preset"]');
 assert.deepEqual([...sizes.options].map(option=>option.value),['5','10','20','50','100','200','custom']);
 assert.equal(sizes.value,'10');
 assert.equal(h.find('[name="count"]').hidden,true);
 assert.equal(h.find('[name="budget"]').value,'','the operation limit is optional');
});

test('choosing five requests five verified companies without an operation limit by default',async t=>{
 let sent;
 const h=open(t,(_params,body)=>{sent=body;return {error:'Strategy changed. Reopen Build company list.'};});
 await h.click('new');
 h.change('preset','5');
 assert.equal(h.find('[name="count"]').hidden,true,'five is a listed size, not the custom field');
 assert.equal(h.find('[name="budget"]').value,'');
 assert.equal(h.find('#company-list-allowance-note').hidden,true,'an unlimited run has no operation warning');
 await h.click('review');
 assert.match(h.find('#company-list-preview').textContent,/My company list · 5 companies/);
 await h.click('start');
 assert.equal(sent.count,5);assert.equal(sent.budget,undefined);
});

test('an allowance the user typed is kept when the size changes to five',async t=>{
 const h=open(t);await h.click('new');
 h.change('budget','400');h.change('preset','5');
 assert.equal(h.find('[name="budget"]').value,'400');
});
