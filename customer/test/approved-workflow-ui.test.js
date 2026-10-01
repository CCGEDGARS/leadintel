const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(){
  const element=()=>({handlers:{},innerHTML:'',textContent:'',dataset:{},addEventListener(name,fn){this.handlers[name]=fn;},append(){},showModal(){this.open=true;},close(){this.open=false;}});
  const nodes={notice:element(),content:element(),form:element(),refresh:element(),close:element(),final:{checked:true}};
  const actions=['pause','manual','stop','resume','run','activate'].map(action=>({...element(),dataset:{wfAction:action}}));
  const dialog={...element(),querySelector(selector){return {'[data-wf-notice]':nodes.notice,'[data-wf-content]':nodes.content,'[data-wf-form]':nodes.form,'[data-wf-refresh]':nodes.refresh,'[data-wf-close]':nodes.close,'[data-wf-final]':nodes.final}[selector];},querySelectorAll(selector){return selector==='[data-wf-action]'?actions:[];}};
  const document={readyState:'complete',createElement(tag){return tag==='dialog'?dialog:element();},head:element(),body:element(),querySelector(){return element();}};
  const state={role:'owner',revision:1,status:'automatic',approvedAt:'2026-10-01T10:00:00Z',nextRunAt:null,blockers:[],runs:[],stages:['profile','strategy','companies','buyers','triggers','messages','crm','delivery'].map(stage=>({stage,approved:true})),context:{profile:{companyName:'<script>unsafe</script>',priorityOffers:'CRM',targetMarkets:'Portugal'},signals:[]},config:{companies:{limit:3,queries:4},buyers:{roles:['CEO'],enrich:false},triggers:{minimumScore:70,maxEvidenceAgeDays:90},messages:{subject:'Hello',body:'Reviewed template',followup:''},delivery:{dailyLimit:5,frequency:'daily',timezone:'UTC',sendWindowStart:'09:00',sendWindowEnd:'17:00'}}};
  const calls=[];let finishRun;
  const fetch=async(url,options)=>{const body=options.body?JSON.parse(options.body):null;calls.push(body?.action||'read');if(body?.action==='run')return new Promise(resolve=>{finishRun=()=>resolve({ok:true,json:async()=>({...state,status:'paused'})});});return {ok:true,json:async()=>({...state,status:body?.action==='pause'?'paused':state.status})};};
  const window={document,LeadIntelServerBridge:{workspace:{id:'w1'},session:{authenticated:true}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../approved-workflow-ui.js'),'utf8'),{window,document,fetch,setInterval:()=>1,clearInterval(){},FormData:class{},console});
  return {window,nodes,actions,calls,finish:()=>finishRun()};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('workflow review escapes source data and does not overwrite unsaved form edits',async()=>{const f=fixture();f.window.LeadIntelApprovedWorkflow.open();await tick();assert.match(f.nodes.content.innerHTML,/&lt;script&gt;unsafe/);assert.doesNotMatch(f.nodes.content.innerHTML,/<script>unsafe/);assert.match(f.nodes.content.innerHTML,/Take over manually/);f.nodes.form.handlers.input();await f.window.LeadIntelApprovedWorkflow.refresh();assert.deepEqual(f.calls,['read']);});
test('pause remains actionable while Run now waits for a server response',async()=>{const f=fixture();f.window.LeadIntelApprovedWorkflow.open();await tick();f.actions.find(b=>b.dataset.wfAction==='run').handlers.click();await tick();f.actions.find(b=>b.dataset.wfAction==='pause').handlers.click();await tick();assert.deepEqual(f.calls,['read','run','pause']);assert.match(f.nodes.content.innerHTML,/Paused/);f.finish();await tick();assert.match(f.nodes.content.innerHTML,/Paused/);});
