const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../lookalike-discovery.js'),'utf8');

function fixture({current=4,saved=4,navigation=true}={}){
 const w=new JSDOM('<button data-process-step="4">Companies</button><button data-step-marker="4">Strategy</button>',{url:'https://leadintel.test/customer/',runScripts:'outside-only'}).window;
 const timers=[],opened=[];let active=current;
 w.setTimeout=fn=>{timers.push(fn);return timers.length;};
 w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({step:saved}));
 w.document.querySelector('[data-process-step]').onclick=()=>{opened.push(5);active=5;};
 w.document.querySelector('[data-step-marker]').onclick=()=>{opened.push(4);active=4;};
 if(navigation)w.LeadIntelCustomerNavigation={currentStep:()=>active,setStep:step=>{opened.push(step);active=step;return true;}};
 w.eval(source);
 return {w,opened,step:()=>active,move:step=>{active=step;},flush(){while(timers.length)timers.shift()();},close(){w.close();}};
}

test('a delayed reference refresh keeps Strategy open instead of clicking the Companies process stage',()=>{
 const f=fixture();try{f.flush();assert.equal(f.step(),4);assert.deepEqual(f.opened,[4]);
  f.w.dispatchEvent(new f.w.CustomEvent('leadintel:reference-customers-updated'));f.flush();
  assert.equal(f.step(),4);assert.deepEqual(f.opened,[4,4]);
 }finally{f.close();}
});

test('reference refresh respects a newer visible module even when the saved step is still Strategy',()=>{
 for(const step of [2,3,5,6,7]){const f=fixture();try{f.move(step);f.flush();assert.equal(f.step(),step);assert.deepEqual(f.opened,[]);}finally{f.close();}}
});

test('legacy Strategy refresh uses its module marker rather than the distinct Companies process marker',()=>{
 const f=fixture({navigation:false});try{f.flush();assert.equal(f.step(),4);assert.deepEqual(f.opened,[4]);}finally{f.close();}
});
