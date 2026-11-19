const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../step-action-guidance.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('live next-action guidance replaces duplicate introductory copy, with a fallback if the guide is unavailable',async()=>{
 const w=new JSDOM('<main class="content"><section id="journey-stage-guide" data-module-step="5"><h2 data-stage-guide-title>Buyers</h2></section><section class="step-view active" id="step-5" data-step="5"><span id="discovery-stage-kicker">Buyers</span></section></main>',{runScripts:'outside-only'}).window;
 try{w.eval(source);await tick();const banner=w.document.querySelector('.step-action-guidance');assert.equal(banner.hidden,true);
  w.document.querySelector('#journey-stage-guide').remove();await tick();assert.equal(banner.hidden,false);assert.match(banner.textContent,/Find decision makers/);
 }finally{w.close();}
});
for(const status of ['complete','partial','saved'])test(`Profile research shortcuts remain available with ${status} evidence alongside the journey guide`,async()=>{
 const w=new JSDOM('<main class="content"><section id="journey-stage-guide" data-module-step="2"><h2 data-stage-guide-title>Profile</h2></section><section class="step-view active" id="step-2" data-step="2"><div class="hero-copy"></div><div id="research-summary" data-research-state="complete"></div></section></main>',{runScripts:'outside-only'}).window;
 try{w.document.getElementById('research-summary').dataset.researchState=status;w.eval(source);await tick();const banner=w.document.querySelector('.step-action-guidance');assert.equal(banner.hidden,false);assert.equal(banner.querySelectorAll('button').length,3);assert.ok(banner.querySelector('[data-open-profile-market]'));assert.equal(w.document.getElementById('research-summary').dataset.researchState,status);}finally{w.close();}
});
