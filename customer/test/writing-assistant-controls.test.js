const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {createWritingAssistant}=require('../writing-assistant.js');
const {mountWritingAssistant}=require('../writing-assistant-ui.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
 const dom=new JSDOM('<section id="mw-writing-assistant"></section>',{pretendToBeVisual:true}),d=dom.window.document;let ui;
 const controller=createWritingAssistant({workbench:true,sessionStore:null,capture:()=>({scope:'general',fingerprint:'general',referenceRevision:1,sourceRefs:[],skillRefs:[],usable:true,context:{writingContext:'general',channel:'general',currentDraft:{subject:'',message:'My working text'}}}),onChange:()=>ui?.render()});
 controller.syncContext();ui=mountWritingAssistant(d,controller,{writingContext:()=> 'general',...options});ui.open();
 return {d,controller,ui,close(){ui.destroy();controller.destroy();dom.window.close();}};
}
test('failed skill selection is visible beside skills and clears after a successful retry',async()=>{
 let fail=true;const row={id:'skill',title:'Clarity',status:'Ready',enabled:true,selected:false};
 const f=fixture({skills:()=>[row],activateSkill:async()=>{if(fail)throw Error('Skill changed. Choose it again.');row.selected=true;return true;}});
 try{
  f.d.querySelector('[data-wa-skill]').click();await tick();
  const error=f.d.querySelector('.wa-skill-selection [role="alert"]');assert.ok(error,'selection failure must be visible outside collapsed Book knowledge');assert.match(error.textContent,/Skill changed/);
  assert.equal(f.d.querySelector('.wa-mentors').open,false);assert.equal(f.controller.state().working.message,'My working text');
  fail=false;f.d.querySelector('[data-wa-skill]').click();await tick();assert.equal(f.d.querySelector('.wa-skill-selection [role="alert"]'),null);assert.equal(f.d.querySelector('[data-wa-skill]').getAttribute('aria-pressed'),'true');
 }finally{f.close();}
});
test('Cancel prevents a pending script refresh from reopening the closed picker',async()=>{
 let pending,loads=0;const f=fixture({scripts:()=>++loads===1?[{id:'one',name:'Saved draft',message:'Saved text'}]:new Promise(resolve=>pending=resolve)});
 try{
  f.d.querySelector('[data-wa-load]').click();await tick();assert.equal(f.d.querySelector('[data-wa-picker]').hidden,false);
  f.d.querySelector('[data-wa-load]').click();f.d.querySelector('[data-wa-picker-close]').click();
  pending([{id:'late',name:'Late draft',message:'Late text'}]);await tick();
  assert.equal(f.d.querySelector('[data-wa-picker]').hidden,true);assert.equal(f.d.querySelector('[data-wa-load]').getAttribute('aria-expanded'),'false');assert.equal(f.controller.state().working.message,'My working text');
 }finally{f.close();}
});
