const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');

// Typing in a Profile answer must stay cheap: each key records the text, and the derived work
// (review status, downstream invalidation, save, context event) runs once after typing pauses
// or as soon as anything else needs the answers.
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const body=source.slice(source.indexOf('function readAnswers('),source.indexOf('\nfunction validateStep1()',source.indexOf('function readAnswers(')));

function runtime(){
  const inputs=[{dataset:{question:'ideal_customer'},value:'Hotels'},{dataset:{question:'priority_offers'},value:'Furniture'}];
  const stored=new Map([['leadintel_customer_v2_outreach',JSON.stringify({items:[{id:'draft',approved:true}]})],['leadintel_customer_v2_discovery',JSON.stringify({})]]);
  const timers=new Map(),events=[],applied=[],redraws=[];let nextTimer=1,saves=0;
  const context={
    state:{answers:{ideal_customer:'Hotels',priority_offers:'Furniture'},answerStatus:{}},targetingSaveError:'',
    document:{querySelectorAll:()=>inputs},
    localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,String(value))},
    LeadIntelStep2Brief:{applyAnswers:(state,changed)=>{applied.push([...changed]);return state;}},
    saveState:()=>{saves++;return true;},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
    window:{dispatchEvent:event=>{events.push(event);return true;},LeadIntelStep2Readiness:{renderReadiness:root=>{redraws.push(root);}}},
    setTimeout:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id;},clearTimeout:id=>{timers.delete(id);},
  };
  vm.createContext(context);vm.runInContext(body,context);
  const type=(index,value)=>{inputs[index].value=value;return context.readAnswers({type:'input',target:inputs[index]});};
  const pause=()=>{const due=[...timers.entries()];timers.clear();for(const [,timer] of due)timer.fn();};
  return {context,inputs,stored,timers,events,applied,redraws,type,pause,saves:()=>saves};
}

test('each key records the answer at once and leaves the derived work for the pause',()=>{
  const r=runtime();
  r.type(0,'Hotels a');r.type(0,'Hotels an');r.type(0,'Hotels and offices');
  assert.equal(r.context.state.answers.ideal_customer,'Hotels and offices');
  assert.equal(r.saves(),0,'no save per key');
  assert.equal(r.events.length,0,'no downstream refresh per key');
  assert.equal(r.applied.length,0);
  assert.equal(JSON.parse(r.stored.get('leadintel_customer_v2_outreach')).items[0].approved,true,'drafts untouched until the pause');
  assert.equal(r.timers.size,1,'one pending commit, restarted by every key');
  assert.ok([...r.timers.values()][0].ms>=300&&[...r.timers.values()][0].ms<=1000,'the commit waits for a short typing pause');
});

test('the pause commits once: review status, invalidation, one save and one context event',()=>{
  const r=runtime();
  r.type(0,'Hotels a');r.type(0,'Hotels and offices');r.pause();
  assert.deepEqual(r.applied,[['ideal_customer']]);
  assert.equal(r.context.state.answerStatus.ideal_customer,'accepted');
  assert.equal(r.saves(),1);
  assert.equal(r.events.length,1);
  assert.equal(r.events[0].type,'leadintel:commercial-context-changed');
  assert.deepEqual([...r.events[0].detail.fields],['ideal_customer']);
  const draft=JSON.parse(r.stored.get('leadintel_customer_v2_outreach')).items[0];
  assert.equal(draft.approved,false);assert.equal(draft.reapprovalRequired,true);
  assert.equal(JSON.parse(r.stored.get('leadintel_customer_v2_discovery')).needsRefresh,true);
  assert.equal(r.timers.size,0);
  r.pause();assert.equal(r.saves(),1,'nothing is committed twice');
});

test('leaving the field commits immediately and cancels the pending pause',()=>{
  const r=runtime();
  r.type(0,'Hotels and offices');
  assert.equal(r.context.commitPendingAnswers(),true);
  assert.equal(r.saves(),1);assert.equal(r.events.length,1);assert.equal(r.timers.size,0);
  assert.equal(r.context.commitPendingAnswers(),true);
  assert.equal(r.saves(),1,'no work when nothing is pending');
});

test('any other read of the answers first absorbs the pending edit',()=>{
  const r=runtime();
  r.type(0,'Hotels and offices');r.inputs[1].value='Commercial furniture';
  assert.equal(r.context.readAnswers({fields:['priority_offers']}),true);
  assert.deepEqual(r.applied.map(ids=>[...ids].sort()),[['ideal_customer','priority_offers']]);
  assert.equal(r.context.state.answerStatus.ideal_customer,'accepted');
  assert.equal(r.context.state.answerStatus.priority_offers,'accepted');
  assert.equal(r.saves(),1);assert.equal(r.events.length,1);assert.equal(r.timers.size,0);
});

test('a key that does not change the answer still saves once after the pause, without a context event',()=>{
  const r=runtime();
  r.type(0,'Hotels ');
  assert.equal(r.saves(),0);r.pause();
  assert.equal(r.saves(),1);assert.equal(r.events.length,0);assert.equal(r.applied.length,0);
});

test('the Profile readiness panel is redrawn after typed text is committed, since it was last drawn before the save',()=>{
  const r=runtime();
  r.type(0,'Hotels and offices');assert.equal(r.redraws.length,0,'the key itself does not redraw from here');
  r.pause();assert.equal(r.redraws.length,1);assert.equal(r.redraws[0],r.context.window);
  r.type(0,'Hotels and offices ');r.pause();assert.equal(r.redraws.length,2,'also when the key changed nothing: the save rewrote the panel');
  r.type(0,'Hotels');r.context.readAnswers({fields:['priority_offers']});assert.equal(r.redraws.length,3,'also when another read absorbs the edit');
  r.context.readAnswers({fields:['priority_offers']});r.context.readAnswers();assert.equal(r.redraws.length,3,'reads without typed text behave as before');
});

test('typed answers are committed when the field is left and before the page goes away',()=>{
  const binding=source.slice(source.indexOf('document.querySelectorAll("[data-question]").forEach(el=>{el.addEventListener("input",readAnswers)'));
  assert.ok(binding.startsWith('document.querySelectorAll'),'answer fields bind the typing handler');
  const line=binding.slice(0,binding.indexOf('\n'));
  assert.match(line,/addEventListener\("change",commitPendingAnswers\)/);
  assert.match(line,/addEventListener\("blur",commitPendingAnswers\)/);
  assert.match(line,/window\.addEventListener\("pagehide",commitPendingAnswers\)/);
});
