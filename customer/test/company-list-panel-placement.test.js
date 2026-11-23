const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const M=require('../company-lists.js');

// On the Companies step the panel "Company lists" (lists built from profiles, target criteria and the business
// register) was inserted near the bottom of the older "Company search" card, more than one screen below its
// "Refresh company results" button and the saved companies. In the recording of 21 Nov 2026 the user worked on
// the old search and never reached the panel. It is now the first block of that card, above the old search.
function mount(t,body){
 const w=new JSDOM(body,{runScripts:'outside-only',url:'https://app.example/'}).window;
 t.after(()=>w.close());
 w.LeadIntelCompanyLists=M;w.AbortSignal=AbortSignal;w.MutationObserver=class{observe(){}};
 w.setTimeout=()=>1;w.clearTimeout=()=>{};
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user'}},workspace:{id:'workspace',role:'owner'}};
 w.fetch=async()=>({ok:true,json:async()=>({lists:[]})});
 w.eval(fs.readFileSync(path.join(__dirname,'../company-lists-ui.js'),'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return w.document;
}
const step='<main id="step-5"><div class="discovery-header">Step 4 · Companies</div><div class="discovery-banner">Ercon · Denmark</div>'
 +'<section class="panel strategy-panel discovery-panel"><div class="market-research-head">Company search</div><div class="company-candidates">Saved companies</div>'
 +'<section id="discovery-target-list">Known targets</section><div id="company-search-context"></div><details id="event-discovery-panel">Add event context</details><div class="company-next-action">Continue to Buyers</div></section></main>';

test('Company lists is the first block of the company search card, above the older search',t=>{
 const document=mount(t,step),panel=document.getElementById('company-list-panel'),search=document.querySelector('.discovery-panel');
 assert.ok(panel,'the panel is mounted');
 assert.equal(search.firstElementChild,panel,'the panel is the first block of the card');
 assert.deepEqual([...search.children].map(node=>node.id||node.className),['company-list-panel','market-research-head','company-candidates','discovery-target-list','company-search-context','event-discovery-panel','company-next-action'],'the older search follows, in its old order');
 assert.equal(document.querySelectorAll('#company-list-panel').length,1);
 assert.equal(panel.querySelector('[data-cl="new"]').textContent,'Build company list');
});

test('the panel stays inside the search card, which the page hides on the Buyers stage of the same section',t=>{
 const document=mount(t,step),panel=document.getElementById('company-list-panel'),search=document.querySelector('.discovery-panel');
 assert.equal(panel.parentElement,search);
 assert.deepEqual([...document.getElementById('step-5').children].map(node=>node.className),['discovery-header','discovery-banner','panel strategy-panel discovery-panel'],'nothing is added to the section next to the card');
 search.hidden=true;
 assert.equal(panel.closest('[hidden]'),search,'hidden together with the card');
});

test('without the Company search card the panel still mounts next to its context',t=>{
 const document=mount(t,'<main id="step-5"><div id="company-search-context"></div><details id="event-discovery-panel"></details></main>'),panel=document.getElementById('company-list-panel');
 assert.ok(panel);
 assert.equal(panel.nextElementSibling.id,'event-discovery-panel');
});

// Found live on 23 Nov 2026: after one visit to Buyers the panel was gone from the Companies stage until the page
// was reloaded. A listener hid the panel itself on the Buyers stage, and going back by the sidebar announced nothing
// that would show it again. Inside the search card the panel needs no hiding of its own: the page hides the card.
test('a visit to Buyers does not hide the panel inside the search card; going back needs no announcement',t=>{
 const document=mount(t,step),window=document.defaultView,panel=document.getElementById('company-list-panel');
 window.dispatchEvent(new window.CustomEvent('leadintel:journey-focus-changed',{detail:{focus:'buyers'}}));
 assert.equal(panel.hidden,false,'the panel leaves the hiding to its card');
 panel.hidden=true;   // a panel hidden by an earlier release of the page
 window.dispatchEvent(new window.CustomEvent('leadintel:journey-focus-changed',{detail:{focus:'buyers'}}));
 assert.equal(panel.hidden,false);
});

test('a panel mounted outside a search card is still hidden on Buyers and shown again on Companies',t=>{
 const document=mount(t,'<main id="step-5"><div id="company-search-context"></div><details id="event-discovery-panel"></details></main>'),window=document.defaultView,panel=document.getElementById('company-list-panel');
 window.dispatchEvent(new window.CustomEvent('leadintel:journey-focus-changed',{detail:{focus:'buyers'}}));
 assert.equal(panel.hidden,true);
 window.dispatchEvent(new window.CustomEvent('leadintel:journey-focus-changed',{detail:{focus:'companies'}}));
 assert.equal(panel.hidden,false);
});
