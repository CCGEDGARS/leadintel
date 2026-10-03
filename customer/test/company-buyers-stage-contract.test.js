const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const next=require('../workflow-next-action.js');
const ui=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');

function doc(){
 const footer={hidden:false};
 const gate={textContent:'',disabled:false,dataset:{},closest:()=>footer,setAttribute(){}};
 const panel={hidden:false};
 return {footer,gate,panel,document:{querySelector:s=>s==='.pipeline-panel'?panel:null,getElementById:id=>id==='continue-to-outreach'?gate:null}};
}
test('Companies stage never exposes Messages even when stale buyers already exist',()=>{
 const x=doc();const action=next.applyStageVisibility(x.document,5,{pipelineCount:1,prospectCount:0,buyerCount:2,focus:'companies'});
 assert.equal(action.label,'Continue to Buyers →');assert.equal(x.footer.hidden,true);assert.equal(x.gate.disabled,true);
});
test('Buyers stage exposes Messages only after buyer research has produced a buyer',()=>{
 let x=doc();let action=next.applyStageVisibility(x.document,5,{pipelineCount:1,buyerCount:0,focus:'buyers'});
 assert.equal(action.label,'Find and Select a Buyer First');assert.equal(x.footer.hidden,true);
 x=doc();action=next.applyStageVisibility(x.document,5,{pipelineCount:1,buyerCount:1,focus:'buyers'});
 assert.equal(action.label,'Continue to Messages →');assert.equal(x.footer.hidden,false);assert.equal(x.gate.disabled,false);
});
test('Company selection count is deduplicated by canonical domain across CRM pipeline and selected prospects',()=>{
 assert.match(ui,/function buyerSelectionRows\(\)/);
 assert.match(ui,/const byDomain=new Map\(\)/);
 assert.match(ui,/byDomain\.set\(domain/);
 assert.match(ui,/selected\.length/);
});
test('Companies local navigation button is hidden after entering Buyers',()=>{
 assert.match(ui,/next\.hidden=focus!=="companies"/);
 assert.match(ui,/syncBuyerStageNavigation\(\)/);
});
