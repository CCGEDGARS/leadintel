const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const language=require('../content-language'),B=require('../research-brief');
function ui(){delete require.cache[require.resolve('../company-dossier-ui')];return require('../company-dossier-ui');}
function fixture(text='Bolaget bygger en ny fabrik i Kiruna med 20 anställda.'){
 const storage=new Map(),calls=[];
 const root={LeadIntelContentLanguage:language,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({text:JSON.stringify({fact0:'The company is building a new factory in Kiruna with 20 employees.'})})};}};
 const candidate={domain:'example.com',company:'Example',evidence:[{url:'https://example.com/news',text,sourceRead:true,extractedAt:'2026-11-07T10:00:00Z'}]};return {root,candidate,calls,context:{workspaceId:Math.random().toString(36)}};
}
test('English view uses existing translator and retains original evidence, links and downstream brief unchanged',async()=>{
 const U=ui(),f=fixture(),before=JSON.stringify(B.build(f.candidate));await U.prepareBrief(f.candidate,f.context,{root:f.root});
 const dom=new JSDOM(U.briefHtml(f.candidate,f.context)),doc=dom.window.document;
 assert.match(doc.querySelector('ul').textContent,/The company is building/);assert.match(doc.querySelector('details').textContent,/Bolaget bygger/);assert.equal(doc.querySelector('a').href,'https://example.com/news');assert.match(doc.body.textContent,/translated from the linked sources/);assert.equal(JSON.stringify(B.build(f.candidate)),before);assert.equal(f.calls.length,1);assert.match(f.calls[0].body.system,/English/);dom.window.close();
 const reopened=ui();await reopened.prepareBrief(JSON.parse(JSON.stringify(f.candidate)),f.context,{root:f.root});assert.equal(f.calls.length,1);assert.match(reopened.briefHtml(f.candidate,f.context),/The company is building/);
});
test('failed translation preserves originals and retries only on explicit request',async()=>{
 const U=ui(),f=fixture();let count=0;f.root.fetch=async()=>{count++;throw Error('provider unavailable');};await U.prepareBrief(f.candidate,f.context,{root:f.root});assert.match(U.briefHtml(f.candidate,f.context),/English translation unavailable/);assert.match(U.briefHtml(f.candidate,f.context),/Bolaget bygger/);await U.prepareBrief(f.candidate,f.context,{root:f.root});assert.equal(count,1);await U.prepareBrief(f.candidate,f.context,{root:f.root,retry:true});assert.equal(count,2);
});
test('altered quantities cannot enter the English view',async()=>{
 const U=ui(),f=fixture();f.root.fetch=async()=>({ok:true,json:async()=>({text:JSON.stringify({fact0:'The company is building a factory with 200 employees.'})})});await U.prepareBrief(f.candidate,f.context,{root:f.root});assert.doesNotMatch(U.briefHtml(f.candidate,f.context),/200 employees/);assert.match(U.briefHtml(f.candidate,f.context),/translation unavailable/);
});
test('rerender joins one translation while a departed company receives no late update',async()=>{
 const U=ui(),f=fixture();let release,oldCurrent=true,oldUpdates=0,newUpdates=0,count=0;f.root.fetch=async()=>{count++;return await new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({text:JSON.stringify({fact0:'The company is building a new factory in Kiruna with 20 employees.'})})});});};
 const pending=U.prepareBrief(f.candidate,f.context,{root:f.root,isCurrent:()=>oldCurrent,onUpdate:()=>oldUpdates++});oldCurrent=false;await U.prepareBrief(f.candidate,f.context,{root:f.root,onUpdate:()=>newUpdates++});release();await pending;assert.equal(count,1);assert.equal(oldUpdates,1);assert.equal(newUpdates,1);
});
test('source and workspace changes cannot reuse another brief translation',async()=>{
 const U=ui(),f=fixture();await U.prepareBrief(f.candidate,f.context,{root:f.root});assert.doesNotMatch(U.briefHtml(f.candidate,{workspaceId:'another'}),/The company is building/);f.candidate.evidence[0].text='Bolaget planerar ett nytt kontor i Stockholm.';assert.doesNotMatch(U.briefHtml(f.candidate,f.context),/The company is building/);
});
test('one company research action remains while selected-person resume and Stop retain separate scope',()=>{
 const fs=require('fs'),vm=require('vm'),s=fs.readFileSync(require.resolve('../discovery-ui'),'utf8'),ctx={Date,esc:s=>String(s??'')};vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf('function buyerResearchProgressHtml('),s.indexOf('async function findExecutiveBuyer(')),ctx);
 const c={domain:'example.com',buyerResearchJob:{id:'job'},buyerResearchProgress:{jobId:'job',phase:'error',step:4}};
 let html=ctx.buyerResearchProgressHtml(c,{companyActionVisible:true});assert.doesNotMatch(html,/data-resume-buyer-job|data-check-buyer-job/);assert.match(html,/button above/);
 c.buyerResearchJob.personIds=['buyer'];html=ctx.buyerResearchProgressHtml(c,{companyActionVisible:true});assert.match(html,/Resume selected buyer checks/);
 c.buyerResearchProgress.connection='unavailable';html=ctx.buyerResearchProgressHtml(c,{companyActionVisible:true});assert.match(html,/data-stop-buyer-job/);assert.doesNotMatch(html,/data-check-buyer-job/);
});
test('explicit retry bypasses a cached translation rejected for changed identifiers',async()=>{
 const U=ui(),f=fixture('LKAB bygger en ny fabrik med 20 anställda.');let calls=0;f.root.fetch=async()=>({ok:true,json:async()=>({text:JSON.stringify({fact0:++calls===1?'The company is building a new factory with 20 employees.':'LKAB is building a new factory with 20 employees.'})})});await U.prepareBrief(f.candidate,f.context,{root:f.root});assert.match(U.briefHtml(f.candidate,f.context),/translation unavailable/);await U.prepareBrief(f.candidate,f.context,{root:f.root,retry:true});assert.equal(calls,2);assert.match(U.briefHtml(f.candidate,f.context),/LKAB is building/);
});
