const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8'),MAIN='leadintel_customer_v2_state',META='leadintel_customer_v2_research_meta_v1';
async function harness(){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));const dom=new JSDOM(read('index.html'),{url:'https://app.example/customer/',runScripts:'outside-only',virtualConsole:vc}),w=dom.window;
 await new Promise(resolve=>w.document.readyState==='complete'?resolve():w.addEventListener('load',resolve,{once:true}));
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.AbortController=AbortController;
 for(const name of ['step2-brief-schema.js','commercial-profile-adviser.js','company-brain.js','message-evidence.js','company-research-engine.js'])w.eval(read(name));
 const sources=[{id:'S1',type:'website',role:'primary',url:'https://seller.example/',title:'Seller',text:'Seller provides drawing development, custom metal manufacturing, steel fabrication and on-site installation. Published quality standards include ISO 9001:2015.'}];
 const state={step:2,website:'https://seller.example/',targetMarkets:['Sweden'],answers:{priority_offers:'a full-spectrum service — from drawing development to on-site installation',ideal_customer:'Manufacturers in Sweden',buyer_roles:'CEO/Owner; Sales/Commercial Leadership; HR/L&D; Team Leadership',exclusions:'lovest price',buying_outcomes:'Sales and business processes can remain fragmented'},answerStatus:{priority_offers:'accepted',ideal_customer:'accepted',buyer_roles:'accepted',exclusions:'user',buying_outcomes:'draft'},scrapedSources:sources,documents:[],approved:false,market:{customData:'keep this'}};
 const fields={};for(const [id,value] of Object.entries(state.answers))fields[id]={origin:state.answerStatus[id]==='user'?'user':'evidence_draft',reviewed:['user','accepted'].includes(state.answerStatus[id]),draftValue:value,sourceIds:['S1']};
 w.localStorage.setItem(MAIN,JSON.stringify(state));w.localStorage.setItem(META,JSON.stringify({website:state.website,generatedAt:'2026-11-01',contentLanguage:'en',mode:'evidence',sourceCount:1,fields,quality:{coverage:{categories:['company','offers'],total:5}}}));
 w.localStorage.setItem('leadintel_account_context_v1','owner-a');w.LeadIntelAccountCache={current:()=>true};w.LeadIntelServerBridge={ready:true,workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}},saveNow:async()=>{saves++;return {saved:true};}};let saves=0;
 const hydrate=()=>{const current=JSON.parse(w.localStorage.getItem(MAIN));for(const el of w.document.querySelectorAll('[data-question]'))el.value=current.answers[el.dataset.question]||'';};hydrate();w.addEventListener('leadintel:company-research-updated',hydrate);
 w.fetch=async()=>{throw Error('Unexpected network request');};
 w.eval(read('company-research-ui.js').replace(/^import .*;\s*$/gm,''));
 return {w,errors,state:()=>JSON.parse(w.localStorage.getItem(MAIN)),meta:()=>JSON.parse(w.localStorage.getItem(META)),saves:()=>saves,close:()=>w.close()};
}
test('twelve-answer review fills useful drafts but preserves accepted answers and explicit edits',async()=>{
 const h=await harness();try{
 const api=h.w.LeadIntelProfileAdvice;assert.ok(h.w.document.getElementById('review-profile-advice'));assert.equal(api.review(),true);
 assert.equal(h.w.document.querySelectorAll('.profile-advice-card').length,12);assert.match(h.w.document.getElementById('profile-advice-review').textContent,/Generic professional-services roles/);
 const original=h.state();assert.equal(await api.apply(),true);const current=h.state();
 for(const id of ['priority_offers','ideal_customer','buyer_roles','exclusions'])assert.equal(current.answers[id],original.answers[id],id);
 for(const id of ['buying_outcomes','buying_triggers','value_proposition','delivery_approach','meeting_value','objections']){assert.ok(current.answers[id],id);assert.equal(current.answerStatus[id],'draft');}
 assert.equal(current.market.customData,'keep this');assert.equal(current.market.strategyApproved,false);assert.equal(current.approved,false);
 assert.equal(await api.apply(['buyer_roles']),true);assert.match(h.state().answers.buyer_roles,/Engineering Director/);assert.equal(h.state().answerStatus.buyer_roles,'draft');assert.match(h.w.document.querySelector('[data-question="buyer_roles"]').value,/Engineering Director/);
 assert.equal(await api.undo(),true);assert.equal(h.state().answers.buyer_roles,original.answers.buyer_roles);assert.equal(h.state().answerStatus.buyer_roles,'accepted');assert.ok(h.saves());assert.deepEqual(h.errors,[]);
 }finally{h.close();}
});
test('newer manual edits survive Undo and workspace changes reject old suggestions',async()=>{
 const h=await harness();try{const api=h.w.LeadIntelProfileAdvice;api.review();await api.apply(['buyer_roles']);const state=h.state();state.answers.buyer_roles='My newer manual decision';h.w.localStorage.setItem(MAIN,JSON.stringify(state));assert.equal(await api.undo(),false);assert.equal(h.state().answers.buyer_roles,'My newer manual decision');
 api.review();h.w.LeadIntelServerBridge.workspace.id='w2';const before=h.w.localStorage.getItem(MAIN);assert.equal(await api.apply(['value_proposition']),false);assert.equal(h.w.localStorage.getItem(MAIN),before);
 }finally{h.close();}
});
test('AI refinement is advisory, uses company evidence and cannot publish a late result into changed context',async()=>{
 const h=await harness();try{const api=h.w.LeadIntelProfileAdvice;api.review();let finish;h.w.fetch=async(url,options)=>{assert.match(url,/\/api\/ai\/generate/);const payload=JSON.parse(options.body);assert.match(payload.prompt,/drawing development/);assert.match(payload.prompt,/all twelve answers/i);return new Promise(resolve=>{finish=resolve;});};const before=h.w.localStorage.getItem(MAIN),pending=api.refine();
 await new Promise(resolve=>setImmediate(resolve));assert.ok(finish);h.w.localStorage.setItem('leadintel_account_context_v1','owner-b');finish({ok:true,json:async()=>({provider:'openai',text:JSON.stringify({fields:{value_proposition:{value:'Late wrong answer',confidence:'medium',draft_type:'hypothesis',source_ids:[]}}})})});await pending;assert.equal(h.w.localStorage.getItem(MAIN),before);assert.doesNotMatch(h.w.document.getElementById('profile-advice-review').textContent,/Late wrong answer/);
 }finally{h.close();}
});
